/**
 * Generador de números pseudoaleatorios con semilla.
 *
 * - Núcleo: xoshiro128** (Blackman y Vigna, 2018). Estado de 128 bits en cuatro
 *   enteros de 32 bits, período 2^128 − 1. Usa solo operaciones de 32 bits
 *   (Math.imul, desplazamientos), así que en JavaScript es exacto y rápido.
 * - Siembra: splitmix32 expande una semilla de 32 bits en los cuatro words del
 *   estado (evita estados iniciales "pobres" como casi todos ceros).
 * - Flujos independientes: cada fuente de aleatoriedad (llegadas, servicio,
 *   ausentismo, ...) tiene su propio generador, sembrado a partir de
 *   (semilla maestra, réplica, nombre del flujo). Como el flujo se identifica
 *   por nombre y no por orden de creación, agregar una fuente nueva no altera
 *   los números de las demás: es lo que hace posible usar números aleatorios
 *   comunes (NAC) al comparar escenarios.
 */

/** Cualquier cosa que entregue uniformes en (0, 1). Las distribuciones solo dependen de esto. */
export interface FuenteUniforme {
  /** Número uniforme en el intervalo abierto (0, 1). */
  uniforme(): number;
}

const DOS_A_LA_32 = 4294967296;

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** splitmix32: generador auxiliar usado solo para sembrar. Devuelve [siguiente estado, salida]. */
export function splitmix32(estado: number): [number, number] {
  const s = (estado + 0x9e3779b9) | 0;
  let z = s;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  z ^= z >>> 15;
  return [s, z >>> 0];
}

/** Hash FNV-1a de 32 bits, para convertir el nombre de un flujo en un número. */
export function hashTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type EstadoXoshiro = readonly [number, number, number, number];

export class Xoshiro128 implements FuenteUniforme {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(estado: EstadoXoshiro) {
    if (estado.every((w) => (w | 0) === 0)) {
      throw new Error('El estado de xoshiro128** no puede ser todo ceros');
    }
    this.s0 = estado[0] | 0;
    this.s1 = estado[1] | 0;
    this.s2 = estado[2] | 0;
    this.s3 = estado[3] | 0;
  }

  /** Crea un generador sembrando el estado con splitmix32 a partir de una semilla entera. */
  static desdeSemilla(semilla: number): Xoshiro128 {
    let s = semilla | 0;
    const palabras: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [siguiente, salida] = splitmix32(s);
      s = siguiente;
      palabras.push(salida);
    }
    return new Xoshiro128([palabras[0]!, palabras[1]!, palabras[2]!, palabras[3]!]);
  }

  /** Siguiente entero sin signo de 32 bits. */
  siguienteUint32(): number {
    const resultado = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9);
    const t = this.s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return resultado >>> 0;
  }

  /** Uniforme en (0, 1): centro de cada una de las 2^32 celdas, así nunca da 0 ni 1 (log seguro). */
  uniforme(): number {
    return (this.siguienteUint32() + 0.5) / DOS_A_LA_32;
  }

  estado(): EstadoXoshiro {
    return [this.s0 >>> 0, this.s1 >>> 0, this.s2 >>> 0, this.s3 >>> 0];
  }

  clonar(): Xoshiro128 {
    return new Xoshiro128(this.estado());
  }
}

/**
 * Fábrica de flujos independientes para una réplica.
 * `flujo('llegadas')` devuelve siempre el mismo generador (memoizado) dentro de la réplica.
 */
export class FabricaFlujos {
  readonly semillaMaestra: number;
  readonly replica: number;
  private readonly flujos = new Map<string, Xoshiro128>();

  constructor(semillaMaestra: number, replica = 0) {
    this.semillaMaestra = semillaMaestra;
    this.replica = replica;
  }

  /** Semilla de 32 bits derivada de (semilla maestra, réplica, nombre). */
  static semillaDeFlujo(semillaMaestra: number, replica: number, nombre: string): number {
    // Se encadenan pasos de splitmix32 mezclando cada componente: pequeñas
    // diferencias en cualquiera de ellas producen semillas sin relación aparente.
    let [s, z] = splitmix32(semillaMaestra | 0);
    [s, z] = splitmix32((s ^ z ^ Math.imul(replica + 1, 0x85ebca6b)) | 0);
    [, z] = splitmix32((s ^ z ^ hashTexto(nombre)) | 0);
    return z;
  }

  flujo(nombre: string): Xoshiro128 {
    let g = this.flujos.get(nombre);
    if (!g) {
      g = Xoshiro128.desdeSemilla(FabricaFlujos.semillaDeFlujo(this.semillaMaestra, this.replica, nombre));
      this.flujos.set(nombre, g);
    }
    return g;
  }
}
