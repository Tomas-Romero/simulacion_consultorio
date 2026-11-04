/**
 * Validación del modelo del consultorio contra resultados analíticos:
 * - (a) caso determinista: agenda exacta;
 * - (b) M/G/1 (Pollaczek-Khinchine);
 * - (c) red en serie admisión M/M/1 → consultorios M/M/c (Burke / Jackson).
 * Mismo criterio que el paso #1: IC 95 % individual informado y aprobación
 * con el IC simultáneo (Bonferroni) sobre todas las comparaciones (b) y (c).
 */
import { contiene, intervaloConfianza, nivelBonferroni, teoriaMMc, type IntervaloConfianza } from '../motor';
import { ESPECIALIDADES, EsquemaEscenario, type Escenario, type Especialidad } from './escenario';
import { prepararEscenario } from './preparar';
import { PRESET_POLICONSULTORIO_3 } from './presets';
import { simularDia } from './simulacion';

const mezclaSolo = (e: Especialidad): Record<Especialidad, number> =>
  Object.fromEntries(ESPECIALIDADES.map((x) => [x, x === e ? 1 : 0])) as Record<Especialidad, number>;

/**
 * Escenario sin ninguna variabilidad: sin ausentismo (β0 = −50 ⇒ p ≈ 2·10⁻²²),
 * puntualidad 0, demora 0, sin espontáneos, agenda llena y atención = D.
 */
export function escenarioDeterminista(conAdmision: boolean): Escenario {
  const base = PRESET_POLICONSULTORIO_3;
  return EsquemaEscenario.parse({
    ...base,
    nombre: conAdmision ? 'Determinista con admisión constante' : 'Determinista sin admisión',
    profesionales: [
      { ...base.profesionales[0]!, duracionTurno: 20, demoraInicio: { tipo: 'constante', valor: 0 }, sobreturnos: { k: 0, politica: 'inicio' } },
      { ...base.profesionales[1]!, turno: 'tarde', duracionTurno: 30, demoraInicio: { tipo: 'constante', valor: 0 }, sobreturnos: { k: 0, politica: 'inicio' } },
    ],
    pacientes: {
      ...base.pacientes,
      atencion: { familia: 'constante', cv: 1, factorPrimeraVez: 1, factorControl: 1, factorEspontaneo: 1, factorUrgencia: 1 },
    },
    ausentismo: { beta0: -50, beta1: 0 },
    puntualidad: { ...base.puntualidad, desvio: { tipo: 'constante', valor: conAdmision ? -5 : 0 } },
    espontaneos: { ...base.espontaneos, tasasPorHora: base.espontaneos.tasasPorHora.map(() => 0) },
    admision: conAdmision ? { recepcionistas: 1, tiempo: { tipo: 'constante', valor: 3 } } : { recepcionistas: 0, tiempo: { tipo: 'constante', valor: 0 } },
  });
}

/** Escenario de solo espontáneos con tasa constante durante `horas`, para los casos de estado estacionario. */
function escenarioEstacionario(o: {
  nombre: string;
  horas: number;
  lambdaPorHora: number;
  profesionales: number;
  familia: 'lognormal' | 'exponencial';
  cv: number;
  recepcionistas: number;
  mediaAdmision: number;
}): Escenario {
  const base = PRESET_POLICONSULTORIO_3;
  return EsquemaEscenario.parse({
    ...base,
    nombre: o.nombre,
    jornada: { inicio: 0, cambioTurno: o.horas * 60, fin: 2 * o.horas * 60 },
    profesionales: Array.from({ length: o.profesionales }, (_, i) => ({
      ...base.profesionales[0]!,
      id: `P${i + 1}`,
      nombre: `Clínica ${i + 1}`,
      duracionTurno: 15,
      ocupacionAgenda: 0,
      demoraInicio: { tipo: 'constante', valor: 0 },
      sobreturnos: { k: 0, politica: 'inicio' },
    })),
    pacientes: { ...base.pacientes, atencion: { familia: o.familia, cv: o.cv, factorPrimeraVez: 0.8, factorControl: 0.8, factorEspontaneo: 0.8, factorUrgencia: 0.8 } },
    espontaneos: {
      tasasPorHora: Array.from({ length: o.horas }, () => o.lambdaPorHora),
      mezcla: mezclaSolo('clinica'),
      proporcionUrgencias: 0,
      abandonan: false,
      paciencia: { tipo: 'exponencial', media: 45 },
      cierreAntesDelFin: 0,
    },
    admision: { recepcionistas: o.recepcionistas, tiempo: o.recepcionistas > 0 ? { tipo: 'exponencial', media: o.mediaAdmision } : { tipo: 'constante', valor: 0 } },
  });
}

/** Pollaczek-Khinchine: Wq = λ·E[S²] / (2(1 − ρ)), con E[S²] = E[S]²(1 + cv²). Tiempos en minutos. */
export function teoriaMG1(lambdaPorMin: number, mediaServicio: number, cv: number): { rho: number; Wq: number; W: number } {
  const rho = lambdaPorMin * mediaServicio;
  if (rho >= 1) throw new Error('M/G/1 inestable');
  const Wq = (lambdaPorMin * mediaServicio ** 2 * (1 + cv * cv)) / (2 * (1 - rho));
  return { rho, Wq, W: Wq + mediaServicio };
}

