/**
 * El motor tiene que poder correr en un Web Worker y en Node: no puede
 * importar React, la UI, el modelo ni usar el DOM. (Además, tsconfig.motor.json
 * lo compila sin la librería DOM.)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAIZ_MOTOR = fileURLToPath(new URL('../../src/motor', import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : ruta.endsWith('.ts') ? [ruta] : [];
  });
}

describe('arquitectura del motor', () => {
  const fuentes = archivos(RAIZ_MOTOR);

  it('hay archivos en src/motor', () => {
    expect(fuentes.length).toBeGreaterThan(5);
  });

  it.each(fuentes.map((f) => [relative(RAIZ_MOTOR, f), f]))('%s no depende de React, DOM, UI ni modelo', (_, ruta) => {
    const codigo = readFileSync(ruta, 'utf-8');
    const imports = [...codigo.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    for (const imp of imports) {
      expect(imp.startsWith('.') || imp === 'zod', `import no permitido: ${imp}`).toBe(true);
      expect(/\/(ui|modelo)(\/|$)/.test(imp), `import no permitido: ${imp}`).toBe(false);
    }
    expect(/\b(window|document|localStorage|navigator)\./.test(codigo)).toBe(false);
  });
});
