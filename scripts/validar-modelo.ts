/**
 * Tablas de validación del modelo: (b) M/G/1 y (c) red en serie (Burke/Jackson).
 * Uso: npm run validar-modelo
 */
import { COMPARACIONES_MODELO, REPLICAS_MODELO, SEMILLA_MODELO, validarJackson, validarMG1 } from '../src/modelo';

const f = (x: number): string => x.toFixed(4);
console.log(`Validación del modelo — R = ${REPLICAS_MODELO}, semilla ${SEMILLA_MODELO}, IC 95 % y simultáneo (Bonferroni, ${COMPARACIONES_MODELO} comparaciones)\n`);
for (const v of [validarMG1(), validarJackson()]) {
  console.log(`## ${v.comparaciones[0]!.caso}`);
  console.log(`≈ ${v.pacientesPorReplica} pacientes por réplica · ${v.segundos.toFixed(1)} s`);
  console.log('| Medida | Teórico | Media sim. | IC 95 % | ¿Dentro 95 %? | IC simultáneo | ¿Dentro simult.? | z |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const c of v.comparaciones) {
    console.log(
      `| ${c.medida} | ${f(c.teorico)} | ${f(c.ic.media)} | [${f(c.ic.inferior)}, ${f(c.ic.superior)}] | ${c.dentro ? 'SÍ' : 'NO'} | ` +
        `[${f(c.icSimultaneo.inferior)}, ${f(c.icSimultaneo.superior)}] | ${c.dentroSimultaneo ? 'SÍ' : 'NO'} | ${c.z.toFixed(2)} |`,
    );
  }
  console.log('');
}
