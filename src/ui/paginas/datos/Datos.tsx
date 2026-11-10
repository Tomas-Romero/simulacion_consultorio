/**
 * Datos (paso #6): el escenario en JSON (exportar e importar con validación), ajuste de los tiempos
 * de atención medidos, regresión logística del ausentismo, plantillas, datos de ejemplo y el
 * reporte imprimible. Todo corre en el navegador.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  aplicarAusentismo,
  aplicarTiempos,
  asistenciaACSV,
  compararAjustes,
  FAMILIAS,
  generarAsistencia,
  generarTiempos,
  leerAsistencia,
  leerTiempos,
  mejorPorAIC,
  NOMBRES_FAMILIA,
  NOMBRES_TIPO,
  PLANTILLA_ASISTENCIA,
  PLANTILLA_TIEMPOS,
  proporcionesPorTramo,
  regresionLogistica,
  SEMILLA_EJEMPLO,
  tiemposACSV,
  TIPOS_PACIENTE,
  type Aplicacion,
  type ErrorCSV,
  type Familia,
  type Observacion,
  type ResultadoLogistica,
  type Tramo,
  type TiempoMedido,
  type TipoPaciente,
} from '../../../datos';
import { aCSV } from '../../../experimentos/csv';
import { EsquemaEscenario, type Escenario } from '../../../modelo';
import { editarEscenario, mensajeError, useEstado } from '../../app/estado';
import { enlace } from '../../app/rutas';
import { Segmentado } from '../../componentes/Campos';
import { Figura } from '../../componentes/Figura';
import { IconoAviso, IconoDescargar, IconoFlecha, IconoValido } from '../../componentes/Iconos';
import { TablaDatos } from '../../componentes/TablaDatos';
import { decimal, entero, porcentaje } from '../../formato';
import { descargarTexto } from '../../simulacion/estudio';
import { opcionHistograma, opcionLogistica, opcionQQ } from './graficos';

function Seccion({ id, numero, titulo, bajada, children }: { id: string; numero: number; titulo: string; bajada: string; children: ReactNode }) {
  return (
    <section id={id} className="seccion-exp" aria-labelledby={`t-${id}`}>
      <header className="seccion-exp-cabeza">
        <span className="placa-mini placa-seccion" aria-hidden="true">
          {numero}
        </span>
        <div>
          <h2 id={`t-${id}`} className="subtitulo-grande">
            {titulo}
          </h2>
          <p className="seccion-bajada">{bajada}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

/** Botón que abre el selector de archivos y devuelve el texto. */
function CargarArchivo({ etiqueta, aceptar, alCargar }: { etiqueta: string; aceptar: string; alCargar: (texto: string, nombre: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="boton boton-primario" onClick={() => ref.current?.click()}>
        {etiqueta}
      </button>
      <input
        ref={ref}
        type="file"
        accept={aceptar}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f) void f.text().then((t) => alCargar(t, f.name));
          ev.target.value = '';
        }}
      />
    </>
  );
}

function ListaErrores({ titulo, errores }: { titulo: string; errores: readonly { donde: string; mensaje: string }[] }) {
  return (
    <div className="aviso-error" role="alert">
      <p className="aviso-titulo">
        <IconoAviso tam={18} /> {titulo}
      </p>
      <ul className="lista-errores">
        {errores.slice(0, 12).map((e, i) => (
          <li key={i}>
            <strong>{e.donde}:</strong> {e.mensaje}
          </li>
        ))}
      </ul>
      {errores.length > 12 && <p>… y {errores.length - 12} errores más.</p>}
    </div>
  );
}

const erroresCSV = (es: readonly ErrorCSV[]) => es.map((e) => ({ donde: `Línea ${e.linea}${e.campo ? `, ${e.campo}` : ''}`, mensaje: e.mensaje }));

