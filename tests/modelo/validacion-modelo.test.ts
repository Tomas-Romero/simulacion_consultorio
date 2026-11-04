/**
 * Validación del modelo del consultorio (paso #2):
 * a) determinista · b) M/G/1 · c) red en serie (Burke/Jackson) · d) conservación y Little · e) casos límite.
 */
import { describe, expect, it } from 'vitest';
import {
  ESCENARIO_POR_DEFECTO,
  EsquemaEscenario,
  PRESETS,
  PRESET_CENTRO_6,
  PRESET_CONSULTORIO_CHICO,
  escenarioDeterminista,
  prepararEscenario,
  simularDia,
  validarJackson,
  validarMG1,
  type ComparacionModelo,
  type Escenario,
  type ResultadoDia,
} from '../../src/modelo';

function verificarConservacion(res: ResultadoDia): void {
  const m = res.metricas;
  expect(m.llegadas).toBe(m.atendidosTotal + m.perdidosTotal + m.ausentes);
  expect(res.verificacion).toEqual({ enSistemaAlFinal: 0, sinResolver: 0, eventosPendientes: 0, profesionalesSinRetirar: 0 });
  // Little sobre el día, con el sistema vacío al inicio y al final: L = λ·W
  if (m.little.n > 0) expect(Math.abs(m.little.L - m.little.lambda * m.little.W)).toBeLessThan(1e-9 * Math.max(1, m.little.L));
}

describe('a) caso determinista', () => {
  for (const conAdmision of [false, true]) {
    it(conAdmision ? 'con admisión constante de 3 min y llegada 5 min antes' : 'sin admisión y llegada exacta', () => {
      const prep = prepararEscenario(escenarioDeterminista(conAdmision));
      const res = simularDia(prep, { semilla: 1, traza: true });
      const m = res.metricas;
      // 18 turnos de 20 min (mañana) + 12 de 30 min (tarde)
      expect(m.atendidosTotal).toBe(30);
      expect(m.ausentes).toBe(0);
      expect(m.espera.todas.max).toBe(0);
      expect(m.esperaAdmision.max).toBe(0);
      expect(m.ocio).toBe(0);
      expect(m.horasExtra).toBe(0);
      for (const p of res.pacientes) expect(p.inicioConsulta).toBe(p.horaTurno);
      expect(m.porProfesional.map((p) => p.salida)).toEqual([840, 1200]);
      expect(m.utilizacionMedicos).toBe(1);
      verificarConservacion(res);
    });
  }
});

function imprimir(comparaciones: ComparacionModelo[]): void {
  for (const c of comparaciones) {
    console.log(
      `${c.medida}: teórico ${c.teorico.toFixed(4)} | media ${c.ic.media.toFixed(4)} | IC95 [${c.ic.inferior.toFixed(4)}, ${c.ic.superior.toFixed(4)}] ` +
        `${c.dentro ? 'dentro' : 'FUERA'} | IC simultáneo [${c.icSimultaneo.inferior.toFixed(4)}, ${c.icSimultaneo.superior.toFixed(4)}] | z = ${c.z.toFixed(2)}`,
    );
  }
}

describe('b) M/G/1 contra Pollaczek-Khinchine', () => {
  it('Wq dentro del IC (R = 30, criterio Bonferroni)', () => {
    const v = validarMG1();
    imprimir(v.comparaciones);
    for (const c of v.comparaciones) expect(c.dentroSimultaneo).toBe(true);
  });
});

describe('c) red en serie: admisión M/M/1 → consultorios M/M/3 (Burke)', () => {
  it('Wq de admisión, Wq del consultorio y espera total dentro del IC', () => {
    const v = validarJackson();
    imprimir(v.comparaciones);
    for (const c of v.comparaciones) expect(c.dentroSimultaneo).toBe(true);
  });
});

describe('d) conservación y Ley de Little', () => {
  for (const escenario of PRESETS) {
    it(`${escenario.nombre}: llegadas = atendidos + perdidos + ausentes, nadie colgado (100 días)`, () => {
      const prep = prepararEscenario(escenario);
      for (let r = 0; r < 100; r++) verificarConservacion(simularDia(prep, { semilla: 99, replica: r }));
    });
  }
});

function variante(base: Escenario, cambios: (e: Escenario) => Partial<Escenario>): Escenario {
  return EsquemaEscenario.parse({ ...base, ...cambios(base) });
}

