/**
 * Costo de hora extra coherente (#2d): `{ derivado: factor }` = factor × c_ocio de cada profesional.
 */
import { describe, expect, it } from 'vitest';
import { ESCENARIO_POR_DEFECTO, EsquemaEscenario, prepararEscenario, simularDia } from '../../src/modelo';

describe('costo de hora extra', () => {
  it('derivado: c_extra = 1,5 × c_ocio de cada profesional (y por eso c_extra ≥ c_ocio)', () => {
    const prep = prepararEscenario(ESCENARIO_POR_DEFECTO);
    ESCENARIO_POR_DEFECTO.profesionales.forEach((_, i) => {
      expect(prep.cExtra[i]).toBeCloseTo(1.5 * prep.cOcio[i]!, 9);
      expect(prep.cExtra[i]!).toBeGreaterThanOrEqual(prep.cOcio[i]!);
    });
    // D = 15 → c_ocio = 30 000 / 13,875 = 2 162,16 $/min → c_extra = 3 243,24 $/min
    expect(prep.cExtra[0]).toBeCloseTo(3243.24, 2);
  });

  it('un número fijo se usa tal cual; el factor por defecto es 1,5 y no puede ser menor que 1', () => {
    const fijo = prepararEscenario({ ...ESCENARIO_POR_DEFECTO, costos: { ...ESCENARIO_POR_DEFECTO.costos, extra: 750 } });
    expect(fijo.cExtra).toEqual([750, 750, 750]);
    const porDefecto = EsquemaEscenario.parse({ ...ESCENARIO_POR_DEFECTO, costos: { ...ESCENARIO_POR_DEFECTO.costos, extra: {} } });
    expect(porDefecto.costos.extra).toEqual({ derivado: 1.5 });
    const incoherente = EsquemaEscenario.safeParse({ ...ESCENARIO_POR_DEFECTO, costos: { ...ESCENARIO_POR_DEFECTO.costos, extra: { derivado: 0.5 } } });
    expect(incoherente.success).toBe(false);
  });

  it('en las métricas, el costo de extra de cada profesional es c_extra × sus horas extra y el del día es la suma', () => {
    const prep = prepararEscenario(ESCENARIO_POR_DEFECTO);
    let conExtra = 0;
    for (let r = 0; r < 30; r++) {
      const m = simularDia(prep, { semilla: 99, replica: r }).metricas;
      for (const [i, p] of m.porProfesional.entries()) {
        expect(p.cExtra).toBe(prep.cExtra[i]);
        expect(p.costos.extra).toBeCloseTo(p.cExtra * p.horasExtra, 6);
        if (p.horasExtra > 0) conExtra++;
      }
      expect(m.costos.extra).toBeCloseTo(m.porProfesional.reduce((s, p) => s + p.costos.extra, 0), 6);
    }
    expect(conExtra).toBeGreaterThan(0);
  });
});
