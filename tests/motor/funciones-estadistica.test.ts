import { describe, expect, it } from 'vitest';
import {
  AcumuladorMuestral,
  AcumuladorTiempo,
  acumuladaNormal,
  cuantilT,
  intervaloConfianza,
  inversaNormal,
  mediaMovilWelch,
  nivelBonferroni,
} from '../../src/motor';

describe('funciones especiales', () => {
  it('Φ y Φ⁻¹ coinciden con valores de tabla', () => {
    expect(acumuladaNormal(0)).toBeCloseTo(0.5, 7);
    expect(acumuladaNormal(1.959964)).toBeCloseTo(0.975, 6);
    expect(acumuladaNormal(-1)).toBeCloseTo(0.158655, 6);
    expect(inversaNormal(0.975)).toBeCloseTo(1.959964, 6);
    expect(inversaNormal(0.5)).toBeCloseTo(0, 9);
    expect(inversaNormal(0.001)).toBeCloseTo(-3.090232, 6);
  });

  it('Φ⁻¹ es la inversa de Φ', () => {
    for (const p of [0.01, 0.1, 0.3, 0.7, 0.9, 0.99]) expect(acumuladaNormal(inversaNormal(p))).toBeCloseTo(p, 6);
  });

  it('cuantil t de Student (tabla)', () => {
    expect(cuantilT(0.975, 29)).toBeCloseTo(2.04523, 3);
    expect(cuantilT(0.975, 10)).toBeCloseTo(2.228139, 3);
    expect(cuantilT(0.995, 29)).toBeCloseTo(2.756386, 3);
  });
});

describe('estadística', () => {
  it('Welford: media y varianza muestral', () => {
    const a = new AcumuladorMuestral();
    for (const x of [2, 4, 4, 4, 5, 5, 7, 9]) a.agregar(x);
    expect(a.media).toBe(5);
    expect(a.varianza).toBeCloseTo(32 / 7, 12);
    expect(a.min).toBe(2);
    expect(a.max).toBe(9);
  });

  it('promedio ponderado por tiempo de una función escalonada', () => {
    // x = 0 en [0,2), 3 en [2,5), 1 en [5,10] → ∫ = 0·2 + 3·3 + 1·5 = 14
    const x = new AcumuladorTiempo(0, 0);
    x.registrar(2, 3);
    x.registrar(5, 1);
    expect(x.integral(10)).toBe(14);
    expect(x.media(10)).toBeCloseTo(1.4, 12);
    expect(x.max).toBe(3);
    x.reiniciar(6); // fin de calentamiento: queda x = 1 desde t = 6
    expect(x.media(10)).toBe(1);
  });

  it('IC con t de Student', () => {
    const ic = intervaloConfianza([1, 2, 3, 4, 5]);
    expect(ic.media).toBe(3);
    // t(0,975; 4) = 2,776445; con ν = 4 la expansión de Cornish-Fisher pierde precisión (2 decimales)
    expect(ic.semiancho).toBeCloseTo((2.776445 * Math.sqrt(2.5)) / Math.sqrt(5), 1);
  });

  it('Bonferroni: 18 comparaciones al 95 % conjunto → 99,72 % cada una', () => {
    expect(nivelBonferroni(0.95, 18)).toBeCloseTo(1 - 0.05 / 18, 12);
  });

  it('media móvil de Welch', () => {
    expect(mediaMovilWelch([[1, 2, 3, 4, 5], [3, 4, 5, 6, 7]], 1)).toEqual([2, 3, 4, 5]);
  });
});
