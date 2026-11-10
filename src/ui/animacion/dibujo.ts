/**
 * Dibujo de la planta en canvas. El fondo (muros, zonas, sillas, placas) se cachea en un
 * canvas aparte; en cada cuadro solo se dibujan médicos, agendas y pacientes.
 * Los pacientes se deslizan hacia su posición con suavizado exponencial en tiempo real,
 * así se ven fluidos a cualquier velocidad; al saltar en la línea de tiempo se reubican.
 */
import type { Clase, PoliticaSobreturno } from '../../modelo';
import { indicadoresEn, type Indicadores } from './indicadores';
import { ALTO, ANCHO, calcularPlano, type Plano, type Punto } from './plano';
import type { DatosAnimacion, PacienteAnim } from './preparar';

export type ModoDibujo = 'completo' | 'simple' | 'mini';

export interface Paleta {
  fondo: string;
  panel: string;
  panel2: string;
  borde: string;
  bordeFuerte: string;
  texto: string;
  texto2: string;
  texto3: string;
  dato: string;
  positivo: string;
  accion: string;
  alerta: string;
  piso: string;
  sala: string;
  muro: string;
  silla: string;
  textoPlano: string;
  clases: Record<Clase, string>;
  politicas: Record<PoliticaSobreturno, string>;
  oscuro: boolean;
}

export function leerPaleta(): Paleta {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string): string => cs.getPropertyValue(n).trim();
  return {
    fondo: v('--fondo'),
    panel: v('--panel'),
    panel2: v('--panel-2'),
    borde: v('--borde'),
    bordeFuerte: v('--borde-fuerte'),
    texto: v('--texto'),
    texto2: v('--texto-2'),
    texto3: v('--texto-3'),
    dato: v('--dato'),
    positivo: v('--positivo'),
    accion: v('--accion'),
    alerta: v('--alerta'),
    piso: v('--plano-piso'),
    sala: v('--plano-sala'),
    muro: v('--plano-muro'),
    silla: v('--plano-silla'),
    textoPlano: v('--plano-texto'),
    clases: {
      turno: v('--clase-turno'),
      sobreturno: v('--clase-sobreturno'),
      tardio: v('--clase-tardio'),
      espontaneo: v('--clase-espontaneo'),
      urgencia: v('--clase-urgencia'),
    },
    politicas: {
      inicio: v('--pol-inicio'),
      intercalado: v('--pol-intercalado'),
      mayor_ausentismo: v('--pol-mayor-ausentismo'),
      final: v('--pol-final'),
    },
    oscuro: cs.colorScheme.includes('dark'),
  };
}

const FUENTE = "'Fira Sans', system-ui, sans-serif";
/** Nombres cortos para los consultorios angostos (6 profesionales en comparación). */
const CORTO: Record<string, string> = { clinica: 'Clínica', pediatria: 'Pediatría', cardiologia: 'Cardio', traumatologia: 'Trauma', ginecologia: 'Gineco', dermatologia: 'Dermato' };
const TITULO = "'Fraunces', Georgia, serif";
const VENTANA_SALIDA = 8; // minutos de modelo que un paciente sigue visible camino a la puerta
const TAU = 0.11; // constante del suavizado [s de tiempo real]

