/**
 * Parte B · Dinámica de sistemas de la lista de espera (escala de semanas). Diseño, ecuaciones y
 * supuestos en docs/dinamica-sistemas.md. Tiempo en días calendario; la capacidad se ofrece solo
 * los días hábiles (factor dh/7).
 *
 * Stocks: L (lista de espera) y acumuladores (demanda, atendidos, ausentes perdidos, desalentados,
 * consumo, ausentes, beneficio). Flujos:
 *   ingreso = D(t)·(1 − d(a)) + r·p(a)·S        S = min(C, L/τ)        a = L / C      (Little)
 *   egreso  = S   →  atendidos S·(1−p) · ausentes S·p (r vuelven a pedir turno, 1−r se pierden)
 */

export interface TablaBeneficio {
  /** Niveles de ausentismo medio (crecientes). */
  p: number[];
  ks: number[];
  /** B[i][j] = beneficio medio por día hábil con k = ks[i] y ausentismo p[j]. */
  B: number[][];
}

export type Politica = { tipo: 'fija'; k: number } | { tipo: 'adaptativa' };

export interface ParametrosLista {
  profesionales: number;
  /** Turnos reservables por profesional por día hábil (N̄). */
  turnosPorProfesional: number;
  diasHabiles: number;
  /** Demanda base de turnos [pacientes/día calendario]. */
  demandaBase: number;
  /** Pico de demanda: +aumento durante `duracion` semanas desde la semana `inicio`; null = estable. */
  pico: { inicio: number; duracion: number; aumento: number } | null;
  /** Fracción de los ausentes que vuelve a pedir turno. */
  reingreso: number;
  /** Desaliento: fracción de la demanda que se va cuando la anticipación supera el umbral (rampa lineal). */
  desaliento: { umbral: number; ancho: number; maximo: number };
  /** Tiempo mínimo entre pedir el turno y la consulta [días]. */
  tiempoMinimo: number;
  /** Logística del ausentismo del modelo del día y su tabla de anticipación. */
  beta0: number;
  beta1: number;
  anticipacion: { valor: number; frecuencia: number }[];
  horizonteSemanas: number;
}

export type Metodo = 'euler' | 'rk4';

/** Índices del vector de estado. */
const L = 0, DEM = 1, ATE = 2, AUSP = 3, DES = 4, CONS = 5, AUS = 6, BEN = 7;
export const NOMBRES_ESTADO = ['L', 'demanda', 'atendidos', 'ausentesPerdidos', 'desalentados', 'consumo', 'ausentes', 'beneficio'] as const;

const logistica = (x: number): number => 1 / (1 + Math.exp(-x));

/** Anticipación media de la tabla del modelo del día [días]. */
export function anticipacionMediaTabla(prm: ParametrosLista): number {
  const tot = prm.anticipacion.reduce((s, f) => s + f.frecuencia, 0);
  return prm.anticipacion.reduce((s, f) => s + f.frecuencia * f.valor, 0) / tot;
}

/**
 * Ausentismo medio con anticipación media a: la MISMA logística del modelo del día aplicada a la
 * tabla de anticipación reescalada para que su media sea a (en a = media de la tabla reproduce el p̄
 * del modelo del día).
 */
export function ausentismo(prm: ParametrosLista, a: number): number {
  const am = anticipacionMediaTabla(prm);
  const tot = prm.anticipacion.reduce((s, f) => s + f.frecuencia, 0);
  return prm.anticipacion.reduce((s, f) => s + f.frecuencia * logistica(prm.beta0 + prm.beta1 * ((f.valor * a) / am)), 0) / tot;
}

export function desaliento(prm: ParametrosLista, a: number): number {
  const { umbral, ancho, maximo } = prm.desaliento;
  return maximo * Math.min(1, Math.max(0, (a - umbral) / ancho));
}

/** Capacidad [turnos/día calendario] con k sobreturnos por profesional por día hábil. */
export function capacidad(prm: ParametrosLista, k: number): number {
  return (prm.profesionales * (prm.turnosPorProfesional + k) * prm.diasHabiles) / 7;
}

