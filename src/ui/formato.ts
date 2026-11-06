/** Formato de números, montos y horas en es-AR. */
const f0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const f1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fp = new Intl.NumberFormat('es-AR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const entero = (x: number): string => f0.format(Math.round(x));
const f3 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const decimal = (x: number, d: 1 | 2 | 3 = 1): string => (Number.isFinite(x) ? (d === 1 ? f1 : d === 2 ? f2 : f3).format(x) : '—');
export const porcentaje = (x: number): string => (Number.isFinite(x) ? fp.format(x) : '—');
export const pesos = (x: number): string => (x < 0 ? '−$ ' : '$ ') + f0.format(Math.abs(Math.round(x)));
export const pesosCompacto = (x: number): string => {
  const a = Math.abs(x);
  const s = x < 0 ? '−$ ' : '$ ';
  if (a >= 1e6) return s + f2.format(a / 1e6) + ' M';
  if (a >= 1e3) return s + f0.format(a / 1e3) + ' mil';
  return s + f0.format(a);
};

/** Minutos desde las 00:00 → "HH:MM". */
export function hora(t: number): string {
  const m = Math.floor(t + 1e-6);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
}

/** "HH:MM" → minutos; null si no es válido. */
export function leerHora(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
