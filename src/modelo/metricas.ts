/**
 * Métricas de un día: por profesional y totales. Se calculan al final, a
 * partir de las marcas de tiempo de cada paciente y de los acumuladores de
 * cada profesional.
 */
import type { EscenarioPreparado } from './preparar';
import type { PacienteSim, ProfesionalSim } from './simulacion';
import { CLASES, MOTIVOS_PERDIDA, type Clase, type MotivoPerdida } from './traza';

/**
 * Espera de un paciente atendido: desde max(llegada, hora del turno) hasta el
 * inicio de la consulta (incluye admisión y la demora del médico); nunca negativa
 * (si se lo adelanta, 0). Para espontáneos y urgencias, desde la llegada.
 */
export function esperaDe(p: { llegada: number; horaTurno: number | null; inicioConsulta: number }): number {
  const desde = p.horaTurno === null ? p.llegada : Math.max(p.llegada, p.horaTurno);
  return Math.max(0, p.inicioConsulta - desde);
}

export interface ResumenEspera {
  n: number;
  media: number;
  /** Percentil 90 (interpolación lineal entre estadísticos de orden). */
  p90: number;
  max: number;
}

/**
 * Costo clásico de la bibliografía de agendamiento (CONTRASTE: se informa, no decide):
 * C = c_espera·espera + c_ocio·ocio + c_extra·horas extra + c_perdido·perdidos.
 */
export interface Costos {
  espera: number;
  ocio: number;
  extra: number;
  perdidos: number;
  total: number;
}

/**
 * Beneficio neto (criterio ÚNICO de decisión): B = ingresos − c_espera·espera − c_extra·extra − c_perdido·perdidos.
 * El ocio no se resta: ya está reflejado en las consultas que no se facturan.
 * C + B = ingresos + c_ocio·ocio, que es constante solo si cada consulta adicional ocurre dentro
 * del turno y con la duración media; las consultas en horas extra (o más cortas) rompen la
 * equivalencia. B es el criterio ÚNICO de decisión; C se informa como contraste.
 */
export function beneficioDe(ingresos: number, c: Costos): number {
  return ingresos - c.espera - c.extra - c.perdidos;
}

export interface MetricasProfesional {
  id: string;
  nombre: string;
  especialidad: string;
  inicioTurno: number;
  finTurno: number;
  llegada: number;
  salida: number;
  ocio: number;
  horasExtra: number;
  /** Minutos atendiendo / minutos presente. */
  utilizacion: number;
  atendidos: Record<Clase, number>;
  atendidosTotal: number;
  ausentes: number;
  /** Pacientes con turno con este profesional que se perdieron (tardíos rechazados). */
  perdidosPropios: number;
  espera: Record<Clase, ResumenEspera>;
  /** Costo de ocio efectivo de este profesional [$/min] (fijo o derivado). */
  cOcio: number;
  /** Costo de hora extra efectivo de este profesional [$/min] (fijo o derivado). */
  cExtra: number;
  costos: Costos;
  ingresos: number;
  /** Beneficio neto B de este profesional (perdidos: solo sus tardíos rechazados). */
  beneficio: number;
}

export interface SerieSala {
  t: number[];
  /** En admisión (cola + atención). */
  admision: number[];
  /** En sala de espera del consultorio. */
  sala: number[];
  enConsulta: number[];
}

export interface MetricasDia {
  porProfesional: MetricasProfesional[];
  /** Pacientes generados: con turno reservado (vengan o no) + espontáneos. */
  llegadas: number;
  espera: Record<Clase | 'todas', ResumenEspera>;
  esperaAdmision: ResumenEspera;
  /** Espera en la sala del consultorio: inicio de consulta − fin de admisión. */
  esperaSala: ResumenEspera;
  ocio: number;
  horasExtra: number;
  utilizacionMedicos: number;
  utilizacionAdmision: number;
  atendidos: Record<Clase, number>;
  atendidosTotal: number;
  ausentes: number;
  perdidos: Record<MotivoPerdida, number>;
  perdidosTotal: number;
  /** Costo clásico C (contraste). */
  costos: Costos;
  ingresos: number;
  /** Beneficio neto B (criterio único de decisión). */
  beneficio: number;
  /** Primera llegada al edificio y última salida (de pacientes o médicos). */
  inicioDia: number;
  finDia: number;
  /** Ley de Little sobre el día: L = ∫N(t)dt / T, λ = n / T, W = Σ permanencias / n. */
  little: { L: number; lambda: number; W: number; n: number; T: number };
  serie: SerieSala | null;
}

