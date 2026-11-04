/**
 * Esquema del escenario del policonsultorio. Es serializable a JSON: es lo que
 * se va a importar y exportar (paso #6). Todos los valores por defecto son
 * ficticios (ver supuestos en docs/modelo-conceptual.md).
 *
 * Unidad de tiempo: minutos desde las 00:00.
 */
import { z } from 'zod';
import { EsquemaTablaEmpirica } from '../motor';

export const ESPECIALIDADES = ['clinica', 'pediatria', 'cardiologia', 'traumatologia', 'ginecologia', 'dermatologia'] as const;
export const EsquemaEspecialidad = z.enum(ESPECIALIDADES);
export type Especialidad = z.infer<typeof EsquemaEspecialidad>;

export const NOMBRES_ESPECIALIDAD: Record<Especialidad, string> = {
  clinica: 'Clínica médica',
  pediatria: 'Pediatría',
  cardiologia: 'Cardiología',
  traumatologia: 'Traumatología',
  ginecologia: 'Ginecología',
  dermatologia: 'Dermatología',
};

const finito = z.number().finite();
const noNegativo = z.number().finite().nonnegative();
const positivo = z.number().finite().positive();
const proporcion = z.number().min(0).max(1);

/**
 * Distribución de un tiempo [min], declarada como datos. Se construye con las
 * distribuciones del motor; 'constante' sirve para los casos de validación.
 */
export const EsquemaDistribucionTiempo = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('constante'), valor: finito }),
  z.object({ tipo: z.literal('uniforme'), min: finito, max: finito }),
  z.object({ tipo: z.literal('triangular'), min: finito, moda: finito, max: finito }),
  z.object({ tipo: z.literal('exponencial'), media: positivo }),
  z.object({ tipo: z.literal('normal_truncada'), media: finito, desvio: positivo, min: finito, max: finito }),
  z.object({ tipo: z.literal('lognormal'), media: positivo, cv: positivo }),
]);
export type DistribucionTiempo = z.infer<typeof EsquemaDistribucionTiempo>;

export const POLITICAS_SOBRETURNO = ['inicio', 'intercalado', 'mayor_ausentismo', 'final'] as const;
export const EsquemaPoliticaSobreturno = z.enum(POLITICAS_SOBRETURNO);
export type PoliticaSobreturno = z.infer<typeof EsquemaPoliticaSobreturno>;

export const EsquemaProfesional = z.object({
  id: z.string().min(1),
  nombre: z.string(),
  especialidad: EsquemaEspecialidad,
  turno: z.enum(['manana', 'tarde']),
  /** Duración del turno de agenda D [min]. */
  duracionTurno: z.union([z.literal(15), z.literal(20), z.literal(30)]),
  /** Fracción de los slots para turnos (no cupos) que están reservados (1 = agenda llena). */
  ocupacionAgenda: proporcion,
  /**
   * Cupos de demanda espontánea: 1 de cada `cadaN` slots de la agenda, equiespaciados
   * (slots j con j mod cadaN = ⌊cadaN/2⌋). No se reservan para turnos; durante su ventana
   * los espontáneos pasan antes que los puntuales. 0 = sin cupos.
   */
  cuposEspontaneos: z.object({ cadaN: z.number().int().min(0).max(40) }).default({ cadaN: 0 }),
  /** Demora del médico al iniciar su turno [min]. */
  demoraInicio: EsquemaDistribucionTiempo,
  sobreturnos: z.object({
    k: z.number().int().min(0).max(40),
    politica: EsquemaPoliticaSobreturno,
  }),
});
export type Profesional = z.infer<typeof EsquemaProfesional>;

