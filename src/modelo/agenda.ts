/**
 * Generación del día: agenda de cada profesional, sobreturnos y llegadas
 * espontáneas, con TODOS los atributos de cada paciente pre-muestreados.
 *
 * Números aleatorios comunes: cada paciente tiene su propio flujo, cuyo nombre
 * es su identidad ('P1/t/5' = profesional P1, slot 5; 'P1/s/0' = primer
 * sobreturno de P1; 'e/12' = espontáneo n.º 12 del día). Del flujo se sacan
 * siempre los mismos uniformes en el mismo orden, se usen o no:
 *   u0 reservado · u1 anticipación · u2 ausente · u3 primera vez · u4 puntualidad ·
 *   u5 admisión · u6 atención · u7 paciencia · u8 urgencia · u9 especialidad
 * Así, agregar o quitar sobreturnos (o cambiar cualquier política) no altera
 * los atributos de los demás pacientes.
 */
import { FabricaFlujos, Xoshiro128 } from '../motor';
import type { Especialidad } from './escenario';
import { UniformeFijo, probabilidadNoShow, type EscenarioPreparado } from './preparar';

export type Origen = 'turno' | 'sobreturno' | 'espontaneo';

export interface PacienteGenerado {
  /** Orden de generación dentro del día (no es estable entre escenarios: usar `clave`). */
  readonly id: number;
  /** Identidad estable del paciente, que indexa su flujo aleatorio. */
  readonly clave: string;
  readonly origen: Origen;
  readonly urgencia: boolean;
  /** Índice del profesional con el que tiene turno; −1 para espontáneos. */
  readonly profesional: number;
  readonly especialidad: Especialidad;
  /** Slot de la agenda sobre el que está (−1 para espontáneos y sobreturnos "final"). */
  readonly slot: number;
  /** Hora del turno [min]; null para espontáneos. */
  readonly horaTurno: number | null;
  readonly anticipacion: number | null;
  /** P(no-show) predicha por la logística según la anticipación. */
  readonly pNoShow: number | null;
  readonly ausente: boolean;
  readonly primeraVez: boolean;
  /** Llegada − hora del turno [min]; null para espontáneos. */
  readonly desvioPuntualidad: number | null;
  /** Hora de llegada al policonsultorio [min] (si es ausente, la que habría tenido). */
  readonly llegada: number;
  readonly tiempoAdmision: number;
  /** Factor de media 1 que multiplica la media de atención de su clase. */
  readonly factorAtencion: number;
  /** Tiempo de atención [min] si se atiende como turno con su profesional; null para espontáneos. */
  readonly tiempoAtencionTurno: number | null;
  readonly paciencia: number;
}

export interface DiaGenerado {
  pacientes: PacienteGenerado[];
  /** Demora de cada profesional al iniciar su turno [min]. */
  demoras: number[];
}

/** Índices de slot (o −1 = después del cierre) donde van los k sobreturnos, según la política. */
export function ubicarSobreturnos(politica: string, k: number, n: number, pSlot: readonly number[]): number[] {
  if (k === 0) return [];
  if (n === 0) return Array.from({ length: k }, () => -1);
  switch (politica) {
    case 'inicio':
      return Array.from({ length: k }, (_, i) => i % n);
    case 'intercalado':
      return Array.from({ length: k }, (_, i) => Math.min(n - 1, Math.floor(((i + 1) * n) / (k + 1))));
    case 'mayor_ausentismo': {
      // Mayor P(slot sin paciente): 1 si está libre, si no la P(no-show) predicha. Empate: el más temprano.
      const orden = pSlot.map((p, j) => ({ p, j })).sort((a, b) => b.p - a.p || a.j - b.j);
      return Array.from({ length: k }, (_, i) => orden[i % n]!.j);
    }
    default: // 'final'
      return Array.from({ length: k }, () => -1);
  }
}

