/**
 * Ajuste de tiempos de atención por máxima verosimilitud (lognormal, gamma, exponencial) más la
 * discreta empírica (como en el TP5), y bondad de ajuste con Kolmogorov-Smirnov y χ².
 *
 * - Lognormal: μ̂ = media de ln x, σ̂² = media de (ln x − μ̂)² (MV, con n en el denominador).
 *   EE: σ̂/√n y σ̂/√(2n) (inversa de la información de Fisher).
 * - Gamma (forma α, escala θ): Newton sobre ln α − ψ(α) = ln x̄ − media(ln x), θ̂ = x̄/α̂.
 *   EE: inversa de la información de Fisher n·[[ψ'(α), 1/θ], [1/θ, α/θ²]].
 * - Exponencial: mediâ = x̄, EE = x̄/√n.
 * - χ²: clases equiprobables bajo la distribución ajustada; k = 2·n^0,4 redondeado (regla de
 *   Mann-Wald, con la mitad de las clases que la regla original para tener frecuencias esperadas
 *   grandes), acotado a [5, n/5] para que cada clase espere al menos 5 observaciones. Grados de
 *   libertad = k − 1 − parámetros estimados.
 * - KS: D = sup |F_n − F̂|; valor p asintótico de Kolmogorov. Con parámetros estimados de los
 *   mismos datos el valor p es conservador (Lilliefors): sirve para comparar, no como prueba exacta.
 */
import { acumuladaNormal, inversaNormal } from '../motor/funciones-especiales';
import { colaChi2, colaKolmogorov, digamma, gammaP, lnGamma, trigamma } from './especiales';

export type Familia = 'lognormal' | 'gamma' | 'exponencial' | 'empirica';
export const FAMILIAS: readonly Familia[] = ['lognormal', 'gamma', 'exponencial', 'empirica'];
export const NOMBRES_FAMILIA: Record<Familia, string> = { lognormal: 'Lognormal', gamma: 'Gamma', exponencial: 'Exponencial', empirica: 'Empírica discreta' };

export interface Parametro {
  nombre: string;
  valor: number;
  /** Error estándar asintótico (MV); NaN si no corresponde. */
  ee: number;
}

export interface Ajuste {
  familia: Familia;
  n: number;
  parametros: Parametro[];
  /** Cantidad de parámetros estimados (para los grados de libertad de χ² y el AIC). */
  k: number;
  media: number;
  cv: number;
  logVerosimilitud: number;
  aic: number;
  densidad(x: number): number;
  acumulada(x: number): number;
  cuantil(u: number): number;
}

const media = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

function validarDatos(xs: readonly number[]): void {
  if (xs.length < 2) throw new Error('Hacen falta al menos 2 observaciones.');
  if (xs.some((x) => !(x > 0) || !Number.isFinite(x))) throw new Error('Todas las duraciones tienen que ser números positivos.');
}

export function ajustarLognormal(xs: readonly number[]): Ajuste {
  validarDatos(xs);
  const n = xs.length;
  const ln = xs.map(Math.log);
  const mu = media(ln);
  const s2 = ln.reduce((s, v) => s + (v - mu) ** 2, 0) / n;
  const sigma = Math.sqrt(s2);
  const logL = ln.reduce((s, v) => s - v - Math.log(sigma * Math.sqrt(2 * Math.PI)) - (v - mu) ** 2 / (2 * s2), 0);
  return {
    familia: 'lognormal',
    n,
    parametros: [
      { nombre: 'μ (de ln x)', valor: mu, ee: sigma / Math.sqrt(n) },
      { nombre: 'σ (de ln x)', valor: sigma, ee: sigma / Math.sqrt(2 * n) },
    ],
    k: 2,
    media: Math.exp(mu + s2 / 2),
    cv: Math.sqrt(Math.exp(s2) - 1),
    logVerosimilitud: logL,
    aic: 2 * 2 - 2 * logL,
    densidad: (x) => (x <= 0 ? 0 : Math.exp(-((Math.log(x) - mu) ** 2) / (2 * s2)) / (x * sigma * Math.sqrt(2 * Math.PI))),
    acumulada: (x) => (x <= 0 ? 0 : acumuladaNormal((Math.log(x) - mu) / sigma)),
    cuantil: (u) => Math.exp(mu + sigma * inversaNormal(u)),
  };
}

/** Cuantil por bisección sobre una acumulada continua y creciente en (0, ∞). */
function invertir(F: (x: number) => number, u: number, escala: number): number {
  let lo = 0;
  let hi = escala;
  while (F(hi) < u) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (F(m) < u) lo = m;
    else hi = m;
    if (hi - lo < 1e-12 * hi) break;
  }
  return (lo + hi) / 2;
}