export function resumir(valores: number[]): ResumenEspera {
  const n = valores.length;
  if (n === 0) return { n: 0, media: NaN, p90: NaN, max: NaN };
  const orden = [...valores].sort((a, b) => a - b);
  const pos = 0.9 * (n - 1);
  const i = Math.floor(pos);
  const p90 = orden[i]! + (pos - i) * ((orden[Math.min(i + 1, n - 1)] ?? orden[i]!) - orden[i]!);
  return { n, media: orden.reduce((a, b) => a + b, 0) / n, p90, max: orden[n - 1]! };
}

const porClase = <T>(f: (c: Clase) => T): Record<Clase, T> =>
  Object.fromEntries(CLASES.map((c) => [c, f(c)])) as Record<Clase, T>;

export function calcularMetricas(
  prep: EscenarioPreparado,
  pacientes: readonly PacienteSim[],
  profs: readonly ProfesionalSim[],
  opciones: { inicioMedicion: number; serie: boolean; pasoSerie: number },
): MetricasDia {
  const { costos: c, admision } = prep.escenario;
  const medible = (p: PacienteSim): boolean => p.llegada >= opciones.inicioMedicion;
  const atendidos = pacientes.filter((p) => p.estado === 'atendido');
  const esperas = new Map<PacienteSim, number>(atendidos.map((p) => [p, esperaDe(p)]));

  /** `costoOcio` y `costoExtra` ya vienen en pesos (cada profesional tiene su c_ocio y su c_extra). */
  const costosDe = (espera: number, costoOcio: number, costoExtra: number, perdidos: number): Costos => {
    const k = { espera: c.espera * espera, ocio: costoOcio, extra: costoExtra, perdidos: c.perdido * perdidos };
    return { ...k, total: k.espera + k.ocio + k.extra + k.perdidos };
  };

  const porProfesional = profs.map((p): MetricasProfesional => {
    const suyos = atendidos.filter((x) => x.atendidoPor === p.idx);
    const horasExtra = Math.max(0, p.salida - p.finTurno);
    const perdidosPropios = p.propios.filter((x) => x.estado === 'perdido').length;
    const sumaEspera = suyos.reduce((s, x) => s + esperas.get(x)!, 0);
    const cOcio = prep.cOcio[p.idx]!;
    const cExtra = prep.cExtra[p.idx]!;
    const costos = costosDe(sumaEspera, cOcio * p.ocio, cExtra * horasExtra, perdidosPropios);
    const ingresos = c.honorario * suyos.length;
    return {
      id: p.cfg.id,
      nombre: p.cfg.nombre,
      especialidad: p.cfg.especialidad,
      inicioTurno: p.inicioTurno,
      finTurno: p.finTurno,
      llegada: p.llegada,
      salida: p.salida,
      ocio: p.ocio,
      horasExtra,
      utilizacion: p.salida > p.llegada ? p.ocupado / (p.salida - p.llegada) : 0,
      atendidos: porClase((cl) => suyos.filter((x) => x.clase === cl).length),
      atendidosTotal: suyos.length,
      ausentes: p.propios.filter((x) => x.estado === 'ausente').length,
      perdidosPropios,
      espera: porClase((cl) => resumir(suyos.filter((x) => x.clase === cl && medible(x)).map((x) => esperas.get(x)!))),
      cOcio,
      cExtra,
      costos,
      ingresos,
      beneficio: beneficioDe(ingresos, costos),
    };
  });

  const medidos = atendidos.filter(medible);
  const espera = {
    ...porClase((cl) => resumir(medidos.filter((x) => x.clase === cl).map((x) => esperas.get(x)!))),
    todas: resumir(medidos.map((x) => esperas.get(x)!)),
  };
  const conAdmision = pacientes.filter((p) => p.entro && !Number.isNaN(p.inicioAdmision) && medible(p));
  const esperaAdmision = resumir(conAdmision.map((p) => p.inicioAdmision - p.llegada));
  const esperaSala = resumir(medidos.map((p) => p.inicioConsulta - p.finAdmision));

  const perdidos = Object.fromEntries(MOTIVOS_PERDIDA.map((m) => [m, pacientes.filter((p) => p.motivo === m).length])) as Record<MotivoPerdida, number>;
  const perdidosTotal = Object.values(perdidos).reduce((a, b) => a + b, 0);
  const ocio = porProfesional.reduce((s, p) => s + p.ocio, 0);
  const horasExtra = porProfesional.reduce((s, p) => s + p.horasExtra, 0);
  const sumaEspera = atendidos.reduce((s, x) => s + esperas.get(x)!, 0);
  const costoOcio = porProfesional.reduce((s, p) => s + p.costos.ocio, 0);
  const costoExtra = porProfesional.reduce((s, p) => s + p.costos.extra, 0);
  const costos = costosDe(sumaEspera, costoOcio, costoExtra, perdidosTotal);
  const ingresos = c.honorario * atendidos.length;

  // Little: N(t) = pacientes dentro del edificio. ∫N dt por barrido de entradas y salidas.
  const entraron = pacientes.filter((p) => p.entro);
  const cambios: [number, number][] = [];
  for (const p of entraron) cambios.push([p.llegada, 1], [p.salida, -1]);
  cambios.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let integral = 0;
  let N = 0;
  let tPrev = cambios.length ? cambios[0]![0] : 0;
  for (const [t, d] of cambios) {
    integral += N * (t - tPrev);
    N += d;
    tPrev = t;
  }
  const tIni = cambios.length ? cambios[0]![0] : 0;
  const tFinPac = cambios.length ? cambios[cambios.length - 1]![0] : 0;
  const T = tFinPac - tIni;
  const nEntr = entraron.length;
  const little = {
    L: T > 0 ? integral / T : 0,
    lambda: T > 0 ? nEntr / T : 0,
    W: nEntr > 0 ? entraron.reduce((s, p) => s + (p.salida - p.llegada), 0) / nEntr : 0,
    n: nEntr,
    T,
  };

  let inicioDia = prep.escenario.jornada.inicio;
  for (const p of pacientes) if (!p.ausente && p.llegada < inicioDia) inicioDia = p.llegada;
  for (const p of profs) if (p.llegada < inicioDia) inicioDia = p.llegada;
  const finDia = profs.reduce((m, p) => Math.max(m, p.salida), tFinPac);
  const presencia = profs.reduce((s, p) => s + Math.max(0, p.salida - p.llegada), 0);
  const ocupado = profs.reduce((s, p) => s + p.ocupado, 0);
  const tiempoAdmision = entraron.reduce((s, p) => s + (Number.isNaN(p.finAdmision) ? 0 : Math.max(0, p.finAdmision - p.inicioAdmision)), 0);

  return {
    porProfesional,
    llegadas: pacientes.length,
    espera,
    esperaAdmision,
    esperaSala,
    ocio,
    horasExtra,
    utilizacionMedicos: presencia > 0 ? ocupado / presencia : 0,
    utilizacionAdmision: admision.recepcionistas > 0 && finDia > inicioDia ? tiempoAdmision / (admision.recepcionistas * (finDia - inicioDia)) : 0,
    atendidos: porClase((cl) => atendidos.filter((x) => x.clase === cl).length),
    atendidosTotal: atendidos.length,
    ausentes: pacientes.filter((p) => p.estado === 'ausente').length,
    perdidos,
    perdidosTotal,
    costos,
    ingresos,
    beneficio: beneficioDe(ingresos, costos),
    inicioDia,
    finDia,
    little,
    serie: opciones.serie ? serieSala(entraron, inicioDia, finDia, opciones.pasoSerie) : null,
  };
}

