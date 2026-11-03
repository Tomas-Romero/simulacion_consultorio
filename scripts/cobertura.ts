/**
 * Estudio de cobertura del IC 95 %: repite la validación M/M/c con 20 semillas
 * distintas y cuenta qué fracción de los IC individuales contiene el valor
 * teórico. Si el motor no tiene sesgo, la cobertura debe rondar el 95 % y los
 * desvíos deben tener ambos signos. Uso: npm run cobertura (≈ 40 s)
 */
import { CASOS_VALIDACION, REPLICAS_VALIDACION, validarCaso } from '../src/motor';

const SEMILLAS = Array.from({ length: 20 }, (_, i) => 1000 + i);
let total = 0;
let cubiertos = 0;
let positivos = 0;
const porMedida = new Map<string, [number, number]>();
const t0 = performance.now();

for (const semilla of SEMILLAS) {
  const fuera: string[] = [];
  for (const caso of CASOS_VALIDACION) {
    for (const m of validarCaso(caso, REPLICAS_VALIDACION, semilla).comparaciones) {
      total++;
      if (m.z > 0) positivos++;
      if (m.dentro) cubiertos++;
      else fuera.push(`${caso.id}:${m.clave} (z = ${m.z.toFixed(2)})`);
      const clave = `${caso.id} · ${m.clave}`;
      const [c, n] = porMedida.get(clave) ?? [0, 0];
      porMedida.set(clave, [c + (m.dentro ? 1 : 0), n + 1]);
    }
  }
  console.log(`semilla ${semilla}: ${fuera.length === 0 ? 'todas dentro' : `fuera → ${fuera.join(', ')}`}`);
}

console.log(`\nCobertura global: ${cubiertos}/${total} = ${((100 * cubiertos) / total).toFixed(1)} % (nominal 95 %)`);
console.log(`Desvíos con z > 0: ${positivos}/${total} (sin sesgo se espera ≈ 50 %)`);
for (const [clave, [c, n]] of porMedida) console.log(`  ${clave}: ${c}/${n}`);
console.log(`(${((performance.now() - t0) / 1000).toFixed(0)} s)`);
