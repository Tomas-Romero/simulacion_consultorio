/**
 * Editor del escenario. Valida en vivo con EsquemaEscenario (zod) y muestra los errores junto al
 * campo. La simulación usa siempre el último escenario válido. Se guarda solo en este navegador.
 */
import {
  costoExtra,
  costoOcio,
  ESPECIALIDADES,
  NOMBRES_ESPECIALIDAD,
  POLITICAS_SOBRETURNO,
  probabilidadNoShow,
  type DistribucionTiempo,
  type Escenario as TipoEscenario,
  type PoliticaSobreturno,
  type Profesional,
} from '../../modelo';
import { cargarPreset, editarEscenario, IDS_PRESET, NOMBRES_POLITICA, PRESETS_APP, setSemilla, useEstado, type IdPreset } from '../app/estado';
import { enlace } from '../app/rutas';
import { CampoCasilla, CampoNumero, CampoSelect, CampoTexto, Segmentado } from '../componentes/Campos';
import { IconoAviso, IconoFlecha, IconoMas, IconoQuitar, IconoReiniciar, IconoValido } from '../componentes/Iconos';
import { MiniLogistica, MiniPerfil } from '../componentes/MiniGraficos';
import { decimal, hora, pesos, porcentaje } from '../formato';

const SECCIONES = [
  ['profesionales', 'Profesionales'],
  ['pacientes', 'Pacientes'],
  ['ausentismo', 'Ausentismo'],
  ['espontaneos', 'Espontáneos'],
  ['admision', 'Admisión'],
  ['sobreturnos', 'Sobreturnos'],
  ['costos', 'Costos'],
] as const;

type Cambio = (e: TipoEscenario) => TipoEscenario;
const editarProf = (i: number, cambio: (p: Profesional) => Profesional): void =>
  editarEscenario((e) => ({ ...e, profesionales: e.profesionales.map((p, j) => (j === i ? cambio(p) : p)) }));

function Seccion({ id, titulo, bajada, children, accion }: { id: string; titulo: string; bajada?: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section id={id} className="seccion-editor" aria-labelledby={`t-${id}`}>
      <header className="seccion-editor-cabeza">
        <div>
          <h2 id={`t-${id}`} className="subtitulo">
            {titulo}
          </h2>
          {bajada && <p className="seccion-bajada">{bajada}</p>}
        </div>
        {accion}
      </header>
      {children}
    </section>
  );
}

/** Edita una distribución de tiempo según su tipo (solo los campos de ese tipo). */
function CamposDistribucion({ d, ruta, errores, alCambiar, unidad = 'min' }: { d: DistribucionTiempo; ruta: string; errores: ReadonlyMap<string, string>; alCambiar: (d: DistribucionTiempo) => void; unidad?: string }) {
  const err = (k: string): string | undefined => errores.get(`${ruta}.${k}`);
  switch (d.tipo) {
    case 'triangular':
      return (
        <div className="fila-campos">
          <CampoNumero etiqueta="Mínimo" sufijo={unidad} valor={d.min} error={err('min')} alCambiar={(v) => alCambiar({ ...d, min: v })} />
          <CampoNumero etiqueta="Moda" sufijo={unidad} valor={d.moda} error={err('moda')} alCambiar={(v) => alCambiar({ ...d, moda: v })} />
          <CampoNumero etiqueta="Máximo" sufijo={unidad} valor={d.max} error={err('max')} alCambiar={(v) => alCambiar({ ...d, max: v })} />
        </div>
      );
    case 'normal_truncada':
      return (
        <div className="fila-campos">
          <CampoNumero etiqueta="Media" sufijo={unidad} valor={d.media} error={err('media')} alCambiar={(v) => alCambiar({ ...d, media: v })} ayuda="Negativo = llega antes" />
          <CampoNumero etiqueta="Desvío" sufijo={unidad} valor={d.desvio} error={err('desvio')} alCambiar={(v) => alCambiar({ ...d, desvio: v })} />
        </div>
      );
    case 'lognormal':
      return (
        <div className="fila-campos">
          <CampoNumero etiqueta="Media" sufijo={unidad} valor={d.media} error={err('media')} alCambiar={(v) => alCambiar({ ...d, media: v })} />
          <CampoNumero etiqueta="Coeficiente de variación" valor={d.cv} paso={0.05} error={err('cv')} alCambiar={(v) => alCambiar({ ...d, cv: v })} />
        </div>
      );
    case 'exponencial':
      return <CampoNumero etiqueta="Media" sufijo={unidad} valor={d.media} error={err('media')} alCambiar={(v) => alCambiar({ ...d, media: v })} />;
    case 'uniforme':
      return (
        <div className="fila-campos">
          <CampoNumero etiqueta="Mínimo" sufijo={unidad} valor={d.min} error={err('min')} alCambiar={(v) => alCambiar({ ...d, min: v })} />
          <CampoNumero etiqueta="Máximo" sufijo={unidad} valor={d.max} error={err('max')} alCambiar={(v) => alCambiar({ ...d, max: v })} />
        </div>
      );
    case 'constante':
      return <CampoNumero etiqueta="Valor" sufijo={unidad} valor={d.valor} error={err('valor')} alCambiar={(v) => alCambiar({ ...d, valor: v })} />;
  }
}

