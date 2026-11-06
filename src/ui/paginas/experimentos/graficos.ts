/**
 * Opciones de ECharts de la pantalla de Experimentos. Cada política tiene color y forma propios
 * (el color nunca es el único código); los conjuntos de óptimos se marcan con símbolo relleno y grande.
 */
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, CustomSeriesRenderItemReturn } from 'echarts';
import type { PoliticaSobreturno } from '../../../modelo';
import type { CurvaSerie, ResultadoEstudio } from '../../../experimentos/estudio';
import { NOMBRES_POLITICA } from '../../app/estado';
import type { Paleta } from '../../animacion/dibujo';
import { base, ejeRecesivo, type OpcionGrafico } from '../../componentes/Figura';
import { decimal, entero, pesos, porcentaje } from '../../formato';

export const SIMBOLO_POLITICA: Record<PoliticaSobreturno, string> = { inicio: 'triangle', intercalado: 'circle', mayor_ausentismo: 'diamond', final: 'rect' };
export const NOMBRE_PRESET: Record<string, string> = { chico: 'Consultorio chico', policonsultorio: 'Policonsultorio', centro: 'Centro completo' };
const miles = (v: number): string => `${entero(v / 1000)} mil`;
const eje = (p: Paleta) => ejeRecesivo(p);
const etiquetaEje = (p: Paleta, formatter: (v: number) => string) => ({ ...(eje(p).axisLabel as object), formatter });

/** Rampa secuencial de un solo tono (cian) para niveles ordenados de un factor. */
export function rampa(p: Paleta, n: number): string[] {
  // En oscuro la rampa va de un cian apagado a uno medio: el texto claro se lee en todas las celdas.
  const claro = p.oscuro ? [12, 52, 60] : [165, 243, 252];
  const oscuro = p.oscuro ? [8, 145, 178] : [14, 116, 144];
  return Array.from({ length: n }, (_, i) => {
    const u = n === 1 ? 1 : 0.25 + (0.75 * i) / (n - 1);
    const c = claro.map((x, j) => Math.round(x + (oscuro[j]! - x) * u));
    return `rgb(${c.join(',')})`;
  });
}

interface LineaCurva {
  nombre: string;
  color: string;
  simbolo: string;
  curva: CurvaSerie;
}

/** Curvas B(k) con banda de IC 95 %; los k del conjunto óptimo, con símbolo relleno y grande. */
export function opcionCurvas(lineas: LineaCurva[], conBandas = true) {
  return (p: Paleta): OpcionGrafico => {
    const ks = lineas[0]?.curva.puntos.map((x) => x.k) ?? [];
    const series: Record<string, unknown>[] = [];
    for (const l of lineas) {
      if (conBandas) {
        series.push({ name: `${l.nombre}-inf`, type: 'line', data: l.curva.puntos.map((x) => x.B.inf), stack: l.nombre, lineStyle: { opacity: 0 }, symbol: 'none', silent: true, tooltip: { show: false } });
        series.push({ name: `${l.nombre}-banda`, type: 'line', data: l.curva.puntos.map((x) => x.B.sup - x.B.inf), stack: l.nombre, lineStyle: { opacity: 0 }, symbol: 'none', areaStyle: { color: l.color, opacity: 0.12 }, silent: true, tooltip: { show: false } });
      }
      series.push({
        name: l.nombre,
        type: 'line',
        data: l.curva.puntos.map((x) => ({
          value: x.B.media,
          symbolSize: l.curva.conjunto.includes(x.k) ? 11 : 6,
          itemStyle: l.curva.conjunto.includes(x.k) ? { color: l.color, borderColor: p.panel, borderWidth: 1.5 } : { color: p.panel, borderColor: l.color, borderWidth: 1.5 },
        })),
        symbol: l.simbolo,
        lineStyle: { width: 2, color: l.color },
        itemStyle: { color: l.color },
        emphasis: { focus: 'series' },
      });
    }
    return {
      ...base(p),
      legend: { data: lineas.map((l) => ({ name: l.nombre, icon: l.simbolo })), top: 0, left: 0, itemWidth: 12, itemHeight: 10, textStyle: { color: p.texto2, fontSize: 11 } },
      grid: { left: 56, right: 12, top: lineas.length > 2 ? 52 : 32, bottom: 30 },
      tooltip: {
        ...(base(p).tooltip as object),
        trigger: 'axis',
        formatter: (q: { seriesName: string; dataIndex: number; marker: string }[]) => {
          const i = q[0]!.dataIndex;
          const filas = lineas.map((l) => {
            const x = l.curva.puntos[i]!;
            const en = l.curva.conjunto.includes(x.k) ? ' · en el conjunto óptimo' : '';
            return `<span style="color:${l.color}">●</span> ${l.nombre}: ${pesos(x.B.media)} ± ${pesos(x.B.semi)}${en}`;
          });
          return `<b>k = ${ks[i]}</b><br>${filas.join('<br>')}`;
        },
      },
      xAxis: { type: 'category', data: ks.map((k) => `k = ${k}`), boundaryGap: false, ...eje(p), splitLine: { show: false } },
      yAxis: { type: 'value', scale: true, ...eje(p), axisLabel: etiquetaEje(p, miles) },
      series,
    };
  };
}

