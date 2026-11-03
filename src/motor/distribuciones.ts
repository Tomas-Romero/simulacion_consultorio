/**
 * Distribuciones de probabilidad. Cada una se construye una sola vez (los
 * parámetros se validan con zod en la construcción, no en cada muestra) y
 * expone su media y varianza teóricas, que usan los tests y la documentación.
 *
 * Todas muestrean por transformada inversa a partir de UN uniforme, salvo el
 * proceso de Poisson no homogéneo (thinning, dos uniformes por candidato).
 * Usar un uniforme por muestra mantiene la sincronización de los números
 * aleatorios comunes entre escenarios.
 */
import { z } from 'zod';
import { acumuladaNormal, densidadNormal, inversaNormal } from './funciones-especiales';
import type { FuenteUniforme } from './prng';

export interface Distribucion {
  readonly nombre: string;
  readonly media: number;
  readonly varianza: number;
  muestrear(g: FuenteUniforme): number;
}

const positivo = z.number().finite().positive();
const finito = z.number().finite();

// ---------------------------------------------------------------- uniforme
export const EsquemaUniforme = z
  .object({ min: finito, max: finito })
  .refine((p) => p.max > p.min, 'max debe ser mayor que min');

export function uniforme(min: number, max: number): Distribucion {
  EsquemaUniforme.parse({ min, max });
  const ancho = max - min;
  return {
    nombre: `Uniforme(${min}, ${max})`,
    media: (min + max) / 2,
    varianza: (ancho * ancho) / 12,
    muestrear: (g) => min + ancho * g.uniforme(),
  };
}

// ------------------------------------------------------------- exponencial
export const EsquemaExponencial = z.object({ media: positivo });

/** Exponencial parametrizada por su media (1/λ). F⁻¹(u) = −media·ln(1 − u). */
export function exponencial(media: number): Distribucion {
  EsquemaExponencial.parse({ media });
  return {
    nombre: `Exponencial(media=${media})`,
    media,
    varianza: media * media,
    // 1 − u y u tienen la misma distribución; se usa ln(u) porque u ∈ (0,1) nunca es 0.
    muestrear: (g) => -media * Math.log(g.uniforme()),
  };
}

// --------------------------------------------------------- normal truncada
export const EsquemaNormalTruncada = z
  .object({ media: finito, desvio: positivo, min: finito, max: finito })
  .refine((p) => p.max > p.min, 'max debe ser mayor que min');

/**
 * Normal(media, desvío) truncada a [min, max], por transformada inversa:
 * u' = Φ(α) + u·(Φ(β) − Φ(α)),  x = media + desvío·Φ⁻¹(u').
 * (No es rechazo: cada muestra consume exactamente un uniforme.)
 */
export function normalTruncada(media: number, desvio: number, min: number, max: number): Distribucion {
  EsquemaNormalTruncada.parse({ media, desvio, min, max });
  const alfa = (min - media) / desvio;
  const beta = (max - media) / desvio;
  const Fa = acumuladaNormal(alfa);
  const Fb = acumuladaNormal(beta);
  const Zt = Fb - Fa;
  const fa = densidadNormal(alfa);
  const fb = densidadNormal(beta);
  const desplazamiento = (fa - fb) / Zt;
  return {
    nombre: `NormalTruncada(${media}, ${desvio}, [${min}, ${max}])`,
    media: media + desvio * desplazamiento,
    varianza: desvio * desvio * (1 + (alfa * fa - beta * fb) / Zt - desplazamiento * desplazamiento),
    muestrear: (g) => {
      const x = media + desvio * inversaNormal(Fa + g.uniforme() * Zt);
      // Protección ante el redondeo de Φ en las colas.
      return Math.min(max, Math.max(min, x));
    },
  };
}

// --------------------------------------------------------------- lognormal
export const EsquemaLognormal = z.object({ media: positivo, cv: positivo });

/**
 * Lognormal parametrizada por la media y el coeficiente de variación de X:
 * σ² = ln(1 + cv²),  μ = ln(media) − σ²/2,  X = exp(μ + σ·Φ⁻¹(u)).
 */
export function lognormal(media: number, cv: number): Distribucion {
  EsquemaLognormal.parse({ media, cv });
  const sigma2 = Math.log(1 + cv * cv);
  const sigma = Math.sqrt(sigma2);
  const mu = Math.log(media) - sigma2 / 2;
  return {
    nombre: `Lognormal(media=${media}, cv=${cv})`,
    media,
    varianza: (cv * media) ** 2,
    muestrear: (g) => Math.exp(mu + sigma * inversaNormal(g.uniforme())),
  };
}

// -------------------------------------------------------------- triangular
export const EsquemaTriangular = z
  .object({ min: finito, moda: finito, max: finito })
  .refine((p) => p.min <= p.moda && p.moda <= p.max && p.max > p.min, 'se requiere min ≤ moda ≤ max y min < max');

export function triangular(min: number, moda: number, max: number): Distribucion {
  EsquemaTriangular.parse({ min, moda, max });
  const ancho = max - min;
  const Fc = (moda - min) / ancho;
  return {
    nombre: `Triangular(${min}, ${moda}, ${max})`,
    media: (min + moda + max) / 3,
    varianza: (min * min + moda * moda + max * max - min * moda - min * max - moda * max) / 18,
    muestrear: (g) => {
      const u = g.uniforme();
      return u < Fc ? min + Math.sqrt(u * ancho * (moda - min)) : max - Math.sqrt((1 - u) * ancho * (max - moda));
    },
  };
}

