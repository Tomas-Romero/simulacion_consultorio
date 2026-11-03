import { describe, expect, it } from 'vitest';
import { teoriaMMc, tiempoRelajacion } from '../../src/motor';

describe('Erlang C (valores calculados a mano)', () => {
  it('M/M/1, ρ = 0,5: L = 1, Lq = 0,5, W = 0,5 h, Wq = 0,25 h', () => {
    const t = teoriaMMc({ lambda: 2, mu: 4, c: 1 });
    expect(t.rho).toBe(0.5);
    expect(t.pEspera).toBeCloseTo(0.5, 12);
    expect(t.L).toBeCloseTo(1, 12);
    expect(t.Lq).toBeCloseTo(0.5, 12);
    expect(t.W).toBeCloseTo(0.5, 12);
    expect(t.Wq).toBeCloseTo(0.25, 12);
  });

  it('M/M/1, ρ = 0,9: L = 9, Lq = 8,1, W = 2,5 h', () => {
    const t = teoriaMMc({ lambda: 3.6, mu: 4, c: 1 });
    expect(t.L).toBeCloseTo(9, 10);
    expect(t.Lq).toBeCloseTo(8.1, 10);
    expect(t.W).toBeCloseTo(2.5, 10);
  });

  it('M/M/3, λ = 10/h, μ = 4/h: P0 = 1/22,25, C = 15,625/22,25', () => {
    // a = 2,5; Σ_{n<3} aⁿ/n! = 6,625; a³/3!/(1−ρ) = 2,6041667/(1/6) = 15,625
    const t = teoriaMMc({ lambda: 10, mu: 4, c: 3 });
    expect(t.rho).toBeCloseTo(10 / 12, 12);
    expect(t.P0).toBeCloseTo(1 / 22.25, 12);
    expect(t.pEspera).toBeCloseTo(15.625 / 22.25, 12);
    expect(t.Lq).toBeCloseTo(((15.625 / 22.25) * (10 / 12)) / (2 / 12), 12);
    expect(t.L).toBeCloseTo(t.Lq + 2.5, 12);
    expect(t.L).toBeCloseTo(10 * t.W, 12); // Little
  });

  it('rechaza sistemas inestables', () => {
    expect(() => teoriaMMc({ lambda: 5, mu: 4, c: 1 })).toThrow();
  });

  it('tiempo de relajación M/M/1, ρ = 0,9 ≈ 94,9 h', () => {
    expect(tiempoRelajacion({ lambda: 3.6, mu: 4, c: 1 })).toBeCloseTo(94.93, 2);
  });
});
