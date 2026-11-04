import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas: la aplicación se publica en GitHub Pages bajo /<repositorio>/ y usa rutas por hash.
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    // El chunk más grande es Resultados del día con el núcleo modular de ECharts (≈ 600 kB, ≈ 200 kB con gzip);
    // se carga solo al abrir esa pantalla (import dinámico), así que no pesa en la carga inicial.
    chunkSizeWarningLimit: 650,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
