/**
 * Estudio Monte Carlo completo (docs/experimentos.md): corre E1–E6 en paralelo con worker_threads
 * y escribe public/resultados/estudio.json y los CSV.
 * Uso: npm run estudio [-- --hilos N] [-- --rapido]   (--rapido: R0 = 200, Rmax = 400, para probar)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { correrEstudio, OPCIONES_ESTUDIO } from '../src/experimentos';
import { tablasCSV } from '../src/experimentos/csv';
import { crearPoolNode } from '../src/experimentos/pool-node';

const args = process.argv.slice(2);
const valor = (nombre: string): string | undefined => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
const hilos = Number(valor('--hilos') ?? cpus().length);
const rapido = args.includes('--rapido');
const salida = valor('--salida') ?? 'public/resultados';
const opciones = rapido ? { R0: 200, Rmax: 400, Rprecision: 1000 } : {};

const pool = crearPoolNode(hilos);
const t0 = performance.now();
let ultimaFase = '';
const resultado = await correrEstudio(pool, {
  ...opciones,
  progreso: (fase, hechas, total) => {
    // En una terminal, una línea que se actualiza; en un log, una línea por fase.
    if (process.stdout.isTTY) {
      if (fase !== ultimaFase && ultimaFase) process.stdout.write('\n');
      process.stdout.write(`\r${fase} · ${hechas}/${total} tareas`);
    } else if (hechas === total) process.stdout.write(`${fase} · ${total} tareas\n`);
    ultimaFase = fase;
  },
});
pool.cerrar();
const segundos = (performance.now() - t0) / 1000;
if (process.stdout.isTTY) process.stdout.write('\n');

const json = { ...resultado, generado: new Date().toISOString(), entorno: { motor: `Node ${process.version}`, hilos, segundos } };
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, 'estudio.json'), JSON.stringify(json));
for (const [archivo, contenido] of Object.entries(tablasCSV(resultado))) writeFileSync(join(salida, archivo), contenido);

const o = { ...OPCIONES_ESTUDIO, ...opciones };
console.log(`Estudio listo en ${segundos.toFixed(1)} s con ${hilos} hilos · semilla ${o.semilla} · R0 ${o.R0} · Rmax ${o.Rmax}`);
console.log(`huella ${resultado.huella} · presets ${resultado.hashPresets} → ${salida}/estudio.json`);
