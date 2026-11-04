// fps de la animación en Chrome headless (CDP), con 3 y 6 profesionales, simple y comparación.
// Requiere `npm run dev` en el puerto 5173. Uso: npm run medir-fps   (CHROME=ruta para otro navegador)
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.argv[2] ?? 'http://localhost:5173/#/simulacion';
const PUERTO = 9300 + (process.pid % 600);
const perfil = mkdtempSync(join(tmpdir(), 'chrome-fps-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--window-size=1440,900', '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let info;
for (let i = 0; i < 50 && !info; i++) {
  try {
    info = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
  } catch {
    await espera(200);
  }
}
const pagina = info.find((t) => t.type === 'page');
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pendientes = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) {
    pendientes.get(m.id)(m);
    pendientes.delete(m.id);
  }
});
const cdp = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pendientes.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluar = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
};

await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: URL });
await espera(4000);

const script = `(async () => {
  const espera = (ms) => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 100 && !window.__app; i++) await espera(200);
  if (!window.__app) return 'la app no cargó';
  async function medir(preset, comparar) {
    location.hash = '#/simulacion' + (comparar ? '?comparar=1' : '');
    await espera(400);
    window.__app.cargarPreset(preset);
    await espera(3000);
    const r = window.__reproductor;
    const dibujantes = [...document.querySelectorAll('.plano canvas')].map(c => c.__dibujante).filter(Boolean);
    // 1) Trabajo por cuadro: 300 cuadros seguidos a 300× (dibujo de todos los canvas).
    const N = 300;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) { const t = 540 + i * (300 / 60 / 60); for (const d of dibujantes) d.dibujar(t, 1 / 60, false); }
    const msTrabajo = (performance.now() - t0) / N;
    // 2) fps reales reproduciendo (incluye React a 10 Hz, composición y el resto de la página).
    r.setVelocidad(300); r.ir(9 * 60); r.reproducir();
    await espera(300);
    let n = 0; const t1 = performance.now();
    await new Promise(res => { const f = () => { n++; if (performance.now() - t1 < 5000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    r.pausar();
    return { preset, modo: comparar ? 'comparacion' : 'simple', canvas: dibujantes.length, profesionales: window.__app ? undefined : undefined, fps: +(n / ((performance.now() - t1) / 1000)).toFixed(1), msTrabajoPorCuadro: +msTrabajo.toFixed(2), fpsMaxPorTrabajo: Math.round(1000 / msTrabajo) };
  }
  const out = [];
  for (const [p, c] of [['policonsultorio', false], ['centro', false], ['policonsultorio', true], ['centro', true]]) out.push(await medir(p, c));
  return out;
})()`;
const res = await evaluar(script);
console.table(res);
ws.close();
chrome.kill();
process.exit(0);
