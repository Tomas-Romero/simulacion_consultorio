/**
 * #6 · Datos reales: funciones especiales, ajuste por máxima verosimilitud, KS y χ² contra valores
 * de referencia de scipy, regresión logística, CSV y aplicación al escenario.
 *
 * Los valores de referencia se calcularon con scipy 1.x sobre los mismos datos de ejemplo
 * (generarTiempos / generarAsistencia del preset policonsultorio, semilla 2026):
 *   st.lognorm.fit(x, floc=0); st.gamma.fit(x, floc=0); st.kstest(..., method='asymp');
 *   st.chisquare(obs, n/k, ddof=parámetros) con 17 clases equiprobables; logit por Newton en numpy.
 */
import { describe, expect, it } from 'vitest';
import { exponencial, FabricaFlujos } from '../../src/motor';
import { PRESET_POLICONSULTORIO_3, EsquemaEscenario } from '../../src/modelo';
import {
  acumuladaChi2,
  ajustarEmpirica,
  ajustarExponencial,
  ajustarGamma,
  ajustarLognormal,
  aplicarAusentismo,
  aplicarTiempos,
  clasesChi2,
  colaKolmogorov,
  compararAjustes,
  digamma,
  gammaP,
  generarAsistencia,
  generarTiempos,
  leerAsistencia,
  leerTiempos,
  lnGamma,
  mejorPorAIC,
  PLANTILLA_ASISTENCIA,
  PLANTILLA_TIEMPOS,
  proporcionesPorTramo,
  regresionLogistica,
  tiemposACSV,
  trigamma,
} from '../../src/datos';

const e = PRESET_POLICONSULTORIO_3;
const tiempos = generarTiempos(e);
const grupo = tiempos.filter((x) => x.profesional === e.profesionales[0]!.id && x.tipo === 'control').map((x) => x.duracion);
const dentroIC = (est: number, ee: number, verdadero: number): boolean => Math.abs(est - verdadero) <= 1.96 * ee;

