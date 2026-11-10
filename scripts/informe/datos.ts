/**
 * Datos del informe final (#7) que no están en public/resultados: validación contra teoría de colas,
 * calibración vigente, parámetros de los presets, ajuste de los datos de ejemplo, biestabilidad de la
 * lista de espera, trayectorias para las figuras, catálogo de tests, prueba de mutación y comparación
 * del estudio en el navegador. Todo se calcula con el código del proyecto (que no se modifica) y se
 * guarda en caché en informe/datos/*.json; con --rehacer se recalcula todo.
 *
 * Uso: npm run informe (lo llama antes de generar los .docx) · npx tsx scripts/informe/datos.ts --rehacer
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CASOS_VALIDACION, REPLICAS_VALIDACION, SEMILLA_VALIDACION, validarCaso } from '../../src/motor';
import {
  COMPARACIONES_MODELO,
  cumpleMetas,
  evaluarSituacion,
  METAS_CALIBRACION,
  prepararEscenario,
  PRESETS,
  PRESET_POLICONSULTORIO_3,
  REPLICAS_MODELO,
  SEMILLA_MODELO,
  validarJackson,
  validarMG1,
} from '../../src/modelo';
import { compararPoliticas, demandaCalibrada, equilibrios, parametrosBase, tablaDesdeEstudio } from '../../src/dinamica';
import {
  aplicarTiempos,
  compararAjustes,
  factorDeTipo,
  generarAsistencia,
  generarTiempos,
  mejorPorAIC,
  N_EJEMPLO,
  proporcionesPorTramo,
  regresionLogistica,
  SEMILLA_EJEMPLO,
  TIPOS_PACIENTE,
} from '../../src/datos';

const DIR = 'informe/datos';
const REHACER = process.argv.includes('--rehacer');
mkdirSync(DIR, { recursive: true });

function cache<T>(nombre: string, calcular: () => T): void {
  const ruta = join(DIR, `${nombre}.json`);
  if (!REHACER && existsSync(ruta)) {
    console.log(`  [datos] ${nombre}: en caché`);
    return;
  }
  const t0 = Date.now();
  const valor = calcular();
  writeFileSync(ruta, JSON.stringify(valor, null, 1));
  console.log(`  [datos] ${nombre}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

// ------------------------------------------------------------------ validación contra teoría de colas
cache('validacion', () => ({
  mmc: {
    replicas: REPLICAS_VALIDACION,
    semilla: SEMILLA_VALIDACION,
    casos: CASOS_VALIDACION.map((caso) => {
      const r = validarCaso(caso);
      return {
        nombre: caso.nombre,
        lambda: caso.lambdaPorHora,
        mu: caso.muPorHora,
        c: caso.c,
        calentamientoHoras: caso.calentamientoHoras,
        duracionHoras: caso.duracionHoras,
        tiempoRelajacionHoras: r.tiempoRelajacionHoras,
        clientesPorReplica: r.clientesPorReplica,
        maxErrorLittle: r.maxErrorLittle,
        maxErrorL: Math.max(...r.little.map((l) => l.errorL)),
        maxErrorLq: Math.max(...r.little.map((l) => l.errorLq)),
        comparaciones: r.comparaciones.map((m) => ({ nombre: m.nombre, unidad: m.unidad, teorico: m.teorico, media: m.ic.media, inf: m.ic.inferior, sup: m.ic.superior, semi: m.ic.semiancho, dentro: m.dentro, infSim: m.icSimultaneo.inferior, supSim: m.icSimultaneo.superior, dentroSim: m.dentroSimultaneo, z: m.z })),
      };
    }),
  },
  modelo: {
    replicas: REPLICAS_MODELO,
    semilla: SEMILLA_MODELO,
    comparacionesBonferroni: COMPARACIONES_MODELO,
    casos: [validarMG1(), validarJackson()].map((v) => ({
      caso: v.comparaciones[0]!.caso,
      pacientesPorReplica: v.pacientesPorReplica,
      comparaciones: v.comparaciones.map((c) => ({ medida: c.medida, teorico: c.teorico, media: c.ic.media, inf: c.ic.inferior, sup: c.ic.superior, dentro: c.dentro, infSim: c.icSimultaneo.inferior, supSim: c.icSimultaneo.superior, dentroSim: c.dentroSimultaneo, z: c.z })),
    })),
  },
}));

// ------------------------------------------------------------------ calibración vigente (presets congelados)
cache('calibracion', () => ({
  dias: 1000,
  semilla: 2026200,
  metas: METAS_CALIBRACION,
  presets: PRESETS.map((e) => {
    const i = evaluarSituacion(e, 1000, 2026200);
    return { nombre: e.nombre, indicadores: i, cumple: cumpleMetas(i) };
  }),
}));

// ------------------------------------------------------------------ parámetros de los presets
cache('presets', () =>
  PRESETS.map((e) => {
    const prep = prepararEscenario(e);
    return {
      nombre: e.nombre,
      descripcion: e.descripcion,
      jornada: e.jornada,
      profesionales: e.profesionales.map((p, i) => ({
        id: p.id,
        nombre: p.nombre,
        especialidad: p.especialidad,
        turno: p.turno,
        D: p.duracionTurno,
        ocupacion: p.ocupacionAgenda,
        cupos: p.cuposEspontaneos.cadaN,
        slots: prep.esCupo[i]!.length,
        slotsCupo: prep.esCupo[i]!.filter((x) => x).length,
        demora: p.demoraInicio,
        cOcio: prep.cOcio[i],
        cExtra: prep.cExtra[i],
      })),
      pacientes: e.pacientes,
      ausentismo: e.ausentismo,
      puntualidad: e.puntualidad,
      espontaneos: { ...e.espontaneos, totalDia: e.espontaneos.tasasPorHora.reduce((s, x) => s + x, 0) },
      admision: e.admision,
      costos: e.costos,
    };
  }),
);

// ------------------------------------------------------------------ ajuste de los datos de ejemplo (#6)
cache('datos-ejemplo', () => {
  const e = PRESET_POLICONSULTORIO_3;
  const t = generarTiempos(e);
  const cv = e.pacientes.atencion.cv;
  const s2 = Math.log(1 + cv * cv);
  const grupos = e.profesionales.flatMap((p) =>
    TIPOS_PACIENTE.map((tipo) => {
      const xs = t.filter((x) => x.profesional === p.id && x.tipo === tipo).map((x) => x.duracion);
      const filas = compararAjustes(xs);
      const media = factorDeTipo(e, tipo) * p.duracionTurno;
      return {
        profesional: p.id,
        nombreProfesional: p.nombre,
        tipo,
        n: xs.length,
        verdadero: { mu: Math.log(media) - s2 / 2, sigma: Math.sqrt(s2), media, cv },
        mejorAIC: mejorPorAIC(filas),
        ajustes: filas.map((f) => ({
          familia: f.ajuste.familia,
          parametros: f.ajuste.parametros,
          media: f.ajuste.media,
          cv: f.ajuste.cv,
          logL: f.ajuste.logVerosimilitud,
          aic: f.ajuste.aic,
          ks: f.ks,
          chi2: f.chi2 ? { estadistico: f.chi2.estadistico, gl: f.chi2.gl, p: f.chi2.p, clases: f.chi2.clases.length } : null,
        })),
        valores: xs,
      };
    }),
  );
  const ap = aplicarTiempos(e, t, 'lognormal');
  const obs = generarAsistencia(e);
  const r = regresionLogistica(obs);
  const grande = regresionLogistica(generarAsistencia(e, 99, 40000));
  return {
    semilla: SEMILLA_EJEMPLO,
    nPorTipo: N_EJEMPLO,
    total: t.length,
    grupos,
    aplicado: { cambios: ap.cambios, atencion: ap.escenario.pacientes.atencion, verdadero: e.pacientes.atencion },
    logistica: { ...r, verdadero: e.ausentismo, tramos: proporcionesPorTramo(obs) },
    logisticaGrande: { n: grande.n, beta1: grande.beta1, ee1: grande.ee1 },
  };
});

// ------------------------------------------------------------------ dinámica: biestabilidad y trayectorias
cache('dinamica-extra', () => {
  const base = { ...parametrosBase(), pico: null };
  const u14 = { ...base, desaliento: { ...base.desaliento, umbral: 14 } };
  const D14 = demandaCalibrada(u14);
  const tb = tablaDesdeEstudio(JSON.parse(readFileSync('public/resultados/estudio.json', 'utf8')));
  const rs = compararPoliticas(parametrosBase(), tb, 2);
  return {
    biestabilidad: { umbral: 14, demanda: D14, demandaRelativa: D14 / ((base.profesionales * base.turnosPorProfesional * base.diasHabiles) / 7), equilibrios: equilibrios(u14, 0, D14) },
    trayectorias: rs.map((r) => ({ nombre: r.nombre, t: r.trayectoria.t, L: r.trayectoria.L, a: r.trayectoria.a, p: r.trayectoria.p, k: r.trayectoria.semanas.map((s) => s.k), perdidosSemana: r.trayectoria.semanas.map((s) => s.perdidos) })),
    pico: parametrosBase().pico,
  };
});

// ------------------------------------------------------------------ catálogo de tests
cache('tests', () => {
  const salida = join(DIR, 'vitest.json');
  spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vitest', 'run', '--reporter=json', `--outputFile=${salida}`], { stdio: 'ignore', shell: true });
  const j = JSON.parse(readFileSync(salida, 'utf8')) as { numTotalTests: number; numPassedTests: number; numFailedTests: number; testResults: { name: string; assertionResults: { ancestorTitles: string[]; title: string; status: string }[] }[] };
  return {
    total: j.numTotalTests,
    pasan: j.numPassedTests,
    fallan: j.numFailedTests,
    archivos: j.testResults
      .map((f) => ({ archivo: f.name.replace(/\\/g, '/').replace(/^.*?\/tests\//, 'tests/'), tests: f.assertionResults.length, grupos: [...new Set(f.assertionResults.map((a) => a.ancestorTitles.join(' › ')))].filter(Boolean) }))
      .sort((a, b) => a.archivo.localeCompare(b.archivo)),
  };
});

// ------------------------------------------------------------------ prueba de mutación
// Cada mutante cambia una regla del modelo en src/modelo/simulacion.ts; se corre la suite del modelo y
// se cuenta cuántos tests fallan. El archivo se restaura siempre y se verifica con git que quedó igual.
const MUTANTES = [
  {
    id: 'prioridad',
    descripcion: 'Tardíos antes que puntuales en la selección del médico',
    viejo: '    const puntual = p.puntuales.extraerMinimo();\n    if (puntual) return puntual;\n    const tardio = p.tardios.sacar();\n    if (tardio) return tardio;',
    nuevo: '    const tardio = p.tardios.sacar();\n    if (tardio) return tardio;\n    const puntual = p.puntuales.extraerMinimo();\n    if (puntual) return puntual;',
  },
  { id: 'contador', descripcion: 'No se descuenta del contador de pacientes en el sistema al terminar la consulta', viejo: "    pac.estado = 'atendido';\n    enSistema--;", nuevo: "    pac.estado = 'atendido';" },
  { id: 'abandono', descripcion: 'No se cancela el abandono programado cuando empieza la consulta', viejo: '      sim.cancelar(pac.eventoAbandono);\n', nuevo: '' },
  { id: 'duracion', descripcion: 'La duración de la consulta ignora el factor de la clase (primera vez, control)', viejo: 'pac.factorAtencion * factorClase(pac) * p.cfg.duracionTurno', nuevo: 'pac.factorAtencion * p.cfg.duracionTurno' },
];
cache('mutacion', () => {
  const archivo = 'src/modelo/simulacion.ts';
  const original = readFileSync(archivo, 'utf8');
  const nl = original.includes('\r\n') ? '\r\n' : '\n';
  const correr = (): { total: number; fallan: number } => {
    const salida = join(DIR, 'vitest-mutacion.json');
    spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vitest', 'run', 'tests/modelo', '--reporter=json', `--outputFile=${salida}`], { stdio: 'ignore', shell: true });
    const j = JSON.parse(readFileSync(salida, 'utf8')) as { numTotalTests: number; numFailedTests: number };
    return { total: j.numTotalTests, fallan: j.numFailedTests };
  };
  const resultados: { id: string; descripcion: string; total: number; fallan: number }[] = [];
  try {
    for (const m of MUTANTES) {
      const viejo = m.viejo.replace(/\n/g, nl);
      if (original.split(viejo).length !== 2) throw new Error(`mutante ${m.id}: el fragmento no aparece exactamente una vez`);
      writeFileSync(archivo, original.replace(viejo, m.nuevo.replace(/\n/g, nl)));
      resultados.push({ id: m.id, descripcion: m.descripcion, ...correr() });
      writeFileSync(archivo, original);
    }
  } finally {
    writeFileSync(archivo, original);
  }
  execFileSync('git', ['diff', '--quiet', '--', archivo]);
  const control = correr();
  return { archivo, mutantes: resultados, control };
});

// ------------------------------------------------------------------ estudio completo en el navegador
cache('navegador', () => {
  const r = spawnSync('node', ['scripts/estudio-navegador.mjs'], { encoding: 'utf8', timeout: 600_000 });
  const texto = `${r.stdout ?? ''}`;
  const dec = texto.match(/(\d+) de (\d+) decisiones/);
  const seg = texto.match(/Estudio completo en el navegador: ([\d.]+) s/);
  const hilos = texto.match(/hardwareConcurrency (\d+)/);
  const dif = texto.match(/difieren a lo sumo en ([\d.e+-]+) relativo/);
  if (!dec) throw new Error(`no se pudo leer la comparación del navegador (¿npm run dev corriendo?):\n${texto}\n${r.stderr}`);
  return { decisionesIguales: Number(dec[1]), decisiones: Number(dec[2]), segundos: seg ? Number(seg[1]) : null, hilos: hilos ? Number(hilos[1]) : null, maxDifRelativa: dif ? Number(dif[1]) : null, huellaIgual: /idéntica bit a bit/.test(texto), texto: texto.trim() };
});

console.log('  [datos] listo: informe/datos/');
