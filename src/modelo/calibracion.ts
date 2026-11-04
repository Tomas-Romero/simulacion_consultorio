/**
 * Calibración de la situación inicial (k = 0): metas fijadas a priori y su
 * medición sobre muchos días. Ver docs/calibracion.md.
 */
import type { Escenario } from './escenario';
import { prepararEscenario } from './preparar';
import { simularDia } from './simulacion';

/** Metas de la situación inicial, fijadas ANTES de calibrar (mensaje #2b). */
export const METAS_CALIBRACION = {
  utilizacion: { min: 0.8, max: 0.88 },
  ausentismo: { min: 0.12, max: 0.18 },
  esperaTurno: { min: 5, max: 15 },
  horasExtraPorMedico: { max: 20 },
  abandono: { max: 0.05 },
} as const;

export interface IndicadoresSituacion {
  dias: number;
  /** Media diaria de (minutos atendiendo / minutos presentes), todos los médicos juntos. */
  utilizacion: number;
  /** Ausentes / pacientes con turno reservado (sobre todos los días). */
  ausentismo: number;
  /** Media de la espera de los pacientes con turno atendidos (sobre todos los días). */
  esperaTurno: number;
  /** Media diaria de horas extra totales / cantidad de médicos [min]. */
  horasExtraPorMedico: number;
  /** Abandonos / espontáneos que entraron al policonsultorio (sobre todos los días). */
  abandono: number;
  /** Indicadores complementarios (no son metas). */
  ocioPorMedico: number;
  espontaneosPorDia: number;
  sinProfesionalPorDia: number;
  fueraDeHorarioPorDia: number;
  costoMedio: number;
  /** Espera media de los espontáneos no urgentes atendidos [min]. */
  esperaEspontaneo: number;
  /** Fracción de los abandonos según dónde ocurrieron: cola de admisión, al salir de admisión (paciencia agotada durante la atención) o sala. */
  abandonosPorEtapa: { colaAdmision: number; finAdmision: number; sala: number };
}

export function evaluarSituacion(escenario: Escenario, dias: number, semilla: number): IndicadoresSituacion {
  const prep = prepararEscenario(escenario);
  const nMedicos = escenario.profesionales.length;
  let util = 0, extra = 0, ocio = 0, costo = 0;
  let turnos = 0, ausentes = 0, sumaEsperaTurno = 0, nEsperaTurno = 0;
  let espEntraron = 0, abandonos = 0, espTotal = 0, sinProf = 0, fuera = 0;
  let sumaEsperaEsp = 0, nEsperaEsp = 0;
  const etapas = { colaAdmision: 0, finAdmision: 0, sala: 0 };
  for (let r = 0; r < dias; r++) {
    const { metricas: m, pacientes } = simularDia(prep, { semilla, replica: r, serie: false });
    util += m.utilizacionMedicos;
    extra += m.horasExtra / nMedicos;
    ocio += m.ocio / nMedicos;
    costo += m.costos.total;
    for (const p of pacientes) {
      if (p.origen === 'turno') {
        turnos++;
        if (p.ausente) ausentes++;
        if (p.resultado === 'atendido' && p.claseFinal === 'turno') {
          sumaEsperaTurno += p.espera!;
          nEsperaTurno++;
        }
      } else if (p.origen === 'espontaneo') {
        espTotal++;
        if (p.motivoPerdida === 'sin_profesional') sinProf++;
        else if (p.motivoPerdida === 'fuera_de_horario') fuera++;
        else {
          espEntraron++;
          if (p.motivoPerdida === 'abandono') {
            abandonos++;
            if (p.finAdmision === null) etapas.colaAdmision++;
            else if (p.finAdmision === p.salida) etapas.finAdmision++;
            else etapas.sala++;
          } else if (p.resultado === 'atendido' && p.claseFinal === 'espontaneo') {
            sumaEsperaEsp += p.espera!;
            nEsperaEsp++;
          }
        }
      }
    }
  }
  return {
    dias,
    utilizacion: util / dias,
    ausentismo: turnos > 0 ? ausentes / turnos : 0,
    esperaTurno: nEsperaTurno > 0 ? sumaEsperaTurno / nEsperaTurno : 0,
    horasExtraPorMedico: extra / dias,
    abandono: espEntraron > 0 ? abandonos / espEntraron : 0,
    ocioPorMedico: ocio / dias,
    espontaneosPorDia: espTotal / dias,
    sinProfesionalPorDia: sinProf / dias,
    fueraDeHorarioPorDia: fuera / dias,
    costoMedio: costo / dias,
    esperaEspontaneo: nEsperaEsp > 0 ? sumaEsperaEsp / nEsperaEsp : 0,
    abandonosPorEtapa: {
      colaAdmision: abandonos > 0 ? etapas.colaAdmision / abandonos : 0,
      finAdmision: abandonos > 0 ? etapas.finAdmision / abandonos : 0,
      sala: abandonos > 0 ? etapas.sala / abandonos : 0,
    },
  };
}

/** Qué metas cumple cada indicador. */
export function cumpleMetas(i: IndicadoresSituacion): Record<keyof typeof METAS_CALIBRACION, boolean> {
  const M = METAS_CALIBRACION;
  return {
    utilizacion: i.utilizacion >= M.utilizacion.min && i.utilizacion <= M.utilizacion.max,
    ausentismo: i.ausentismo >= M.ausentismo.min && i.ausentismo <= M.ausentismo.max,
    esperaTurno: i.esperaTurno >= M.esperaTurno.min && i.esperaTurno <= M.esperaTurno.max,
    horasExtraPorMedico: i.horasExtraPorMedico < M.horasExtraPorMedico.max,
    abandono: i.abandono < M.abandono.max,
  };
}