export function demanda(prm: ParametrosLista, t: number): number {
  const s = t / 7;
  const pico = prm.pico && s >= prm.pico.inicio && s < prm.pico.inicio + prm.pico.duracion ? prm.pico.aumento : 0;
  return prm.demandaBase * (1 + pico);
}

/** Beneficio por día hábil interpolado linealmente en el ausentismo (recortado al rango de la tabla). */
export function beneficioInterpolado(tb: TablaBeneficio, k: number, p: number): number {
  const i = tb.ks.indexOf(k);
  const fila = tb.B[i]!;
  if (p <= tb.p[0]!) return fila[0]!;
  if (p >= tb.p[tb.p.length - 1]!) return fila[fila.length - 1]!;
  let j = 0;
  while (tb.p[j + 1]! < p) j++;
  const u = (p - tb.p[j]!) / (tb.p[j + 1]! - tb.p[j]!);
  return fila[j]! + u * (fila[j + 1]! - fila[j]!);
}

/** k que maximiza el beneficio interpolado con ausentismo p (empate: el menor). */
export function mejorK(tb: TablaBeneficio, p: number): number {
  let mejor = tb.ks[0]!;
  for (const k of tb.ks) if (beneficioInterpolado(tb, k, p) > beneficioInterpolado(tb, mejor, p) + 1e-9) mejor = k;
  return mejor;
}

export interface Auxiliares {
  a: number;
  p: number;
  d: number;
  C: number;
  D: number;
  S: number;
}

export function auxiliares(prm: ParametrosLista, t: number, Lval: number, k: number): Auxiliares {
  const C = capacidad(prm, k);
  const a = Lval / C;
  return { a, p: ausentismo(prm, a), d: desaliento(prm, a), C, D: demanda(prm, t), S: Math.min(C, Math.max(0, Lval) / prm.tiempoMinimo) };
}

function derivada(prm: ParametrosLista, tb: TablaBeneficio, t: number, y: Float64Array, k: number): Float64Array {
  const x = auxiliares(prm, t, y[L]!, k);
  const r = prm.reingreso;
  const dy = new Float64Array(8);
  dy[L] = x.D * (1 - x.d) + r * x.p * x.S - x.S;
  dy[DEM] = x.D;
  dy[ATE] = x.S * (1 - x.p);
  dy[AUSP] = (1 - r) * x.p * x.S;
  dy[DES] = x.D * x.d;
  dy[CONS] = x.S;
  dy[AUS] = x.p * x.S;
  // Beneficio por día calendario: B por día hábil × días hábiles/7 × fracción de la agenda usada.
  dy[BEN] = (beneficioInterpolado(tb, k, x.p) * prm.diasHabiles * (x.S / x.C)) / 7;
  return dy;
}

function paso(prm: ParametrosLista, tb: TablaBeneficio, t: number, y: Float64Array, k: number, dt: number, metodo: Metodo): Float64Array {
  const sumar = (a: Float64Array, b: Float64Array, h: number): Float64Array => a.map((v, i) => v + h * b[i]!);
  if (metodo === 'euler') return sumar(y, derivada(prm, tb, t, y, k), dt);
  const k1 = derivada(prm, tb, t, y, k);
  const k2 = derivada(prm, tb, t + dt / 2, sumar(y, k1, dt / 2), k);
  const k3 = derivada(prm, tb, t + dt / 2, sumar(y, k2, dt / 2), k);
  const k4 = derivada(prm, tb, t + dt, sumar(y, k3, dt), k);
  return y.map((v, i) => v + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
}

/** Equilibrio con demanda constante D: raíz de D·(1−d(a)) = min(C, a·C/τ)·(1 − r·p(a)), L* = a*·C. */
export function equilibrio(prm: ParametrosLista, k: number, D = prm.demandaBase): { a: number; L: number; p: number; S: number; saturado: boolean } {
  const C = capacidad(prm, k);
  const g = (a: number): number => D * (1 - desaliento(prm, a)) - Math.min(C, (a * C) / prm.tiempoMinimo) * (1 - prm.reingreso * ausentismo(prm, a));
  let lo = 0;
  let hi = 3650;
  if (g(hi) > 0) return { a: Infinity, L: Infinity, p: ausentismo(prm, hi), S: C, saturado: true };
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (g(m) > 0) lo = m;
    else hi = m;
  }
  const a = (lo + hi) / 2;
  return { a, L: a * C, p: ausentismo(prm, a), S: Math.min(C, (a * C) / prm.tiempoMinimo), saturado: a >= prm.tiempoMinimo };
}

