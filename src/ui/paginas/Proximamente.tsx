/** Pantallas de los pasos #4–#6: placa con el número del paso, qué va a contener y qué responde. */
import { enlace } from '../app/rutas';
import { IconoFlecha } from '../componentes/Iconos';

const CONTENIDO = {
  experimentos: {
    paso: '#4',
    titulo: 'Experimentos Monte Carlo',
    bajada: 'Cuántos sobreturnos dar y dónde, con intervalos de confianza.',
    preguntas: [
      '¿Qué k maximiza el beneficio neto B en cada preset? El barrido de control del policonsultorio deja empatados k = 2 y k = 3.',
      '¿Qué política de ubicación conviene: al inicio, intercalados, donde más se falta o al final?',
      '¿Cuánto cambia la recomendación si la hora extra cuesta entre 1 y 2 veces el costo de ocio?',
    ],
    metodo: 'Réplicas independientes en Web Workers, números aleatorios comunes entre escenarios, IC 95 % con t de Student y comparaciones pareadas.',
  },
  dinamica: {
    paso: '#5',
    titulo: 'Dinámica de sistemas',
    bajada: 'La misma jornada vista como stocks y flujos.',
    preguntas: [
      '¿Cómo se acumula la sala de espera cuando la llegada de pacientes supera la capacidad de atención?',
      '¿Qué bucles de realimentación explican el abandono y las horas extra?',
      '¿Qué tanto se parece la vista agregada a la simulación de eventos discretos?',
    ],
    metodo: 'Diagrama causal, modelo de stocks y flujos integrado numéricamente y comparación con el promedio de la simulación.',
  },
  datos: {
    paso: '#6',
    titulo: 'Datos, reportes e informe',
    bajada: 'Importar y exportar escenarios, descargar resultados y publicar.',
    preguntas: [
      'Importar un escenario en JSON, validado con el mismo esquema que usa el editor.',
      'Exportar la traza de un día y los resultados de los experimentos.',
      'Generar el reporte para el informe y publicar la aplicación en GitHub Pages.',
    ],
    metodo: 'Esquemas zod compartidos con el modelo, archivos JSON y CSV generados en el navegador, sin servidor.',
  },
} as const;

export function Proximamente({ ruta }: { ruta: keyof typeof CONTENIDO }) {
  const c = CONTENIDO[ruta];
  return (
    <div className="pagina pagina-proxima">
      <div className="proxima-placa" aria-hidden="true">
        {c.paso}
      </div>
      <div className="proxima-texto">
        <h1 className="titulo-pagina">{c.titulo}</h1>
        <p className="bajada">{c.bajada}</p>
        <p className="estado-paso">Llega en el paso {c.paso} del plan. Esta pantalla todavía no tiene resultados.</p>
        <h2 className="subtitulo">Qué va a responder</h2>
        <ul className="lista-señal">
          {c.preguntas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h2 className="subtitulo">Cómo</h2>
        <p className="parrafo">{c.metodo}</p>
        <a className="boton boton-secundario" href={enlace('simulacion')}>
          Mientras tanto, mirá un día simulado <IconoFlecha tam={18} />
        </a>
      </div>
    </div>
  );
}
