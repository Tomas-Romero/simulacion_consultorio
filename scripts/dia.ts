/**
 * Simula UN día del escenario por defecto e imprime todas sus métricas.
 * Uso: npm run dia -- [semilla] [réplica]
 */
import { CLASES, ESCENARIO_POR_DEFECTO, MOTIVOS_PERDIDA, prepararEscenario, simularDia, type ResumenEspera } from '../src/modelo';

const semilla = Number(process.argv[2] ?? 2026);
const replica = Number(process.argv[3] ?? 0);
const hhmm = (t: number): string => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const f = (x: number, d = 1): string => (Number.isNaN(x) ? '—' : x.toFixed(d));
const pesos = (x: number): string => `$${Math.round(x).toLocaleString('es-AR')}`;
const esp = (e: ResumenEspera): string => (e.n === 0 ? 'n = 0' : `n = ${e.n}, media ${f(e.media)}, P90 ${f(e.p90)}, máx ${f(e.max)}`);

const res = simularDia(prepararEscenario(ESCENARIO_POR_DEFECTO), { semilla, replica, traza: true });
const m = res.metricas;

console.log(`# ${ESCENARIO_POR_DEFECTO.nombre} — semilla ${semilla}, réplica ${replica}`);
console.log(`Día: ${hhmm(m.inicioDia)} a ${hhmm(m.finDia)} · ${res.eventos} eventos · ${res.traza!.registros.length} registros de traza\n`);

console.log('## Por profesional');
console.log('| Profesional | Turno | Llega | Se va | Ocio [min] | Extra [min] | Utilización | Atendidos (T/S/Td/E/U) | Ausentes | Perdidos propios | Costo total | Ingresos | Neto |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const p of m.porProfesional) {
  const a = p.atendidos;
  console.log(
    `| ${p.id} ${p.nombre} | ${hhmm(p.inicioTurno)}–${hhmm(p.finTurno)} | ${hhmm(p.llegada)} | ${hhmm(p.salida)} | ${f(p.ocio)} | ${f(p.horasExtra)} | ${f(100 * p.utilizacion)} % | ` +
      `${a.turno}/${a.sobreturno}/${a.tardio}/${a.espontaneo}/${a.urgencia} | ${p.ausentes} | ${p.perdidosPropios} | ${pesos(p.costos.total)} | ${pesos(p.ingresos)} | ${pesos(p.neto)} |`,
  );
}
for (const p of m.porProfesional) {
  console.log(`  ${p.id} espera [min]: ` + CLASES.filter((c) => p.espera[c].n > 0).map((c) => `${c} (${esp(p.espera[c])})`).join('; '));
}

console.log('\n## Totales');
console.log(`Pacientes generados: ${m.llegadas} = atendidos ${m.atendidosTotal} + perdidos ${m.perdidosTotal} + ausentes ${m.ausentes}`);
console.log(`Atendidos por clase: ${CLASES.map((c) => `${c} ${m.atendidos[c]}`).join(', ')}`);
console.log(`Perdidos por motivo: ${MOTIVOS_PERDIDA.map((x) => `${x} ${m.perdidos[x]}`).join(', ')}`);
console.log('Espera hasta la consulta [min], desde max(llegada, hora del turno):');
for (const c of [...CLASES, 'todas'] as const) console.log(`  ${c.padEnd(11)} ${esp(m.espera[c])}`);
console.log(`Espera en cola de admisión [min]: ${esp(m.esperaAdmision)}`);
console.log(`Espera en sala del consultorio [min] (inicio consulta − fin admisión): ${esp(m.esperaSala)}`);
console.log(`Ocio médico total: ${f(m.ocio)} min · horas extra total: ${f(m.horasExtra)} min`);
console.log(`Utilización médicos: ${f(100 * m.utilizacionMedicos)} % · utilización admisión: ${f(100 * m.utilizacionAdmision)} %`);
console.log(
  `Costos: espera ${pesos(m.costos.espera)} + ocio ${pesos(m.costos.ocio)} + extra ${pesos(m.costos.extra)} + perdidos ${pesos(m.costos.perdidos)} = ${pesos(m.costos.total)}`,
);
console.log(`Ingresos: ${pesos(m.ingresos)} · Resultado neto: ${pesos(m.neto)}`);
console.log(`Little del día: L = ${f(m.little.L, 4)} · λ·W = ${f(m.little.lambda * m.little.W, 4)} (n = ${m.little.n}, T = ${f(m.little.T)} min, W = ${f(m.little.W)} min)`);

if (m.serie) {
  console.log('\n## Sala de espera (cada 30 min: admisión / sala / en consulta)');
  const linea: string[] = [];
  m.serie.t.forEach((t, i) => {
    if (t % 30 === 0) linea.push(`${hhmm(t)} ${m.serie!.admision[i]}/${m.serie!.sala[i]}/${m.serie!.enConsulta[i]}`);
  });
  console.log(linea.join(' · '));
}

console.log('\n## Primeros 12 registros de la traza');
for (const r of res.traza!.registros.slice(0, 12)) {
  console.log(`${hhmm(r.t)} (${f(r.t, 2)}) paciente ${r.entidad} ${r.tipo} etapa=${r.etapa} clase=${r.clase} prio=${r.prioridad} prof=${r.profesional ?? '—'}${r.detalle ? ` ${r.detalle}` : ''}`);
}
