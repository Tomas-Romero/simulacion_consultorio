/**
 * Estadística para la simulación:
 * - por entidad (W, Wq): acumulador muestral de Welford;
 * - ponderada por tiempo (L, Lq, ocupación): integral de una función escalonada;
 * - entre réplicas: intervalo de confianza con t de Student;
 * - calentamiento: media móvil de Welch sobre réplicas.
 */
import { cuantilT } from './funciones-especiales';

/** Media y varianza en una pasada (Welford), numéricamente estable. */
export class AcumuladorMuestral {
  n = 0;
  private m = 0;
  private s2 = 0;
  min = Infinity;
  max = -Infinity;

  agregar(x: number): void {
    this.n++;
    const delta = x - this.m;
    this.m += delta / this.n;
    this.s2 += delta * (x - this.m);
    if (x < this.min) this.min = x;
    if (x > this.max) this.max = x;
  }

  get media(): number {
    return this.n > 0 ? this.m : NaN;
  }

  /** Varianza muestral (divisor n − 1). */
  get varianza(): number {
    return this.n > 1 ? this.s2 / (this.n - 1) : NaN;
  }

  reiniciar(): void {
    this.n = 0;
    this.m = 0;
    this.s2 = 0;
    this.min = Infinity;
    this.max = -Infinity;
  }
}

/**
 * Promedio temporal de una variable de estado escalonada x(t) (p. ej. cantidad
 * en cola): acumula ∫ x(t) dt. Se llama a `registrar` cada vez que x cambia.
 */
export class AcumuladorTiempo {
  private valor: number;
  private tUltimo: number;
  private tInicio: number;
  private area = 0;
  max: number;

  constructor(tInicial = 0, valorInicial = 0) {
    this.valor = valorInicial;
    this.tUltimo = tInicial;
    this.tInicio = tInicial;
    this.max = valorInicial;
  }

  get actual(): number {
    return this.valor;
  }

  registrar(t: number, nuevoValor: number): void {
    this.area += this.valor * (t - this.tUltimo);
    this.tUltimo = t;
    this.valor = nuevoValor;
    if (nuevoValor > this.max) this.max = nuevoValor;
  }

  sumar(t: number, delta: number): void {
    this.registrar(t, this.valor + delta);
  }

  /** Descarta lo acumulado hasta t (fin del calentamiento); el valor actual se conserva. */
  reiniciar(t: number): void {
    this.registrar(t, this.valor);
    this.area = 0;
    this.tInicio = t;
    this.max = this.valor;
  }

  /** ∫ x(t) dt desde el último reinicio hasta t. */
  integral(t: number): number {
    return this.area + this.valor * (t - this.tUltimo);
  }

  /** Promedio temporal entre el último reinicio y t. */
  media(t: number): number {
    const duracion = t - this.tInicio;
    return duracion > 0 ? this.integral(t) / duracion : NaN;
  }
}

export interface IntervaloConfianza {
  n: number;
  media: number;
  desvio: number;
  semiancho: number;
  inferior: number;
  superior: number;
  nivel: number;
}

/** IC para la media de observaciones i.i.d. (p. ej. una por réplica): x̄ ± t(1−α/2, n−1)·s/√n. */
export function intervaloConfianza(valores: readonly number[], nivel = 0.95): IntervaloConfianza {
  const acc = new AcumuladorMuestral();
  for (const v of valores) acc.agregar(v);
  if (acc.n < 2) throw new Error('intervaloConfianza: se necesitan al menos 2 observaciones');
  const desvio = Math.sqrt(acc.varianza);
  const semiancho = (cuantilT(1 - (1 - nivel) / 2, acc.n - 1) * desvio) / Math.sqrt(acc.n);
  return {
    n: acc.n,
    media: acc.media,
    desvio,
    semiancho,
    inferior: acc.media - semiancho,
    superior: acc.media + semiancho,
    nivel,
  };
}

/**
 * Nivel individual que garantiza un nivel conjunto (Bonferroni) al hacer k
 * comparaciones: con k IC al 95 % cada uno, por azar se espera que ≈ 5 % de los
 * valores verdaderos queden afuera; con nivel 1 − α/k cada uno, la
 * probabilidad de que alguno quede afuera es ≤ α (valga o no la independencia).
 */
export function nivelBonferroni(nivelConjunto: number, k: number): number {
  return 1 - (1 - nivelConjunto) / k;
}

export function contiene(ic: IntervaloConfianza, valor: number): boolean {
  return valor >= ic.inferior && valor <= ic.superior;
}

/**
 * Método de Welch para el calentamiento: `series[r][i]` es el valor de la
 * réplica r en el intervalo i. Promedia entre réplicas y suaviza con una
 * ventana centrada de semiancho w. Devuelve la curva suavizada.
 */
export function mediaMovilWelch(series: readonly (readonly number[])[], w: number): number[] {
  const m = Math.min(...series.map((s) => s.length));
  const promedio: number[] = [];
  for (let i = 0; i < m; i++) {
    let suma = 0;
    for (const s of series) suma += s[i]!;
    promedio.push(suma / series.length);
  }
  const suavizada: number[] = [];
  for (let i = 0; i < m - w; i++) {
    const k = Math.min(i, w);
    let suma = 0;
    for (let j = i - k; j <= i + k; j++) suma += promedio[j]!;
    suavizada.push(suma / (2 * k + 1));
  }
  return suavizada;
}
