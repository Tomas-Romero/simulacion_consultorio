/**
 * Análisis de las series diarias: IC, diferencias pareadas, conjunto de óptimos indistinguibles
 * (Bonferroni contra el mejor), regla de precisión, reponderación de costos, percentiles y ajuste
 * log-log. Funciones puras (docs/experimentos.md, secciones 4–7).
 */
import type { Escenario } from '../modelo';
import { intervaloConfianza, nivelBonferroni } from '../motor';
import { IDX, M, type Metrica } from './tareas';

export interface IC {
  media: number;
  inf: number;
  sup: number;
  semi: number;
}

export function ic(valores: ArrayLike<number>, nivel = 0.95): IC {
  const r = intervaloConfianza(Array.from(valores), nivel);
  return { media: r.media, inf: r.inferior, sup: r.superior, semi: r.semiancho };
}

/** IC de la diferencia pareada a − b (mismas réplicas; se usan las primeras `n`). */
export function diferencia(a: ArrayLike<number>, b: ArrayLike<number>, nivel = 0.95, n = Math.min(a.length, b.length)): IC {
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = a[i]! - b[i]!;
  return ic(d, nivel);
}

export function contieneCero(x: IC): boolean {
  return x.inf <= 0 && x.sup >= 0;
}

/** Columna de una métrica (R valores diarios). */
export function columna(datos: Float64Array, R: number, m: Metrica): Float64Array {
  const out = new Float64Array(R);
  const j = IDX[m];
  for (let r = 0; r < R; r++) out[r] = datos[r * M + j]!;
  return out;
}

export interface Costos {
  honorario: number;
  cEspera: number;
  cPerdido: number;
  /** Factor de c_extra sobre c_ocio; null = c_extra fijo del escenario (se usa la columna costoExtra). */
  factorExtra: number | null;
}

export function costosDe(e: Escenario): Costos {
  const c = e.costos;
  return { honorario: c.honorario, cEspera: c.espera, cPerdido: c.perdido, factorExtra: typeof c.extra === 'number' ? null : c.extra.derivado };
}

/**
 * B diario con otros costos, sin volver a simular (los costos no cambian la dinámica):
 * B = honorario·atendidos − c_espera·Σespera − factor·Σ c_ocio·extra − c_perdido·perdidos.
 */
export function beneficioDiario(datos: Float64Array, R: number, c: Costos): Float64Array {
  const out = new Float64Array(R);
  for (let r = 0; r < R; r++) {
    const f = r * M;
    const extra = c.factorExtra === null ? datos[f + IDX.costoExtra]! : c.factorExtra * datos[f + IDX.extraOcio]!;
    out[r] = c.honorario * datos[f + IDX.atendidos]! - c.cEspera * datos[f + IDX.sumaEspera]! - extra - c.cPerdido * datos[f + IDX.perdidos]!;
  }
  return out;
}

/** C diario con otros costos: c_espera·Σespera + Σ c_ocio·ocio + c_extra·extra + c_perdido·perdidos. */
export function costoDiario(datos: Float64Array, R: number, c: Costos): Float64Array {
  const out = new Float64Array(R);
  for (let r = 0; r < R; r++) {
    const f = r * M;
    const extra = c.factorExtra === null ? datos[f + IDX.costoExtra]! : c.factorExtra * datos[f + IDX.extraOcio]!;
    out[r] = c.cEspera * datos[f + IDX.sumaEspera]! + datos[f + IDX.ocioPond]! + extra + c.cPerdido * datos[f + IDX.perdidos]!;
  }
  return out;
}

export interface AnalisisSerie {
  ks: number[];
  R: number;
  B: IC[];
  C: IC[];
  /** Mejor estimado: argmax B̄. */
  kHat: number;
  /** Conjunto de óptimos indistinguibles (Bonferroni contra kHat), en orden creciente. */
  conjunto: number[];
  /** Recomendado: el menor k del conjunto. */
  kRec: number;
  /** argmin C̄ (contraste). */
  kC: number;
  /** Diferencias pareadas contra el mejor: B(kHat) − B(k), al nivel de Bonferroni. */
  contraMejor: { k: number; ic: IC }[];
  /** B(k+1) − B(k), IC 95 %. */
  consecutivas: { de: number; a: number; ic: IC }[];
  /** B(k) − B(0), IC 95 % (el primer k de la serie hace de referencia). */
  contraCero: { k: number; ic: IC }[];
  nivelBonferroni: number;
}

export function analizarSerie(ks: number[], Bs: readonly Float64Array[], Cs: readonly Float64Array[]): AnalisisSerie {
  const R = Bs[0]!.length;
  const B = Bs.map((b) => ic(b));
  const C = Cs.map((c) => ic(c));
  let iHat = 0;
  B.forEach((x, i) => {
    if (x.media > B[iHat]!.media) iHat = i;
  });
  let iC = 0;
  C.forEach((x, i) => {
    if (x.media < C[iC]!.media) iC = i;
  });
  const nivel = nivelBonferroni(0.95, Math.max(1, ks.length - 1));
  const contraMejor = ks.map((k, i) => ({ k, ic: i === iHat ? { media: 0, inf: 0, sup: 0, semi: 0 } : diferencia(Bs[iHat]!, Bs[i]!, nivel) }));
  const conjunto = ks.filter((_, i) => i === iHat || contraMejor[i]!.ic.inf <= 0);
  return {
    ks,
    R,
    B,
    C,
    kHat: ks[iHat]!,
    conjunto,
    kRec: Math.min(...conjunto),
    kC: ks[iC]!,
    contraMejor: contraMejor.filter((_, i) => i !== iHat),
    consecutivas: ks.slice(1).map((k, i) => ({ de: ks[i]!, a: k, ic: diferencia(Bs[i + 1]!, Bs[i]!) })),
    contraCero: ks.slice(1).map((k, i) => ({ k, ic: diferencia(Bs[i + 1]!, Bs[0]!) })),
    nivelBonferroni: nivel,
  };
}

/** Regla de precisión: ¿alguna diferencia consecutiva alrededor del óptimo tiene semiancho > umbral? */
export function requiereMasReplicas(a: AnalisisSerie, umbral = 3000): boolean {
  return a.consecutivas.filter((d) => d.a === a.kHat || d.de === a.kHat).some((d) => d.ic.semi > umbral);
}

/** Percentil p (0–1) por interpolación lineal entre estadísticos de orden. */
export function percentil(ordenados: ArrayLike<number>, p: number): number {
  const n = ordenados.length;
  const pos = p * (n - 1);
  const i = Math.floor(pos);
  const a = ordenados[i]!;
  const b = ordenados[Math.min(i + 1, n - 1)]!;
  return a + (pos - i) * (b - a);
}

/** Mínimos cuadrados de log(y) = a + b·log(x). */
export function ajusteLogLog(xs: readonly number[], ys: readonly number[]): { pendiente: number; intercepto: number; r2: number } {
  const lx = xs.map(Math.log);
  const ly = ys.map(Math.log);
  const n = lx.length;
  const mx = lx.reduce((s, v) => s + v, 0) / n;
  const my = ly.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (lx[i]! - mx) * (ly[i]! - my);
    sxx += (lx[i]! - mx) ** 2;
    syy += (ly[i]! - my) ** 2;
  }
  const pendiente = sxy / sxx;
  return { pendiente, intercepto: my - pendiente * mx, r2: (sxy * sxy) / (sxx * syy) };
}