export function ajustarGamma(xs: readonly number[]): Ajuste {
  validarDatos(xs);
  const n = xs.length;
  const xm = media(xs);
  const s = Math.log(xm) - media(xs.map(Math.log));
  // Punto de partida (Minka) y Newton sobre f(α) = ln α − ψ(α) − s.
  let a = (3 - s + Math.sqrt((s - 3) ** 2 + 24 * s)) / (12 * s);
  for (let i = 0; i < 100; i++) {
    const f = Math.log(a) - digamma(a) - s;
    const df = 1 / a - trigamma(a);
    const nuevo = a - f / df;
    const siguiente = nuevo > 0 ? nuevo : a / 2;
    if (Math.abs(siguiente - a) < 1e-14 * a) {
      a = siguiente;
      break;
    }
    a = siguiente;
  }
  const theta = xm / a;
  // Información de Fisher por observación: [[ψ'(α), 1/θ], [1/θ, α/θ²]].
  const i11 = trigamma(a);
  const i12 = 1 / theta;
  const i22 = a / (theta * theta);
  const det = n * n * (i11 * i22 - i12 * i12);
  const varA = (n * i22) / det;
  const varT = (n * i11) / det;
  const lgA = lnGamma(a);
  const logL = xs.reduce((s2, x) => s2 + (a - 1) * Math.log(x) - x / theta - lgA - a * Math.log(theta), 0);
  const F = (x: number): number => (x <= 0 ? 0 : gammaP(a, x / theta));
  return {
    familia: 'gamma',
    n,
    parametros: [
      { nombre: 'α (forma)', valor: a, ee: Math.sqrt(varA) },
      { nombre: 'θ (escala) [min]', valor: theta, ee: Math.sqrt(varT) },
    ],
    k: 2,
    media: a * theta,
    cv: 1 / Math.sqrt(a),
    logVerosimilitud: logL,
    aic: 2 * 2 - 2 * logL,
    densidad: (x) => (x <= 0 ? 0 : Math.exp((a - 1) * Math.log(x) - x / theta - lgA - a * Math.log(theta))),
    acumulada: F,
    cuantil: (u) => invertir(F, u, a * theta),
  };
}

export function ajustarExponencial(xs: readonly number[]): Ajuste {
  validarDatos(xs);
  const n = xs.length;
  const m = media(xs);
  const logL = -n * Math.log(m) - n;
  return {
    familia: 'exponencial',
    n,
    parametros: [{ nombre: 'media [min]', valor: m, ee: m / Math.sqrt(n) }],
    k: 1,
    media: m,
    cv: 1,
    logVerosimilitud: logL,
    aic: 2 - 2 * logL,
    densidad: (x) => (x < 0 ? 0 : Math.exp(-x / m) / m),
    acumulada: (x) => (x <= 0 ? 0 : 1 - Math.exp(-x / m)),
    cuantil: (u) => -m * Math.log(1 - u),
  };
}

/** Tabla valor/frecuencia redondeando al minuto (como el TP5). */
export function tablaEmpirica(xs: readonly number[], paso = 1): { valor: number; frecuencia: number }[] {
  const m = new Map<number, number>();
  for (const x of xs) {
    const v = Math.max(paso, Math.round(x / paso) * paso);
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([valor, frecuencia]) => ({ valor, frecuencia }));
}

/**
 * Discreta empírica (TP5): reproduce las frecuencias observadas, redondeadas al minuto. No tiene
 * parámetros que estimar; su "ajuste" es perfecto por construcción y por eso no se le aplican las
 * pruebas de bondad de ajuste (no hay grados de libertad).
 */
