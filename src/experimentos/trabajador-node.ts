/** Hilo de Node (worker_threads) para experimentos: el equivalente del Web Worker. */
import { parentPort } from 'node:worker_threads';
import { crearSimulador, type TareaSimulacion } from './tareas';

const simular = crearSimulador();

parentPort!.on('message', (t: TareaSimulacion) => {
  try {
    const datos = simular(t);
    parentPort!.postMessage({ id: t.id, datos }, [datos.buffer as ArrayBuffer]);
  } catch (err) {
    parentPort!.postMessage({ id: t.id, error: err instanceof Error ? err.message : String(err) });
  }
});
