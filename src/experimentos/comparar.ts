/**
 * Comparación de dos corridas del estudio. Con el mismo motor de JavaScript la huella coincide bit a
 * bit (con cualquier cantidad de hilos). Entre motores distintos (por ejemplo, Node 22 y un Chrome
 * más nuevo) Math.exp y Math.log pueden redondear distinto el último bit: entonces se comparan las
 * decisiones (deben ser idénticas) y la mayor diferencia relativa entre medias.
 */
import type { CurvaSerie, ResultadoEstudio } from './estudio';

export interface Comparacion {
  huellaIgual: boolean;
  decisiones: number;
  decisionesIguales: number;
  /** Mayor |a − b| / |a| entre todas las medias de B. */
  maxDifRelativa: number;
}

export function compararEstudios(a: ResultadoEstudio, b: ResultadoEstudio): Comparacion {
  let decisiones = 0;
  let iguales = 0;
  let maxDif = 0;
  const decide = (x: unknown, y: unknown): void => {
    decisiones++;
    if (JSON.stringify(x) === JSON.stringify(y)) iguales++;
  };
  const curva = (x: CurvaSerie, y: CurvaSerie): void => {
    decide([x.R, x.kHat, x.conjunto, x.kRec, x.kC], [y.R, y.kHat, y.conjunto, y.kRec, y.kC]);
    x.puntos.forEach((p, i) => {
      const q = y.puntos[i];
      if (q) maxDif = Math.max(maxDif, Math.abs(p.B.media - q.B.media) / Math.max(1, Math.abs(p.B.media)));
    });
  };
  a.e1.forEach((x, i) => b.e1[i] && curva(x.curva, b.e1[i]!.curva));
  a.e2.forEach((x, i) => decide([x.ganadora, x.empatadas], [b.e2[i]?.ganadora, b.e2[i]?.empatadas]));
  a.e3.ausentismo.forEach((x, i) => b.e3.ausentismo[i] && curva(x.curva, b.e3.ausentismo[i]!.curva));
  a.e3.mapa.forEach((x, i) => decide([x.kHat, x.kRec, x.conjunto], [b.e3.mapa[i]?.kHat, b.e3.mapa[i]?.kRec, b.e3.mapa[i]?.conjunto]));
  decide(a.e4.alfa, b.e4.alfa);
  a.e4.configuraciones.forEach((x, i) => decide([x.kHat, x.ingenua.k, x.ajustada.k, x.ingenua.dentro, x.ajustada.dentro], [b.e4.configuraciones[i]?.kHat, b.e4.configuraciones[i]?.ingenua.k, b.e4.configuraciones[i]?.ajustada.k, b.e4.configuraciones[i]?.ingenua.dentro, b.e4.configuraciones[i]?.ajustada.dentro]));
  decide(a.e6.k, b.e6.k);
  return { huellaIgual: a.huella === b.huella, decisiones, decisionesIguales: iguales, maxDifRelativa: maxDif };
}
