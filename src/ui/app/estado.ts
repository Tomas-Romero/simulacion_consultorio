/**
 * Estado global de la aplicación: escenario en edición (borrador), último escenario válido,
 * errores de validación por campo, semilla y escenario de comparación. Se guarda en
 * localStorage (con try/catch) y se comparte entre Escenario, Simulación y Resultados.
 */
import { useSyncExternalStore } from 'react';
import {
  EsquemaEscenario,
  EsquemaPoliticaSobreturno,
  PRESET_CENTRO_6,
  PRESET_CONSULTORIO_CHICO,
  PRESET_POLICONSULTORIO_3,
  type Escenario,
  type PoliticaSobreturno,
} from '../../modelo';

export const PRESETS_APP = {
  chico: { escenario: PRESET_CONSULTORIO_CHICO, corto: 'Consultorio chico', numero: 1 },
  policonsultorio: { escenario: PRESET_POLICONSULTORIO_3, corto: 'Policonsultorio', numero: 3 },
  centro: { escenario: PRESET_CENTRO_6, corto: 'Centro completo', numero: 6 },
} as const;
export type IdPreset = keyof typeof PRESETS_APP;
export const IDS_PRESET = Object.keys(PRESETS_APP) as IdPreset[];

export interface Comparacion {
  k: number;
  politica: PoliticaSobreturno;
}

export interface EstadoApp {
  borrador: Escenario;
  valido: Escenario;
  errores: ReadonlyMap<string, string>;
  /** Mensajes de validación que no corresponden a un campo puntual (reglas entre campos). */
  erroresGenerales: readonly string[];
  semilla: number;
  replica: number;
  /** Preset de origen; `null` si el escenario se modificó a mano. */
  preset: IdPreset | null;
  comparacion: Comparacion;
}

const CLAVE = 'sobreturnos.estado.v1';
const SEMILLA_INICIAL = 2026;

interface Guardado {
  borrador: unknown;
  semilla: number;
  preset: IdPreset | null;
  comparacion: Comparacion;
}

type Issue = { code: string; path: PropertyKey[]; message: string; minimum?: unknown; maximum?: unknown; expected?: unknown };

/** Mensaje de zod → español del dominio. */
export function mensajeError(i: Issue): string {
  switch (i.code) {
    case 'too_small':
      return `Tiene que ser como mínimo ${String(i.minimum)}.`;
    case 'too_big':
      return `Tiene que ser como máximo ${String(i.maximum)}.`;
    case 'invalid_type':
      return i.expected === 'number' ? 'Ingresá un número.' : 'Valor no válido.';
    case 'invalid_value':
    case 'invalid_union':
      return 'Elegí una de las opciones.';
    case 'custom':
      return i.message.charAt(0).toUpperCase() + i.message.slice(1) + '.';
    default:
      return 'Valor no válido.';
  }
}

function validar(borrador: Escenario): Pick<EstadoApp, 'errores' | 'erroresGenerales'> & { valido: Escenario | null } {
  const r = EsquemaEscenario.safeParse(borrador);
  if (r.success) return { valido: r.data, errores: new Map(), erroresGenerales: [] };
  const errores = new Map<string, string>();
  const generales: string[] = [];
  for (const issue of r.error.issues as Issue[]) {
    const clave = issue.path.map(String).join('.');
    const msg = mensajeError(issue);
    if (issue.path.length === 0) generales.push(msg);
    else if (!errores.has(clave)) errores.set(clave, msg);
  }
  return { valido: null, errores, erroresGenerales: generales };
}

function inicial(): EstadoApp {
  const base = PRESET_POLICONSULTORIO_3;
  let estado: EstadoApp = {
    borrador: base,
    valido: base,
    errores: new Map(),
    erroresGenerales: [],
    semilla: SEMILLA_INICIAL,
    replica: 0,
    preset: 'policonsultorio',
    comparacion: { k: 3, politica: 'intercalado' },
  };
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      const g = JSON.parse(crudo) as Partial<Guardado>;
      const parse = EsquemaEscenario.safeParse(g.borrador);
      if (parse.success) estado = { ...estado, borrador: parse.data, valido: parse.data, preset: g.preset ?? null };
      if (typeof g.semilla === 'number' && Number.isInteger(g.semilla)) estado.semilla = g.semilla;
      if (g.comparacion && Number.isInteger(g.comparacion.k) && EsquemaPoliticaSobreturno.safeParse(g.comparacion.politica).success) {
        estado.comparacion = { k: Math.max(0, Math.min(12, g.comparacion.k)), politica: g.comparacion.politica };
      }
    }
  } catch {
    /* almacenamiento no disponible o dato corrupto: se usa el preset por defecto */
  }
  return estado;
}

let estado: EstadoApp = typeof window !== 'undefined' ? inicial() : (null as unknown as EstadoApp);
const oyentes = new Set<() => void>();

function guardar(): void {
  try {
    const g: Guardado = { borrador: estado.borrador, semilla: estado.semilla, preset: estado.preset, comparacion: estado.comparacion };
    localStorage.setItem(CLAVE, JSON.stringify(g));
  } catch {
    /* sin almacenamiento: el estado dura la sesión */
  }
}

function fijar(nuevo: EstadoApp): void {
  estado = nuevo;
  guardar();
  oyentes.forEach((f) => f());
}

export function getEstado(): EstadoApp {
  return estado;
}

export function editarEscenario(cambio: (e: Escenario) => Escenario): void {
  const borrador = cambio(estado.borrador);
  const v = validar(borrador);
  fijar({ ...estado, borrador, valido: v.valido ?? estado.valido, errores: v.errores, erroresGenerales: v.erroresGenerales, preset: null });
}

export function cargarPreset(id: IdPreset): void {
  const e = PRESETS_APP[id].escenario;
  fijar({ ...estado, borrador: e, valido: e, errores: new Map(), erroresGenerales: [], preset: id });
}

export function setSemilla(semilla: number): void {
  if (Number.isInteger(semilla) && semilla >= 0) fijar({ ...estado, semilla });
}

export function setComparacion(c: Partial<Comparacion>): void {
  fijar({ ...estado, comparacion: { ...estado.comparacion, ...c } });
}

const suscribir = (f: () => void): (() => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

export function useEstado(): EstadoApp {
  return useSyncExternalStore(suscribir, getEstado);
}

/** Escenario B de la comparación: el válido con k y política de sobreturnos cambiados en todos los profesionales. */
export function escenarioComparado(e: Escenario, c: Comparacion): Escenario {
  return { ...e, profesionales: e.profesionales.map((p) => ({ ...p, sobreturnos: { k: c.k, politica: c.politica } })) };
}

export const NOMBRES_POLITICA: Record<PoliticaSobreturno, string> = {
  inicio: 'Al inicio',
  intercalado: 'Intercalados',
  mayor_ausentismo: 'Donde más se falta',
  final: 'Al final',
};
