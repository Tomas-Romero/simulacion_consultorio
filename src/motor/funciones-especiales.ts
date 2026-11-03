/**
 * Funciones especiales usadas por las distribuciones y la estadística:
 * densidad y acumulada de la normal estándar, su inversa y el cuantil de la t de Student.
 */

const RAIZ_DOS_PI = Math.sqrt(2 * Math.PI);

/** Densidad normal estándar φ(x). */
export function densidadNormal(x: number): number {
  return Math.exp(-0.5 * x * x) / RAIZ_DOS_PI;
}

/**
 * Función error complementaria (Numerical Recipes, aproximación de Chebyshev).
 * Error relativo < 1,2·10⁻⁷ en todo el dominio.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Acumulada normal estándar Φ(x). */
export function acumuladaNormal(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

// Coeficientes del algoritmo de Acklam para Φ⁻¹ (error relativo < 1,15·10⁻⁹).
const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
const P_BAJO = 0.02425;

/** Inversa de la acumulada normal estándar Φ⁻¹(p), p ∈ (0, 1). */
export function inversaNormal(p: number): number {
  if (!(p > 0 && p < 1)) {
    throw new RangeError(`inversaNormal: p debe estar en (0, 1), se recibió ${p}`);
  }
  const [a0, a1, a2, a3, a4, a5] = A as [number, number, number, number, number, number];
  const [b0, b1, b2, b3, b4] = B as [number, number, number, number, number];
  const [c0, c1, c2, c3, c4, c5] = C as [number, number, number, number, number, number];
  const [d0, d1, d2, d3] = D as [number, number, number, number];
  if (p < P_BAJO) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5) / ((((d0 * q + d1) * q + d2) * q + d3) * q + 1);
  }
  if (p > 1 - P_BAJO) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5) / ((((d0 * q + d1) * q + d2) * q + d3) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a0 * r + a1) * r + a2) * r + a3) * r + a4) * r + a5) * q) / (((((b0 * r + b1) * r + b2) * r + b3) * r + b4) * r + 1);
}

/**
 * Cuantil de la t de Student con ν grados de libertad (expansión de Cornish-Fisher,
 * Abramowitz y Stegun 26.7.5). Para ν ≥ 10 el error es < 10⁻⁴, más que suficiente para IC.
 */
export function cuantilT(p: number, gradosLibertad: number): number {
  if (!(gradosLibertad >= 1)) {
    throw new RangeError('cuantilT: se necesita al menos 1 grado de libertad');
  }
  const z = inversaNormal(p);
  const v = gradosLibertad;
  const z2 = z * z;
  const g1 = (z * (z2 + 1)) / 4;
  const g2 = (z * ((5 * z2 + 16) * z2 + 3)) / 96;
  const g3 = (z * (((3 * z2 + 19) * z2 + 17) * z2 - 15)) / 384;
  const g4 = (z * ((((79 * z2 + 776) * z2 + 1482) * z2 - 1920) * z2 - 945)) / 92160;
  return z + g1 / v + g2 / v ** 2 + g3 / v ** 3 + g4 / v ** 4;
}
