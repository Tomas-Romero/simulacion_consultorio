/**
 * Traza autocontenida → datos de animación. TypeScript puro (sin DOM): se prueba con Vitest.
 * Nada se re-simula: todos los tiempos salen de la traza del modelo.
 */
import type { Clase, MotivoPerdida, PacienteTraza } from '../../modelo';
import type { ResultadoCorrida } from '../simulacion/corrida';

export interface SlotAgenda {
  inicio: number;
  esCupo: boolean;
  /** Ids de los pacientes con turno o sobreturno a esa hora (vacío si es cupo o slot libre). */
  pacientes: number[];
}

export interface ProfesionalAnim {
  idx: number;
  id: string;
  nombre: string;
  especialidad: string;
  inicioTurno: number;
  finTurno: number;
  llegada: number;
  salida: number;
  duracionTurno: number;
  cOcio: number;
  cExtra: number;
  slots: SlotAgenda[];
  /** Sobreturnos con política `final` (después del último slot). */
  alFinal: number[];
  /** Consultas en orden: [inicio, fin, idPaciente]. */
  consultas: { inicio: number; fin: number; paciente: number }[];
}

export interface PacienteAnim {
  id: number;
  clase: Clase;
  origen: PacienteTraza['origen'];
  urgencia: boolean;
  ausente: boolean;
  resultado: PacienteTraza['resultado'];
  motivo: MotivoPerdida | null;
  horaTurno: number | null;
  llegada: number;
  inicioAdmision: number | null;
  finAdmision: number | null;
  inicioConsulta: number | null;
  finConsulta: number | null;
  salida: number | null;
  espera: number | null;
  /** Índice del profesional del turno (−1 para espontáneos). */
  profTurno: number;
  /** Índice del profesional que lo atendió (−1 si no lo atendieron). */
  consultorio: number;
  /** Puesto de admisión (0 o 1; −1 si no pasó por admisión). */
  puesto: number;
  /** Silla de la sala asignada al entrar (estable mientras espera); −1 si nunca estuvo en la sala. */
  silla: number;
  /** Paciencia [min] (solo espontáneos no urgentes que abandonan si esperan demasiado). */
  paciencia: number | null;
  /** Rechazado en la puerta (fuera de horario, sin profesional o tardío rechazado). */
  rechazado: boolean;
}

export interface DatosAnimacion {
  corrida: ResultadoCorrida;
  profesionales: ProfesionalAnim[];
  pacientes: PacienteAnim[];
  /** Pacientes ordenados por llegada (para recorrer en el dibujo). */
  porLlegada: PacienteAnim[];
  recepcionistas: number;
  tolerancia: number;
  /** Ventana visible de la animación [min desde 00:00]. */
  tInicio: number;
  tFin: number;
  /** Sillas usadas a la vez como máximo (para dimensionar la sala). */
  sillasMax: number;
}

const RECHAZOS: ReadonlySet<MotivoPerdida> = new Set(['fuera_de_horario', 'sin_profesional', 'tardio_rechazado']);

