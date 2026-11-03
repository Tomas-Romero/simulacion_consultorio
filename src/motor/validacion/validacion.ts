/**
 * Validación del motor: R réplicas independientes de cada caso M/M/c, IC 95 %
 * de cada medida y comparación con Erlang C; Ley de Little réplica por réplica.
 *
 * Calentamiento: ≈ 10 tiempos de relajación (τ = 1 / (cμ(1 − √ρ)²)), redondeado.
 * Medición: ≥ 200 τ, para que el sesgo por correlación sea despreciable y el
 * IC quede con semiancho de pocos puntos porcentuales.
 *
 * Se informan dos IC por medida: el individual al 95 % (lo que pide la
 * consigna) y el simultáneo al 95 % conjunto sobre las 18 comparaciones
 * (Bonferroni). Con 18 IC individuales al 95 % se espera por azar que alguno
 * no cubra el valor teórico; el criterio de aprobación del test es el conjunto.
 */
import { z } from 'zod';
import { contiene, intervaloConfianza, nivelBonferroni, type IntervaloConfianza } from '../estadistica';
import { teoriaMMc, tiempoRelajacion, type MedidasMMc } from '../teoria-colas';
import { simularMMc, type ResultadoReplicaMMc } from './mmc';

export const EsquemaCasoValidacion = z.object({
  id: z.string(),
  nombre: z.string(),
  lambdaPorHora: z.number().positive(),
  muPorHora: z.number().positive(),
  c: z.number().int().positive(),
  calentamientoHoras: z.number().positive(),
  duracionHoras: z.number().positive(),
});

export type CasoValidacion = z.infer<typeof EsquemaCasoValidacion>;

export const CASOS_VALIDACION: readonly CasoValidacion[] = z.array(EsquemaCasoValidacion).parse([
  { id: 'mm1-rho05', nombre: 'M/M/1, λ = 2/h, μ = 4/h (ρ = 0,5)', lambdaPorHora: 2, muPorHora: 4, c: 1, calentamientoHoras: 30, duracionHoras: 5000 },
  { id: 'mm1-rho09', nombre: 'M/M/1, λ = 3,6/h, μ = 4/h (ρ = 0,9)', lambdaPorHora: 3.6, muPorHora: 4, c: 1, calentamientoHoras: 1000, duracionHoras: 20000 },
  { id: 'mm3', nombre: 'M/M/3, λ = 10/h, μ = 4/h (ρ = 0,833)', lambdaPorHora: 10, muPorHora: 4, c: 3, calentamientoHoras: 120, duracionHoras: 5000 },
]);

export const REPLICAS_VALIDACION = 30;
export const SEMILLA_VALIDACION = 20260001;
/** Tolerancia relativa para la Ley de Little en cada réplica (efectos de borde de la ventana). */
export const TOLERANCIA_LITTLE = 0.01;

/** Nivel de confianza individual que pide la consigna. */
export const NIVEL_INDIVIDUAL = 0.95;
/** Nivel conjunto sobre todas las comparaciones de la suite (criterio del test). */
export const NIVEL_CONJUNTO = 0.95;

export type ClaveMedida = 'rho' | 'pEspera' | 'Lq' | 'L' | 'Wq' | 'W';

export const MEDIDAS: readonly { clave: ClaveMedida; nombre: string; unidad: string }[] = [
  { clave: 'rho', nombre: 'ρ (utilización)', unidad: '' },
  { clave: 'pEspera', nombre: 'P(espera > 0)', unidad: '' },
  { clave: 'Lq', nombre: 'Lq', unidad: 'clientes' },
  { clave: 'L', nombre: 'L', unidad: 'clientes' },
  { clave: 'Wq', nombre: 'Wq', unidad: 'min' },
  { clave: 'W', nombre: 'W', unidad: 'min' },
];

/** Cantidad total de comparaciones teórico vs simulado de la suite (3 casos × 6 medidas). */
export const COMPARACIONES_SUITE = CASOS_VALIDACION.length * MEDIDAS.length;

