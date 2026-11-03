/**
 * Recurso con capacidad c (c servidores idénticos) y una cola de espera con
 * disciplina configurable:
 * - FIFO: orden de llegada a la cola;
 * - PRIORIDAD: menor `prioridad` primero; a igual prioridad, menor `orden`
 *   (p. ej. la hora del turno) y después orden de llegada.
 *
 * Lleva estadísticas ponderadas por tiempo (servidores ocupados, largo de
 * cola) y por entidad (espera en cola). Registra en la traza cuándo cada
 * entidad entra a la cola, empieza y termina el servicio, o abandona.
 */
import { AcumuladorMuestral, AcumuladorTiempo } from './estadistica';
import { MonticuloBinario } from './monticulo';
import type { Entidad, Simulador } from './simulador';

export type Disciplina = 'FIFO' | 'PRIORIDAD';

export interface OpcionesSolicitud {
  prioridad?: number;
  orden?: number;
}

export interface Solicitud {
  readonly entidad: Entidad;
  readonly tEntrada: number;
  readonly prioridad: number;
  readonly orden: number;
  readonly secuencia: number;
  /** 'cola' mientras espera, 'servicio' al tomar una unidad, 'retirada' si abandonó. */
  estado: 'cola' | 'servicio' | 'retirada';
}

interface SolicitudInterna extends Solicitud {
  readonly alComenzar: (unidad: number) => void;
}

export class Recurso {
  readonly nombre: string;
  readonly disciplina: Disciplina;
  readonly ocupados: AcumuladorTiempo;
  readonly enCola: AcumuladorTiempo;
  readonly esperas = new AcumuladorMuestral();
  private readonly sim: Simulador;
  private capacidadActual: number;
  private readonly cola: MonticuloBinario<SolicitudInterna>;
  /** unidades[i] = id de la entidad que usa la unidad i, o -1 si está libre. */
  private readonly unidades: number[] = [];
  private enUso = 0;
  private secuencia = 0;

  constructor(sim: Simulador, nombre: string, capacidad: number, disciplina: Disciplina = 'FIFO') {
    if (!Number.isInteger(capacidad) || capacidad < 0) throw new Error(`Capacidad inválida para ${nombre}: ${capacidad}`);
    this.sim = sim;
    this.nombre = nombre;
    this.disciplina = disciplina;
    this.capacidadActual = capacidad;
    this.ocupados = new AcumuladorTiempo(sim.reloj, 0);
    this.enCola = new AcumuladorTiempo(sim.reloj, 0);
    for (let i = 0; i < capacidad; i++) this.unidades.push(-1);
    this.cola =
      disciplina === 'FIFO'
        ? new MonticuloBinario((a, b) => a.secuencia < b.secuencia)
        : new MonticuloBinario((a, b) => {
            if (a.prioridad !== b.prioridad) return a.prioridad < b.prioridad;
            if (a.orden !== b.orden) return a.orden < b.orden;
            return a.secuencia < b.secuencia;
          });
  }

  get capacidad(): number {
    return this.capacidadActual;
  }

  get libres(): number {
    return Math.max(0, this.capacidadActual - this.enUso);
  }

  get largoCola(): number {
    return this.enCola.actual;
  }

  /**
   * Pide una unidad. Si hay una libre la asigna en el acto (y llama a
   * `alComenzar` en forma sincrónica); si no, la entidad queda en cola.
   */
  solicitar(entidad: Entidad, alComenzar: (unidad: number) => void, opciones: OpcionesSolicitud = {}): Solicitud {
    const s: SolicitudInterna = {
      entidad,
      tEntrada: this.sim.reloj,
      prioridad: opciones.prioridad ?? 0,
      orden: opciones.orden ?? 0,
      secuencia: this.secuencia++,
      estado: 'cola',
      alComenzar,
    };
    if (this.libres > 0 && this.cola.tamano === 0) {
      this.iniciar(s);
    } else {
      this.cola.insertar(s);
      this.enCola.sumar(this.sim.reloj, 1);
      this.sim.registrar(entidad, 'entra_cola', { recurso: this.nombre });
    }
    return s;
  }

  /** Libera la unidad que usa `entidad` y, si hay cola, se la da al siguiente. */
  liberar(entidad: Entidad): void {
    const unidad = this.unidades.indexOf(entidad.id);
    if (unidad < 0) throw new Error(`${this.nombre}: la entidad ${entidad.id} no tiene una unidad asignada`);
    this.unidades[unidad] = -1;
    this.enUso--;
    this.ocupados.registrar(this.sim.reloj, this.enUso);
    this.sim.registrar(entidad, 'fin_servicio', { recurso: this.nombre, unidad });
    this.atenderCola();
  }

  /** Saca de la cola una solicitud que todavía espera (abandono). Devuelve false si ya estaba en servicio. */
  retirar(solicitud: Solicitud): boolean {
    if (solicitud.estado !== 'cola') return false;
    solicitud.estado = 'retirada'; // se descarta perezosamente al extraerla del montículo
    this.enCola.sumar(this.sim.reloj, -1);
    this.sim.registrar(solicitud.entidad, 'abandono', { recurso: this.nombre });
    return true;
  }

  /**
   * Cambia la cantidad de unidades disponibles (p. ej. el médico llega tarde o
   * termina su turno). Una reducción no interrumpe servicios en curso: esas
   * unidades simplemente no se reasignan al liberarse.
   */
  cambiarCapacidad(nueva: number): void {
    if (!Number.isInteger(nueva) || nueva < 0) throw new Error(`Capacidad inválida para ${this.nombre}: ${nueva}`);
    this.capacidadActual = nueva;
    while (this.unidades.length < nueva) this.unidades.push(-1);
    this.atenderCola();
  }

  /** Descarta las estadísticas acumuladas hasta ahora (fin del período de calentamiento). */
  reiniciarEstadisticas(): void {
    this.ocupados.reiniciar(this.sim.reloj);
    this.enCola.reiniciar(this.sim.reloj);
    this.esperas.reiniciar();
  }

  private atenderCola(): void {
    while (this.libres > 0) {
      const s = this.cola.extraerMinimo();
      if (!s) return;
      if (s.estado === 'retirada') continue;
      this.enCola.sumar(this.sim.reloj, -1);
      this.iniciar(s);
    }
  }

  private iniciar(s: SolicitudInterna): void {
    // Unidad libre de menor índice, para que la asignación sea determinista.
    let unidad = -1;
    for (let i = 0; i < this.capacidadActual; i++) {
      if (this.unidades[i] === -1) {
        unidad = i;
        break;
      }
    }
    if (unidad < 0) throw new Error(`${this.nombre}: no hay unidad libre`);
    this.unidades[unidad] = s.entidad.id;
    this.enUso++;
    this.ocupados.registrar(this.sim.reloj, this.enUso);
    s.estado = 'servicio';
    this.esperas.agregar(this.sim.reloj - s.tEntrada);
    this.sim.registrar(s.entidad, 'inicio_servicio', { recurso: this.nombre, unidad });
    s.alComenzar(unidad);
  }
}
