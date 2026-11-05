/**
 * Estudio Monte Carlo completo (E1–E6, docs/experimentos.md). Corre con cualquier ejecutor: el
 * pool de worker_threads (npm run estudio) o el de Web Workers (navegador). El resultado no
 * depende de la cantidad de hilos.
 */
import { POLITICAS_SOBRETURNO, PRESETS, prepararEscenario, type Escenario, type PoliticaSobreturno } from '../modelo';
import {
  analizarSerie,
  beneficioDiario,
  columna,
  costoDiario,
  costosDe,
  diferencia,
  ic,
  percentil,
  ajusteLogLog,
  requiereMasReplicas,
  type AnalisisSerie,
  type Costos,
  type IC,
} from './analisis';
import { crearSerie, extenderSeries, hashTexto, huella, type Serie } from './corredor';
import { aplicarNivel, beta0ParaAusentismo } from './esquema';
import type { Ejecutor } from './pool';

export const VERSION_ESTUDIO = 1;
export const KS = [0, 1, 2, 3, 4, 5, 6];
export const NIVELES_AUSENTISMO = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
export const FACTORES_EXTRA = [1, 1.25, 1.5, 1.75, 2];
export const C_ESPERA = [75, 150, 300];
export const IDS_PRESET = ['chico', 'policonsultorio', 'centro'] as const;
export type IdPresetEstudio = (typeof IDS_PRESET)[number];

export interface OpcionesEstudio {
  semilla: number;
  R0: number;
  Rmax: number;
  umbral: number;
  /** Réplicas de la configuración de E6. */
  Rprecision: number;
  progreso?: (fase: string, hechas: number, total: number) => void;
  senal?: AbortSignal;
}

export const OPCIONES_ESTUDIO: OpcionesEstudio = { semilla: 2026600, R0: 2000, Rmax: 16000, umbral: 3000, Rprecision: 16000 };

export interface ResumenK {
  k: number;
  B: IC;
  C: IC;
  atendidos: number;
  esperaPorAtendido: number;
  ocio: number;
  horasExtra: number;
  perdidos: number;
  abandonos: number;
  utilizacion: number;
}

export interface CurvaSerie {
  R: number;
  puntos: ResumenK[];
  kHat: number;
  conjunto: number[];
  kRec: number;
  kC: number;
  consecutivas: { de: number; a: number; ic: IC }[];
  contraCero: { k: number; ic: IC }[];
  contraMejor: { k: number; ic: IC }[];
  nivelBonferroni: number;
}

export interface ResultadoEstudio {
  version: number;
  semilla: number;
  R0: number;
  Rmax: number;
  umbral: number;
  hashPresets: string;
  huella: string;
  e1: { preset: IdPresetEstudio; politica: PoliticaSobreturno; curva: CurvaSerie }[];
  e2: {
    preset: IdPresetEstudio;
    Rcomun: number;
    politicas: { politica: PoliticaSobreturno; k: number; kRec: number; B: IC; esperaPorAtendido: number; ocio: number; horasExtra: number }[];
    pares: { a: PoliticaSobreturno; b: PoliticaSobreturno; ic: IC; distinguible: boolean }[];
    ganadora: PoliticaSobreturno;
    empatadas: PoliticaSobreturno[];
    nivelBonferroni: number;
  }[];
  e3: {
    preset: 'policonsultorio';
    politica: PoliticaSobreturno;
    ausentismo: { p: number; beta0: number; curva: CurvaSerie }[];
    factorExtra: { factor: number; curva: CurvaSerie }[];
    cEspera: { cEspera: number; curva: CurvaSerie }[];
    mapa: { p: number; factor: number; kHat: number; kRec: number; conjunto: number[] }[];
  };
  e4: {
    alfa: number;
    pendienteMinCuadrados: number;
    configuraciones: {
      preset: IdPresetEstudio;
      politica: PoliticaSobreturno;
      p: number;
      N: number;
      pN: number;
      kHat: number;
      conjunto: number[];
      ingenua: { k: number; recortado: boolean; perdida: IC; dentro: boolean };
      ajustada: { k: number; recortado: boolean; perdida: IC; dentro: boolean };
    }[];
    resumen: { regla: 'ingenua' | 'ajustada'; perdidaMedia: number; perdidaMaxima: number; dentro: number; total: number }[];
  };
  e5: { preset: 'policonsultorio'; politica: PoliticaSobreturno; R: number; porK: { k: number; media: number; p5: number; p25: number; p50: number; p75: number; p95: number; pNegativo: number }[] };
  e6: { preset: 'policonsultorio'; politica: PoliticaSobreturno; k: number; puntos: { R: number; semiancho: number; media: number }[]; pendiente: number; intercepto: number; r2: number };
}

