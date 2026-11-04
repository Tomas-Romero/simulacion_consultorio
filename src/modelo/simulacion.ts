/**
 * Simulación de UN día del policonsultorio con el motor de eventos discretos.
 *
 * Flujo del paciente: llegada → admisión (recurso del motor, cola con urgencias
 * primero) → sala (colas del consultorio) → consulta → salida.
 *
 * Colas del consultorio:
 * - por profesional: puntuales (turno y sobreturno, por hora de turno) y tardíos (FIFO);
 * - por especialidad, compartidas: urgencias y espontáneos (FIFO).
 * Regla del médico al quedar libre: (a) urgencias de su especialidad, (b) sus
 * puntuales, (c) sus tardíos, (d) espontáneos de su especialidad. (a) y (d) solo
 * si es "responsable" de la especialidad: está en turno, o ya terminó y no queda
 * otro profesional de la especialidad en turno.
 * Cupos acumulables: cada profesional lleva su deuda de cupos = (cupos cuya hora de
 * inicio ya pasó) − (espontáneos que atendió usando cupo). Con deuda > 0 y un
 * espontáneo esperando, el orden es (a), (d), (b), (c), y esa consulta consume un cupo.
 */
import { MonticuloBinario, Recurso, Simulador, type EventoProgramado, type Solicitud } from '../motor';
import { generarDia, type DiaGenerado, type PacienteGenerado } from './agenda';
import type { Especialidad, Profesional } from './escenario';
import { calcularMetricas, esperaDe, type MetricasDia } from './metricas';
import { iniciosCupos, type EscenarioPreparado } from './preparar';
import {
  PRIORIDAD_CLASE,
  type Clase,
  type Etapa,
  type EventoProfesional,
  type MotivoPerdida,
  type PacienteTraza,
  type RegistroConsultorio,
  type TrazaDia,
} from './traza';

export type EstadoPaciente = 'por_llegar' | 'cola_admision' | 'admision' | 'sala' | 'consulta' | 'atendido' | 'perdido' | 'ausente';

export interface PacienteSim extends PacienteGenerado {
  readonly tipo: string;
  readonly tCreacion: number;
  clase: Clase;
  estado: EstadoPaciente;
  /** true si entró al policonsultorio (llegó y no fue rechazado en la puerta). */
  entro: boolean;
  inicioAdmision: number;
  finAdmision: number;
  inicioConsulta: number;
  finConsulta: number;
  salida: number;
  atendidoPor: number;
  motivo: MotivoPerdida | null;
  solicitud: Solicitud | null;
  eventoAbandono: EventoProgramado | null;
  pacienciaAgotada: boolean;
}

export type EstadoProfesional = 'ausente' | 'libre' | 'atendiendo' | 'retirado';

export interface ProfesionalSim {
  readonly idx: number;
  readonly cfg: Profesional;
  readonly inicioTurno: number;
  readonly finTurno: number;
  readonly llegada: number;
  salida: number;
  estado: EstadoProfesional;
  libreDesde: number;
  /** Minutos dentro del turno, presente y sin paciente. */
  ocio: number;
  /** Minutos atendiendo. */
  ocupado: number;
  readonly puntuales: MonticuloBinario<PacienteSim>;
  readonly tardios: ColaFifo;
  readonly propios: PacienteSim[];
  /** Hora absoluta de inicio de cada cupo de su agenda (ordenadas). */
  readonly iniciosCupos: readonly number[];
  /** Espontáneos atendidos por él usando cupo. */
  cuposUsados: number;
}

/** Cola FIFO con borrado perezoso (los que abandonan se saltean al sacar). */
class ColaFifo {
  private items: PacienteSim[] = [];
  private cabeza = 0;
  push(p: PacienteSim): void {
    this.items.push(p);
  }
  /** Saca el primero que todavía espera en sala. */
  sacar(): PacienteSim | undefined {
    while (this.cabeza < this.items.length) {
      const p = this.items[this.cabeza++]!;
      if (p.estado === 'sala') {
        if (this.cabeza > 64 && this.cabeza * 2 > this.items.length) {
          this.items = this.items.slice(this.cabeza);
          this.cabeza = 0;
        }
        return p;
      }
    }
    return undefined;
  }
}

