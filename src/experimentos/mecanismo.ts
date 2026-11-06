/**
 * Parte 0.2 · Mecanismo de las políticas: perfiles por franja de 30 min a partir de las trazas
 * (ocio del médico, espera de los pacientes con turno, llegada y abandono de espontáneos, uso de
 * cupos, sobreturnos y huecos de ausentes). Números aleatorios comunes: réplica r = (semilla, r).
 */
import { iniciosCupos, prepararEscenario, simularDia, type Escenario, type TrazaDia } from '../modelo';
import { ic, type IC } from './analisis';

export const FRANJA = 30;
export const DESDE = 7 * 60;
export const HASTA = 21 * 60;
export const N_FRANJAS = (HASTA - DESDE) / FRANJA;

export const MEDIDAS_PERFIL = ['ocio', 'esperaTurnoSuma', 'esperaTurnoN', 'llegadasEsp', 'abandonos', 'cuposUsados', 'sobreturnosAtendidos', 'ausentes'] as const;
export type MedidaPerfil = (typeof MEDIDAS_PERFIL)[number];
export type Perfil = Record<MedidaPerfil, Float64Array>;

const franja = (t: number): number => Math.floor((t - DESDE) / FRANJA);
const nuevoPerfil = (): Perfil => Object.fromEntries(MEDIDAS_PERFIL.map((m) => [m, new Float64Array(N_FRANJAS)])) as Perfil;
const sumar = (a: Float64Array, t: number, v = 1): void => {
  const i = franja(t);
  if (i >= 0 && i < N_FRANJAS) a[i] = a[i]! + v;
};
/** Reparte un intervalo [a, b) entre las franjas que toca. */
function sumarIntervalo(arr: Float64Array, a: number, b: number): void {
  for (let i = Math.max(0, franja(a)); i <= Math.min(N_FRANJAS - 1, franja(b)); i++) {
    const ini = DESDE + i * FRANJA;
    const v = Math.max(0, Math.min(b, ini + FRANJA) - Math.max(a, ini));
    arr[i] = arr[i]! + v;
  }
}

/**
 * Perfil de un día. El uso de cupos se reconstruye con la regla del modelo: un espontáneo (no
 * urgente) que empieza su consulta cuando el profesional tiene deuda de cupos > 0 consume un cupo.
 */
export function perfilDia(traza: TrazaDia, cupos: number[][]): Perfil {
  const p = nuevoPerfil();
  traza.profesionales.forEach((prof, i) => {
    // Ocio: presente dentro del turno y sin paciente (misma definición que el modelo).
    const consultas = traza.pacientes
      .filter((x) => x.atendidoPor === prof.id && x.inicioConsulta !== null)
      .map((x) => [x.inicioConsulta!, x.finConsulta!] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let cursor = prof.llegada;
    const fin = Math.min(prof.finTurno, prof.salida);
    for (const [a, b] of consultas) {
      if (a > cursor) sumarIntervalo(p.ocio, cursor, Math.min(a, fin));
      cursor = Math.max(cursor, b);
      if (cursor >= fin) break;
    }
    if (cursor < fin) sumarIntervalo(p.ocio, cursor, fin);
    // Cupos usados.
    const iniciosAbs = cupos[i]!.map((m) => prof.inicioTurno + m);
    const espontaneos = traza.pacientes.filter((x) => x.atendidoPor === prof.id && x.claseFinal === 'espontaneo' && x.inicioConsulta !== null).sort((a, b) => a.inicioConsulta! - b.inicioConsulta!);
    let usados = 0;
    for (const x of espontaneos) {
      const vencidos = iniciosAbs.filter((c) => c <= x.inicioConsulta!).length;
      if (vencidos - usados > 0) {
        usados++;
        sumar(p.cuposUsados, x.inicioConsulta!);
      }
    }
  });
  for (const x of traza.pacientes) {
    if (x.origen === 'espontaneo') {
      if (!x.urgencia) sumar(p.llegadasEsp, x.llegada);
      if (x.motivoPerdida === 'abandono' && x.salida !== null) sumar(p.abandonos, x.salida);
      continue;
    }
    if (x.ausente && x.horaTurno !== null) sumar(p.ausentes, x.horaTurno);
    if (x.resultado === 'atendido' && x.horaTurno !== null && x.espera !== null) {
      sumar(p.esperaTurnoSuma, x.horaTurno, x.espera);
      sumar(p.esperaTurnoN, x.horaTurno);
    }
    if (x.origen === 'sobreturno' && x.inicioConsulta !== null) sumar(p.sobreturnosAtendidos, x.inicioConsulta);
  }
  return p;
}

export interface PerfilResumido {
  /** Inicio de cada franja [min desde 00:00]. */
  t: number[];
  /** Medias por día de cada medida (la espera es la media por paciente con turno de la franja). */
  ocio: number[];
  esperaTurno: number[];
  llegadasEsp: number[];
  abandonos: number[];
  cuposUsados: number[];
  sobreturnosAtendidos: number[];
  ausentes: number[];
  /** Totales por día con IC 95 %. */
  totales: { ocio: IC; esperaTurno: IC; abandonos: IC; cuposUsados: IC; horasExtra: IC; beneficio: IC };
  R: number;
}

/** Perfiles medios de R días de una configuración. */
export function perfilesMedios(e: Escenario, semilla: number, R: number): PerfilResumido {
  const prep = prepararEscenario(e);
  const cupos = prep.esCupo.map((c, i) => iniciosCupos(c, e.profesionales[i]!.duracionTurno));
  const acc = nuevoPerfil();
  const tot = { ocio: new Float64Array(R), esperaTurno: new Float64Array(R), abandonos: new Float64Array(R), cuposUsados: new Float64Array(R), horasExtra: new Float64Array(R), beneficio: new Float64Array(R) };
  for (let r = 0; r < R; r++) {
    const res = simularDia(prep, { semilla, replica: r, traza: true, serie: false });
    const p = perfilDia(res.traza!, cupos);
    for (const m of MEDIDAS_PERFIL) p[m].forEach((v, i) => (acc[m][i] = acc[m][i]! + v));
    tot.ocio[r] = res.metricas.ocio;
    tot.esperaTurno[r] = res.metricas.espera.turno.n > 0 ? res.metricas.espera.turno.media : 0;
    tot.abandonos[r] = res.metricas.perdidos.abandono;
    tot.cuposUsados[r] = p.cuposUsados.reduce((s, v) => s + v, 0);
    tot.horasExtra[r] = res.metricas.horasExtra;
    tot.beneficio[r] = res.metricas.beneficio;
  }
  const porDia = (a: Float64Array): number[] => Array.from(a, (v) => v / R);
  return {
    t: Array.from({ length: N_FRANJAS }, (_, i) => DESDE + i * FRANJA),
    ocio: porDia(acc.ocio),
    esperaTurno: Array.from(acc.esperaTurnoSuma, (v, i) => (acc.esperaTurnoN[i]! > 0 ? v / acc.esperaTurnoN[i]! : 0)),
    llegadasEsp: porDia(acc.llegadasEsp),
    abandonos: porDia(acc.abandonos),
    cuposUsados: porDia(acc.cuposUsados),
    sobreturnosAtendidos: porDia(acc.sobreturnosAtendidos),
    ausentes: porDia(acc.ausentes),
    totales: { ocio: ic(tot.ocio), esperaTurno: ic(tot.esperaTurno), abandonos: ic(tot.abandonos), cuposUsados: ic(tot.cuposUsados), horasExtra: ic(tot.horasExtra), beneficio: ic(tot.beneficio) },
    R,
  };
}