const presetPorId = (id: IdPresetEstudio): Escenario => PRESETS[IDS_PRESET.indexOf(id)]!;

function resumirK(datos: Float64Array, R: number, k: number, costos: Costos): ResumenK {
  const media = (m: Parameters<typeof columna>[2]): number => columna(datos, R, m).reduce((s, v) => s + v, 0) / R;
  const espera = columna(datos, R, 'sumaEspera').reduce((s, v) => s + v, 0);
  const atend = columna(datos, R, 'atendidos').reduce((s, v) => s + v, 0);
  return {
    k,
    B: ic(beneficioDiario(datos, R, costos)),
    C: ic(costoDiario(datos, R, costos)),
    atendidos: atend / R,
    esperaPorAtendido: espera / atend,
    ocio: media('ocio'),
    horasExtra: media('horasExtra'),
    perdidos: media('perdidos'),
    abandonos: media('abandonos'),
    utilizacion: media('utilizacion'),
  };
}

/** B y C diarios de cada configuración de la serie, con los costos dados. */
function diarios(s: Serie, c: Costos): { Bs: Float64Array[]; Cs: Float64Array[] } {
  return { Bs: s.datos.map((d) => beneficioDiario(d, s.R, c)), Cs: s.datos.map((d) => costoDiario(d, s.R, c)) };
}

export function curvaDe(s: Serie, ks: number[], c: Costos): { curva: CurvaSerie; analisis: AnalisisSerie; Bs: Float64Array[] } {
  const { Bs, Cs } = diarios(s, c);
  const a = analizarSerie(ks, Bs, Cs);
  return {
    analisis: a,
    Bs,
    curva: {
      R: s.R,
      puntos: s.datos.map((d, i) => resumirK(d, s.R, ks[i]!, c)),
      kHat: a.kHat,
      conjunto: a.conjunto,
      kRec: a.kRec,
      kC: a.kC,
      consecutivas: a.consecutivas,
      contraCero: a.contraCero,
      contraMejor: a.contraMejor,
      nivelBonferroni: a.nivelBonferroni,
    },
  };
}

/** Lleva todas las series a R0 y después duplica R en las que no cumplen la regla de precisión. */
export async function correrConPrecision(ejecutor: Ejecutor, series: Serie[], costos: Costos[], o: OpcionesEstudio, fase: string): Promise<void> {
  await extenderSeries(
    ejecutor,
    series.map((serie) => ({ serie, R: o.R0 })),
    o.semilla,
    { senal: o.senal, alAvanzar: (h, t) => o.progreso?.(`${fase}: ${o.R0} días por configuración`, h, t) },
  );
  for (;;) {
    const pendientes = series.filter((s, i) => {
      if (s.R >= o.Rmax) return false;
      const { Bs, Cs } = diarios(s, costos[i]!);
      return requiereMasReplicas(analizarSerie(KS, Bs, Cs), o.umbral);
    });
    if (pendientes.length === 0) break;
    await extenderSeries(
      ejecutor,
      pendientes.map((serie) => ({ serie, R: Math.min(o.Rmax, serie.R * 2) })),
      o.semilla,
      { senal: o.senal, alAvanzar: (h, t) => o.progreso?.(`${fase}: duplicando R en ${pendientes.length} series`, h, t) },
    );
  }
}

