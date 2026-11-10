/**
 * Dinámica de sistemas (paso #5, cerrada en el #6): lista de espera en semanas con tres políticas de
 * sobreturnos, D₀ calibrado al consultorio del estudio, sensibilidad a los supuestos, modelo fluido
 * de la jornada contra eventos discretos y convergencia numérica.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  analisisSensibilidad,
  capacidad,
  compararPoliticas,
  demandaCalibrada,
  equilibrios,
  NIVELES_SENSIBILIDAD,
  NOMBRES_PARAMETRO,
  parametrosBase,
  type FilaSensibilidad,
  type ParametroSensible,
  tablaConvergencia,
  tablaDesdeEstudio,
  verificarEquilibrio,
  type Metodo,
  type ParametrosLista,
  type ResumenPolitica,
} from '../../../dinamica';
import { aCSV } from '../../../experimentos/csv';
import { useTema } from '../../app/tema';
import type { Paleta } from '../../animacion/dibujo';
import { CampoNumero, CampoSelect, Segmentado } from '../../componentes/Campos';
import { base, ejeRecesivo, Figura, type OpcionGrafico } from '../../componentes/Figura';
import { TablaDatos } from '../../componentes/TablaDatos';
import { decimal, entero, hora, pesos, porcentaje } from '../../formato';
import { useComplementos, useDinamicaPublicada, useEstudio } from '../../simulacion/estudio';
import { DiagramaCausal, DiagramaForrester } from './Diagramas';

type Serie = 'L' | 'a' | 'p' | 'beneficio';
const ESTILO = (p: Paleta) => [
  { color: p.texto3, tipo: 'dashed' as const },
  { color: p.politicas.intercalado, tipo: 'solid' as const },
  { color: p.politicas.inicio, tipo: 'solid' as const },
];

function opcionTrayectorias(rs: ResumenPolitica[], serie: Serie, prm: ParametrosLista) {
  return (p: Paleta): OpcionGrafico => {
    const est = ESTILO(p);
    const fmt = serie === 'p' ? (v: number) => porcentaje(v) : serie === 'beneficio' ? (v: number) => `${entero(v / 1e6)} M` : serie === 'a' ? (v: number) => `${decimal(v)} d` : (v: number) => entero(v);
    const marca = prm.pico ? [{ xAxis: prm.pico.inicio * 7 }, { xAxis: (prm.pico.inicio + prm.pico.duracion) * 7 }] : [];
    return {
      ...base(p),
      legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 }, data: rs.map((r) => r.nombre) },
      grid: { left: 64, right: 16, top: 48, bottom: 36 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => fmt(v) },
      xAxis: { type: 'value', min: 0, max: prm.horizonteSemanas * 7, interval: 28, ...ejeRecesivo(p), axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: (v: number) => `sem ${v / 7}` } },
      yAxis: { type: 'value', scale: serie !== 'beneficio', ...ejeRecesivo(p), axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: fmt } },
      series: rs.map((r, i) => ({
        name: r.nombre,
        type: 'line',
        showSymbol: false,
        data: r.trayectoria.t.map((t, j) => [t, r.trayectoria[serie][j]]),
        lineStyle: { color: est[i]!.color, type: est[i]!.tipo, width: 2 },
        itemStyle: { color: est[i]!.color },
        ...(i === 0 && marca.length ? { markArea: { silent: true, itemStyle: { color: p.accion, opacity: 0.07 }, data: [marca] } } : {}),
      })),
    };
  };
}

function opcionSemanal(rs: ResumenPolitica[], campo: 'atendidos' | 'perdidos') {
  return (p: Paleta): OpcionGrafico => {
    const est = ESTILO(p);
    return {
      ...base(p),
      legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 }, data: rs.map((r) => r.nombre) },
      grid: { left: 52, right: 16, top: 48, bottom: 36 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => entero(v) },
      xAxis: { type: 'category', data: rs[0]!.trayectoria.semanas.map((s) => s.semana), ...ejeRecesivo(p), splitLine: { show: false }, name: 'semana', nameLocation: 'middle', nameGap: 24 },
      yAxis: { type: 'value', ...ejeRecesivo(p) },
      series: rs.map((r, i) => ({ name: r.nombre, type: 'line', step: 'middle', showSymbol: false, data: r.trayectoria.semanas.map((s) => s[campo]), lineStyle: { color: est[i]!.color, type: est[i]!.tipo, width: 2 }, itemStyle: { color: est[i]!.color } })),
    };
  };
}

function opcionK(r: ResumenPolitica) {
  return (p: Paleta): OpcionGrafico => ({
    ...base(p),
    grid: { left: 44, right: 16, top: 16, bottom: 36 },
    tooltip: { ...(base(p).tooltip as object), trigger: 'axis', formatter: (q: { dataIndex: number }[]) => { const s = r.trayectoria.semanas[q[0]!.dataIndex]!; return `semana ${s.semana}: k = ${s.k} · ausentismo observado ${porcentaje(s.pObservado)}`; } },
    xAxis: { type: 'category', data: r.trayectoria.semanas.map((s) => s.semana), ...ejeRecesivo(p), splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, max: 6, interval: 1, ...ejeRecesivo(p), name: 'k' },
    series: [{ type: 'bar', data: r.trayectoria.semanas.map((s) => s.k), barWidth: '60%', itemStyle: { color: p.politicas.inicio, borderRadius: [3, 3, 0, 0] } }],
  });
}

function opcionFluido(caso: { t: number[]; des: { media: number; inf: number; sup: number }[]; fluido: number[] }) {
  return (p: Paleta): OpcionGrafico => ({
    ...base(p),
    legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 }, data: ['Eventos discretos (media)', 'Modelo fluido'] },
    grid: { left: 44, right: 16, top: 56, bottom: 36 },
    tooltip: { ...(base(p).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => decimal(v, 2) },
    xAxis: { type: 'value', min: caso.t[0], max: caso.t.at(-1), interval: 60, ...ejeRecesivo(p), axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: (v: number) => hora(v).slice(0, 2) } },
    yAxis: { type: 'value', min: 0, ...ejeRecesivo(p), name: 'pacientes en sala' },
    series: [
      { name: 'IC-inf', type: 'line', data: caso.t.map((t, i) => [t, caso.des[i]!.inf]), stack: 'ic', lineStyle: { opacity: 0 }, symbol: 'none', silent: true, tooltip: { show: false } },
      { name: 'IC-banda', type: 'line', data: caso.t.map((t, i) => [t, caso.des[i]!.sup - caso.des[i]!.inf]), stack: 'ic', lineStyle: { opacity: 0 }, symbol: 'none', areaStyle: { color: p.dato, opacity: 0.18 }, silent: true, tooltip: { show: false } },
      { name: 'Eventos discretos (media)', type: 'line', data: caso.t.map((t, i) => [t, caso.des[i]!.media]), showSymbol: false, lineStyle: { color: p.dato, width: 2 }, itemStyle: { color: p.dato } },
      { name: 'Modelo fluido', type: 'line', data: caso.t.map((t, i) => [t, caso.fluido[i]]), showSymbol: false, lineStyle: { color: p.accion, width: 2, type: 'dashed' }, itemStyle: { color: p.accion } },
    ],
  });
}

function opcionConvergencia(filas: ReturnType<typeof tablaConvergencia>['filas']) {
  return (p: Paleta): OpcionGrafico => ({
    ...base(p),
    legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 }, data: ['Euler', 'RK4'] },
    grid: { left: 64, right: 16, top: 56, bottom: 40 },
    tooltip: { ...(base(p).tooltip as object), trigger: 'item', formatter: (q: { seriesName: string; value: number[] }) => `${q.seriesName}, dt = ${q.value[0]} días<br>error en L final: ${q.value[1]!.toExponential(2)}` },
    xAxis: { type: 'log', name: 'dt [días]', nameLocation: 'middle', nameGap: 26, min: 0.05, max: 2, ...ejeRecesivo(p) },
    yAxis: { type: 'log', name: 'error en L final [pacientes]', ...ejeRecesivo(p), axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: (v: number) => v.toExponential(0) } },
    series: (['euler', 'rk4'] as const).map((m, i) => ({
      name: m === 'euler' ? 'Euler' : 'RK4',
      type: 'line',
      data: filas.filter((f) => f.metodo === m).map((f) => [f.dt, Math.max(f.errorLfinal, 1e-12)]),
      symbol: i === 0 ? 'circle' : 'diamond',
      symbolSize: 10,
      lineStyle: { color: i === 0 ? p.texto3 : p.dato, width: 2 },
      itemStyle: { color: i === 0 ? p.texto3 : p.dato },
    })),
  });
}

const FORMATO_NIVEL: Record<ParametroSensible, (v: number) => string> = {
  reingreso: (v) => `r = ${Math.round(v * 100)} %`,
  desalientoMaximo: (v) => `d máx. = ${Math.round(v * 100)} %`,
  umbral: (v) => `u = ${v} d`,
  aumento: (v) => `+${Math.round(v * 100)} %`,
  duracion: (v) => `${v} sem`,
};
const GANADOR: Record<number, string> = { [-1]: 'Empate', 0: 'k = 0', 1: 'k fijo', 2: 'Adaptativo' };

/**
 * Tornado: para cada parámetro, cuánto cambia la diferencia adaptativo − k fijo respecto de la base
 * con sus otros dos niveles. Ordenado por amplitud; cada barra lleva el nivel que la produce.
 */
