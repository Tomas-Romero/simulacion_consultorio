/**
 * Validación del motor contra la teoría de colas (Erlang C) y la Ley de Little.
 * R = 30 réplicas por caso. Criterio de aprobación: cada valor teórico dentro
 * del IC simultáneo al 95 % conjunto (Bonferroni sobre las 18 comparaciones).
 * El veredicto con IC 95 % individual se imprime en la tabla.
 */
import { describe, expect, it } from 'vitest';
import { CASOS_VALIDACION, REPLICAS_VALIDACION, TOLERANCIA_LITTLE, validarCaso } from '../../src/motor';

describe.each(CASOS_VALIDACION)('$nombre', (caso) => {
  const res = validarCaso(caso);

  it(`calentamiento ≥ 10 tiempos de relajación y medición ≥ 200`, () => {
    expect(caso.calentamientoHoras).toBeGreaterThanOrEqual(10 * res.tiempoRelajacionHoras);
    expect(caso.duracionHoras).toBeGreaterThanOrEqual(200 * res.tiempoRelajacionHoras);
  });

  for (const clave of ['rho', 'pEspera', 'Lq', 'L', 'Wq', 'W'] as const) {
    it(`${clave}: valor teórico dentro del IC simulado (R = ${REPLICAS_VALIDACION})`, () => {
      const m = res.comparaciones.find((x) => x.clave === clave)!;
      console.log(
        `${caso.id} ${m.nombre}: teórico ${m.teorico.toFixed(4)} | IC95 [${m.ic.inferior.toFixed(4)}, ${m.ic.superior.toFixed(4)}] ` +
          `${m.dentro ? 'dentro' : 'FUERA'} | IC simultáneo [${m.icSimultaneo.inferior.toFixed(4)}, ${m.icSimultaneo.superior.toFixed(4)}] | z = ${m.z.toFixed(2)}`,
      );
      expect(m.dentroSimultaneo).toBe(true);
    });
  }

  it(`Ley de Little en cada réplica: L = λW y Lq = λWq (error relativo < ${TOLERANCIA_LITTLE * 100} %)`, () => {
    expect(res.little).toHaveLength(REPLICAS_VALIDACION);
    for (const l of res.little) {
      expect(l.errorL).toBeLessThan(TOLERANCIA_LITTLE);
      expect(l.errorLq).toBeLessThan(TOLERANCIA_LITTLE);
    }
  });
});
