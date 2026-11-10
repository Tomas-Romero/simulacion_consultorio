/**
 * Reporte imprimible (#6): el escenario del editor, el día simulado con su semilla y el último
 * laboratorio. Estilos de impresión en paginas.css (@media print): sin banda ni pie, en blanco.
 */
import { NOMBRES_ESPECIALIDAD, type Escenario } from '../../../modelo';
import { NOMBRES_POLITICA, PRESETS_APP, useEstado } from '../../app/estado';
import { SITIO } from '../../app/config';
import { useLaboratorio } from '../../app/laboratorio';
import { enlace } from '../../app/rutas';
import { decimal, entero, hora, pesos, porcentaje } from '../../formato';
import { useCorrida } from '../../simulacion/cliente';

function Tabla({ cabecera, filas, derecha = [] }: { cabecera: string[]; filas: (string | number)[][]; derecha?: number[] }) {
  return (
    <table className="tabla tabla-compacta">
      <thead>
        <tr>
          {cabecera.map((c, i) => (
            <th key={c} scope="col" className={derecha.includes(i) ? 'der' : undefined}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i}>
            {f.map((c, j) => (
              <td key={j} className={derecha.includes(j) ? 'der num' : undefined}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Parametros({ e }: { e: Escenario }) {
  const a = e.pacientes.atencion;
  const esp = e.espontaneos.tasasPorHora.reduce((s, x) => s + x, 0);
  const filas: [string, string][] = [
    ['Jornada', `${hora(e.jornada.inicio)} a ${hora(e.jornada.fin)} (cambio de turno ${hora(e.jornada.cambioTurno)})`],
    ['Pacientes de primera vez', porcentaje(e.pacientes.proporcionPrimeraVez)],
    ['Tiempo de atención', `${a.familia}${a.familia === 'lognormal' ? `, cv ${decimal(a.cv, 2)}` : ''}; media = factor × D (primera vez ${decimal(a.factorPrimeraVez, 2)}, control ${decimal(a.factorControl, 2)}, espontáneo ${decimal(a.factorEspontaneo, 2)}, urgencia ${decimal(a.factorUrgencia, 2)})`],
    ['Ausentismo', `P(falta | d) = logística(${decimal(e.ausentismo.beta0, 3)} + ${decimal(e.ausentismo.beta1, 3)}·d)`],
    ['Puntualidad', `tolerancia ${e.puntualidad.tolerancia} min; tardíos: ${e.puntualidad.politicaTardios === 'pierde_turno' ? 'pierden el turno' : 'se atienden si hay lugar'}`],
    ['Demanda espontánea', `${decimal(esp, 1)} llegadas por día; ${porcentaje(e.espontaneos.proporcionUrgencias)} urgencias${e.espontaneos.abandonan ? '; abandonan si esperan demasiado' : ''}`],
    ['Admisión', `${e.admision.recepcionistas} recepcionista${e.admision.recepcionistas === 1 ? '' : 's'}`],
    ['Costos', `espera ${pesos(e.costos.espera)}/min · paciente perdido ${pesos(e.costos.perdido)}`],
  ];
  return (
    <dl className="reporte-lista">
      {filas.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Dia({ e, semilla }: { e: Escenario; semilla: number }) {
  const corrida = useCorrida(e, semilla, 0);
  if (corrida.estado === 'cargando') return <p className="cargando">Simulando el día…</p>;
  if (corrida.estado === 'error') return <p className="aviso-error">{corrida.mensaje}</p>;
  const m = corrida.resultado.metricas;
  const tarjetas: [string, string][] = [
    ['Beneficio neto B', pesos(m.beneficio)],
    ['Costo clásico C', pesos(m.costos.total)],
    ['Atendidos', entero(m.atendidosTotal)],
    ['Ausentes', entero(m.ausentes)],
    ['Perdidos', entero(m.perdidosTotal)],
    ['Espera media', `${decimal(m.espera.todas.media)} min (p90 ${decimal(m.espera.todas.p90)})`],
    ['Ocio de los médicos', `${entero(m.ocio)} min`],
    ['Horas extra', `${entero(m.horasExtra)} min`],
  ];
  return (
    <>
      <div className="reporte-tarjetas">
        {tarjetas.map(([k, v]) => (
          <div key={k} className="reporte-tarjeta">
            <span>{k}</span>
            <strong className="num">{v}</strong>
          </div>
        ))}
      </div>
      <Tabla
        cabecera={['Profesional', 'Atendidos', 'Ausentes', 'Ocio [min]', 'Horas extra [min]', 'Utilización', 'B']}
        derecha={[1, 2, 3, 4, 5, 6]}
        filas={m.porProfesional.map((p, i) => [e.profesionales[i]!.nombre, p.atendidosTotal, p.ausentes, entero(p.ocio), entero(p.horasExtra), porcentaje(p.utilizacion), pesos(p.beneficio)])}
      />
      <p className="nota">Un solo día (semilla {semilla}, réplica 0): sirve para ver el funcionamiento, no para decidir. Las decisiones salen de muchas réplicas (Experimentos).</p>
    </>
  );
}

export default function Reporte() {
  const { valido, semilla, preset } = useEstado();
  const lab = useLaboratorio();
  const nombre = preset ? PRESETS_APP[preset].corto : valido.nombre;
  const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="pagina pagina-reporte">
      <div className="reporte-barra no-imprimir">
        <a className="boton boton-fantasma" href={enlace('datos')}>
          Volver a Datos
        </a>
        <button type="button" className="boton boton-primario" onClick={() => window.print()}>
          Imprimir o guardar como PDF
        </button>
      </div>
      <article className="reporte">
        <header className="reporte-cabeza">
          <p className="reporte-marca">{SITIO.nombre} · reporte</p>
          <h1 className="titulo-pagina">{nombre}</h1>
          <p className="bajada">
            {fecha} · semilla {semilla} · {SITIO.autoria}
          </p>
        </header>

        <section className="reporte-seccion">
          <h2 className="subtitulo-grande">1. Escenario</h2>
          <Tabla
            cabecera={['Profesional', 'Especialidad', 'Turno', 'D [min]', 'Agenda ocupada', 'Cupos (1 cada)', 'Sobreturnos', 'Política']}
            derecha={[3, 4, 5, 6]}
            filas={valido.profesionales.map((p) => [p.nombre, NOMBRES_ESPECIALIDAD[p.especialidad], p.turno === 'manana' ? 'Mañana' : 'Tarde', p.duracionTurno, porcentaje(p.ocupacionAgenda), p.cuposEspontaneos.cadaN || '—', p.sobreturnos.k, NOMBRES_POLITICA[p.sobreturnos.politica]])}
          />
          <Parametros e={valido} />
        </section>

        <section className="reporte-seccion">
          <h2 className="subtitulo-grande">2. Un día simulado</h2>
          <Dia e={valido} semilla={semilla} />
        </section>

        <section className="reporte-seccion">
          <h2 className="subtitulo-grande">3. Laboratorio</h2>
          {lab ? (
            <>
              <p className="parrafo">
                {lab.escenario} · R = {entero(lab.R)} días por configuración · semilla {lab.semilla} · k de {lab.ks[0]} a {lab.ks.at(-1)} · {new Date(lab.cuando).toLocaleString('es-AR')}.
              </p>
              <Tabla
                cabecera={['Política', 'k̂ (máximo B)', 'Conjunto óptimo', 'Recomendado', 'B en k̂ (IC 95 %)']}
                derecha={[1, 3, 4]}
                filas={lab.curvas.map(({ politica, curva }) => {
                  const b = curva.puntos.find((x) => x.k === curva.kHat)!.B;
                  return [NOMBRES_POLITICA[politica], curva.kHat, `{${curva.conjunto.join(', ')}}`, curva.kRec, `${pesos(b.media)} ± ${pesos(b.semi)}`];
                })}
              />
              <Tabla
                cabecera={['k', ...lab.curvas.map((c) => `B · ${NOMBRES_POLITICA[c.politica]}`)]}
                derecha={lab.curvas.map((_, i) => i + 1).concat(0)}
                filas={lab.ks.map((k) => [k, ...lab.curvas.map((c) => { const x = c.curva.puntos.find((q) => q.k === k)!.B; return `${pesos(x.media)} ± ${pesos(x.semi)}`; })])}
              />
            </>
          ) : (
            <p className="nota">
              Todavía no se corrió el laboratorio en esta pestaña. <a href={enlace('experimentos') + '#laboratorio'}>Correrlo en Experimentos</a> y volver.
            </p>
          )}
        </section>

        <footer className="reporte-pie">
          {SITIO.nombre} · {SITIO.institucion} · {SITIO.repositorio}. Datos ficticios marcados como supuestos salvo los que se importaron. Criterio de decisión: beneficio neto esperado B.
        </footer>
      </article>
    </div>
  );
}
