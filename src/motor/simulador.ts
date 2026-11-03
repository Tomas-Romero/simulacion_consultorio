/**
 * Núcleo de simulación de eventos discretos (enfoque de programación de eventos).
 *
 * - Reloj: avanza de evento en evento (próximo evento), nunca en pasos fijos.
 * - Lista de eventos futuros: montículo binario ordenado por
 *   (tiempo, prioridad, secuencia). La secuencia es un contador global, así
 *   dos eventos simultáneos con la misma prioridad salen en el orden en que se
 *   programaron: la corrida es determinista dada la semilla.
 * - Cancelación perezosa: un evento cancelado queda en el montículo marcado y
 *   se descarta al extraerlo (lo usa, p. ej., el abandono por impaciencia).
 */
import { MonticuloBinario } from './monticulo';
import { Traza, type RegistroTraza } from './traza';

export interface Entidad {
  readonly id: number;
  readonly tipo: string;
  readonly tCreacion: number;
}

export interface EventoProgramado {
  readonly tiempo: number;
  readonly prioridad: number;
  readonly secuencia: number;
  readonly etiqueta: string;
  cancelado: boolean;
}

interface EventoInterno extends EventoProgramado {
  readonly accion: () => void;
}

function eventoAntes(a: EventoInterno, b: EventoInterno): boolean {
  if (a.tiempo !== b.tiempo) return a.tiempo < b.tiempo;
  if (a.prioridad !== b.prioridad) return a.prioridad < b.prioridad;
  return a.secuencia < b.secuencia;
}

export interface OpcionesSimulador {
  /** Registrar la traza de eventos por entidad (desactivar en corridas Monte Carlo masivas). */
  traza?: boolean;
  /** Instante inicial del reloj. */
  tInicial?: number;
}

export class Simulador {
  reloj: number;
  readonly traza: Traza;
  eventosProcesados = 0;
  private readonly lef = new MonticuloBinario<EventoInterno>(eventoAntes);
  private secuencia = 0;
  private proximoIdEntidad = 0;
  private detenido = false;

  constructor(opciones: OpcionesSimulador = {}) {
    this.reloj = opciones.tInicial ?? 0;
    this.traza = new Traza(opciones.traza ?? false);
  }

  /** Programa `accion` en el instante absoluto `tiempo`. Menor prioridad = se procesa antes ante empates. */
  programarEn(tiempo: number, accion: () => void, etiqueta = '', prioridad = 0): EventoProgramado {
    if (!(tiempo >= this.reloj)) {
      throw new Error(`No se puede programar en el pasado (${tiempo} < ${this.reloj}) [${etiqueta}]`);
    }
    const ev: EventoInterno = { tiempo, prioridad, secuencia: this.secuencia++, etiqueta, cancelado: false, accion };
    this.lef.insertar(ev);
    return ev;
  }

  /** Programa `accion` dentro de `retraso` unidades de tiempo. */
  programar(retraso: number, accion: () => void, etiqueta = '', prioridad = 0): EventoProgramado {
    return this.programarEn(this.reloj + retraso, accion, etiqueta, prioridad);
  }

  cancelar(evento: EventoProgramado): void {
    evento.cancelado = true;
  }

  get eventosPendientes(): number {
    return this.lef.tamano;
  }

  /** Procesa eventos con tiempo ≤ tFin y deja el reloj en tFin. */
  ejecutarHasta(tFin: number): void {
    this.detenido = false;
    for (;;) {
      if (this.detenido) return;
      const prox = this.lef.verMinimo();
      if (!prox || prox.tiempo > tFin) break;
      this.lef.extraerMinimo();
      if (prox.cancelado) continue;
      this.reloj = prox.tiempo;
      this.eventosProcesados++;
      prox.accion();
    }
    if (Number.isFinite(tFin)) this.reloj = Math.max(this.reloj, tFin);
  }

  /** Procesa eventos hasta vaciar la lista o hasta que se llame a `detener()`. */
  ejecutar(): void {
    this.ejecutarHasta(Infinity);
  }

  detener(): void {
    this.detenido = true;
  }

  crearEntidad(tipo: string): Entidad {
    return { id: this.proximoIdEntidad++, tipo, tCreacion: this.reloj };
  }

  /** Atajo para agregar un registro de traza con el reloj actual. */
  registrar(entidad: Entidad, tipo: RegistroTraza['tipo'], extra: Pick<RegistroTraza, 'recurso' | 'unidad' | 'detalle'> = {}): void {
    if (this.traza.activa) this.traza.registrar({ t: this.reloj, entidad: entidad.id, tipo, ...extra });
  }
}
