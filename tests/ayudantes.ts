/** Ayudantes estadísticos para los tests de distribuciones. */
import { inversaNormal } from '../src/motor';

export interface VerificacionMomento {
  nombre: string;
  teorico: number;
  estimado: number;
  semiancho95: number;
  z: number;
  dentro95: boolean;
}

/**
 * Compara media y varianza muestrales con las teóricas.
 * - Media: x̄ ± z·s/√n.
 * - Varianza: IC asintótico sin suponer normalidad, S² ± z·√((m4 − s⁴(n−3)/(n−1))/n),
 *   con m4 el cuarto momento central muestral.
 */
export function momentos(nombre: string, muestras: readonly number[], media: number, varianza: number): VerificacionMomento[] {
  const n = muestras.length;
  let suma = 0;
  for (const x of muestras) suma += x;
  const xbar = suma / n;
  let m2 = 0;
  let m4 = 0;
  for (const x of muestras) {
    const d2 = (x - xbar) ** 2;
    m2 += d2;
    m4 += d2 * d2;
  }
  const s2 = m2 / (n - 1);
  m4 /= n;
  const eeMedia = Math.sqrt(s2 / n);
  const eeVar = Math.sqrt(Math.max(m4 - (s2 * s2 * (n - 3)) / (n - 1), 0) / n);
  const z95 = inversaNormal(0.975);
  const zMedia = (xbar - media) / eeMedia;
  const zVar = (s2 - varianza) / eeVar;
  return [
    { nombre: `${nombre} · media`, teorico: media, estimado: xbar, semiancho95: z95 * eeMedia, z: zMedia, dentro95: Math.abs(zMedia) <= z95 },
    { nombre: `${nombre} · varianza`, teorico: varianza, estimado: s2, semiancho95: z95 * eeVar, z: zVar, dentro95: Math.abs(zVar) <= z95 },
  ];
}

/** Umbral |z| para un nivel conjunto 1 − α repartido en k comparaciones bilaterales (Bonferroni). */
export function umbralBonferroni(k: number, alfa = 0.05): number {
  return inversaNormal(1 - alfa / (2 * k));
}

export function tablaMomentos(filas: readonly VerificacionMomento[]): string {
  const f = (x: number): string => (Math.abs(x) >= 100 ? x.toFixed(2) : x.toFixed(4));
  return [
    '| Verificación | Teórico | Estimado | IC 95 % | z | ¿Dentro 95 %? |',
    '|---|---|---|---|---|---|',
    ...filas.map(
      (r) => `| ${r.nombre} | ${f(r.teorico)} | ${f(r.estimado)} | [${f(r.estimado - r.semiancho95)}, ${f(r.estimado + r.semiancho95)}] | ${r.z.toFixed(2)} | ${r.dentro95 ? 'SÍ' : 'NO'} |`,
    ),
  ].join('\n');
}
