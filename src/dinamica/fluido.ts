/**
 * Parte A · Modelo fluido de la jornada (Cap. 7 contra Cap. 3): una sala de espera por profesional
 * como stock continuo y determinista. Entrada = tasa esperada de pacientes que pasan a la sala
 * (turnos que vienen, sobreturnos y espontáneos), salida = capacidad de atención cuando hay stock.
 * Usa los mismos parámetros medios que el modelo del día, sin su variabilidad.
 */
import {
  construirDistribucion,
  esSlotCupo,
  prepararEscenario,
  probabilidadNoShow,
  ubicarSobreturnos,
  UniformeFijo,
  type Escenario,
} from '../modelo';

export interface ResultadoFluido {
  /** Grilla de 5 minutos (minutos desde las 00:00). */
  t: number[];
  /** Pacientes esperando en la sala (suma de los profesionales). */
  sala: number[];
  /** Tasa de entrada a la sala [pac/min] y capacidad de atención disponible [pac/min]. */
  entrada: number[];
  capacidad: number[];
  /** Pacientes·minuto en sala en el día (área bajo la curva). */
  area: number;
  /** Pacientes que pasan por la sala en el día. */
  pacientes: number;
  /** Espera media por paciente por la Ley de Little: área / pacientes [min]. */
  esperaMedia: number;
  maximo: number;
}

/** Media de una distribución de tiempo, por cuantiles (sirve para cualquier forma declarada). */
function cuantiles(d: Parameters<typeof construirDistribucion>[0], m = 200): number[] {
  const dist = construirDistribucion(d);
  const u = new UniformeFijo();
  return Array.from({ length: m }, (_, i) => {
    u.u = (i + 0.5) / m;
    return dist.muestrear(u);
  });
}

