/**
 * Preparación de un escenario: se valida una sola vez con zod y se construyen
 * las distribuciones. Lo preparado se reutiliza en miles de réplicas (paso #4)
 * sin volver a validar.
 */
import {
  PoissonNoHomogeneo,
  empiricaDiscreta,
  exponencial,
  lognormal,
  normalTruncada,
  triangular,
  uniforme,
  type Distribucion,
  type FuenteUniforme,
} from '../motor';
import { ESPECIALIDADES, EsquemaEscenario, type DistribucionTiempo, type EntradaEscenario, type Escenario, type Especialidad, type Profesional } from './escenario';

export function constante(valor: number): Distribucion {
  return { nombre: `Constante(${valor})`, media: valor, varianza: 0, muestrear: () => valor };
}

export function construirDistribucion(d: DistribucionTiempo): Distribucion {
  switch (d.tipo) {
    case 'constante':
      return constante(d.valor);
    case 'uniforme':
      return uniforme(d.min, d.max);
    case 'triangular':
      return triangular(d.min, d.moda, d.max);
    case 'exponencial':
      return exponencial(d.media);
    case 'normal_truncada':
      return normalTruncada(d.media, d.desvio, d.min, d.max);
    case 'lognormal':
      return lognormal(d.media, d.cv);
  }
}

/**
 * Fuente que entrega siempre el mismo uniforme ya sorteado. Permite muestrear
 * cualquier distribución (incluida la constante, que no consume) gastando
 * exactamente UN uniforme del flujo del paciente, en un orden fijo.
 */
export class UniformeFijo implements FuenteUniforme {
  u = 0.5;
  uniforme(): number {
    return this.u;
  }
}

export interface TurnoProfesional {
  inicio: number;
  fin: number;
}

export interface EscenarioPreparado {
  readonly escenario: Escenario;
  readonly turnos: readonly TurnoProfesional[];
  readonly demoras: readonly Distribucion[];
  readonly anticipacion: Distribucion;
  readonly puntualidad: Distribucion;
  readonly tiempoAdmision: Distribucion;
  readonly paciencia: Distribucion;
  /** Factor de atención de media 1: tiempo de atención = factor × factor de clase × D. */
  readonly factorAtencion: Distribucion;
  readonly espontaneos: PoissonNoHomogeneo | null;
  readonly inicioEspontaneos: number;
  readonly finEspontaneos: number;
  /** Mezcla renormalizada sobre las especialidades presentes, como acumulada (orden fijo de ESPECIALIDADES). */
  readonly mezclaAcumulada: readonly { especialidad: Especialidad; acumulada: number }[];
  /** Cantidad de slots de la agenda de cada profesional: ⌊(fin − inicio) / D⌋. */
  readonly slots: readonly number[];
  /** esCupo[i][j]: el slot j del profesional i es un cupo de demanda espontánea. */
  readonly esCupo: readonly (readonly boolean[])[];
  /** Costo de ocio efectivo de cada profesional [$/min] (fijo o derivado). */
  readonly cOcio: readonly number[];
}

export function probabilidadNoShow(escenario: Escenario, dias: number): number {
  const { beta0, beta1 } = escenario.ausentismo;
  return 1 / (1 + Math.exp(-(beta0 + beta1 * dias)));
}

/** El slot j es cupo de demanda espontánea si j mod N = ⌊N/2⌋ (equiespaciados, el primero a mitad del primer bloque). */
export function esSlotCupo(j: number, cadaN: number): boolean {
  return cadaN > 0 && j % cadaN === Math.floor(cadaN / 2);
}

/** Duración media de las consultas con turno de un profesional: D · (p·f₁ + (1 − p)·f_c) [min]. */
export function duracionMediaConsulta(escenario: Escenario, p: Profesional): number {
  const { proporcionPrimeraVez: pv, atencion } = escenario.pacientes;
  return p.duracionTurno * (pv * atencion.factorPrimeraVez + (1 - pv) * atencion.factorControl);
}

/**
 * Costo de ocio de cada profesional. Si es 'derivado', es el costo de oportunidad: lo que
 * se deja de facturar por minuto ocioso = honorario / duración media de sus consultas.
 */
export function costoOcio(escenario: Escenario, p: Profesional): number {
  const c = escenario.costos.ocio;
  return c === 'derivado' ? escenario.costos.honorario / duracionMediaConsulta(escenario, p) : c;
}

export function prepararEscenario(entrada: EntradaEscenario | Escenario): EscenarioPreparado {
  const escenario = EsquemaEscenario.parse(entrada);
  const { jornada, pacientes, espontaneos } = escenario;
  const turnos = escenario.profesionales.map((p) =>
    p.turno === 'manana' ? { inicio: jornada.inicio, fin: jornada.cambioTurno } : { inicio: jornada.cambioTurno, fin: jornada.fin },
  );
  const slots = escenario.profesionales.map((p, i) => Math.floor((turnos[i]!.fin - turnos[i]!.inicio) / p.duracionTurno));
  const { atencion } = pacientes;
  const factorAtencion =
    atencion.familia === 'lognormal' ? lognormal(1, atencion.cv) : atencion.familia === 'exponencial' ? exponencial(1) : constante(1);

  const hayEspontaneos = espontaneos.tasasPorHora.some((t) => t > 0);
  const inicioEspontaneos = jornada.inicio;
  const finEspontaneos = jornada.inicio + 60 * espontaneos.tasasPorHora.length;
  const proceso = hayEspontaneos
    ? new PoissonNoHomogeneo(
        espontaneos.tasasPorHora.map((tasa, i) => ({ desde: inicioEspontaneos + 60 * i, hasta: inicioEspontaneos + 60 * (i + 1), tasa: tasa / 60 })),
      )
    : null;

  // La mezcla se renormaliza sobre las especialidades presentes en el escenario: un espontáneo
  // solo pide especialidades que el policonsultorio ofrece. Si ninguna presente tiene peso, se
  // reparte en partes iguales entre las presentes.
  const presentes = ESPECIALIDADES.filter((e) => escenario.profesionales.some((p) => p.especialidad === e));
  const pesosPresentes = presentes.map((e) => espontaneos.mezcla[e] ?? 0);
  const total = pesosPresentes.reduce((a, b) => a + b, 0);
  const pesos = total > 0 ? pesosPresentes : presentes.map(() => 1);
  const totalUsado = total > 0 ? total : presentes.length;
  let suma = 0;
  const mezclaAcumulada = presentes.map((especialidad, i) => {
    suma += pesos[i]!;
    return { especialidad, acumulada: i === presentes.length - 1 ? 1 : suma / totalUsado };
  });

  return {
    escenario,
    turnos,
    demoras: escenario.profesionales.map((p) => construirDistribucion(p.demoraInicio)),
    anticipacion: empiricaDiscreta(pacientes.anticipacion),
    puntualidad: construirDistribucion(escenario.puntualidad.desvio),
    tiempoAdmision: construirDistribucion(escenario.admision.tiempo),
    paciencia: construirDistribucion(espontaneos.paciencia),
    factorAtencion,
    espontaneos: proceso,
    inicioEspontaneos,
    finEspontaneos,
    mezclaAcumulada,
    slots,
    esCupo: escenario.profesionales.map((p, i) => Array.from({ length: slots[i]! }, (_, j) => esSlotCupo(j, p.cuposEspontaneos.cadaN))),
    cOcio: escenario.profesionales.map((p) => costoOcio(escenario, p)),
  };
}
