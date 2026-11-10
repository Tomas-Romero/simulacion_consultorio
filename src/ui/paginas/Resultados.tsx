/**
 * Resultados del día (ECharts): Gantt por profesional, pacientes en sala, espera por clase,
 * desglose de B y de C y tabla por profesional. Misma corrida que la Simulación del día.
 */
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, CustomSeriesRenderItemReturn } from 'echarts';
import { useMemo } from 'react';
import { CLASES, type Clase, type MetricasDia } from '../../modelo';
import { PRESETS_APP, useEstado } from '../app/estado';
import { enlace } from '../app/rutas';
import type { Paleta } from '../animacion/dibujo';
import { prepararAnimacion, type DatosAnimacion } from '../animacion/preparar';
import { base, ejeRecesivo, Figura, type OpcionGrafico } from '../componentes/Figura';
import { IconoFlecha } from '../componentes/Iconos';
import { NOMBRES_CLASE, Pictograma, PlacasClases } from '../componentes/Pictograma';
import { decimal, entero, hora, pesos, porcentaje } from '../formato';
import { useCorrida } from '../simulacion/cliente';

/** Pseudoaleatorio determinista para dispersar puntos (la interfaz tampoco usa Math.random). */
const dispersion = (i: number): number => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
};

function opcionGantt(d: DatosAnimacion) {
  return (p: Paleta): OpcionGrafico => {
    const filas = d.profesionales.map((x, i) => `${i + 1} · ${x.nombre}`);
    // [fila, desde, hasta, tipo, clase]: 0 turno, 1 consulta, 2 horas extra, 3 fin de turno, 4 demora del médico
    const datos: (number | string)[][] = [];
    d.profesionales.forEach((x, i) => {
      datos.push([i, x.inicioTurno, x.finTurno, 0, '']);
      if (x.llegada > x.inicioTurno) datos.push([i, x.inicioTurno, Math.min(x.llegada, x.finTurno), 4, '']);
      if (x.salida > x.finTurno) datos.push([i, x.finTurno, x.salida, 2, '']);
      for (const c of x.consultas) datos.push([i, c.inicio, c.fin, 1, d.pacientes[c.paciente]!.clase]);
      datos.push([i, x.finTurno, x.finTurno, 3, '']);
    });
    const render = (_: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI): CustomSeriesRenderItemReturn => {
      const fila = api.value(0) as number;
      const tipo = api.value(3) as number;
      const a = api.coord([api.value(1), fila]) as number[];
      const b = api.coord([api.value(2), fila]) as number[];
      const alto = (api.size!([0, 1]) as number[])[1]!;
      const h = tipo === 1 ? alto * 0.5 : alto * 0.66;
      const x0 = a[0]!, x1 = b[0]!, yc = a[1]!;
      if (tipo === 3) return { type: 'line', shape: { x1: x0, y1: yc - alto * 0.4, x2: x0, y2: yc + alto * 0.4 }, style: { stroke: p.texto, lineWidth: 2 } };
      const rect = { x: x0, y: yc - h / 2, width: Math.max(1, x1 - x0), height: h };
      if (tipo === 0) return { type: 'rect', shape: { ...rect, r: 4 }, style: { fill: p.panel2, stroke: p.borde } };
      if (tipo === 4) return { type: 'rect', shape: rect, style: { fill: p.borde, opacity: 0.9 } };
      if (tipo === 2) return { type: 'rect', shape: { ...rect, r: [0, 4, 4, 0] }, style: { fill: p.accion, opacity: 0.22, stroke: p.accion, lineWidth: 1 } };
      const clase = api.value(4) as Clase;
      return { type: 'rect', shape: { ...rect, r: 2 }, style: { fill: p.clases[clase], stroke: p.panel, lineWidth: 1.5 } };
    };
    return {
      ...base(p),
      grid: { left: 150, right: 24, top: 12, bottom: 36 },
      xAxis: { type: 'value', min: Math.floor(d.tInicio / 60) * 60, max: Math.ceil(d.tFin / 60) * 60, interval: 60, ...ejeRecesivo(p), axisLabel: { ...ejeRecesivo(p).axisLabel as object, formatter: (v: number) => hora(v) } },
      yAxis: { type: 'category', data: filas, inverse: true, ...ejeRecesivo(p), splitLine: { show: false }, axisLabel: { color: p.texto2, fontSize: 12, width: 136, overflow: 'truncate' } },
      tooltip: {
        ...(base(p).tooltip as object),
        trigger: 'item',
        formatter: (q: { value: (number | string)[] }) => {
          const [fila, desde, hasta, tipo, clase] = q.value as [number, number, number, number, Clase | ''];
          const prof = filas[fila]!;
          if (tipo === 1) return `<b>${prof}</b><br>${NOMBRES_CLASE[clase as Clase]} · ${hora(desde)}–${hora(hasta)} (${decimal(hasta - desde)} min)`;
          if (tipo === 2) return `<b>${prof}</b><br>Horas extra: ${decimal(hasta - desde)} min, hasta las ${hora(hasta)}`;
          if (tipo === 4) return `<b>${prof}</b><br>Llegó a las ${hora(hasta)} (${decimal(hasta - desde)} min de demora)`;
          if (tipo === 3) return `<b>${prof}</b><br>Fin del turno: ${hora(desde)}`;
          return `<b>${prof}</b><br>Turno ${hora(desde)}–${hora(hasta)}`;
        },
      },
      series: [{ type: 'custom', renderItem: render, encode: { x: [1, 2], y: 0 }, data: datos, clip: true }],
    };
  };
}

