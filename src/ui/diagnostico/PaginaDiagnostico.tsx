/**
 * Página de diagnóstico (paso #1): validación del motor contra M/M/c y la Ley de Little.
 * Se conserva en #/diagnostico para mostrar la validación en el oral.
 */
import { useEffect, useState } from 'react';
import { REPLICAS_VALIDACION, SEMILLA_VALIDACION, TOLERANCIA_LITTLE, type ResultadoCaso } from '../../motor';
import { PanelDia } from './PanelDia';
import type { MensajeWorker } from './validacion.worker';

interface CasoCalculado {
  resultado: ResultadoCaso;
  segundos: number;
}

const f = (x: number, d = 4): string => x.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

const estilos = {
  tabla: { borderCollapse: 'collapse', margin: '8px 0 20px', fontVariantNumeric: 'tabular-nums', fontSize: 13 },
  celda: { borderBottom: '1px solid var(--borde)', padding: '6px 10px', textAlign: 'right' },
  encabezado: { borderBottom: '1px solid var(--borde-fuerte)', padding: '6px 10px', color: 'var(--texto-3)', fontWeight: 500, textAlign: 'right' },
} as const;

function Si({ ok }: { ok: boolean }) {
  return <span style={{ color: ok ? 'var(--positivo)' : 'var(--alerta)', fontWeight: 600 }}>{ok ? 'SÍ' : 'NO'}</span>;
}

function TablaCaso({ resultado, segundos }: CasoCalculado) {
  const { caso } = resultado;
  const maxL = Math.max(...resultado.little.map((l) => l.errorL));
  const maxLq = Math.max(...resultado.little.map((l) => l.errorLq));
  return (
    <section>
      <h2 style={{ fontSize: 18 }}>{caso.nombre}</h2>
      <p>
        τ de relajación = {f(resultado.tiempoRelajacionHoras, 1)} h · calentamiento = {caso.calentamientoHoras} h · medición ={' '}
        {caso.duracionHoras} h · ≈ {resultado.clientesPorReplica.toLocaleString('es-AR')} clientes por réplica ·{' '}
        {resultado.eventosTotales.toLocaleString('es-AR')} eventos · {f(segundos, 1)} s
      </p>
      <table style={estilos.tabla}>
        <thead>
          <tr>
            {['Medida', 'Teórico', 'Media simulada', 'IC 95 %', '¿Dentro?', 'IC simultáneo (95 % conjunto)', '¿Dentro?', 'z'].map((t, i) => (
              <th key={i} style={estilos.encabezado}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resultado.comparaciones.map((m) => (
            <tr key={m.clave}>
              <td style={{ ...estilos.celda, textAlign: 'left' }}>
                {m.nombre}
                {m.unidad && ` [${m.unidad}]`}
              </td>
              <td style={estilos.celda}>{f(m.teorico)}</td>
              <td style={estilos.celda}>{f(m.ic.media)}</td>
              <td style={estilos.celda}>
                [{f(m.ic.inferior)}; {f(m.ic.superior)}]
              </td>
              <td style={estilos.celda}>
                <Si ok={m.dentro} />
              </td>
              <td style={estilos.celda}>
                [{f(m.icSimultaneo.inferior)}; {f(m.icSimultaneo.superior)}]
              </td>
              <td style={estilos.celda}>
                <Si ok={m.dentroSimultaneo} />
              </td>
              <td style={estilos.celda}>{f(m.z, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Ley de Little en cada réplica: máx |L − λ̂W|/L = {f(100 * maxL, 3)} %, máx |Lq − λ̂Wq|/Lq = {f(100 * maxLq, 3)} % (tolerancia{' '}
        {TOLERANCIA_LITTLE * 100} %) → <Si ok={resultado.maxErrorLittle <= TOLERANCIA_LITTLE} />
      </p>
      <details>
        <summary>Little réplica por réplica</summary>
        <table style={estilos.tabla}>
          <thead>
            <tr>
              {['Réplica', 'L', 'λ̂·W', 'Error', 'Lq', 'λ̂·Wq', 'Error'].map((t, i) => (
                <th key={i} style={estilos.encabezado}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultado.little.map((l) => (
              <tr key={l.replica}>
                <td style={estilos.celda}>{l.replica}</td>
                <td style={estilos.celda}>{f(l.L)}</td>
                <td style={estilos.celda}>{f(l.lambdaW)}</td>
                <td style={estilos.celda}>{f(100 * l.errorL, 3)} %</td>
                <td style={estilos.celda}>{f(l.Lq)}</td>
                <td style={estilos.celda}>{f(l.lambdaWq)}</td>
                <td style={estilos.celda}>{f(100 * l.errorLq, 3)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function PaginaDiagnostico() {
  const [casos, setCasos] = useState<CasoCalculado[]>([]);
  const [estado, setEstado] = useState('Iniciando el worker…');

  useEffect(() => {
    const worker = new Worker(new URL('./validacion.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<MensajeWorker>) => {
      const m = e.data;
      if (m.tipo === 'progreso') setEstado(`Simulando ${m.caso} (${m.indice + 1} de ${m.total})…`);
      else if (m.tipo === 'caso') setCasos((previos) => [...previos, { resultado: m.resultado, segundos: m.segundos }]);
      else setEstado('Listo.');
    };
    worker.postMessage('iniciar');
    return () => worker.terminate();
  }, []);

  return (
    <div className="pagina-diagnostico diagnostico">
      <h1 className="titulo-pagina">Diagnóstico del motor</h1>
      <p className="bajada">Validación del motor y del modelo en vivo (página de trabajo del paso #1, se conserva para el oral).</p>
      <PanelDia />
      <h2 style={{ fontSize: 20 }}>Motor · validación contra M/M/c</h2>
      <p>
        Validación del motor de eventos discretos contra Erlang C. R = {REPLICAS_VALIDACION} réplicas por caso, semilla{' '}
        {SEMILLA_VALIDACION}. IC con t de Student; el IC simultáneo aplica Bonferroni sobre las 18 comparaciones (criterio de los
        tests). Corre en un Web Worker.
      </p>
      <p>
        <strong>{estado}</strong>
      </p>
      {casos.map((c) => (
        <TablaCaso key={c.resultado.caso.id} {...c} />
      ))}
    </div>
  );
}
