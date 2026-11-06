/**
 * Parte 0.1 · Regla práctica con corrección por demanda espontánea y validación dejando un
 * escenario afuera (docs/experimentos.md, sección 9). Funciones puras sobre los B diarios.
 */
import type { Escenario } from '../modelo';
import { prepararEscenario } from '../modelo';
import { diferencia, type IC } from './analisis';

/**
 * Espontáneos esperados por profesional y por día, y los que exceden sus cupos (ē).
 * La tasa por hora × mezcla de la especialidad se reparte entre los profesionales de la
 * especialidad que admiten a esa hora (como en el modelo del día; los demás se pierden en la puerta).
 */
export function espontaneosExcedentes(e: Escenario): { lambda: number[]; cupos: number[]; exceso: number[]; media: number } {
  const prep = prepararEscenario(e);
  const lambda = e.profesionales.map(() => 0);
  const pesos = prep.mezclaAcumulada.map((m, j, arr) => ({ especialidad: m.especialidad, peso: m.acumulada - (j > 0 ? arr[j - 1]!.acumulada : 0) }));
  const pasoMin = 5;
  e.espontaneos.tasasPorHora.forEach((tasa, h) => {
    for (let m = 0; m < 60; m += pasoMin) {
      const t = e.jornada.inicio + h * 60 + m + pasoMin / 2;
      for (const { especialidad, peso } of pesos) {
        const abiertos = e.profesionales.map((_, i) => i).filter((i) => e.profesionales[i]!.especialidad === especialidad && t >= prep.turnos[i]!.inicio && t < prep.turnos[i]!.fin - e.espontaneos.cierreAntesDelFin);
        for (const i of abiertos) lambda[i] = lambda[i]! + (tasa * peso * (pasoMin / 60)) / abiertos.length;
      }
    }
  });
  const cupos = prep.esCupo.map((c) => c.filter(Boolean).length);
  const exceso = lambda.map((l, i) => Math.max(0, l - cupos[i]!));
  return { lambda, cupos, exceso, media: exceso.reduce((s, v) => s + v, 0) / exceso.length };
}

/** Una configuración del análisis: escenario × nivel de ausentismo, con sus B diarios por k. */
export interface ConfigRegla {
  preset: string;
  p: number;
  N: number;
  e: number;
  ks: number[];
  /** B diarios por k (mismas réplicas en todos los k). */
  Bs: Float64Array[];
  kHat: number;
  conjunto: number[];
}

export type Regla = { tipo: 'ingenua' } | { tipo: 'alfa'; alfa: number } | { tipo: 'alfaBeta'; alfa: number; beta: number };

export function kDeRegla(r: Regla, c: Pick<ConfigRegla, 'p' | 'N' | 'e' | 'ks'>): number {
  const x = r.tipo === 'ingenua' ? c.p * c.N : r.tipo === 'alfa' ? r.alfa * c.p * c.N : r.alfa * c.p * c.N - r.beta * c.e;
  return Math.max(c.ks[0]!, Math.min(c.ks[c.ks.length - 1]!, Math.round(x)));
}

const media = (x: Float64Array): number => x.reduce((s, v) => s + v, 0) / x.length;

/** Pérdida media por usar k en vez de k̂ (con las medias ya calculadas). */
function perdidaMedia(c: ConfigRegla, medias: number[], k: number): number {
  return medias[c.ks.indexOf(c.kHat)]! - medias[c.ks.indexOf(k)]!;
}