export function generarDia(prep: EscenarioPreparado, semilla: number, replica: number): DiaGenerado {
  const { escenario } = prep;
  const { pacientes: cfgPac, espontaneos: cfgEsp } = escenario;
  const fija = new UniformeFijo();
  const muestra = (d: { muestrear: (g: UniformeFijo) => number }, u: number): number => {
    fija.u = u;
    return d.muestrear(fija);
  };
  const flujo = (nombre: string): Xoshiro128 => Xoshiro128.desdeSemilla(FabricaFlujos.semillaDeFlujo(semilla, replica, nombre));

  const pacientes: PacienteGenerado[] = [];
  const demoras: number[] = [];
  const at = cfgPac.atencion;

  const crearConTurno = (
    origen: 'turno' | 'sobreturno',
    clave: string,
    iProf: number,
    slot: number,
    horaTurno: number,
    u: number[],
  ): void => {
    const prof = escenario.profesionales[iProf]!;
    const anticipacion = origen === 'turno' ? muestra(prep.anticipacion, u[1]!) : cfgPac.anticipacionSobreturno;
    const pNoShow = probabilidadNoShow(escenario, anticipacion);
    const primeraVez = u[3]! < cfgPac.proporcionPrimeraVez;
    const desvio = muestra(prep.puntualidad, u[4]!);
    const factorAtencion = muestra(prep.factorAtencion, u[6]!);
    pacientes.push({
      id: pacientes.length,
      clave,
      origen,
      urgencia: false,
      profesional: iProf,
      especialidad: prof.especialidad,
      slot,
      horaTurno,
      anticipacion,
      pNoShow,
      ausente: u[2]! < pNoShow,
      primeraVez,
      desvioPuntualidad: desvio,
      llegada: horaTurno + desvio,
      tiempoAdmision: muestra(prep.tiempoAdmision, u[5]!),
      factorAtencion,
      tiempoAtencionTurno: factorAtencion * (primeraVez ? at.factorPrimeraVez : at.factorControl) * prof.duracionTurno,
      paciencia: muestra(prep.paciencia, u[7]!),
    });
  };

  const sortear10 = (g: Xoshiro128): number[] => {
    const u: number[] = new Array<number>(10);
    for (let i = 0; i < 10; i++) u[i] = g.uniforme();
    return u;
  };

  escenario.profesionales.forEach((prof, iProf) => {
    demoras.push(muestra(prep.demoras[iProf]!, flujo(`${prof.id}/demora`).uniforme()));
    const { inicio, fin } = prep.turnos[iProf]!;
    const D = prof.duracionTurno;
    const n = Math.floor((fin - inicio) / D);

    // Turnos regulares: el slot j sortea si está reservado y todos sus atributos.
    const pSlot: number[] = new Array<number>(n).fill(1);
    if (prof.ocupacionAgenda > 0) {
      for (let j = 0; j < n; j++) {
        const clave = `${prof.id}/t/${j}`;
        const u = sortear10(flujo(clave));
        if (u[0]! < prof.ocupacionAgenda) {
          crearConTurno('turno', clave, iProf, j, inicio + j * D, u);
          pSlot[j] = pacientes[pacientes.length - 1]!.pNoShow!;
        }
      }
    }

    // Sobreturnos: su identidad es el ordinal i; la política solo decide la hora.
    const { k, politica } = prof.sobreturnos;
    const ubicacion = ubicarSobreturnos(politica, k, n, pSlot);
    let extra = 0;
    ubicacion.forEach((slot, i) => {
      const hora = slot >= 0 ? inicio + slot * D : inicio + (n + extra++) * D;
      const clave = `${prof.id}/s/${i}`;
      crearConTurno('sobreturno', clave, iProf, slot, hora, sortear10(flujo(clave)));
    });
  });

  // Espontáneos: los instantes salen de un flujo propio; los atributos, del flujo de cada uno.
  if (prep.espontaneos) {
    const llegadas = prep.espontaneos.generar(flujo('espontaneos/llegadas'), prep.inicioEspontaneos, prep.finEspontaneos);
    llegadas.forEach((t, nEsp) => {
      const clave = `e/${nEsp}`;
      const u = sortear10(flujo(clave));
      const urgencia = u[8]! < cfgEsp.proporcionUrgencias;
      let especialidad = prep.mezclaAcumulada[prep.mezclaAcumulada.length - 1]!.especialidad;
      for (const m of prep.mezclaAcumulada) {
        if (u[9]! <= m.acumulada) {
          especialidad = m.especialidad;
          break;
        }
      }
      pacientes.push({
        id: pacientes.length,
        clave,
        origen: 'espontaneo',
        urgencia,
        profesional: -1,
        especialidad,
        slot: -1,
        horaTurno: null,
        anticipacion: null,
        pNoShow: null,
        ausente: false,
        primeraVez: false,
        desvioPuntualidad: null,
        llegada: t,
        tiempoAdmision: muestra(prep.tiempoAdmision, u[5]!),
        factorAtencion: muestra(prep.factorAtencion, u[6]!),
        tiempoAtencionTurno: null,
        paciencia: muestra(prep.paciencia, u[7]!),
      });
    });
  }

  return { pacientes, demoras };
}