describe('funciones especiales', () => {
  it('ln Γ, ψ y ψ′ en valores conocidos', () => {
    expect(lnGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(lnGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
    expect(digamma(1)).toBeCloseTo(-0.5772156649015329, 12);
    expect(trigamma(1)).toBeCloseTo(Math.PI ** 2 / 6, 12);
  });

  it('gamma incompleta, χ² y Kolmogorov contra scipy', () => {
    expect(gammaP(2.5, 3.7)).toBeCloseTo(0.8074495669206043, 12);
    expect(acumuladaChi2(7.3, 5)).toBeCloseTo(0.8007322100787578, 12);
    expect(colaKolmogorov(1.1)).toBeCloseTo(0.1777181926064012, 12);
  });
});

describe('ajuste por máxima verosimilitud y bondad de ajuste (datos de ejemplo, grupo de 200)', () => {
  it('lognormal: coincide con scipy y recupera μ y σ verdaderos dentro de su IC 95 %', () => {
    const a = ajustarLognormal(grupo);
    expect(a.parametros[0]!.valor).toBeCloseTo(2.397768808862501, 10);
    expect(a.parametros[1]!.valor).toBeCloseTo(0.36591804014657286, 10);
    // Verdaderos: media = 0,8 × 15 = 12 min, cv = 0,4 → σ² = ln 1,16, μ = ln 12 − σ²/2.
    const s2 = Math.log(1 + 0.4 ** 2);
    expect(dentroIC(a.parametros[0]!.valor, a.parametros[0]!.ee, Math.log(12) - s2 / 2)).toBe(true);
    expect(dentroIC(a.parametros[1]!.valor, a.parametros[1]!.ee, Math.sqrt(s2))).toBe(true);
  });

  it('gamma: coincide con scipy (forma y escala)', () => {
    const a = ajustarGamma(grupo);
    expect(a.parametros[0]!.valor).toBeCloseTo(7.632751961630378, 7);
    expect(a.parametros[1]!.valor).toBeCloseTo(1.5407286990481517, 7);
  });

  it('KS y χ² de las tres familias paramétricas contra scipy', () => {
    const filas = compararAjustes(grupo);
    const ref = {
      lognormal: { D: 0.045894173133337324, p: 0.7934957093478331, chi2: 12.5, pchi2: 0.5662151910430082 },
      gamma: { D: 0.06267189875237855, p: 0.4119013035849615, chi2: 16.75, pchi2: 0.2697453760069029 },
      exponencial: { D: 0.34975105143336166, p: 1.1242486455824673e-21, chi2: 254.92, pchi2: 1.2027226249433325e-45 },
    };
    expect(clasesChi2(200)).toBe(17);
    for (const [familia, r] of Object.entries(ref)) {
      const f = filas.find((x) => x.ajuste.familia === familia)!;
      expect(f.ks!.D).toBeCloseTo(r.D, 6);
      expect(f.ks!.p / r.p).toBeCloseTo(1, 4);
      expect(f.chi2!.estadistico).toBeCloseTo(r.chi2, 9);
      expect(f.chi2!.p / r.pchi2).toBeCloseTo(1, 4);
    }
    expect(filas.find((x) => x.ajuste.familia === 'empirica')!.ks).toBeNull();
    expect(mejorPorAIC(filas)).toBe('lognormal');
  });

  it('gamma: recupera α y θ de datos gamma generados por transformada inversa', () => {
    const verdadero = ajustarGamma([3, 4, 5, 6, 7, 8, 9, 10]);
    const g = new FabricaFlujos(7, 0).flujo('gamma');
    const xs = Array.from({ length: 400 }, () => verdadero.cuantil(g.uniforme()));
    const a = ajustarGamma(xs);
    expect(dentroIC(a.parametros[0]!.valor, a.parametros[0]!.ee, verdadero.parametros[0]!.valor)).toBe(true);
    expect(dentroIC(a.parametros[1]!.valor, a.parametros[1]!.ee, verdadero.parametros[1]!.valor)).toBe(true);
  });

  it('exponencial: recupera la media de datos exponenciales del motor', () => {
    const g = new FabricaFlujos(11, 0).flujo('exp');
    const d = exponencial(9);
    const a = ajustarExponencial(Array.from({ length: 500 }, () => d.muestrear(g)));
    expect(dentroIC(a.media, a.parametros[0]!.ee, 9)).toBe(true);
  });

  it('empírica discreta: tabla al minuto con las frecuencias observadas y acumulada que llega a 1', () => {
    const a = ajustarEmpirica(grupo);
    expect(a.tabla.reduce((s, f) => s + f.frecuencia, 0)).toBe(200);
    expect(a.acumulada(1e9)).toBe(1);
    expect(a.cuantil(0.5)).toBeGreaterThan(0);
  });

  it('el cuantil invierte la acumulada en las tres familias paramétricas', () => {
    for (const a of [ajustarLognormal(grupo), ajustarGamma(grupo), ajustarExponencial(grupo)])
      for (const u of [0.05, 0.5, 0.95]) expect(a.acumulada(a.cuantil(u))).toBeCloseTo(u, 7);
  });
});

describe('regresión logística del ausentismo', () => {
  const obs = generarAsistencia(e);

  it('coincide con Newton en numpy y recupera β₀ y β₁ verdaderos dentro de su IC 95 %', () => {
    const r = regresionLogistica(obs);
    expect(r.convergio).toBe(true);
    expect(r.beta0).toBeCloseTo(-2.35105718, 7);
    expect(r.beta1).toBeCloseTo(0.04660774, 7);
    expect(r.ee0).toBeCloseTo(0.09654149, 7);
    expect(r.ee1).toBeCloseTo(0.00561063, 7);
    expect(dentroIC(r.beta0, r.ee0, e.ausentismo.beta0)).toBe(true);
    expect(dentroIC(r.beta1, r.ee1, e.ausentismo.beta1)).toBe(true);
  });

  it('con más datos el estimador se acerca al verdadero (consistencia)', () => {
    const r = regresionLogistica(generarAsistencia(e, 99, 40000));
    expect(Math.abs(r.beta1 - e.ausentismo.beta1)).toBeLessThan(3 * r.ee1);
    expect(r.ee1).toBeLessThan(0.002);
  });

  it('proporciones por tramo con IC de Wilson que contiene la proporción', () => {
    const t = proporcionesPorTramo(obs);
    expect(t.map((x) => x.anticipacion)).toEqual([1, 3, 7, 14, 21, 30]);
    for (const x of t) expect(x.inf <= x.proporcion && x.proporcion <= x.sup).toBe(true);
    expect(t.reduce((s, x) => s + x.n, 0)).toBe(obs.length);
  });

  it('rechaza datos sin variación', () => {
    expect(() => regresionLogistica([{ anticipacion: 1, asistio: 1 }, { anticipacion: 2, asistio: 1 }, { anticipacion: 3, asistio: 1 }])).toThrow();
  });
});

describe('CSV y aplicación al escenario', () => {
  it('lee las plantillas y los datos de ejemplo exportados', () => {
    expect(leerTiempos(PLANTILLA_TIEMPOS).ok).toBe(true);
    expect(leerAsistencia(PLANTILLA_ASISTENCIA).ok).toBe(true);
    const r = leerTiempos(tiemposACSV(tiempos));
    expect(r.ok && r.filas.length).toBe(tiempos.length);
  });

  it('acepta punto y coma con coma decimal', () => {
    const r = leerTiempos('profesional;tipo;duracion_min\nP1;control;12,5\n');
    expect(r.ok).toBe(false); // una sola fila: hacen falta 2
    const r2 = leerTiempos('profesional;tipo;duracion_min\nP1;control;12,5\nP1;Primera vez;20\n');
    expect(r2.ok && r2.filas.map((f) => [f.tipo, f.duracion])).toEqual([
      ['control', 12.5],
      ['primera_vez', 20],
    ]);
  });

  it('informa línea, campo y motivo de cada error', () => {
    const r = leerTiempos('profesional,tipo,duracion_min\nP1,control,abc\nP1,visita,10\n,control,-3\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores).toContainEqual({ linea: 2, campo: 'duracion', mensaje: 'la duración tiene que ser un número' });
      expect(r.errores.some((x) => x.linea === 3 && x.campo === 'tipo')).toBe(true);
      expect(r.errores.some((x) => x.linea === 4 && x.campo === 'profesional')).toBe(true);
      expect(r.errores.some((x) => x.linea === 4 && x.campo === 'duracion')).toBe(true);
    }
    const sinColumnas = leerAsistencia('dias_antes,vino\n1,1\n');
    expect(!sinColumnas.ok && sinColumnas.errores[0]!.mensaje).toContain('faltan las columnas');
  });

  it('aplicar tiempos recupera factores y cv del escenario que generó los datos, y el escenario sigue siendo válido', () => {
    const r = aplicarTiempos(e, tiempos, 'lognormal');
    const a = r.escenario.pacientes.atencion;
    const v = e.pacientes.atencion;
    expect(a.factorPrimeraVez / v.factorPrimeraVez).toBeCloseTo(1, 1);
    expect(a.factorControl / v.factorControl).toBeCloseTo(1, 1);
    expect(a.factorEspontaneo / v.factorEspontaneo).toBeCloseTo(1, 1);
    expect(Math.abs(a.cv - v.cv)).toBeLessThan(0.03);
    expect(EsquemaEscenario.safeParse(r.escenario).success).toBe(true);
    expect(r.advertencias).toEqual([]);
  });

  it('gamma y empírica se aplican como lognormal con aviso; profesionales desconocidos se descartan', () => {
    const r = aplicarTiempos(e, [...tiempos, { profesional: 'nadie', tipo: 'control', duracion: 10 }], 'gamma');
    expect(r.escenario.pacientes.atencion.familia).toBe('lognormal');
    expect(r.advertencias.some((x) => x.includes('gamma'))).toBe(true);
    expect(r.advertencias.some((x) => x.includes('nadie'))).toBe(true);
    expect(aplicarTiempos(e, tiempos, 'exponencial').escenario.pacientes.atencion.familia).toBe('exponencial');
  });

  it('aplicar ausentismo reemplaza β₀ y β₁', () => {
    const r = aplicarAusentismo(e, { beta0: -2, beta1: 0.07 });
    expect(r.escenario.ausentismo).toEqual({ beta0: -2, beta1: 0.07 });
    expect(EsquemaEscenario.safeParse(r.escenario).success).toBe(true);
  });
});
