/**
 * Dinámica de sistemas (paso #5): lista de espera en semanas con tres políticas de sobreturnos,
 * modelo fluido de la jornada contra eventos discretos y convergencia numérica.
 */
import { useMemo, useState } from 'react';
import {
  compararPoliticas,
  equilibrio,
  parametrosBase,
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
import { useComplementos, useEstudio } from '../../simulacion/estudio';
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

export default function Dinamica() {
  const { estudio } = useEstudio();
  const complementos = useComplementos();
  const { efectivo } = useTema();
  const [escenario, setEscenario] = useState<'pico' | 'estable'>('pico');
  const [ajustes, setAjustes] = useState({ demanda: 1, aumento: 0.3, duracion: 6, inicio: 10, reingreso: 0.5, umbral: 14, ancho: 14, maximo: 0.6, horizonte: 36 });
  const [metodo, setMetodo] = useState<Metodo>('rk4');
  const [dt, setDt] = useState(0.25);
  const set = (k: keyof typeof ajustes) => (v: number) => Number.isFinite(v) && setAjustes((a) => ({ ...a, [k]: v }));

  const tb = useMemo(() => (estudio ? tablaDesdeEstudio(estudio) : null), [estudio]);
  const kFijo = estudio?.e1.find((x) => x.preset === 'policonsultorio' && x.politica === estudio.e3.politica)?.curva.kRec ?? 2;
  const prm = useMemo<ParametrosLista>(() => {
    const b = parametrosBase();
    return {
      ...b,
      demandaBase: b.demandaBase * ajustes.demanda,
      pico: escenario === 'pico' ? { inicio: ajustes.inicio, duracion: ajustes.duracion, aumento: ajustes.aumento } : null,
      reingreso: ajustes.reingreso,
      desaliento: { umbral: ajustes.umbral, ancho: ajustes.ancho, maximo: ajustes.maximo },
      horizonteSemanas: Math.max(8, Math.min(104, Math.round(ajustes.horizonte))),
    };
  }, [ajustes, escenario]);
  const rs = useMemo(() => (tb ? compararPoliticas(prm, tb, kFijo, { dt, metodo }) : null), [prm, tb, kFijo, dt, metodo]);
  const conv = useMemo(() => (tb ? tablaConvergencia(prm, tb, kFijo) : null), [prm, tb, kFijo]);
  const ver = useMemo(() => (tb ? [0, kFijo].map((k) => ({ k, ...verificarEquilibrio(prm, tb, k) })) : null), [prm, tb, kFijo]);
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
            <p className="seccion-bajada">Policonsultorio. Todas arrancan en el equilibrio sin sobreturnos. k fijo = el recomendado del estudio; k adaptativo = cada semana, el k que maximiza B en la tabla de E3 con el ausentismo observado.</p>
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
          <CampoNumero etiqueta="Demanda base" sufijo="× C" paso={0.05} valor={ajustes.demanda} alCambiar={set('demanda')} />
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

      <section className="seccion-exp" id="fluido" aria-labelledby="t-fluido">
        <header className="seccion-exp-cabeza">
          <span className="placa-mini placa-seccion" aria-hidden="true">3</span>
          <div>
            <h2 id="t-fluido" className="subtitulo-grande">Medias contra variabilidad</h2>
            <p className="seccion-bajada">La sala de espera de un día como modelo fluido (continuo, determinista, con los mismos parámetros medios) contra la media de 500 días de eventos discretos. El fluido no ve la variabilidad y subestima la espera.</p>
          </div>
        </header>
        {complementos ? (
          <>
            <div className="figuras-par">
              {complementos.fluido.map((c, i) => (
                <Figura key={c.k} numero={10 + i} titulo={`Pacientes en sala, k = ${c.k}`} descripcion={`Policonsultorio, intercalado. Banda: IC 95 % de la media de ${c.R} días.`} opcion={opcionFluido(c)} alto={280} archivo={`ds-fig${10 + i}-fluido-k${c.k}`} resumen={`Área en sala: fluido ${decimal(c.fluidoArea)} contra ${decimal(c.desArea.media)} pacientes·min por día.`} />
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
            <span className="placa-mini placa-seccion" aria-hidden="true">4</span>
            <div>
              <h2 id="t-numerico" className="subtitulo-grande">Integración numérica y validación</h2>
              <p className="seccion-bajada">Con los parámetros de arriba y k fijo = {kFijo}. Referencia: RK4 con dt = 0,01 día.</p>
            </div>
          </header>
          <div className="figuras-par">
            <Figura numero={12} titulo="Convergencia" descripcion="Error en L al final del horizonte según dt (escalas logarítmicas)." opcion={opcionConvergencia(conv.filas)} alto={280} archivo="ds-fig12-convergencia" resumen="Euler converge con orden 1; RK4 es más preciso." />
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
            nota={`Consistencia con el modelo del día: con la demanda base, la anticipación de equilibrio (k = 0) es ${decimal(equilibrio(prm, 0).a, 1)} días; la tabla de anticipación va de 1 a 30 días (media 11,95).`}
          />
        </section>
      )}
    </div>
  );
}
