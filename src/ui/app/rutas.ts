/**
 * Enrutador por hash (funciona en GitHub Pages sin configurar el servidor).
 * `#/ruta?param=valor`: los parámetros sirven para compartir un estado y para las capturas.
 */
import { useSyncExternalStore } from 'react';

export const RUTAS = ['inicio', 'escenario', 'simulacion', 'resultados', 'experimentos', 'dinamica', 'datos', 'reporte', 'acerca', 'diagnostico'] as const;
export type Ruta = (typeof RUTAS)[number];

export interface Ubicacion {
  ruta: Ruta;
  params: URLSearchParams;
}

const suscribir = (f: () => void): (() => void) => {
  window.addEventListener('hashchange', f);
  return () => window.removeEventListener('hashchange', f);
};

export function leerUbicacion(hash: string): Ubicacion {
  const limpio = hash.replace(/^#\/?/, '');
  const [camino = '', consulta = ''] = limpio.split('?');
  const ruta = (RUTAS as readonly string[]).includes(camino) ? (camino as Ruta) : 'inicio';
  return { ruta, params: new URLSearchParams(consulta) };
}

export function useUbicacion(): Ubicacion {
  const hash = useSyncExternalStore(suscribir, () => window.location.hash);
  return leerUbicacion(hash);
}

export function enlace(ruta: Ruta, params?: Record<string, string>): string {
  const q = params ? `?${new URLSearchParams(params).toString()}` : '';
  return `#/${ruta === 'inicio' ? '' : ruta}${q}`;
}

export function navegar(ruta: Ruta, params?: Record<string, string>): void {
  window.location.hash = enlace(ruta, params);
}
