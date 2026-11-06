/** Parte 0: regla con corrección (datos sintéticos de resultado conocido) y perfiles del mecanismo. */
import { describe, expect, it } from 'vitest';
import { PRESET_CONSULTORIO_CHICO, PRESET_POLICONSULTORIO_3, iniciosCupos, prepararEscenario, simularDia } from '../../src/modelo';
import { ajustarRegla, espontaneosExcedentes, evaluarRegla, kDeRegla, perfilDia, validacionDejandoUnoAfuera, type ConfigRegla } from '../../src/experimentos';

const KS = [0, 1, 2, 3, 4, 5, 6];
/** B diario = −(k − k*)² · 10 000 + ruido común: el óptimo es k* y la diferencia pareada no tiene ruido. */
function sintetica(preset: string, p: number, N: number, e: number, kVerdad: number): ConfigRegla {
  const ruido = Float64Array.from({ length: 50 }, (_, r) => Math.sin(r * 3.1) * 1e5);
  const Bs = KS.map((k) => Float64Array.from(ruido, (z) => z - (k - kVerdad) ** 2 * 10_000));
  return { preset, p, N, e, ks: KS, Bs, kHat: kVerdad, conjunto: [kVerdad] };
}
const verdad = (p: number, N: number, e: number): number => Math.max(0, Math.min(6, Math.round(1.0 * p * N - 0.8 * e)));

describe('regla práctica con corrección por demanda espontánea', () => {
  const configs = [
    ...[0.1, 0.2, 0.3].map((p) => sintetica('A', p, 20, 0.5, verdad(p, 20, 0.5))),
    ...[0.1, 0.2, 0.3].map((p) => sintetica('B', p, 18, 2, verdad(p, 18, 2))),
    ...[0.1, 0.2, 0.3].map((p) => sintetica('C', p, 22, 1.2, verdad(p, 22, 1.2))),
  ];

  it('kDeRegla recorta al rango simulado', () => {
    expect(kDeRegla({ tipo: 'ingenua' }, { p: 0.5, N: 20, e: 0, ks: KS })).toBe(6);
    expect(kDeRegla({ tipo: 'alfaBeta', alfa: 1, beta: 5 }, { p: 0.1, N: 10, e: 1, ks: KS })).toBe(0);
  });

  it('si la verdad es k = round(α·p̄·N̄ − β·ē), el ajuste de dos parámetros la recupera sin pérdida', () => {
    const r = ajustarRegla('alfaBeta', configs);
    const ev = evaluarRegla(r, configs);
    expect(ev.perdida.media).toBe(0);
    expect(ev.aciertos).toBe(configs.length);
  });

  it('la validación dejando uno afuera evalúa cada escenario con reglas ajustadas sin él', () => {
    const loo = validacionDejandoUnoAfuera(configs);
    expect(loo.pliegues.map((p) => p.afuera)).toEqual(['A', 'B', 'C']);
    for (const p of loo.pliegues) {
      expect(p.reglas.map((r) => r.nombre)).toEqual(['ingenua', 'alfa', 'alfaBeta']);
      expect(p.reglas[2]!.evaluacion.total).toBe(3);
    }
  });

  it('espontáneos por profesional: en el consultorio chico, todos los de la mañana van al único clínico', () => {
    const x = espontaneosExcedentes(PRESET_CONSULTORIO_CHICO);
    const cierre = PRESET_CONSULTORIO_CHICO.espontaneos.cierreAntesDelFin;
    const tasas = PRESET_CONSULTORIO_CHICO.espontaneos.tasasPorHora;
    const total = tasas.reduce((s, t) => s + t, 0) - (tasas[5]! * cierre) / 60;
    expect(x.lambda[0]).toBeCloseTo(total, 6);
    expect(x.media).toBeCloseTo(Math.max(0, total - x.cupos[0]!), 6);
  });
});

describe('perfiles del mecanismo', () => {
  it('el ocio y los abandonos por franja suman lo mismo que las métricas del día; los cupos usados no superan a los disponibles', () => {
    const e = PRESET_POLICONSULTORIO_3;
    const prep = prepararEscenario(e);
    const cupos = prep.esCupo.map((c, i) => iniciosCupos(c, e.profesionales[i]!.duracionTurno));
    for (let r = 0; r < 10; r++) {
      const res = simularDia(prep, { semilla: 5, replica: r, traza: true });
      const p = perfilDia(res.traza!, cupos);
      expect(p.ocio.reduce((s, v) => s + v, 0)).toBeCloseTo(res.metricas.ocio, 6);
      expect(p.abandonos.reduce((s, v) => s + v, 0)).toBe(res.metricas.perdidos.abandono);
      expect(p.cuposUsados.reduce((s, v) => s + v, 0)).toBeLessThanOrEqual(cupos.reduce((s, c) => s + c.length, 0));
    }
  });
});
