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

/** Análisis complementarios del #5 (public/resultados/complementos.json). */
export interface ComplementosPublicados {
  generado: string;
  semilla: number;
  regla: {
    excedentes: Record<string, { lambda: number[]; cupos: number[]; exceso: number[]; media: number }>;
    N: Record<string, number>;
    coincidenConE4: number;
    loo: import('../../experimentos/regla').ResultadoLOO;
  };
  mecanismo: { preset: string; configs: { politica: import('../../modelo').PoliticaSobreturno; k: number; perfil: import('../../experimentos/mecanismo').PerfilResumido }[] }[];
  fluido: {
    k: number;
    R: number;
    t: number[];
    des: import('../../experimentos/analisis').IC[];
    fluido: number[];
    desArea: import('../../experimentos/analisis').IC;
    desEspera: import('../../experimentos/analisis').IC;
    desMaximo: import('../../experimentos/analisis').IC;
    fluidoArea: number;
    fluidoEspera: number;
    fluidoMaximo: number;
  }[];
}

let promesaComplementos: Promise<ComplementosPublicados> | null = null;

export function useComplementos(): ComplementosPublicados | null {
  const [c, setC] = useState<ComplementosPublicados | null>(null);
  useEffect(() => {
    let vigente = true;
    promesaComplementos ??= fetch('./resultados/complementos.json').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<ComplementosPublicados>;
    });
    promesaComplementos.then(
      (x) => vigente && setC(x),
      () => (promesaComplementos = null),
    );
    return () => {
      vigente = false;
    };
  }, []);
  return c;
}

export function descargarTexto(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
