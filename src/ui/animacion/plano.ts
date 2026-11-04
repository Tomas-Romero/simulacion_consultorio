/**
 * Geometría de la planta del policonsultorio, en coordenadas de mundo (1200 × 720).
 * Recorrido: entrada (izquierda) → admisión → sala de espera → consultorios → salida (abajo).
 */
export const ANCHO = 1200;
export const ALTO = 720;

export interface Punto {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Consultorio {
  rect: Rect;
  medico: Punto;
  paciente: Punto;
  barra: Rect;
  agenda: Rect;
}

export interface Plano {
  edificio: Rect;
  puerta: { y0: number; y1: number };
  afuera: Punto;
  adentro: Punto;
  admision: Rect;
  mostrador: Rect;
  puestos: Punto[];
  recepcionistas: Punto[];
  sala: Rect;
  sillas: Punto[];
  consultorios: Consultorio[];
  zonaConsultorios: Rect;
  salida: { x0: number; x1: number };
  fueraSalida: Punto;
  colaEn(i: number): Punto;
  paradoEn(i: number): Punto;
}

export function calcularPlano(nProfesionales: number, recepcionistas: number, sillasNecesarias: number): Plano {
  const edificio: Rect = { x: 16, y: 16, w: ANCHO - 32, h: ALTO - 32 };
  const admision: Rect = { x: 40, y: 40, w: 250, h: 330 };
  const mostrador: Rect = { x: 66, y: 112, w: 198, h: 22 };
  const nPuestos = Math.max(1, Math.min(2, recepcionistas));
  const xs = nPuestos === 1 ? [165] : [118, 212];
  const puestos = xs.map((x) => ({ x, y: 156 }));
  const recep = xs.map((x) => ({ x, y: 96 }));

  const sala: Rect = { x: 312, y: 40, w: 440, h: 640 };
  const columnas = 6;
  const filas = Math.max(5, Math.min(9, Math.ceil(Math.max(24, sillasNecesarias) / columnas)));
  const dx = (sala.w - 64) / (columnas - 1);
  const dy = Math.min(62, (sala.h - 150) / (filas - 1));
  const sillas: Punto[] = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < columnas; c++) sillas.push({ x: sala.x + 32 + c * dx, y: sala.y + 92 + f * dy });

  const zona: Rect = { x: 812, y: 40, w: 348, h: 640 };
  const n = Math.max(1, nProfesionales);
  const cols = n <= 3 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const gap = 12;
  const w = (zona.w - (cols - 1) * gap) / cols;
  const h = Math.min(250, (zona.h - (rows - 1) * gap) / rows);
  const consultorios: Consultorio[] = [];
  for (let i = 0; i < n; i++) {
    const c = cols === 1 ? 0 : i % cols;
    const r = cols === 1 ? i : Math.floor(i / cols);
    const rect = { x: zona.x + c * (w + gap), y: zona.y + r * (h + gap), w, h };
    const ancho = rect.w < 200;
    consultorios.push({
      rect,
      medico: { x: rect.x + (ancho ? rect.w * 0.3 : rect.w * 0.36), y: rect.y + rect.h * 0.55 },
      paciente: { x: rect.x + (ancho ? rect.w * 0.7 : rect.w * 0.6), y: rect.y + rect.h * 0.55 },
      barra: { x: rect.x + 14, y: rect.y + rect.h * 0.55 + 24, w: rect.w - 28, h: 5 },
      agenda: { x: rect.x + 14, y: rect.y + rect.h - 26, w: rect.w - 28, h: 12 },
    });
  }

  return {
    edificio,
    puerta: { y0: 410, y1: 490 },
    afuera: { x: -24, y: 450 },
    adentro: { x: 58, y: 450 },
    admision,
    mostrador,
    puestos,
    recepcionistas: recep,
    sala,
    sillas,
    consultorios,
    zonaConsultorios: zona,
    salida: { x0: 760, x1: 806 },
    fueraSalida: { x: 783, y: ALTO + 24 },
    colaEn(i: number): Punto {
      const col = Math.floor(i / 7);
      const fila = i % 7;
      return { x: 248 - col * 30, y: 204 + fila * 24 };
    },
    paradoEn(i: number): Punto {
      const col = i % 12;
      const fila = Math.floor(i / 12);
      return { x: sala.x + 26 + col * 35, y: sala.y + sala.h - 22 - fila * 22 };
    },
  };
}