export function prepararAnimacion(corrida: ResultadoCorrida): DatosAnimacion {
  const { traza, escenario } = corrida;
  const idxProf = new Map(traza.profesionales.map((p, i) => [p.id, i]));

  // Puesto de admisión de cada paciente (los registros de inicio de servicio traen la unidad).
  const puesto = new Map<number, number>();
  for (const r of traza.registros) {
    if (r.tipo === 'inicio_servicio' && r.etapa === 'admision' && r.unidad !== undefined) puesto.set(r.entidad, r.unidad);
  }

  const pacientes: PacienteAnim[] = traza.pacientes.map((p) => {
    const urgente = p.urgencia;
    return {
      id: p.id,
      clase: p.claseFinal,
      origen: p.origen,
      urgencia: urgente,
      ausente: p.ausente,
      resultado: p.resultado,
      motivo: p.motivoPerdida,
      horaTurno: p.horaTurno,
      llegada: p.llegada,
      inicioAdmision: p.inicioAdmision,
      finAdmision: p.finAdmision,
      inicioConsulta: p.inicioConsulta,
      finConsulta: p.finConsulta,
      salida: p.salida,
      espera: p.espera,
      profTurno: p.profesionalTurno === null ? -1 : (idxProf.get(p.profesionalTurno) ?? -1),
      consultorio: p.atendidoPor === null ? -1 : (idxProf.get(p.atendidoPor) ?? -1),
      puesto: puesto.get(p.id) ?? -1,
      silla: -1,
      paciencia: p.origen === 'espontaneo' && !urgente && escenario.espontaneos.abandonan ? (corrida.paciencia[p.id] ?? null) : null,
      rechazado: p.motivoPerdida !== null && RECHAZOS.has(p.motivoPerdida),
    };
  });

  // Sillas: cada paciente toma la silla libre de menor número al entrar a la sala y la conserva.
  const estadias = pacientes
    .filter((p) => p.finAdmision !== null && !p.ausente)
    .map((p) => ({ p, desde: p.finAdmision!, hasta: p.inicioConsulta ?? p.salida ?? p.finAdmision! }))
    .filter((e) => e.hasta > e.desde)
    .sort((a, b) => a.desde - b.desde || a.p.id - b.p.id);
  const libreDesde: number[] = [];
  for (const e of estadias) {
    let s = libreDesde.findIndex((t) => t <= e.desde);
    if (s < 0) {
      s = libreDesde.length;
      libreDesde.push(0);
    }
    libreDesde[s] = e.hasta;
    e.p.silla = s;
  }

  const profesionales: ProfesionalAnim[] = traza.profesionales.map((tp, i) => {
    const cfg = escenario.profesionales[i]!;
    const D = cfg.duracionTurno;
    const cupos = corrida.esCupo[i] ?? [];
    const slots: SlotAgenda[] = cupos.map((esCupo, j) => ({ inicio: tp.inicioTurno + j * D, esCupo, pacientes: [] }));
    const alFinal: number[] = [];
    for (const p of pacientes) {
      if (p.profTurno !== i || p.horaTurno === null) continue;
      const j = Math.floor((p.horaTurno - tp.inicioTurno) / D + 1e-9);
      if (j >= 0 && j < slots.length) slots[j]!.pacientes.push(p.id);
      else alFinal.push(p.id);
    }
    const consultas = pacientes
      .filter((p) => p.consultorio === i && p.inicioConsulta !== null && p.finConsulta !== null)
      .map((p) => ({ inicio: p.inicioConsulta!, fin: p.finConsulta!, paciente: p.id }))
      .sort((a, b) => a.inicio - b.inicio);
    return {
      idx: i,
      id: tp.id,
      nombre: tp.nombre,
      especialidad: tp.especialidad,
      inicioTurno: tp.inicioTurno,
      finTurno: tp.finTurno,
      llegada: tp.llegada,
      salida: tp.salida,
      duracionTurno: D,
      cOcio: corrida.cOcio[i] ?? 0,
      cExtra: corrida.cExtra[i] ?? 0,
      slots,
      alFinal,
      consultas,
    };
  });

  const presentes = pacientes.filter((p) => !p.ausente);
  const primera = Math.min(escenario.jornada.inicio, ...presentes.map((p) => p.llegada));
  const ultima = Math.max(escenario.jornada.fin, ...presentes.map((p) => p.salida ?? p.llegada), ...profesionales.map((p) => p.salida));
  return {
    corrida,
    profesionales,
    pacientes,
    porLlegada: [...presentes].sort((a, b) => a.llegada - b.llegada || a.id - b.id),
    recepcionistas: escenario.admision.recepcionistas,
    tolerancia: escenario.puntualidad.tolerancia,
    tInicio: Math.floor((primera - 10) / 15) * 15,
    tFin: Math.ceil((ultima + 10) / 15) * 15,
    sillasMax: libreDesde.length,
  };
}
