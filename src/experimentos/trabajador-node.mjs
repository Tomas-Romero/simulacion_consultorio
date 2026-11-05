// Arranque del hilo de Node: registra tsx (para cargar TypeScript) y carga el trabajador.
import { register } from 'tsx/esm/api';

register();
await import('./trabajador-node.ts');
