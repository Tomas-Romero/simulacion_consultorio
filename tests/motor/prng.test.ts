import { describe, expect, it } from 'vitest';
import { FabricaFlujos, Xoshiro128, splitmix32 } from '../../src/motor';

describe('xoshiro128**', () => {
  it('reproduce el vector de referencia del algoritmo (estado [1, 2, 3, 4])', () => {
    const g = new Xoshiro128([1, 2, 3, 4]);
    const salida = Array.from({ length: 10 }, () => g.siguienteUint32());
    expect(salida).toEqual([11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597, 4258142804]);
  });

  it('la misma semilla reproduce la misma secuencia', () => {
    const a = Xoshiro128.desdeSemilla(2026);
    const b = Xoshiro128.desdeSemilla(2026);
    const sa = Array.from({ length: 1000 }, () => a.uniforme());
    const sb = Array.from({ length: 1000 }, () => b.uniforme());
    expect(sa).toEqual(sb);
  });

  it('semillas distintas dan secuencias distintas', () => {
    const a = Xoshiro128.desdeSemilla(1);
    const b = Xoshiro128.desdeSemilla(2);
    const iguales = Array.from({ length: 1000 }, () => a.siguienteUint32() === b.siguienteUint32()).filter(Boolean).length;
    expect(iguales).toBeLessThan(3);
  });

  it('los uniformes caen en el intervalo abierto (0, 1)', () => {
    const g = Xoshiro128.desdeSemilla(7);
    for (let i = 0; i < 100_000; i++) {
      const u = g.uniforme();
      expect(u > 0 && u < 1).toBe(true);
    }
  });

  it('clonar copia el estado: ambos siguen la misma secuencia', () => {
    const g = Xoshiro128.desdeSemilla(99);
    for (let i = 0; i < 10; i++) g.uniforme();
    const h = g.clonar();
    expect(Array.from({ length: 50 }, () => g.uniforme())).toEqual(Array.from({ length: 50 }, () => h.uniforme()));
  });

  it('rechaza el estado todo ceros', () => {
    expect(() => new Xoshiro128([0, 0, 0, 0])).toThrow();
  });

  it('splitmix32 es determinista', () => {
    expect(splitmix32(0)).toEqual(splitmix32(0));
    expect(splitmix32(0)[1]).not.toBe(splitmix32(1)[1]);
  });
});

describe('flujos independientes (base de los números aleatorios comunes)', () => {
  it('misma semilla y réplica → mismos flujos', () => {
    const f1 = new FabricaFlujos(123, 4);
    const f2 = new FabricaFlujos(123, 4);
    for (const nombre of ['llegadas', 'servicio', 'ausentismo', 'puntualidad']) {
      const a = f1.flujo(nombre);
      const b = f2.flujo(nombre);
      expect(Array.from({ length: 200 }, () => a.uniforme())).toEqual(Array.from({ length: 200 }, () => b.uniforme()));
    }
  });

  it('un flujo no depende del orden de creación ni de cuánto se usaron los otros', () => {
    const f1 = new FabricaFlujos(123);
    const servicio1 = f1.flujo('servicio');
    const f2 = new FabricaFlujos(123);
    const llegadas2 = f2.flujo('llegadas');
    for (let i = 0; i < 5000; i++) llegadas2.uniforme(); // el escenario 2 consume más llegadas
    f2.flujo('nueva_fuente'); // y tiene una fuente extra
    const servicio2 = f2.flujo('servicio');
    expect(Array.from({ length: 100 }, () => servicio1.uniforme())).toEqual(Array.from({ length: 100 }, () => servicio2.uniforme()));
  });

  it('flujos distintos y réplicas distintas no coinciden', () => {
    const f = new FabricaFlujos(123, 0);
    const a = f.flujo('llegadas').siguienteUint32();
    const b = f.flujo('servicio').siguienteUint32();
    const c = new FabricaFlujos(123, 1).flujo('llegadas').siguienteUint32();
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('dos flujos de la misma réplica no están correlacionados (|r| < 4/√n)', () => {
    const f = new FabricaFlujos(2026);
    const a = f.flujo('llegadas');
    const b = f.flujo('servicio');
    const n = 200_000;
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let i = 0; i < n; i++) {
      const x = a.uniforme();
      const y = b.uniforme();
      sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
    }
    const r = (sab / n - (sa / n) * (sb / n)) / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2));
    expect(Math.abs(r)).toBeLessThan(4 / Math.sqrt(n));
  });
});
