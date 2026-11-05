/**
 * Reproducibilidad del motor de experimentos: el resultado es idéntico bit a bit con cualquier
 * cantidad de hilos y en cualquier orden de llegada, y extender R da lo mismo que correrlo de una.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { PRESET_POLICONSULTORIO_3 } from '../../src/modelo';
import { aplicarNivel, crearSerie, crearSimulador, EjecutorLocal, extenderSeries, huella, Pool, type Hilo, type Serie } from '../../src/experimentos';
import { crearPoolNode } from '../../src/experimentos/pool-node';

const SEMILLA = 4242;
const escenarios = [0, 2].map((k) => aplicarNivel(PRESET_POLICONSULTORIO_3, { k, politica: 'intercalado', ausentismo: null }));
const nueva = (): Serie => crearSerie('prueba', escenarios);

/** Hilos falsos que contestan en orden invertido y con demoras distintas (prueba el ensamblado por índice). */
function poolDesordenado(hilos: number): Pool {
  let n = 0;
  return new Pool((): Hilo => {
    const simular = crearSimulador();
    const yo = n++;
    let alRecibir: ((r: { id: number; datos: Float64Array }) => void) | null = null;
    return {
      enviar: (t) => {
        const datos = simular(t);
        setTimeout(() => alRecibir?.({ id: t.id, datos }), ((t.id * 7 + yo * 3) % 5) * 2);
      },
      alRecibir: (f) => {
        alRecibir = f;
      },
      terminar: () => undefined,
    };
  }, hilos);
}

const pools: Pool[] = [];
afterAll(() => pools.forEach((p) => p.cerrar()));

describe('reproducibilidad del motor de experimentos', () => {
  it('idéntico bit a bit con 1 y 4 worker_threads, con hilos desordenados y en el mismo hilo', async () => {
    const huellas: string[] = [];
    for (const ejecutor of [new EjecutorLocal(), crearPoolNode(1), crearPoolNode(4), poolDesordenado(3)]) {
      if (ejecutor instanceof Pool) pools.push(ejecutor);
      const s = nueva();
      await extenderSeries(ejecutor, [{ serie: s, R: 250 }], SEMILLA);
      expect(s.R).toBe(250);
      huellas.push(huella(s.datos));
    }
    expect(new Set(huellas).size).toBe(1);
  });

  it('duplicar R simula solo las réplicas nuevas y da lo mismo que correr todo de una vez', async () => {
    const ejecutor = new EjecutorLocal();
    const a = nueva();
    await extenderSeries(ejecutor, [{ serie: a, R: 120 }], SEMILLA);
    await extenderSeries(ejecutor, [{ serie: a, R: 240 }], SEMILLA);
    const b = nueva();
    await extenderSeries(ejecutor, [{ serie: b, R: 240 }], SEMILLA);
    expect(huella(a.datos)).toBe(huella(b.datos));
  });

  it('la cancelación corta la ejecución con un error Cancelado', async () => {
    const control = new AbortController();
    const s = nueva();
    const promesa = extenderSeries(new EjecutorLocal(), [{ serie: s, R: 2000 }], SEMILLA, { senal: control.signal, alAvanzar: (h) => h === 2 && control.abort() });
    await expect(promesa).rejects.toThrow('cancelado');
  });
});
