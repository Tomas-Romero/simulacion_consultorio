/** Web Worker de experimentos: simula bloques de réplicas y devuelve las filas de métricas. */
import { crearSimulador, type RespuestaTarea, type TareaSimulacion } from './tareas';

// Tipado mínimo del ámbito del worker (el proyecto compila con lib DOM, no WebWorker).
const ctx = self as unknown as { postMessage(m: RespuestaTarea, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<TareaSimulacion>) => void) | null };
const simular = crearSimulador();

ctx.onmessage = (e) => {
  try {
    const datos = simular(e.data);
    ctx.postMessage({ id: e.data.id, datos }, [datos.buffer]);
  } catch (err) {
    ctx.postMessage({ id: e.data.id, error: err instanceof Error ? err.message : String(err) });
  }
};
