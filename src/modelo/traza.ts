/**
 * Traza de un día del consultorio. Extiende el registro del motor con lo que
 * necesita la animación (clase, prioridad, profesional, etapa) y es
 * autocontenida: trae el escenario, la semilla, la tabla de pacientes y los
 * eventos de los profesionales, así que se puede animar o exportar sin nada más.
 */
import { z } from 'zod';
import { EsquemaRegistroTraza } from '../motor';
import { EsquemaEscenario } from './escenario';

export const CLASES = ['turno', 'sobreturno', 'tardio', 'espontaneo', 'urgencia'] as const;
export const EsquemaClase = z.enum(CLASES);
export type Clase = z.infer<typeof EsquemaClase>;

export const MOTIVOS_PERDIDA = ['tardio_rechazado', 'abandono', 'fuera_de_horario', 'sin_profesional'] as const;
export const EsquemaMotivoPerdida = z.enum(MOTIVOS_PERDIDA);
export type MotivoPerdida = z.infer<typeof EsquemaMotivoPerdida>;

export const ETAPAS = ['llegada', 'admision', 'sala', 'consultorio', 'salida'] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Prioridad en la selección del médico: menor = antes. */
export const PRIORIDAD_CLASE: Record<Clase, number> = { urgencia: 0, turno: 1, sobreturno: 1, tardio: 2, espontaneo: 3 };

export const EsquemaRegistroConsultorio = EsquemaRegistroTraza.extend({
  clase: EsquemaClase,
  prioridad: z.number().int(),
  /** Id del profesional asignado (el del turno o, para espontáneos, el que lo atiende); null si todavía no hay. */
  profesional: z.string().nullable(),
  etapa: z.enum(ETAPAS),
});
export type RegistroConsultorio = z.infer<typeof EsquemaRegistroConsultorio>;

export const EsquemaEventoProfesional = z.object({
  t: z.number(),
  profesional: z.string(),
  tipo: z.enum(['llega', 'inicia_consulta', 'termina_consulta', 'fin_turno', 'se_retira']),
  paciente: z.number().int().nullable(),
});
export type EventoProfesional = z.infer<typeof EsquemaEventoProfesional>;

export const EsquemaPacienteTraza = z.object({
  id: z.number().int(),
  clave: z.string(),
  origen: z.enum(['turno', 'sobreturno', 'espontaneo']),
  claseFinal: EsquemaClase,
  urgencia: z.boolean(),
  especialidad: z.string(),
  profesionalTurno: z.string().nullable(),
  atendidoPor: z.string().nullable(),
  horaTurno: z.number().nullable(),
  llegada: z.number(),
  ausente: z.boolean(),
  inicioAdmision: z.number().nullable(),
  finAdmision: z.number().nullable(),
  inicioConsulta: z.number().nullable(),
  finConsulta: z.number().nullable(),
  salida: z.number().nullable(),
  espera: z.number().nullable(),
  esperaAdmision: z.number().nullable(),
  motivoPerdida: EsquemaMotivoPerdida.nullable(),
  resultado: z.enum(['atendido', 'perdido', 'ausente']),
});
export type PacienteTraza = z.infer<typeof EsquemaPacienteTraza>;

export const EsquemaTrazaDia = z.object({
  version: z.literal(1),
  escenario: EsquemaEscenario,
  semilla: z.number(),
  replica: z.number().int(),
  profesionales: z.array(
    z.object({ id: z.string(), nombre: z.string(), especialidad: z.string(), inicioTurno: z.number(), finTurno: z.number(), llegada: z.number(), salida: z.number() }),
  ),
  pacientes: z.array(EsquemaPacienteTraza),
  registros: z.array(EsquemaRegistroConsultorio),
  eventosProfesionales: z.array(EsquemaEventoProfesional),
});
export type TrazaDia = z.infer<typeof EsquemaTrazaDia>;