export const EsquemaEscenario = z
  .object({
    nombre: z.string(),
    descripcion: z.string().default(''),
    jornada: z.object({
      /** Inicio del turno mañana [min desde 00:00]. */
      inicio: noNegativo,
      /** Fin del turno mañana = inicio del turno tarde. */
      cambioTurno: positivo,
      /** Fin del turno tarde. */
      fin: positivo,
    }),
    profesionales: z.array(EsquemaProfesional).min(1).max(6),
    pacientes: z.object({
      proporcionPrimeraVez: proporcion,
      /** Días de anticipación con que se reservó cada turno regular (valor/frecuencia). */
      anticipacion: EsquemaTablaEmpirica,
      /** Días de anticipación de los sobreturnos. */
      anticipacionSobreturno: noNegativo,
      atencion: z.object({
        /** Forma de la distribución del tiempo de atención (la media la fija el factor × D). */
        familia: z.enum(['lognormal', 'exponencial', 'constante']),
        /** Coeficiente de variación (solo para lognormal). */
        cv: positivo,
        factorPrimeraVez: positivo,
        factorControl: positivo,
        factorEspontaneo: positivo,
        factorUrgencia: positivo,
      }),
    }),
    ausentismo: z.object({
      /** P(no-show | d días) = 1 / (1 + exp(−(β0 + β1·d))). */
      beta0: finito,
      beta1: finito,
    }),
    puntualidad: z.object({
      /** Llegada − hora del turno [min]; negativo = llega antes. */
      desvio: EsquemaDistribucionTiempo,
      /** Minutos de tolerancia: llegar después de hora + tolerancia lo hace tardío. */
      tolerancia: noNegativo,
      politicaTardios: z.enum(['atender_si_libre', 'pierde_turno']),
      /** Si un paciente con turno que llegó antes puede ser atendido antes de su hora. */
      adelantarTurnos: z.boolean(),
    }),
    espontaneos: z.object({
      /** Llegadas por hora a todo el policonsultorio, desde jornada.inicio (una entrada por hora). */
      tasasPorHora: z.array(noNegativo),
      /** Peso relativo de cada especialidad en la demanda espontánea. */
      mezcla: z.record(EsquemaEspecialidad, noNegativo),
      proporcionUrgencias: proporcion,
      abandonan: z.boolean(),
      paciencia: EsquemaDistribucionTiempo,
      /** Se dejan de admitir espontáneos estos minutos antes del fin del turno. */
      cierreAntesDelFin: noNegativo,
    }),
    admision: z.object({
      /** 0 = sin admisión (solo para casos de validación). */
      recepcionistas: z.number().int().min(0).max(2),
      tiempo: EsquemaDistribucionTiempo,
    }),
    costos: z.object({
      /** $ por minuto de espera de un paciente. */
      espera: noNegativo,
      /**
       * $ por minuto de ocio del médico (solo entra en el costo clásico C). 'derivado' = costo de
       * oportunidad de cada profesional: honorario / duración media de sus consultas con turno.
       */
      ocio: z.union([noNegativo, z.literal('derivado')]),
      /**
       * $ por minuto de hora extra. `{ derivado: factor }` = factor × c_ocio de cada profesional
       * (coherencia: la hora extra cuesta al menos lo que la normal, por eso factor ≥ 1).
       */
      extra: z.union([noNegativo, z.object({ derivado: z.number().min(1).max(5).default(1.5) })]),
      /** $ por paciente no atendido. */
      perdido: noNegativo,
      /** $ que se cobra por consulta. */
      honorario: noNegativo,
    }),
  })
  .refine((e) => e.jornada.inicio < e.jornada.cambioTurno && e.jornada.cambioTurno < e.jornada.fin, {
    message: 'la jornada debe cumplir inicio < cambioTurno < fin',
  })
  .refine((e) => new Set(e.profesionales.map((p) => p.id)).size === e.profesionales.length, {
    message: 'los ids de los profesionales deben ser únicos',
  })
  .refine((e) => Object.values(e.espontaneos.mezcla).some((w) => (w ?? 0) > 0) || e.espontaneos.tasasPorHora.every((t) => t === 0), {
    message: 'la mezcla de especialidades necesita al menos un peso positivo',
  });

export type Escenario = z.infer<typeof EsquemaEscenario>;
/** Lo que se acepta como entrada (con los campos que tienen valor por defecto opcionales). */
export type EntradaEscenario = z.input<typeof EsquemaEscenario>;
