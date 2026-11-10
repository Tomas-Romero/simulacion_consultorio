/**
 * Funciones especiales para el ajuste de distribuciones y las pruebas de bondad de ajuste:
 * log Γ (Lanczos), digamma y trigamma (recurrencia + serie asintótica), gamma incompleta
 * regularizada (serie y fracción continua, Numerical Recipes §6.2), χ² y la distribución
 * asintótica de Kolmogorov. TS puro, sin dependencias.
 */

const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

/** ln Γ(x) para x > 0 (Lanczos, g = 7; error relativo ~1e-15). */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  const z = x - 1;
  let a = 0.99999999999980993;
  const t = z + 7.5;
  for (let i = 0; i < 8; i++) a += LANCZOS[i]! / (z + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** ψ(x) = d ln Γ / dx para x > 0. */
export function digamma(x: number): number {
  let r = 0;
  while (x < 10) {
    r -= 1 / x;
    x += 1;
  }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}

/** ψ'(x) para x > 0. */
export function trigamma(x: number): number {
  let r = 0;
  while (x < 10) {
    r += 1 / (x * x);
    x += 1;
  }
  const f = 1 / (x * x);
  return r + 1 / x + f / 2 + (f / x) * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f * (1 / 30 - (5 * f) / 66))));
}

/** Gamma incompleta inferior regularizada P(a, x) = γ(a, x) / Γ(a). */
export function gammaP(a: number, x: number): number {
  return gammaPQ(a, x)[0];
}

/** Gamma incompleta superior regularizada Q(a, x) = 1 − P(a, x), sin cancelación en la cola. */
export function gammaQ(a: number, x: number): number {
  return gammaPQ(a, x)[1];
}

function gammaPQ(a: number, x: number): [number, number] {
  if (x <= 0) return [0, 1];
  if (!Number.isFinite(x)) return [1, 0];
  const lnPre = a * Math.log(x) - x - lnGamma(a);
  if (x < a + 1) {
    // Serie: P = e^{−x} x^a / Γ(a) · Σ x^n / (a (a+1) … (a+n)).
    let suma = 1 / a;
    let termino = suma;
    for (let n = 1; n < 1000; n++) {
      termino *= x / (a + n);
      suma += termino;
      if (Math.abs(termino) < Math.abs(suma) * 1e-16) break;
    }
    const P = Math.min(1, suma * Math.exp(lnPre));
    return [P, 1 - P];
  }
  // Fracción continua (Lentz) para Q = 1 − P.
  const MIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / MIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < MIN) d = MIN;
    c = b + an / c;
    if (Math.abs(c) < MIN) c = MIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  const Q = Math.min(1, Math.max(0, Math.exp(lnPre) * h));
  return [1 - Q, Q];
}

/** P(χ²_gl ≤ x). */
export function acumuladaChi2(x: number, gl: number): number {
  return gammaP(gl / 2, x / 2);
}

/** P(χ²_gl > x): el valor p de la prueba χ². */
export function colaChi2(x: number, gl: number): number {
  return gammaQ(gl / 2, x / 2);
}

/**
 * P(K > t) de la distribución de Kolmogorov: 2 Σ (−1)^{j−1} e^{−2 j² t²}. Con t = √n·D da el
 * valor p asintótico de la prueba KS (sin la corrección de Lilliefors por parámetros estimados).
 */
export function colaKolmogorov(t: number): number {
  if (t <= 0) return 1;
  if (t < 0.27) return 1;
  let suma = 0;
  for (let j = 1; j <= 100; j++) {
    const termino = Math.exp(-2 * j * j * t * t);
    suma += (j % 2 === 1 ? 1 : -1) * termino;
    if (termino < 1e-17) break;
  }
  return Math.min(1, Math.max(0, 2 * suma));
}
