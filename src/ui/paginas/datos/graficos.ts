/** Opciones de ECharts de la pantalla Datos: histograma con densidades, QQ y curva logística. */
import { NOMBRES_FAMILIA, probabilidadFalta, type Ajuste, type Familia, type Tramo } from '../../../datos';
import type { Paleta } from '../../animacion/dibujo';
import { base, ejeRecesivo, type OpcionGrafico } from '../../componentes/Figura';
import { decimal, porcentaje } from '../../formato';

export const COLOR_FAMILIA = (p: Paleta): Record<Familia, string> => ({ lognormal: p.dato, gamma: p.accion, exponencial: p.texto3, empirica: p.positivo });

/** Histograma (escala de densidad) con las densidades ajustadas superpuestas. */
export function opcionHistograma(xs: readonly number[], ajustes: readonly Ajuste[]) {
  return (p: Paleta): OpcionGrafico => {
    const n = xs.length;
    const max = Math.max(...xs);
    // Ancho de clase por la regla de Freedman-Diaconis, acotado a 8–40 clases.
    const o = [...xs].sort((a, b) => a - b);
    const iqr = o[Math.floor(0.75 * (n - 1))]! - o[Math.floor(0.25 * (n - 1))]!;
    const clases = Math.max(8, Math.min(40, Math.ceil(max / Math.max(0.5, (2 * iqr) / Math.cbrt(n)))));
    const ancho = max / clases;
    const cuentas = new Array<number>(clases).fill(0);
    for (const x of xs) cuentas[Math.min(clases - 1, Math.floor(x / ancho))]!++;
    const color = COLOR_FAMILIA(p);
    const malla = Array.from({ length: 161 }, (_, i) => (i * max * 1.05) / 160).filter((x) => x > 0);
    return {
      ...base(p),
      legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 } },
      grid: { left: 52, right: 16, top: 48, bottom: 40 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => decimal(v, 3) },
      xAxis: { type: 'value', min: 0, max: Math.ceil(max * 1.05), ...ejeRecesivo(p), name: 'minutos', nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', ...ejeRecesivo(p), axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: (v: number) => decimal(v, 2) } },
      series: [
        {
          name: 'Datos',
          type: 'custom',
          renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[]; style: (o: object) => object }) => {
            const a = api.coord([api.value(0), api.value(2)]);
            const b = api.coord([api.value(1), 0]);
            return { type: 'rect', shape: { x: a[0]!, y: a[1]!, width: b[0]! - a[0]! - 1, height: b[1]! - a[1]! }, style: { fill: p.panel2, stroke: p.bordeFuerte } };
          },
          data: cuentas.map((c, i) => [i * ancho, (i + 1) * ancho, c / (n * ancho)]),
          encode: { x: [0, 1], y: 2 },
          itemStyle: { color: p.panel2, borderColor: p.bordeFuerte },
          z: 1,
        },
        ...ajustes
          .filter((a) => a.familia !== 'empirica')
          .map((a) => ({ name: NOMBRES_FAMILIA[a.familia], type: 'line', showSymbol: false, data: malla.map((x) => [x, a.densidad(x)]), lineStyle: { color: color[a.familia], width: 2, type: a.familia === 'exponencial' ? 'dashed' : 'solid' }, itemStyle: { color: color[a.familia] }, z: 3 })),
      ],
    };
  };
}

