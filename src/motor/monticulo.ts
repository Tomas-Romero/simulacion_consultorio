/**
 * Montículo binario (min-heap) genérico. Lo usan la lista de eventos futuros
 * y las colas con prioridad. El orden total lo define el comparador; para que
 * la simulación sea determinista, los comparadores desempatan siempre por un
 * número de secuencia creciente.
 */
export class MonticuloBinario<T> {
  private readonly datos: T[] = [];
  private readonly menor: (a: T, b: T) => boolean;

  /** `menor(a, b)` debe ser true si a tiene que salir antes que b. */
  constructor(menor: (a: T, b: T) => boolean) {
    this.menor = menor;
  }

  get tamano(): number {
    return this.datos.length;
  }

  verMinimo(): T | undefined {
    return this.datos[0];
  }

  insertar(x: T): void {
    const d = this.datos;
    d.push(x);
    let i = d.length - 1;
    while (i > 0) {
      const padre = (i - 1) >> 1;
      if (!this.menor(d[i]!, d[padre]!)) break;
      [d[i], d[padre]] = [d[padre]!, d[i]!];
      i = padre;
    }
  }

  extraerMinimo(): T | undefined {
    const d = this.datos;
    if (d.length === 0) return undefined;
    const raiz = d[0]!;
    const ultimo = d.pop()!;
    if (d.length > 0) {
      d[0] = ultimo;
      let i = 0;
      for (;;) {
        const izq = 2 * i + 1;
        const der = izq + 1;
        let m = i;
        if (izq < d.length && this.menor(d[izq]!, d[m]!)) m = izq;
        if (der < d.length && this.menor(d[der]!, d[m]!)) m = der;
        if (m === i) break;
        [d[i], d[m]] = [d[m]!, d[i]!];
        i = m;
      }
    }
    return raiz;
  }

  vaciar(): void {
    this.datos.length = 0;
  }
}