export interface ComparacionMedida {
  clave: ClaveMedida;
  nombre: string;
  unidad: string;
  teorico: number;
  /** IC individual al 95 %. */
  ic: IntervaloConfianza;
  dentro: boolean;
  /** IC simultáneo (Bonferroni, 95 % conjunto sobre todas las comparaciones de la suite). */
  icSimultaneo: IntervaloConfianza;
  dentroSimultaneo: boolean;
  /** (x̄ − teórico) / (s/√R): cuántos errores estándar se aleja la estimación. */
  z: number;
}

export interface LittleReplica {
  replica: number;
  L: number;
  lambdaW: number;
  errorL: number;
  Lq: number;
  lambdaWq: number;
  errorLq: number;
}

export interface ResultadoCaso {
  caso: CasoValidacion;
  teoria: MedidasMMc;
  tiempoRelajacionHoras: number;
  comparaciones: ComparacionMedida[];
  little: LittleReplica[];
  maxErrorLittle: number;
  clientesPorReplica: number;
  eventosTotales: number;
}

/** Erlang C con los tiempos expresados en minutos, igual que la simulación. */
export function teoriaEnMinutos(caso: CasoValidacion): MedidasMMc {
  const t = teoriaMMc({ lambda: caso.lambdaPorHora, mu: caso.muPorHora, c: caso.c });
  return { ...t, Wq: t.Wq * 60, W: t.W * 60 };
}

function errorRelativo(a: number, b: number): number {
  return Math.abs(a - b) / Math.abs(a);
}

export function validarCaso(caso: CasoValidacion, replicas = REPLICAS_VALIDACION, semilla = SEMILLA_VALIDACION): ResultadoCaso {
  const resultados: ResultadoReplicaMMc[] = [];
  for (let r = 0; r < replicas; r++) {
    resultados.push(
      simularMMc({
        lambdaPorHora: caso.lambdaPorHora,
        muPorHora: caso.muPorHora,
        c: caso.c,
        calentamiento: caso.calentamientoHoras * 60,
        duracion: caso.duracionHoras * 60,
        semilla,
        replica: r,
      }),
    );
  }
  const teoria = teoriaEnMinutos(caso);
  const nivelSimultaneo = nivelBonferroni(NIVEL_CONJUNTO, COMPARACIONES_SUITE);
  const comparaciones = MEDIDAS.map(({ clave, nombre, unidad }) => {
    const valores = resultados.map((x) => x[clave]);
    const ic = intervaloConfianza(valores, NIVEL_INDIVIDUAL);
    const icSimultaneo = intervaloConfianza(valores, nivelSimultaneo);
    const teorico = teoria[clave];
    return {
      clave,
      nombre,
      unidad,
      teorico,
      ic,
      dentro: contiene(ic, teorico),
      icSimultaneo,
      dentroSimultaneo: contiene(icSimultaneo, teorico),
      z: (ic.media - teorico) / (ic.desvio / Math.sqrt(ic.n)),
    };
  });
  const little = resultados.map((x, replica) => {
    const lambdaW = x.lambdaObs * x.W;
    const lambdaWq = x.lambdaObs * x.Wq;
    return { replica, L: x.L, lambdaW, errorL: errorRelativo(x.L, lambdaW), Lq: x.Lq, lambdaWq, errorLq: errorRelativo(x.Lq, lambdaWq) };
  });
  return {
    caso,
    teoria,
    tiempoRelajacionHoras: tiempoRelajacion({ lambda: caso.lambdaPorHora, mu: caso.muPorHora, c: caso.c }),
    comparaciones,
    little,
    maxErrorLittle: Math.max(...little.map((l) => Math.max(l.errorL, l.errorLq))),
    clientesPorReplica: Math.round(resultados.reduce((s, x) => s + x.clientes, 0) / replicas),
    eventosTotales: resultados.reduce((s, x) => s + x.eventos, 0),
  };
}
