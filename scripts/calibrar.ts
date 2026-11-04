/**
 * Mide la situación inicial de los presets contra las metas de calibración.
 * Uso: npm run calibrar -- [semilla] [días]
 */
import { METAS_CALIBRACION as M, PRESETS, cumpleMetas, evaluarSituacion } from '../src/modelo';

const semilla = Number(process.argv[2] ?? 2026200);
const dias = Number(process.argv[3] ?? 1000);
const ok = (b: boolean): string => (b ? '✔' : '✘');
const diagnostico: string[] = [];

console.log(`Situación inicial de los presets — ${dias} días, semilla ${semilla}\n`);
console.log(
  `| Preset | k | Utilización (${M.utilizacion.min * 100}–${M.utilizacion.max * 100} %) | Ausentismo (${M.ausentismo.min * 100}–${M.ausentismo.max * 100} %) | ` +
    `Espera turno (${M.esperaTurno.min}–${M.esperaTurno.max} min) | Extra/médico (< ${M.horasExtraPorMedico.max} min) | Abandono (< ${M.abandono.max * 100} %) | ` +
    `Ocio/médico | Espont./día | Sin prof./día | Fuera hor./día | Costo medio |`,
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const e of PRESETS) {
  const i = evaluarSituacion(e, dias, semilla);
  const c = cumpleMetas(i);
  const ks = [...new Set(e.profesionales.map((p) => p.sobreturnos.k))].join('/');
  console.log(
    `| ${e.nombre} | ${ks} | ${(100 * i.utilizacion).toFixed(1)} % ${ok(c.utilizacion)} | ${(100 * i.ausentismo).toFixed(1)} % ${ok(c.ausentismo)} | ` +
      `${i.esperaTurno.toFixed(1)} ${ok(c.esperaTurno)} | ${i.horasExtraPorMedico.toFixed(1)} ${ok(c.horasExtraPorMedico)} | ${(100 * i.abandono).toFixed(1)} % ${ok(c.abandono)} | ` +
      `${i.ocioPorMedico.toFixed(1)} | ${i.espontaneosPorDia.toFixed(1)} | ${i.sinProfesionalPorDia.toFixed(2)} | ${i.fueraDeHorarioPorDia.toFixed(2)} | $${Math.round(i.costoMedio).toLocaleString('es-AR')} |`,
  );
  const a = i.abandonosPorEtapa;
  diagnostico.push(
    `${e.nombre}: espera media de espontáneos atendidos ${i.esperaEspontaneo.toFixed(1)} min · abandonos en la cola de admisión ` +
      `${(100 * a.colaAdmision).toFixed(0)} %, al salir de admisión ${(100 * a.finAdmision).toFixed(0)} %, en la sala ${(100 * a.sala).toFixed(0)} %`,
  );
}
console.log('\nAbandono (diagnóstico):');
for (const d of diagnostico) console.log(`  ${d}`);
