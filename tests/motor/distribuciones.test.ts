/**
 * Cada distribución: media y varianza muestrales (n = 200 000) contra las
 * teóricas. Se informa el veredicto con IC 95 % individual y se exige el
 * criterio conjunto: |z| ≤ umbral de Bonferroni para 95 % sobre todas las
 * verificaciones del archivo (con ~20 IC al 95 %, uno afuera por azar es lo esperable).
 */
import { describe, expect, it } from 'vitest';
import {
  FabricaFlujos,
  PoissonNoHomogeneo,
  bernoulli,
  empiricaDiscreta,
  exponencial,
  inversaNormal,
  lognormal,
  normalTruncada,
  perfilPorHora,
  triangular,
  uniforme,
  type Distribucion,
} from '../../src/motor';
import { momentos, tablaMomentos, umbralBonferroni, type VerificacionMomento } from '../ayudantes';

const SEMILLA = 20260002;
const N = 200_000;

// Parámetros tomados de la especificación del modelo (valores ficticios).
const TABLA_TP5_A = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85].map((valor, i) => ({
  valor,
  frecuencia: [3, 2, 10, 22, 28, 27, 24, 18, 15, 6, 5, 5, 2][i]!,
}));

const CASOS: readonly [string, Distribucion][] = [
  ['Uniforme(0, 10)', uniforme(0, 10)],
  ['Exponencial(media 45) — paciencia', exponencial(45)],
  ['NormalTrunc(−5, 8, [−30, 30]) — puntualidad', normalTruncada(-5, 8, -30, 30)],
  ['Lognormal(19,5; cv 0,4) — 1ª vez, turno 15', lognormal(19.5, 0.4)],
  ['Lognormal(12; cv 0,4) — control, turno 15', lognormal(12, 0.4)],
  ['Triangular(0, 5, 20) — demora médico', triangular(0, 5, 20)],
  ['Triangular(1, 2, 5) — admisión', triangular(1, 2, 5)],
  ['Empírica discreta (TP5, tarea A)', empiricaDiscreta(TABLA_TP5_A)],
  ['Bernoulli(0,08)', bernoulli(0.08)],
];

// Perfil ficticio de espontáneos [llegadas/h] de 08 a 20 h.
const PERFIL = perfilPorHora([1.5, 2.5, 2, 1.5, 1, 1, 1, 1.5, 2, 2, 1.5, 1], 8);
const DIAS = 20_000;

// Total de verificaciones del archivo: 2 por distribución + 2 (conteo diario NHPP) + 1 (χ² del perfil).
const K = 2 * CASOS.length + 3;
const UMBRAL = umbralBonferroni(K);

const resultados: VerificacionMomento[] = [];

describe('distribuciones: media y varianza dentro del IC', () => {
  for (const [nombre, d] of CASOS) {
    it(nombre, () => {
      const g = new FabricaFlujos(SEMILLA).flujo(nombre);
      const muestras = Array.from({ length: N }, () => d.muestrear(g));
      const r = momentos(nombre, muestras, d.media, d.varianza);
      resultados.push(...r);
      for (const v of r) expect(Math.abs(v.z), v.nombre).toBeLessThanOrEqual(UMBRAL);
    });
  }

  it('normal truncada: nunca sale de [−30, 30]', () => {
    const d = normalTruncada(-5, 8, -30, 30);
    const g = new FabricaFlujos(SEMILLA).flujo('rango');
    for (let i = 0; i < 50_000; i++) {
      const x = d.muestrear(g);
      expect(x >= -30 && x <= 30).toBe(true);
    }
  });

  it('empírica discreta: solo devuelve valores de la tabla y respeta las frecuencias por transformada inversa', () => {
    const d = empiricaDiscreta(TABLA_TP5_A);
    const valores = new Set(TABLA_TP5_A.map((f) => f.valor));
    const g = new FabricaFlujos(SEMILLA).flujo('valores');
    for (let i = 0; i < 10_000; i++) expect(valores.has(d.muestrear(g))).toBe(true);
    // u justo por debajo / encima de la primera acumulada (3/167)
    expect(d.muestrear({ uniforme: () => 3 / 167 - 1e-9 })).toBe(0.25);
    expect(d.muestrear({ uniforme: () => 3 / 167 + 1e-9 })).toBe(0.3);
    expect(d.muestrear({ uniforme: () => 0.999999 })).toBe(0.85);
  });

  it('rechaza parámetros inválidos (zod)', () => {
    expect(() => exponencial(-1)).toThrow();
    expect(() => triangular(5, 1, 2)).toThrow();
    expect(() => lognormal(10, 0)).toThrow();
    expect(() => empiricaDiscreta([{ valor: 1, frecuencia: 0 }])).toThrow();
    expect(() => bernoulli(1.5)).toThrow();
    expect(() => perfilPorHora([1, -2], 8)).toThrow();
  });
});

