/** Modelo fluido de la jornada: conserva pacientes, no da stocks negativos y con capacidad holgada no forma cola. */
import { describe, expect, it } from 'vitest';
import { PRESET_POLICONSULTORIO_3, probabilidadNoShow, prepararEscenario } from '../../src/modelo';
import { modeloFluido } from '../../src/dinamica';

describe('modelo fluido de la jornada', () => {
  it('los pacientes que entran a la sala coinciden con los turnos esperados que vienen más los espontáneos admitidos', () => {
    const e = PRESET_POLICONSULTORIO_3;
    const f = modeloFluido(e);
    const prep = prepararEscenario(e);
    const tabla = e.pacientes.anticipacion;
    const pBar = tabla.reduce((s, x) => s + x.frecuencia * probabilidadNoShow(e, x.valor), 0) / tabla.reduce((s, x) => s + x.frecuencia, 0);
    const turnos = prep.esCupo.reduce((s, c) => s + c.filter((x) => !x).length, 0) * (1 - pBar);
    const espontaneos = e.espontaneos.tasasPorHora.reduce((s, t) => s + t, 0);
    expect(f.pacientes).toBeGreaterThan(turnos);
    expect(f.pacientes).toBeLessThan(turnos + espontaneos);
    expect(Math.min(...f.sala)).toBeGreaterThanOrEqual(0);
    expect(f.sala.at(-1)).toBeCloseTo(0, 6);
  });

  it('con poca demanda la sala queda vacía casi todo el día (el fluido no ve la variabilidad)', () => {
    const e = { ...PRESET_POLICONSULTORIO_3, espontaneos: { ...PRESET_POLICONSULTORIO_3.espontaneos, tasasPorHora: PRESET_POLICONSULTORIO_3.espontaneos.tasasPorHora.map(() => 0) } };
    const f = modeloFluido(e);
    const conCola = f.sala.filter((v) => v > 0.05).length / f.sala.length;
    expect(conCola).toBeLessThan(0.2);
  });

  it('más sobreturnos → más espera en el fluido', () => {
    const conK = (k: number) => modeloFluido({ ...PRESET_POLICONSULTORIO_3, profesionales: PRESET_POLICONSULTORIO_3.profesionales.map((p) => ({ ...p, sobreturnos: { k, politica: 'intercalado' as const } })) });
    expect(conK(3).area).toBeGreaterThan(conK(0).area);
  });
});
