/**
 * Lectura de los CSV de datos medidos, con validación zod por fila y errores con número de línea.
 * Acepta coma o punto y coma como separador (con punto y coma, la coma puede ser el decimal).
 */
import { z } from 'zod';
import type { Observacion } from './logistica';

export const TIPOS_PACIENTE = ['primera_vez', 'control', 'espontaneo', 'urgencia'] as const;
export type TipoPaciente = (typeof TIPOS_PACIENTE)[number];
export const NOMBRES_TIPO: Record<TipoPaciente, string> = { primera_vez: 'Primera vez', control: 'Control', espontaneo: 'Espontáneo', urgencia: 'Urgencia' };

export interface TiempoMedido {
  profesional: string;
  tipo: TipoPaciente;
  duracion: number;
}

export interface ErrorCSV {
  linea: number;
  campo: string;
  mensaje: string;
}

export type LecturaCSV<T> = { ok: true; filas: T[]; advertencias: string[] } | { ok: false; errores: ErrorCSV[] };

export const PLANTILLA_TIEMPOS = 'profesional,tipo,duracion_min\nclinica,control,14.5\nclinica,primera_vez,27\npediatria,espontaneo,12.8\n';
export const PLANTILLA_ASISTENCIA = 'anticipacion_dias,asistio\n1,1\n14,0\n7,1\n';

const numero = (s: string, decimalComa: boolean): number => {
  const t = s.trim();
  if (t === '') return NaN;
  return Number(decimalComa ? t.replace(/\./g, '').replace(',', '.') : t);
};

function partir(texto: string): { encabezado: string[]; filas: { linea: number; celdas: string[] }[]; decimalComa: boolean } {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const primera = lineas.findIndex((l) => l.trim() !== '');
  if (primera === -1) return { encabezado: [], filas: [], decimalComa: false };
  const sep = lineas[primera]!.includes(';') ? ';' : ',';
  const encabezado = lineas[primera]!.split(sep).map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ''));
  const filas: { linea: number; celdas: string[] }[] = [];
  for (let i = primera + 1; i < lineas.length; i++) {
    if (lineas[i]!.trim() === '') continue;
    filas.push({ linea: i + 1, celdas: lineas[i]!.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')) });
  }
  return { encabezado, filas, decimalComa: sep === ';' };
}

function columna(encabezado: string[], nombres: string[]): number {
  return encabezado.findIndex((c) => nombres.includes(c));
}

const EsquemaTiempo = z.object({
  profesional: z.string().min(1, 'falta el profesional'),
  tipo: z.enum(TIPOS_PACIENTE, { message: `el tipo tiene que ser uno de: ${TIPOS_PACIENTE.join(', ')}` }),
  duracion: z.number({ message: 'la duración tiene que ser un número' }).finite('la duración tiene que ser un número').positive('la duración tiene que ser mayor que 0').max(600, 'más de 10 horas: revisá la unidad (minutos)'),
});

const EsquemaAsistencia = z.object({
  anticipacion: z.number({ message: 'la anticipación tiene que ser un número' }).finite('la anticipación tiene que ser un número').min(0, 'la anticipación no puede ser negativa').max(365, 'más de un año de anticipación: revisá la unidad (días)'),
  asistio: z.union([z.literal(0), z.literal(1)], { message: 'asistió tiene que ser 0 o 1' }),
});

function errorEncabezado(faltan: string[]): LecturaCSV<never> {
  return { ok: false, errores: [{ linea: 1, campo: 'encabezado', mensaje: `faltan las columnas: ${faltan.join(', ')}` }] };
}

/** CSV de tiempos de atención: profesional, tipo, duracion_min. */
export function leerTiempos(texto: string): LecturaCSV<TiempoMedido> {
  const { encabezado, filas, decimalComa } = partir(texto);
  const cp = columna(encabezado, ['profesional', 'medico', 'médico']);
  const ct = columna(encabezado, ['tipo', 'tipo_paciente', 'clase']);
  const cd = columna(encabezado, ['duracion_min', 'duracion', 'duración', 'minutos']);
  const faltan = [cp < 0 && 'profesional', ct < 0 && 'tipo', cd < 0 && 'duracion_min'].filter((x): x is string => !!x);
  if (faltan.length) return errorEncabezado(faltan);
  const errores: ErrorCSV[] = [];
  const out: TiempoMedido[] = [];
  for (const { linea, celdas } of filas) {
    const tipo = (celdas[ct] ?? '').toLowerCase().replace(/\s+/g, '_').replace('é', 'e').replace('á', 'a');
    const r = EsquemaTiempo.safeParse({ profesional: celdas[cp] ?? '', tipo, duracion: numero(celdas[cd] ?? '', decimalComa) });
    if (r.success) out.push(r.data);
    else for (const i of r.error.issues) errores.push({ linea, campo: String(i.path[0] ?? ''), mensaje: i.message });
  }
  if (errores.length) return { ok: false, errores };
  if (out.length < 2) return { ok: false, errores: [{ linea: 1, campo: 'archivo', mensaje: 'hacen falta al menos 2 filas de datos' }] };
  return { ok: true, filas: out, advertencias: [] };
}

/** CSV de asistencia: anticipacion_dias, asistio (0/1). */
export function leerAsistencia(texto: string): LecturaCSV<Observacion> {
  const { encabezado, filas, decimalComa } = partir(texto);
  const ca = columna(encabezado, ['anticipacion_dias', 'anticipacion', 'anticipación', 'dias']);
  const cs = columna(encabezado, ['asistio', 'asistió', 'asistencia']);
  const faltan = [ca < 0 && 'anticipacion_dias', cs < 0 && 'asistio'].filter((x): x is string => !!x);
  if (faltan.length) return errorEncabezado(faltan);
  const errores: ErrorCSV[] = [];
  const out: Observacion[] = [];
  for (const { linea, celdas } of filas) {
    const r = EsquemaAsistencia.safeParse({ anticipacion: numero(celdas[ca] ?? '', decimalComa), asistio: numero(celdas[cs] ?? '', decimalComa) });
    if (r.success) out.push(r.data);
    else for (const i of r.error.issues) errores.push({ linea, campo: String(i.path[0] ?? ''), mensaje: i.message });
  }
  if (errores.length) return { ok: false, errores };
  if (out.length < 3) return { ok: false, errores: [{ linea: 1, campo: 'archivo', mensaje: 'hacen falta al menos 3 filas de datos' }] };
  return { ok: true, filas: out, advertencias: [] };
}

export function tiemposACSV(filas: readonly TiempoMedido[]): string {
  return 'profesional,tipo,duracion_min\n' + filas.map((f) => `${f.profesional},${f.tipo},${f.duracion}`).join('\n') + '\n';
}

export function asistenciaACSV(filas: readonly Observacion[]): string {
  return 'anticipacion_dias,asistio\n' + filas.map((f) => `${f.anticipacion},${f.asistio}`).join('\n') + '\n';
}