function opcionSala(m: MetricasDia) {
  return (p: Paleta): OpcionGrafico => {
    const s = m.serie!;
    return {
      ...base(p),
      grid: { left: 44, right: 16, top: 36, bottom: 32 },
      legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 3, textStyle: { color: p.texto2, fontSize: 12 } },
      tooltip: {
        ...(base(p).tooltip as object),
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: p.bordeFuerte } },
        formatter: (q: { seriesName: string; value: number[]; marker: string }[]) => `<b>${hora(q[0]!.value[0]!)}</b><br>` + q.map((x) => `${x.marker} ${x.seriesName}: ${entero(x.value[1]!)}`).join('<br>'),
      },
      xAxis: { type: 'value', min: Math.floor(s.t[0]! / 60) * 60, max: Math.ceil(s.t[s.t.length - 1]! / 60) * 60, interval: 60, ...ejeRecesivo(p), splitLine: { show: false }, axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: (v: number) => hora(v).slice(0, 2) } },
      yAxis: { type: 'value', minInterval: 1, ...ejeRecesivo(p) },
      series: [
        { name: 'En sala de espera', type: 'line', step: 'end', data: s.t.map((t, i) => [t, s.sala[i]]), showSymbol: false, lineStyle: { width: 2, color: p.dato }, itemStyle: { color: p.dato }, areaStyle: { color: p.dato, opacity: 0.12 } },
        { name: 'En admisión', type: 'line', step: 'end', data: s.t.map((t, i) => [t, s.admision[i]]), showSymbol: false, lineStyle: { width: 2, color: p.texto3 }, itemStyle: { color: p.texto3 } },
      ],
    };
  };
}

function cuartiles(v: number[]): [number, number, number, number, number] {
  const o = [...v].sort((a, b) => a - b);
  const q = (u: number): number => {
    const pos = u * (o.length - 1);
    const i = Math.floor(pos);
    return o[i]! + (pos - i) * ((o[Math.min(i + 1, o.length - 1)] ?? o[i]!) - o[i]!);
  };
  return [o[0]!, q(0.25), q(0.5), q(0.75), o[o.length - 1]!];
}

