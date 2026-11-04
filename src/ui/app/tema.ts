/**
 * Tema claro/oscuro: 'auto' sigue a prefers-color-scheme; 'claro' y 'oscuro' fijan data-tema.
 * La preferencia se guarda en localStorage (con try/catch: puede no estar disponible).
 */
import { useSyncExternalStore } from 'react';

export type PreferenciaTema = 'auto' | 'claro' | 'oscuro';
export type TemaEfectivo = 'claro' | 'oscuro';

const CLAVE = 'sobreturnos.tema';
const oyentes = new Set<() => void>();

function leerPreferencia(): PreferenciaTema {
  const d = document.documentElement.dataset.tema;
  return d === 'claro' || d === 'oscuro' ? d : 'auto';
}

let preferencia: PreferenciaTema = typeof document !== 'undefined' ? leerPreferencia() : 'auto';
const consulta = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
consulta?.addEventListener('change', () => oyentes.forEach((f) => f()));

export function temaEfectivo(): TemaEfectivo {
  if (preferencia !== 'auto') return preferencia;
  return consulta?.matches ? 'oscuro' : 'claro';
}

export function setPreferenciaTema(p: PreferenciaTema): void {
  preferencia = p;
  if (p === 'auto') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = p;
  try {
    if (p === 'auto') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, p);
  } catch {
    /* sin almacenamiento: la preferencia dura la sesión */
  }
  oyentes.forEach((f) => f());
}

const suscribir = (f: () => void): (() => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

export function useTema(): { preferencia: PreferenciaTema; efectivo: TemaEfectivo } {
  const pref = useSyncExternalStore(suscribir, () => preferencia);
  const efectivo = useSyncExternalStore(suscribir, temaEfectivo);
  return { preferencia: pref, efectivo };
}
