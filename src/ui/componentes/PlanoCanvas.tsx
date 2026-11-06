/**
 * Canvas de la planta: conecta el dibujante con el reproductor (un cuadro por rAF),
 * se adapta al tamaño (ResizeObserver, devicePixelRatio) y al tema.
 */
import { useEffect, useRef } from 'react';
import { useTema } from '../app/tema';
import { DibujantePlano, leerPaleta, type ModoDibujo } from '../animacion/dibujo';
import { ALTO, ANCHO } from '../animacion/plano';
import type { DatosAnimacion } from '../animacion/preparar';
import type { Reproductor } from '../animacion/reproductor';

interface Props {
  datos: DatosAnimacion;
  reproductor: Reproductor;
  /** 'auto' = completo, o simplificado si el canvas mide menos de 560 px de ancho. */
  modo?: ModoDibujo | 'auto';
  etiqueta: string;
  className?: string;
}

export function PlanoCanvas({ datos, reproductor, modo = 'auto', etiqueta, className }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujante = useRef<DibujantePlano | null>(null);
  const { efectivo } = useTema();

  useEffect(() => {
    const canvas = lienzo.current!;
    const d = new DibujantePlano(canvas, datos, modo === 'auto' ? 'completo' : modo, leerPaleta());
    dibujante.current = d;
    if (import.meta.env.DEV) (canvas as unknown as { __dibujante: DibujantePlano }).__dibujante = d;
    const elemento = caja.current!;
    const ajustar = (): void => {
      // El ResizeObserver puede avisar una última vez después de desmontar: se usa el elemento capturado.
      const w = elemento.clientWidth;
      if (w === 0) return;
      const h = Math.round((w * ALTO) / ANCHO);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (modo === 'auto' || modo === 'mini') d.setModo(w < 560 ? 'simple' : 'completo');
      d.dimensionar(w, h);
      reproductor.redibujar(2);
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(elemento);
    const quitar = reproductor.alCuadro((t, dt, salto) => d.dibujar(t, dt, salto));
    document.fonts?.ready.then(() => {
      d.setPaleta(leerPaleta());
      reproductor.redibujar(2);
    });
    return () => {
      ro.disconnect();
      quitar();
      dibujante.current = null;
    };
  }, [datos, reproductor, modo]);

  useEffect(() => {
    dibujante.current?.setPaleta(leerPaleta());
    reproductor.redibujar(2);
  }, [efectivo, reproductor]);

  return (
    <div ref={caja} className={`plano ${className ?? ''}`}>
      <canvas ref={lienzo} role="img" aria-label={etiqueta} />
    </div>
  );
}