export interface OpcionesDia {
  semilla: number;
  replica?: number;
  /** Registrar la traza del día (desactivar en corridas Monte Carlo). */
  traza?: boolean;
  /** Calcular la serie temporal de la sala de espera. */
  serie?: boolean;
  /** Paso de la serie temporal [min]. */
  pasoSerie?: number;
  /** Solo los pacientes que llegan desde este instante entran en las estadísticas de espera (validación). */
  inicioMedicion?: number;
  /** Día ya generado (solo para tests de reglas): reemplaza a generarDia. */
  dia?: DiaGenerado;
}

export interface VerificacionDia {
  /** Pacientes que entraron y no salieron (debe ser 0). */
  enSistemaAlFinal: number;
  /** Pacientes sin resultado final (debe ser 0). */
  sinResolver: number;
  eventosPendientes: number;
  profesionalesSinRetirar: number;
}

export interface ResultadoDia {
  metricas: MetricasDia;
  pacientes: PacienteTraza[];
  traza: TrazaDia | null;
  eventos: number;
  verificacion: VerificacionDia;
}

const NAN = Number.NaN;

export function simularDia(prep: EscenarioPreparado, opciones: OpcionesDia): ResultadoDia {
  const { escenario } = prep;
  const replica = opciones.replica ?? 0;
  const conTraza = opciones.traza ?? false;
  const { puntualidad, espontaneos: cfgEsp, pacientes: cfgPac } = escenario;
  const tol = puntualidad.tolerancia;
  const dia = opciones.dia ?? generarDia(prep, opciones.semilla, replica);

  const sim = new Simulador({ tInicial: 0 });
  const admision = escenario.admision.recepcionistas > 0 ? new Recurso(sim, 'admision', escenario.admision.recepcionistas, 'PRIORIDAD') : null;
  const registros: RegistroConsultorio[] = [];
  const eventosProf: EventoProfesional[] = [];
  let seq = 0;
  let enSistema = 0;

  // ------------------------------------------------------------ estado
  const profs: ProfesionalSim[] = escenario.profesionales.map((cfg, idx) => ({
    idx,
    cfg,
    inicioTurno: prep.turnos[idx]!.inicio,
    finTurno: prep.turnos[idx]!.fin,
    llegada: prep.turnos[idx]!.inicio + dia.demoras[idx]!,
    salida: NAN,
    estado: 'ausente',
    libreDesde: NAN,
    ocio: 0,
    ocupado: 0,
    puntuales: new MonticuloBinario<PacienteSim>((a, b) => a.horaTurno! - b.horaTurno! < 0 || (a.horaTurno === b.horaTurno && a.id < b.id)),
    tardios: new ColaFifo(),
    propios: [],
    iniciosCupos: iniciosCupos(prep.esCupo[idx]!, cfg.duracionTurno).map((m) => prep.turnos[idx]!.inicio + m),
    cuposUsados: 0,
  }));
  const porEspecialidad = new Map<Especialidad, ProfesionalSim[]>();
  for (const p of profs) {
    const lista = porEspecialidad.get(p.cfg.especialidad);
    if (lista) lista.push(p);
    else porEspecialidad.set(p.cfg.especialidad, [p]);
  }
  const colaUrgencias = new Map<Especialidad, ColaFifo>();
  const colaEspontaneos = new Map<Especialidad, ColaFifo>();
  const enAdmisionEsp = new Map<Especialidad, number>();
  for (const e of porEspecialidad.keys()) {
    colaUrgencias.set(e, new ColaFifo());
    colaEspontaneos.set(e, new ColaFifo());
    enAdmisionEsp.set(e, 0);
  }

  const pacientes: PacienteSim[] = dia.pacientes.map((g) => ({
    ...g,
    tipo: g.origen,
    tCreacion: g.llegada,
    clase: g.urgencia ? 'urgencia' : g.origen,
    estado: 'por_llegar',
    entro: false,
    inicioAdmision: NAN,
    finAdmision: NAN,
    inicioConsulta: NAN,
    finConsulta: NAN,
    salida: NAN,
    atendidoPor: -1,
    motivo: null,
    solicitud: null,
    eventoAbandono: null,
    pacienciaAgotada: false,
  }));
  for (const pac of pacientes) if (pac.profesional >= 0) profs[pac.profesional]!.propios.push(pac);

  // ------------------------------------------------------------ traza
  const reg = (pac: PacienteSim, tipo: RegistroConsultorio['tipo'], etapa: Etapa, extra: { recurso?: string; unidad?: number; detalle?: string } = {}): void => {
    if (!conTraza) return;
    const iProf = pac.atendidoPor >= 0 ? pac.atendidoPor : pac.profesional;
    registros.push({
      t: sim.reloj,
      seq: seq++,
      entidad: pac.id,
      tipo,
      clase: pac.clase,
      prioridad: PRIORIDAD_CLASE[pac.clase],
      profesional: iProf >= 0 ? profs[iProf]!.cfg.id : null,
      etapa,
      ...extra,
    });
  };
  const regProf = (p: ProfesionalSim, tipo: EventoProfesional['tipo'], paciente: number | null = null): void => {
    if (conTraza) eventosProf.push({ t: sim.reloj, profesional: p.cfg.id, tipo, paciente });
  };

  // ------------------------------------------------------------ reglas
  const enTurno = (p: ProfesionalSim, t: number): boolean => t >= p.inicioTurno && t < p.finTurno;

  const responsable = (p: ProfesionalSim): boolean => {
    const t = sim.reloj;
    if (t < p.finTurno) return true;
    for (const q of porEspecialidad.get(p.cfg.especialidad)!) {
      if (q !== p && q.estado !== 'retirado' && enTurno(q, t)) return false;
    }
    return true;
  };

  const factorClase = (pac: PacienteSim): number => {
    const at = cfgPac.atencion;
    if (pac.clase === 'urgencia') return at.factorUrgencia;
    if (pac.clase === 'espontaneo') return at.factorEspontaneo;
    return pac.primeraVez ? at.factorPrimeraVez : at.factorControl;
  };

  const acumularOcio = (p: ProfesionalSim): void => {
    const desde = Math.max(p.libreDesde, p.llegada);
    const hasta = Math.min(sim.reloj, p.finTurno);
    if (hasta > desde) p.ocio += hasta - desde;
  };

  /** Deuda de cupos de p: cupos cuya hora de inicio ya pasó − espontáneos atendidos con cupo. */
  const deudaCupos = (p: ProfesionalSim): number => {
    let vencidos = 0;
    while (vencidos < p.iniciosCupos.length && p.iniciosCupos[vencidos]! <= sim.reloj) vencidos++;
    return vencidos - p.cuposUsados;
  };

  const proximoPara = (p: ProfesionalSim): PacienteSim | undefined => {
    const esp = p.cfg.especialidad;
    const resp = responsable(p);
    if (resp) {
      const u = colaUrgencias.get(esp)!.sacar();
      if (u) return u;
      // Con cupos adeudados: (a) urgencias, (d) espontáneos, (b) puntuales, (c) tardíos; consume un cupo.
      if (deudaCupos(p) > 0) {
        const e = colaEspontaneos.get(esp)!.sacar();
        if (e) {
          p.cuposUsados++;
          return e;
        }
      }
    }
    const puntual = p.puntuales.extraerMinimo();
    if (puntual) return puntual;
    const tardio = p.tardios.sacar();
    if (tardio) return tardio;
    if (resp) return colaEspontaneos.get(esp)!.sacar();
    return undefined;
  };

  const iniciarConsulta = (p: ProfesionalSim, pac: PacienteSim): void => {
    acumularOcio(p);
    p.estado = 'atendiendo';
    pac.estado = 'consulta';
    pac.inicioConsulta = sim.reloj;
    pac.atendidoPor = p.idx;
    if (pac.eventoAbandono) {
      sim.cancelar(pac.eventoAbandono);
      pac.eventoAbandono = null;
    }
    const duracion = pac.factorAtencion * factorClase(pac) * p.cfg.duracionTurno;
    p.ocupado += duracion;
    reg(pac, 'inicio_servicio', 'consultorio', { recurso: p.cfg.id });
    regProf(p, 'inicia_consulta', pac.id);
    sim.programar(duracion, () => finConsulta(p, pac), 'fin_consulta');
  };

  const finConsulta = (p: ProfesionalSim, pac: PacienteSim): void => {
    pac.finConsulta = sim.reloj;
    pac.salida = sim.reloj;
    pac.estado = 'atendido';
    enSistema--;
    reg(pac, 'fin_servicio', 'consultorio', { recurso: p.cfg.id });
    reg(pac, 'salida', 'salida');
    regProf(p, 'termina_consulta', pac.id);
    p.estado = 'libre';
    p.libreDesde = sim.reloj;
    intentarAtender(p);
  };

  /** El médico se va si terminó su turno, está libre y no espera a nadie. */
  const intentarRetirar = (p: ProfesionalSim): void => {
    const t = sim.reloj;
    if (p.estado !== 'libre' || t < p.finTurno) return;
    for (const pac of p.propios) {
      if (pac.estado === 'cola_admision' || pac.estado === 'admision' || pac.estado === 'sala') return;
      // Espera a sus pacientes mientras siga abierta su ventana de puntualidad (no sabe quién va a faltar).
      if (pac.estado === 'por_llegar' && pac.horaTurno! + tol > t) return;
    }
    if (responsable(p) && enAdmisionEsp.get(p.cfg.especialidad)! > 0) return;
    acumularOcio(p);
    p.estado = 'retirado';
    p.salida = t;
    regProf(p, 'se_retira');
  };

  const intentarAtender = (p: ProfesionalSim): boolean => {
    if (p.estado !== 'libre') return false;
    const pac = proximoPara(p);
    if (pac) {
      iniciarConsulta(p, pac);
      return true;
    }
    if (sim.reloj >= p.finTurno) intentarRetirar(p);
    return false;
  };

  /** Ofrece la cola de una especialidad a sus profesionales libres, primero al que está libre hace más tiempo. */
  const despacharEspecialidad = (esp: Especialidad): void => {
    const libres = porEspecialidad.get(esp)!.filter((p) => p.estado === 'libre');
    libres.sort((a, b) => a.libreDesde - b.libreDesde || a.idx - b.idx);
    for (const p of libres) {
      if (responsable(p) && intentarAtender(p)) return;
    }
    // Si nadie lo tomó, puede que algún libre fuera de turno ya pueda irse.
    for (const p of libres) if (p.estado === 'libre' && sim.reloj >= p.finTurno) intentarRetirar(p);
  };

  const revisarProfesionalesLibres = (): void => {
    for (const p of profs) if (p.estado === 'libre') intentarAtender(p);
  };

  const perder = (pac: PacienteSim, motivo: MotivoPerdida): void => {
    pac.estado = 'perdido';
    pac.motivo = motivo;
    pac.salida = sim.reloj;
    if (pac.entro) enSistema--;
    if (motivo === 'abandono') reg(pac, 'abandono', Number.isNaN(pac.finAdmision) ? 'admision' : 'sala');
    else reg(pac, 'marca', 'llegada', { detalle: `rechazado:${motivo}` });
    reg(pac, 'salida', 'salida');
  };

  // ------------------------------------------------------------ flujo del paciente
  const encolarEnSala = (pac: PacienteSim): void => {
    const esp = pac.especialidad;
    switch (pac.clase) {
      case 'urgencia':
        colaUrgencias.get(esp)!.push(pac);
        despacharEspecialidad(esp);
        break;
      case 'espontaneo':
        colaEspontaneos.get(esp)!.push(pac);
        despacharEspecialidad(esp);
        break;
      case 'tardio': {
        const p = profs[pac.profesional]!;
        p.tardios.push(pac);
        intentarAtender(p);
        break;
      }
      default: {
        const p = profs[pac.profesional]!;
        p.puntuales.insertar(pac);
        intentarAtender(p);
      }
    }
  };

  const finAdmision = (pac: PacienteSim): void => {
    pac.finAdmision = sim.reloj;
    if (pac.profesional < 0) enAdmisionEsp.set(pac.especialidad, enAdmisionEsp.get(pac.especialidad)! - 1);
    pac.estado = 'sala';
    reg(pac, 'entra_cola', 'sala');
    const puntual = pac.clase === 'turno' || pac.clase === 'sobreturno';
    if (puntual && !puntualidad.adelantarTurnos && sim.reloj < pac.horaTurno!) {
      // No se lo atiende antes de su hora: espera en sala sin estar en la cola.
      sim.programarEn(pac.horaTurno!, () => encolarEnSala(pac), 'habilita_turno');
      return;
    }
    encolarEnSala(pac);
    // Agotó la paciencia durante la admisión: si no lo atienden en el acto, se va.
    if (pac.estado === 'sala' && pac.pacienciaAgotada) perder(pac, 'abandono');
  };

  const iniciarAdmision = (pac: PacienteSim, unidad: number): void => {
    pac.estado = 'admision';
    pac.inicioAdmision = sim.reloj;
    reg(pac, 'inicio_servicio', 'admision', { recurso: 'admision', unidad });
    sim.programar(
      pac.tiempoAdmision,
      () => {
        // Primero se registra el fin: liberar() le da la unidad al siguiente en el acto.
        reg(pac, 'fin_servicio', 'admision', { recurso: 'admision', unidad });
        admision!.liberar(pac);
        finAdmision(pac);
      },
      'fin_admision',
    );
  };

  const abandono = (pac: PacienteSim): void => {
    pac.eventoAbandono = null;
    if (pac.estado === 'cola_admision') {
      admision!.retirar(pac.solicitud!);
      enAdmisionEsp.set(pac.especialidad, enAdmisionEsp.get(pac.especialidad)! - 1);
      perder(pac, 'abandono');
      for (const p of porEspecialidad.get(pac.especialidad)!) if (p.estado === 'libre') intentarAtender(p);
    } else if (pac.estado === 'admision') {
      pac.pacienciaAgotada = true;
    } else if (pac.estado === 'sala') {
      perder(pac, 'abandono'); // la cola lo saltea al sacar
    }
  };

  /** Decide si un espontáneo puede entrar; si no, el motivo. */
  const admitirEspontaneo = (esp: Especialidad): MotivoPerdida | null => {
    const t = sim.reloj;
    const lista = porEspecialidad.get(esp);
    if (!lista) return 'sin_profesional';
    if (lista.some((p) => t >= p.inicioTurno && t < p.finTurno - cfgEsp.cierreAntesDelFin)) return null;
    if (lista.some((p) => enTurno(p, t))) return 'fuera_de_horario';
    return 'sin_profesional';
  };

  const llegada = (pac: PacienteSim): void => {
    reg(pac, 'llegada', 'llegada');
    if (pac.origen !== 'espontaneo') {
      const p = profs[pac.profesional]!;
      if (sim.reloj > pac.horaTurno! + tol) {
        pac.clase = 'tardio';
        if (puntualidad.politicaTardios === 'pierde_turno' || p.estado === 'retirado') {
          perder(pac, 'tardio_rechazado');
          if (p.estado === 'libre') intentarAtender(p);
          return;
        }
      } else if (p.estado === 'retirado') {
        perder(pac, 'sin_profesional'); // no debería ocurrir: el médico espera hasta hora + tolerancia
        return;
      }
    } else {
      const motivo = admitirEspontaneo(pac.especialidad);
      if (motivo) {
        perder(pac, motivo);
        return;
      }
      enAdmisionEsp.set(pac.especialidad, enAdmisionEsp.get(pac.especialidad)! + 1);
      if (!pac.urgencia && cfgEsp.abandonan) {
        pac.eventoAbandono = sim.programar(pac.paciencia, () => abandono(pac), 'abandono', 1);
      }
    }
    pac.entro = true;
    enSistema++;
    if (!admision) {
      pac.inicioAdmision = sim.reloj;
      finAdmision(pac);
      return;
    }
    pac.estado = 'cola_admision';
    pac.solicitud = admision.solicitar(pac, (unidad) => iniciarAdmision(pac, unidad), { prioridad: pac.urgencia ? 0 : 1 });
    if (pac.estado === 'cola_admision') reg(pac, 'entra_cola', 'admision', { recurso: 'admision' });
  };

  // ------------------------------------------------------------ eventos iniciales
  for (const pac of pacientes) {
    if (!pac.ausente) sim.programarEn(pac.llegada, () => llegada(pac), 'llegada');
    if (pac.horaTurno !== null) {
      // Cierre de la ventana de puntualidad: resuelve a los ausentes y deja que el médico revise si se puede ir.
      sim.programarEn(
        pac.horaTurno + tol,
        () => {
          if (pac.ausente && pac.estado === 'por_llegar') {
            pac.estado = 'ausente';
            if (conTraza) registros.push({ t: sim.reloj, seq: seq++, entidad: pac.id, tipo: 'marca', clase: pac.clase, prioridad: PRIORIDAD_CLASE[pac.clase], profesional: profs[pac.profesional]!.cfg.id, etapa: 'llegada', detalle: 'ausente' });
          }
          const p = profs[pac.profesional]!;
          if (p.estado === 'libre') intentarAtender(p);
        },
        'ventana_puntualidad',
        1,
      );
    }
  }
  for (const p of profs) {
    sim.programarEn(
      p.llegada,
      () => {
        p.estado = 'libre';
        p.libreDesde = sim.reloj;
        regProf(p, 'llega');
        intentarAtender(p);
      },
      'llega_medico',
    );
    sim.programarEn(
      p.finTurno,
      () => {
        regProf(p, 'fin_turno');
        revisarProfesionalesLibres();
      },
      'fin_turno',
      1,
    );
  }

  sim.ejecutar();

  // ------------------------------------------------------------ resultados
  const verificacion: VerificacionDia = {
    enSistemaAlFinal: enSistema,
    sinResolver: pacientes.filter((p) => p.estado !== 'atendido' && p.estado !== 'perdido' && p.estado !== 'ausente').length,
    eventosPendientes: sim.eventosPendientes,
    profesionalesSinRetirar: profs.filter((p) => p.estado !== 'retirado').length,
  };

  const metricas = calcularMetricas(prep, pacientes, profs, {
    inicioMedicion: opciones.inicioMedicion ?? -Infinity,
    serie: opciones.serie ?? true,
    pasoSerie: opciones.pasoSerie ?? 5,
  });

  const nulo = (x: number): number | null => (Number.isNaN(x) ? null : x);
  const tablaPacientes: PacienteTraza[] = pacientes.map((p) => ({
    id: p.id,
    clave: p.clave,
    origen: p.origen,
    claseFinal: p.clase,
    urgencia: p.urgencia,
    especialidad: p.especialidad,
    profesionalTurno: p.profesional >= 0 ? profs[p.profesional]!.cfg.id : null,
    atendidoPor: p.atendidoPor >= 0 ? profs[p.atendidoPor]!.cfg.id : null,
    horaTurno: p.horaTurno,
    llegada: p.llegada,
    ausente: p.ausente,
    inicioAdmision: nulo(p.inicioAdmision),
    finAdmision: nulo(p.finAdmision),
    inicioConsulta: nulo(p.inicioConsulta),
    finConsulta: nulo(p.finConsulta),
    salida: nulo(p.salida),
    espera: p.estado === 'atendido' ? esperaDe(p) : null,
    esperaAdmision: Number.isNaN(p.inicioAdmision) ? null : p.inicioAdmision - p.llegada,
    motivoPerdida: p.motivo,
    resultado: p.estado === 'atendido' ? 'atendido' : p.estado === 'ausente' ? 'ausente' : 'perdido',
  }));

  const traza: TrazaDia | null = conTraza
    ? {
        version: 1,
        escenario,
        semilla: opciones.semilla,
        replica,
        profesionales: profs.map((p) => ({
          id: p.cfg.id,
          nombre: p.cfg.nombre,
          especialidad: p.cfg.especialidad,
          inicioTurno: p.inicioTurno,
          finTurno: p.finTurno,
          llegada: p.llegada,
          salida: p.salida,
        })),
        pacientes: tablaPacientes,
        registros,
        eventosProfesionales: eventosProf,
      }
    : null;

  return { metricas, pacientes: tablaPacientes, traza, eventos: sim.eventosProcesados, verificacion };
}
