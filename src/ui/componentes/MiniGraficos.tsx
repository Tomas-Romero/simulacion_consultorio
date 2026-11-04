/** Minigráficos del editor en SVG (livianos, sin ECharts): curva logística y perfil por hora. */
import { decimal, porcentaje } from '../formato';

const W = 320;
const H = 132;
const M = { i: 34, d: 10, s: 10, b: 24 };

export function MiniLogistica({ beta0, beta1, marcas }: { beta0: number; beta1: number; marcas: { dias: number; peso: number }[] }) {
  const p = (d: number): number => 1 / (1 + Math.exp(-(beta0 + beta1 * d)));
  const ok = Number.isFinite(beta0) && Number.isFinite(beta1);
  const x = (d: number): number => M.i + (d / 30) * (W - M.i - M.d);
  const y = (v: number): number => M.s + (1 - v) * (H - M.s - M.b);
  const puntos = ok ? Array.from({ length: 61 }, (_, i) => i / 2).map((d) => `${x(d).toFixed(1)},${y(p(d)).toFixed(1)}`) : [];
  const pesoMax = Math.max(...marcas.map((m) => m.peso), 1);
  return (
    <svg className="mini-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ok ? `Probabilidad de ausencia: ${porcentaje(p(1))} a 1 día y ${porcentaje(p(30))} a 30 días de anticipación` : 'Curva no disponible: revisá β₀ y β₁'}>
      {[0, 0.25, 0.5].map((v) => (
        <g key={v}>
          <line x1={M.i} x2={W - M.d} y1={y(v)} y2={y(v)} className="mg-rejilla" />
          <text x={M.i - 6} y={y(v) + 3.5} className="mg-eje" textAnchor="end">
            {Math.round(v * 100)} %
          </text>
        </g>
      ))}
      {/* Anticipaciones de la tabla: barras tenues con su frecuencia */}
      {marcas.map((m) => (
        <rect key={m.dias} x={x(m.dias) - 4} width={8} y={y(0) - (m.peso / pesoMax) * 26} height={(m.peso / pesoMax) * 26} className="mg-barra-tenue" />
      ))}
      {[0, 7, 14, 21, 30].map((d) => (
        <text key={d} x={x(d)} y={H - 7} className="mg-eje" textAnchor="middle">
          {d === 30 ? '30 días' : d}
        </text>
      ))}
      {ok && <polyline points={puntos.join(' ')} className="mg-linea" />}
      {ok &&
        [1, 30].map((d) => (
          <g key={d}>
            <circle cx={x(d)} cy={y(p(d))} r={3.5} className="mg-punto" />
            <text x={x(d) + (d === 30 ? -6 : 6)} y={y(p(d)) - 8} className="mg-valor" textAnchor={d === 30 ? 'end' : 'start'}>
              {porcentaje(p(d))}
            </text>
          </g>
        ))}
    </svg>
  );
}

export function MiniPerfil({ tasas, inicio }: { tasas: number[]; inicio: number }) {
  const n = Math.max(1, tasas.length);
  const max = Math.max(1, ...tasas.filter(Number.isFinite));
  const ancho = (W - M.i - M.d) / n;
  const y = (v: number): number => M.s + (1 - v / max) * (H - M.s - M.b);
  const total = tasas.reduce((s, t) => s + (Number.isFinite(t) ? t : 0), 0);
  return (
    <svg className="mini-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Perfil de llegadas espontáneas por hora: ${decimal(total)} por día en total`}>
      {[0, max / 2, max].map((v) => (
        <g key={v}>
          <line x1={M.i} x2={W - M.d} y1={y(v)} y2={y(v)} className="mg-rejilla" />
          <text x={M.i - 6} y={y(v) + 3.5} className="mg-eje" textAnchor="end">
            {decimal(v)}
          </text>
        </g>
      ))}
      {tasas.map((t, i) => (
        <rect key={i} x={M.i + i * ancho + 1.5} width={Math.max(1, ancho - 3)} y={y(Number.isFinite(t) ? t : 0)} height={H - M.b - y(Number.isFinite(t) ? t : 0)} className="mg-barra" rx={1.5} />
      ))}
      {tasas.map((_, i) =>
        i % 2 === 0 ? (
          <text key={i} x={M.i + i * ancho + ancho / 2} y={H - 7} className="mg-eje" textAnchor="middle">
            {String(Math.floor(inicio / 60) + i).padStart(2, '0')}
          </text>
        ) : null,
      )}
    </svg>
  );
}