/** c_ocio y c_extra salen siempre del último escenario válido (el que se simula), nunca de un borrador inválido. */
function costosDerivados(v: TipoEscenario, i: number): { ocio: number; extra: number } {
  const p = v.profesionales[i];
  if (!p) return { ocio: Number.NaN, extra: Number.NaN };
  return { ocio: costoOcio(v, p), extra: costoExtra(v, p) };
}

function TarjetaProfesional({ p, i, e, v, desactualizado, errores, total }: { p: Profesional; i: number; e: TipoEscenario; v: TipoEscenario; desactualizado: boolean; errores: ReadonlyMap<string, string>; total: number }) {
  const err = (k: string): string | undefined => errores.get(`profesionales.${i}.${k}`);
  const { ocio, extra } = costosDerivados(v, i);
  const n = Math.floor((p.turno === 'manana' ? e.jornada.cambioTurno - e.jornada.inicio : e.jornada.fin - e.jornada.cambioTurno) / p.duracionTurno);
  const cupos = p.cuposEspontaneos.cadaN > 0 ? Math.floor((n - Math.floor(p.cuposEspontaneos.cadaN / 2) - 1) / p.cuposEspontaneos.cadaN) + 1 : 0;
  return (
    <article className="tarjeta-prof">
      <header className="tarjeta-prof-cabeza">
        <span className="placa-mini" aria-hidden="true">
          {i + 1}
        </span>
        <CampoTexto etiqueta={`Nombre del consultorio ${i + 1}`} className="campo-nombre" valor={p.nombre} alCambiar={(v) => editarProf(i, (q) => ({ ...q, nombre: v }))} />
        <button
          type="button"
          className="boton-icono"
          disabled={total <= 1}
          aria-label={`Quitar el consultorio ${i + 1}`}
          title={total <= 1 ? 'Tiene que quedar al menos un profesional' : 'Quitar'}
          onClick={() => editarEscenario((x) => ({ ...x, profesionales: x.profesionales.filter((_, j) => j !== i) }))}
        >
          <IconoQuitar />
        </button>
      </header>
      <div className="tarjeta-prof-campos">
        <CampoSelect
          etiqueta="Especialidad"
          valor={p.especialidad}
          error={err('especialidad')}
          opciones={ESPECIALIDADES.map((x) => ({ valor: x, texto: NOMBRES_ESPECIALIDAD[x] }))}
          alCambiar={(v) => editarProf(i, (q) => ({ ...q, especialidad: v }))}
        />
        <CampoSelect
          etiqueta="Turno"
          valor={p.turno}
          opciones={[
            { valor: 'manana', texto: 'Mañana' },
            { valor: 'tarde', texto: 'Tarde' },
          ]}
          alCambiar={(v) => editarProf(i, (q) => ({ ...q, turno: v }))}
          ayuda={p.turno === 'manana' ? `${hora(e.jornada.inicio)} a ${hora(e.jornada.cambioTurno)}` : `${hora(e.jornada.cambioTurno)} a ${hora(e.jornada.fin)}`}
        />
        <CampoSelect
          etiqueta="Turno de agenda"
          valor={p.duracionTurno}
          opciones={[15, 20, 30].map((d) => ({ valor: d as 15 | 20 | 30, texto: `${d} min` }))}
          alCambiar={(v) => editarProf(i, (q) => ({ ...q, duracionTurno: v }))}
          ayuda={`${n} turnos en el día`}
        />
        <CampoNumero
          etiqueta="Cupos: 1 de cada"
          valor={p.cuposEspontaneos.cadaN}
          min={0}
          max={40}
          error={err('cuposEspontaneos.cadaN')}
          alCambiar={(v) => editarProf(i, (q) => ({ ...q, cuposEspontaneos: { cadaN: Number.isNaN(v) ? v : Math.round(v) } }))}
          ayuda={p.cuposEspontaneos.cadaN > 0 ? `${cupos} cupos por día` : '0 = sin cupos'}
        />
      </div>
      <dl className={`tarjeta-prof-costos${desactualizado ? ' desactualizado' : ''}`} title={desactualizado ? 'Valores del último escenario válido' : undefined}>
        <div>
          <dt>c_ocio</dt>
          <dd className="num">{Number.isFinite(ocio) ? `${pesos(ocio)}/min` : '—'}</dd>
        </div>
        <div>
          <dt>c_extra</dt>
          <dd className="num">{Number.isFinite(extra) ? `${pesos(extra)}/min` : '—'}</dd>
        </div>
      </dl>
    </article>
  );
}