/** Turnos reservados por profesional por día (promedio del preset): slots para turnos con ocupación. */
export function turnosPorProfesional(e: Escenario): number {
  const prep = prepararEscenario(e);
  const n = prep.esCupo.map((c, i) => c.filter((x) => !x).length * e.profesionales[i]!.ocupacionAgenda);
  return n.reduce((s, v) => s + v, 0) / n.length;
}

export async function correrEstudio(ejecutor: Ejecutor, opciones: Partial<OpcionesEstudio> = {}): Promise<ResultadoEstudio> {
  const o: OpcionesEstudio = { ...OPCIONES_ESTUDIO, ...opciones };
  const serieDe = (id: IdPresetEstudio, politica: PoliticaSobreturno, aus: number | null): Serie =>
    crearSerie(`${id}/${politica}/${aus ?? 'base'}`, KS.map((k) => aplicarNivel(presetPorId(id), { k, politica, ausentismo: aus })));

  // ------------------------------------------------------------ E1
  const seriesE1 = IDS_PRESET.flatMap((id) => POLITICAS_SOBRETURNO.map((politica) => ({ id, politica, serie: serieDe(id, politica, null) })));
  const costosBase = (id: IdPresetEstudio): Costos => costosDe(presetPorId(id));
  await correrConPrecision(ejecutor, seriesE1.map((x) => x.serie), seriesE1.map((x) => costosBase(x.id)), o, 'E1 · curva B(k)');
  const e1 = seriesE1.map(({ id, politica, serie }) => ({ preset: id, politica, ...curvaDe(serie, KS, costosBase(id)) }));

  // ------------------------------------------------------------ E2
  const nivelPares = 1 - 0.05 / 6;
  const e2 = IDS_PRESET.map((id) => {
    const filas = e1.filter((x) => x.preset === id);
    const Rcomun = Math.min(...filas.map((x) => x.curva.R));
    const vec = filas.map((x) => x.Bs[KS.indexOf(x.analisis.kHat)]!.subarray(0, Rcomun));
    const politicas = filas.map((x, i) => {
      const p = x.curva.puntos[KS.indexOf(x.analisis.kHat)]!;
      return { politica: x.politica, k: x.analisis.kHat, kRec: x.analisis.kRec, B: ic(vec[i]!), esperaPorAtendido: p.esperaPorAtendido, ocio: p.ocio, horasExtra: p.horasExtra };
    });
    const pares: ResultadoEstudio['e2'][number]['pares'] = [];
    for (let i = 0; i < filas.length; i++)
      for (let j = i + 1; j < filas.length; j++) {
        const d = diferencia(vec[i]!, vec[j]!, nivelPares);
        pares.push({ a: filas[i]!.politica, b: filas[j]!.politica, ic: d, distinguible: d.inf > 0 || d.sup < 0 });
      }
    const iG = politicas.reduce((m, x, i) => (x.B.media > politicas[m]!.B.media ? i : m), 0);
    const ganadora = politicas[iG]!.politica;
    const empatadas = politicas
      .filter((x) => x.politica !== ganadora)
      .filter((x) => {
        const par = pares.find((p) => (p.a === ganadora && p.b === x.politica) || (p.b === ganadora && p.a === x.politica))!;
        return !par.distinguible;
      })
      .map((x) => x.politica);
    return { preset: id, Rcomun, politicas, pares, ganadora, empatadas, nivelBonferroni: nivelPares };
  });
  const ganadoraDe = (id: IdPresetEstudio): PoliticaSobreturno => e2.find((x) => x.preset === id)!.ganadora;

  // ------------------------------------------------------------ E3 y E4 (series de ausentismo)
  const seriesAus = IDS_PRESET.flatMap((id) => NIVELES_AUSENTISMO.map((p) => ({ id, p, serie: serieDe(id, ganadoraDe(id), p) })));
  await correrConPrecision(ejecutor, seriesAus.map((x) => x.serie), seriesAus.map((x) => costosBase(x.id)), o, 'E3–E4 · ausentismo');
  const aus = seriesAus.map(({ id, p, serie }) => ({ id, p, beta0: beta0ParaAusentismo(presetPorId(id), p), ...curvaDe(serie, KS, costosBase(id)) }));

  const wPoli = ganadoraDe('policonsultorio');
  const serieE1Poli = seriesE1.find((x) => x.id === 'policonsultorio' && x.politica === wPoli)!.serie;
  const cPoli = costosBase('policonsultorio');
  const e3: ResultadoEstudio['e3'] = {
    preset: 'policonsultorio',
    politica: wPoli,
    ausentismo: aus.filter((x) => x.id === 'policonsultorio').map((x) => ({ p: x.p, beta0: x.beta0, curva: x.curva })),
    factorExtra: FACTORES_EXTRA.map((factor) => ({ factor, curva: curvaDe(serieE1Poli, KS, { ...cPoli, factorExtra: factor }).curva })),
    cEspera: C_ESPERA.map((cEspera) => ({ cEspera, curva: curvaDe(serieE1Poli, KS, { ...cPoli, cEspera }).curva })),
    mapa: seriesAus
      .filter((x) => x.id === 'policonsultorio')
      .flatMap(({ p, serie }) =>
        FACTORES_EXTRA.map((factor) => {
          const { analisis } = curvaDe(serie, KS, { ...cPoli, factorExtra: factor });
          return { p, factor, kHat: analisis.kHat, kRec: analisis.kRec, conjunto: analisis.conjunto };
        }),
      ),
  };

  // ------------------------------------------------------------ E4 · regla práctica
  const Npreset = Object.fromEntries(IDS_PRESET.map((id) => [id, turnosPorProfesional(presetPorId(id))])) as Record<IdPresetEstudio, number>;
  const base4 = aus.map((x) => ({ x, pN: x.p * Npreset[x.id] }));
  const recortar = (k: number): { k: number; recortado: boolean } => ({ k: Math.max(KS[0]!, Math.min(KS[KS.length - 1]!, k)), recortado: k < KS[0]! || k > KS[KS.length - 1]! });
  const perdidaMedia = (b: (typeof base4)[number], k: number): number => b.x.curva.puntos[KS.indexOf(b.x.analisis.kHat)]!.B.media - b.x.curva.puntos[KS.indexOf(k)]!.B.media;
  const sxy = base4.reduce((s, b) => s + b.pN * b.x.analisis.kHat, 0);
  const sxx = base4.reduce((s, b) => s + b.pN * b.pN, 0);
  const pendienteMC = sxy / sxx;
  let alfa = 0;
  let mejorPerdida = Infinity;
  for (let i = 0; i <= 300; i++) {
    const a = i / 100;
    const total = base4.reduce((s, b) => s + perdidaMedia(b, recortar(Math.round(a * b.pN)).k), 0);
    if (total < mejorPerdida - 1e-9 || (Math.abs(total - mejorPerdida) <= 1e-9 && Math.abs(a - pendienteMC) < Math.abs(alfa - pendienteMC))) {
      mejorPerdida = total;
      alfa = a;
    }
  }
  const evaluar = (b: (typeof base4)[number], kBruto: number) => {
    const r = recortar(kBruto);
    const iH = KS.indexOf(b.x.analisis.kHat);
    const iR = KS.indexOf(r.k);
    const perdida = iH === iR ? { media: 0, inf: 0, sup: 0, semi: 0 } : diferencia(b.x.Bs[iH]!, b.x.Bs[iR]!);
    return { k: r.k, recortado: r.recortado, perdida, dentro: b.x.analisis.conjunto.includes(r.k) };
  };
  const configuracionesE4 = base4.map((b) => ({
    preset: b.x.id,
    politica: ganadoraDe(b.x.id),
    p: b.x.p,
    N: Npreset[b.x.id],
    pN: b.pN,
    kHat: b.x.analisis.kHat,
    conjunto: b.x.analisis.conjunto,
    ingenua: evaluar(b, Math.round(b.pN)),
    ajustada: evaluar(b, Math.round(alfa * b.pN)),
  }));
  const resumen = (['ingenua', 'ajustada'] as const).map((regla) => {
    const ps = configuracionesE4.map((c) => c[regla].perdida.media);
    return { regla, perdidaMedia: ps.reduce((s, v) => s + v, 0) / ps.length, perdidaMaxima: Math.max(...ps), dentro: configuracionesE4.filter((c) => c[regla].dentro).length, total: configuracionesE4.length };
  });

  // ------------------------------------------------------------ E5 · riesgo
  const e1Poli = e1.find((x) => x.preset === 'policonsultorio' && x.politica === wPoli)!;
  const e5: ResultadoEstudio['e5'] = {
    preset: 'policonsultorio',
    politica: wPoli,
    R: e1Poli.curva.R,
    porK: KS.map((k, i) => {
      const d = new Float64Array(e1Poli.curva.R);
      let neg = 0;
      for (let r = 0; r < d.length; r++) {
        d[r] = e1Poli.Bs[i]![r]! - e1Poli.Bs[0]![r]!;
        if (d[r]! < 0) neg++;
      }
      const media = d.reduce((s, v) => s + v, 0) / d.length;
      d.sort();
      return { k, media, p5: percentil(d, 0.05), p25: percentil(d, 0.25), p50: percentil(d, 0.5), p75: percentil(d, 0.75), p95: percentil(d, 0.95), pNegativo: neg / d.length };
    }),
  };

  // ------------------------------------------------------------ E6 · precisión
  const kE6 = e1Poli.analisis.kHat;
  const iE6 = KS.indexOf(kE6);
  const serieE6: Serie = { nombre: `policonsultorio/${wPoli}/k=${kE6}/precision`, escenarios: [serieE1Poli.escenarios[iE6]!], R: serieE1Poli.R, datos: [serieE1Poli.datos[iE6]!.slice()] };
  await extenderSeries(ejecutor, [{ serie: serieE6, R: o.Rprecision }], o.semilla, { senal: o.senal, alAvanzar: (h, t) => o.progreso?.(`E6 · precisión: ${o.Rprecision} días`, h, t) });
  const B6 = beneficioDiario(serieE6.datos[0]!, serieE6.R, cPoli);
  const Rs: number[] = [];
  for (let R = 125; R <= o.Rprecision; R *= 2) Rs.push(R);
  const puntos6 = Rs.map((R) => {
    const x = ic(B6.subarray(0, R));
    return { R, semiancho: x.semi, media: x.media };
  });
  const ajuste = ajusteLogLog(puntos6.map((p) => p.R), puntos6.map((p) => p.semiancho));

  const todos = [...seriesE1.map((x) => x.serie), ...seriesAus.map((x) => x.serie), serieE6].flatMap((s) => s.datos);
  return {
    version: VERSION_ESTUDIO,
    semilla: o.semilla,
    R0: o.R0,
    Rmax: o.Rmax,
    umbral: o.umbral,
    hashPresets: hashTexto(JSON.stringify(PRESETS)),
    huella: huella(todos),
    e1: e1.map(({ preset, politica, curva }) => ({ preset, politica, curva })),
    e2,
    e3,
    e4: { alfa, pendienteMinCuadrados: pendienteMC, configuraciones: configuracionesE4, resumen },
    e5,
    e6: { preset: 'policonsultorio', politica: wPoli, k: kE6, puntos: puntos6, ...ajuste },
  };
}