/** Parámetros de los casos de estado estacionario (λ en llegadas/h; tiempos en min y h). */
export const CASO_MG1 = { lambdaPorHora: 3.5, mediaServicio: 12, cv: 0.4, horas: 2000, calentamientoHoras: 100 } as const;
export const CASO_JACKSON = { lambdaPorHora: 12, mediaAdmision: 2, mediaServicio: 12, c: 3, horas: 1500, calentamientoHoras: 100 } as const;
export const REPLICAS_MODELO = 30;
export const SEMILLA_MODELO = 20260003;
/** Comparaciones de la suite del modelo: 1 en (b) y 3 en (c). */
export const COMPARACIONES_MODELO = 4;

export interface ComparacionModelo {
  caso: string;
  medida: string;
  teorico: number;
  ic: IntervaloConfianza;
  dentro: boolean;
  icSimultaneo: IntervaloConfianza;
  dentroSimultaneo: boolean;
  z: number;
}

function comparar(caso: string, medida: string, teorico: number, valores: number[]): ComparacionModelo {
  const ic = intervaloConfianza(valores, 0.95);
  const icSimultaneo = intervaloConfianza(valores, nivelBonferroni(0.95, COMPARACIONES_MODELO));
  return {
    caso,
    medida,
    teorico,
    ic,
    dentro: contiene(ic, teorico),
    icSimultaneo,
    dentroSimultaneo: contiene(icSimultaneo, teorico),
    z: (ic.media - teorico) / (ic.desvio / Math.sqrt(ic.n)),
  };
}

export interface ResultadoValidacionModelo {
  comparaciones: ComparacionModelo[];
  pacientesPorReplica: number;
  segundos: number;
}

/** (b) Un profesional, solo espontáneos Poisson homogéneos, atención lognormal, sin admisión ni abandono. */
export function validarMG1(replicas = REPLICAS_MODELO, semilla = SEMILLA_MODELO): ResultadoValidacionModelo {
  const t0 = performance.now();
  const c = CASO_MG1;
  const prep = prepararEscenario(
    escenarioEstacionario({ nombre: 'M/G/1', horas: c.horas, lambdaPorHora: c.lambdaPorHora, profesionales: 1, familia: 'lognormal', cv: c.cv, recepcionistas: 0, mediaAdmision: 1 }),
  );
  const wq: number[] = [];
  let pacientes = 0;
  for (let r = 0; r < replicas; r++) {
    const res = simularDia(prep, { semilla, replica: r, serie: false, inicioMedicion: c.calentamientoHoras * 60 });
    wq.push(res.metricas.espera.espontaneo.media);
    pacientes += res.metricas.llegadas;
  }
  const teoria = teoriaMG1(c.lambdaPorHora / 60, c.mediaServicio, c.cv);
  return {
    comparaciones: [comparar(`M/G/1 (λ = ${c.lambdaPorHora}/h, E[S] = ${c.mediaServicio} min, cv = ${c.cv}, ρ = ${teoria.rho.toFixed(3)})`, 'Wq [min]', teoria.Wq, wq)],
    pacientesPorReplica: Math.round(pacientes / replicas),
    segundos: (performance.now() - t0) / 1000,
  };
}

/** (c) Llegadas Poisson → admisión M/M/1 → c consultorios M/M/c con cola compartida. */
export function validarJackson(replicas = REPLICAS_MODELO, semilla = SEMILLA_MODELO): ResultadoValidacionModelo {
  const t0 = performance.now();
  const c = CASO_JACKSON;
  const prep = prepararEscenario(
    escenarioEstacionario({
      nombre: 'Red en serie',
      horas: c.horas,
      lambdaPorHora: c.lambdaPorHora,
      profesionales: c.c,
      familia: 'exponencial',
      cv: 1,
      recepcionistas: 1,
      mediaAdmision: c.mediaAdmision,
    }),
  );
  const wqAdm: number[] = [];
  const wqCons: number[] = [];
  const total: number[] = [];
  let pacientes = 0;
  for (let r = 0; r < replicas; r++) {
    const m = simularDia(prep, { semilla, replica: r, serie: false, inicioMedicion: c.calentamientoHoras * 60 }).metricas;
    wqAdm.push(m.esperaAdmision.media);
    wqCons.push(m.esperaSala.media);
    total.push(m.espera.espontaneo.media);
    pacientes += m.llegadas;
  }
  const adm = teoriaMMc({ lambda: c.lambdaPorHora, mu: 60 / c.mediaAdmision, c: 1 });
  const cons = teoriaMMc({ lambda: c.lambdaPorHora, mu: 60 / c.mediaServicio, c: c.c });
  const nombre = `Admisión M/M/1 (ρ = ${adm.rho.toFixed(2)}) → consultorios M/M/${c.c} (ρ = ${cons.rho.toFixed(2)}), λ = ${c.lambdaPorHora}/h`;
  return {
    comparaciones: [
      comparar(nombre, 'Wq admisión [min]', adm.Wq * 60, wqAdm),
      comparar(nombre, 'Wq consultorio [min]', cons.Wq * 60, wqCons),
      comparar(nombre, 'Espera total = Wq adm + E[S adm] + Wq cons [min]', adm.Wq * 60 + c.mediaAdmision + cons.Wq * 60, total),
    ],
    pacientesPorReplica: Math.round(pacientes / replicas),
    segundos: (performance.now() - t0) / 1000,
  };
}
