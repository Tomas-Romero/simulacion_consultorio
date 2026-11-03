/**
 * Modelo M/M/c construido con el motor, para validarlo contra Erlang C.
 * Unidad de tiempo: MINUTOS (la misma que usará el modelo del consultorio);
 * las tasas se ingresan por hora y se convierten.
 */
import { exponencial } from '../distribuciones';
import { AcumuladorMuestral, AcumuladorTiempo } from '../estadistica';
import { FabricaFlujos } from '../prng';
import { Recurso } from '../recurso';
import { Simulador } from '../simulador';
import type { RegistroTraza } from '../traza';

export interface ConfigCorridaMMc {
  /** Tasa de llegadas [clientes/h]. */
  lambdaPorHora: number;
  /** Tasa de servicio por servidor [clientes/h]. */
  muPorHora: number;
  c: number;
  /** Período de calentamiento [min]: lo que pasa antes se descarta. */
  calentamiento: number;
  /** Largo del período de medición, después del calentamiento [min]. */
  duracion: number;
  semilla: number;
  replica: number;
  traza?: boolean;
}

export interface ResultadoReplicaMMc {
  /** Promedios temporales sobre la ventana de medición. */
  L: number;
  Lq: number;
  rho: number;
  /** Promedios por cliente (clientes que llegaron y salieron dentro de la ventana) [min]. */
  W: number;
  Wq: number;
  pEspera: number;
  /** λ observada = llegadas en la ventana / duración [clientes/min]. */
  lambdaObs: number;
  clientes: number;
  eventos: number;
  traza: RegistroTraza[];
}

export function simularMMc(cfg: ConfigCorridaMMc): ResultadoReplicaMMc {
  const sim = new Simulador({ traza: cfg.traza ?? false });
  const flujos = new FabricaFlujos(cfg.semilla, cfg.replica);
  const gLlegadas = flujos.flujo('llegadas');
  const gServicio = flujos.flujo('servicio');
  const entreLlegadas = exponencial(60 / cfg.lambdaPorHora);
  const servicio = exponencial(60 / cfg.muPorHora);

  const servidor = new Recurso(sim, 'servidor', cfg.c, 'FIFO');
  const enSistema = new AcumuladorTiempo(0, 0);
  const W = new AcumuladorMuestral();
  const Wq = new AcumuladorMuestral();
  let esperaron = 0;
  let llegadasVentana = 0;
  const tInicioMedicion = cfg.calentamiento;
  const tFin = cfg.calentamiento + cfg.duracion;

  const llegada = (): void => {
    const cliente = sim.crearEntidad('cliente');
    const tLlegada = sim.reloj;
    const medir = tLlegada >= tInicioMedicion;
    if (medir) llegadasVentana++;
    sim.registrar(cliente, 'llegada');
    enSistema.sumar(sim.reloj, 1);
    servidor.solicitar(cliente, () => {
      const espera = sim.reloj - tLlegada;
      sim.programar(
        servicio.muestrear(gServicio),
        () => {
          servidor.liberar(cliente);
          enSistema.sumar(sim.reloj, -1);
          sim.registrar(cliente, 'salida');
          if (medir) {
            W.agregar(sim.reloj - tLlegada);
            Wq.agregar(espera);
            if (espera > 0) esperaron++;
          }
        },
        'fin_servicio',
      );
    });
    sim.programar(entreLlegadas.muestrear(gLlegadas), llegada, 'llegada');
  };

  sim.programarEn(0, llegada, 'llegada');
  // Fin del calentamiento: prioridad −1 para que se procese antes que una llegada simultánea.
  sim.programarEn(
    tInicioMedicion,
    () => {
      enSistema.reiniciar(sim.reloj);
      servidor.reiniciarEstadisticas();
    },
    'fin_calentamiento',
    -1,
  );
  sim.ejecutarHasta(tFin);

  return {
    L: enSistema.media(tFin),
    Lq: servidor.enCola.media(tFin),
    rho: servidor.ocupados.media(tFin) / cfg.c,
    W: W.media,
    Wq: Wq.media,
    pEspera: esperaron / W.n,
    lambdaObs: llegadasVentana / cfg.duracion,
    clientes: W.n,
    eventos: sim.eventosProcesados,
    traza: sim.traza.registros,
  };
}

/**
 * Datos para el método de Welch: L promedio en intervalos consecutivos de
 * `anchoIntervalo` minutos desde t = 0 (sistema vacío), sin calentamiento.
 */
export function serieCalentamientoMMc(
  cfg: Omit<ConfigCorridaMMc, 'calentamiento' | 'duracion' | 'traza'>,
  anchoIntervalo: number,
  intervalos: number,
): number[] {
  const sim = new Simulador();
  const flujos = new FabricaFlujos(cfg.semilla, cfg.replica);
  const gLlegadas = flujos.flujo('llegadas');
  const gServicio = flujos.flujo('servicio');
  const entreLlegadas = exponencial(60 / cfg.lambdaPorHora);
  const servicio = exponencial(60 / cfg.muPorHora);
  const servidor = new Recurso(sim, 'servidor', cfg.c);
  const enSistema = new AcumuladorTiempo(0, 0);
  const serie: number[] = [];

  const llegada = (): void => {
    const cliente = sim.crearEntidad('cliente');
    enSistema.sumar(sim.reloj, 1);
    servidor.solicitar(cliente, () => {
      sim.programar(servicio.muestrear(gServicio), () => {
        servidor.liberar(cliente);
        enSistema.sumar(sim.reloj, -1);
      });
    });
    sim.programar(entreLlegadas.muestrear(gLlegadas), llegada);
  };
  sim.programarEn(0, llegada);
  for (let i = 1; i <= intervalos; i++) {
    sim.programarEn(
      i * anchoIntervalo,
      () => {
        serie.push(enSistema.media(sim.reloj));
        enSistema.reiniciar(sim.reloj);
      },
      'corte',
      -1,
    );
  }
  sim.ejecutarHasta(intervalos * anchoIntervalo);
  return serie;
}