export function ajustarEmpirica(xs: readonly number[]): Ajuste & { tabla: { valor: number; frecuencia: number }[] } {
  validarDatos(xs);
  const n = xs.length;
  const tabla = tablaEmpirica(xs);
  const acum: number[] = [];
  let s = 0;
  for (const f of tabla) {
    s += f.frecuencia;
    acum.push(s / n);
  }
  const m = tabla.reduce((t, f) => t + (f.valor * f.frecuencia) / n, 0);
  const v = tabla.reduce((t, f) => t + ((f.valor - m) ** 2 * f.frecuencia) / n, 0);
  const logL = tabla.reduce((t, f) => t + f.frecuencia * Math.log(f.frecuencia / n), 0);
  return {
    familia: 'empirica',
    n,
    tabla,
    parametros: [{ nombre: 'valores distintos', valor: tabla.length, ee: NaN }],
    k: tabla.length - 1,
    media: m,
    cv: Math.sqrt(v) / m,
    logVerosimilitud: logL,
    aic: 2 * (tabla.length - 1) - 2 * logL,
    // Densidad como histograma de ancho 1 alrededor de cada valor.
    densidad: (x) => {
      const f = tabla.find((r) => Math.abs(r.valor - x) <= 0.5);
      return f ? f.frecuencia / n : 0;
    },
    acumulada: (x) => {
      let r = 0;
      for (let i = 0; i < tabla.length && tabla[i]!.valor <= x; i++) r = acum[i]!;
      return r;
    },
    cuantil: (u) => {
      const i = acum.findIndex((a) => u <= a + 1e-12);
      return tabla[i === -1 ? tabla.length - 1 : i]!.valor;
    },
  };
}

export function ajustar(familia: Familia, xs: readonly number[]): Ajuste {
  switch (familia) {
    case 'lognormal':
      return ajustarLognormal(xs);
    case 'gamma':
      return ajustarGamma(xs);
    case 'exponencial':
      return ajustarExponencial(xs);
    case 'empirica':
      return ajustarEmpirica(xs);
  }
}

export interface ResultadoKS {
  D: number;
  /** Valor p asintótico (Kolmogorov). */
  p: number;
  /** Valor crítico al 5 % (1,358/√n). */
  critico: number;
}

export function pruebaKS(xs: readonly number[], F: (x: number) => number): ResultadoKS {
  const o = [...xs].sort((a, b) => a - b);
  const n = o.length;
  let D = 0;
  for (let i = 0; i < n; i++) {
    const f = F(o[i]!);
    D = Math.max(D, (i + 1) / n - f, f - i / n);
  }
  const raiz = Math.sqrt(n);
  return { D, p: colaKolmogorov(D * raiz), critico: 1.358 / raiz };
}

export interface ClaseChi2 {
  desde: number;
  hasta: number;
  observadas: number;
  esperadas: number;
}

export interface ResultadoChi2 {
  clases: ClaseChi2[];
  estadistico: number;
  gl: number;
  p: number;
}

export function clasesChi2(n: number): number {
  return Math.max(5, Math.min(Math.floor(n / 5), Math.round(2 * n ** 0.4)));
}

/** χ² con k clases equiprobables bajo la distribución ajustada (bordes = cuantiles i/k). */
export function pruebaChi2(xs: readonly number[], ajuste: Pick<Ajuste, 'cuantil' | 'k'>, kClases = clasesChi2(xs.length)): ResultadoChi2 {
  const n = xs.length;
  const bordes = [0];
  for (let i = 1; i < kClases; i++) bordes.push(ajuste.cuantil(i / kClases));
  bordes.push(Infinity);
  const clases: ClaseChi2[] = [];
  for (let i = 0; i < kClases; i++) clases.push({ desde: bordes[i]!, hasta: bordes[i + 1]!, observadas: 0, esperadas: n / kClases });
  for (const x of xs) {
    let i = 0;
    while (i < kClases - 1 && x > bordes[i + 1]!) i++;
    clases[i]!.observadas++;
  }
  const estadistico = clases.reduce((s, c) => s + (c.observadas - c.esperadas) ** 2 / c.esperadas, 0);
  const gl = kClases - 1 - ajuste.k;
  return { clases, estadistico, gl, p: gl > 0 ? colaChi2(estadistico, gl) : NaN };
}

export interface FilaComparacion {
  ajuste: Ajuste;
  ks: ResultadoKS | null;
  chi2: ResultadoChi2 | null;
}

/** Las cuatro familias sobre los mismos datos, con KS y χ² (no para la empírica). */
export function compararAjustes(xs: readonly number[]): FilaComparacion[] {
  return FAMILIAS.map((familia) => {
    const ajuste = ajustar(familia, xs);
    if (familia === 'empirica') return { ajuste, ks: null, chi2: null };
    return { ajuste, ks: pruebaKS(xs, ajuste.acumulada), chi2: pruebaChi2(xs, ajuste) };
  });
}

/** Mejor familia paramétrica por AIC. */
export function mejorPorAIC(filas: readonly FilaComparacion[]): Familia {
  return filas.filter((f) => f.ajuste.familia !== 'empirica').reduce((m, f) => (f.ajuste.aic < m.ajuste.aic ? f : m)).ajuste.familia;
}
