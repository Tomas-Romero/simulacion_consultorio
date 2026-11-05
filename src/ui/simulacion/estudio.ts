/** Carga del estudio precalculado (public/resultados/estudio.json), una sola vez por sesión. */
import { useEffect, useState } from 'react';
import type { ResultadoEstudio } from '../../experimentos/estudio';

export type EstudioPublicado = ResultadoEstudio & { generado: string; entorno: { motor: string; hilos: number; segundos: number } };

let promesa: Promise<EstudioPublicado> | null = null;

export function cargarEstudio(): Promise<EstudioPublicado> {
  promesa ??= fetch('./resultados/estudio.json').then((r) => {
    if (!r.ok) throw new Error(`no se encontró el estudio (HTTP ${r.status}); correr npm run estudio`);
    return r.json() as Promise<EstudioPublicado>;
  });
  promesa.catch(() => (promesa = null));
  return promesa;
}

export function useEstudio(): { estudio: EstudioPublicado | null; error: string | null } {
  const [estado, setEstado] = useState<{ estudio: EstudioPublicado | null; error: string | null }>({ estudio: null, error: null });
  useEffect(() => {
    let vigente = true;
    cargarEstudio().then(
      (estudio) => vigente && setEstado({ estudio, error: null }),
      (e: Error) => vigente && setEstado({ estudio: null, error: e.message }),
    );
    return () => {
      vigente = false;
    };
  }, []);
  return estado;
}

export function descargarTexto(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