function opcionEspera(d: DatosAnimacion) {
  return (p: Paleta): OpcionGrafico => {
    const clases = CLASES.filter((c) => d.pacientes.some((x) => x.clase === c && x.espera !== null));
    const esperas = clases.map((c) => d.pacientes.filter((x) => x.clase === c && x.espera !== null).map((x) => x.espera!));
    const puntos = clases.flatMap((c, i) => esperas[i]!.map((e, j) => ({ value: [i + dispersion(j * 7 + i) * 0.5, e], itemStyle: { color: p.clases[c] } })));
    return {
      ...base(p),
      grid: { left: 52, right: 16, top: 16, bottom: 32 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item' },
      xAxis: { type: 'category', data: clases.map((c) => NOMBRES_CLASE[c]), ...ejeRecesivo(p), splitLine: { show: false }, axisLabel: { color: p.texto2, fontSize: 12 } },
      yAxis: { type: 'value', name: 'espera [min]', ...ejeRecesivo(p) },
      series: [
        {
          type: 'boxplot',
          data: esperas.map((v, i) => ({ value: cuartiles(v), itemStyle: { color: 'transparent', borderColor: p.clases[clases[i]!], borderWidth: 2 } })),
          boxWidth: [18, 46],
          tooltip: {
            formatter: (q: { name: string; value: number[] }) =>
              `<b>${q.name}</b><br>mínimo ${decimal(q.value[1]!)} · Q1 ${decimal(q.value[2]!)}<br>mediana <b>${decimal(q.value[3]!)}</b> · Q3 ${decimal(q.value[4]!)}<br>máximo ${decimal(q.value[5]!)} min`,
          },
        },
        {
          type: 'scatter',
          xAxisIndex: 0,
          data: puntos,
          symbolSize: 6,
          itemStyle: { opacity: 0.55, borderColor: p.panel, borderWidth: 0.5 },
          tooltip: { formatter: (q: { value: number[] }) => `Espera: ${decimal(q.value[1]!)} min` },
          encode: { x: 0, y: 1 },
        },
      ],
    };
  };
}

function opcionB(m: MetricasDia) {
  return (p: Paleta): OpcionGrafico => {
    const pasos = [
      { k: 'Ingresos', v: m.ingresos },
      { k: 'Espera', v: -m.costos.espera },
      { k: 'Horas extra', v: -m.costos.extra },
      { k: 'Perdidos', v: -m.costos.perdidos },
    ];
    let acum = 0;
    const baseInv: number[] = [];
    const visibles: { value: number; itemStyle: { color: string; borderRadius: number | number[] } }[] = [];
    for (const s of pasos) {
      if (s.v >= 0) {
        baseInv.push(acum);
        visibles.push({ value: s.v, itemStyle: { color: p.positivo, borderRadius: [4, 4, 0, 0] } });
        acum += s.v;
      } else {
        acum += s.v;
        baseInv.push(acum);
        visibles.push({ value: -s.v, itemStyle: { color: p.texto3, borderRadius: 2 } });
      }
    }
    baseInv.push(0);
    visibles.push({ value: m.beneficio, itemStyle: { color: p.dato, borderRadius: [4, 4, 0, 0] } });
    const nombres = [...pasos.map((s) => s.k), 'B'];
    return {
      ...base(p),
      grid: { left: 64, right: 16, top: 28, bottom: 32 },
      tooltip: {
        ...(base(p).tooltip as object),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: p.panel2 } },
        formatter: (q: { dataIndex: number }[]) => {
          const i = q[0]!.dataIndex;
          const v = i < pasos.length ? pasos[i]!.v : m.beneficio;
          return `<b>${nombres[i]}</b><br>${(v < 0 ? '−' : '') + pesos(Math.abs(v))}`;
        },
      },
      xAxis: { type: 'category', data: nombres, ...ejeRecesivo(p), splitLine: { show: false }, axisLabel: { color: p.texto2, fontSize: 12 } },
      yAxis: { type: 'value', ...ejeRecesivo(p), axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: (v: number) => `${entero(v / 1000)} mil` } },
      series: [
        { type: 'bar', stack: 'b', data: baseInv, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, silent: true, barWidth: '52%' },
        {
          type: 'bar',
          stack: 'b',
          data: visibles,
          barWidth: '52%',
          label: { show: true, position: 'top', color: p.texto2, fontSize: 11, formatter: (q: { dataIndex: number; value: number }) => (q.dataIndex > 0 && q.dataIndex < pasos.length ? '−' : '') + `${entero(q.value / 1000)} mil` },
        },
      ],
    };
  };
}

