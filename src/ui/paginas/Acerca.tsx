/** Acerca de: el proyecto, los temas de la materia, la metodología, la validación y la autoría. */
import { SITIO } from '../app/config';
import { enlace } from '../app/rutas';
import { IconoExterno, IconoFlecha } from '../componentes/Iconos';

const TEMAS: [string, string][] = [
  ['Números pseudoaleatorios', 'Generador xoshiro128** sembrado con splitmix32 y un flujo independiente por fuente de aleatoriedad (llegadas, ausentismo, puntualidad, atención…), para reproducir cualquier día con su semilla.'],
  ['Variables aleatorias', 'Transformada inversa para exponencial, triangular, normal truncada, lognormal y tablas empíricas; cada muestra consume un solo uniforme. Llegadas espontáneas como proceso de Poisson no homogéneo (thinning).'],
  ['Simulación de eventos discretos', 'Lista de eventos en un montículo binario, recursos con cola FIFO o con prioridad y una traza completa de cada evento: es la que reproduce la animación.'],
  ['Teoría de colas', 'Validación contra M/M/c (Erlang C), M/G/1 (Pollaczek-Khinchine), la red en serie admisión → consultorio y la Ley de Little.'],
  ['Monte Carlo', 'Réplicas independientes, intervalos de confianza con t de Student, comparaciones pareadas y números aleatorios comunes gracias al pre-muestreo por identidad del paciente.'],
  ['Validación y calibración', 'Metas fijadas antes de calibrar, semillas separadas para explorar y verificar, y tres iteraciones de validación documentadas.'],
  ['Dinámica de sistemas', 'La misma jornada vista como stocks y flujos (paso #5).'],
];

export function Acerca() {
  return (
    <div className="pagina pagina-lectura">
      <h1 className="titulo-pagina">Acerca de</h1>
      <p className="bajada">
        Proyecto integrador de Simulación (UTN Facultad Regional San Rafael, 2026): un policonsultorio simulado para decidir cuántos sobreturnos dar y dónde ubicarlos en la agenda.
      </p>

      <section className="seccion-lectura">
        <h2 className="subtitulo">El problema</h2>
        <p className="parrafo">
          En un consultorio con agenda, una parte de los pacientes no viene. Cada ausencia es tiempo del médico que no se factura. Dar sobreturnos recupera ese tiempo, pero cuando todos vienen la sala se llena, la espera crece y el médico termina en horas extra. El
          simulador reproduce el día completo (turnos, ausentismo, puntualidad, demanda espontánea, admisión, sala y consultorios) y compara agendas con el mismo conjunto de pacientes.
        </p>
        <p className="parrafo">
          El criterio de decisión es el <strong>beneficio neto esperado</strong> B = ingresos − costo de espera − costo de horas extra − costo de pacientes perdidos. El costo clásico C, que suma el ocio del médico, se muestra como contraste.
        </p>
      </section>

      <section className="seccion-lectura">
        <h2 className="subtitulo">Temas de la materia aplicados</h2>
        <dl className="temas">
          {TEMAS.map(([t, d]) => (
            <div key={t}>
              <dt>{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="seccion-lectura">
        <h2 className="subtitulo">Metodología y validación</h2>
        <p className="parrafo">
          Primero el modelo conceptual, después un motor de eventos discretos validado contra resultados teóricos, después el modelo del consultorio con sus propias validaciones (caso determinista, M/G/1, red en serie, conservación y Little, casos límite) y por último
          la calibración de los escenarios contra metas fijadas a priori. La página de diagnóstico corre la validación del motor en vivo, en un Web Worker.
        </p>
        <a className="boton boton-secundario" href={enlace('diagnostico')}>
          Abrir el diagnóstico del motor <IconoFlecha tam={18} />
        </a>
      </section>

      <section className="seccion-lectura">
        <h2 className="subtitulo">Limitaciones</h2>
        <ul className="lista-señal">
          <li>Todos los datos son ficticios y están marcados como supuestos hasta que se importen datos reales.</li>
          <li>El abandono de los espontáneos queda en 14–27 % según el escenario, por encima de la meta de 5 %; está documentado como limitación del modelo.</li>
          <li>Los escenarios predefinidos quedaron congelados después de la tercera iteración de calibración.</li>
        </ul>
      </section>

      <section className="seccion-lectura autoria">
        <h2 className="subtitulo">Autoría</h2>
        <p className="parrafo">
          <strong>{SITIO.autoria}</strong>
          <br />
          {SITIO.institucion}
        </p>
        <a className="enlace-externo" href={SITIO.repositorio} target="_blank" rel="noreferrer">
          Código fuente en GitHub <IconoExterno tam={16} />
        </a>
        <div className="credito-grande">
          <img src={SITIO.estudio.isotipo} alt={`Isotipo de ${SITIO.estudio.nombre}`} width={64} height={64} />
          <p>
            Diseño y desarrollo <strong>{SITIO.estudio.nombre}</strong>
          </p>
        </div>
      </section>
    </div>
  );
}