export function Escenario() {
  const { borrador: e, valido: v, errores, erroresGenerales, semilla, preset } = useEstado();
  const err = (k: string): string | undefined => errores.get(k);
  const editar = (c: Cambio): void => editarEscenario(c);
  const valido = errores.size === 0 && erroresGenerales.length === 0;
  const ks = [...new Set(e.profesionales.map((p) => p.sobreturnos.k))];
  const pols = [...new Set(e.profesionales.map((p) => p.sobreturnos.politica))];
  const k = ks.length === 1 ? ks[0]! : Number.NaN;
  const pol = pols.length === 1 ? pols[0]! : 'intercalado';
  const marcas = e.pacientes.anticipacion.map((f) => ({ dias: f.valor, peso: f.frecuencia }));
  const totalFrec = marcas.reduce((s, m) => s + m.peso, 0);
  const ausEsperado = totalFrec > 0 ? marcas.reduce((s, m) => s + m.peso * probabilidadNoShow(e, m.dias), 0) / totalFrec : Number.NaN;
  const lambda = e.espontaneos.tasasPorHora.reduce((s, t) => s + (Number.isFinite(t) ? t : 0), 0);
  const ocioDerivado = e.costos.ocio === 'derivado';
  const extraDerivado = typeof e.costos.extra !== 'number';

  const agregar = (): void =>
    editar((x) => {
      const usados = new Set(x.profesionales.map((p) => p.id));
      let n = 1;
      while (usados.has(`P${n}`)) n++;
      const base = x.profesionales[x.profesionales.length - 1]!;
      return { ...x, profesionales: [...x.profesionales, { ...base, id: `P${n}`, nombre: `Consultorio ${x.profesionales.length + 1}` }] };
    });

  return (
    <div className="pagina pagina-editor">
      <header className="cabeza-pagina">
        <div>
          <h1 className="titulo-pagina">Escenario</h1>
          <p className="bajada">{preset ? `Preset: ${PRESETS_APP[preset].corto}` : 'Escenario personalizado'} · se guarda solo en este navegador</p>
          <p className="marca-supuestos">Datos ficticios · supuestos del modelo (docs/modelo-conceptual.md)</p>
        </div>
        <div className="cabeza-acciones">
          <CampoSelect<IdPreset | ''>
            etiqueta="Preset"
            valor={preset ?? ''}
            opciones={[...(preset ? [] : [{ valor: '' as const, texto: 'Personalizado' }]), ...IDS_PRESET.map((id) => ({ valor: id, texto: PRESETS_APP[id].corto }))]}
            alCambiar={(v) => v && cargarPreset(v)}
          />
          <CampoNumero etiqueta="Semilla" valor={semilla} min={0} alCambiar={(v) => Number.isInteger(v) && v >= 0 && setSemilla(v)} />
          <button type="button" className="boton boton-fantasma" onClick={() => cargarPreset(preset ?? 'policonsultorio')}>
            <IconoReiniciar tam={18} /> Restaurar preset
          </button>
        </div>
      </header>

      <div className={`estado-validacion ${valido ? 'ok' : 'mal'}`} role="status">
        {valido ? <IconoValido tam={18} /> : <IconoAviso tam={18} />}
        <span>
          {valido
            ? 'Escenario válido: la simulación usa estos valores.'
            : `Hay ${errores.size + erroresGenerales.length} ${errores.size + erroresGenerales.length === 1 ? 'campo para corregir' : 'campos para corregir'}. Mientras tanto se simula el último escenario válido.`}
          {erroresGenerales.map((m) => (
            <strong key={m}> {m}</strong>
          ))}
        </span>
        {!valido && errores.size > 0 && (
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => {
              const campo = document.querySelector<HTMLElement>('.campo.con-error');
              campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              campo?.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true });
            }}
          >
            Ir al campo
          </button>
        )}
        <a className="boton boton-primario" href={enlace('simulacion')}>
          Simular este escenario <IconoFlecha tam={18} />
        </a>
      </div>

      <div className="editor">
        <nav className="indice" aria-label="Secciones del escenario">
          {SECCIONES.map(([id, t]) => (
            <a key={id} href={`#/escenario`} onClick={(ev) => { ev.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              {t}
            </a>
          ))}
        </nav>

        <div className="editor-cuerpo">
          <Seccion
            id="profesionales"
            titulo={`Profesionales (${e.profesionales.length} de 6)`}
            bajada="Cada profesional tiene su consultorio, su turno y su agenda. Los cupos reservan slots para la demanda espontánea."
            accion={
              <button type="button" className="boton boton-secundario" onClick={agregar} disabled={e.profesionales.length >= 6}>
                <IconoMas tam={18} /> Agregar
              </button>
            }
          >
            <div className="grilla-prof">
              {e.profesionales.map((p, i) => (
                <TarjetaProfesional key={i} p={p} i={i} e={e} v={v} desactualizado={!valido} errores={errores} total={e.profesionales.length} />
              ))}
            </div>
          </Seccion>

          <Seccion id="pacientes" titulo="Pacientes con turno" bajada="Tipo de consulta y puntualidad.">
            <div className="fila-campos">
              <CampoNumero
                etiqueta="Primera vez"
                sufijo="%"
                escala={100}
                valor={e.pacientes.proporcionPrimeraVez}
                error={err('pacientes.proporcionPrimeraVez')}
                alCambiar={(v) => editar((x) => ({ ...x, pacientes: { ...x.pacientes, proporcionPrimeraVez: v } }))}
                ayuda="Duran 1,3 × el turno; los controles, 0,8 ×"
              />
              <CampoNumero
                etiqueta="Tolerancia"
                sufijo="min"
                valor={e.puntualidad.tolerancia}
                error={err('puntualidad.tolerancia')}
                alCambiar={(v) => editar((x) => ({ ...x, puntualidad: { ...x.puntualidad, tolerancia: v } }))}
                ayuda="Después de hora + tolerancia, es tardío"
              />
              <CampoSelect
                etiqueta="Tardíos"
                valor={e.puntualidad.politicaTardios}
                opciones={[
                  { valor: 'atender_si_libre', texto: 'Se atienden si hay lugar' },
                  { valor: 'pierde_turno', texto: 'Pierden el turno' },
                ]}
                alCambiar={(v) => editar((x) => ({ ...x, puntualidad: { ...x.puntualidad, politicaTardios: v } }))}
              />
            </div>
            <h3 className="subtitulo-chico">Puntualidad: llegada − hora del turno</h3>
            <CamposDistribucion d={e.puntualidad.desvio} ruta="puntualidad.desvio" errores={errores} alCambiar={(d) => editar((x) => ({ ...x, puntualidad: { ...x.puntualidad, desvio: d } }))} />
            <CampoCasilla
              etiqueta="Se puede atender antes de hora a quien llegó temprano"
              valor={e.puntualidad.adelantarTurnos}
              alCambiar={(v) => editar((x) => ({ ...x, puntualidad: { ...x.puntualidad, adelantarTurnos: v } }))}
            />
          </Seccion>

          <Seccion id="ausentismo" titulo="Ausentismo" bajada="La probabilidad de faltar crece con los días de anticipación del turno (logística).">
            <div className="fila-grafico">
              <div className="fila-campos columna">
                <CampoNumero etiqueta="β₀" paso={0.05} valor={e.ausentismo.beta0} error={err('ausentismo.beta0')} alCambiar={(v) => editar((x) => ({ ...x, ausentismo: { ...x.ausentismo, beta0: v } }))} />
                <CampoNumero etiqueta="β₁ (por día)" paso={0.005} valor={e.ausentismo.beta1} error={err('ausentismo.beta1')} alCambiar={(v) => editar((x) => ({ ...x, ausentismo: { ...x.ausentismo, beta1: v } }))} />
                <p className="dato-derivado">
                  Ausentismo esperado con la tabla de anticipación: <strong className="num">{porcentaje(ausEsperado)}</strong>
                </p>
              </div>
              <figure className="figura-mini">
                <MiniLogistica beta0={e.ausentismo.beta0} beta1={e.ausentismo.beta1} marcas={marcas} />
                <figcaption>P(no viene) según los días de anticipación. Barras: frecuencia de cada anticipación en la agenda.</figcaption>
              </figure>
            </div>
          </Seccion>

          <Seccion id="espontaneos" titulo="Demanda espontánea" bajada="Pacientes sin turno: llegan según un perfil por hora y pueden abandonar si esperan demasiado.">
            <div className="fila-grafico">
              <figure className="figura-mini">
                <MiniPerfil tasas={e.espontaneos.tasasPorHora} inicio={e.jornada.inicio} />
                <figcaption>
                  Llegadas por hora desde las {hora(e.jornada.inicio)}: <span className="num">{decimal(lambda)}</span> por día.
                </figcaption>
              </figure>
              <div className="tasas" role="group" aria-label="Llegadas por hora">
                {e.espontaneos.tasasPorHora.map((t, i) => (
                  <CampoNumero
                    key={i}
                    className="campo-tasa"
                    etiqueta={`${String(Math.floor(e.jornada.inicio / 60) + i).padStart(2, '0')} h`}
                    paso={0.1}
                    min={0}
                    valor={t}
                    error={err(`espontaneos.tasasPorHora.${i}`)}
                    alCambiar={(v) => editar((x) => ({ ...x, espontaneos: { ...x.espontaneos, tasasPorHora: x.espontaneos.tasasPorHora.map((y, j) => (j === i ? v : y)) } }))}
                  />
                ))}
              </div>
            </div>
            <div className="fila-campos">
              <CampoNumero
                etiqueta="Urgencias"
                sufijo="%"
                escala={100}
                valor={e.espontaneos.proporcionUrgencias}
                error={err('espontaneos.proporcionUrgencias')}
                alCambiar={(v) => editar((x) => ({ ...x, espontaneos: { ...x.espontaneos, proporcionUrgencias: v } }))}
                ayuda="Pasan primero y no abandonan"
              />
              <CampoNumero
                etiqueta="Cierre antes del fin"
                sufijo="min"
                valor={e.espontaneos.cierreAntesDelFin}
                error={err('espontaneos.cierreAntesDelFin')}
                alCambiar={(v) => editar((x) => ({ ...x, espontaneos: { ...x.espontaneos, cierreAntesDelFin: v } }))}
              />
            </div>
            <h3 className="subtitulo-chico">Paciencia en la sala</h3>
            <CamposDistribucion d={e.espontaneos.paciencia} ruta="espontaneos.paciencia" errores={errores} alCambiar={(d) => editar((x) => ({ ...x, espontaneos: { ...x.espontaneos, paciencia: d } }))} />
            <CampoCasilla
              etiqueta="Los espontáneos abandonan si se les agota la paciencia"
              valor={e.espontaneos.abandonan}
              alCambiar={(v) => editar((x) => ({ ...x, espontaneos: { ...x.espontaneos, abandonan: v } }))}
            />
          </Seccion>

          <Seccion id="admision" titulo="Admisión" bajada="Todos los que entran pasan por recepción; las urgencias tienen prioridad.">
            <div className="fila-campos">
              <CampoSelect
                etiqueta="Recepcionistas"
                valor={e.admision.recepcionistas}
                opciones={[
                  { valor: 1, texto: '1 recepcionista' },
                  { valor: 2, texto: '2 recepcionistas' },
                ]}
                alCambiar={(v) => editar((x) => ({ ...x, admision: { ...x.admision, recepcionistas: v } }))}
              />
            </div>
            <h3 className="subtitulo-chico">Tiempo de atención en admisión</h3>
            <CamposDistribucion d={e.admision.tiempo} ruta="admision.tiempo" errores={errores} alCambiar={(d) => editar((x) => ({ ...x, admision: { ...x.admision, tiempo: d } }))} />
          </Seccion>

          <Seccion id="sobreturnos" titulo="Sobreturnos" bajada="La variable de decisión: cuántos turnos extra se dan por profesional y dónde se ubican en la agenda.">
            <div className="fila-campos">
              <CampoNumero
                etiqueta="Sobreturnos por profesional (k)"
                valor={k}
                min={0}
                max={40}
                error={err('profesionales.0.sobreturnos.k')}
                ayuda={ks.length > 1 ? `Hoy son distintos por profesional (${ks.join(', ')}); al editar se iguala.` : 'Se aplica a todos los profesionales'}
                alCambiar={(v) => editar((x) => ({ ...x, profesionales: x.profesionales.map((p) => ({ ...p, sobreturnos: { ...p.sobreturnos, k: Number.isNaN(v) ? v : Math.round(v) } })) }))}
              />
            </div>
            <Segmentado<PoliticaSobreturno>
              etiqueta="Dónde se ubican"
              valor={pol}
              opciones={POLITICAS_SOBRETURNO.map((x) => ({ valor: x, texto: NOMBRES_POLITICA[x] }))}
              alCambiar={(v) => editar((x) => ({ ...x, profesionales: x.profesionales.map((p) => ({ ...p, sobreturnos: { ...p.sobreturnos, politica: v } })) }))}
            />
          </Seccion>

          <Seccion id="costos" titulo="Costos" bajada="B = ingresos − espera − extra − perdidos decide; C (suma el ocio) es el contraste.">
            <div className="fila-campos">
              <CampoNumero etiqueta="Honorario por consulta" sufijo="$" valor={e.costos.honorario} error={err('costos.honorario')} alCambiar={(v) => editar((x) => ({ ...x, costos: { ...x.costos, honorario: v } }))} />
              <CampoNumero etiqueta="Espera de un paciente" sufijo="$/min" valor={e.costos.espera} error={err('costos.espera')} alCambiar={(v) => editar((x) => ({ ...x, costos: { ...x.costos, espera: v } }))} />
              <CampoNumero etiqueta="Paciente perdido" sufijo="$" valor={e.costos.perdido} error={err('costos.perdido')} alCambiar={(v) => editar((x) => ({ ...x, costos: { ...x.costos, perdido: v } }))} />
            </div>
            <div className="fila-campos">
              <div className="campo-compuesto">
                <Segmentado<'derivado' | 'fijo'>
                  etiqueta="Ocio del médico (c_ocio)"
                  valor={ocioDerivado ? 'derivado' : 'fijo'}
                  opciones={[
                    { valor: 'derivado', texto: 'Derivado del honorario' },
                    { valor: 'fijo', texto: 'Valor fijo' },
                  ]}
                  alCambiar={(v) => editar((x) => ({ ...x, costos: { ...x.costos, ocio: v === 'derivado' ? 'derivado' : 2000 } }))}
                />
                {!ocioDerivado && typeof e.costos.ocio === 'number' && (
                  <CampoNumero etiqueta="c_ocio" sufijo="$/min" valor={e.costos.ocio} error={err('costos.ocio')} alCambiar={(v) => editar((x) => ({ ...x, costos: { ...x.costos, ocio: v } }))} />
                )}
              </div>
              <div className="campo-compuesto">
                <Segmentado<'derivado' | 'fijo'>
                  etiqueta="Hora extra (c_extra)"
                  valor={extraDerivado ? 'derivado' : 'fijo'}
                  opciones={[
                    { valor: 'derivado', texto: 'Factor × c_ocio' },
                    { valor: 'fijo', texto: 'Valor fijo' },
                  ]}
                  alCambiar={(v) => editar((x) => ({ ...x, costos: { ...x.costos, extra: v === 'derivado' ? { derivado: 1.5 } : 3000 } }))}
                />
                {typeof e.costos.extra === 'number' ? (
                  <CampoNumero etiqueta="c_extra" sufijo="$/min" valor={e.costos.extra} error={err('costos.extra')} alCambiar={(v) => editar((x) => ({ ...x, costos: { ...x.costos, extra: v } }))} />
                ) : (
                  <CampoNumero
                    etiqueta="Factor"
                    paso={0.1}
                    min={1}
                    max={5}
                    valor={e.costos.extra.derivado}
                    error={err('costos.extra.derivado') ?? err('costos.extra')}
                    ayuda="Coherencia: c_extra ≥ c_ocio, por eso el factor es ≥ 1"
                    alCambiar={(v) => editar((x) => ({ ...x, costos: { ...x.costos, extra: { derivado: v } } }))}
                  />
                )}
              </div>
            </div>
            <table className="tabla tabla-costos">
              <caption>
                Costos derivados por profesional
                {!valido && <span className="caption-nota"> · valores del último escenario válido, hasta corregir los campos marcados</span>}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Consultorio</th>
                  <th scope="col">Turno de agenda</th>
                  <th scope="col" className="der">
                    c_ocio
                  </th>
                  <th scope="col" className="der">
                    c_extra
                  </th>
                </tr>
              </thead>
              <tbody>
                {v.profesionales.map((p, i) => {
                  const { ocio: o, extra: x } = costosDerivados(v, i);
                  return (
                    <tr key={i}>
                      <td>
                        {i + 1} · {p.nombre}
                      </td>
                      <td>{p.duracionTurno} min</td>
                      <td className="der num">{Number.isFinite(o) ? `${pesos(o)}/min` : '—'}</td>
                      <td className="der num">{Number.isFinite(x) ? `${pesos(x)}/min` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Seccion>
        </div>
      </div>
    </div>
  );
}
