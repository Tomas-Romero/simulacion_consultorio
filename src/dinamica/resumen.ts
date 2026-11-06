/** Resúmenes del modelo de la lista de espera: comparación de políticas y convergencia numérica. */
import { equilibrio, simularLista, type Metodo, type ParametrosLista, type Politica, type TablaBeneficio, type Trayectoria } from './lista';

export interface ResumenPolitica {
  nombre: string;
  politica: Politica;
  trayectoria: Trayectoria;
  Lmax: number;
  amax: number;
  pmax: number;
  /** Totales en el horizonte. */
  atendidos: number;
  perdidos: number;
  beneficio: number;
  /** Totales durante el pico (si hay) y en las 6 semanas siguientes. */
  picoAtendidos: number;
  picoPerdidos: number;
  picoBeneficio: number;
}

function ventana(desde: number, hasta: number, serie: number[]): number {
  const a = Math.max(0, Math.min(serie.length - 1, Math.round(desde)));
  const b = Math.max(0, Math.min(serie.length - 1, Math.round(hasta)));
  return serie[b]! - serie[a]!;
}

export function compararPoliticas(prm: ParametrosLista, tb: TablaBeneficio, kFijo: number, opciones: { dt?: number; metodo?: Metodo } = {}): ResumenPolitica[] {
  const politicas: { nombre: string; politica: Politica }[] = [
    { nombre: 'Sin sobreturnos (k = 0)', politica: { tipo: 'fija', k: 0 } },
    { nombre: `k fijo = ${kFijo} (recomendado del estudio)`, politica: { tipo: 'fija', k: kFijo } },
    { nombre: 'k adaptativo (tabla de E3)', politica: { tipo: 'adaptativa' } },
  ];
  const ini = prm.pico ? prm.pico.inicio * 7 : 0;
  const fin = prm.pico ? (prm.pico.inicio + prm.pico.duracion + 6) * 7 : prm.horizonteSemanas * 7;
  return politicas.map(({ nombre, politica }) => {
    const tr = simularLista(prm, tb, politica, opciones);
    const n = tr.L.length - 1;
    return {
      nombre,
      politica,
      trayectoria: tr,
      Lmax: Math.max(...tr.L),
      amax: Math.max(...tr.a),
      pmax: Math.max(...tr.p),
      atendidos: tr.atendidos[n]!,
      perdidos: tr.perdidos[n]!,
      beneficio: tr.beneficio[n]!,
      picoAtendidos: ventana(ini, fin, tr.atendidos),
      picoPerdidos: ventana(ini, fin, tr.perdidos),
      picoBeneficio: ventana(ini, fin, tr.beneficio),
    };
  });
}

export interface FilaConvergencia {
  metodo: Metodo;
  dt: number;
  Lmax: number;
  Lfinal: number;
  beneficio: number;
  /** |valor − referencia| con la referencia RK4 dt = 0,01. */
  errorLmax: number;
  errorLfinal: number;
  errorBeneficio: number;
}

export function tablaConvergencia(prm: ParametrosLista, tb: TablaBeneficio, k: number): { referencia: { Lmax: number; Lfinal: number; beneficio: number }; filas: FilaConvergencia[] } {
  const resumen = (tr: Trayectoria) => ({ Lmax: Math.max(...tr.L), Lfinal: tr.L.at(-1)!, beneficio: tr.beneficio.at(-1)! });
  const ref = resumen(simularLista(prm, tb, { tipo: 'fija', k }, { dt: 0.01, metodo: 'rk4' }));
  const filas: FilaConvergencia[] = [];
  for (const metodo of ['euler', 'rk4'] as const)
    for (const dt of [1, 0.25, 0.1]) {
      const r = resumen(simularLista(prm, tb, { tipo: 'fija', k }, { dt, metodo }));
      filas.push({ metodo, dt, ...r, errorLmax: Math.abs(r.Lmax - ref.Lmax), errorLfinal: Math.abs(r.Lfinal - ref.Lfinal), errorBeneficio: Math.abs(r.beneficio - ref.beneficio) });
    }
  return { referencia: ref, filas };
}

/** Equilibrio analítico contra el valor al que llega la integración con demanda constante. */
export function verificarEquilibrio(prm: ParametrosLista, tb: TablaBeneficio, k: number): { analitico: ReturnType<typeof equilibrio>; simulado: number; desde: number } {
  const eq = equilibrio(prm, k);
  const estable = { ...prm, pico: null, horizonteSemanas: 120 };
  const desde = eq.L * 0.3;
  const tr = simularLista(estable, tb, { tipo: 'fija', k }, { dt: 0.25, metodo: 'rk4', L0: desde });
  return { analitico: eq, simulado: tr.L.at(-1)!, desde };
}
