/**
 * Escenario por defecto y presets. TODOS los valores son ficticios (supuestos
 * S1–S30 de docs/modelo-conceptual.md) y se editan desde la aplicación.
 */
import { EsquemaEscenario, type Escenario, type Especialidad, type Profesional } from './escenario';

const HORA = 60;

/** Perfil ficticio de llegadas espontáneas [llegadas/h] de 08 a 20 h para un policonsultorio mediano (Λ = 18,5/día). */
export const PERFIL_ESPONTANEOS = [1.5, 2.5, 2, 1.5, 1, 1, 1, 1.5, 2, 2, 1.5, 1];

/** Mezcla ficticia de la demanda espontánea por especialidad. */
export const MEZCLA_ESPONTANEOS: Record<Especialidad, number> = {
  clinica: 55,
  pediatria: 25,
  traumatologia: 10,
  cardiologia: 5,
  ginecologia: 3,
  dermatologia: 2,
};

/** Días de anticipación de los turnos regulares (valor/frecuencia), ficticio. */
export const TABLA_ANTICIPACION = [
  { valor: 1, frecuencia: 10 },
  { valor: 3, frecuencia: 15 },
  { valor: 7, frecuencia: 25 },
  { valor: 14, frecuencia: 25 },
  { valor: 21, frecuencia: 15 },
  { valor: 30, frecuencia: 10 },
];

function profesional(
  id: string,
  nombre: string,
  especialidad: Especialidad,
  turno: Profesional['turno'],
  duracionTurno: Profesional['duracionTurno'],
): Profesional {
  return {
    id,
    nombre,
    especialidad,
    turno,
    duracionTurno,
    ocupacionAgenda: 1,
    cuposEspontaneos: { cadaN: 0 },
    demoraInicio: { tipo: 'triangular', min: 0, moda: 5, max: 20 },
    // k = 0: los sobreturnos son la variable de decisión del #4, no un dato de la situación inicial.
    sobreturnos: { k: 0, politica: 'intercalado' },
  };
}

/** Parámetros de calibración de cada preset (ver docs/calibracion.md). */
export interface CalibracionPreset {
  proporcionPrimeraVez: number;
  /** Factor sobre PERFIL_ESPONTANEOS. */
  escalaEspontaneos: number;
  /** Horas del perfil con demanda espontánea desde las 08:00 (12 = todo el día). */
  horasEspontaneos: number;
  ocupacionAgenda: number;
  /** Cupos de demanda espontánea: 1 de cada N slots (0 = sin cupos). */
  cuposCadaN: number;
}

function base(nombre: string, descripcion: string, profesionales: Profesional[], cal: CalibracionPreset, recepcionistas: number): Escenario {
  return EsquemaEscenario.parse({
    nombre,
    descripcion,
    jornada: { inicio: 8 * HORA, cambioTurno: 14 * HORA, fin: 20 * HORA },
    profesionales: profesionales.map((p) => ({ ...p, ocupacionAgenda: cal.ocupacionAgenda, cuposEspontaneos: { cadaN: cal.cuposCadaN } })),
    pacientes: {
      proporcionPrimeraVez: cal.proporcionPrimeraVez,
      anticipacion: TABLA_ANTICIPACION,
      anticipacionSobreturno: 1,
      atencion: { familia: 'lognormal', cv: 0.4, factorPrimeraVez: 1.3, factorControl: 0.8, factorEspontaneo: 0.8, factorUrgencia: 0.8 },
    },
    // Calibrado para P(no-show) ≈ 8 % a 1 día y ≈ 30 % a 30 días.
    ausentismo: { beta0: -2.4973, beta1: 0.055 },
    puntualidad: {
      desvio: { tipo: 'normal_truncada', media: -5, desvio: 8, min: -30, max: 30 },
      tolerancia: 15,
      politicaTardios: 'atender_si_libre',
      adelantarTurnos: true,
    },
    espontaneos: {
      tasasPorHora: PERFIL_ESPONTANEOS.slice(0, cal.horasEspontaneos).map((t) => Math.round(t * cal.escalaEspontaneos * 1000) / 1000),
      mezcla: MEZCLA_ESPONTANEOS,
      proporcionUrgencias: 0.1,
      abandonan: true,
      // Iteración de validación 2: lognormal (P(< 20 min) ≈ 1,8 %); antes exponencial de media 45.
      paciencia: { tipo: 'lognormal', media: 60, cv: 0.5 },
      cierreAntesDelFin: 30,
    },
    admision: { recepcionistas, tiempo: { tipo: 'triangular', min: 1, moda: 2, max: 5 } },
    // c_ocio derivado = honorario / duración media de la consulta de cada profesional (antes 500 $/min fijo).
    costos: { espera: 150, ocio: 'derivado', extra: 750, perdido: 20000, honorario: 30000 },
  });
}

