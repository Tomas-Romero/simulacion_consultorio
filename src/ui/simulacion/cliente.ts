/**
 * Cliente del worker de simulación: un solo worker compartido, pedidos con id y caché de
 * resultados por (escenario, semilla, réplica). `useCorrida` lo expone a React.
 */
import { useEffect, useState } from 'react';
import type { Escenario } from '../../modelo';
import type { ResultadoCorrida } from './corrida';
import type { PedidoCorrida, RespuestaCorrida } from './simulacion.worker';

let worker: Worker | null = null;
let siguienteId = 1;
const pendientes = new Map<number, { resolver: (r: ResultadoCorrida) => void; rechazar: (e: Error) => void }>();
const cache = new Map<string, Promise<ResultadoCorrida>>();
const MAX_CACHE = 12;

function obtenerWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./simulacion.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<RespuestaCorrida>) => {
      const p = pendientes.get(e.data.id);
      if (!p) return;
      pendientes.delete(e.data.id);
      if (e.data.ok) p.resolver(e.data.resultado);
      else p.rechazar(new Error(e.data.error));
    };
  }
  return worker;
}

export function claveCorrida(escenario: Escenario, semilla: number, replica: number): string {
  return `${semilla}|${replica}|${JSON.stringify(escenario)}`;
}

export function pedirCorrida(escenario: Escenario, semilla: number, replica = 0): Promise<ResultadoCorrida> {
  const clave = claveCorrida(escenario, semilla, replica);
  const enCache = cache.get(clave);
  if (enCache) return enCache;
  const promesa = new Promise<ResultadoCorrida>((resolver, rechazar) => {
    const id = siguienteId++;
    pendientes.set(id, { resolver, rechazar });
    obtenerWorker().postMessage({ id, escenario, semilla, replica } satisfies PedidoCorrida);
  });
  cache.set(clave, promesa);
  promesa.catch(() => cache.delete(clave));
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  return promesa;
}

export type EstadoCorrida = { estado: 'cargando' } | { estado: 'listo'; resultado: ResultadoCorrida } | { estado: 'error'; mensaje: string };

/** Corre (o toma de la caché) el día del escenario. `null` = no correr. */
export function useCorrida(escenario: Escenario | null, semilla: number, replica = 0): EstadoCorrida {
  const clave = escenario ? claveCorrida(escenario, semilla, replica) : '';
  const [estado, setEstado] = useState<{ clave: string; valor: EstadoCorrida }>({ clave: '', valor: { estado: 'cargando' } });

  useEffect(() => {
    if (!escenario) return;
    let vigente = true;
    pedirCorrida(escenario, semilla, replica).then(
      (resultado) => vigente && setEstado({ clave, valor: { estado: 'listo', resultado } }),
      (e: Error) => vigente && setEstado({ clave, valor: { estado: 'error', mensaje: e.message } }),
    );
    return () => {
      vigente = false;
    };
    // `clave` resume escenario, semilla y réplica.
  }, [clave]);

  return estado.clave === clave ? estado.valor : { estado: 'cargando' };
}
