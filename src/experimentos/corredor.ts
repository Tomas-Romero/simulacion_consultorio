/**
 * Series de configuraciones: guardan las filas de métricas por día de cada configuración y se
 * pueden extender (duplicar R simula solo las réplicas nuevas, con las mismas semillas).
 */
import type { Escenario } from '../modelo';
import type { Ejecutor, OpcionesEjecucion } from './pool';
import { M, type TareaSimulacion } from './tareas';

/** Réplicas por tarea: lo bastante grande para amortizar el mensaje, lo bastante chico para repartir bien. */
export const BLOQUE = 100;

export interface Serie {
  /** Identificador legible (preset, política, ausentismo…). */
  nombre: string;
  /** Una configuración por elemento (por ejemplo, k = 0…6). */
  escenarios: Escenario[];
  /** Réplicas simuladas por configuración. */
  R: number;
  /** datos[c] = R filas × M columnas (fila r = réplica r). */
  datos: Float64Array[];
}

export function crearSerie(nombre: string, escenarios: Escenario[]): Serie {
  return { nombre, escenarios, R: 0, datos: escenarios.map(() => new Float64Array(0)) };
}

/** Lleva cada serie a su R pedido, en una sola tanda de tareas repartida entre los hilos. */
export async function extenderSeries(
  ejecutor: Ejecutor,
  pedidos: readonly { serie: Serie; R: number }[],
  semilla: number,
  opciones: OpcionesEjecucion = {},
): Promise<void> {
  const tareas: TareaSimulacion[] = [];
  const destino: { serie: Serie; c: number; desde: number }[] = [];
  for (const { serie, R } of pedidos) {
    if (R <= serie.R) continue;
    serie.escenarios.forEach((escenario, c) => {
      for (let desde = serie.R; desde < R; desde += BLOQUE) {
        tareas.push({ id: tareas.length, escenario, semilla, desde, hasta: Math.min(R, desde + BLOQUE) });
        destino.push({ serie, c, desde });
      }
    });
  }
  const resultados = await ejecutor.ejecutarTodas(tareas, opciones);
  // Ensamblado por índice de réplica: no depende del orden en que terminaron las tareas.
  for (const { serie, R } of pedidos) {
    if (R <= serie.R) continue;
    serie.datos = serie.datos.map((viejo) => {
      const nuevo = new Float64Array(R * M);
      nuevo.set(viejo);
      return nuevo;
    });
  }
  resultados.forEach((bloque, i) => {
    const { serie, c, desde } = destino[i]!;
    serie.datos[c]!.set(bloque, desde * M);
  });
  for (const { serie, R } of pedidos) if (R > serie.R) serie.R = R;
}

/** Huella de los datos: FNV-1a de 64 bits (dos de 32 con distinta base) sobre los bytes de todos los valores. */
export function huella(bloques: readonly Float64Array[]): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (const f of bloques) {
    const bytes = new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
    for (let i = 0; i < bytes.length; i++) {
      a = Math.imul(a ^ bytes[i]!, 0x01000193);
      b = Math.imul(b ^ bytes[i]!, 0x01000193) ^ (b >>> 15);
    }
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/** Hash corto de un texto (FNV-1a de 64 bits), para identificar los presets usados. */
export function hashTexto(s: string): string {
  return huella([new Float64Array(Array.from(s, (ch) => ch.charCodeAt(0)))]);
}