function opcionTornado(filas: FilaSensibilidad[], campo: 'difBeneficio' | 'difPerdidos', fmt: (v: number) => string) {
  return (p: Paleta): OpcionGrafico => {
    const base0 = filas.find((f) => f.esBase)![campo];
    const params = (Object.keys(NIVELES_SENSIBILIDAD) as ParametroSensible[])
      .map((par) => {
        const otros = filas.filter((f) => f.parametro === par && !f.esBase).map((f) => ({ v: f[campo] - base0, f }));
        const bajo = otros.reduce((m, o) => (o.v < m.v ? o : m), otros[0]!);
        const alto = otros.reduce((m, o) => (o.v > m.v ? o : m), otros[0]!);
        return { par, otros, bajo, alto, rango: alto.v - bajo.v };
      })
      .sort((a, b) => a.rango - b.rango);
    type Extremo = { v: number; f: FilaSensibilidad };
    const etiqueta = (o: Extremo) => `${FORMATO_NIVEL[o.f.parametro](o.f.valor)}${o.f.estable ? '' : ' ⚠'}`;
    // Posición de cada etiqueta: hacia afuera de la barra. Si los dos niveles caen del mismo lado, el
    // más chico se rotula del otro lado de la línea base; si dan lo mismo, una sola etiqueta con ambos.
    const rotulo = (x: (typeof params)[number], cual: 'bajo' | 'alto') => {
      const o = x[cual];
      const otro = cual === 'bajo' ? x.alto : x.bajo;
      if (Math.abs(o.v - otro.v) < 1e-9) {
        if (cual === 'bajo') return { show: false };
        const vals = x.otros.map((y) => y.f.valor).sort((a, b) => a - b);
        return { show: true, position: o.v >= 0 ? 'right' : 'left', formatter: `${vals.map((v) => FORMATO_NIVEL[x.par](v)).join(' y ')}${o.f.estable ? '' : ' ⚠'}` };
      }
      const mismoLado = Math.sign(o.v) === Math.sign(otro.v) && Math.abs(o.v) < Math.abs(otro.v);
      const afuera = o.v >= 0 ? 'right' : 'left';
      return { show: true, position: mismoLado ? (afuera === 'right' ? 'left' : 'right') : afuera, formatter: etiqueta(o) };
    };
    const serie = (nombre: string, cual: 'bajo' | 'alto', color: string) => ({
      name: nombre,
      type: 'bar',
      barWidth: 18,
      barGap: '-100%',
      data: params.map((x) => ({ value: x[cual].v, label: { ...rotulo(x, cual), color: p.texto2, fontSize: 11 } })),
      itemStyle: { color, borderRadius: 2 },
    });
    const lo = Math.min(0, ...params.map((x) => x.bajo.v));
    const hi = Math.max(0, ...params.map((x) => x.alto.v));
    const margen = 0.3 * (hi - lo || 1);
    return {
      ...base(p),
      legend: { top: 0, left: 0, textStyle: { color: p.texto2, fontSize: 11 } },
      grid: { left: 150, right: 24, top: 36, bottom: 40 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item', formatter: (q: { seriesIndex: number; dataIndex: number }) => { const x = params[q.dataIndex]!; const o = q.seriesIndex === 0 ? x.bajo : x.alto; return `${NOMBRES_PARAMETRO[x.par]}, ${FORMATO_NIVEL[x.par](o.f.valor)}: adaptativo − fijo = ${fmt(o.f[campo])} (base ${fmt(base0)})`; } },
      xAxis: { type: 'value', min: lo - margen, max: hi + margen, ...ejeRecesivo(p), name: 'cambio respecto de la base', nameLocation: 'middle', nameGap: 26, axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: fmt, hideOverlap: true, showMinLabel: false, showMaxLabel: false } },
      yAxis: { type: 'category', data: params.map((x) => NOMBRES_PARAMETRO[x.par]), ...ejeRecesivo(p), splitLine: { show: false } },
      series: [serie('Nivel que más la baja', 'bajo', p.texto3), { ...serie('Nivel que más la sube', 'alto', p.dato), markLine: { silent: true, symbol: 'none', lineStyle: { color: p.texto, width: 1 }, label: { show: false }, data: [{ xAxis: 0 }] } }],
    };
  };
}

