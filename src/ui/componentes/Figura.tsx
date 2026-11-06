/**
 * Figura numerada con un gráfico ECharts (importado por módulos) y exportación a PNG.
 * El gráfico se rearma al cambiar el tema: los colores salen de los tokens CSS.
 */
import { BarChart, BoxplotChart, CustomChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTema } from '../app/tema';
import { leerPaleta, type Paleta } from '../animacion/dibujo';
import { IconoDescargar } from './Iconos';

echarts.use([BarChart, LineChart, ScatterChart, BoxplotChart, CustomChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, VisualMapComponent, CanvasRenderer]);

export type OpcionGrafico = echarts.EChartsCoreOption;

/** Opciones comunes: tipografía, ejes recesivos y tooltip con los colores del tema. */
export function base(p: Paleta): OpcionGrafico {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'Fira Sans', system-ui, sans-serif", color: p.texto2 },
    animationDuration: 300,
    tooltip: {
      backgroundColor: p.panel,
      borderColor: p.borde,
      borderWidth: 1,
      textStyle: { color: p.texto, fontSize: 12 },
      extraCssText: 'box-shadow: var(--sombra); border-radius: 6px;',
    },
  };
}

export function ejeRecesivo(p: Paleta): Record<string, unknown> {
  return {
    axisLine: { lineStyle: { color: p.bordeFuerte } },
    axisTick: { show: false },
    axisLabel: { color: p.texto3, fontSize: 11 },
    splitLine: { lineStyle: { color: p.borde } },
    nameTextStyle: { color: p.texto3, fontSize: 11 },
  };
}

interface Props {
  numero: number | string;
  titulo: string;
  descripcion?: ReactNode;
  opcion: (p: Paleta) => OpcionGrafico;
  alto?: number;
  archivo: string;
  className?: string;
  /** Texto alternativo del gráfico (lo leen los lectores de pantalla). */
  resumen: string;
}

export function Figura({ numero, titulo, descripcion, opcion, alto = 320, archivo, className, resumen }: Props) {
  const div = useRef<HTMLDivElement>(null);
  const grafico = useRef<echarts.ECharts | null>(null);
  const { efectivo } = useTema();

  useEffect(() => {
    const g = echarts.init(div.current!, null, { renderer: 'canvas' });
    grafico.current = g;
    g.setOption(opcion(leerPaleta()));
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(div.current!);
    return () => {
      ro.disconnect();
      g.dispose();
      grafico.current = null;
    };
  }, [opcion, efectivo]);

  const exportar = (): void => {
    const g = grafico.current;
    if (!g) return;
    const url = g.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: leerPaleta().panel });
    const a = document.createElement('a');
    a.href = url;
    a.download = `${archivo}.png`;
    a.click();
  };

  return (
    <figure className={`figura ${className ?? ''}`}>
      <header className="figura-cabeza">
        <div>
          <h2 className="figura-titulo">
            <span className="figura-numero">Fig. {numero}</span> {titulo}
          </h2>
          {descripcion && <p className="figura-descripcion">{descripcion}</p>}
        </div>
        <button type="button" className="boton boton-fantasma boton-chico" onClick={exportar} aria-label={`Exportar la figura ${numero} como PNG`}>
          <IconoDescargar tam={16} /> PNG
        </button>
      </header>
      <div ref={div} className="figura-grafico" style={{ height: alto }} role="img" aria-label={resumen} />
    </figure>
  );
}