/** Cantidad de pacientes en cada etapa, muestreada cada `paso` minutos (barrido de cambios). */
function serieSala(entraron: readonly PacienteSim[], inicio: number, fin: number, paso: number): SerieSala {
  // Etapa 0 = admisión [llegada, finAdmision), 1 = sala [finAdmision, inicioConsulta | salida), 2 = consulta.
  const cambios: [number, number, number][] = [];
  for (const p of entraron) {
    const finAdm = Number.isNaN(p.finAdmision) ? p.salida : p.finAdmision;
    cambios.push([p.llegada, 0, 1], [finAdm, 0, -1]);
    if (!Number.isNaN(p.finAdmision)) {
      const finSala = Number.isNaN(p.inicioConsulta) ? p.salida : p.inicioConsulta;
      cambios.push([p.finAdmision, 1, 1], [finSala, 1, -1]);
    }
    if (!Number.isNaN(p.inicioConsulta)) cambios.push([p.inicioConsulta, 2, 1], [p.finConsulta, 2, -1]);
  }
  cambios.sort((a, b) => a[0] - b[0]);
  const serie: SerieSala = { t: [], admision: [], sala: [], enConsulta: [] };
  const n = [0, 0, 0];
  let i = 0;
  const t0 = Math.floor(inicio / paso) * paso;
  for (let t = t0; t <= fin + paso; t += paso) {
    while (i < cambios.length && cambios[i]![0] <= t) {
      const [, etapa, delta] = cambios[i]!;
      n[etapa] = n[etapa]! + delta;
      i++;
    }
    serie.t.push(t);
    serie.admision.push(n[0]!);
    serie.sala.push(n[1]!);
    serie.enConsulta.push(n[2]!);
  }
  return serie;
}
