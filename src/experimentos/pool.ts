/**
 * Ejecución de tareas en paralelo. El pool reparte tareas a hilos libres (Web Workers o
 * worker_threads) y ubica cada resultado por la posición de su tarea: el ensamblado no depende
 * del orden en que terminan, así que el resultado es idéntico con cualquier cantidad de hilos.
 */
import { crearSimulador, type RespuestaTarea, type TareaSimulacion } from './tareas';

export interface OpcionesEjecucion {
  senal?: AbortSignal;
  /** Se llama al terminar cada tarea. */
  alAvanzar?: (hechas: number, total: number) => void;
}

export interface Ejecutor {
  readonly hilos: number;
  /** Devuelve los resultados en el mismo orden que `tareas`. */
  ejecutarTodas(tareas: readonly TareaSimulacion[], opciones?: OpcionesEjecucion): Promise<Float64Array[]>;
  cerrar(): void;
}

export class Cancelado extends Error {
  constructor() {
    super('experimento cancelado');
    this.name = 'Cancelado';
  }
}

/** Un hilo de trabajo: lo implementan los Web Workers y los worker_threads. */
export interface Hilo {
  enviar(t: TareaSimulacion): void;
  alRecibir(f: (r: RespuestaTarea) => void): void;
  terminar(): void;
}

export class Pool implements Ejecutor {
  readonly hilos: number;
  private crear: () => Hilo;
  private vivos: Hilo[] = [];

  constructor(crear: () => Hilo, hilos: number) {
    this.crear = crear;
    this.hilos = Math.max(1, Math.floor(hilos));
  }

  ejecutarTodas(tareas: readonly TareaSimulacion[], opciones: OpcionesEjecucion = {}): Promise<Float64Array[]> {
    const { senal, alAvanzar } = opciones;
    const resultados: Float64Array[] = new Array(tareas.length);
    if (tareas.length === 0) return Promise.resolve(resultados);
    if (senal?.aborted) return Promise.reject(new Cancelado());
    if (this.vivos.length === 0) this.vivos = Array.from({ length: this.hilos }, () => this.crear());
    return new Promise((resolver, rechazar) => {
      let siguiente = 0;
      let hechas = 0;
      let terminado = false;
      const finalizar = (err?: Error): void => {
        if (terminado) return;
        terminado = true;
        senal?.removeEventListener('abort', alAbortar);
        if (err) {
          // Los hilos pueden tener tareas en curso: se descartan y se crean de nuevo en la próxima ejecución.
          for (const h of this.vivos) h.terminar();
          this.vivos = [];
          rechazar(err);
        } else resolver(resultados);
      };
      const alAbortar = (): void => finalizar(new Cancelado());
      senal?.addEventListener('abort', alAbortar);
      const darTarea = (h: Hilo, posPorId: Map<number, number>): void => {
        if (siguiente >= tareas.length) return;
        const pos = siguiente++;
        const t = tareas[pos]!;
        posPorId.set(t.id, pos);
        h.enviar(t);
      };
      for (const h of this.vivos) {
        const posPorId = new Map<number, number>();
        h.alRecibir((r) => {
          if (terminado) return;
          if (r.error !== undefined || !r.datos) return finalizar(new Error(r.error ?? 'el worker no devolvió datos'));
          const pos = posPorId.get(r.id)!;
          posPorId.delete(r.id);
          resultados[pos] = r.datos;
          hechas++;
          alAvanzar?.(hechas, tareas.length);
          if (hechas === tareas.length) finalizar();
          else darTarea(h, posPorId);
        });
        darTarea(h, posPorId);
      }
    });
  }

  cerrar(): void {
    for (const h of this.vivos) h.terminar();
    this.vivos = [];
  }
}

/** Ejecutor en el mismo hilo (tests y respaldo). Cede el control entre tareas para no congelar la interfaz. */
export class EjecutorLocal implements Ejecutor {
  readonly hilos = 1;
  private simular = crearSimulador();

  async ejecutarTodas(tareas: readonly TareaSimulacion[], opciones: OpcionesEjecucion = {}): Promise<Float64Array[]> {
    const out: Float64Array[] = [];
    for (const [i, t] of tareas.entries()) {
      if (opciones.senal?.aborted) throw new Cancelado();
      out.push(this.simular(t));
      opciones.alAvanzar?.(i + 1, tareas.length);
      if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
    }
    return out;
  }

  cerrar(): void {}
}
