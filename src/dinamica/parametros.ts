/**
 * Parámetros por defecto del modelo de la lista de espera (supuestos SD1–SD9 de
 * docs/dinamica-sistemas.md) y la tabla de consulta micro → macro tomada del estudio (E3).
 */
import { PRESET_POLICONSULTORIO_3, prepararEscenario, type Escenario } from '../modelo';
import type { ParametrosLista, TablaBeneficio } from './lista';

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
    desaliento: { umbral: 14, ancho: 14, maximo: 0.6 },
    tiempoMinimo: 1,
    beta0: e.ausentismo.beta0,
    beta1: e.ausentismo.beta1,
    anticipacion: e.pacientes.anticipacion.map((f) => ({ valor: f.valor, frecuencia: f.frecuencia })),
    horizonteSemanas: 36,
  };
  // SD3: demanda base = capacidad sin sobreturnos (la agenda llena del modelo del día).
  prm.demandaBase = (prm.profesionales * prm.turnosPorProfesional * prm.diasHabiles) / 7;
  return prm;
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
