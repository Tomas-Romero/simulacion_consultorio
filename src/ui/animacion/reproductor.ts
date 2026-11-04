/**
 * Reloj de la animación (minutos del modelo) con un bucle requestAnimationFrame.
 * Los canvas se dibujan en cada cuadro; React se entera a ~10 Hz (useSyncExternalStore),
 * así el panel no se vuelve a renderizar 60 veces por segundo.
 */
import { useSyncExternalStore } from 'react';

export const VELOCIDADES = [1, 2, 5, 10, 30, 60, 120, 300, 600] as const;

export interface EstadoReproductor {
  t: number;
  tInicio: number;
  tFin: number;
  reproduciendo: boolean;
  velocidad: number;
}

type AlCuadro = (t: number, dt: number, salto: boolean) => void;

export class Reproductor {
  private estado: EstadoReproductor;
  private oyentes = new Set<() => void>();
  private cuadros = new Set<AlCuadro>();
  private raf = 0;
  private ultimo = 0;
  private ultimoAviso = 0;
  private salto = true;
  private inercia = 0;
  /** Cuadros por segundo medidos (promedio móvil). */
  fps = 0;
  /** Milisegundos de trabajo por cuadro (dibujo de todos los canvas; promedio móvil y máximo). */
  msCuadro = 0;
  msCuadroMax = 0;

  constructor(tInicio: number, tFin: number, t = tInicio, velocidad = 300) {
    this.estado = { t, tInicio, tFin, reproduciendo: false, velocidad };
  }

  get instantanea(): EstadoReproductor {
    return this.estado;
  }

  suscribir = (f: () => void): (() => void) => {
    this.oyentes.add(f);
    return () => this.oyentes.delete(f);
  };

  alCuadro(f: AlCuadro): () => void {
    this.cuadros.add(f);
    this.pedirCuadro();
    return () => this.cuadros.delete(f);
  }

  private avisar(): void {
    this.ultimoAviso = performance.now();
    for (const f of this.oyentes) f();
  }

  private actualizar(cambios: Partial<EstadoReproductor>): void {
    this.estado = { ...this.estado, ...cambios };
    this.avisar();
  }

  private pedirCuadro(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.bucle);
  }

  private bucle = (ahora: number): void => {
    this.raf = 0;
    const dt = this.ultimo ? Math.min(0.1, (ahora - this.ultimo) / 1000) : 0;
    this.ultimo = ahora;
    if (dt > 0) this.fps = this.fps ? this.fps * 0.95 + (1 / dt) * 0.05 : 1 / dt;
    let { t } = this.estado;
    if (this.estado.reproduciendo) {
      t = Math.min(this.estado.tFin, t + (dt * this.estado.velocidad) / 60);
      this.estado = { ...this.estado, t };
      if (t >= this.estado.tFin) this.actualizar({ reproduciendo: false });
      else if (ahora - this.ultimoAviso > 100) this.avisar();
    }
    const salto = this.salto;
    this.salto = false;
    const t0 = performance.now();
    for (const f of this.cuadros) f(t, dt, salto);
    const ms = performance.now() - t0;
    this.msCuadro = this.msCuadro ? this.msCuadro * 0.95 + ms * 0.05 : ms;
    this.msCuadroMax = Math.max(this.msCuadroMax, ms);
    // Sigue el bucle mientras reproduce y unos cuadros más después, para que los pacientes terminen de deslizarse.
    if (this.estado.reproduciendo || this.inercia-- > 0) this.pedirCuadro();
    else this.ultimo = 0;
  };

  /** Pide cuadros extra (por ejemplo, al cambiar el tema o el tamaño). */
  redibujar(cuadros = 30): void {
    this.inercia = Math.max(this.inercia, cuadros);
    this.pedirCuadro();
  }

  reproducir(): void {
    if (this.estado.t >= this.estado.tFin) this.estado = { ...this.estado, t: this.estado.tInicio };
    this.actualizar({ reproduciendo: true });
    this.pedirCuadro();
  }

  pausar(): void {
    this.actualizar({ reproduciendo: false });
    this.redibujar();
  }

  alternar(): void {
    if (this.estado.reproduciendo) this.pausar();
    else this.reproducir();
  }

  ir(t: number): void {
    this.salto = true;
    this.actualizar({ t: Math.max(this.estado.tInicio, Math.min(this.estado.tFin, t)) });
    this.redibujar(40);
  }

  mover(dMin: number): void {
    this.ir(this.estado.t + dMin);
  }

  setVelocidad(v: number): void {
    this.actualizar({ velocidad: v });
  }

  cambiarVelocidad(paso: 1 | -1): void {
    const i = VELOCIDADES.findIndex((v) => v >= this.estado.velocidad);
    const j = Math.max(0, Math.min(VELOCIDADES.length - 1, (i < 0 ? VELOCIDADES.length - 1 : i) + paso));
    this.setVelocidad(VELOCIDADES[j]!);
  }

  setRango(tInicio: number, tFin: number): void {
    this.salto = true;
    this.actualizar({ tInicio, tFin, t: Math.max(tInicio, Math.min(tFin, this.estado.t)) });
    this.redibujar(40);
  }

  destruir(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cuadros.clear();
    this.oyentes.clear();
  }
}

export function useReproductor(r: Reproductor): EstadoReproductor {
  return useSyncExternalStore(r.suscribir, () => r.instantanea);
}
