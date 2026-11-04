/**
 * Tiempo de simulación de un día (sin traza, como en Monte Carlo) para los presets.
 * Uso: npm run rendimiento
 */
import { PRESET_CENTRO_6, PRESET_CONSULTORIO_CHICO, PRESET_POLICONSULTORIO_3, prepararEscenario, simularDia } from '../src/modelo';

const DIAS = 5000;
console.log(`Node ${process.version} · ${DIAS} días por medición (después de 500 de calentamiento del JIT)\n`);
console.log('| Escenario | Modo | ms/día | días/s | pacientes/día | eventos/día |');
console.log('|---|---|---|---|---|---|');
for (const escenario of [PRESET_CONSULTORIO_CHICO, PRESET_POLICONSULTORIO_3, PRESET_CENTRO_6]) {
  const prep = prepararEscenario(escenario);
  for (const [modo, opciones] of [
    ['Monte Carlo (sin traza ni serie)', { traza: false, serie: false }],
    ['con serie de sala', { traza: false, serie: true }],
    ['con traza completa', { traza: true, serie: true }],
  ] as const) {
    for (let r = 0; r < 500; r++) simularDia(prep, { semilla: 1, replica: r, ...opciones });
    let pacientes = 0;
    let eventos = 0;
    const t0 = performance.now();
    for (let r = 0; r < DIAS; r++) {
      const res = simularDia(prep, { semilla: 2, replica: r, ...opciones });
      pacientes += res.metricas.llegadas;
      eventos += res.eventos;
    }
    const ms = (performance.now() - t0) / DIAS;
    console.log(`| ${escenario.nombre} | ${modo} | ${ms.toFixed(3)} | ${Math.round(1000 / ms)} | ${(pacientes / DIAS).toFixed(1)} | ${(eventos / DIAS).toFixed(0)} |`);
  }
}