describe('Poisson no homogéneo (thinning)', () => {
  const proceso = new PoissonNoHomogeneo(PERFIL);
  const desde = 8 * 60;
  const hasta = 20 * 60;
  const lambdaDia = proceso.esperadoEntre(desde, hasta);
  const conteos: number[] = [];
  const porHora = new Array<number>(12).fill(0);
  const g = new FabricaFlujos(SEMILLA).flujo('espontaneos');
  for (let d = 0; d < DIAS; d++) {
    const llegadas = proceso.generar(g, desde, hasta);
    conteos.push(llegadas.length);
    for (const t of llegadas) porHora[Math.floor((t - desde) / 60)]!++;
  }

  it('Λ del día es la integral del perfil (18,5 llegadas)', () => {
    expect(lambdaDia).toBeCloseTo(18.5, 10);
  });

  it('conteo diario: media y varianza = Λ (propiedad de Poisson)', () => {
    const r = momentos('NHPP · llegadas/día', conteos, lambdaDia, lambdaDia);
    resultados.push(...r);
    for (const v of r) expect(Math.abs(v.z), v.nombre).toBeLessThanOrEqual(UMBRAL);
  });

  it('las llegadas siguen el perfil horario (χ², 11 g.l.)', () => {
    const total = porHora.reduce((a, b) => a + b, 0);
    let chi2 = 0;
    porHora.forEach((obs, h) => {
      const esperado = (total * proceso.esperadoEntre(desde + h * 60, desde + (h + 1) * 60)) / lambdaDia;
      chi2 += (obs - esperado) ** 2 / esperado;
    });
    // Valor crítico por Wilson-Hilferty: χ²(ν, p) ≈ ν·(1 − 2/(9ν) + z_p·√(2/(9ν)))³
    const critico = (p: number): number => 11 * (1 - 2 / 99 + inversaNormal(p) * Math.sqrt(2 / 99)) ** 3;
    console.log(`χ² perfil horario = ${chi2.toFixed(2)} (crítico 95 % = ${critico(0.95).toFixed(2)}, crítico Bonferroni = ${critico(1 - 0.05 / K).toFixed(2)})`);
    expect(chi2).toBeLessThanOrEqual(critico(1 - 0.05 / K));
  });

  it('fuera de los tramos no hay llegadas', () => {
    const g2 = new FabricaFlujos(SEMILLA).flujo('fuera');
    expect(proceso.generar(g2, 0, 8 * 60)).toEqual([]);
    expect(proceso.tasaEn(21 * 60)).toBe(0);
  });
});

describe('resumen', () => {
  it('imprime la tabla de momentos', () => {
    console.log(`\nUmbral conjunto |z| ≤ ${UMBRAL.toFixed(3)} (Bonferroni, ${K} verificaciones, 95 % conjunto)\n` + tablaMomentos(resultados));
    const fuera = resultados.filter((r) => !r.dentro95).length;
    console.log(`Fuera del IC 95 % individual: ${fuera} de ${resultados.length}`);
    expect(resultados.length).toBe(K - 1);
  });
});