/**
 * Valor que se calcula en una tarea aparte (setTimeout), después de pintar: así un cálculo de cientos
 * de milisegundos no bloquea la primera vista. Mientras tanto devuelve el último valor (o null).
 */
function useDiferido<T>(calcular: () => T | null, deps: readonly unknown[]): T | null {
  const [valor, setValor] = useState<T | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setValor(calcular()), 0);
    return () => window.clearTimeout(id);
    // deps las define quien llama.
  }, deps);
  return valor;
}

export default function Dinamica() {
  const { estudio } = useEstudio();
  const complementos = useComplementos();
  const { efectivo } = useTema();
  const [escenario, setEscenario] = useState<'pico' | 'estable'>('pico');
  const BASE = useMemo(() => parametrosBase(), []);
  const [ajustes, setAjustes] = useState(() => ({
    demanda: Math.round((1000 * BASE.demandaBase) / capacidad(BASE, 0)) / 1000,
    aumento: BASE.pico!.aumento,
    duracion: BASE.pico!.duracion,
    inicio: BASE.pico!.inicio,
    reingreso: BASE.reingreso,
    umbral: BASE.desaliento.umbral,
    ancho: BASE.desaliento.ancho,
    maximo: BASE.desaliento.maximo,
    horizonte: BASE.horizonteSemanas,
  }));
  const [modoDemanda, setModoDemanda] = useState<'calibrada' | 'manual'>('calibrada');
  const [metodo, setMetodo] = useState<Metodo>('rk4');
  const [dt, setDt] = useState(0.25);
  const set = (k: keyof typeof ajustes) => (v: number) => Number.isFinite(v) && setAjustes((a) => ({ ...a, [k]: v }));

  const tb = useMemo(() => (estudio ? tablaDesdeEstudio(estudio) : null), [estudio]);
  const kFijo = estudio?.e1.find((x) => x.preset === 'policonsultorio' && x.politica === estudio.e3.politica)?.curva.kRec ?? 2;
  const prm = useMemo<ParametrosLista>(() => {
    const b: ParametrosLista = {
      ...BASE,
      pico: escenario === 'pico' ? { inicio: ajustes.inicio, duracion: ajustes.duracion, aumento: ajustes.aumento } : null,
      reingreso: ajustes.reingreso,
      desaliento: { umbral: ajustes.umbral, ancho: ajustes.ancho, maximo: ajustes.maximo },
      horizonteSemanas: Math.max(8, Math.min(104, Math.round(ajustes.horizonte))),
    };
    // Calibrada: el consultorio de hoy (11,95 días sin sobreturnos) es el equilibrio, con los supuestos elegidos.
    return { ...b, demandaBase: modoDemanda === 'calibrada' ? demandaCalibrada(b) : capacidad(b, 0) * ajustes.demanda };
  }, [ajustes, escenario, modoDemanda, BASE]);
  const eqHoy = useMemo(() => equilibrios({ ...prm, pico: null }, 0), [prm]);
  // La sensibilidad no depende de los controles: se lee de public/resultados/dinamica.json (npm run
  // dinamica) y solo se recalcula si ese archivo no está. Lo pesado se difiere para no bloquear la carga.
  const publicada = useDinamicaPublicada();
  const sens = useDiferido(() => (publicada ? publicada.sensibilidad : tb ? analisisSensibilidad(BASE, tb, kFijo) : null), [publicada, BASE, tb, kFijo]);
  const rs = useMemo(() => (tb ? compararPoliticas(prm, tb, kFijo, { dt, metodo }) : null), [prm, tb, kFijo, dt, metodo]);
  // Con los parámetros base la convergencia (referencia RK4 con dt = 0,01) también está precalculada.
  const conv = useDiferido(() => (publicada && publicada.kFijo === kFijo && JSON.stringify(publicada.parametros) === JSON.stringify(prm) ? publicada.convergencia : tb ? tablaConvergencia(prm, tb, kFijo) : null), [publicada, prm, tb, kFijo]);
  const ver = useDiferido(() => (tb ? [0, kFijo].map((k) => ({ k, ...verificarEquilibrio(prm, tb, k) })) : null), [prm, tb, kFijo]);
  void efectivo;

  const csvTrayectorias = rs
    ? aCSV(['politica', 'dia', 'L', 'anticipacion_dias', 'ausentismo', 'k', 'demanda', 'atendidos_acum', 'perdidos_acum', 'beneficio_acum'], rs.flatMap((r) => r.trayectoria.t.map((t, i) => [r.nombre, t, r.trayectoria.L[i]!, r.trayectoria.a[i]!, r.trayectoria.p[i]!, r.trayectoria.k[i]!, r.trayectoria.demanda[i]!, r.trayectoria.atendidos[i]!, r.trayectoria.perdidos[i]!, r.trayectoria.beneficio[i]!])))
    : '';

  return (
    <div className="pagina pagina-dinamica">
      <header className="cabeza-pagina">
        <div>
          <h1 className="titulo-pagina">Dinámica de sistemas</h1>
          <p className="bajada">La lista de espera semana a semana: cómo la anticipación de los turnos alimenta el ausentismo, y qué política de sobreturnos aguanta mejor un pico de demanda.</p>
          <p className="marca-supuestos">Datos ficticios · supuestos SD1–SD10 (docs/dinamica-sistemas.md) · acople con el estudio E3</p>
        </div>
      </header>

      <section className="seccion-exp" id="estructura" aria-labelledby="t-diagramas">
        <header className="seccion-exp-cabeza">
          <span className="placa-mini placa-seccion" aria-hidden="true">1</span>
          <div>
            <h2 id="t-diagramas" className="subtitulo-grande">Estructura</h2>
            <p className="seccion-bajada">R1 refuerza: cuanto más larga la lista, más lejos el turno, más ausentes y más reingresos. B1 y B2 equilibran (desaliento y consumo); B3 es la política adaptativa.</p>
          </div>
        </header>
        <div className="figuras-par">
          <figure className="figura figura-diagrama">
            <figcaption className="figura-titulo">
              <span className="figura-numero">Fig. 1</span> Diagrama causal
            </figcaption>
            <DiagramaCausal />
          </figure>
          <figure className="figura figura-diagrama">
            <figcaption className="figura-titulo">
              <span className="figura-numero">Fig. 2</span> Stocks y flujos (Forrester)
            </figcaption>
            <DiagramaForrester />
          </figure>
        </div>
      </section>

      <section className="seccion-exp" id="politicas-ds" aria-labelledby="t-politicas">
        <header className="seccion-exp-cabeza">
          <span className="placa-mini placa-seccion" aria-hidden="true">2</span>
          <div>
            <h2 id="t-politicas" className="subtitulo-grande">Tres políticas ante un pico de demanda</h2>
            <p className="seccion-bajada">Policonsultorio. Todas arrancan en el equilibrio sin sobreturnos: con la demanda calibrada, el consultorio del estudio (11,95 días de anticipación, 14,7 % de ausentismo). k fijo = el recomendado del estudio; k adaptativo = cada semana, el k que maximiza B en la tabla de E3 con el ausentismo observado.</p>
          </div>
        </header>
        <div className="controles-dinamica">
          <Segmentado<'pico' | 'estable'>
            etiqueta="Escenario"
            valor={escenario}
            opciones={[
              { valor: 'pico', texto: 'Pico de invierno' },
              { valor: 'estable', texto: 'Demanda estable' },
            ]}
            alCambiar={setEscenario}
          />
          <CampoSelect<'calibrada' | 'manual'>
            etiqueta="Demanda base"
            valor={modoDemanda}
            opciones={[
              { valor: 'calibrada', texto: 'Calibrada a hoy' },
              { valor: 'manual', texto: 'Manual' },
            ]}
            alCambiar={setModoDemanda}
          />
          {modoDemanda === 'manual' && <CampoNumero etiqueta="Demanda D₀" sufijo="× C" paso={0.05} valor={ajustes.demanda} alCambiar={set('demanda')} />}
          {escenario === 'pico' && (
            <>
              <CampoNumero etiqueta="Aumento en el pico" sufijo="%" escala={100} valor={ajustes.aumento} alCambiar={set('aumento')} />
              <CampoNumero etiqueta="Desde la semana" valor={ajustes.inicio} alCambiar={set('inicio')} />
              <CampoNumero etiqueta="Duración" sufijo="sem" valor={ajustes.duracion} alCambiar={set('duracion')} />
            </>
          )}
          <CampoNumero etiqueta="Ausentes que vuelven (r)" sufijo="%" escala={100} valor={ajustes.reingreso} alCambiar={set('reingreso')} />
          <CampoNumero etiqueta="Umbral de desaliento" sufijo="días" valor={ajustes.umbral} alCambiar={set('umbral')} />
          <CampoNumero etiqueta="Desaliento máximo" sufijo="%" escala={100} valor={ajustes.maximo} alCambiar={set('maximo')} />
          <CampoNumero etiqueta="Horizonte" sufijo="sem" valor={ajustes.horizonte} alCambiar={set('horizonte')} />
          <CampoSelect<Metodo> etiqueta="Integración" valor={metodo} opciones={[{ valor: 'rk4', texto: 'RK4' }, { valor: 'euler', texto: 'Euler' }]} alCambiar={setMetodo} />
          <CampoSelect<number> etiqueta="dt" valor={dt} opciones={[1, 0.5, 0.25, 0.1].map((v) => ({ valor: v, texto: `${decimal(v, 2)} día${v === 1 ? '' : 's'}` }))} alCambiar={setDt} />
        </div>

        <p className={`nota-equilibrio${eqHoy.some((e) => !e.estable) ? ' con-alerta' : ''}`} role="status">
          D₀ = {decimal(prm.demandaBase, 2)} pacientes/día ({decimal(prm.demandaBase / capacidad(prm, 0), 3)} × C).{' '}
          {eqHoy.length === 0
            ? 'Sin sobreturnos no hay equilibrio: la lista crece sin límite.'
            : eqHoy.map((e, i) => `${i ? '; ' : 'Equilibrio sin sobreturnos: '}a* = ${decimal(e.a, 2)} días, p* = ${porcentaje(e.p)}, ${e.saturado ? 'agenda saturada' : 'agenda sin llenar'}, ${e.estable ? 'estable' : 'INESTABLE'}`).join('') + '.'}
          {eqHoy.length > 1 && ' Hay más de un equilibrio: el sistema es biestable y el estado final depende de la historia.'}
        </p>
        {!rs && <p className="cargando" role="status">Cargando la tabla del estudio…</p>}
        {rs && (
          <>
            <div className="multiples">
              <Figura numero={3} titulo="Lista de espera L" opcion={opcionTrayectorias(rs, 'L', prm)} alto={280} archivo="ds-fig3-lista" resumen={rs.map((r) => `${r.nombre}: máximo ${entero(r.Lmax)}`).join('; ')} />
              <Figura numero={4} titulo="Anticipación a = L / C" opcion={opcionTrayectorias(rs, 'a', prm)} alto={280} archivo="ds-fig4-anticipacion" resumen={rs.map((r) => `${r.nombre}: máximo ${decimal(r.amax)} días`).join('; ')} />
              <Figura numero={5} titulo="Ausentismo p(a)" opcion={opcionTrayectorias(rs, 'p', prm)} alto={280} archivo="ds-fig5-ausentismo" resumen={rs.map((r) => `${r.nombre}: máximo ${porcentaje(r.pmax)}`).join('; ')} />
            </div>
            <div className="multiples">
              <Figura numero={6} titulo="Atendidos por semana" descripcion="Pacientes por semana." opcion={opcionSemanal(rs, 'atendidos')} alto={280} archivo="ds-fig6-atendidos" resumen="Atendidos por semana según la política." />
              <Figura numero={7} titulo="Perdidos por semana" descripcion="Pacientes por semana: desalentados + ausentes que no vuelven." opcion={opcionSemanal(rs, 'perdidos')} alto={280} archivo="ds-fig7-perdidos" resumen="Perdidos por semana según la política." />
              <Figura numero={8} titulo="Beneficio acumulado" opcion={opcionTrayectorias(rs, 'beneficio', prm)} alto={280} archivo="ds-fig8-beneficio" resumen={rs.map((r) => `${r.nombre}: ${pesos(r.beneficio)}`).join('; ')} />
            </div>
            <TablaDatos
              titulo="Resumen por política"
              cabecera={['Política', 'L máx.', 'a máx.', 'p máx.', prm.pico ? 'Atendidos (pico + 6 sem)' : 'Atendidos', prm.pico ? 'Perdidos (pico + 6 sem)' : 'Perdidos', prm.pico ? 'Beneficio (pico + 6 sem)' : 'Beneficio', `Beneficio (${prm.horizonteSemanas} sem)`]}
              derecha={[1, 2, 3, 4, 5, 6, 7]}
              filas={rs.map((r) => [r.nombre, entero(r.Lmax), `${decimal(r.amax)} d`, porcentaje(r.pmax), entero(r.picoAtendidos), entero(r.picoPerdidos), pesos(r.picoBeneficio), pesos(r.beneficio)])}
              destacadas={[rs.reduce((m, r, i) => (r.beneficio > rs[m]!.beneficio ? i : m), 0)]}
              csv={{ nombre: 'dinamica-trayectorias.csv', contenido: csvTrayectorias }}
              nota={`Integración ${metodo === 'rk4' ? 'RK4' : 'Euler'} con dt = ${decimal(dt, 2)} día. El CSV trae la serie diaria de las tres políticas.`}
            />
            <Figura numero={9} titulo="k elegido por la política adaptativa" descripcion="Cada barra es una semana; el k sale de la tabla de E3 con el ausentismo observado la semana anterior." opcion={opcionK(rs[2]!)} alto={260} archivo="ds-fig9-k-adaptativo" resumen={`k por semana: ${rs[2]!.trayectoria.semanas.map((s) => s.k).join(' ')}`} />
          </>
        )}
      </section>

      <section className="seccion-exp" id="sensibilidad-ds" aria-labelledby="t-sensibilidad-ds">
        <header className="seccion-exp-cabeza">
          <span className="placa-mini placa-seccion" aria-hidden="true">3</span>
          <div>
            <h2 id="t-sensibilidad-ds" className="subtitulo-grande">¿Es robusto que gane el adaptativo?</h2>
            <p className="seccion-bajada">De a un supuesto por vez, alrededor de los valores base (no depende de los controles de arriba). En cada variante se recalibra D₀ para que el consultorio de hoy siga siendo el del estudio. Diferencia = adaptativo − k fijo en 36 semanas.</p>
          </div>
        </header>
        {sens ? (
          <>
            <div className="figuras-par">
              <Figura numero={10} titulo="Tornado: ventaja en beneficio" descripcion={`Cambio de B(adaptativo) − B(k fijo) respecto de la base (${pesos(sens.find((f) => f.esBase)!.difBeneficio)}). ⚠ = el consultorio de hoy no es un equilibrio estable.`} opcion={opcionTornado(sens, 'difBeneficio', (v) => `${v < 0 ? '−' : ''}$ ${decimal(Math.abs(v) / 1e6, 2)} M`)} alto={300} archivo="ds-fig10-tornado-beneficio" resumen={sens.map((f) => `${FORMATO_NIVEL[f.parametro](f.valor)}: ${pesos(f.difBeneficio)}`).join('; ')} />
              <Figura numero={11} titulo="Tornado: pacientes perdidos" descripcion={`Cambio de perdidos(adaptativo) − perdidos(k fijo) respecto de la base (${entero(sens.find((f) => f.esBase)!.difPerdidos)}). Negativo = el adaptativo pierde menos.`} opcion={opcionTornado(sens, 'difPerdidos', (v) => entero(v))} alto={300} archivo="ds-fig11-tornado-perdidos" resumen={sens.map((f) => `${FORMATO_NIVEL[f.parametro](f.valor)}: ${entero(f.difPerdidos)}`).join('; ')} />
            </div>
            <TablaDatos
              titulo="Qué política gana en cada variante"
              cabecera={['Supuesto', 'Valor', 'D₀ / C', 'Hoy estable', 'B k fijo', 'B adaptativo', 'Diferencia B', 'Perdidos fijo / adapt.', 'Diferencia', 'Gana en B', 'Gana en perdidos']}
              derecha={[2, 4, 5, 6, 7, 8]}
              filas={sens.map((f) => [NOMBRES_PARAMETRO[f.parametro], `${FORMATO_NIVEL[f.parametro](f.valor)}${f.esBase ? ' (base)' : ''}`, decimal(f.demandaRelativa, 3), f.estable ? (f.equilibrios > 1 ? `Sí (${f.equilibrios} equilibrios)` : 'Sí') : `No (${f.equilibrios} equilibrios)`, pesos(f.politicas[1].beneficio), pesos(f.politicas[2].beneficio), pesos(f.difBeneficio), `${entero(f.politicas[1].perdidos)} / ${entero(f.politicas[2].perdidos)}`, entero(f.difPerdidos), GANADOR[f.ganaBeneficio]!, GANADOR[f.ganaPerdidos]!])}
              destacadas={sens.map((f, i) => (f.ganaPerdidos !== 2 && f.ganaPerdidos !== -1 ? i : -1)).filter((i) => i >= 0)}
              csv={{
                nombre: 'dinamica-sensibilidad.csv',
                contenido: aCSV(
                  ['parametro', 'valor', 'base', 'D0_sobre_C0', 'hoy_estable', 'equilibrios', 'B_k0', 'B_fijo', 'B_adaptativo', 'dif_B', 'perdidos_k0', 'perdidos_fijo', 'perdidos_adaptativo', 'dif_perdidos', 'gana_B', 'gana_perdidos'],
                  sens.map((f) => [f.parametro, f.valor, f.esBase ? 1 : 0, f.demandaRelativa, f.estable ? 1 : 0, f.equilibrios, ...f.politicas.map((x) => x.beneficio), f.difBeneficio, ...f.politicas.map((x) => x.perdidos), f.difPerdidos, GANADOR[f.ganaBeneficio]!, GANADOR[f.ganaPerdidos]!]),
                ),
              }}
              nota="Resaltadas: las variantes donde el adaptativo no gana en perdidos. Con u ≥ 14 días el consultorio de hoy queda en un equilibrio inestable y los sobreturnos vacían la lista."
            />
            <p className="conclusion">
              <strong>Conclusión:</strong> el adaptativo <strong>nunca pierde en beneficio</strong> (gana en 14 variantes y empata con un pico chico, donde elige k = 2 todas las semanas), pero <strong>su ventaja es chica</strong>: de $ 20.000 a $ 330.000 en 36 semanas, y crece con el tamaño y la duración del pico. Lo que pesa en todas las variantes es dar sobreturnos: k = 2 contra k = 0 vale de $ 6 a $ 15 millones. La conclusión deja de valer en perdidos si el desaliento empieza tarde (u ≥ 14 días): ahí el consultorio de hoy no es estable.
            </p>
          </>
        ) : (
          <p className="cargando" role="status">Cargando la tabla del estudio…</p>
        )}
      </section>

      <section className="seccion-exp" id="fluido" aria-labelledby="t-fluido">
        <header className="seccion-exp-cabeza">
          <span className="placa-mini placa-seccion" aria-hidden="true">4</span>
          <div>
            <h2 id="t-fluido" className="subtitulo-grande">Medias contra variabilidad</h2>
            <p className="seccion-bajada">La sala de espera de un día como modelo fluido (continuo, determinista, con los mismos parámetros medios) contra la media de 500 días de eventos discretos. El fluido no ve la variabilidad y subestima la espera.</p>
          </div>
        </header>
        {complementos ? (
          <>
            <div className="figuras-par">
              {complementos.fluido.map((c, i) => (
                <Figura key={c.k} numero={12 + i} titulo={`Pacientes en sala, k = ${c.k}`} descripcion={`Policonsultorio, intercalado. Banda: IC 95 % de la media de ${c.R} días.`} opcion={opcionFluido(c)} alto={280} archivo={`ds-fig${12 + i}-fluido-k${c.k}`} resumen={`Área en sala: fluido ${decimal(c.fluidoArea)} contra ${decimal(c.desArea.media)} pacientes·min por día.`} />
              ))}
            </div>
            <TablaDatos
              titulo="Fluido contra eventos discretos"
              cabecera={['k', 'Área en sala fluido [pac·min/día]', 'Eventos discretos (IC 95 %)', 'Espera por paciente fluido [min]', 'Eventos discretos (IC 95 %)', 'Subestimación de la espera', 'Máximo en sala fluido / ED']}
              derecha={[0, 1, 2, 3, 4, 5, 6]}
              filas={complementos.fluido.map((c) => [c.k, decimal(c.fluidoArea), `${decimal(c.desArea.media)} ± ${decimal(c.desArea.semi)}`, decimal(c.fluidoEspera, 2), `${decimal(c.desEspera.media, 2)} ± ${decimal(c.desEspera.semi, 2)}`, `× ${decimal(c.desEspera.media / c.fluidoEspera, 2)}`, `${decimal(c.fluidoMaximo, 2)} / ${decimal(c.desMaximo.media, 2)}`])}
              csv={{ nombre: 'fluido.csv', contenido: aCSV(['k', 't_min', 'sala_des_media', 'sala_des_ic_inf', 'sala_des_ic_sup', 'sala_fluido'], complementos.fluido.flatMap((c) => c.t.map((t, i) => [c.k, t, c.des[i]!.media, c.des[i]!.inf, c.des[i]!.sup, c.fluido[i]!]))) }}
              nota="Espera por paciente por la Ley de Little: área en sala / pacientes que pasan por la sala."
            />
          </>
        ) : (
          <p className="cargando" role="status">Cargando los análisis complementarios…</p>
        )}
      </section>

      {conv && ver && (
        <section className="seccion-exp" id="numerico" aria-labelledby="t-numerico">
          <header className="seccion-exp-cabeza">
            <span className="placa-mini placa-seccion" aria-hidden="true">5</span>
            <div>
              <h2 id="t-numerico" className="subtitulo-grande">Integración numérica y validación</h2>
              <p className="seccion-bajada">Con los parámetros de arriba y k fijo = {kFijo}. Referencia: RK4 con dt = 0,01 día.</p>
            </div>
          </header>
          <div className="figuras-par">
            <Figura numero={14} titulo="Convergencia" descripcion="Error en L al final del horizonte según dt (escalas logarítmicas)." opcion={opcionConvergencia(conv.filas)} alto={280} archivo="ds-fig14-convergencia" resumen="Euler converge con orden 1; RK4 es más preciso." />
            <TablaDatos
              titulo="Convergencia numérica"
              cabecera={['Método', 'dt', 'L máx.', 'Error', 'L final', 'Error', 'Error beneficio']}
              derecha={[1, 2, 3, 4, 5, 6]}
              filas={conv.filas.map((f) => [f.metodo === 'rk4' ? 'RK4' : 'Euler', decimal(f.dt, 2), decimal(f.Lmax, 2), f.errorLmax.toExponential(2), decimal(f.Lfinal, 2), f.errorLfinal.toExponential(2), pesos(f.errorBeneficio)])}
              csv={{ nombre: 'convergencia.csv', contenido: aCSV(['metodo', 'dt', 'L_max', 'error_L_max', 'L_final', 'error_L_final', 'beneficio', 'error_beneficio'], conv.filas.map((f) => [f.metodo, f.dt, f.Lmax, f.errorLmax, f.Lfinal, f.errorLfinal, f.beneficio, f.errorBeneficio])) }}
              nota={`Referencia: L máx. ${decimal(conv.referencia.Lmax, 3)}, L final ${decimal(conv.referencia.Lfinal, 3)}.`}
            />
          </div>
          <TablaDatos
            titulo="Equilibrio analítico contra simulado (demanda constante)"
            cabecera={['k', 'a* [días]', 'p*', 'L* analítico', 'L simulado (120 semanas desde 0,3·L*)', 'Diferencia relativa', '¿Saturado?']}
            derecha={[0, 1, 2, 3, 4, 5]}
            filas={ver.map((v) => [v.k, decimal(v.analitico.a, 2), porcentaje(v.analitico.p), decimal(v.analitico.L, 3), decimal(v.simulado, 3), Math.abs(v.simulado / v.analitico.L - 1).toExponential(1), v.analitico.saturado ? 'Sí (S = C)' : 'No (S = L/τ)'])}
            csv={{ nombre: 'equilibrio.csv', contenido: aCSV(['k', 'a', 'p', 'L_analitico', 'L_simulado'], ver.map((v) => [v.k, v.analitico.a, v.analitico.p, v.analitico.L, v.simulado])) }}
            nota={`Consistencia con el modelo del día: con la demanda ${modoDemanda === 'calibrada' ? 'calibrada' : 'elegida'}, la anticipación de equilibrio sin sobreturnos es ${decimal(ver[0]!.analitico.a, 2)} días; la del estudio (media de la tabla de anticipación) es 11,95.`}
          />
        </section>
      )}
    </div>
  );
}
