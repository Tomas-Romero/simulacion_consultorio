/** Pool de worker_threads para Node (tantos como núcleos). Los hilos cargan TypeScript con tsx. */
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { Pool, type Hilo } from './pool';
import type { RespuestaTarea, TareaSimulacion } from './tareas';

export function crearPoolNode(hilos = cpus().length): Pool {
  return new Pool((): Hilo => {
    const w = new Worker(new URL('./trabajador-node.mjs', import.meta.url));
    return {
      enviar: (t: TareaSimulacion) => w.postMessage(t),
      alRecibir: (f) => {
        w.removeAllListeners('message');
        w.removeAllListeners('error');
        w.on('message', (r: RespuestaTarea) => f(r));
        w.on('error', (e: Error) => f({ id: -1, error: e.message }));
      },
      terminar: () => void w.terminate(),
    };
  }, hilos);
}
