/**
 * #6 · Cierre de la dinámica de sistemas: D₀ calibrado al consultorio del estudio, estabilidad de
 * los equilibrios y análisis de sensibilidad de a un parámetro por vez.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  analisisSensibilidad,
  anticipacionMediaTabla,
  ausentismo,
  balance,
  capacidad,
  demandaCalibrada,
  equilibrio,
  equilibrios,
  NIVELES_SENSIBILIDAD,
  parametrosBase,
  simularLista,
  tablaDesdeEstudio,
  type ParametrosLista,
} from '../../src/dinamica';

const tb = tablaDesdeEstudio(JSON.parse(readFileSync('public/resultados/estudio.json', 'utf8')));
const estable = (cambios: Partial<ParametrosLista> = {}): ParametrosLista => ({ ...parametrosBase(), pico: null, ...cambios });

describe('D₀ calibrado al consultorio del estudio', () => {
  it('el equilibrio sin sobreturnos reproduce la anticipación media del modelo del día (11,95 días) y su ausentismo', () => {
    const prm = estable();
    const eq = equilibrio(prm, 0);
    expect(eq.a).toBeCloseTo(anticipacionMediaTabla(prm), 8);
    expect(eq.p).toBeCloseTo(0.14705, 4);
    expect(eq.saturado).toBe(true);
    expect(Math.abs(balance(prm, 0, prm.demandaBase, eq.a))).toBeLessThan(1e-9);
  });

  it('es el único equilibrio y es estable; la integración vuelve a él desde lejos', () => {
    const prm = estable({ horizonteSemanas: 80 });
    const eqs = equilibrios(prm, 0);
    expect(eqs).toHaveLength(1);
    expect(eqs[0]!.estable).toBe(true);
    const L = eqs[0]!.L;
    for (const L0 of [0.5 * L, 1.5 * L]) {
      const tr = simularLista(prm, tb, { tipo: 'fija', k: 0 }, { dt: 0.25, metodo: 'rk4', L0 });
      expect(tr.L.at(-1)! / L).toBeCloseTo(1, 3);
    }
  });

  it('sin desaliento a esa anticipación (u = 14 días) el estado de hoy es un equilibrio inestable entre dos estables', () => {
    const prm = estable({ desaliento: { umbral: 14, ancho: 14, maximo: 0.6 } });
    const D = demandaCalibrada(prm);
    expect(D / capacidad(prm, 0)).toBeCloseTo(1 - 0.5 * ausentismo(prm, 11.95), 10);
    const eqs = equilibrios(prm, 0, D);
    expect(eqs.map((e) => e.estable)).toEqual([true, false, true]);
    expect(eqs[1]!.a).toBeCloseTo(11.95, 6);
    expect(eqs[0]!.a).toBeLessThan(1);
    expect(eqs[2]!.a).toBeGreaterThan(14);
  });

  it('los equilibrios encontrados son raíces de g y su estabilidad coincide con el signo de la pendiente', () => {
    for (const k of [0, 1, 2, 4])
      for (const e of equilibrios(estable(), k)) {
        expect(Math.abs(balance(estable(), k, estable().demandaBase, e.a))).toBeLessThan(1e-8);
        expect(e.estable).toBe(e.pendiente < 0);
      }
  });
});

describe('sensibilidad de a un parámetro por vez', () => {
  const filas = analisisSensibilidad(parametrosBase(), tb, 2);

  it('cubre los 5 parámetros × 3 niveles y marca un nivel base por parámetro', () => {
    expect(filas).toHaveLength(15);
    for (const p of Object.keys(NIVELES_SENSIBILIDAD)) expect(filas.filter((f) => f.parametro === p && f.esBase)).toHaveLength(1);
  });

  it('todas las variantes arrancan en el consultorio de hoy (a = 11,95 días)', () => {
    for (const f of filas) {
      expect(f.a0).toBeCloseTo(11.95, 10);
      expect(Number.isFinite(f.demandaRelativa)).toBe(true);
    }
  });

  it('las filas base coinciden entre sí y la diferencia es adaptativo − k fijo', () => {
    const base = filas.filter((f) => f.esBase);
    for (const f of base) expect(f.difBeneficio).toBeCloseTo(base[0]!.difBeneficio, 6);
    for (const f of filas) expect(f.difBeneficio).toBeCloseTo(f.politicas[2].beneficio - f.politicas[1].beneficio, 6);
  });

  it('un pico más grande o más largo agranda la ventaja del adaptativo en beneficio', () => {
    const dif = (p: string, v: number): number => filas.find((f) => f.parametro === p && f.valor === v)!.difBeneficio;
    expect(dif('aumento', 0.5)).toBeGreaterThan(dif('aumento', 0.3));
    expect(dif('aumento', 0.3)).toBeGreaterThanOrEqual(dif('aumento', 0.15));
    expect(dif('duracion', 10)).toBeGreaterThan(dif('duracion', 6));
    expect(dif('duracion', 6)).toBeGreaterThan(dif('duracion', 3));
  });
});
