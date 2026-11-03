/**
 * Traza de eventos por entidad, pensada para la animación del paso #3 y para
 * exportar corridas. Es una lista plana, ordenada por tiempo y secuencia, de
 * registros serializables (sin funciones ni referencias), así puede cruzar
 * el límite de un Web Worker con postMessage o guardarse como JSON.
 */
import { z } from 'zod';

export const TiposRegistro = [
  'llegada', // la entidad entra al sistema
  'entra_cola', // se pone a esperar un recurso
  'inicio_servicio', // toma una unidad del recurso
  'fin_servicio', // libera la unidad del recurso
  'abandono', // deja la cola sin ser atendida
  'salida', // sale del sistema
  'marca', // evento propio del modelo (detalle libre)
] as const;

export const EsquemaRegistroTraza = z.object({
  /** Tiempo de simulación. */
  t: z.number(),
  /** Orden global del registro (desempata registros simultáneos). */
  seq: z.number().int().nonnegative(),
  entidad: z.number().int().nonnegative(),
  tipo: z.enum(TiposRegistro),
  /** Recurso involucrado (consultorio, admisión, ...), si corresponde. */
  recurso: z.string().optional(),
  /** Unidad del recurso (p. ej. número de servidor), si corresponde. */
  unidad: z.number().int().nonnegative().optional(),
  detalle: z.string().optional(),
});

export type RegistroTraza = z.infer<typeof EsquemaRegistroTraza>;
export type TipoRegistro = RegistroTraza['tipo'];

export const EsquemaTraza = z.array(EsquemaRegistroTraza);

export class Traza {
  readonly registros: RegistroTraza[] = [];
  activa: boolean;
  private seq = 0;

  constructor(activa = true) {
    this.activa = activa;
  }

  registrar(r: Omit<RegistroTraza, 'seq'>): void {
    if (!this.activa) return;
    this.registros.push({ ...r, seq: this.seq++ });
  }

  /** Registros de una entidad, en orden. */
  deEntidad(id: number): RegistroTraza[] {
    return this.registros.filter((r) => r.entidad === id);
  }

  /** Agrupa los registros por entidad (útil para animar recorridos). */
  porEntidad(): Map<number, RegistroTraza[]> {
    const mapa = new Map<number, RegistroTraza[]>();
    for (const r of this.registros) {
      const lista = mapa.get(r.entidad);
      if (lista) lista.push(r);
      else mapa.set(r.entidad, [r]);
    }
    return mapa;
  }
}