/** Pictograma de la clase: círculo, rombo, triángulo, cuadrado o cruz (el color nunca es el único código). */
export function trazarPictograma(ctx: CanvasRenderingContext2D, clase: Clase, x: number, y: number, r: number): void {
  ctx.beginPath();
  switch (clase) {
    case 'turno':
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 'sobreturno':
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.25, y);
      ctx.lineTo(x, y + r * 1.25);
      ctx.lineTo(x - r * 1.25, y);
      ctx.closePath();
      break;
    case 'tardio':
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.15, y + r * 0.85);
      ctx.lineTo(x - r * 1.15, y + r * 0.85);
      ctx.closePath();
      break;
    case 'espontaneo':
      ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
      break;
    case 'urgencia': {
      const a = r * 0.42;
      const b = r * 1.1;
      ctx.moveTo(x - a, y - b);
      ctx.lineTo(x + a, y - b);
      ctx.lineTo(x + a, y - a);
      ctx.lineTo(x + b, y - a);
      ctx.lineTo(x + b, y + a);
      ctx.lineTo(x + a, y + a);
      ctx.lineTo(x + a, y + b);
      ctx.lineTo(x - a, y + b);
      ctx.lineTo(x - a, y + a);
      ctx.lineTo(x - b, y + a);
      ctx.lineTo(x - b, y - a);
      ctx.lineTo(x - a, y - a);
      ctx.closePath();
      break;
    }
  }
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const hhmm = (t: number): string => {
  const m = Math.floor(t + 1e-6);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

interface Visual {
  x: number;
  y: number;
}

type Etapa = 'oculto' | 'cola' | 'admision' | 'sala' | 'consulta' | 'saliendo' | 'rechazado';

export class DibujantePlano {
  readonly plano: Plano;
  private ctx: CanvasRenderingContext2D;
  private fondo: HTMLCanvasElement | null = null;
  private paleta: Paleta;
  private escala = 1;
  private dpr = 1;
  private ox = 0;
  private oy = 0;
  private visual = new Map<number, Visual>();
  private ultimoT = Number.NaN;
  private reducido: boolean;
  private canvas: HTMLCanvasElement;
  private datos: DatosAnimacion;
  private modo: ModoDibujo;
  private conReloj: boolean;

  constructor(canvas: HTMLCanvasElement, datos: DatosAnimacion, modo: ModoDibujo, paleta: Paleta) {
    this.canvas = canvas;
    this.datos = datos;
    this.modo = modo === 'mini' ? 'completo' : modo;
    this.conReloj = modo === 'mini';
    this.ctx = canvas.getContext('2d')!;
    this.paleta = paleta;
    this.plano = calcularPlano(datos.profesionales.length, datos.recepcionistas, datos.sillasMax);
    this.reducido = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  setPaleta(p: Paleta): void {
    this.paleta = p;
    this.fondo = null;
  }

  setModo(m: ModoDibujo): void {
    if (m === 'mini') m = 'completo';
    if (m !== this.modo) {
      this.modo = m;
      this.fondo = null;
    }
  }

  /** Tamaño en px CSS del canvas (mantiene la proporción 5:3 dentro de la caja). */
  dimensionar(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.escala = Math.min(cssW / ANCHO, cssH / ALTO);
    this.ox = (cssW - ANCHO * this.escala) / 2;
    this.oy = (cssH - ALTO * this.escala) / 2;
    this.fondo = null;
  }

  /** Factor para que el texto no baje de un tamaño legible cuando el plano se achica. */
  private fs(base: number): number {
    return base * Math.max(1, 0.78 / this.escala);
  }

  /** Tamaño de texto que en pantalla nunca baja de `minCss` píxeles (legible en un proyector). */
  private fsMin(base: number, minCss = 10.5): number {
    return Math.max(this.fs(base), minCss / this.escala);
  }

  /**
   * Consultorio compacto: mide menos de 150 px en pantalla o el plano está achicado (comparación,
   * tablet). Ahí todo el texto del consultorio respeta el mínimo legible y se omite la línea de horario.
   */
  private angosto(w: number): boolean {
    return w * this.escala < 150 || this.escala < 0.62;
  }

  private aplicarTransformacion(ctx: CanvasRenderingContext2D, dpr: number): void {
    ctx.setTransform(dpr * this.escala, 0, 0, dpr * this.escala, dpr * this.ox, dpr * this.oy);
  }

  private dibujarFondo(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    const p = this.paleta;
    const pl = this.plano;
    const simple = this.modo === 'simple';
    ctx.fillStyle = p.panel;
    ctx.fillRect(0, 0, c.width, c.height);
    this.aplicarTransformacion(ctx, this.dpr);

    // Edificio
    ctx.fillStyle = p.piso;
    rrect(ctx, pl.edificio.x, pl.edificio.y, pl.edificio.w, pl.edificio.h, 10);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.muro;
    ctx.stroke();
    // Vanos de la entrada y la salida
    ctx.fillStyle = p.piso;
    ctx.fillRect(pl.edificio.x - 3, pl.puerta.y0, 7, pl.puerta.y1 - pl.puerta.y0);
    ctx.fillRect(pl.salida.x0, pl.edificio.y + pl.edificio.h - 4, pl.salida.x1 - pl.salida.x0, 8);

    // Zonas
    const zona = (r: { x: number; y: number; w: number; h: number }): void => {
      ctx.fillStyle = p.sala;
      rrect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = p.borde;
      ctx.stroke();
    };
    zona(pl.admision);
    zona(pl.sala);

    // Carteles (señalética): placa oscura con texto claro y flecha de recorrido. Tamaño pensado para
    // leerse en un proyector: nunca menos de 13 px en pantalla. `ancla` alinea por la esquina inferior derecha.
    const cartel = (texto: string, x0: number, y0: number, flecha: '→' | '↓' | '←' | null, ancla: 'arriba-izquierda' | 'abajo-derecha' = 'arriba-izquierda'): void => {
      const f = this.fsMin(14, 13);
      ctx.font = `700 ${f}px ${FUENTE}`;
      const w = ctx.measureText(texto).width + (flecha ? f * 2.2 : 0) + f * 1.4;
      const h = f * 2;
      const x = ancla === 'abajo-derecha' ? x0 - w : x0;
      const y = ancla === 'abajo-derecha' ? y0 - h : y0;
      ctx.fillStyle = p.texto;
      rrect(ctx, x, y, w, h, 4);
      ctx.fill();
      ctx.fillStyle = p.panel;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(texto, x + f * 0.7, y + h / 2 + 0.5);
      if (flecha) {
        const ax = x + w - f * 1.5;
        const ay = y + h / 2;
        ctx.strokeStyle = p.panel;
        ctx.lineWidth = Math.max(2.2, f * 0.2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (flecha === '→') {
          ctx.moveTo(ax - f * 0.45, ay);
          ctx.lineTo(ax + f * 0.45, ay);
          ctx.moveTo(ax + f * 0.1, ay - f * 0.35);
          ctx.lineTo(ax + f * 0.45, ay);
          ctx.lineTo(ax + f * 0.1, ay + f * 0.35);
        } else if (flecha === '↓') {
          ctx.moveTo(ax, ay - f * 0.45);
          ctx.lineTo(ax, ay + f * 0.45);
          ctx.moveTo(ax - f * 0.35, ay + f * 0.1);
          ctx.lineTo(ax, ay + f * 0.45);
          ctx.lineTo(ax + f * 0.35, ay + f * 0.1);
        } else {
          ctx.moveTo(ax + f * 0.45, ay);
          ctx.lineTo(ax - f * 0.45, ay);
          ctx.moveTo(ax - f * 0.1, ay - f * 0.35);
          ctx.lineTo(ax - f * 0.45, ay);
          ctx.lineTo(ax - f * 0.1, ay + f * 0.35);
        }
        ctx.stroke();
      }
    };
    {
      cartel('ADMISIÓN', pl.admision.x + 10, pl.admision.y + 10, null);
      cartel('SALA DE ESPERA', pl.sala.x + 10, pl.sala.y + 10, null);
      cartel('ENTRADA', pl.edificio.x + 12, pl.puerta.y1 + 10, '→');
      cartel('SALIDA', pl.salida.x0 - 8, pl.edificio.y + pl.edificio.h - 12, '↓', 'abajo-derecha');
    }

    // Mostrador y recepcionistas
    ctx.fillStyle = p.panel2;
    rrect(ctx, pl.mostrador.x, pl.mostrador.y, pl.mostrador.w, pl.mostrador.h, 4);
    ctx.fill();
    ctx.strokeStyle = p.bordeFuerte;
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const r of pl.recepcionistas) {
      ctx.fillStyle = p.texto2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sillas
    if (!simple) {
      ctx.fillStyle = p.silla;
      for (const s of pl.sillas) {
        rrect(ctx, s.x - 12, s.y - 9, 24, 22, 5);
        ctx.fill();
      }
    }

    // Consultorios: placa numerada, nombre y especialidad
    this.datos.profesionales.forEach((prof, i) => {
      const k = pl.consultorios[i]!;
      const r = k.rect;
      ctx.fillStyle = p.sala;
      rrect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = p.borde;
      ctx.stroke();
      // Vano de la puerta hacia el pasillo
      ctx.fillStyle = p.piso;
      if (r.x <= pl.zonaConsultorios.x + 1) ctx.fillRect(r.x - 2, r.y + r.h * 0.4, 4, 34);
      // Placa
      const tam = Math.min(40, this.fs(26));
      ctx.fillStyle = p.texto;
      rrect(ctx, r.x + 10, r.y + 10, tam, tam, 4);
      ctx.fill();
      ctx.fillStyle = p.panel;
      ctx.font = `600 ${tam * 0.62}px ${TITULO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), r.x + 10 + tam / 2, r.y + 10 + tam / 2 + 1);
      if (this.angosto(r.w)) {
        // Debajo de la placa, a todo el ancho: solo la especialidad, sin la línea de horario.
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = p.textoPlano;
        const fn = this.fsMin(12.5, 11);
        ctx.font = `600 ${fn}px ${FUENTE}`;
        const nombre = ctx.measureText(prof.nombre).width <= r.w - 20 ? prof.nombre : (CORTO[prof.especialidad] ?? prof.nombre);
        ctx.fillText(recortar(ctx, nombre, r.w - 20), r.x + 10, r.y + 10 + tam + fn * 1.1);
      } else {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = p.textoPlano;
        const fn = this.fs(12.5);
        ctx.font = `600 ${fn}px ${FUENTE}`;
        const maxW = r.w - tam - 30;
        ctx.fillText(recortar(ctx, prof.nombre, maxW), r.x + tam + 18, r.y + 10 + fn);
        ctx.font = `400 ${this.fs(11)}px ${FUENTE}`;
        ctx.fillStyle = p.texto3;
        ctx.fillText(recortar(ctx, `${hhmm(prof.inicioTurno)}–${hhmm(prof.finTurno)} · D ${prof.duracionTurno}`, maxW), r.x + tam + 18, r.y + 10 + fn + this.fs(14));
      }
    });
    return c;
  }

  /** Dibuja el estado en t. `dt` = segundos reales desde el cuadro anterior; `salto` = reubicar sin animar. */
  dibujar(t: number, dt: number, salto: boolean, ind?: Indicadores): Indicadores {
    const ctx = this.ctx;
    if (!this.fondo) this.fondo = this.dibujarFondo();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.fondo, 0, 0);
    this.aplicarTransformacion(ctx, this.dpr);
    const indic = ind ?? indicadoresEn(this.datos, t);
    const reubicar = salto || this.reducido || Number.isNaN(this.ultimoT) || Math.abs(t - this.ultimoT) > 45;
    this.ultimoT = t;
    this.dibujarConsultorios(t, indic);
    this.dibujarPacientes(t, dt, reubicar);
    if (this.conReloj) this.dibujarReloj(t);
    return indic;
  }

  private dibujarReloj(t: number): void {
    const ctx = this.ctx;
    const p = this.paleta;
    ctx.fillStyle = p.texto;
    // A la izquierda del cartel de SALIDA, que en la miniatura es grande (legible en proyector).
    rrect(ctx, 400, 600, 150, 64, 6);
    ctx.fill();
    ctx.fillStyle = p.panel;
    ctx.font = `600 40px ${TITULO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hhmm(t), 475, 634);
  }

  private dibujarConsultorios(t: number, ind: Indicadores): void {
    const ctx = this.ctx;
    const p = this.paleta;
    const pl = this.plano;
    const simple = this.modo === 'simple';
    this.datos.profesionales.forEach((prof, i) => {
      const k = pl.consultorios[i]!;
      const med = ind.medicos[i]!;
      const r = k.rect;
      // Médico: figura con cruz; el anillo dice el estado.
      const { x, y } = k.medico;
      const radio = simple ? 15 : 14;
      ctx.globalAlpha = med.estado === 'retirado' || med.estado === 'por_llegar' ? 0.35 : 1;
      ctx.fillStyle = p.texto;
      ctx.beginPath();
      ctx.arc(x, y, radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.panel;
      ctx.fillRect(x - 2, y - 7, 4, 14);
      ctx.fillRect(x - 7, y - 2, 14, 4);
      ctx.globalAlpha = 1;
      const colorEstado = med.estado === 'atendiendo' ? p.dato : med.estado === 'libre' ? p.positivo : p.texto3;
      ctx.lineWidth = 3;
      ctx.strokeStyle = colorEstado;
      if (med.estado === 'por_llegar') ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, radio + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Silla del paciente
      ctx.fillStyle = p.silla;
      rrect(ctx, k.paciente.x - 13, k.paciente.y - 10, 26, 24, 5);
      ctx.fill();

      // Avance de la consulta
      const b = k.barra;
      ctx.fillStyle = p.panel2;
      rrect(ctx, b.x, b.y, b.w, b.h, 2.5);
      ctx.fill();
      if (med.enCurso) {
        const pac = this.datos.pacientes[med.enCurso.paciente]!;
        ctx.fillStyle = p.clases[pac.clase];
        rrect(ctx, b.x, b.y, Math.max(3, b.w * Math.min(1, med.enCurso.avance)), b.h, 2.5);
        ctx.fill();
      }

      if (!simple) {
        // Estado en palabras
        const angosto = this.angosto(r.w);
        const fe = angosto ? this.fsMin(11) : this.fs(11);
        ctx.font = `500 ${fe}px ${FUENTE}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = med.estado === 'atendiendo' ? p.dato : med.estado === 'libre' ? p.positivo : p.texto3;
        const texto =
          med.estado === 'por_llegar'
            ? `Llega ${hhmm(prof.llegada)}`
            : med.estado === 'retirado'
              ? `Se retiró ${hhmm(prof.salida)}`
              : med.estado === 'atendiendo'
                ? 'Atendiendo'
                : 'Libre';
        ctx.fillText(recortar(ctx, texto, b.w), b.x, b.y + 5 + fe * 1.25);
        const conteo = `${med.atendidos} atendidos`;
        if (!angosto || ctx.measureText(`${texto}    ${conteo}`).width <= b.w) {
          // En los consultorios angostos el conteo no entra legible: queda en Resultados del día.
          ctx.textAlign = 'right';
          ctx.fillStyle = p.texto3;
          ctx.fillText(conteo, b.x + b.w, b.y + 5 + fe * 1.25);
        }
        // Horas extra
        if (med.extra > 0) {
          const txt = angosto ? `+${Math.round(med.extra)}′` : `+${Math.round(med.extra)} min extra`;
          ctx.font = `600 ${fe}px ${FUENTE}`;
          const w = ctx.measureText(txt).width + 12;
          ctx.fillStyle = p.accion;
          rrect(ctx, r.x + r.w - w - 10, r.y + 12, w, fe + 8, 4);
          ctx.fill();
          ctx.fillStyle = p.panel;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, r.x + r.w - w - 4, r.y + 12 + (fe + 8) / 2 + 0.5);
        }
        this.dibujarAgenda(i, t);
      }
    });
  }

  /** Cinta de la agenda: un casillero por slot. Los ausentes quedan tachados; los cupos, en cian. */
  private dibujarAgenda(i: number, t: number): void {
    const ctx = this.ctx;
    const p = this.paleta;
    const prof = this.datos.profesionales[i]!;
    const a = this.plano.consultorios[i]!.agenda;
    const n = prof.slots.length;
    if (n === 0) return;
    const w = a.w / n;
    prof.slots.forEach((s, j) => {
      const x = a.x + j * w + 0.75;
      const ancho = Math.max(1, w - 1.5);
      if (s.esCupo) {
        ctx.strokeStyle = p.dato;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x + 0.5, a.y + 0.5, ancho - 1, a.h - 1);
        ctx.setLineDash([]);
        return;
      }
      const regular = s.pacientes.map((id) => this.datos.pacientes[id]!).find((q) => q.origen === 'turno');
      const extras = s.pacientes.map((id) => this.datos.pacientes[id]!).filter((q) => q.origen === 'sobreturno');
      if (!regular) {
        ctx.fillStyle = p.panel2;
        ctx.fillRect(x, a.y, ancho, a.h);
      } else this.casilleroAgenda(regular, x, a.y, ancho, a.h, t);
      for (const sb of extras) {
        const cx = x + ancho / 2;
        const color = this.estadoAgenda(sb, t) === 'ausente' ? p.texto3 : p.clases.sobreturno;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, a.y - 9);
        ctx.lineTo(cx + 3.5, a.y - 5);
        ctx.lineTo(cx, a.y - 1);
        ctx.lineTo(cx - 3.5, a.y - 5);
        ctx.closePath();
        ctx.fill();
      }
    });
    // Marca de "ahora" sobre la agenda
    const D = prof.duracionTurno;
    const u = (t - prof.inicioTurno) / (n * D);
    if (u >= 0 && u <= 1) {
      ctx.fillStyle = p.accion;
      ctx.fillRect(a.x + u * a.w - 1, a.y - 3, 2, a.h + 6);
    }
  }

  private estadoAgenda(q: PacienteAnim, t: number): 'pendiente' | 'ausente' | 'perdido' | 'en_curso' | 'atendido' | 'esperando' {
    if (q.ausente) return q.horaTurno !== null && t >= q.horaTurno + this.datos.tolerancia ? 'ausente' : 'pendiente';
    if (q.finConsulta !== null && t >= q.finConsulta) return 'atendido';
    if (q.inicioConsulta !== null && t >= q.inicioConsulta) return 'en_curso';
    if (q.motivo !== null && q.salida !== null && t >= q.salida) return 'perdido';
    if (t >= q.llegada) return 'esperando';
    return 'pendiente';
  }

  private casilleroAgenda(q: PacienteAnim, x: number, y: number, w: number, h: number, t: number): void {
    const ctx = this.ctx;
    const p = this.paleta;
    const e = this.estadoAgenda(q, t);
    const color = p.clases[q.clase];
    if (e === 'atendido' || e === 'en_curso') {
      ctx.globalAlpha = e === 'en_curso' ? 0.55 : 1;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    } else if (e === 'ausente' || e === 'perdido') {
      ctx.strokeStyle = e === 'perdido' ? p.alerta : p.texto3;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 1.5]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x + 1, y + h - 1);
      ctx.lineTo(x + w - 1, y + 1);
      ctx.stroke();
    } else {
      ctx.fillStyle = e === 'esperando' ? p.bordeFuerte : p.panel2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = p.borde;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }

  private etapa(q: PacienteAnim, t: number): Etapa {
    if (q.ausente || t < q.llegada) return 'oculto';
    if (q.rechazado) return t < q.llegada + VENTANA_SALIDA ? 'rechazado' : 'oculto';
    const fin = q.finConsulta ?? q.salida ?? Infinity;
    if (t >= fin) return t < fin + VENTANA_SALIDA ? 'saliendo' : 'oculto';
    if (q.inicioConsulta !== null && t >= q.inicioConsulta) return 'consulta';
    if (q.finAdmision !== null && t >= q.finAdmision) return 'sala';
    if (q.inicioAdmision !== null && t >= q.inicioAdmision) return 'admision';
    return 'cola';
  }

  private dibujarPacientes(t: number, dt: number, reubicar: boolean): void {
    const ctx = this.ctx;
    const p = this.paleta;
    const pl = this.plano;
    const simple = this.modo === 'simple';
    const k = reubicar ? 1 : 1 - Math.exp(-Math.max(dt, 0) / TAU);
    let enCola = 0;
    let parados = 0;
    const vivos = new Set<number>();
    const r = simple ? 10 : 8.5;

    for (const q of this.datos.porLlegada) {
      if (q.llegada > t) break;
      const et = this.etapa(q, t);
      if (et === 'oculto') continue;
      let obj: Punto;
      let desde: Punto = pl.afuera;
      switch (et) {
        case 'cola':
          obj = pl.colaEn(enCola++);
          break;
        case 'admision':
          obj = pl.puestos[Math.max(0, q.puesto) % pl.puestos.length]!;
          obj = { x: obj.x, y: obj.y + 14 };
          break;
        case 'sala':
          obj = q.silla >= 0 && q.silla < pl.sillas.length ? pl.sillas[q.silla]! : pl.paradoEn(parados++);
          break;
        case 'consulta':
          obj = pl.consultorios[q.consultorio]?.paciente ?? pl.adentro;
          break;
        case 'saliendo':
          obj = q.resultado === 'atendido' ? pl.fueraSalida : pl.afuera;
          desde = obj;
          break;
        case 'rechazado':
          obj = t < q.llegada + VENTANA_SALIDA / 3 ? pl.adentro : pl.afuera;
          break;
      }
      let v = this.visual.get(q.id);
      if (!v) {
        v = reubicar ? { ...obj } : { ...desde };
        this.visual.set(q.id, v);
      }
      v.x += (obj.x - v.x) * k;
      v.y += (obj.y - v.y) * k;
      if ((et === 'saliendo' || (et === 'rechazado' && obj === pl.afuera)) && Math.hypot(obj.x - v.x, obj.y - v.y) < 8) {
        this.visual.delete(q.id);
        continue;
      }
      vivos.add(q.id);

      // Pictograma
      const color = p.clases[q.clase];
      ctx.globalAlpha = et === 'rechazado' || (et === 'saliendo' && q.resultado !== 'atendido') ? 0.45 : 1;
      trazarPictograma(ctx, q.clase, v.x, v.y, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = p.panel;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Anillo de paciencia consumida (espontáneos que pueden abandonar)
      if (q.paciencia !== null && (et === 'cola' || et === 'admision' || et === 'sala')) {
        const u = Math.min(1, (t - q.llegada) / q.paciencia);
        ctx.lineWidth = 2.25;
        ctx.strokeStyle = p.borde;
        ctx.beginPath();
        ctx.arc(v.x, v.y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = u > 0.75 ? p.alerta : p.texto2;
        ctx.beginPath();
        ctx.arc(v.x, v.y, r + 5, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2);
        ctx.stroke();
      }
    }
    // Olvida a los que ya no se ven (al volver atrás, reaparecen desde su lugar).
    if (this.visual.size > vivos.size + 64) for (const id of this.visual.keys()) if (!vivos.has(id)) this.visual.delete(id);
  }
}

function recortar(ctx: CanvasRenderingContext2D, texto: string, max: number): string {
  if (ctx.measureText(texto).width <= max) return texto;
  let s = texto;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}
