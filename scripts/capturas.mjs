// Capturas de docs/capturas/ con Chrome headless (CDP). Requiere `npm run dev` en el puerto 5173.
// Uso: npm run capturas [-- <filtro>]   (CHROME=ruta para otro navegador)
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173/';
const SALIDA = 'docs/capturas';
const FILTRO = process.argv[2] ?? '';
mkdirSync(SALIDA, { recursive: true });
const PUERTO = 9300 + (process.pid % 600); // un puerto por proceso: evita chocar con un Chrome que todavía se está cerrando
const perfil = mkdtempSync(join(tmpdir(), 'chrome-cap-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let info;
for (let i = 0; i < 50 && !info; i++) {
  try {
    info = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
  } catch {
    await espera(200);
  }
}
const ws = new WebSocket(info.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pend = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    pend.get(m.id)(m);
    pend.delete(m.id);
  }
});
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluar = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

// [archivo, ruta, tema, ancho, alto, página completa, preparación (JS), espera ms, selector (opcional: captura solo ese elemento), medio ('print' opcional)]
const EJEMPLO = "setTimeout(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Usar datos de ejemplo')).forEach((b) => b.click()), 800)";
const CAPTURAS = [
  ['01-inicio-claro', '', 'claro', 1440, 900, false, '', 2500],
  ['02-inicio-oscuro', '', 'oscuro', 1440, 900, false, '', 2500],
  ['03-inicio-completo-claro', '', 'claro', 1440, 900, true, '', 2500],
  ['04-escenario-claro', '#/escenario', 'claro', 1440, 900, true, '', 1500],
  ['05-escenario-oscuro', '#/escenario', 'oscuro', 1440, 900, false, '', 1500],
  ['06-escenario-error-claro', '#/escenario', 'claro', 1440, 900, false, "__app.editarEscenario(e => ({...e, pacientes: {...e.pacientes, proporcionPrimeraVez: 1.4}})); setTimeout(() => document.querySelector('.campo.con-error').scrollIntoView({block: 'center'}), 300)", 1500],
  ['07-simulacion-policonsultorio-claro', '#/simulacion?t=10:40', 'claro', 1440, 900, false, '', 3000],
  ['08-simulacion-centro-oscuro', '#/simulacion?t=11:10', 'oscuro', 1440, 900, false, "__app.cargarPreset('centro')", 3000],
  ['09-comparacion-policonsultorio-claro', '#/simulacion?comparar=1&t=11:20', 'claro', 1440, 900, false, '', 3500],
  ['10-comparacion-centro-oscuro', '#/simulacion?comparar=1&t=11:20', 'oscuro', 1440, 900, false, "__app.cargarPreset('centro')", 3500],
  ['11-resultados-claro', '#/resultados', 'claro', 1440, 900, true, '', 3500],
  ['12-resultados-oscuro', '#/resultados', 'oscuro', 1440, 900, true, '', 3500],
  ['13-acerca-claro', '#/acerca', 'claro', 1440, 900, true, '', 1500],
  ['14-datos-oscuro', '#/datos', 'oscuro', 1440, 900, false, '', 1200],
  ['15-diagnostico-claro', '#/diagnostico', 'claro', 1440, 900, false, '', 9000],
  ['16-movil-inicio-claro', '', 'claro', 390, 844, true, '', 2500],
  ['17-movil-simulacion-oscuro', '#/simulacion?t=10:40', 'oscuro', 390, 844, true, '', 3000],
  ['18-tablet-simulacion-claro', '#/simulacion?t=10:40', 'claro', 820, 1180, false, '', 3000],
  ['19-experimentos-claro', '#/experimentos', 'claro', 1440, 900, false, '', 3000],
  ['20-exp-a-curva-claro', '#/experimentos', 'claro', 1440, 900, false, '', 3500, '#curva'],
  ['21-exp-b-politicas-claro', '#/experimentos', 'claro', 1440, 900, false, '', 3500, '#politicas'],
  ['22-exp-c-sensibilidad-claro', '#/experimentos', 'claro', 1440, 900, false, '', 3500, '#sensibilidad'],
  ['23-exp-d-regla-claro', '#/experimentos', 'claro', 1440, 900, false, '', 3500, '#regla'],
  ['24-exp-e-riesgo-claro', '#/experimentos', 'claro', 1440, 900, false, '', 3500, '#riesgo'],
  ['25-exp-f-laboratorio-claro', '#/experimentos', 'claro', 1440, 900, false, "setTimeout(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Correr el experimento')).click(), 2500)", 14000, '#laboratorio'],
  ['26-exp-a-curva-oscuro', '#/experimentos', 'oscuro', 1440, 900, false, '', 3500, '#curva'],
  ['27-exp-c-sensibilidad-oscuro', '#/experimentos', 'oscuro', 1440, 900, false, '', 3500, '#sensibilidad'],
  ['28-ds-estructura-claro', '#/dinamica', 'claro', 1440, 900, false, '', 3000, '#estructura'],
  ['29-ds-politicas-claro', '#/dinamica', 'claro', 1440, 900, false, '', 3500, '#politicas-ds'],
  ['30-ds-fluido-claro', '#/dinamica', 'claro', 1440, 900, false, '', 3500, '#fluido'],
  ['31-ds-numerico-claro', '#/dinamica', 'claro', 1440, 900, false, '', 3500, '#numerico'],
  ['32-ds-estructura-oscuro', '#/dinamica', 'oscuro', 1440, 900, false, '', 3000, '#estructura'],
  ['33-ds-politicas-oscuro', '#/dinamica', 'oscuro', 1440, 900, false, '', 3500, '#politicas-ds'],
  ['34-ds-sensibilidad-claro', '#/dinamica', 'claro', 1440, 900, false, '', 3500, '#sensibilidad-ds'],
  ['35-datos-tiempos-claro', '#/datos', 'claro', 1440, 900, false, EJEMPLO, 3000, '#tiempos'],
  ['36-datos-asistencia-claro', '#/datos', 'claro', 1440, 900, false, EJEMPLO, 3000, '#asistencia'],
  ['37-datos-tiempos-oscuro', '#/datos', 'oscuro', 1440, 900, false, EJEMPLO, 3000, '#tiempos'],
  // El reporte incluye el laboratorio si antes se corrió la captura 25 (sessionStorage de la misma pestaña).
  ['38-reporte-claro', '#/reporte', 'claro', 1440, 900, true, '', 3500],
  ['39-reporte-impresion', '#/reporte', 'oscuro', 1000, 900, true, '', 3500, '', 'print'],
];