export interface Trayectoria {
  politica: Politica;
  metodo: Metodo;
  dt: number;
  /** Serie diaria (t = 0, 1, …, días). */
  t: number[];
  L: number[];
  a: number[];
  p: number[];
  k: number[];
  demanda: number[];
  /** Acumulados al final de cada día. */
  atendidos: number[];
  perdidos: number[];
  beneficio: number[];
  /** Totales semanales. */
  semanas: { semana: number; atendidos: number; perdidos: number; desalentados: number; ausentesPerdidos: number; beneficio: number; k: number; pObservado: number }[];
  /** Estado final completo (para la conservación). */
  final: Float64Array;
  L0: number;
}

/**
 * Integra el modelo con la política dada. Todas las políticas arrancan en la misma situación: el
 * equilibrio de la demanda base sin sobreturnos (el consultorio de hoy, SD8), salvo que se indique L0.
 */
export function simularLista(prm: ParametrosLista, tb: TablaBeneficio, politica: Politica, opciones: { dt?: number; metodo?: Metodo; L0?: number } = {}): Trayectoria {
  const dt = opciones.dt ?? 0.25;
  const metodo = opciones.metodo ?? 'rk4';
  const dias = prm.horizonteSemanas * 7;
  const L0 = opciones.L0 ?? equilibrio(prm, 0).L;
  // k inicial: el fijo, o el que la regla adaptativa elige con el ausentismo de la situación inicial.
  let k = politica.tipo === 'fija' ? politica.k : mejorK(tb, ausentismo(prm, L0 / capacidad(prm, 0)));
  let y: Float64Array = new Float64Array(8);
  y[L] = L0;
  const pasosPorDia = Math.round(1 / dt);
  const out: Trayectoria = { politica, metodo, dt, t: [], L: [], a: [], p: [], k: [], demanda: [], atendidos: [], perdidos: [], beneficio: [], semanas: [], final: y, L0 };
  let semanaPrev: Float64Array = new Float64Array(y);
  const registrar = (t: number): void => {
    const x = auxiliares(prm, t, y[L]!, k);
    out.t.push(t);
    out.L.push(y[L]!);
    out.a.push(x.a);
    out.p.push(x.p);
    out.k.push(k);
    out.demanda.push(x.D);
    out.atendidos.push(y[ATE]!);
    out.perdidos.push(y[AUSP]! + y[DES]!);
    out.beneficio.push(y[BEN]!);
  };
  registrar(0);
  for (let dia = 0; dia < dias; dia++) {
    for (let s = 0; s < pasosPorDia; s++) y = paso(prm, tb, dia + s * dt, y, k, dt, metodo);
    registrar(dia + 1);
    if ((dia + 1) % 7 === 0) {
      const d = y.map((v, i) => v - semanaPrev[i]!);
      const pObs = d[CONS]! > 0 ? d[AUS]! / d[CONS]! : 0;
      out.semanas.push({ semana: (dia + 1) / 7, atendidos: d[ATE]!, perdidos: d[AUSP]! + d[DES]!, desalentados: d[DES]!, ausentesPerdidos: d[AUSP]!, beneficio: d[BEN]!, k, pObservado: pObs });
      semanaPrev = new Float64Array(y);
      // Política adaptativa: la semana que viene usa el k que maximiza B con el ausentismo observado.
      if (politica.tipo === 'adaptativa') k = mejorK(tb, pObs);
    }
  }
  out.final = y;
  return out;
}

/** Conservación: L + atendidos + ausentes perdidos + desalentados = L0 + demanda acumulada. */
export function errorConservacion(tr: Trayectoria): number {
  const y = tr.final;
  return Math.abs(y[L]! + y[ATE]! + y[AUSP]! + y[DES]! - (tr.L0 + y[DEM]!));
}
