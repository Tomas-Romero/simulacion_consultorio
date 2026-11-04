/**
 * Barrido de control (#2b): con la calibración congelada, k = 0..4 sobreturnos por
 * profesional con política "intercalado" en el escenario por defecto, 1000 días
 * con números aleatorios comunes (misma semilla y réplica para cada k).
 * Solo confirma si el problema de decisión es trivial; NO es el experimento del #4.
 * Uso: npm run barrido-control
 */
import { intervaloConfianza } from '../src/motor';
import { ESCENARIO_POR_DEFECTO, EsquemaEscenario, prepararEscenario, simularDia } from '../src/modelo';

const DIAS = 1000;
const SEMILLA = 2026300;
const $ = (x: number): string => '$' + Math.round(x).toLocaleString('es-AR');

const resultados = [0, 1, 2, 3, 4].map((k) => {
  const e = EsquemaEscenario.parse({
    ...ESCENARIO_POR_DEFECTO,
    profesionales: ESCENARIO_POR_DEFECTO.profesionales.map((p) => ({ ...p, sobreturnos: { k, politica: 'intercalado' } })),
  });
  const prep = prepararEscenario(e);
  const filas = Array.from({ length: DIAS }, (_, r) => simularDia(prep, { semilla: SEMILLA, replica: r, serie: false }).metricas);
  return { k, filas };
});

console.log(`Barrido de control — ${ESCENARIO_POR_DEFECTO.nombre}, política intercalado, ${DIAS} días, semilla ${SEMILLA}, NAC\n`);
console.log('| k (por médico) | Costo total medio | IC 95 % | Espera | Ocio | Horas extra | Perdidos | Neto medio | Atendidos/día | Abandonos/día | Utilización |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const { k, filas } of resultados) {
  const ic = intervaloConfianza(filas.map((m) => m.costos.total));
  const media = (f: (m: (typeof filas)[number]) => number): number => filas.reduce((s, m) => s + f(m), 0) / filas.length;
  console.log(
    `| ${k} | ${$(ic.media)} | [${$(ic.inferior)}, ${$(ic.superior)}] | ${$(media((m) => m.costos.espera))} | ${$(media((m) => m.costos.ocio))} | ` +
      `${$(media((m) => m.costos.extra))} | ${$(media((m) => m.costos.perdidos))} | ${$(media((m) => m.neto))} | ${media((m) => m.atendidosTotal).toFixed(1)} | ` +
      `${media((m) => m.perdidos.abandono).toFixed(2)} | ${(100 * media((m) => m.utilizacionMedicos)).toFixed(1)} % |`,
  );
}

console.log('\nDiferencia pareada de costo contra k = 0 (mismos días):');
const base = resultados[0]!.filas;
for (const { k, filas } of resultados.slice(1)) {
  const ic = intervaloConfianza(filas.map((m, r) => m.costos.total - base[r]!.costos.total));
  console.log(`  k = ${k}: ${$(ic.media)} · IC 95 % [${$(ic.inferior)}, ${$(ic.superior)}]`);
}