/** QQ: cuantiles teóricos de la familia elegida contra los observados; la diagonal es el ajuste perfecto. */
export function opcionQQ(xs: readonly number[], ajuste: Ajuste) {
  return (p: Paleta): OpcionGrafico => {
    const o = [...xs].sort((a, b) => a - b);
    const n = o.length;
    const puntos = o.map((x, i) => [ajuste.cuantil((i + 0.5) / n), x]);
    const lim = Math.max(...o, ...puntos.map((q) => q[0]!)) * 1.05;
    return {
      ...base(p),
      grid: { left: 52, right: 16, top: 16, bottom: 40 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item', formatter: (q: { value: number[] }) => `teórico ${decimal(q.value[0]!, 1)} · observado ${decimal(q.value[1]!, 1)} min` },
      xAxis: { type: 'value', min: 0, max: Math.ceil(lim), ...ejeRecesivo(p), name: `cuantil ${NOMBRES_FAMILIA[ajuste.familia].toLowerCase()} [min]`, nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', min: 0, max: Math.ceil(lim), ...ejeRecesivo(p), name: 'observado [min]' },
      series: [
        { type: 'scatter', data: puntos, symbolSize: 5, itemStyle: { color: COLOR_FAMILIA(p)[ajuste.familia], opacity: 0.75 } },
        { type: 'line', data: [[0, 0], [lim, lim]], showSymbol: false, silent: true, lineStyle: { color: p.texto3, type: 'dashed', width: 1 } },
      ],
    };
  };
}

/** Proporción de faltas observada por anticipación (IC de Wilson) con la curva estimada y la del escenario. */
export function opcionLogistica(tramos: readonly Tramo[], estimada: { beta0: number; beta1: number }, escenario: { beta0: number; beta1: number }) {
  return (p: Paleta): OpcionGrafico => {
    const dmax = Math.max(30, ...tramos.map((t) => t.anticipacion)) * 1.05;
    const malla = Array.from({ length: 121 }, (_, i) => (i * dmax) / 120);
    return {
      ...base(p),
      legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 } },
      grid: { left: 52, right: 16, top: 48, bottom: 40 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item' },
      xAxis: { type: 'value', min: 0, max: Math.ceil(dmax), ...ejeRecesivo(p), name: 'días de anticipación', nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', min: 0, ...ejeRecesivo(p), axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: (v: number) => porcentaje(v) } },
      series: [
        {
          name: 'IC 95 % (Wilson)',
          type: 'custom',
          renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[] }) => {
            const a = api.coord([api.value(0), api.value(1)]);
            const b = api.coord([api.value(0), api.value(2)]);
            return { type: 'group', children: [{ type: 'line', shape: { x1: a[0]!, y1: a[1]!, x2: b[0]!, y2: b[1]! }, style: { stroke: p.texto3, lineWidth: 1.5 } }, { type: 'line', shape: { x1: a[0]! - 4, y1: a[1]!, x2: a[0]! + 4, y2: a[1]! }, style: { stroke: p.texto3, lineWidth: 1.5 } }, { type: 'line', shape: { x1: b[0]! - 4, y1: b[1]!, x2: b[0]! + 4, y2: b[1]! }, style: { stroke: p.texto3, lineWidth: 1.5 } }] };
          },
          data: tramos.map((t) => [t.anticipacion, t.inf, t.sup]),
          tooltip: { show: false },
          z: 1,
        },
        { name: 'Observado', type: 'scatter', data: tramos.map((t) => ({ value: [t.anticipacion, t.proporcion], n: t.n })), symbolSize: 9, itemStyle: { color: p.texto }, tooltip: { formatter: (q: { value: number[]; data: { n: number } }) => `${decimal(q.value[0]!, 1)} días: ${porcentaje(q.value[1]!)} de faltas (n = ${q.data.n})` }, z: 3 },
        { name: 'Estimada', type: 'line', showSymbol: false, data: malla.map((d) => [d, probabilidadFalta(estimada.beta0, estimada.beta1, d)]), lineStyle: { color: p.dato, width: 2 }, itemStyle: { color: p.dato }, z: 2 },
        { name: 'Escenario actual', type: 'line', showSymbol: false, data: malla.map((d) => [d, probabilidadFalta(escenario.beta0, escenario.beta1, d)]), lineStyle: { color: p.accion, width: 2, type: 'dashed' }, itemStyle: { color: p.accion }, z: 2 },
      ],
    };
  };
}
