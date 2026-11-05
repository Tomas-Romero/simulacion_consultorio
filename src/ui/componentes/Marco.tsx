/**
 * Marco común: banda de señalética arriba (con la marca naranja de "usted está aquí") y pie
 * con la autoría y el crédito de TARC Tech.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { SITIO } from '../app/config';
import { enlace, type Ruta } from '../app/rutas';
import { setPreferenciaTema, useTema, type PreferenciaTema } from '../app/tema';
import { IconoAuto, IconoCerrar, IconoLuna, IconoMenu, IconoSol } from './Iconos';

interface ItemNav {
  ruta: Ruta;
  texto: string;
  paso?: string;
}

const PRINCIPALES: ItemNav[] = [
  { ruta: 'inicio', texto: 'Inicio' },
  { ruta: 'escenario', texto: 'Escenario' },
  { ruta: 'simulacion', texto: 'Simulación del día' },
  { ruta: 'resultados', texto: 'Resultados del día' },
  { ruta: 'experimentos', texto: 'Experimentos' },
];
const PROXIMOS: ItemNav[] = [
  { ruta: 'dinamica', texto: 'Dinámica de sistemas', paso: '#5' },
  { ruta: 'datos', texto: 'Datos', paso: '#6' },
];

function SelectorTema() {
  const { preferencia } = useTema();
  const orden: PreferenciaTema[] = ['auto', 'claro', 'oscuro'];
  const siguiente = orden[(orden.indexOf(preferencia) + 1) % orden.length]!;
  const nombre = { auto: 'según el sistema', claro: 'claro', oscuro: 'oscuro' } as const;
  const Ic = preferencia === 'claro' ? IconoSol : preferencia === 'oscuro' ? IconoLuna : IconoAuto;
  return (
    <button
      type="button"
      className="boton-icono"
      onClick={() => setPreferenciaTema(siguiente)}
      title={`Tema ${nombre[preferencia]}. Cambiar a ${nombre[siguiente]}`}
      aria-label={`Tema ${nombre[preferencia]}. Cambiar a ${nombre[siguiente]}`}
    >
      <Ic />
    </button>
  );
}

function Enlace({ item, actual, alElegir }: { item: ItemNav; actual: Ruta; alElegir: () => void }) {
  const activo = item.ruta === actual;
  return (
    <a href={enlace(item.ruta)} className={`nav-item${activo ? ' activo' : ''}${item.paso ? ' proximo' : ''}`} aria-current={activo ? 'page' : undefined} onClick={alElegir}>
      {item.paso && <span className="nav-paso">{item.paso}</span>}
      {item.texto}
    </a>
  );
}

export function Marco({ ruta, children }: { ruta: Ruta; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => setAbierto(false), [ruta]);
  const cerrar = (): void => setAbierto(false);
  return (
    <>
      <a className="saltar" href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }}>
        Saltar al contenido
      </a>
      <header className="banda">
        <div className="banda-interior">
          <a href={enlace('inicio')} className="marca" aria-label={`${SITIO.nombre}: inicio`}>
            <span className="marca-placa" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18">
                <path d="M7.5 3h5v4.5H17v5h-4.5V17h-5v-4.5H3v-5h4.5z" fill="currentColor" />
              </svg>
            </span>
            <span className="marca-texto">
              <strong>{SITIO.nombre}</strong>
              <span>{SITIO.bajada}</span>
            </span>
          </a>
          <nav className={`nav${abierto ? ' abierta' : ''}`} aria-label="Secciones">
            <div className="nav-grupo">
              {PRINCIPALES.map((i) => (
                <Enlace key={i.ruta} item={i} actual={ruta} alElegir={cerrar} />
              ))}
            </div>
            <div className="nav-grupo nav-proximos" aria-label="Próximos pasos">
              {PROXIMOS.map((i) => (
                <Enlace key={i.ruta} item={i} actual={ruta} alElegir={cerrar} />
              ))}
            </div>
            <div className="nav-grupo">
              <Enlace item={{ ruta: 'acerca', texto: 'Acerca de' }} actual={ruta} alElegir={cerrar} />
            </div>
          </nav>
          <div className="banda-acciones">
            <SelectorTema />
            <button type="button" className="boton-icono solo-movil" aria-expanded={abierto} aria-label={abierto ? 'Cerrar el menú' : 'Abrir el menú'} onClick={() => setAbierto((a) => !a)}>
              {abierto ? <IconoCerrar /> : <IconoMenu />}
            </button>
          </div>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="contenido">
        {children}
      </main>
      <footer className="pie">
        <div className="pie-interior">
          <div>
            <strong>{SITIO.autoria}</strong>
            <span>{SITIO.institucion}</span>
          </div>
          <a className="credito" href={enlace('acerca')}>
            <img src={SITIO.estudio.isotipo} alt="" width={28} height={28} />
            <span>
              Diseño y desarrollo <strong>{SITIO.estudio.nombre}</strong>
            </span>
          </a>
        </div>
      </footer>
    </>
  );
}
