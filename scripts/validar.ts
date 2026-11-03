/**
 * Imprime la validación del motor contra M/M/c (Erlang C) y la Ley de Little,
 * más la curva de Welch usada para justificar el calentamiento.
 * Uso: npm run validar
 */
import {
  CASOS_VALIDACION,
  REPLICAS_VALIDACION,
  SEMILLA_VALIDACION,
  TOLERANCIA_LITTLE,
  mediaMovilWelch,
  serieCalentamientoMMc,
  teoriaEnMinutos,
  validarCaso,
} from '../src/motor';

const f = (x: number, d = 4): string => x.toFixed(d);

console.log(`Validación M/M/c — R = ${REPLICAS_VALIDACION} réplicas, semilla ${SEMILLA_VALIDACION}, IC 95 % (t de Student)\n`);
for (const caso of CASOS_VALIDACION) {
  const t0 = performance.now();
  const res = validarCaso(caso);
  const seg = (performance.now() - t0) / 1000;
  console.log(`## ${caso.nombre}`);
  console.log(
    `τ relajación = ${f(res.tiempoRelajacionHoras, 1)} h | calentamiento = ${caso.calentamientoHoras} h | medición = ${caso.duracionHoras} h | ` +
      `~${res.clientesPorReplica} clientes/réplica | ${res.eventosTotales} eventos | ${f(seg, 1)} s`,
  );
  console.log('| Medida | Teórico | Media sim. | IC 95 % | Semiancho rel. | z | ¿Dentro 95 %? | IC simultáneo | ¿Dentro simult.? |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const m of res.comparaciones) {
    console.log(
      `| ${m.nombre}${m.unidad ? ` [${m.unidad}]` : ''} | ${f(m.teorico)} | ${f(m.ic.media)} | [${f(m.ic.inferior)}, ${f(m.ic.superior)}] | ` +
        `${f((100 * m.ic.semiancho) / m.teorico, 2)} % | ${f(m.z, 2)} | ${m.dentro ? 'SÍ' : 'NO'} | ` +
        `[${f(m.icSimultaneo.inferior)}, ${f(m.icSimultaneo.superior)}] | ${m.dentroSimultaneo ? 'SÍ' : 'NO'} |`,
    );
  }
  const maxL = Math.max(...res.little.map((l) => l.errorL));
  const maxLq = Math.max(...res.little.map((l) => l.errorLq));
  console.log(
    `Little (cada réplica): máx |L − λ̂W|/L = ${f(100 * maxL, 3)} %, máx |Lq − λ̂Wq|/Lq = ${f(100 * maxLq, 3)} % ` +
      `(tolerancia ${100 * TOLERANCIA_LITTLE} %) → ${res.maxErrorLittle <= TOLERANCIA_LITTLE ? 'CUMPLE' : 'NO CUMPLE'}`,
  );
  const r0 = res.little[0]!;
  console.log(`  réplica 0: L = ${f(r0.L)}, λ̂W = ${f(r0.lambdaW)}; Lq = ${f(r0.Lq)}, λ̂Wq = ${f(r0.lambdaWq)}\n`);
}

// Welch: L promedio por intervalos desde sistema vacío, promediado sobre R réplicas.
console.log('## Calentamiento (método de Welch, R = 30, desde sistema vacío)');
for (const caso of CASOS_VALIDACION) {
  const teoria = teoriaEnMinutos(caso);
  const ancho = caso.calentamientoHoras * 6; // intervalos de calentamiento/10 h, en minutos
  const intervalos = 40; // 4 veces el calentamiento elegido
  const series = Array.from({ length: REPLICAS_VALIDACION }, (_, r) =>
    serieCalentamientoMMc({ lambdaPorHora: caso.lambdaPorHora, muPorHora: caso.muPorHora, c: caso.c, semilla: SEMILLA_VALIDACION + 1, replica: r }, ancho, intervalos),
  );
  const curva = mediaMovilWelch(series, 2);
  // Primeros 10 intervalos (= el calentamiento elegido) y resumen del resto.
  const transitorio = curva.slice(0, 10).map((v, i) => `${f(((i + 0.5) * ancho) / 60, 0)}h:${f(v, 2)}`).join('  ');
  const resto = curva.slice(10);
  const mediaResto = resto.reduce((a, b) => a + b, 0) / resto.length;
  console.log(`${caso.id} (L teórico = ${f(teoria.L, 3)}, intervalos de ${ancho / 60} h, ventana w = 2)`);
  console.log(`  durante el calentamiento: ${transitorio}`);
  console.log(
    `  después (${caso.calentamientoHoras}–${(curva.length * ancho) / 60} h): media ${f(mediaResto, 3)}, mín ${f(Math.min(...resto), 2)}, máx ${f(Math.max(...resto), 2)}`,
  );
}
