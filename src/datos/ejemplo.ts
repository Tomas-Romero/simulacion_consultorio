/**
 * Datos de ejemplo (ficticios) generados con el modelo y una semilla, para que el ajuste recupere
 * parámetros conocidos. Usan las mismas distribuciones del motor y un flujo por fuente.
 *
 * - Tiempos: duración = factor(tipo) × D(profesional) × Lognormal(media 1, cv del escenario), como
 *   en el modelo del día; redondeada a 0,1 min.
 * - Asistencia: anticipación de la tabla del escenario (discreta empírica); falta con probabilidad
 *   logística(β₀ + β₁·d) del escenario.
 */
import { empiricaDiscreta, exponencial, FabricaFlujos, lognormal, type Distribucion } from '../motor';
import type { Escenario } from '../modelo';
import { TIPOS_PACIENTE, type TiempoMedido, type TipoPaciente } from './csv';
import { probabilidadFalta, type Observacion } from './logistica';

export const SEMILLA_EJEMPLO = 2026;

export function factorDeTipo(e: Escenario, tipo: TipoPaciente): number {
  const a = e.pacientes.atencion;
  return tipo === 'primera_vez' ? a.factorPrimeraVez : tipo === 'control' ? a.factorControl : tipo === 'espontaneo' ? a.factorEspontaneo : a.factorUrgencia;
}

/** Cantidad por (profesional, tipo) del ejemplo. */
export const N_EJEMPLO: Record<TipoPaciente, number> = { primera_vez: 120, control: 200, espontaneo: 120, urgencia: 40 };

export function generarTiempos(e: Escenario, semilla = SEMILLA_EJEMPLO, n: Record<TipoPaciente, number> = N_EJEMPLO): TiempoMedido[] {
  const f = new FabricaFlujos(semilla, 0);
  const g = f.flujo('datos-atencion');
  const { familia, cv } = e.pacientes.atencion;
  const base: Distribucion | null = familia === 'lognormal' ? lognormal(1, cv) : familia === 'exponencial' ? exponencial(1) : null;
  const out: TiempoMedido[] = [];
  for (const p of e.profesionales)
    for (const tipo of TIPOS_PACIENTE)
      for (let i = 0; i < n[tipo]; i++) {
        const u = base ? base.muestrear(g) : 1;
        out.push({ profesional: p.id, tipo, duracion: Math.max(0.1, Math.round(factorDeTipo(e, tipo) * p.duracionTurno * u * 10) / 10) });
      }
  return out;
}

export function generarAsistencia(e: Escenario, semilla = SEMILLA_EJEMPLO, n = 3000): Observacion[] {
  const f = new FabricaFlujos(semilla, 0);
  const ga = f.flujo('datos-anticipacion');
  const gs = f.flujo('datos-asistencia');
  const tabla = empiricaDiscreta(e.pacientes.anticipacion);
  const { beta0, beta1 } = e.ausentismo;
  const out: Observacion[] = [];
  for (let i = 0; i < n; i++) {
    const d = tabla.muestrear(ga);
    out.push({ anticipacion: d, asistio: gs.uniforme() < probabilidadFalta(beta0, beta1, d) ? 0 : 1 });
  }
  return out;
}
