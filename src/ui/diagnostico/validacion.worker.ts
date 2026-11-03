/**
 * Web Worker que corre la validación M/M/c sin bloquear la interfaz.
 * Demuestra que el motor funciona fuera del hilo principal (sin DOM).
 */
import { CASOS_VALIDACION, validarCaso, type ResultadoCaso } from '../../motor';

export type MensajeWorker =
  | { tipo: 'progreso'; caso: string; indice: number; total: number }
  | { tipo: 'caso'; resultado: ResultadoCaso; segundos: number }
  | { tipo: 'fin' };

// Tipado mínimo del ámbito del worker (el proyecto compila con lib DOM, no WebWorker).
const ctx = self as unknown as { postMessage(m: MensajeWorker): void; onmessage: (() => void) | null };

ctx.onmessage = () => {
  CASOS_VALIDACION.forEach((caso, indice) => {
    ctx.postMessage({ tipo: 'progreso', caso: caso.nombre, indice, total: CASOS_VALIDACION.length } satisfies MensajeWorker);
    const t0 = performance.now();
    const resultado = validarCaso(caso);
    ctx.postMessage({ tipo: 'caso', resultado, segundos: (performance.now() - t0) / 1000 } satisfies MensajeWorker);
  });
  ctx.postMessage({ tipo: 'fin' } satisfies MensajeWorker);
};