export function lineasPoliticas(e1: ResultadoEstudio['e1'], preset: string, p: Paleta): LineaCurva[] {
  return e1.filter((x) => x.preset === preset).map((x) => ({ nombre: NOMBRES_POLITICA[x.politica], color: p.politicas[x.politica], simbolo: SIMBOLO_POLITICA[x.politica], curva: x.curva }));
}

/** Gráfico de puntos con bigotes (IC): B de cada política en su mejor k. */
export function opcionPoliticas(e2: ResultadoEstudio['e2'][number]) {
  return (p: Paleta): OpcionGrafico => {
    const pols = e2.politicas;
    const bigote = (_: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI): CustomSeriesRenderItemReturn => {
      const i = api.value(0) as number;
      const a = api.coord([api.value(1), i]) as number[];
      const b = api.coord([api.value(2), i]) as number[];
      return {
        type: 'group',
        children: [
          { type: 'line', shape: { x1: a[0]!, y1: a[1]!, x2: b[0]!, y2: b[1]! }, style: { stroke: p.texto3, lineWidth: 1.5 } },
          { type: 'line', shape: { x1: a[0]!, y1: a[1]! - 5, x2: a[0]!, y2: a[1]! + 5 }, style: { stroke: p.texto3, lineWidth: 1.5 } },
          { type: 'line', shape: { x1: b[0]!, y1: b[1]! - 5, x2: b[0]!, y2: b[1]! + 5 }, style: { stroke: p.texto3, lineWidth: 1.5 } },
        ],
      };
    };
    return {
      ...base(p),
      grid: { left: 130, right: 70, top: 8, bottom: 30 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item' },
      xAxis: { type: 'value', scale: true, splitNumber: 3, ...eje(p), axisLabel: etiquetaEje(p, miles) },
      yAxis: { type: 'category', data: pols.map((x) => NOMBRES_POLITICA[x.politica]), inverse: true, ...eje(p), splitLine: { show: false }, axisLabel: { color: p.texto2, fontSize: 12 } },
      series: [
        { type: 'custom', renderItem: bigote, data: pols.map((x, i) => [i, x.B.inf, x.B.sup]), encode: { x: [1, 2], y: 0 }, silent: true, z: 1 },
        {
          type: 'scatter',
          z: 2,
          data: pols.map((x, i) => ({
            value: [x.B.media, i],
            symbol: SIMBOLO_POLITICA[x.politica],
            symbolSize: x.politica === e2.ganadora ? 16 : 12,
            itemStyle: { color: p.politicas[x.politica], borderColor: p.panel, borderWidth: 1.5 },
            label: { show: true, position: 'right', distance: 10, formatter: `k̂ = ${x.k}`, color: p.texto2, fontSize: 11 },
          })),
          tooltip: { formatter: (q: { dataIndex: number }) => { const x = pols[q.dataIndex]!; return `<b>${NOMBRES_POLITICA[x.politica]}</b> (k̂ = ${x.k})<br>B = ${pesos(x.B.media)} [${pesos(x.B.inf)}; ${pesos(x.B.sup)}]`; } },
        },
      ],
    };
  };
}

/** Balance espera / ocio: cada punto es una política en su mejor k, en un preset. */
export function opcionBalance(e2: ResultadoEstudio['e2'], medicos: Record<string, number>) {
  return (p: Paleta): OpcionGrafico => {
    const formas: Record<string, string> = { chico: 'circle', policonsultorio: 'triangle', centro: 'rect' };
    const datos = e2.flatMap((x) =>
      x.politicas.map((q) => ({
        value: [q.esperaPorAtendido, q.ocio / (medicos[x.preset] ?? 1)],
        symbol: formas[x.preset],
        symbolSize: 12,
        itemStyle: { color: p.politicas[q.politica], borderColor: p.panel, borderWidth: 1.5 },
        nombre: `${NOMBRE_PRESET[x.preset]} · ${NOMBRES_POLITICA[q.politica]} (k̂ = ${q.k})`,
      })),
    );
    return {
      ...base(p),
      grid: { left: 56, right: 16, top: 16, bottom: 44 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item', formatter: (q: { dataIndex: number }) => { const d = datos[q.dataIndex]!; return `<b>${d.nombre}</b><br>espera ${decimal(d.value[0]!)} min por atendido<br>ocio ${decimal(d.value[1]!)} min por médico`; } },
      xAxis: { type: 'value', name: 'espera por atendido [min]', nameLocation: 'middle', nameGap: 28, scale: true, ...eje(p) },
      yAxis: { type: 'value', name: 'ocio por médico [min/día]', scale: true, ...eje(p) },
      series: [{ type: 'scatter', data: datos }],
    };
  };
}

/** k̂ y conjunto óptimo según el ausentismo: barra = rango del conjunto, círculo = k̂, rombo = recomendado. */
export function opcionKvsAusentismo(aus: ResultadoEstudio['e3']['ausentismo']) {
  return (p: Paleta): OpcionGrafico => {
    const cats = aus.map((x) => porcentaje(x.p).replace(',0', ''));
    const rango = (_: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI): CustomSeriesRenderItemReturn => {
      const i = api.value(0) as number;
      const a = api.coord([i, api.value(1)]) as number[];
      const b = api.coord([i, api.value(2)]) as number[];
      return { type: 'rect', shape: { x: a[0]! - 9, y: b[1]! - 6, width: 18, height: a[1]! - b[1]! + 12, r: 9 }, style: { fill: p.dato, opacity: 0.18 } };
    };
    return {
      ...base(p),
      legend: { top: 0, left: 0, itemGap: 18, itemWidth: 14, itemHeight: 10, textStyle: { color: p.texto2, fontSize: 11 }, data: [{ name: 'Conjunto óptimo', icon: 'roundRect', itemStyle: { color: p.dato, opacity: 0.3 } }, { name: 'k̂ (máximo B̄)', icon: 'circle' }, { name: 'Recomendado (menor del conjunto)', icon: 'diamond' }] },
      grid: { left: 44, right: 16, top: 36, bottom: 44 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'axis', formatter: (q: { dataIndex: number }[]) => { const x = aus[q[0]!.dataIndex]!; return `<b>ausentismo ${porcentaje(x.p)}</b> (β₀ = ${decimal(x.beta0, 2)})<br>k̂ = ${x.curva.kHat} · conjunto {${x.curva.conjunto.join(', ')}} · recomendado ${x.curva.kRec}<br>R = ${entero(x.curva.R)}`; } },
      xAxis: { type: 'category', data: cats, name: 'ausentismo medio de los turnos', nameLocation: 'middle', nameGap: 28, ...eje(p), splitLine: { show: false } },
      yAxis: { type: 'value', name: 'k', min: 0, max: 6, interval: 1, ...eje(p) },
      series: [
        { name: 'Conjunto óptimo', type: 'custom', renderItem: rango, data: aus.map((x, i) => [i, Math.min(...x.curva.conjunto), Math.max(...x.curva.conjunto)]), itemStyle: { color: p.dato, opacity: 0.25 } },
        { name: 'k̂ (máximo B̄)', type: 'line', data: aus.map((x) => x.curva.kHat), symbol: 'circle', symbolSize: 10, lineStyle: { color: p.dato, width: 2 }, itemStyle: { color: p.dato }, legendHoverLink: false },
        { name: 'Recomendado (menor del conjunto)', type: 'scatter', data: aus.map((x) => x.curva.kRec), symbol: 'diamond', symbolSize: 12, itemStyle: { color: p.panel, borderColor: p.texto, borderWidth: 2 } },
      ],
    };
  };
}

/** Mapa de calor: k recomendado según ausentismo × factor de c_extra (etiqueta: k̂ y conjunto). */
export function opcionMapa(mapa: ResultadoEstudio['e3']['mapa']) {
  return (p: Paleta): OpcionGrafico => {
    const ps = [...new Set(mapa.map((m) => m.p))];
    const fs = [...new Set(mapa.map((m) => m.factor))];
    return {
      ...base(p),
      grid: { left: 64, right: 16, top: 12, bottom: 70 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item', formatter: (q: { data: number[] }) => { const m = mapa.find((x) => x.factor === fs[q.data[0]!] && x.p === ps[q.data[1]!])!; return `<b>ausentismo ${porcentaje(m.p)} · factor ${decimal(m.factor, 2)}</b><br>k̂ = ${m.kHat} · conjunto {${m.conjunto.join(', ')}} · recomendado ${m.kRec}`; } },
      xAxis: { type: 'category', data: fs.map((f) => `× ${decimal(f, 2)}`), name: 'factor de c_extra sobre c_ocio', nameLocation: 'middle', nameGap: 28, ...eje(p), splitLine: { show: false } },
      yAxis: { type: 'category', data: ps.map((x) => porcentaje(x).replace(',0', '')), name: 'ausentismo', ...eje(p), splitLine: { show: false } },
      visualMap: { min: 0, max: 6, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 160, text: ['k = 6', 'k = 0'], textStyle: { color: p.texto3, fontSize: 11 }, inRange: { color: rampa(p, 7) } },
      series: [
        {
          type: 'heatmap',
          data: mapa.map((m) => [fs.indexOf(m.factor), ps.indexOf(m.p), m.kRec]),
          label: { show: true, color: p.texto, fontSize: 12, fontWeight: 600, formatter: (q: { data: number[] }) => { const m = mapa.find((x) => x.factor === fs[q.data[0]!] && x.p === ps[q.data[1]!])!; return m.conjunto.length > 1 ? `${m.kRec}  {${m.conjunto[0]}–${m.conjunto[m.conjunto.length - 1]}}` : `${m.kRec}`; } },
          itemStyle: { borderColor: p.panel, borderWidth: 2 },
        },
      ],
    };
  };
}

/** Curvas B(k) para los niveles de un costo (rampa de un solo tono, sin bandas). */
export function opcionCostos(niveles: { etiqueta: string; curva: CurvaSerie }[]) {
  return (p: Paleta): OpcionGrafico => {
    const colores = rampa(p, niveles.length);
    return opcionCurvas(niveles.map((n, i) => ({ nombre: n.etiqueta, color: colores[i]!, simbolo: 'circle', curva: n.curva })), false)(p);
  };
}

/** Regla práctica: k̂ (con el rango del conjunto) contra p̄·N̄ y las dos reglas en escalón. */
export function opcionRegla(e4: ResultadoEstudio['e4']) {
  return (p: Paleta): OpcionGrafico => {
    const formas: Record<string, string> = { chico: 'circle', policonsultorio: 'triangle', centro: 'rect' };
    const xMax = Math.max(...e4.configuraciones.map((c) => c.pN)) + 0.5;
    const escalon = (a: number): number[][] => Array.from({ length: 141 }, (_, i) => (i / 140) * xMax).map((x) => [x, Math.max(0, Math.min(6, Math.round(a * x)))]);
    const rango = (_: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI): CustomSeriesRenderItemReturn => {
      const a = api.coord([api.value(0), api.value(1)]) as number[];
      const b = api.coord([api.value(0), api.value(2)]) as number[];
      return { type: 'rect', shape: { x: a[0]! - 5, y: b[1]! - 5, width: 10, height: a[1]! - b[1]! + 10, r: 5 }, style: { fill: p.texto3, opacity: 0.2 } };
    };
    return {
      ...base(p),
      legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 }, data: ['Chico', 'Policonsultorio', 'Centro', 'Ingenua: round(p̄·N̄)', `Ajustada: round(${decimal(e4.alfa, 2)}·p̄·N̄)`] },
      grid: { left: 44, right: 16, top: 52, bottom: 44 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item' },
      xAxis: { type: 'value', name: 'p̄·N̄ (turnos que se espera que falten por profesional)', nameLocation: 'middle', nameGap: 28, min: 0, max: Math.ceil(xMax), ...eje(p) },
      yAxis: { type: 'value', name: 'k', min: 0, max: 6, interval: 1, ...eje(p) },
      series: [
        { type: 'custom', renderItem: rango, data: e4.configuraciones.map((c) => [c.pN, Math.min(...c.conjunto), Math.max(...c.conjunto)]), silent: true, z: 1 },
        ...(['chico', 'policonsultorio', 'centro'] as const).map((id) => ({
          name: id === 'chico' ? 'Chico' : id === 'policonsultorio' ? 'Policonsultorio' : 'Centro',
          type: 'scatter',
          z: 3,
          symbol: formas[id],
          symbolSize: 11,
          itemStyle: { color: p.dato, borderColor: p.panel, borderWidth: 1.5 },
          data: e4.configuraciones.filter((c) => c.preset === id).map((c) => ({ value: [c.pN, c.kHat], c })),
          tooltip: { formatter: (q: { data: { c: ResultadoEstudio['e4']['configuraciones'][number] } }) => { const c = q.data.c; return `<b>${NOMBRE_PRESET[c.preset]} · ausentismo ${porcentaje(c.p)}</b><br>p̄·N̄ = ${decimal(c.pN, 2)} · k̂ = ${c.kHat} · conjunto {${c.conjunto.join(', ')}}`; } },
        })),
        { name: 'Ingenua: round(p̄·N̄)', type: 'line', data: escalon(1), symbol: 'none', lineStyle: { color: p.texto3, width: 2, type: 'dashed' }, itemStyle: { color: p.texto3 }, z: 2, silent: true },
        { name: `Ajustada: round(${decimal(e4.alfa, 2)}·p̄·N̄)`, type: 'line', data: escalon(e4.alfa), symbol: 'none', lineStyle: { color: p.accion, width: 2 }, itemStyle: { color: p.accion }, z: 2, silent: true },
      ],
    };
  };
}

/** Riesgo: distribución diaria de B(k) − B(0) (caja p25–p75, bigotes p5–p95, rombo = media). */
export function opcionRiesgo(e5: ResultadoEstudio['e5']) {
  return (p: Paleta): OpcionGrafico => ({
    ...base(p),
    grid: { left: 64, right: 16, top: 28, bottom: 30 },
    tooltip: { ...(base(p).tooltip as object), trigger: 'item' },
    xAxis: { type: 'category', data: e5.porK.map((x) => `k = ${x.k}`), ...eje(p), splitLine: { show: false } },
    yAxis: { type: 'value', name: 'B(k) − B(0) por día', ...eje(p), axisLabel: etiquetaEje(p, miles) },
    series: [
      {
        type: 'boxplot',
        data: e5.porK.map((x) => [x.p5, x.p25, x.p50, x.p75, x.p95]),
        itemStyle: { color: p.dato.length ? 'transparent' : 'transparent', borderColor: p.dato, borderWidth: 2 },
        tooltip: { formatter: (q: { dataIndex: number }) => { const x = e5.porK[q.dataIndex]!; return `<b>k = ${x.k}</b><br>p5 ${pesos(x.p5)} · p25 ${pesos(x.p25)}<br>mediana ${pesos(x.p50)} · media ${pesos(x.media)}<br>p75 ${pesos(x.p75)} · p95 ${pesos(x.p95)}<br>P(B(k) < B(0)) = ${porcentaje(x.pNegativo)}`; } },
      },
      { type: 'scatter', data: e5.porK.map((x) => x.media), symbol: 'diamond', symbolSize: 10, itemStyle: { color: p.texto, borderColor: p.panel, borderWidth: 1 }, tooltip: { show: false } },
      {
        // Etiquetas encima del bigote superior (p95), sin símbolo.
        type: 'scatter',
        data: e5.porK.map((x) => x.p95),
        symbolSize: 0,
        silent: true,
        label: { show: true, position: 'top', distance: 6, color: p.texto2, fontSize: 11, formatter: (q: { dataIndex: number }) => (e5.porK[q.dataIndex]!.k === 0 ? '' : `P<0: ${porcentaje(e5.porK[q.dataIndex]!.pNegativo)}`) },
        tooltip: { show: false },
      },
    ],
    markLine: undefined,
  });
}

/** Precisión: semiancho del IC de B contra R en log-log, con el ajuste y la pendiente −1/2 de referencia. */
export function opcionPrecision(e6: ResultadoEstudio['e6']) {
  return (p: Paleta): OpcionGrafico => {
    const r0 = e6.puntos[0]!;
    const ref = e6.puntos.map((x) => [x.R, r0.semiancho * Math.sqrt(r0.R / x.R)]);
    const ajuste = e6.puntos.map((x) => [x.R, Math.exp(e6.intercepto) * x.R ** e6.pendiente]);
    return {
      ...base(p),
      legend: { top: 0, right: 0, itemGap: 18, textStyle: { color: p.texto2, fontSize: 11 }, data: ['Semiancho medido', `Ajuste: pendiente ${decimal(e6.pendiente, 2)}`, 'Referencia: pendiente −1/2'] },
      grid: { left: 72, right: 16, top: 36, bottom: 44 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item', formatter: (q: { value: number[] }) => `R = ${entero(q.value[0]!)}<br>semiancho ${pesos(q.value[1]!)}` },
      xAxis: { type: 'log', logBase: 10, name: 'R (días simulados, escala logarítmica)', nameLocation: 'middle', nameGap: 28, min: 100, max: 20000, ...eje(p), axisLabel: etiquetaEje(p, (v) => entero(v)) },
      yAxis: { type: 'log', logBase: 10, min: 1000, max: 40000, ...eje(p), axisLabel: etiquetaEje(p, (v) => pesos(v)) },
      series: [
        { name: 'Semiancho medido', type: 'scatter', data: e6.puntos.map((x) => [x.R, x.semiancho]), symbolSize: 10, z: 3, itemStyle: { color: p.dato, borderColor: p.panel, borderWidth: 1.5 } },
        { name: `Ajuste: pendiente ${decimal(e6.pendiente, 2)}`, type: 'line', data: ajuste, symbol: 'none', lineStyle: { color: p.dato, width: 2 }, itemStyle: { color: p.dato } },
        { name: 'Referencia: pendiente −1/2', type: 'line', data: ref, symbol: 'none', lineStyle: { color: p.texto3, width: 1.5, type: 'dashed' }, itemStyle: { color: p.texto3 } },
      ],
    };
  };
}

/** Perfil por franja de 30 min de dos políticas (mecanismo, #5 Parte 0.2). */
export function opcionPerfil(lineas: { politica: PoliticaSobreturno; k: number; valores: number[] }[], t: number[], etiqueta: string, formato: (v: number) => string) {
  return (p: Paleta): OpcionGrafico => ({
    ...base(p),
    legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 }, data: lineas.map((l) => ({ name: `${NOMBRES_POLITICA[l.politica]} (k = ${l.k})`, icon: SIMBOLO_POLITICA[l.politica] })) },
    grid: { left: 48, right: 12, top: 36, bottom: 30 },
    tooltip: { ...(base(p).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => formato(v) },
    xAxis: { type: 'category', data: t.map((x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`), ...eje(p), splitLine: { show: false }, axisLabel: { ...(eje(p).axisLabel as object), interval: 3 } },
    yAxis: { type: 'value', name: etiqueta, ...eje(p) },
    series: lineas.map((l) => ({
      name: `${NOMBRES_POLITICA[l.politica]} (k = ${l.k})`,
      type: 'line',
      data: l.valores,
      symbol: SIMBOLO_POLITICA[l.politica],
      symbolSize: 6,
      lineStyle: { color: p.politicas[l.politica], width: 2 },
      itemStyle: { color: p.politicas[l.politica] },
    })),
  });
}