/** Valores de calibración vigentes (los anteriores están en docs/calibracion.md). */
export const CALIBRACION_PRESETS: Record<'chico' | 'policonsultorio' | 'centro', CalibracionPreset> = {
  // Antes de #2b: primera vez 0,4 en los tres y demanda espontánea todo el día en el consultorio chico.
  // #2c (iteración de validación 2): cupos de demanda espontánea y tasa de espontáneos recalibrados.
  // Antes de #2c: sin cupos y escala de espontáneos 0,4 / 1 / 1,5.
  chico: { proporcionPrimeraVez: 0.25, escalaEspontaneos: 1.6, horasEspontaneos: 6, ocupacionAgenda: 1, cuposCadaN: 2 },
  policonsultorio: { proporcionPrimeraVez: 0.25, escalaEspontaneos: 2, horasEspontaneos: 12, ocupacionAgenda: 1, cuposCadaN: 3 },
  centro: { proporcionPrimeraVez: 0.25, escalaEspontaneos: 1.5, horasEspontaneos: 12, ocupacionAgenda: 1, cuposCadaN: 12 },
};

export const PRESET_CONSULTORIO_CHICO = base(
  'Consultorio chico (1 médico)',
  'Un médico clínico de mañana con turnos de 15 min y una recepcionista. Abre solo de mañana: no hay demanda espontánea a la tarde.',
  [profesional('P1', 'Dra. Clínica (mañana)', 'clinica', 'manana', 15)],
  CALIBRACION_PRESETS.chico,
  1,
);

export const PRESET_POLICONSULTORIO_3 = base(
  'Policonsultorio (3 profesionales)',
  'Clínica de mañana y de tarde y pediatría de mañana, una recepcionista.',
  [
    profesional('P1', 'Clínica mañana', 'clinica', 'manana', 15),
    profesional('P2', 'Pediatría mañana', 'pediatria', 'manana', 20),
    profesional('P3', 'Clínica tarde', 'clinica', 'tarde', 15),
  ],
  CALIBRACION_PRESETS.policonsultorio,
  1,
);

export const PRESET_CENTRO_6 = base(
  'Centro completo (6 profesionales)',
  'Seis profesionales en los dos turnos y dos recepcionistas; demanda espontánea un 50 % mayor.',
  [
    profesional('P1', 'Clínica mañana', 'clinica', 'manana', 15),
    profesional('P2', 'Pediatría mañana', 'pediatria', 'manana', 20),
    profesional('P3', 'Cardiología mañana', 'cardiologia', 'manana', 30),
    profesional('P4', 'Clínica tarde', 'clinica', 'tarde', 15),
    profesional('P5', 'Traumatología tarde', 'traumatologia', 'tarde', 20),
    profesional('P6', 'Ginecología tarde', 'ginecologia', 'tarde', 20),
  ],
  CALIBRACION_PRESETS.centro,
  2,
);

/** Escenario por defecto: el policonsultorio de 3 profesionales. */
export const ESCENARIO_POR_DEFECTO = PRESET_POLICONSULTORIO_3;

export const PRESETS: readonly Escenario[] = [PRESET_CONSULTORIO_CHICO, PRESET_POLICONSULTORIO_3, PRESET_CENTRO_6];
