/**
 * Esquema de un experimento y aplicación de sus niveles al escenario. Las variaciones se aplican
 * acá, como modificaciones de una copia del escenario: el modelo y los presets no se tocan.
 */
import { z } from 'zod';
import { EsquemaEscenario, EsquemaPoliticaSobreturno, probabilidadNoShow, type Escenario, type PoliticaSobreturno } from '../modelo';

export const EsquemaExperimento = z.object({
  nombre: z.string(),
  escenarioBase: EsquemaEscenario,
  factores: z.object({
    /** Sobreturnos por profesional (el mismo k para todos). */
    k: z.array(z.number().int().min(0).max(40)).min(1),
    politicas: z.array(EsquemaPoliticaSobreturno).min(1),
    /** Ausentismo medio objetivo de los pacientes con turno (se ajusta β₀ con β₁ fijo); vacío = el del escenario. */
    ausentismo: z.array(z.number().gt(0).lt(1)).default([]),
  }),
  /** Réplicas (días) por configuración. */
  R: z.number().int().min(2).max(100_000),
  semilla: z.number().int().nonnegative(),
});
export type Experimento = z.infer<typeof EsquemaExperimento>;

export interface Nivel {
  k: number;
  politica: PoliticaSobreturno;
  /** Ausentismo medio objetivo, o null para dejar el del escenario. */
  ausentismo: number | null;
}

/** Ausentismo medio de los turnos regulares: Σ f_d · p(d) / Σ f_d sobre la tabla de anticipación. */
export function ausentismoMedio(e: Escenario): number {
  const tabla = e.pacientes.anticipacion;
  const total = tabla.reduce((s, f) => s + f.frecuencia, 0);
  return tabla.reduce((s, f) => s + f.frecuencia * probabilidadNoShow(e, f.valor), 0) / total;
}

/** β₀ que da el ausentismo medio p con β₁ fijo (bisección; p̄ es creciente en β₀). */
export function beta0ParaAusentismo(e: Escenario, p: number): number {
  let lo = -20;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (ausentismoMedio({ ...e, ausentismo: { ...e.ausentismo, beta0: m } }) < p) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Copia del escenario con el nivel aplicado: k y política en todos los profesionales y, si corresponde, β₀. */
export function aplicarNivel(e: Escenario, n: Nivel): Escenario {
  const conK: Escenario = { ...e, profesionales: e.profesionales.map((p) => ({ ...p, sobreturnos: { k: n.k, politica: n.politica } })) };
  if (n.ausentismo === null) return conK;
  return { ...conK, ausentismo: { ...conK.ausentismo, beta0: beta0ParaAusentismo(e, n.ausentismo) } };
}

/** Configuraciones del experimento en orden fijo: política → ausentismo → k. */
export function configuraciones(exp: Experimento): Nivel[] {
  const aus = exp.factores.ausentismo.length > 0 ? exp.factores.ausentismo : [null];
  const out: Nivel[] = [];
  for (const politica of exp.factores.politicas) for (const ausentismo of aus) for (const k of exp.factores.k) out.push({ k, politica, ausentismo });
  return out;
}