describe('e) casos límite', () => {
  it('k = 0: no hay sobreturnos', () => {
    const e = variante(ESCENARIO_POR_DEFECTO, (b) => ({ profesionales: b.profesionales.map((p) => ({ ...p, sobreturnos: { ...p.sobreturnos, k: 0 } })) }));
    const res = simularDia(prepararEscenario(e), { semilla: 3 });
    expect(res.pacientes.some((p) => p.origen === 'sobreturno')).toBe(false);
    expect(res.metricas.atendidos.sobreturno).toBe(0);
    verificarConservacion(res);
  });

  it('100 % de ausentismo y sin espontáneos: el médico queda ocioso todo el turno', () => {
    const e = variante(ESCENARIO_POR_DEFECTO, (b) => ({
      ausentismo: { beta0: 50, beta1: 0 },
      espontaneos: { ...b.espontaneos, tasasPorHora: b.espontaneos.tasasPorHora.map(() => 0) },
    }));
    const res = simularDia(prepararEscenario(e), { semilla: 3 });
    expect(res.metricas.atendidosTotal).toBe(0);
    expect(res.metricas.ausentes).toBe(res.metricas.llegadas);
    for (const p of res.metricas.porProfesional) {
      expect(p.ocio).toBeCloseTo(p.finTurno - p.llegada, 9);
      expect(p.horasExtra).toBe(0);
    }
    // C es solo ocio (con el c_ocio derivado de cada profesional) y B = 0: no hay ingresos ni otros costos.
    const costoOcio = res.metricas.porProfesional.reduce((s, p) => s + p.cOcio * p.ocio, 0);
    expect(res.metricas.costos.total).toBeCloseTo(costoOcio, 6);
    expect(res.metricas.beneficio).toBe(0);
    verificarConservacion(res);
  });

  it('1 y 6 profesionales funcionan y conservan pacientes', () => {
    for (const e of [PRESET_CONSULTORIO_CHICO, PRESET_CENTRO_6]) {
      const prep = prepararEscenario(e);
      const res = simularDia(prep, { semilla: 4 });
      expect(res.metricas.porProfesional).toHaveLength(e.profesionales.length);
      verificarConservacion(res);
    }
  });

  it('paciencia 0: ningún espontáneo no urgente espera; el que no se atiende en el acto abandona', () => {
    const e = variante(ESCENARIO_POR_DEFECTO, (b) => ({ espontaneos: { ...b.espontaneos, paciencia: { tipo: 'constante', valor: 0 } } }));
    const prep = prepararEscenario(e);
    let abandonos = 0;
    for (let r = 0; r < 20; r++) {
      const res = simularDia(prep, { semilla: 5, replica: r });
      abandonos += res.metricas.perdidos.abandono;
      for (const p of res.pacientes.filter((x) => x.claseFinal === 'espontaneo' && x.resultado === 'atendido')) {
        expect(p.esperaAdmision).toBe(0);
        expect(p.inicioConsulta).toBe(p.finAdmision);
      }
      verificarConservacion(res);
    }
    expect(abandonos).toBeGreaterThan(0);
  });

  it('sin espontáneos: solo pacientes con turno', () => {
    const e = variante(ESCENARIO_POR_DEFECTO, (b) => ({ espontaneos: { ...b.espontaneos, tasasPorHora: b.espontaneos.tasasPorHora.map(() => 0) } }));
    const res = simularDia(prepararEscenario(e), { semilla: 6 });
    expect(res.pacientes.every((p) => p.origen !== 'espontaneo')).toBe(true);
    expect(res.metricas.perdidos.sin_profesional + res.metricas.perdidos.fuera_de_horario + res.metricas.perdidos.abandono).toBe(0);
    verificarConservacion(res);
  });

  it('política "final" con k creciente: las horas extra medias crecen (R = 30, números comunes)', () => {
    const medias = [0, 2, 4, 8, 12].map((k) => {
      const e = variante(ESCENARIO_POR_DEFECTO, (b) => ({ profesionales: b.profesionales.map((p) => ({ ...p, sobreturnos: { k, politica: 'final' as const } })) }));
      const prep = prepararEscenario(e);
      let suma = 0;
      for (let r = 0; r < 30; r++) {
        const res = simularDia(prep, { semilla: 7, replica: r });
        verificarConservacion(res);
        suma += res.metricas.horasExtra;
      }
      return suma / 30;
    });
    console.log(`horas extra medias [min/día] para k = 0, 2, 4, 8, 12 (final): ${medias.map((x) => x.toFixed(1)).join(', ')}`);
    for (let i = 1; i < medias.length; i++) expect(medias[i]!).toBeGreaterThan(medias[i - 1]!);
  });
});
