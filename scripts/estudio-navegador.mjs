// Mide el estudio completo corrido en el navegador (Chrome headless, pool de Web Workers) y compara
// su huella con la del JSON precalculado en Node. Requiere `npm run dev`. Uso: npm run estudio-navegador
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO = 9300 + (process.pid % 600);
const perfil = mkdtempSync(join(tmpdir(), 'chrome-estudio-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
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

await cdp('Page.navigate', { url: 'http://localhost:5173/#/experimentos' });
const listo = await evaluar(`(async () => { for (let i = 0; i < 200 && !(window.__reproducirEstudio && document.querySelector('.seccion-exp')); i++) await new Promise(r => setTimeout(r, 100)); return !!window.__reproducirEstudio; })()`);
if (!listo) throw new Error('la pantalla de Experimentos no cargó');
const t0 = Date.now();
const resultado = await evaluar(`(async () => {
  await window.__reproducirEstudio();
  for (let i = 0; i < 50 && !document.querySelector('.verificacion'); i++) await new Promise(r => setTimeout(r, 100));
  const v = document.querySelector('.verificacion');
  return { texto: v ? v.textContent : null, hilos: navigator.hardwareConcurrency };
})()`);
console.log(`Estudio completo en el navegador: ${((Date.now() - t0) / 1000).toFixed(1)} s (medido desde Node) · hardwareConcurrency ${resultado.hilos}`);
console.log(resultado.texto);
ws.close();
chrome.kill();
process.exit(0);