/** Vista previa de lo que cambia en el escenario y botón para aplicarlo. */
function PanelAplicar({ aplicacion, aplicada, alAplicar }: { aplicacion: Aplicacion; aplicada: boolean; alAplicar: () => void }) {
  return (
    <div className="panel-aplicar">
      <h3 className="subtitulo">Qué cambia en el escenario</h3>
      <table className="tabla tabla-compacta">
        <thead>
          <tr>
            <th scope="col">Campo</th>
            <th scope="col" className="der">
              Ahora
            </th>
            <th scope="col" className="der">
              Con los datos
            </th>
          </tr>
        </thead>
        <tbody>
          {aplicacion.cambios.map((c) => (
            <tr key={c.campo}>
              <td>{c.campo}</td>
              <td className="der num">{c.antes}</td>
              <td className="der num">{c.despues}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {aplicacion.advertencias.map((a) => (
        <p key={a} className="nota">
          {a}
        </p>
      ))}
      {aplicada ? (
        <p className="aviso-ok" role="status">
          <IconoValido tam={18} /> Aplicado al escenario del editor. <a href={enlace('escenario')}>Revisalo</a> o <a href={enlace('resultados')}>mirá un día con estos parámetros</a>.
        </p>
      ) : (
        <button type="button" className="boton boton-primario" onClick={alAplicar}>
          Aplicar al escenario <IconoFlecha tam={18} />
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 1 · escenario en JSON
function EscenarioJSON() {
  const { valido, borrador, errores } = useEstado();
  const [importado, setImportado] = useState<{ nombre: string; escenario: Escenario } | { nombre: string; errores: { donde: string; mensaje: string }[] } | null>(null);
  const [cargado, setCargado] = useState(false);
  const hayErroresEditor = errores.size > 0;

  const leer = (texto: string, nombre: string): void => {
    setCargado(false);
    let crudo: unknown;
    try {
      crudo = JSON.parse(texto);
    } catch (e) {
      setImportado({ nombre, errores: [{ donde: 'JSON', mensaje: `el archivo no es JSON válido (${e instanceof Error ? e.message : String(e)})` }] });
      return;
    }
    const r = EsquemaEscenario.safeParse(crudo);
    if (r.success) setImportado({ nombre, escenario: r.data });
    else
      setImportado({
        nombre,
        errores: r.error.issues.map((i) => ({
          donde: i.path.length ? i.path.map((x) => (typeof x === 'number' ? `[${x + 1}]` : String(x))).join(' › ') : 'escenario',
          mensaje: i.code === 'invalid_type' && /received undefined/.test(i.message) ? 'Falta este campo.' : mensajeError(i as Parameters<typeof mensajeError>[0]),
        })),
      });
  };

  const nombreArchivo = (valido.nombre || 'escenario').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <div className="datos-bloque">
      <div className="datos-acciones">
        <button type="button" className="boton boton-secundario" onClick={() => descargarTexto(`${nombreArchivo}.json`, JSON.stringify(valido, null, 2), 'application/json')}>
          <IconoDescargar tam={18} /> Exportar el escenario
        </button>
        <CargarArchivo etiqueta="Importar un escenario (.json)" aceptar=".json,application/json" alCargar={leer} />
      </div>
      <p className="parrafo">
        Exporta el último escenario válido del editor (<strong>{valido.nombre}</strong>, {valido.profesionales.length} profesionales){hayErroresEditor && borrador !== valido ? '; el borrador tiene errores y no se exporta' : ''}. Al importar se valida con el mismo esquema que usa el editor: si algo no cumple, se
        dice qué campo y por qué, y el escenario actual no se toca.
      </p>
      {importado && 'errores' in importado && <ListaErrores titulo={`${importado.nombre}: el escenario no es válido`} errores={importado.errores} />}
      {importado && 'escenario' in importado && (
        <div className="panel-aplicar">
          <p className="aviso-ok" role="status">
            <IconoValido tam={18} /> {importado.nombre}: escenario válido, «{importado.escenario.nombre}» con {importado.escenario.profesionales.length} profesionales.
          </p>
          {cargado ? (
            <p className="nota">
              Cargado en el editor. <a href={enlace('escenario')}>Ir al editor</a>.
            </p>
          ) : (
            <button
              type="button"
              className="boton boton-primario"
              onClick={() => {
                editarEscenario(() => importado.escenario);
                setCargado(true);
              }}
            >
              Cargar en el editor <IconoFlecha tam={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 2 · tiempos de atención
function Tiempos() {
  const { valido } = useEstado();
  const [datos, setDatos] = useState<{ origen: string; filas: TiempoMedido[] } | null>(null);
  const [errores, setErrores] = useState<{ origen: string; errores: ErrorCSV[] } | null>(null);
  const [grupo, setGrupo] = useState<string>('');
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [aplicada, setAplicada] = useState(false);

  const cargar = (texto: string, origen: string): void => {
    const r = leerTiempos(texto);
    setAplicada(false);
    setFamilia(null);
    if (r.ok) {
      setDatos({ origen, filas: r.filas });
      setErrores(null);
      setGrupo('');
    } else setErrores({ origen, errores: r.errores });
  };

  const grupos = useMemo(() => {
    if (!datos) return [];
    const m = new Map<string, { profesional: string; tipo: TipoPaciente; xs: number[] }>();
    for (const f of datos.filas) {
      const k = `${f.profesional}|${f.tipo}`;
      if (!m.has(k)) m.set(k, { profesional: f.profesional, tipo: f.tipo, xs: [] });
      m.get(k)!.xs.push(f.duracion);
    }
    return [...m.entries()].map(([clave, g]) => ({ clave, ...g })).sort((a, b) => a.profesional.localeCompare(b.profesional) || TIPOS_PACIENTE.indexOf(a.tipo) - TIPOS_PACIENTE.indexOf(b.tipo));
  }, [datos]);
  const elegido = grupos.find((g) => g.clave === grupo) ?? grupos.reduce<(typeof grupos)[number] | undefined>((m, g) => (!m || g.xs.length > m.xs.length ? g : m), undefined);
  const filas = useMemo(() => (elegido && elegido.xs.length >= 5 ? compararAjustes(elegido.xs) : null), [elegido]);
  const mejor = filas ? mejorPorAIC(filas) : 'lognormal';
  const fam = familia ?? mejor;
  const aplicacion = useMemo(() => (datos ? aplicarTiempos(valido, datos.filas, fam) : null), [datos, valido, fam]);
  const nombreProf = (id: string) => valido.profesionales.find((p) => p.id === id)?.nombre ?? id;

  return (
    <div className="datos-bloque">
      <div className="datos-acciones">
        <CargarArchivo etiqueta="Subir un CSV de tiempos" aceptar=".csv,text/csv,text/plain" alCargar={cargar} />
        <button type="button" className="boton boton-secundario" onClick={() => cargar(tiemposACSV(generarTiempos(valido)), `ejemplo (semilla ${SEMILLA_EJEMPLO})`)}>
          Usar datos de ejemplo
        </button>
        <button type="button" className="boton boton-fantasma" onClick={() => descargarTexto('plantilla-tiempos.csv', PLANTILLA_TIEMPOS)}>
          <IconoDescargar tam={18} /> Plantilla
        </button>
        <button type="button" className="boton boton-fantasma" onClick={() => descargarTexto('ejemplo-tiempos.csv', tiemposACSV(generarTiempos(valido)))}>
          <IconoDescargar tam={18} /> Ejemplo
        </button>
      </div>
      <p className="parrafo">
        Columnas: <code>profesional</code> (id o nombre del escenario), <code>tipo</code> ({TIPOS_PACIENTE.join(', ')}) y <code>duracion_min</code>. Los datos de ejemplo son ficticios: se generan con el escenario del editor (factor × D × lognormal de cv {decimal(valido.pacientes.atencion.cv, 2)}) y la semilla{' '}
        {SEMILLA_EJEMPLO}, así que el ajuste tiene que recuperar esos parámetros.
      </p>
      {errores && <ListaErrores titulo={`${errores.origen}: el CSV tiene errores`} errores={erroresCSV(errores.errores)} />}
      {datos && elegido && (
        <>
          <div className="controles-dinamica">
            <label className="campo campo-ancho">
              <span>Grupo a analizar</span>
              <select value={elegido.clave} onChange={(e) => setGrupo(e.target.value)}>
                {grupos.map((g) => (
                  <option key={g.clave} value={g.clave}>
                    {nombreProf(g.profesional)} · {NOMBRES_TIPO[g.tipo]} (n = {g.xs.length})
                  </option>
                ))}
              </select>
            </label>
            <Segmentado<Familia> etiqueta="Familia para el QQ y para aplicar" valor={fam} opciones={FAMILIAS.map((f) => ({ valor: f, texto: `${NOMBRES_FAMILIA[f]}${f === mejor ? ' ★' : ''}` }))} alCambiar={setFamilia} />
          </div>
          <p className="nota">
            {datos.origen}: {entero(datos.filas.length)} duraciones en {grupos.length} grupos. ★ = menor AIC en el grupo elegido.
          </p>
          {!filas && <p className="nota">El grupo tiene menos de 5 datos: no alcanza para ajustar.</p>}
          {filas && (
            <>
              <TablaDatos
                titulo={`Ajustes: ${nombreProf(elegido.profesional)} · ${NOMBRES_TIPO[elegido.tipo]}`}
                cabecera={['Familia', 'Parámetros (MV ± EE)', 'Media [min]', 'cv', 'AIC', 'KS: D', 'KS: p', 'χ²', 'gl', 'χ²: p']}
                derecha={[2, 3, 4, 5, 6, 7, 8, 9]}
                filas={filas.map((f) => [
                  `${NOMBRES_FAMILIA[f.ajuste.familia]}${f.ajuste.familia === mejor ? ' ★' : ''}`,
                  f.ajuste.parametros.map((x) => (Number.isNaN(x.ee) ? `${x.nombre} = ${entero(x.valor)}` : `${x.nombre} = ${decimal(x.valor, 3)} ± ${decimal(x.ee, 3)}`)).join('; '),
                  decimal(f.ajuste.media, 2),
                  decimal(f.ajuste.cv, 3),
                  decimal(f.ajuste.aic, 1),
                  f.ks ? decimal(f.ks.D, 3) : '—',
                  f.ks ? valorP(f.ks.p) : '—',
                  f.chi2 ? decimal(f.chi2.estadistico, 2) : '—',
                  f.chi2 ? f.chi2.gl : '—',
                  f.chi2 ? valorP(f.chi2.p) : '—',
                ])}
                destacadas={filas.map((f, i) => (f.ajuste.familia === fam ? i : -1)).filter((i) => i >= 0)}
                csv={{
                  nombre: 'ajustes-tiempos.csv',
                  contenido: aCSV(
                    ['familia', 'parametros', 'media', 'cv', 'logL', 'aic', 'ks_D', 'ks_p', 'chi2', 'gl', 'chi2_p'],
                    filas.map((f) => [f.ajuste.familia, f.ajuste.parametros.map((x) => `${x.nombre}=${x.valor}`).join(' '), f.ajuste.media, f.ajuste.cv, f.ajuste.logVerosimilitud, f.ajuste.aic, f.ks?.D ?? '', f.ks?.p ?? '', f.chi2?.estadistico ?? '', f.chi2?.gl ?? '', f.chi2?.p ?? '']),
                  ),
                }}
                nota={`KS: valor p asintótico de Kolmogorov (con parámetros estimados es conservador, Lilliefors); crítico al 5 %: ${decimal(1.358 / Math.sqrt(elegido.xs.length), 3)}. χ²: ${filas[0]!.chi2!.clases.length} clases equiprobables bajo cada ajuste (2·n^0,4, con al menos 5 esperadas por clase); gl = clases − 1 − parámetros. La empírica reproduce los datos al minuto: no se le aplican pruebas.`}
              />
              <div className="figuras-par">
                <Figura numero={1} titulo="Histograma y densidades ajustadas" descripcion="Histograma en escala de densidad (ancho de clase de Freedman-Diaconis)." opcion={opcionHistograma(elegido.xs, filas.map((f) => f.ajuste))} alto={300} archivo="datos-fig1-histograma" resumen={`Ajustes sobre ${elegido.xs.length} duraciones.`} />
                <Figura numero={2} titulo={`Gráfico QQ: ${NOMBRES_FAMILIA[fam].toLowerCase()}`} descripcion="Cuantiles observados contra los de la familia ajustada; cerca de la diagonal = buen ajuste." opcion={opcionQQ(elegido.xs, filas.find((f) => f.ajuste.familia === fam)!.ajuste)} alto={300} archivo="datos-fig2-qq" resumen={`QQ de la ${NOMBRES_FAMILIA[fam].toLowerCase()}.`} />
              </div>
            </>
          )}
          {aplicacion && (
            <>
              <p className="parrafo">
                Para aplicar se usan <strong>todos los grupos</strong>: cada duración se divide por la D de su profesional y se ajusta la familia elegida por tipo de paciente (factor = media de duración / D); el cv es el promedio de los cv ajustados, ponderado por n.
              </p>
              <PanelAplicar
                aplicacion={aplicacion}
                aplicada={aplicada}
                alAplicar={() => {
                  editarEscenario(() => aplicacion.escenario);
                  setAplicada(true);
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

const valorP = (p: number): string => (Number.isNaN(p) ? '—' : p < 0.001 ? '< 0,001' : decimal(p, 3));

// ------------------------------------------------------------------ 3 · asistencia
function Asistencia() {
  const { valido } = useEstado();
  const [datos, setDatos] = useState<{ origen: string; filas: Observacion[] } | null>(null);
  const [errores, setErrores] = useState<{ origen: string; errores: ErrorCSV[] } | null>(null);
  const [aplicada, setAplicada] = useState(false);
  const cargar = (texto: string, origen: string): void => {
    const r = leerAsistencia(texto);
    setAplicada(false);
    if (r.ok) {
      setDatos({ origen, filas: r.filas });
      setErrores(null);
    } else setErrores({ origen, errores: r.errores });
  };
  const ajuste = useMemo((): { r: ResultadoLogistica; tramos: Tramo[] } | { error: string } | null => {
    if (!datos) return null;
    try {
      return { r: regresionLogistica(datos.filas), tramos: proporcionesPorTramo(datos.filas) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [datos]);

  return (
    <div className="datos-bloque">
      <div className="datos-acciones">
        <CargarArchivo etiqueta="Subir un CSV de asistencia" aceptar=".csv,text/csv,text/plain" alCargar={cargar} />
        <button type="button" className="boton boton-secundario" onClick={() => cargar(asistenciaACSV(generarAsistencia(valido)), `ejemplo (semilla ${SEMILLA_EJEMPLO})`)}>
          Usar datos de ejemplo
        </button>
        <button type="button" className="boton boton-fantasma" onClick={() => descargarTexto('plantilla-asistencia.csv', PLANTILLA_ASISTENCIA)}>
          <IconoDescargar tam={18} /> Plantilla
        </button>
        <button type="button" className="boton boton-fantasma" onClick={() => descargarTexto('ejemplo-asistencia.csv', asistenciaACSV(generarAsistencia(valido)))}>
          <IconoDescargar tam={18} /> Ejemplo
        </button>
      </div>
      <p className="parrafo">
        Columnas: <code>anticipacion_dias</code> y <code>asistio</code> (1 = vino, 0 = faltó). Modelo: P(falta | d) = 1 / (1 + e^−(β₀ + β₁·d)), estimado por máxima verosimilitud con Newton-Raphson. El ejemplo tiene 3.000 turnos generados con la tabla de anticipación
        del escenario y β₀ = {decimal(valido.ausentismo.beta0, 3)}, β₁ = {decimal(valido.ausentismo.beta1, 3)}.
      </p>
      {errores && <ListaErrores titulo={`${errores.origen}: el CSV tiene errores`} errores={erroresCSV(errores.errores)} />}
      {ajuste && 'error' in ajuste && <ListaErrores titulo="No se puede estimar" errores={[{ donde: 'Datos', mensaje: ajuste.error }]} />}
      {datos && ajuste && 'r' in ajuste && (
        <>
          <div className="figuras-par">
            <TablaDatos
              titulo="Regresión logística"
              cabecera={['Coeficiente', 'Estimado', 'EE', 'IC 95 %', 'Escenario actual']}
              derecha={[1, 2, 3, 4]}
              filas={[
                ['β₀', decimal(ajuste.r.beta0, 3), decimal(ajuste.r.ee0, 3), `[${decimal(ajuste.r.beta0 - 1.96 * ajuste.r.ee0, 3)}; ${decimal(ajuste.r.beta0 + 1.96 * ajuste.r.ee0, 3)}]`, decimal(valido.ausentismo.beta0, 3)],
                ['β₁ [1/día]', decimal(ajuste.r.beta1, 3), decimal(ajuste.r.ee1, 3), `[${decimal(ajuste.r.beta1 - 1.96 * ajuste.r.ee1, 3)}; ${decimal(ajuste.r.beta1 + 1.96 * ajuste.r.ee1, 3)}]`, decimal(valido.ausentismo.beta1, 3)],
              ]}
              csv={{ nombre: 'logistica.csv', contenido: aCSV(['coeficiente', 'estimado', 'ee', 'escenario'], [['beta0', ajuste.r.beta0, ajuste.r.ee0, valido.ausentismo.beta0], ['beta1', ajuste.r.beta1, ajuste.r.ee1, valido.ausentismo.beta1]]) }}
              nota={`${datos.origen}: ${entero(ajuste.r.n)} turnos, ${entero(ajuste.r.faltas)} faltas (${porcentaje(ajuste.r.faltas / ajuste.r.n)}). ${ajuste.r.convergio ? `Newton convergió en ${ajuste.r.iteraciones} iteraciones` : 'Newton no convergió'}; log-verosimilitud ${decimal(ajuste.r.logVerosimilitud, 1)}. EE de la inversa de la información (XᵀWX)⁻¹.`}
            />
            <Figura
              numero={3}
              titulo="Faltas según la anticipación"
              descripcion="Proporción observada por anticipación (IC 95 % de Wilson), curva estimada y la del escenario."
              opcion={opcionLogistica(ajuste.tramos, ajuste.r, valido.ausentismo)}
              alto={300}
              archivo="datos-fig3-logistica"
              resumen={ajuste.tramos.map((t) => `${decimal(t.anticipacion, 1)} días: ${porcentaje(t.proporcion)}`).join('; ')}
            />
          </div>
          <PanelAplicar
            aplicacion={aplicarAusentismo(valido, ajuste.r)}
            aplicada={aplicada}
            alAplicar={() => {
              editarEscenario(() => aplicarAusentismo(valido, ajuste.r).escenario);
              setAplicada(true);
            }}
          />
        </>
      )}
    </div>
  );
}

export default function Datos() {
  return (
    <div className="pagina pagina-datos">
      <header className="cabeza-pagina">
        <div>
          <h1 className="titulo-pagina">Datos</h1>
          <p className="bajada">Del consultorio real al modelo: el escenario en JSON, los tiempos de atención medidos y el historial de asistencia, ajustados y validados en el navegador.</p>
          <p className="marca-supuestos">Sin servidor · los archivos no salen de tu computadora</p>
        </div>
      </header>
      <Seccion id="escenario-json" numero={1} titulo="Escenario" bajada="Guardar el escenario del editor como JSON o cargar uno, con validación campo por campo.">
        <EscenarioJSON />
      </Seccion>
      <Seccion id="tiempos" numero={2} titulo="Tiempos de atención" bajada="Ajuste por máxima verosimilitud a lognormal, gamma y exponencial, más la empírica discreta; bondad de ajuste con Kolmogorov-Smirnov y χ².">
        <Tiempos />
      </Seccion>
      <Seccion id="asistencia" numero={3} titulo="Asistencia" bajada="Regresión logística del ausentismo según los días de anticipación del turno.">
        <Asistencia />
      </Seccion>
      <Seccion id="reporte-enlace" numero={4} titulo="Reporte" bajada="Una hoja con el escenario, el día simulado y el último laboratorio, lista para imprimir o guardar como PDF.">
        <div className="datos-acciones">
          <a className="boton boton-primario" href={enlace('reporte')}>
            Abrir el reporte imprimible <IconoFlecha tam={18} />
          </a>
        </div>
      </Seccion>
    </div>
  );
}