for (const [archivo, ruta, tema, w, h, completa, prep, ms, selector, medio] of CAPTURAS) {
  if (FILTRO && !archivo.includes(FILTRO)) continue;
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: w < 500 ? 2 : 1, mobile: w < 500 });
  await cdp('Emulation.setEmulatedMedia', { media: medio ?? '', features: [{ name: 'prefers-color-scheme', value: tema === 'oscuro' ? 'dark' : 'light' }] });
  // Estado limpio: preset por defecto.
  await cdp('Page.navigate', { url: BASE });
  await espera(800);
  await evaluar(`localStorage.clear(); 1`);
  const sep = ruta.includes('?') ? '&' : '?';
  const hash = ruta ? `${ruta}${sep}tema=${tema}` : `#/?tema=${tema}`;
  await cdp('Page.navigate', { url: BASE + hash });
  await evaluar(`(async () => { for (let i = 0; i < 100 && !window.__app; i++) await new Promise(r => setTimeout(r, 100)); await document.fonts.ready; return 1; })()`);
  if (prep) {
    await evaluar(`(() => { ${prep}; return 1; })()`);
  }
  await espera(ms);
  let params = { format: 'png' };
  if (completa) {
    const alto = await evaluar('document.documentElement.scrollHeight');
    params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: alto, scale: 1 } };
  } else if (selector) {
    // Solo la sección: su caja en coordenadas de la página (con un margen arriba y abajo).
    // Espera a que exista la sección (la pantalla carga datos de forma asíncrona).
    await evaluar(`(async () => { for (let i = 0; i < 100 && !document.querySelector('${selector}'); i++) await new Promise(r => setTimeout(r, 100)); return 1; })()`);
    const texto = await evaluar(`JSON.stringify((() => { const el = document.querySelector('${selector}'); if (!el) return null; const r = el.getBoundingClientRect(); return { y: r.top + scrollY, alto: r.height }; })())`);
    const caja = texto ? JSON.parse(texto) : null;
    if (!caja) {
      console.log('falta', selector, 'en', archivo, '·', String(await evaluar('document.body.innerText.slice(0, 300)')).replace(/\s+/g, ' '));
      continue;
    }
    params = { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: Math.max(0, caja.y - 16), width: w, height: caja.alto + 24, scale: 1 } };
  }
  const r = await cdp('Page.captureScreenshot', params);
  writeFileSync(join(SALIDA, `${archivo}.png`), Buffer.from(r.result.data, 'base64'));
  console.log('ok', archivo);
}
ws.close();
chrome.kill();
process.exit(0);
