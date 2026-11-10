/**
 * Último resultado del laboratorio de Experimentos, compartido con el reporte imprimible. Vive en
 * memoria y en sessionStorage (con try/catch): sobrevive a la navegación y a recargar la pestaña.
 */
import { useSyncExternalStore } from 'react';
import type { CurvaSerie } from '../../experimentos';
import type { PoliticaSobreturno } from '../../modelo';

export interface ResultadoLab {
  ks: number[];
  R: number;
  semilla: number;
  segundos: number;
  hilos: number;
  curvas: { politica: PoliticaSobreturno; curva: CurvaSerie }[];
  escenario: string;
  /** Momento en que terminó (ms desde 1970). */
  cuando: number;
}

const CLAVE = 'sobreturnos.laboratorio.v1';
let ultimo: ResultadoLab | null = null;
try {
  const crudo = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(CLAVE) : null;
  if (crudo) ultimo = JSON.parse(crudo) as ResultadoLab;
} catch {
  ultimo = null;
}
const oyentes = new Set<() => void>();

export function guardarLaboratorio(r: ResultadoLab): void {
  ultimo = r;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(r));
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
  oyentes.forEach((f) => f());
}

export function useLaboratorio(): ResultadoLab | null {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => ultimo,
  );
}
