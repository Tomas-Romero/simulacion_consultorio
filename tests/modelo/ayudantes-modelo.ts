/** Ayudantes para armar escenarios y días a medida en los tests de reglas. */
import { ESPECIALIDADES, EsquemaEscenario, PRESET_POLICONSULTORIO_3, type Escenario, type Especialidad, type PacienteGenerado, type Profesional } from '../../src/modelo';

export const h = (hora: number, minuto = 0): number => hora * 60 + minuto;

export function profesionalPrueba(id: string, especialidad: Especialidad, turno: Profesional['turno'], demora: number, D: Profesional['duracionTurno'] = 15): Profesional {
  return {
    id,
    nombre: id,
    especialidad,
    turno,
    duracionTurno: D,
    ocupacionAgenda: 0,
    demoraInicio: { tipo: 'constante', valor: demora },
    sobreturnos: { k: 0, politica: 'inicio' },
  };
}

/** Escenario con atención constante = D, sin admisión y sin generación propia de pacientes (se inyectan). */
export function escenarioReglas(profesionales: Profesional[], cambios: Partial<Escenario> = {}): Escenario {
  const base = PRESET_POLICONSULTORIO_3;
  return EsquemaEscenario.parse({
    ...base,
    profesionales,
    pacientes: { ...base.pacientes, atencion: { familia: 'constante', cv: 1, factorPrimeraVez: 1, factorControl: 1, factorEspontaneo: 1, factorUrgencia: 1 } },
    espontaneos: { ...base.espontaneos, tasasPorHora: base.espontaneos.tasasPorHora.map(() => 0) },
    admision: { recepcionistas: 0, tiempo: { tipo: 'constante', valor: 0 } },
    ...cambios,
  });
}

let siguienteId = 0;

/** Paciente con turno inyectado. */
export function conTurno(profesional: number, especialidad: Especialidad, horaTurno: number, llegada: number, extra: Partial<PacienteGenerado> = {}): PacienteGenerado {
  const id = siguienteId++;
  return {
    id,
    clave: `t${id}`,
    origen: 'turno',
    urgencia: false,
    profesional,
    especialidad,
    slot: 0,
    horaTurno,
    anticipacion: 7,
    pNoShow: 0.1,
    ausente: false,
    primeraVez: false,
    desvioPuntualidad: llegada - horaTurno,
    llegada,
    tiempoAdmision: 0,
    factorAtencion: 1,
    tiempoAtencionTurno: null,
    paciencia: 1e9,
    ...extra,
  };
}

/** Espontáneo (o urgencia) inyectado. */
export function espontaneo(especialidad: Especialidad, llegada: number, extra: Partial<PacienteGenerado> = {}): PacienteGenerado {
  const id = siguienteId++;
  return {
    id,
    clave: `e${id}`,
    origen: 'espontaneo',
    urgencia: false,
    profesional: -1,
    especialidad,
    slot: -1,
    horaTurno: null,
    anticipacion: null,
    pNoShow: null,
    ausente: false,
    primeraVez: false,
    desvioPuntualidad: null,
    llegada,
    tiempoAdmision: 0,
    factorAtencion: 1,
    tiempoAtencionTurno: null,
    paciencia: 1e9,
    ...extra,
  };
}

/** Renumera los ids 0..n−1 en el orden dado (el simulador usa el id para indexar y desempatar). */
export function dia(pacientes: PacienteGenerado[], demoras: number[]): { pacientes: PacienteGenerado[]; demoras: number[] } {
  return { pacientes: pacientes.map((p, id) => ({ ...p, id })), demoras };
}

export const mezclaSolo = (e: Especialidad): Record<Especialidad, number> =>
  Object.fromEntries(ESPECIALIDADES.map((x) => [x, x === e ? 1 : 0])) as Record<Especialidad, number>;
