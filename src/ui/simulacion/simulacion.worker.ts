/**
 * Web Worker de la simulación del día: corre el modelo fuera del hilo principal y devuelve
 * la traza autocontenida. La animación la reproduce sin volver a simular.
 */
import type { Escenario } from '../../modelo';
import { ejecutarCorrida, type ResultadoCorrida } from './corrida';

export interface PedidoCorrida {
  id: number;
  escenario: Escenario;
  semilla: number;
  replica: number;
}

export type RespuestaCorrida = { id: number; ok: true; resultado: ResultadoCorrida } | { id: number; ok: false; error: string };

// Tipado mínimo del ámbito del worker (el proyecto compila con lib DOM, no WebWorker).
const ctx = self as unknown as { postMessage(m: RespuestaCorrida): void; onmessage: ((e: MessageEvent<PedidoCorrida>) => void) | null };

ctx.onmessage = (e) => {
  const { id, escenario, semilla, replica } = e.data;
  try {
    ctx.postMessage({ id, ok: true, resultado: ejecutarCorrida(escenario, semilla, replica) });
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