/** Ajusta la regla por grilla minimizando la pérdida esperada total en `entrenamiento`. */
export function ajustarRegla(tipo: 'alfa' | 'alfaBeta', entrenamiento: readonly ConfigRegla[]): Regla {
  const medias = entrenamiento.map((c) => c.Bs.map(media));
  const total = (r: Regla): number => entrenamiento.reduce((s, c, i) => s + perdidaMedia(c, medias[i]!, kDeRegla(r, c)), 0);
  let mejor: Regla = tipo === 'alfa' ? { tipo, alfa: 1 } : { tipo, alfa: 1, beta: 0 };
  let mejorTotal = total(mejor);
  const alfas = Array.from({ length: 301 }, (_, i) => i / 100);
  const betas = tipo === 'alfa' ? [0] : Array.from({ length: 401 }, (_, i) => -1 + i / 100);
  for (const alfa of alfas)
    for (const beta of betas) {
      const r: Regla = tipo === 'alfa' ? { tipo, alfa } : { tipo, alfa, beta };
      const v = total(r);
      // Desempate: menor |β| y después α más cercano a 1 (la regla más simple que logra lo mismo).
      const peso = (x: Regla): number => (x.tipo === 'alfaBeta' ? Math.abs(x.beta) * 10 : 0) + (x.tipo === 'ingenua' ? 0 : Math.abs(x.alfa - 1));
      if (v < mejorTotal - 1e-6 || (Math.abs(v - mejorTotal) <= 1e-6 && peso(r) < peso(mejor))) {
        mejor = r;
        mejorTotal = v;
      }
    }
  return mejor;
}

export interface EvaluacionRegla {
  regla: Regla;
  /** Pérdida media por día y por configuración en el escenario de prueba, con IC 95 % pareado por día. */
  perdida: IC;
  aciertos: number;
  total: number;
  porConfig: { p: number; k: number; kHat: number; conjunto: number[]; perdida: number; dentro: boolean }[];
}

/** Evalúa una regla en un conjunto de configuraciones (las de un escenario): pérdida pareada por día. */
export function evaluarRegla(r: Regla, prueba: readonly ConfigRegla[]): EvaluacionRegla {
  const R = Math.min(...prueba.map((c) => c.Bs[0]!.length));
  // Por día: promedio sobre las configuraciones de B(k̂) − B(k_regla) (mismas réplicas: números aleatorios comunes).
  const sumaHat = new Float64Array(R);
  const sumaRegla = new Float64Array(R);
  const porConfig = prueba.map((c) => {
    const k = kDeRegla(r, c);
    const bh = c.Bs[c.ks.indexOf(c.kHat)]!;
    const br = c.Bs[c.ks.indexOf(k)]!;
    for (let d = 0; d < R; d++) {
      sumaHat[d] = sumaHat[d]! + bh[d]! / prueba.length;
      sumaRegla[d] = sumaRegla[d]! + br[d]! / prueba.length;
    }
    return { p: c.p, k, kHat: c.kHat, conjunto: c.conjunto, perdida: media(bh) - media(br), dentro: c.conjunto.includes(k) };
  });
  const iguales = sumaHat.every((v, d) => v === sumaRegla[d]);
  return {
    regla: r,
    perdida: iguales ? { media: 0, inf: 0, sup: 0, semi: 0 } : diferencia(sumaHat, sumaRegla),
    aciertos: porConfig.filter((x) => x.dentro).length,
    total: porConfig.length,
    porConfig,
  };
}

export interface ResultadoLOO {
  /** Escenario que queda afuera en cada pliegue. */
  pliegues: {
    afuera: string;
    reglas: { nombre: 'ingenua' | 'alfa' | 'alfaBeta'; evaluacion: EvaluacionRegla }[];
  }[];
  /** Ajuste con los tres escenarios (solo descriptivo). */
  ajusteCompleto: { alfa: Regla; alfaBeta: Regla };
}

/** Validación dejando un escenario afuera: ajusta con dos y evalúa en el tercero, rotando. */
export function validacionDejandoUnoAfuera(configs: readonly ConfigRegla[]): ResultadoLOO {
  const presets = [...new Set(configs.map((c) => c.preset))];
  return {
    pliegues: presets.map((afuera) => {
      const train = configs.filter((c) => c.preset !== afuera);
      const test = configs.filter((c) => c.preset === afuera);
      return {
        afuera,
        reglas: [
          { nombre: 'ingenua' as const, evaluacion: evaluarRegla({ tipo: 'ingenua' }, test) },
          { nombre: 'alfa' as const, evaluacion: evaluarRegla(ajustarRegla('alfa', train), test) },
          { nombre: 'alfaBeta' as const, evaluacion: evaluarRegla(ajustarRegla('alfaBeta', train), test) },
        ],
      };
    }),
    ajusteCompleto: { alfa: ajustarRegla('alfa', configs), alfaBeta: ajustarRegla('alfaBeta', configs) },
  };
}
