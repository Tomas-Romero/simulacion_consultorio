/**
 * Corrección 1b (mezcla renormalizada sobre las especialidades presentes) y
 * regresión de la calibración de los presets (docs/calibracion.md).
 */
import { describe, expect, it } from 'vitest';
import {
  ESPECIALIDADES,
  EsquemaEscenario,
  PRESETS,
  PRESET_CONSULTORIO_CHICO,
  PRESET_POLICONSULTORIO_3,
  cumpleMetas,
  evaluarSituacion,
  prepararEscenario,
  simularDia,
  type Especialidad,
} from '../../src/modelo';

describe('mezcla de espontáneos renormalizada sobre las especialidades presentes', () => {
  it('policonsultorio: solo piden clínica o pediatría, y "sin_profesional" es solo pediatría a la tarde', () => {
    const prep = prepararEscenario(PRESET_POLICONSULTORIO_3);
    let clinica = 0;
    let total = 0;
    let sinProfesional = 0;
    for (let r = 0; r < 200; r++) {
      for (const p of simularDia(prep, { semilla: 31, replica: r }).pacientes.filter((x) => x.origen === 'espontaneo')) {
        expect(['clinica', 'pediatria']).toContain(p.especialidad);
        total++;
        if (p.especialidad === 'clinica') clinica++;
        if (p.motivoPerdida === 'sin_profesional') {
          sinProfesional++;
          expect(p.especialidad).toBe('pediatria');
          expect(p.llegada).toBeGreaterThanOrEqual(PRESET_POLICONSULTORIO_3.jornada.cambioTurno);
        }
      }
    }
    expect(sinProfesional).toBeGreaterThan(0);
    // Proporción de clínica: 55 / (55 + 25) = 0,6875; IC 99,9 % binomial
    const p = 55 / 80;
    expect(Math.abs(clinica / total - p)).toBeLessThan(3.29 * Math.sqrt((p * (1 - p)) / total));
  });

  it('si ninguna especialidad presente tiene peso, se reparte en partes iguales entre las presentes', () => {
    const soloAusentes = Object.fromEntries(ESPECIALIDADES.map((e) => [e, e === 'traumatologia' ? 1 : 0])) as Record<Especialidad, number>;
    const e = EsquemaEscenario.parse({ ...PRESET_CONSULTORIO_CHICO, espontaneos: { ...PRESET_CONSULTORIO_CHICO.espontaneos, mezcla: soloAusentes } });
    expect(prepararEscenario(e).mezclaAcumulada).toEqual([{ especialidad: 'clinica', acumulada: 1 }]);
    const res = simularDia(prepararEscenario(e), { semilla: 1 });
    expect(res.pacientes.filter((p) => p.origen === 'espontaneo').every((p) => p.especialidad === 'clinica')).toBe(true);
    expect(res.metricas.perdidos.sin_profesional).toBe(0);
  });

  it('la acumulada solo contiene especialidades presentes y termina en 1', () => {
    for (const e of PRESETS) {
      const m = prepararEscenario(e).mezclaAcumulada;
      const presentes = new Set(e.profesionales.map((p) => p.especialidad));
      expect(m.every((x) => presentes.has(x.especialidad))).toBe(true);
      expect(m[m.length - 1]!.acumulada).toBe(1);
    }
  });
});

describe('calibración de la situación inicial (regresión)', () => {
  it('los presets parten de k = 0', () => {
    for (const e of PRESETS) expect(e.profesionales.every((p) => p.sobreturnos.k === 0)).toBe(true);
  });

  it.each(PRESETS.map((e) => [e.nombre, e] as const))('%s cumple las metas alcanzables (1000 días, semilla de verificación)', (_, e) => {
    const c = cumpleMetas(evaluarSituacion(e, 1000, 2026200));
    // El abandono (< 5 %) queda fuera de meta por construcción: ver docs/calibracion.md.
    expect({ ...c, abandono: true }).toEqual({ utilizacion: true, ausentismo: true, esperaTurno: true, horasExtraPorMedico: true, abandono: true });
  });
});