function opcionC(m: MetricasDia) {
  return (p: Paleta): OpcionGrafico => {
    const comp = [
      { k: 'Espera', v: m.costos.espera },
      { k: 'Ocio', v: m.costos.ocio },
      { k: 'Horas extra', v: m.costos.extra },
      { k: 'Perdidos', v: m.costos.perdidos },
    ];
    return {
      ...base(p),
      grid: { left: 84, right: 72, top: 8, bottom: 28 },
      tooltip: { ...(base(p).tooltip as object), trigger: 'item', formatter: (q: { name: string; value: number }) => `<b>${q.name}</b><br>${pesos(q.value)} (${porcentaje(q.value / m.costos.total)} de C)` },
      xAxis: { type: 'value', ...ejeRecesivo(p), axisLabel: { ...(ejeRecesivo(p).axisLabel as object), formatter: (v: number) => `${entero(v / 1000)} mil` } },
      yAxis: { type: 'category', data: comp.map((c) => c.k), inverse: true, ...ejeRecesivo(p), splitLine: { show: false }, axisLabel: { color: p.texto2, fontSize: 12 } },
      series: [
        {
          type: 'bar',
          data: comp.map((c) => ({ value: c.v, name: c.k })),
          barWidth: '46%',
          itemStyle: { color: p.dato, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', color: p.texto2, fontSize: 11, formatter: (q: { value: number }) => `${entero(q.value / 1000)} mil` },
        },
      ],
    };
  };
}

function LeyendaGantt() {
  return (
    <ul className="leyenda-figura">
      {CLASES.map((c) => (
        <li key={c}>
          <Pictograma clase={c} tam={14} placa /> {NOMBRES_CLASE[c]}
        </li>
      ))}
      <li>
        <span className="ref-hueco" aria-hidden="true" /> Ocio (turno sin paciente)
      </li>
      <li>
        <span className="ref-demora" aria-hidden="true" /> Demora al llegar
      </li>
      <li>
        <span className="ref-extra" aria-hidden="true" /> Horas extra
      </li>
      <li>
        <span className="ref-fin" aria-hidden="true" /> Fin de turno
      </li>
    </ul>
  );
}

function Tabla({ m, d }: { m: MetricasDia; d: DatosAnimacion }) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla tabla-resultados">
        <caption>Por profesional</caption>
        <thead>
          <tr>
            <th scope="col">Consultorio</th>
            <th scope="col">Turno</th>
            <th scope="col">Llegó · se fue</th>
            <th scope="col" className="der">
              Atendidos
            </th>
            <th scope="col" className="der">
              Ausentes
            </th>
            <th scope="col" className="der">
              Espera turno
            </th>
            <th scope="col" className="der">
              Ocio
            </th>
            <th scope="col" className="der">
              Extra
            </th>
            <th scope="col" className="der">
              Utilización
            </th>
            <th scope="col" className="der">
              C
            </th>
            <th scope="col" className="der">
              B
            </th>
          </tr>
        </thead>
        <tbody>
          {m.porProfesional.map((x, i) => (
            <tr key={x.id}>
              <th scope="row">
                <span className="placa-mini">{i + 1}</span> {x.nombre}
              </th>
              <td className="num">
                {hora(x.inicioTurno)}–{hora(x.finTurno)}
              </td>
              <td className="num">
                {hora(x.llegada)} · {hora(x.salida)}
              </td>
              <td className="der num" title={CLASES.map((c) => `${NOMBRES_CLASE[c]}: ${x.atendidos[c]}`).join(' · ')}>
                {x.atendidosTotal}
              </td>
              <td className="der num">{x.ausentes}</td>
              <td className="der num">{x.espera.turno.n > 0 ? `${decimal(x.espera.turno.media)} min` : '—'}</td>
              <td className="der num">{decimal(x.ocio)} min</td>
              <td className={`der num${x.horasExtra > 0 ? ' tono-accion' : ''}`}>{decimal(x.horasExtra)} min</td>
              <td className="der num">{porcentaje(x.utilizacion)}</td>
              <td className="der num">{pesos(x.costos.total)}</td>
              <td className="der num">{pesos(x.beneficio)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total del día</th>
            <td />
            <td className="num">
              {hora(m.inicioDia)} · {hora(m.finDia)}
            </td>
            <td className="der num">{m.atendidosTotal}</td>
            <td className="der num">{m.ausentes}</td>
            <td className="der num">{m.espera.turno.n > 0 ? `${decimal(m.espera.turno.media)} min` : '—'}</td>
            <td className="der num">{decimal(m.ocio)} min</td>
            <td className="der num">{decimal(m.horasExtra)} min</td>
            <td className="der num">{porcentaje(m.utilizacionMedicos)}</td>
            <td className="der num">{pesos(m.costos.total)}</td>
            <td className="der num">{pesos(m.beneficio)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="nota">
        B y C por profesional cuentan solo sus pérdidas propias (tardíos rechazados); el total incluye todas ({entero(m.perdidosTotal)} pacientes perdidos en el día). {d.pacientes.filter((x) => x.origen === 'sobreturno').length > 0 && 'Los sobreturnos cuentan como atendidos de su profesional.'}
      </p>
    </div>
  );
}

export default function Resultados() {
  const { valido, semilla, preset } = useEstado();
  const corrida = useCorrida(valido, semilla);
  const d = useMemo(() => (corrida.estado === 'listo' ? prepararAnimacion(corrida.resultado) : null), [corrida]);
  const op = useMemo(
    () => (d ? { gantt: opcionGantt(d), sala: opcionSala(d.corrida.metricas), espera: opcionEspera(d), b: opcionB(d.corrida.metricas), c: opcionC(d.corrida.metricas) } : null),
    [d],
  );
  const nombre = preset ? PRESETS_APP[preset].corto : valido.nombre || 'Escenario personalizado';

  if (corrida.estado === 'error')
    return (
      <div className="pagina">
        <p className="aviso-error" role="alert">
          No se pudo simular el día: {corrida.mensaje}
        </p>
      </div>
    );
  if (!d || !op)
    return (
      <div className="pagina">
        <h1 className="titulo-pagina">Resultados del día</h1>
        <p className="cargando" role="status">
          Simulando el día…
        </p>
      </div>
    );

  const m = d.corrida.metricas;
  const slug = `${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-semilla-${semilla}`;
  return (
    <div className="pagina pagina-resultados">
      <header className="cabeza-pagina">
        <div>
          <h1 className="titulo-pagina">Resultados del día</h1>
          <p className="bajada">
            {nombre} · semilla <span className="num">{semilla}</span> · un solo día simulado ({entero(d.corrida.metricas.llegadas)} pacientes generados)
          </p>
          <p className="marca-supuestos">Datos ficticios · supuestos del modelo; un día no decide: eso es el paso #4</p>
        </div>
        <div className="cabeza-acciones">
          <a className="boton boton-fantasma" href={enlace('simulacion')}>
            Ver la animación
          </a>
        </div>
      </header>

      <section className="resumen-dia" aria-label="Resumen del día">
        <div className="resumen-b">
          <span>Beneficio neto B · criterio de decisión</span>
          <strong className="num">{pesos(m.beneficio)}</strong>
        </div>
        <dl className="resumen-lista">
          <div>
            <dt>Costo clásico C</dt>
            <dd className="num">{pesos(m.costos.total)}</dd>
          </div>
          <div>
            <dt>Atendidos</dt>
            <dd className="num">{entero(m.atendidosTotal)}</dd>
          </div>
          <div>
            <dt>Ausentes</dt>
            <dd className="num">{entero(m.ausentes)}</dd>
          </div>
          <div>
            <dt>Perdidos</dt>
            <dd className="num">{entero(m.perdidosTotal)}</dd>
          </div>
          <div>
            <dt>Espera media</dt>
            <dd className="num">{decimal(m.espera.todas.media)} min</dd>
          </div>
          <div>
            <dt>Horas extra</dt>
            <dd className="num">{decimal(m.horasExtra)} min</dd>
          </div>
          <div>
            <dt>Utilización</dt>
            <dd className="num">{porcentaje(m.utilizacionMedicos)}</dd>
          </div>
        </dl>
      </section>

      <Figura
        numero={1}
        titulo="Agenda real de cada profesional"
        descripcion="Consultas coloreadas por clase; los huecos dentro del turno son ocio; lo que pasa después de la línea es hora extra."
        opcion={op.gantt}
        alto={Math.max(180, 70 + d.profesionales.length * 56)}
        archivo={`fig1-gantt-${slug}`}
        resumen={`Gantt de ${d.profesionales.length} profesionales: ${m.atendidosTotal} consultas, ${decimal(m.ocio)} minutos de ocio y ${decimal(m.horasExtra)} minutos de horas extra en total.`}
      />
      <LeyendaGantt />

      <div className="figuras-par">
        <Figura
          numero={2}
          titulo="Pacientes esperando a lo largo del día"
          descripcion="Cantidad de pacientes, cada 5 minutos."
          opcion={op.sala}
          archivo={`fig2-sala-${slug}`}
          resumen={`Pacientes en la sala de espera cada 5 minutos; máximo ${Math.max(...(m.serie?.sala ?? [0]))}.`}
        />
        <Figura
          numero={3}
          titulo="Espera por clase de paciente"
          descripcion={
            <>
              Caja: cuartiles; puntos: cada paciente atendido.
              <PlacasClases clases={CLASES.filter((c) => m.espera[c].n > 0)} tam={13} className="leyenda-figura leyenda-encabezado" />
            </>
          }
          opcion={op.espera}
          archivo={`fig3-espera-${slug}`}
          resumen={`Distribución de la espera por clase; espera media de los turnos ${decimal(m.espera.turno.media)} minutos.`}
        />
      </div>
      <div className="figuras-par">
        <Figura
          numero={4}
          titulo="De los ingresos al beneficio neto"
          descripcion="B = ingresos − espera − horas extra − perdidos."
          opcion={op.b}
          archivo={`fig4-beneficio-${slug}`}
          resumen={`Ingresos ${pesos(m.ingresos)}; costo de espera ${pesos(m.costos.espera)}, horas extra ${pesos(m.costos.extra)}, perdidos ${pesos(m.costos.perdidos)}; B ${pesos(m.beneficio)}.`}
        />
        <Figura
          numero={5}
          titulo="Componentes del costo clásico"
          descripcion={`C = ${pesos(m.costos.total)}: suma el ocio del médico, que B no resta. Se muestra como contraste.`}
          opcion={op.c}
          alto={260}
          archivo={`fig5-costo-${slug}`}
          resumen={`Costo C ${pesos(m.costos.total)}: espera ${pesos(m.costos.espera)}, ocio ${pesos(m.costos.ocio)}, horas extra ${pesos(m.costos.extra)}, perdidos ${pesos(m.costos.perdidos)}.`}
        />
      </div>

      <Tabla m={m} d={d} />
      <a className="boton boton-secundario" href={enlace('experimentos')}>
        Muchos días y muchas agendas: Experimentos (#4) <IconoFlecha tam={18} />
      </a>
    </div>
  );
}
