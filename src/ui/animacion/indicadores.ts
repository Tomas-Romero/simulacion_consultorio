/**
 * Indicadores del panel en vivo en función del reloj t, calculados desde la traza.
 * Al final del día coinciden con las métricas del modelo (lo controla tests/ui/indicadores.test.ts).
 *
 * Imputación en el tiempo: el ingreso de una consulta se cuenta al terminarla; su costo de espera,
 * al empezar; un perdido, cuando sale; el ocio y las horas extra se acumulan minuto a minuto.
 */
import { MOTIVOS_PERDIDA, type MotivoPerdida } from '../../modelo';
import type { DatosAnimacion, ProfesionalAnim } from './preparar';

export type EstadoMedico = 'por_llegar' | 'libre' | 'atendiendo' | 'retirado';

export interface IndicadoresMedico {
  estado: EstadoMedico;
  atendidos: number;
  ocio: number;
  extra: number;
  /** Consulta en curso: paciente y avance 0–1. */
  enCurso: { paciente: number; avance: number } | null;
}

export interface Indicadores {
  t: number;
  llegadas: number;
  atendidos: number;
  ausentes: number;
  perdidos: Record<MotivoPerdida, number>;
  perdidosTotal: number;
  enColaAdmision: number;
  enAdmision: number;
  enSala: number;
  enConsulta: number;
  medicos: IndicadoresMedico[];
  ingresos: number;
  costoEspera: number;
  costoOcio: number;
  costoExtra: number;
  costoPerdidos: number;
  /** Beneficio neto B (criterio de decisión). */
  B: number;
  /** Costo clásico C (contraste). */
  C: number;
}

/** Ocio del médico hasta t: presente dentro de su turno y sin paciente (misma definición que el modelo). */
export function ocioHasta(p: ProfesionalAnim, t: number): number {
  const desde = p.llegada;
  const hasta = Math.min(t, p.finTurno, p.salida);
  if (hasta <= desde) return 0;
  let ocupado = 0;
  for (const c of p.consultas) {
    if (c.inicio >= hasta) break;
    ocupado += Math.max(0, Math.min(c.fin, hasta) - Math.max(c.inicio, desde));
  }
  return hasta - desde - ocupado;
}

export function extraHasta(p: ProfesionalAnim, t: number): number {
  return Math.max(0, Math.min(t, p.salida) - p.finTurno);
}

export function indicadoresEn(d: DatosAnimacion, t: number): Indicadores {
  const { escenario } = d.corrida;
  const c = escenario.costos;
  const perdidos = Object.fromEntries(MOTIVOS_PERDIDA.map((m) => [m, 0])) as Record<MotivoPerdida, number>;
  let llegadas = 0, atendidos = 0, ausentes = 0, perdidosTotal = 0;
  let enColaAdmision = 0, enAdmision = 0, enSala = 0, enConsulta = 0, sumaEspera = 0;

  for (const p of d.pacientes) {
    if (p.ausente) {
      if (p.horaTurno !== null && t >= p.horaTurno + d.tolerancia) ausentes++;
      continue;
    }
    if (t < p.llegada) continue;
    llegadas++;
    if (p.inicioConsulta !== null && t >= p.inicioConsulta) sumaEspera += p.espera ?? 0;
    if (p.finConsulta !== null && t >= p.finConsulta) {
      atendidos++;
      continue;
    }
    if (p.motivo !== null && p.salida !== null && t >= p.salida) {
      perdidos[p.motivo]++;
      perdidosTotal++;
      continue;
    }
    if (p.inicioConsulta !== null && t >= p.inicioConsulta) enConsulta++;
    else if (p.finAdmision !== null && t >= p.finAdmision) enSala++;
    else if (p.inicioAdmision !== null && t >= p.inicioAdmision) enAdmision++;
    else enColaAdmision++;
  }

  let costoOcio = 0, costoExtra = 0;
  const medicos = d.profesionales.map((p): IndicadoresMedico => {
    const ocio = ocioHasta(p, t);
    const extra = extraHasta(p, t);
    costoOcio += p.cOcio * ocio;
    costoExtra += p.cExtra * extra;
    let atendidosMed = 0;
    let enCurso: IndicadoresMedico['enCurso'] = null;
    for (const k of p.consultas) {
      if (k.fin <= t) atendidosMed++;
      else if (k.inicio <= t) enCurso = { paciente: k.paciente, avance: (t - k.inicio) / Math.max(k.fin - k.inicio, 1e-9) };
    }
    const estado: EstadoMedico = t < p.llegada ? 'por_llegar' : t >= p.salida ? 'retirado' : enCurso ? 'atendiendo' : 'libre';
    return { estado, atendidos: atendidosMed, ocio, extra, enCurso };
  });

  const ingresos = c.honorario * atendidos;
  const costoEspera = c.espera * sumaEspera;
  const costoPerdidos = c.perdido * perdidosTotal;
  return {
    t,
    llegadas,
    atendidos,
    ausentes,
    perdidos,
    perdidosTotal,
    enColaAdmision,
    enAdmision,
    enSala,
    enConsulta,
    medicos,
    ingresos,
    costoEspera,
    costoOcio,
    costoExtra,
    costoPerdidos,
    B: ingresos - costoEspera - costoExtra - costoPerdidos,
    C: costoEspera + costoOcio + costoExtra + costoPerdidos,
  };
}

/** Series de B(t) y C(t) cada `paso` minutos, para el minigráfico del panel. */
export function seriesBC(d: DatosAnimacion, paso = 5): { t: Float64Array; B: Float64Array; C: Float64Array } {
  const n = Math.floor((d.tFin - d.tInicio) / paso) + 1;
  const t = new Float64Array(n), B = new Float64Array(n), C = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ti = d.tInicio + i * paso;
    const ind = indicadoresEn(d, ti);
    t[i] = ti;
    B[i] = ind.B;
    C[i] = ind.C;
  }
  return { t, B, C };
}