export function modeloFluido(e: Escenario, opciones: { dt?: number; desde?: number; hasta?: number } = {}): ResultadoFluido {
  const dt = opciones.dt ?? 0.25;
  const desde = opciones.desde ?? 7 * 60;
  const hasta = opciones.hasta ?? 21 * 60 + 30;
  const prep = prepararEscenario(e);
  const n = Math.round((hasta - desde) / dt);
  const nProf = e.profesionales.length;
  const entradaTurno = Array.from({ length: nProf }, () => new Float64Array(n));
  const entradaEsp = Array.from({ length: nProf }, () => new Float64Array(n));
  const idx = (t: number): number => Math.floor((t - desde) / dt);
  const sumar = (arr: Float64Array, t: number, masa: number): void => {
    const i = idx(t);
    if (i >= 0 && i < n) arr[i] = arr[i]! + masa / dt;
  };

  // Retrasos: desvío de puntualidad y paso por admisión (cuantiles de sus distribuciones).
  const desvio = cuantiles(e.puntualidad.desvio);
  const admision = e.admision.recepcionistas > 0 ? cuantiles(e.admision.tiempo, 20) : [0];
  const tabla = e.pacientes.anticipacion;
  const totalF = tabla.reduce((s, f) => s + f.frecuencia, 0);
  const pRegular = tabla.reduce((s, f) => s + f.frecuencia * probabilidadNoShow(e, f.valor), 0) / totalF;
  const pSobre = probabilidadNoShow(e, e.pacientes.anticipacionSobreturno);

  e.profesionales.forEach((p, i) => {
    const turno = prep.turnos[i]!;
    const slots = prep.slots[i]!;
    const candidatos: number[] = [];
    for (let j = 0; j < slots; j++) {
      if (esSlotCupo(j, p.cuposEspontaneos.cadaN)) continue;
      candidatos.push(j);
      const hora = turno.inicio + j * p.duracionTurno;
      const masa = p.ocupacionAgenda * (1 - pRegular);
      for (const d of desvio) for (const a of admision) sumar(entradaTurno[i]!, hora + d + a, masa / (desvio.length * admision.length));
    }
    // Sobreturnos: para el fluido se usa la ubicación esperada de la política (intercalado, inicio o final).
    const pol = p.sobreturnos.politica === 'mayor_ausentismo' ? 'intercalado' : p.sobreturnos.politica;
    for (const j of ubicarSobreturnos(pol, p.sobreturnos.k, candidatos, [])) {
      const hora = j < 0 ? turno.inicio + slots * p.duracionTurno : turno.inicio + j * p.duracionTurno;
      for (const d of desvio) for (const a of admision) sumar(entradaTurno[i]!, hora + d + a, (1 - pSobre) / (desvio.length * admision.length));
    }
  });

  // Espontáneos: tasa por hora × mezcla renormalizada; se reparten entre los profesionales de la
  // especialidad que admiten a esa hora (los demás se pierden en la puerta, como en el modelo del día).
  const tasas = e.espontaneos.tasasPorHora;
  for (let k = 0; k < n; k++) {
    const t = desde + (k + 0.5) * dt;
    const h = Math.floor((t - e.jornada.inicio) / 60);
    if (h < 0 || h >= tasas.length) continue;
    for (const { especialidad, acumulada } of prep.mezclaAcumulada.map((m, j, arr) => ({ especialidad: m.especialidad, acumulada: m.acumulada - (j > 0 ? arr[j - 1]!.acumulada : 0) }))) {
      const abiertos = e.profesionales.map((_, i) => i).filter((i) => {
        const p = e.profesionales[i]!;
        const tr = prep.turnos[i]!;
        return p.especialidad === especialidad && t >= tr.inicio && t < tr.fin - e.espontaneos.cierreAntesDelFin;
      });
      if (abiertos.length === 0) continue;
      const tasa = ((tasas[h]! / 60) * acumulada) / abiertos.length;
      const adm = admision.reduce((s, a) => s + a, 0) / admision.length;
      for (const i of abiertos) sumar(entradaEsp[i]!, t + adm, tasa * dt);
    }
  }

  // Capacidad: 1 / duración media de la consulta (mezcla de turnos y espontáneos), desde la llegada media del médico.
  const { proporcionPrimeraVez: pv, atencion } = e.pacientes;
  const W = Array.from({ length: nProf }, () => 0);
  const sala = new Float64Array(n);
  const entrada = new Float64Array(n);
  const capacidad = new Float64Array(n);
  const mu = e.profesionales.map((p, i) => {
    const nt = entradaTurno[i]!.reduce((s, v) => s + v * dt, 0);
    const ne = entradaEsp[i]!.reduce((s, v) => s + v * dt, 0);
    const sTurno = p.duracionTurno * (pv * atencion.factorPrimeraVez + (1 - pv) * atencion.factorControl);
    const sEsp = p.duracionTurno * atencion.factorEspontaneo;
    return (nt + ne) / (nt * sTurno + ne * sEsp || 1);
  });
  const llegaMedico = e.profesionales.map((_, i) => prep.turnos[i]!.inicio + prep.demoras[i]!.media);
  let area = 0;
  let pacientes = 0;
  for (let k = 0; k < n; k++) {
    const t = desde + k * dt;
    for (let i = 0; i < nProf; i++) {
      const ent = entradaTurno[i]![k]! + entradaEsp[i]![k]!;
      const presente = t >= llegaMedico[i]!;
      const cap = presente ? mu[i]! : 0;
      // Sin stock, la salida no puede superar a la entrada; con stock, sale a capacidad (sin vaciar de más).
      const sal = W[i]! > 0 ? Math.min(cap, W[i]! / dt + ent) : Math.min(cap, ent);
      W[i] = Math.max(0, W[i]! + (ent - sal) * dt);
      entrada[k] = entrada[k]! + ent;
      capacidad[k] = capacidad[k]! + cap;
      pacientes += ent * dt;
    }
    sala[k] = W.reduce((s, v) => s + v, 0);
    area += sala[k]! * dt;
  }

  const paso = Math.round(5 / dt);
  const tt: number[] = [], ss: number[] = [], ee: number[] = [], cc: number[] = [];
  for (let k = 0; k < n; k += paso) {
    tt.push(desde + k * dt);
    ss.push(sala[k]!);
    ee.push(entrada[k]!);
    cc.push(capacidad[k]!);
  }
  return { t: tt, sala: ss, entrada: ee, capacidad: cc, area, pacientes, esperaMedia: area / pacientes, maximo: Math.max(...ss) };
}
