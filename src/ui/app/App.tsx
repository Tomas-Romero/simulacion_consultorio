import { lazy, Suspense, useEffect } from 'react';
import { Marco } from '../componentes/Marco';
import { Acerca } from '../paginas/Acerca';
import { Escenario } from '../paginas/Escenario';
import { Inicio } from '../paginas/Inicio';
import { Proximamente } from '../paginas/Proximamente';
import { Simulacion } from '../paginas/Simulacion';
import { cargarPreset, editarEscenario, setComparacion } from './estado';
import { useUbicacion, type Ruta } from './rutas';

// Ganchos de depuración (solo en desarrollo): permiten medir fps con cada preset desde la consola.
if (import.meta.env.DEV) (window as unknown as { __app: object }).__app = { cargarPreset, editarEscenario, setComparacion };

const Resultados = lazy(() => import('../paginas/Resultados'));
const Experimentos = lazy(() => import('../paginas/experimentos/Experimentos'));
const Diagnostico = lazy(() => import('../diagnostico/PaginaDiagnostico').then((m) => ({ default: m.PaginaDiagnostico })));

const TITULOS: Record<Ruta, string> = {
  inicio: 'Sobreturnos · simulación de un policonsultorio',
  escenario: 'Escenario · Sobreturnos',
  simulacion: 'Simulación del día · Sobreturnos',
  resultados: 'Resultados del día · Sobreturnos',
  experimentos: 'Experimentos · Sobreturnos',
  dinamica: 'Dinámica de sistemas · Sobreturnos',
  datos: 'Datos · Sobreturnos',
  acerca: 'Acerca de · Sobreturnos',
  diagnostico: 'Diagnóstico del motor · Sobreturnos',
};

function Cargando() {
  return (
    <div className="pagina">
      <p className="cargando" role="status">
        Cargando…
      </p>
    </div>
  );
}

export function App() {
  const { ruta, params } = useUbicacion();
  useEffect(() => {
    document.title = TITULOS[ruta];
    window.scrollTo(0, 0);
  }, [ruta]);

  let pagina;
  switch (ruta) {
    case 'inicio':
      pagina = <Inicio />;
      break;
    case 'escenario':
      pagina = <Escenario />;
      break;
    case 'simulacion':
      pagina = <Simulacion params={params} />;
      break;
    case 'resultados':
      pagina = <Resultados />;
      break;
    case 'experimentos':
      pagina = <Experimentos />;
      break;
    case 'dinamica':
    case 'datos':
      pagina = <Proximamente ruta={ruta} />;
      break;
    case 'acerca':
      pagina = <Acerca />;
      break;
    case 'diagnostico':
      pagina = <Diagnostico />;
      break;
  }
  return (
    <Marco ruta={ruta}>
      <Suspense fallback={<Cargando />}>{pagina}</Suspense>
    </Marco>
  );
}
