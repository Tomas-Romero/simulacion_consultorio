/**
 * Validación del modelo de dinámica de sistemas de la lista de espera: equilibrio analítico,
 * conservación de pacientes, consistencia con el modelo del día, monotonía y convergencia numérica.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  anticipacionMediaTabla,
  ausentismo,
  equilibrio,
  errorConservacion,
  parametrosBase,
  simularLista,
  tablaDesdeEstudio,
  type ParametrosLista,
} from '../../src/dinamica';

const tb = tablaDesdeEstudio(JSON.parse(readFileSync('public/resultados/estudio.json', 'utf8')));
const estable = (cambios: Partial<ParametrosLista> = {}): ParametrosLista => ({ ...parametrosBase(), pico: null, ...cambios });

describe('modelo de la lista de espera', () => {
  it('con la anticipación media de la tabla reproduce el ausentismo medio del modelo del día', () => {
    const prm = estable();
    expect(anticipacionMediaTabla(prm)).toBeCloseTo(11.95, 10);
    expect(ausentismo(prm, anticipacionMediaTabla(prm))).toBeCloseTo(0.14705, 4);
  });

  it('equilibrio: con demanda constante converge al equilibrio analítico desde lejos (abajo y arriba)', () => {
    const prm = estable({ horizonteSemanas: 120 });
    const eq = equilibrio(prm, 0);
    for (const L0 of [0.3 * eq.L, 2 * eq.L]) {
      const tr = simularLista(prm, tb, { tipo: 'fija', k: 0 }, { dt: 0.25, metodo: 'rk4', L0 });
      expect(tr.L[tr.L.length - 1]! / eq.L).toBeCloseTo(1, 4);
    }
  });

  it('el estado de equilibrio es estacionario: arrancando en L* no se mueve', () => {
    const prm = estable({ horizonteSemanas: 20 });
    const eq = equilibrio(prm, 0);
    const tr = simularLista(prm, tb, { tipo: 'fija', k: 0 }, { dt: 0.25, metodo: 'rk4', L0: eq.L });
    expect(Math.max(...tr.L.map((v) => Math.abs(v - eq.L)))).toBeLessThan(1e-6 * eq.L);
  });

  it('conservación: L + atendidos + ausentes perdidos + desalentados = L0 + demanda acumulada', () => {
    for (const metodo of ['euler', 'rk4'] as const)
      for (const politica of [{ tipo: 'fija' as const, k: 0 }, { tipo: 'fija' as const, k: 3 }, { tipo: 'adaptativa' as const }]) {
        const tr = simularLista(parametrosBase(), tb, politica, { dt: 0.5, metodo });
        expect(errorConservacion(tr)).toBeLessThan(1e-7);
      }
  });

  it('consistencia: la anticipación de equilibrio con la demanda base cae dentro de la tabla del modelo del día', () => {
    const prm = estable();
    const eq = equilibrio(prm, 0);
    const dias = prm.anticipacion.map((f) => f.valor);
    expect(eq.saturado).toBe(true);
    expect(eq.a).toBeGreaterThanOrEqual(Math.min(...dias));
    expect(eq.a).toBeLessThanOrEqual(Math.max(...dias));
  });

  it('monotonía: más demanda → más lista de espera (en equilibrio y en toda la trayectoria)', () => {
    const base = estable({ horizonteSemanas: 30 });
    const factores = [0.95, 1, 1.05, 1.1];
    const Ls = factores.map((f) => equilibrio({ ...base, demandaBase: base.demandaBase * f }, 0).L);
    for (let i = 1; i < Ls.length; i++) expect(Ls[i]!).toBeGreaterThan(Ls[i - 1]!);
    const L0 = equilibrio(base, 0).L;
    const trs = factores.map((f) => simularLista({ ...base, demandaBase: base.demandaBase * f }, tb, { tipo: 'fija', k: 0 }, { L0 }));
    for (let i = 1; i < trs.length; i++) trs[i]!.L.forEach((v, t) => expect(v).toBeGreaterThanOrEqual(trs[i - 1]!.L[t]! - 1e-9));
  });

  it('convergencia numérica: el error de Euler baja con dt (orden 1) y RK4 es mucho más preciso', () => {
    const prm = parametrosBase();
    const ref = simularLista(prm, tb, { tipo: 'fija', k: 2 }, { dt: 0.01, metodo: 'rk4' });
    const fin = (dt: number, metodo: 'euler' | 'rk4'): number => Math.abs(simularLista(prm, tb, { tipo: 'fija', k: 2 }, { dt, metodo }).L.at(-1)! - ref.L.at(-1)!);
    const e1 = fin(1, 'euler');
    const e025 = fin(0.25, 'euler');
    const e01 = fin(0.1, 'euler');
    expect(e025).toBeLessThan(e1);
    expect(e01).toBeLessThan(e025);
    expect(fin(0.25, 'rk4')).toBeLessThan(e01);
  });
});
