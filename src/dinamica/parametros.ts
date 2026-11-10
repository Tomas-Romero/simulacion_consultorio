/**
 * Parámetros por defecto del modelo de la lista de espera (supuestos SD1–SD10 de
 * docs/dinamica-sistemas.md) y la tabla de consulta micro → macro tomada del estudio (E3).
 */
import { PRESET_POLICONSULTORIO_3, prepararEscenario, type Escenario } from '../modelo';
import { anticipacionMediaTabla, ausentismo, capacidad, desaliento, type ParametrosLista, type TablaBeneficio } from './lista';

/** Turnos reservables por profesional y por día hábil (slots para turnos × ocupación), promedio del escenario. */
export function turnosReservables(e: Escenario): number {
  const prep = prepararEscenario(e);
  const n = prep.esCupo.map((c, i) => c.filter((x) => !x).length * e.profesionales[i]!.ocupacionAgenda);
  return n.reduce((s, v) => s + v, 0) / n.length;
}

export function parametrosBase(e: Escenario = PRESET_POLICONSULTORIO_3): ParametrosLista {
  const prm: ParametrosLista = {
    profesionales: e.profesionales.length,
    turnosPorProfesional: turnosReservables(e),
    diasHabiles: 5,
    demandaBase: 0,
    pico: { inicio: 10, duracion: 6, aumento: 0.3 },
    reingreso: 0.5,
    // SD5: el desaliento empieza a la semana de anticipación (u = 7 días) y llega a su máximo a las 3 semanas.
    // Con u por debajo de la anticipación de hoy, el equilibrio calibrado es estable (ver demandaCalibrada).
    desaliento: { umbral: 7, ancho: 14, maximo: 0.6 },
    tiempoMinimo: 1,
    beta0: e.ausentismo.beta0,
    beta1: e.ausentismo.beta1,
    anticipacion: e.pacientes.anticipacion.map((f) => ({ valor: f.valor, frecuencia: f.frecuencia })),
    horizonteSemanas: 36,
  };
  // SD3: demanda base calibrada para que el equilibrio sin sobreturnos sea el consultorio del estudio
  // (anticipación media de la tabla del modelo del día, 11,95 días).
  prm.demandaBase = demandaCalibrada(prm);
  return prm;
}

/**
 * Demanda constante D₀ cuyo equilibrio con k sobreturnos tiene anticipación a: se despeja de la
 * ecuación de equilibrio D·(1 − d(a)) = min(C, a·C/τ)·(1 − r·p̄(a)). Es exacta (la ecuación es
 * lineal en D); `equilibrio` y `equilibrios` la verifican.
 */
export function demandaCalibrada(prm: ParametrosLista, a = anticipacionMediaTabla(prm), k = 0): number {
  const C = capacidad(prm, k);
  return (Math.min(C, (a * C) / prm.tiempoMinimo) * (1 - prm.reingreso * ausentismo(prm, a))) / (1 - desaliento(prm, a));
}

/** Forma mínima del estudio que se necesita (E3 · ausentismo). */
export interface E3Ausentismo {
  e3: { politica: string; ausentismo: { p: number; curva: { puntos: { k: number; B: { media: number } }[] } }[] };
}

export function tablaDesdeEstudio(estudio: E3Ausentismo): TablaBeneficio {
  const niveles = estudio.e3.ausentismo;
  const ks = niveles[0]!.curva.puntos.map((x) => x.k);
  return { p: niveles.map((n) => n.p), ks, B: ks.map((_, i) => niveles.map((n) => n.curva.puntos[i]!.B.media)) };
}
