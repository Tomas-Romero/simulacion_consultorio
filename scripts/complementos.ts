/**
 * Análisis complementarios del #5 (no modifican el estudio precalculado):
 *  0.1 regla con corrección por demanda espontánea, validación dejando un escenario afuera;
 *  0.2 mecanismo de las políticas (perfiles por franja, R = 500 días con trazas);
 *  A   modelo fluido de la jornada contra la media de la simulación de eventos discretos.
 * Escribe public/resultados/complementos.json y sus CSV. Uso: npm run complementos
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRESETS, prepararEscenario, simularDia, type Escenario, type PoliticaSobreturno } from '../src/modelo';
import {
  aplicarNivel,
  beneficioDiario,
  correrConPrecision,
  costosDe,
  crearSerie,
  curvaDe,
  espontaneosExcedentes,
  ic,
  IDS_PRESET,
  KS,
  NIVELES_AUSENTISMO,
  OPCIONES_ESTUDIO,
  perfilesMedios,
  turnosPorProfesional,
  validacionDejandoUnoAfuera,
  type ConfigRegla,
  type IdPresetEstudio,
  type ResultadoEstudio,
} from '../src/experimentos';
import { aCSV } from '../src/experimentos/csv';
import { crearPoolNode } from '../src/experimentos/pool-node';
import { modeloFluido } from '../src/dinamica';

const SALIDA = 'public/resultados';
const estudio = JSON.parse(readFileSync(join(SALIDA, 'estudio.json'), 'utf8')) as ResultadoEstudio;
const presetDe = (id: IdPresetEstudio): Escenario => PRESETS[IDS_PRESET.indexOf(id)]!;
const ganadora = (id: IdPresetEstudio): PoliticaSobreturno => estudio.e2.find((x) => x.preset === id)!.ganadora;
const t0 = performance.now();

// ------------------------------------------------------------ 0.1 regla con corrección
// Se re-simulan las series de ausentismo con la misma semilla y la misma regla de precisión que el
// estudio (mismo motor JS ⇒ mismos valores): hacen falta los B diarios, que el JSON no guarda.
const pool = crearPoolNode();
const series = IDS_PRESET.flatMap((id) => NIVELES_AUSENTISMO.map((p) => ({ id, p, serie: crearSerie(`${id}/${p}`, KS.map((k) => aplicarNivel(presetDe(id), { k, politica: ganadora(id), ausentismo: p }))) })));
await correrConPrecision(pool, series.map((x) => x.serie), series.map((x) => costosDe(presetDe(x.id))), OPCIONES_ESTUDIO, 'regla');
pool.cerrar();
const espont = Object.fromEntries(IDS_PRESET.map((id) => [id, espontaneosExcedentes(presetDe(id))]));
const configs: ConfigRegla[] = series.map(({ id, p, serie }) => {
  const c = costosDe(presetDe(id));
  const { analisis } = curvaDe(serie, KS, c);
  return { preset: id, p, N: turnosPorProfesional(presetDe(id)), e: espont[id]!.media, ks: KS, Bs: serie.datos.map((d) => beneficioDiario(d, serie.R, c)), kHat: analisis.kHat, conjunto: analisis.conjunto };
});
// Control: deben coincidir con el E4 del estudio precalculado.
const coinciden = configs.filter((c) => {
  const e4 = estudio.e4.configuraciones.find((x) => x.preset === c.preset && x.p === c.p)!;
  return e4.kHat === c.kHat && JSON.stringify(e4.conjunto) === JSON.stringify(c.conjunto);
}).length;
const loo = validacionDejandoUnoAfuera(configs);
console.log(`0.1 · ${configs.length} configuraciones re-simuladas; ${coinciden} coinciden con el E4 del estudio (k̂ y conjunto).`);
for (const id of IDS_PRESET) console.log(`   ē ${id}: ${espont[id]!.media.toFixed(3)} (λ ${espont[id]!.lambda.map((x) => x.toFixed(2)).join(' / ')}; cupos ${espont[id]!.cupos.join(' / ')})`);

// ------------------------------------------------------------ 0.2 mecanismo
const R_MEC = 500;
const kRec = (id: IdPresetEstudio, politica: PoliticaSobreturno): number => estudio.e1.find((x) => x.preset === id && x.politica === politica)!.curva.kRec;
const comparaciones = [
  { preset: 'centro' as const, politicas: ['inicio', 'mayor_ausentismo'] as PoliticaSobreturno[] },
  { preset: 'policonsultorio' as const, politicas: ['mayor_ausentismo', 'inicio'] as PoliticaSobreturno[] },
];
const mecanismo = comparaciones.map(({ preset, politicas }) => ({
  preset,
  configs: politicas.map((politica) => {
    const k = kRec(preset, politica);
    return { politica, k, perfil: perfilesMedios(aplicarNivel(presetDe(preset), { k, politica, ausentismo: null }), OPCIONES_ESTUDIO.semilla, R_MEC) };
  }),
}));
console.log(`0.2 · perfiles con R = ${R_MEC} días (trazas completas)`);

// ------------------------------------------------------------ A · fluido contra eventos discretos
const R_A = 500;
const grilla = Array.from({ length: (21 * 60 + 30 - 7 * 60) / 5 + 1 }, (_, i) => 7 * 60 + i * 5);
const casosA = [0, 2].map((k) => {
  const e = aplicarNivel(PRESETS[1]!, { k, politica: 'intercalado', ausentismo: null });
  const prep = prepararEscenario(e);
  const porT = grilla.map(() => new Float64Array(R_A));
  const areas = new Float64Array(R_A);
  const esperas = new Float64Array(R_A);
  const maximos = new Float64Array(R_A);
  for (let r = 0; r < R_A; r++) {
    const m = simularDia(prep, { semilla: OPCIONES_ESTUDIO.semilla, replica: r, serie: true }).metricas;
    const s = m.serie!;
    const mapa = new Map(s.t.map((t, i) => [t, s.sala[i]!]));
    grilla.forEach((t, i) => (porT[i]![r] = mapa.get(t) ?? 0));
    areas[r] = s.sala.reduce((a, v) => a + v * 5, 0);
    const entradas = m.esperaSala.n + m.perdidos.abandono;
    esperas[r] = entradas > 0 ? areas[r]! / entradas : 0;
    maximos[r] = Math.max(...s.sala);
  }
  const f = modeloFluido(e);
  const fMapa = new Map(f.t.map((t, i) => [t, f.sala[i]!]));
  return {
    k,
    politica: 'intercalado',
    R: R_A,
    t: grilla,
    des: porT.map((v) => ic(v)),
    fluido: grilla.map((t) => fMapa.get(t) ?? 0),
    desArea: ic(areas),
    desEspera: ic(esperas),
    desMaximo: ic(maximos),
    fluidoArea: f.area,
    fluidoEspera: f.esperaMedia,
    fluidoMaximo: f.maximo,
    fluidoPacientes: f.pacientes,
  };
});
console.log('A · fluido contra eventos discretos (policonsultorio, intercalado):');
for (const c of casosA) console.log(`   k = ${c.k}: área fluido ${c.fluidoArea.toFixed(1)} vs DES ${c.desArea.media.toFixed(1)} ± ${c.desArea.semi.toFixed(1)} pac·min/día · espera fluido ${c.fluidoEspera.toFixed(2)} vs DES ${c.desEspera.media.toFixed(2)} ± ${c.desEspera.semi.toFixed(2)} min · máximo ${c.fluidoMaximo.toFixed(2)} vs ${c.desMaximo.media.toFixed(2)}`);

// ------------------------------------------------------------ salida
const segundos = (performance.now() - t0) / 1000;
const salida = {
  version: 1,
  generado: new Date().toISOString(),
  semilla: OPCIONES_ESTUDIO.semilla,
  segundos,
  regla: {
    excedentes: espont,
    N: Object.fromEntries(IDS_PRESET.map((id) => [id, turnosPorProfesional(presetDe(id))])),
    coincidenConE4: coinciden,
    configuraciones: configs.map((c) => ({ preset: c.preset, p: c.p, N: c.N, e: c.e, kHat: c.kHat, conjunto: c.conjunto, R: c.Bs[0]!.length })),
    loo,
  },
  mecanismo,
  fluido: casosA,
};
mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, 'complementos.json'), JSON.stringify(salida));
writeFileSync(
  join(SALIDA, 'regla-loo.csv'),
  aCSV(
    ['escenario_afuera', 'regla', 'alfa', 'beta', 'perdida_media', 'perdida_ic_inf', 'perdida_ic_sup', 'aciertos', 'total'],
    loo.pliegues.flatMap((p) =>
      p.reglas.map((r) => {
        const g = r.evaluacion.regla;
        return [p.afuera, r.nombre, g.tipo === 'ingenua' ? '' : g.alfa, g.tipo === 'alfaBeta' ? g.beta : '', r.evaluacion.perdida.media, r.evaluacion.perdida.inf, r.evaluacion.perdida.sup, r.evaluacion.aciertos, r.evaluacion.total];
      }),
    ),
  ),
);
writeFileSync(
  join(SALIDA, 'mecanismo.csv'),
  aCSV(
    ['escenario', 'politica', 'k', 'franja_inicio_min', 'ocio_min', 'espera_turno_min', 'llegadas_espontaneos', 'abandonos', 'cupos_usados', 'sobreturnos_atendidos', 'ausentes'],
    mecanismo.flatMap((m) => m.configs.flatMap((c) => c.perfil.t.map((t, i) => [m.preset, c.politica, c.k, t, c.perfil.ocio[i]!, c.perfil.esperaTurno[i]!, c.perfil.llegadasEsp[i]!, c.perfil.abandonos[i]!, c.perfil.cuposUsados[i]!, c.perfil.sobreturnosAtendidos[i]!, c.perfil.ausentes[i]!]))),
  ),
);
writeFileSync(
  join(SALIDA, 'fluido.csv'),
  aCSV(['k', 't_min', 'sala_des_media', 'sala_des_ic_inf', 'sala_des_ic_sup', 'sala_fluido'], casosA.flatMap((c) => c.t.map((t, i) => [c.k, t, c.des[i]!.media, c.des[i]!.inf, c.des[i]!.sup, c.fluido[i]!]))),
);
console.log(`Listo en ${segundos.toFixed(1)} s → ${SALIDA}/complementos.json`);
