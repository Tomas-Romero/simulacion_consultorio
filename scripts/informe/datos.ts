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
import { CASOS_VALIDACION, empiricaDiscreta, FabricaFlujos, lognormal, PoissonNoHomogeneo, REPLICAS_VALIDACION, SEMILLA_VALIDACION, validarCaso, type FuenteUniforme } from '../../src/motor';
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
  simularDia,
  validarJackson,
  validarMG1,
} from '../../src/modelo';
import { auxiliares, compararPoliticas, demandaCalibrada, equilibrio, equilibrios, parametrosBase, tablaDesdeEstudio } from '../../src/dinamica';
import { aplicarNivel } from '../../src/experimentos';
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

// ------------------------------------------------------------------ cálculos resueltos de la versión de entrega (#7c)
// Todos los valores salen del generador y de las funciones del proyecto; Python los recalcula como verificación.
cache('calculos', () => {
  const e = PRESET_POLICONSULTORIO_3;
  const fija = (u: number): FuenteUniforme => ({ uniforme: () => u });
  // 1. Transformada inversa con uniformes reales del generador (semilla 2026, flujo propio del ejemplo).
  const g = new FabricaFlujos(2026, 0).flujo('ejemplo-informe');
  const u = { anticipacion: g.uniforme(), falta: g.uniforme(), atencion: g.uniforme(), paciencia: g.uniforme() };
  const at = e.pacientes.atencion;
  const prof = e.profesionales[0]!;
  const factorAt = lognormal(1, at.cv).muestrear(fija(u.atencion));
  const pac = e.espontaneos.paciencia as { tipo: 'lognormal'; media: number; cv: number };
  const paciencia = lognormal(pac.media, pac.cv).muestrear(fija(u.paciencia));
  const anticipacion = empiricaDiscreta(e.pacientes.anticipacion).muestrear(fija(u.anticipacion));
  const pDe = (d: number): number => 1 / (1 + Math.exp(-(e.ausentismo.beta0 + e.ausentismo.beta1 * d)));
  // 2. Poisson no homogéneo por thinning: los primeros candidatos, paso a paso, y control contra el generador del motor.
  const tasas = e.espontaneos.tasasPorHora;
  const pnh = new PoissonNoHomogeneo(tasas.map((t, i) => ({ desde: e.jornada.inicio + 60 * i, hasta: e.jornada.inicio + 60 * (i + 1), tasa: t / 60 })));
  const gt = new FabricaFlujos(2026, 0).flujo('ejemplo-thinning');
  const candidatos: { u1: number; t: number; lambda: number; u2: number; acepta: boolean }[] = [];
  let t = e.jornada.inicio;
  while (candidatos.length < 6) {
    const u1 = gt.uniforme();
    t -= Math.log(u1) / pnh.tasaMaxima;
    const u2 = gt.uniforme();
    const lambda = pnh.tasaEn(t);
    candidatos.push({ u1, t, lambda, u2, acepta: u2 * pnh.tasaMaxima < lambda });
  }
  const llegadasMotor = pnh.generar(new FabricaFlujos(2026, 0).flujo('ejemplo-thinning'), e.jornada.inicio, e.jornada.fin);
  // 3. Monte Carlo: los días del estudio (semilla 2026600) del policonsultorio con su política ganadora, k = 0 y k = 2.
  const R = 2000;
  const dia = (k: number): number[] => {
    const prep = prepararEscenario(aplicarNivel(e, { k, politica: 'mayor_ausentismo', ausentismo: null }));
    return Array.from({ length: R }, (_, r) => simularDia(prep, { semilla: 2026600, replica: r, traza: false, serie: false }).metricas.beneficio);
  };
  const b0 = dia(0);
  const b2 = dia(2);
  // 4. Ley de Little sobre un día del modelo (policonsultorio, semilla 2026, réplica 0).
  const little = simularDia(prepararEscenario(e), { semilla: 2026, replica: 0, serie: false }).metricas.little;
  // 5. Dinámica de sistemas: un paso de Euler al empezar el pico, desde el consultorio de hoy, con k = 0.
  const prm = parametrosBase();
  const L0 = equilibrio({ ...prm, pico: null }, 0).L;
  const t0 = prm.pico!.inicio * 7;
  const x = auxiliares(prm, t0, L0, 0);
  const dL = x.D * (1 - x.d) + prm.reingreso * x.p * x.S - x.S;
  const dt = 0.25;
  return {
    transformada: {
      u, factorAtencion: factorAt, cvAtencion: at.cv, factorControl: at.factorControl, D: prof.duracionTurno, nombreProfesional: prof.nombre,
      duracion: factorAt * at.factorControl * prof.duracionTurno, paciencia, pacienciaMedia: pac.media, pacienciaCv: pac.cv,
      tablaAnticipacion: e.pacientes.anticipacion, anticipacion, pFalta: pDe(anticipacion), falta: u.falta < pDe(anticipacion),
      p1: pDe(1), p30: pDe(30), beta0: e.ausentismo.beta0, beta1: e.ausentismo.beta1,
    },
    thinning: { tasasPorHora: tasas, tasaMaximaPorMin: pnh.tasaMaxima, inicio: e.jornada.inicio, candidatos, llegadasMotor: llegadasMotor.slice(0, 6), totalMotor: llegadasMotor.length, esperado: pnh.esperadoEntre(e.jornada.inicio, e.jornada.fin) },
    montecarlo: { R, semilla: 2026600, b0, b2 },
    little,
    euler: { t0, L0, dt, C: x.C, a: x.a, p: x.p, d: x.d, D: x.D, S: x.S, r: prm.reingreso, dL, L1: L0 + dt * dL },
  };
});

console.log('  [datos] listo: informe/datos/');
