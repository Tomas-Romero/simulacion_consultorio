/**
 * Regresión logística del ausentismo: P(falta | d días) = 1 / (1 + exp(−(β₀ + β₁·d))), estimada
 * por máxima verosimilitud con Newton-Raphson (equivale a IRLS). Errores estándar de la inversa
 * de la información observada (XᵀWX)⁻¹.
 */

export interface Observacion {
  /** Días de anticipación del turno. */
  anticipacion: number;
  /** 1 = asistió, 0 = faltó. */
  asistio: 0 | 1;
}

export interface ResultadoLogistica {
  beta0: number;
  beta1: number;
  ee0: number;
  ee1: number;
  /** Covarianza de (β₀, β₁). */
  cov01: number;
  logVerosimilitud: number;
  iteraciones: number;
  convergio: boolean;
  n: number;
  faltas: number;
}

const logistica = (z: number): number => 1 / (1 + Math.exp(-z));

export function probabilidadFalta(beta0: number, beta1: number, d: number): number {
  return logistica(beta0 + beta1 * d);
}

/** Ajusta P(falta) = logística(β₀ + β₁·d). La variable respuesta es "faltó" = 1 − asistió. */
export function regresionLogistica(obs: readonly Observacion[]): ResultadoLogistica {
  const n = obs.length;
  const faltas = obs.reduce((s, o) => s + (1 - o.asistio), 0);
  if (n < 3) throw new Error('Hacen falta al menos 3 observaciones.');
  if (faltas === 0 || faltas === n) throw new Error('Hace falta que haya asistencias y faltas: con una sola clase la verosimilitud no tiene máximo.');
  const ds = obs.map((o) => o.anticipacion);
  if (Math.max(...ds) === Math.min(...ds)) throw new Error('Todas las observaciones tienen la misma anticipación: β₁ no se puede estimar.');
  // Arranque: β₁ = 0 y β₀ = logit de la proporción de faltas.
  let b0 = Math.log(faltas / (n - faltas));
  let b1 = 0;
  let iter = 0;
  let convergio = false;
  let h00 = 0, h01 = 0, h11 = 0;
  for (iter = 1; iter <= 100; iter++) {
    let g0 = 0, g1 = 0;
    h00 = 0;
    h01 = 0;
    h11 = 0;
    for (const o of obs) {
      const y = 1 - o.asistio;
      const p = logistica(b0 + b1 * o.anticipacion);
      const w = p * (1 - p);
      g0 += y - p;
      g1 += (y - p) * o.anticipacion;
      h00 += w;
      h01 += w * o.anticipacion;
      h11 += w * o.anticipacion * o.anticipacion;
    }
    const det = h00 * h11 - h01 * h01;
    const d0 = (h11 * g0 - h01 * g1) / det;
    const d1 = (h00 * g1 - h01 * g0) / det;
    b0 += d0;
    b1 += d1;
    if (Math.abs(d0) < 1e-12 && Math.abs(d1) < 1e-12) {
      convergio = true;
      break;
    }
  }
  // Información en el óptimo final.
  h00 = 0;
  h01 = 0;
  h11 = 0;
  let logL = 0;
  for (const o of obs) {
    const y = 1 - o.asistio;
    const p = logistica(b0 + b1 * o.anticipacion);
    const w = p * (1 - p);
    h00 += w;
    h01 += w * o.anticipacion;
    h11 += w * o.anticipacion * o.anticipacion;
    logL += y * Math.log(p) + (1 - y) * Math.log(1 - p);
  }
  const det = h00 * h11 - h01 * h01;
  return { beta0: b0, beta1: b1, ee0: Math.sqrt(h11 / det), ee1: Math.sqrt(h00 / det), cov01: -h01 / det, logVerosimilitud: logL, iteraciones: iter, convergio, n, faltas };
}

export interface Tramo {
  anticipacion: number;
  n: number;
  faltas: number;
  proporcion: number;
  /** IC 95 % de Wilson para la proporción de faltas. */
  inf: number;
  sup: number;
}

/** Proporción de faltas observada por valor de anticipación (o por tramos si hay muchos valores). */
export function proporcionesPorTramo(obs: readonly Observacion[], maxTramos = 12): Tramo[] {
  const valores = [...new Set(obs.map((o) => o.anticipacion))].sort((a, b) => a - b);
  let grupos: { anticipacion: number; obs: Observacion[] }[];
  if (valores.length <= maxTramos) {
    grupos = valores.map((v) => ({ anticipacion: v, obs: obs.filter((o) => o.anticipacion === v) }));
  } else {
    // Tramos de igual cantidad de observaciones; se informa la anticipación media del tramo.
    const o = [...obs].sort((a, b) => a.anticipacion - b.anticipacion);
    grupos = [];
    for (let i = 0; i < maxTramos; i++) {
      const parte = o.slice(Math.round((i * o.length) / maxTramos), Math.round(((i + 1) * o.length) / maxTramos));
      if (parte.length) grupos.push({ anticipacion: parte.reduce((s, x) => s + x.anticipacion, 0) / parte.length, obs: parte });
    }
  }
  const z = 1.959964;
  return grupos.map(({ anticipacion, obs: g }) => {
    const n = g.length;
    const faltas = g.reduce((s, o) => s + (1 - o.asistio), 0);
    const p = faltas / n;
    const centro = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
    const semi = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
    return { anticipacion, n, faltas, proporcion: p, inf: Math.max(0, centro - semi), sup: Math.min(1, centro + semi) };
  });
}
