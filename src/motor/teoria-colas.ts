/**
 * Fórmulas analíticas del modelo M/M/c (Erlang C), para validar el motor.
 *
 * a = λ/μ (carga ofrecida), ρ = a/c (utilización por servidor, requiere ρ < 1)
 * P0 = [ Σ_{n=0}^{c−1} aⁿ/n! + a^c / (c!·(1−ρ)) ]⁻¹
 * C(c, a) = P(espera > 0) = a^c / (c!·(1−ρ)) · P0
 * Lq = C·ρ/(1−ρ),  Wq = Lq/λ,  W = Wq + 1/μ,  L = Lq + a = λW
 */
import { z } from 'zod';

export const EsquemaMMc = z
  .object({
    lambda: z.number().finite().positive(),
    mu: z.number().finite().positive(),
    c: z.number().int().positive(),
  })
  .refine((p) => p.lambda < p.c * p.mu, 'el sistema debe ser estable: λ < c·μ');

export type ParametrosMMc = z.infer<typeof EsquemaMMc>;

export interface MedidasMMc {
  rho: number;
  pEspera: number;
  P0: number;
  Lq: number;
  L: number;
  Wq: number;
  W: number;
}

export function teoriaMMc(parametros: ParametrosMMc): MedidasMMc {
  const { lambda, mu, c } = EsquemaMMc.parse(parametros);
  const a = lambda / mu;
  const rho = a / c;
  // Términos aⁿ/n! calculados en forma recursiva (evita factoriales grandes).
  let termino = 1;
  let suma = 0;
  for (let n = 0; n < c; n++) {
    suma += termino;
    termino *= a / (n + 1);
  }
  // Al salir del bucle, termino = a^c / c!
  const colaInfinita = termino / (1 - rho);
  const P0 = 1 / (suma + colaInfinita);
  const pEspera = colaInfinita * P0;
  const Lq = (pEspera * rho) / (1 - rho);
  const Wq = Lq / lambda;
  const W = Wq + 1 / mu;
  return { rho, pEspera, P0, Lq, L: Lq + a, Wq, W };
}

/**
 * Tiempo de relajación aproximado (Morse, 1955) de M/M/c: escala de tiempo en
 * que se "olvida" el estado inicial. Para M/M/1 es 1 / (μ(1 − √ρ)²); para c > 1
 * se usa la aproximación 1 / (cμ(1 − √ρ)²). Sirve para dimensionar el calentamiento.
 */
export function tiempoRelajacion(parametros: ParametrosMMc): number {
  const { lambda, mu, c } = EsquemaMMc.parse(parametros);
  const rho = lambda / (c * mu);
  return 1 / (c * mu * (1 - Math.sqrt(rho)) ** 2);
}
