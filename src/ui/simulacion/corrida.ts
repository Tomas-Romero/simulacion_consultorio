/**
 * Corrida de UN día para la interfaz: simula con traza y agrega lo que la animación
 * necesita y la traza no trae (paciencia pre-muestreada, cupos y costos derivados).
 * TypeScript puro (sin DOM): lo usan el Web Worker y los tests.
 */
import { generarDia, prepararEscenario, simularDia, type EntradaEscenario, type Escenario, type MetricasDia, type TrazaDia } from '../../modelo';

export interface ResultadoCorrida {
  escenario: Escenario;
  semilla: number;
  replica: number;
  traza: TrazaDia;
  metricas: MetricasDia;
  /** Paciencia pre-muestreada de cada paciente, indexada por id (la del modelo, mismo flujo y orden). */
  paciencia: number[];
  /** esCupo[i][j]: el slot j del profesional i es un cupo de demanda espontánea. */
  esCupo: boolean[][];
  cOcio: number[];
  cExtra: number[];
  /** Tiempo de cómputo en el worker [ms]. */
  ms: number;
}

export function ejecutarCorrida(entrada: EntradaEscenario | Escenario, semilla: number, replica = 0): ResultadoCorrida {
  const t0 = performance.now();
  const prep = prepararEscenario(entrada);
  const res = simularDia(prep, { semilla, replica, traza: true, serie: true, pasoSerie: 5 });
  // generarDia es determinista para (semilla, réplica): devuelve los mismos pacientes que usó simularDia.
  const dia = generarDia(prep, semilla, replica);
  const paciencia: number[] = [];
  for (const p of dia.pacientes) paciencia[p.id] = p.paciencia;
  return {
    escenario: prep.escenario,
    semilla,
    replica,
    traza: res.traza!,
    metricas: res.metricas,
    paciencia,
    esCupo: prep.esCupo.map((fila) => [...fila]),
    cOcio: [...prep.cOcio],
    cExtra: [...prep.cExtra],
    ms: performance.now() - t0,
  };
}
