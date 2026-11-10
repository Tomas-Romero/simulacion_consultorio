/**
 * Sensibilidad de la comparación de políticas a los supuestos sin dato (de a un parámetro por vez):
 * reingreso r, desaliento máximo, umbral de desaliento, magnitud y duración del pico. El consultorio
 * de hoy es un dato (anticipación media 11,95 días sin sobreturnos): en cada variante se recalibra D₀
 * para que ese estado sea un equilibrio y las tres políticas arrancan de él. Si en la variante ese
 * equilibrio es inestable (sin desaliento a esa anticipación), se informa.
 */
import { anticipacionMediaTabla, ausentismo, capacidad, equilibrios, type Metodo, type ParametrosLista, type TablaBeneficio } from './lista';
import { demandaCalibrada } from './parametros';
import { compararPoliticas } from './resumen';

export type ParametroSensible = 'reingreso' | 'desalientoMaximo' | 'umbral' | 'aumento' | 'duracion';

export const NIVELES_SENSIBILIDAD: Record<ParametroSensible, number[]> = {
  reingreso: [0.25, 0.5, 0.75],
  desalientoMaximo: [0.3, 0.6, 0.9],
  umbral: [7, 14, 21],
  aumento: [0.15, 0.3, 0.5],
  duracion: [3, 6, 10],
};

export const NOMBRES_PARAMETRO: Record<ParametroSensible, string> = {
  reingreso: 'Ausentes que vuelven (r)',
  desalientoMaximo: 'Desaliento máximo',
  umbral: 'Umbral de desaliento u',
  aumento: 'Magnitud del pico',
  duracion: 'Duración del pico',
};

export function aplicarNivel(prm: ParametrosLista, parametro: ParametroSensible, valor: number): ParametrosLista {
  const pico = prm.pico ?? { inicio: 10, duracion: 6, aumento: 0.3 };
  switch (parametro) {
    case 'reingreso':
      return { ...prm, reingreso: valor };
    case 'desalientoMaximo':
      return { ...prm, desaliento: { ...prm.desaliento, maximo: valor } };
    case 'umbral':
      return { ...prm, desaliento: { ...prm.desaliento, umbral: valor } };
    case 'aumento':
      return { ...prm, pico: { ...pico, aumento: valor } };
    case 'duracion':
      return { ...prm, pico: { ...pico, duracion: valor } };
  }
}

export function valorBase(prm: ParametrosLista, parametro: ParametroSensible): number {
  switch (parametro) {
    case 'reingreso':
      return prm.reingreso;
    case 'desalientoMaximo':
      return prm.desaliento.maximo;
    case 'umbral':
      return prm.desaliento.umbral;
    case 'aumento':
      return prm.pico?.aumento ?? 0.3;
    case 'duracion':
      return prm.pico?.duracion ?? 6;
  }
}

export interface ResultadoPolitica {
  nombre: string;
  beneficio: number;
  perdidos: number;
  atendidos: number;
  Lmax: number;
}

export interface FilaSensibilidad {
  parametro: ParametroSensible;
  valor: number;
  esBase: boolean;
  /** Demanda base recalibrada (D₀ / C(0)), anticipación y ausentismo del estado inicial (el de hoy). */
  demandaRelativa: number;
  a0: number;
  p0: number;
  /** ¿El estado de hoy es un equilibrio estable en esta variante? */
  estable: boolean;
  /** Cantidad de equilibrios sin sobreturnos (más de uno: biestable). */
  equilibrios: number;
  politicas: [ResultadoPolitica, ResultadoPolitica, ResultadoPolitica];
  /** Adaptativo − k fijo, en el horizonte. */
  difBeneficio: number;
  difPerdidos: number;
  /**
   * Índice (0 = k 0, 1 = k fijo, 2 = adaptativo) de la que gana en beneficio y en perdidos (menos);
   * −1 = empate entre k fijo y adaptativo (eligen el mismo k todas las semanas).
   */
  ganaBeneficio: number;
  ganaPerdidos: number;
}

export function analisisSensibilidad(prm: ParametrosLista, tb: TablaBeneficio, kFijo: number, opciones: { dt?: number; metodo?: Metodo } = {}): FilaSensibilidad[] {
  const filas: FilaSensibilidad[] = [];
  for (const parametro of Object.keys(NIVELES_SENSIBILIDAD) as ParametroSensible[])
    for (const valor of NIVELES_SENSIBILIDAD[parametro]) {
      const v = aplicarNivel(prm, parametro, valor);
      const a0 = anticipacionMediaTabla(v);
      v.demandaBase = demandaCalibrada(v, a0);
      const C0 = capacidad(v, 0);
      const eqs = equilibrios(v, 0);
      const hoy = eqs.reduce((m, e) => (Math.abs(e.a - a0) < Math.abs(m.a - a0) ? e : m), eqs[0]!);
      const rs = compararPoliticas(v, tb, kFijo, { ...opciones, L0: a0 * C0 }).map((r) => ({ nombre: r.nombre, beneficio: r.beneficio, perdidos: r.perdidos, atendidos: r.atendidos, Lmax: r.Lmax }));
      const politicas = rs as [ResultadoPolitica, ResultadoPolitica, ResultadoPolitica];
      const arg = (f: (r: ResultadoPolitica) => number): number => {
        const i = politicas.reduce((m, r, j) => (f(r) > f(politicas[m]!) ? j : m), 0);
        return i > 0 && Math.abs(f(politicas[2]) - f(politicas[1])) < 1e-6 * Math.abs(f(politicas[1])) + 1e-9 ? -1 : i;
      };
      filas.push({
        parametro,
        valor,
        esBase: Math.abs(valor - valorBase(prm, parametro)) < 1e-12,
        demandaRelativa: v.demandaBase / C0,
        a0,
        p0: ausentismo(v, a0),
        estable: hoy.estable,
        equilibrios: eqs.length,
        politicas,
        difBeneficio: politicas[2].beneficio - politicas[1].beneficio,
        difPerdidos: politicas[2].perdidos - politicas[1].perdidos,
        ganaBeneficio: arg((r) => r.beneficio),
        ganaPerdidos: arg((r) => -r.perdidos),
      });
    }
  return filas;
}
