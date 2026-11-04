/**
 * Barrido de control (#2c): con la calibración congelada, k = 0..6 sobreturnos por
 * profesional con política "intercalado" en el escenario por defecto, 1000 días
 * con números aleatorios comunes (misma semilla y réplica para cada k).
 * Informa el beneficio neto B (criterio principal) y el costo clásico C (secundario).
 * Solo confirma si el problema de decisión es trivial; NO es el experimento del #4.
 * Uso: npm run barrido-control -- [semilla]
 */
import { intervaloConfianza } from '../src/motor';
import { ESCENARIO_POR_DEFECTO, EsquemaEscenario, prepararEscenario, simularDia } from '../src/modelo';

const DIAS = 1000;
const SEMILLA = Number(process.argv[2] ?? 2026400);
const KS = [0, 1, 2, 3, 4, 5, 6];
const $ = (x: number): string => '$' + Math.round(x).toLocaleString('es-AR');
const ic$ = (ic: { inferior: number; superior: number }): string => `[${$(ic.inferior)}, ${$(ic.superior)}]`;

const prep0 = prepararEscenario(ESCENARIO_POR_DEFECTO);
const resultados = KS.map((k) => {
  const e = EsquemaEscenario.parse({
    ...ESCENARIO_POR_DEFECTO,
    profesionales: ESCENARIO_POR_DEFECTO.profesionales.map((p) => ({ ...p, sobreturnos: { k, politica: 'intercalado' } })),
  });
  const prep = prepararEscenario(e);
  return { k, filas: Array.from({ length: DIAS }, (_, r) => simularDia(prep, { semilla: SEMILLA, replica: r, serie: false }).metricas) };
});
type Fila = (typeof resultados)[number]['filas'][number];
const media = (filas: Fila[], f: (m: Fila) => number): number => filas.reduce((s, m) => s + f(m), 0) / filas.length;

console.log(`Barrido de control — ${ESCENARIO_POR_DEFECTO.nombre}, política intercalado, ${DIAS} días, semilla ${SEMILLA}, NAC`);
console.log(`c_ocio derivado por profesional: ${ESCENARIO_POR_DEFECTO.profesionales.map((p, i) => `${p.id} ${$(prep0.cOcio[i]!)}/min`).join(', ')}\n`);

console.log('| k | B medio | IC 95 % de B | C medio | IC 95 % de C | Ingresos | Espera $ | Ocio $ | Extra $ | Perdidos $ | Atendidos | Abandonos | Ocio [min] | Extra [min] | Utilización |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const { k, filas } of resultados) {
  const b = intervaloConfianza(filas.map((m) => m.beneficio));
  const c = intervaloConfianza(filas.map((m) => m.costos.total));
  console.log(
    `| ${k} | ${$(b.media)} | ${ic$(b)} | ${$(c.media)} | ${ic$(c)} | ${$(media(filas, (m) => m.ingresos))} | ${$(media(filas, (m) => m.costos.espera))} | ` +
      `${$(media(filas, (m) => m.costos.ocio))} | ${$(media(filas, (m) => m.costos.extra))} | ${$(media(filas, (m) => m.costos.perdidos))} | ` +
      `${media(filas, (m) => m.atendidosTotal).toFixed(1)} | ${media(filas, (m) => m.perdidos.abandono).toFixed(2)} | ${media(filas, (m) => m.ocio).toFixed(1)} | ` +
      `${media(filas, (m) => m.horasExtra).toFixed(1)} | ${(100 * media(filas, (m) => m.utilizacionMedicos)).toFixed(1)} % |`,
  );
}

const base = resultados[0]!.filas;
console.log('\nDiferencias pareadas contra k = 0 (mismos días):');
console.log('| k | ΔB medio | IC 95 % de ΔB | ΔC medio | IC 95 % de ΔC | Δ(C + B) medio |');
console.log('|---|---|---|---|---|---|');
for (const { k, filas } of resultados.slice(1)) {
  const db = intervaloConfianza(filas.map((m, r) => m.beneficio - base[r]!.beneficio));
  const dc = intervaloConfianza(filas.map((m, r) => m.costos.total - base[r]!.costos.total));
  console.log(`| ${k} | ${$(db.media)} | ${ic$(db)} | ${$(dc.media)} | ${ic$(dc)} | ${$(db.media + dc.media)} |`);
}

console.log('\nDiferencias pareadas de B entre k consecutivos (mismos días):');
for (let i = 1; i < resultados.length; i++) {
  const a = resultados[i - 1]!;
  const b = resultados[i]!;
  const d = intervaloConfianza(b.filas.map((m, r) => m.beneficio - a.filas[r]!.beneficio));
  console.log(`  B(${b.k}) − B(${a.k}): ${$(d.media)} · IC 95 % ${ic$(d)}`);
}

// Descomposición de Δ(C + B) = honorario·Δatendidos + Δ(costo de ocio) contra k = 0.
console.log('\nDescomposición de Δ(C + B) contra k = 0:');
for (const { k, filas } of resultados.slice(1)) {
  const dAt = media(filas, (m) => m.atendidosTotal) - media(base, (m) => m.atendidosTotal);
  const dOcio = media(filas, (m) => m.costos.ocio) - media(base, (m) => m.costos.ocio);
  const dExtra = media(filas, (m) => m.horasExtra) - media(base, (m) => m.horasExtra);
  console.log(
    `  k = ${k}: honorario·Δatendidos ${$(ESCENARIO_POR_DEFECTO.costos.honorario * dAt)} (${dAt.toFixed(2)} consultas) + Δ costo de ocio ${$(dOcio)} = ${$(ESCENARIO_POR_DEFECTO.costos.honorario * dAt + dOcio)} · Δ horas extra ${dExtra.toFixed(1)} min`,
  );
}

const bMedio = resultados.map(({ k, filas }) => ({ k, b: media(filas, (m) => m.beneficio), c: media(filas, (m) => m.costos.total) }));
const kB = bMedio.reduce((a, x) => (x.b > a.b ? x : a));
const kC = bMedio.reduce((a, x) => (x.c < a.c ? x : a));
console.log(`\nk que maximiza B: ${kB.k} (B = ${$(kB.b)}) · k que minimiza C: ${kC.k} (C = ${$(kC.c)})`);
console.log('C + B medio por k (constante si la equivalencia fuera exacta): ' + bMedio.map((x) => `k=${x.k} ${$(x.c + x.b)}`).join(' · '));