// ------------------------------------------------------- discreta empírica
export const EsquemaTablaEmpirica = z
  .array(z.object({ valor: finito, frecuencia: z.number().finite().nonnegative() }))
  .min(1)
  .refine((t) => t.some((f) => f.frecuencia > 0), 'al menos una frecuencia debe ser positiva');

export type TablaEmpirica = z.infer<typeof EsquemaTablaEmpirica>;

/**
 * Discreta empírica a partir de una tabla valor / frecuencia absoluta (como el TP5):
 * se ordena por valor, se arma la acumulada relativa y se invierte buscando el
 * primer valor cuya acumulada supera u (búsqueda binaria).
 */
export function empiricaDiscreta(tabla: TablaEmpirica): Distribucion {
  const filas = [...EsquemaTablaEmpirica.parse(tabla)].sort((a, b) => a.valor - b.valor);
  const total = filas.reduce((s, f) => s + f.frecuencia, 0);
  const valores = filas.map((f) => f.valor);
  const acumulada: number[] = [];
  let suma = 0;
  for (const f of filas) {
    suma += f.frecuencia;
    acumulada.push(suma / total);
  }
  acumulada[acumulada.length - 1] = 1;
  const media = filas.reduce((s, f) => s + (f.valor * f.frecuencia) / total, 0);
  const varianza = filas.reduce((s, f) => s + ((f.valor - media) ** 2 * f.frecuencia) / total, 0);
  return {
    nombre: `EmpiricaDiscreta(${filas.length} valores, n=${total})`,
    media,
    varianza,
    muestrear: (g) => {
      const u = g.uniforme();
      let lo = 0;
      let hi = acumulada.length - 1;
      while (lo < hi) {
        const medio = (lo + hi) >>> 1;
        if (u <= acumulada[medio]!) hi = medio;
        else lo = medio + 1;
      }
      return valores[lo]!;
    },
  };
}

// --------------------------------------------------------------- Bernoulli
export const EsquemaBernoulli = z.object({ p: z.number().min(0).max(1) });

/** Bernoulli(p): devuelve 1 con probabilidad p y 0 en otro caso. */
export function bernoulli(p: number): Distribucion {
  EsquemaBernoulli.parse({ p });
  return {
    nombre: `Bernoulli(${p})`,
    media: p,
    varianza: p * (1 - p),
    muestrear: (g) => (g.uniforme() < p ? 1 : 0),
  };
}

// ----------------------------------------------- Poisson no homogéneo
export const EsquemaTramoTasa = z
  .object({ desde: finito, hasta: finito, tasa: z.number().finite().nonnegative() })
  .refine((t) => t.hasta > t.desde, 'cada tramo debe tener hasta > desde');

export const EsquemaPerfilTasa = z
  .array(EsquemaTramoTasa)
  .min(1)
  .refine(
    (tramos) => tramos.every((t, i) => i === 0 || t.desde >= tramos[i - 1]!.hasta),
    'los tramos deben estar ordenados y no solaparse',
  );

/** Tasa constante por tramos: `tasa` eventos por unidad de tiempo en [desde, hasta). */
export type PerfilTasa = z.infer<typeof EsquemaPerfilTasa>;

/**
 * Convierte un perfil "llegadas por hora" en tramos expresados en MINUTOS desde
 * las 00:00 (la unidad de tiempo del modelo). Ej.: horaInicio = 8 y
 * [2, 3] → [08:00–09:00 a 2/h, 09:00–10:00 a 3/h].
 */
export function perfilPorHora(tasasPorHora: readonly number[], horaInicio: number): PerfilTasa {
  return EsquemaPerfilTasa.parse(
    tasasPorHora.map((tasa, i) => ({ desde: (horaInicio + i) * 60, hasta: (horaInicio + i + 1) * 60, tasa: tasa / 60 })),
  );
}

export class PoissonNoHomogeneo {
  readonly tramos: PerfilTasa;
  readonly tasaMaxima: number;

  constructor(tramos: PerfilTasa) {
    this.tramos = EsquemaPerfilTasa.parse(tramos);
    this.tasaMaxima = Math.max(...this.tramos.map((t) => t.tasa));
  }

  /** λ(t); 0 fuera de los tramos. */
  tasaEn(t: number): number {
    for (const tramo of this.tramos) {
      if (t >= tramo.desde && t < tramo.hasta) return tramo.tasa;
    }
    return 0;
  }

  /** Λ(a, b) = ∫ λ(t) dt: cantidad esperada de llegadas en [a, b). */
  esperadoEntre(a: number, b: number): number {
    let total = 0;
    for (const tramo of this.tramos) {
      const solape = Math.min(b, tramo.hasta) - Math.max(a, tramo.desde);
      if (solape > 0) total += tramo.tasa * solape;
    }
    return total;
  }

  /**
   * Instantes de llegada en [desde, hasta) por thinning (Lewis y Shedler, 1979):
   * candidatos de un Poisson homogéneo de tasa λmax; cada uno se acepta con
   * probabilidad λ(t)/λmax.
   */
  generar(g: FuenteUniforme, desde: number, hasta: number): number[] {
    const llegadas: number[] = [];
    if (this.tasaMaxima <= 0) return llegadas;
    let t = desde;
    for (;;) {
      t -= Math.log(g.uniforme()) / this.tasaMaxima;
      if (t >= hasta) break;
      if (g.uniforme() * this.tasaMaxima < this.tasaEn(t)) llegadas.push(t);
    }
    return llegadas;
  }
}
