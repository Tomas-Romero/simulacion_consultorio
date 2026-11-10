/** Inicio: el problema en una frase, la planta funcionando y los tres escenarios como placas. */
import { useEffect, useMemo } from 'react';
import { NOMBRES_ESPECIALIDAD } from '../../modelo';
import { cargarPreset, escenarioComparado, IDS_PRESET, PRESETS_APP, type IdPreset } from '../app/estado';
import { enlace, navegar } from '../app/rutas';
import { prepararAnimacion } from '../animacion/preparar';
import { Reproductor, useReproductor } from '../animacion/reproductor';
import { IconoFlecha } from '../componentes/Iconos';
import { NOMBRES_CLASE, Pictograma } from '../componentes/Pictograma';
import { PlanoCanvas } from '../componentes/PlanoCanvas';
import { hora } from '../formato';
import { useCorrida } from '../simulacion/cliente';

const MINIATURA = escenarioComparado(PRESETS_APP.policonsultorio.escenario, { k: 3, politica: 'intercalado' });
const SEMILLA_MINIATURA = 2026;

function Miniatura() {
  const corrida = useCorrida(MINIATURA, SEMILLA_MINIATURA);
  const datos = useMemo(() => (corrida.estado === 'listo' ? prepararAnimacion(corrida.resultado) : null), [corrida]);
  const rep = useMemo(() => (datos ? new Reproductor(datos.tInicio, datos.tFin, 9 * 60 + 40, 240) : null), [datos]);

  useEffect(() => {
    if (!rep) return;
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!quieto) rep.reproducir();
    // Al terminar el día vuelve a empezar.
    const quitar = rep.suscribir(() => {
      const e = rep.instantanea;
      if (!e.reproduciendo && e.t >= e.tFin && !quieto) {
        rep.ir(e.tInicio);
        rep.reproducir();
      }
    });
    return () => {
      quitar();
      rep.destruir();
    };
  }, [rep]);

  return (
    <figure className="miniatura">
      {datos && rep ? (
        <>
          <PlanoCanvas datos={datos} reproductor={rep} modo="mini" etiqueta="Planta del policonsultorio con los pacientes del día en movimiento" />
          <PieMiniatura rep={rep} />
        </>
      ) : (
        <div className="plano plano-esqueleto" role="status" aria-label="Simulando el día…" />
      )}
    </figure>
  );
}

function PieMiniatura({ rep }: { rep: Reproductor }) {
  const e = useReproductor(rep);
  return (
    <figcaption>
      <span className="en-vivo" aria-hidden="true" />
      <span className="num">{hora(e.t)}</span> · Policonsultorio, 3 sobreturnos por médico, semilla {SEMILLA_MINIATURA}
    </figcaption>
  );
}

function usarPreset(id: IdPreset): void {
  cargarPreset(id);
  navegar('simulacion');
}

export function Inicio() {
  return (
    <div className="pagina pagina-inicio">
      <section className="portada">
        <div className="portada-texto">
          <h1 className="titulo-portada">¿Cuántos sobreturnos conviene dar?</h1>
          <p className="portada-bajada">
            En la agenda de un consultorio, uno de cada siete pacientes no viene. Sobrerreservar recupera esas horas, pero cuando vienen todos la sala se llena y el médico termina en horas extra. Este simulador reproduce el día minuto a minuto y busca el punto en que
            el beneficio neto deja de crecer.
          </p>
          <div className="portada-acciones">
            <button type="button" className="boton boton-primario boton-grande" onClick={() => usarPreset('policonsultorio')}>
              Ver un día del policonsultorio <IconoFlecha tam={18} />
            </button>
            <a className="boton boton-fantasma boton-grande" href={enlace('escenario')}>
              Armar mi escenario
            </a>
          </div>
          <ul className="leyenda-clases" aria-label="Clases de paciente">
            {(['turno', 'sobreturno', 'tardio', 'espontaneo', 'urgencia'] as const).map((c) => (
              <li key={c}>
                <Pictograma clase={c} placa /> {NOMBRES_CLASE[c]}
              </li>
            ))}
          </ul>
        </div>
        <Miniatura />
      </section>

      <section className="presets" aria-labelledby="titulo-presets">
        <h2 id="titulo-presets" className="subtitulo-grande presets-titulo">
          Tres escenarios para empezar
        </h2>
        <div className="presets-grilla">
          {IDS_PRESET.map((id) => {
            const p = PRESETS_APP[id];
            const e = p.escenario;
            const especialidades = [...new Set(e.profesionales.map((x) => NOMBRES_ESPECIALIDAD[x.especialidad]))];
            return (
              <article key={id} className="placa-preset">
                <div className="placa-numero" aria-hidden="true">
                  {p.numero}
                </div>
                <div className="placa-cuerpo">
                  <h3>{p.corto}</h3>
                  <p className="placa-detalle" title={e.descripcion}>
                    {e.profesionales.length === 1 ? '1 profesional' : `${e.profesionales.length} profesionales`} · {especialidades.join(', ')}
                  </p>
                  <button type="button" className="boton boton-primario" onClick={() => usarPreset(id)}>
                    Usar este escenario <IconoFlecha tam={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="recorrido" aria-label="Cómo se usa">
        <h2 className="visualmente-oculto">Cómo se usa</h2>
        <ol>
          <li>
            <strong>Elegí un escenario</strong>
            <span>Un preset o el tuyo: profesionales, ausentismo, demanda espontánea, costos.</span>
          </li>
          <li>
            <strong>Mirá el día</strong>
            <span>Los pacientes llegan, esperan, faltan o abandonan; la animación reproduce la traza del modelo.</span>
          </li>
          <li>
            <strong>Compará con la misma semilla</strong>
            <span>Sin sobreturnos y con sobreturnos, mismos pacientes, lado a lado: la diferencia es la decisión.</span>
          </li>
        </ol>
      </section>

      <section className="hallazgo">
        <h2 className="subtitulo-grande">Lo que muestra el modelo hasta ahora</h2>
        <p className="parrafo">
          En el barrido de control del policonsultorio (1000 días, números aleatorios comunes), el beneficio neto crece con los primeros sobreturnos y se aplana entre 2 y 3 por médico; con más, la espera y las horas extra se comen lo que se recupera. Los experimentos del
          paso #4 lo van a decidir con más réplicas y comparando las cuatro políticas de ubicación.
        </p>
        <a className="boton boton-fantasma" href={enlace('acerca')}>
          Metodología y validación <IconoFlecha tam={18} />
        </a>
      </section>
    </div>
  );
}
