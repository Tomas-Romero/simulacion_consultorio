/** Pool de Web Workers para el navegador (tantos como navigator.hardwareConcurrency). */
import { Pool, type Hilo } from './pool';
import type { RespuestaTarea, TareaSimulacion } from './tareas';

export function hilosDisponibles(): number {
  return Math.max(1, Math.min(16, navigator.hardwareConcurrency || 4));
}

export function crearPoolWeb(hilos = hilosDisponibles()): Pool {
  return new Pool((): Hilo => {
    const w = new Worker(new URL('./trabajador-web.ts', import.meta.url), { type: 'module' });
    return {
      enviar: (t: TareaSimulacion) => w.postMessage(t),
      alRecibir: (f) => {
        w.onmessage = (e: MessageEvent<RespuestaTarea>) => f(e.data);
        w.onerror = (e) => f({ id: -1, error: e.message || 'error en el worker' });
      },
      terminar: () => w.terminate(),
    };
  }, hilos);
}
