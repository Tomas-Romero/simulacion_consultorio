/**
 * Llevar los ajustes al escenario. El modelo (congelado) admite para la atención las familias
 * lognormal, exponencial y constante, con media = factor(tipo) × D del profesional y un cv común.
 *
 * - Cada duración se normaliza por la D de su profesional (x / D) y se ajusta la familia elegida
 *   por tipo de paciente: factor(tipo) = media ajustada de x / D.
 * - cv común = promedio de los cv ajustados por tipo, ponderado por la cantidad de datos.
 * - Gamma y empírica no existen en el modelo: se aplican como lognormal con la misma media y cv
 *   (ajuste por momentos), y se avisa.
 */
import type { Escenario } from '../modelo';
import { ajustar, type Familia } from './ajuste';
import { NOMBRES_TIPO, TIPOS_PACIENTE, type TiempoMedido, type TipoPaciente } from './csv';
import { factorDeTipo } from './ejemplo';
import type { ResultadoLogistica } from './logistica';

export interface Cambio {
  campo: string;
  antes: string;
  despues: string;
}

export interface Aplicacion {
  escenario: Escenario;
  cambios: Cambio[];
  advertencias: string[];
}

const CAMPO_FACTOR: Record<TipoPaciente, 'factorPrimeraVez' | 'factorControl' | 'factorEspontaneo' | 'factorUrgencia'> = {
  primera_vez: 'factorPrimeraVez',
  control: 'factorControl',
  espontaneo: 'factorEspontaneo',
  urgencia: 'factorUrgencia',
};

const f3 = (x: number): string => x.toLocaleString('es-AR', { maximumFractionDigits: 3 });

/** Profesional del escenario al que corresponde un nombre del CSV (por id o por nombre). */
export function buscarProfesional(e: Escenario, nombre: string): Escenario['profesionales'][number] | undefined {
  const n = nombre.trim().toLowerCase();
  return e.profesionales.find((p) => p.id.toLowerCase() === n || p.nombre.trim().toLowerCase() === n);
}

/** Duraciones normalizadas por la D de su profesional, por tipo; las de profesionales desconocidos se descartan. */
export function normalizarPorTipo(e: Escenario, datos: readonly TiempoMedido[]): { porTipo: Record<TipoPaciente, number[]>; desconocidos: string[] } {
  const porTipo = { primera_vez: [], control: [], espontaneo: [], urgencia: [] } as Record<TipoPaciente, number[]>;
  const desconocidos = new Set<string>();
  for (const d of datos) {
    const p = buscarProfesional(e, d.profesional);
    if (!p) desconocidos.add(d.profesional);
    else porTipo[d.tipo].push(d.duracion / p.duracionTurno);
  }
  return { porTipo, desconocidos: [...desconocidos] };
}

export function aplicarTiempos(e: Escenario, datos: readonly TiempoMedido[], familia: Familia): Aplicacion {
  const { porTipo, desconocidos } = normalizarPorTipo(e, datos);
  const advertencias: string[] = [];
  if (desconocidos.length) advertencias.push(`Se descartaron los datos de profesionales que no están en el escenario: ${desconocidos.join(', ')}.`);
  const familiaModelo: 'lognormal' | 'exponencial' = familia === 'exponencial' ? 'exponencial' : 'lognormal';
  if (familia === 'gamma' || familia === 'empirica')
    advertencias.push(`El modelo no tiene la familia ${familia === 'gamma' ? 'gamma' : 'empírica'}: se aplica una lognormal con la misma media y el mismo cv.`);
  const atencion = { ...e.pacientes.atencion, familia: familiaModelo };
  const cambios: Cambio[] = [];
  let sumaCv = 0;
  let nCv = 0;
  for (const tipo of TIPOS_PACIENTE) {
    const xs = porTipo[tipo];
    if (xs.length < 2) {
      advertencias.push(`${NOMBRES_TIPO[tipo]}: menos de 2 datos, el factor queda como estaba (${f3(factorDeTipo(e, tipo))}).`);
      continue;
    }
    const a = familia === 'empirica' ? momentos(xs) : ajustar(familia, xs);
    atencion[CAMPO_FACTOR[tipo]] = a.media;
    cambios.push({ campo: `Factor de ${NOMBRES_TIPO[tipo].toLowerCase()} (media / D)`, antes: f3(factorDeTipo(e, tipo)), despues: f3(a.media) });
    sumaCv += a.cv * xs.length;
    nCv += xs.length;
  }
  if (familiaModelo === 'lognormal' && nCv > 0) {
    atencion.cv = sumaCv / nCv;
    cambios.unshift({ campo: 'Coeficiente de variación', antes: f3(e.pacientes.atencion.cv), despues: f3(atencion.cv) });
  }
  if (familiaModelo !== e.pacientes.atencion.familia) cambios.unshift({ campo: 'Familia', antes: e.pacientes.atencion.familia, despues: familiaModelo });
  return { escenario: { ...e, pacientes: { ...e.pacientes, atencion } }, cambios, advertencias };
}

function momentos(xs: readonly number[]): { media: number; cv: number } {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return { media: m, cv: Math.sqrt(v) / m };
}

export function aplicarAusentismo(e: Escenario, r: Pick<ResultadoLogistica, 'beta0' | 'beta1'>): Aplicacion {
  return {
    escenario: { ...e, ausentismo: { beta0: r.beta0, beta1: r.beta1 } },
    cambios: [
      { campo: 'β₀', antes: f3(e.ausentismo.beta0), despues: f3(r.beta0) },
      { campo: 'β₁ [1/día]', antes: f3(e.ausentismo.beta1), despues: f3(r.beta1) },
    ],
    advertencias: [],
  };
}
