/**
 * Tareas de simulación: un bloque de réplicas [desde, hasta) de una configuración. Cada réplica r
 * usa (semilla, r) en todas las configuraciones (números aleatorios comunes) y devuelve una fila de
 * métricas. Lo usan los workers (web y Node) y el ejecutor local.
 */
import { prepararEscenario, simularDia, type Escenario, type EscenarioPreparado, type MetricasDia } from '../modelo';

/** Métricas por día, en este orden fijo (una fila por réplica). */
export const METRICAS = [
  'beneficio', // B del modelo (costos del escenario)
  'costo', // C del modelo
  'ingresos',
  'atendidos',
  'sumaEspera', // Σ espera de los atendidos [min]
  'extraOcio', // Σ c_ocio,i · extra_i [$], para reponderar el factor de c_extra
  'costoExtra', // Σ c_extra,i · extra_i [$]
  'ocioPond', // Σ c_ocio,i · ocio_i [$]
  'perdidos',
  'abandonos',
  'horasExtra', // [min]
  'ocio', // [min]
  'utilizacion',
] as const;
export type Metrica = (typeof METRICAS)[number];
export const M = METRICAS.length;
export const IDX = Object.fromEntries(METRICAS.map((m, i) => [m, i])) as Record<Metrica, number>;

export function filaDeDia(m: MetricasDia): number[] {
  const t = m.espera.todas;
  return [
    m.beneficio,
    m.costos.total,
    m.ingresos,
    m.atendidosTotal,
    t.n > 0 ? t.media * t.n : 0,
    m.porProfesional.reduce((s, p) => s + p.cOcio * p.horasExtra, 0),
    m.costos.extra,
    m.costos.ocio,
    m.perdidosTotal,
    m.perdidos.abandono,
    m.horasExtra,
    m.ocio,
    m.utilizacionMedicos,
  ];
}

export interface TareaSimulacion {
  id: number;
  escenario: Escenario;
  semilla: number;
  desde: number;
  hasta: number;
}

export interface RespuestaTarea {
  id: number;
  datos?: Float64Array;
  error?: string;
}

/** Simula las réplicas [desde, hasta): (hasta − desde) filas × M columnas. */
export function simularBloque(prep: EscenarioPreparado, semilla: number, desde: number, hasta: number): Float64Array {
  const out = new Float64Array((hasta - desde) * M);
  for (let r = desde; r < hasta; r++) {
    const fila = filaDeDia(simularDia(prep, { semilla, replica: r, traza: false, serie: false }).metricas);
    out.set(fila, (r - desde) * M);
  }
  return out;
}

/** Caché de escenarios preparados dentro de un worker (validar con zod una vez por escenario). */
export function crearSimulador(): (t: TareaSimulacion) => Float64Array {
  const cache = new Map<string, EscenarioPreparado>();
  return (t) => {
    const clave = JSON.stringify(t.escenario);
    let prep = cache.get(clave);
    if (!prep) {
      prep = prepararEscenario(t.escenario);
      cache.set(clave, prep);
      if (cache.size > 64) cache.delete(cache.keys().next().value!);
    }
    return simularBloque(prep, t.semilla, t.desde, t.hasta);
  };
}
