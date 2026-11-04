# Sobreturnos — simulación de un policonsultorio (UTN FRSR, Simulación 2026) — Tomás Romero

Aplicación web que simula un policonsultorio para decidir **cuántos sobreturnos** dar y
**dónde ubicarlos** en la agenda, minimizando un costo esperado (espera de pacientes + ocio
del médico + horas extra + pacientes perdidos). Proyecto integrador de la materia; queda
como repositorio público en el GitHub de Tomás.

## Método puente

Se trabaja con un "método puente" entre dos chats:

- **Chat de claude.ai = arquitecto/tutor:** analiza, explica teoría, planifica y revisa.
- **Claude Code (este repo) = ejecutor:** escribe código, lo ejecuta y reporta resultados.
- **Tomás = intermediario:** copia los mensajes de un chat al otro.

El chat de claude.ai **no ve este repo ni esta conversación**. Todo lo que necesite saber
(código relevante, salidas, valores, errores, decisiones) tiene que ir dentro de la respuesta.

Los mensajes entrantes llegan con el encabezado `### MENSAJE PARA CLAUDE CODE · #N` y traen
contexto, objetivo, instrucciones, restricciones, criterio de terminado y qué devolver.
Respetar las restricciones del mensaje (no adelantar pasos posteriores del plan).

### Formato de respuesta (obligatorio en todos los pasos)

```
### RESPUESTA PARA CLAUDE.AI · #N
**Hecho:** qué hiciste
**Archivos tocados:** rutas
**Resultados / salida:** valores, tablas o errores reales copiados de la ejecución (no resumidos)
**Decisiones que tomé por mi cuenta:** supuestos y por qué
**Dudas / bloqueos:**
**Siguiente paso sugerido:**
```

- `N` es el mismo número del mensaje que se responde.
- En "Resultados / salida" pegar la salida real de consola, no paráfrasis.

### Plan

#1 base + motor validado · #2 modelo completo del consultorio · #3 interfaz y animación ·
#4 experimentos Monte Carlo y k óptimo · #5 dinámica de sistemas ·
#6 import/export, reportes, deploy e informe.

## Convenciones

- **Idioma:** código, identificadores, comentarios, tests y documentación en español
  (salvo palabras clave del lenguaje y APIs de librerías).
- **Sin backend:** todo corre en el navegador. Las corridas pesadas van en Web Workers.
- **Reproducible con semilla:** nunca usar `Math.random`. Toda aleatoriedad sale de
  `FabricaFlujos(semilla, réplica).flujo('nombre')`, un flujo por fuente (llegadas,
  servicio, ausentismo, puntualidad, …), para poder usar números aleatorios comunes.
  Cada muestra de una distribución consume un solo uniforme (transformada inversa).
- **TypeScript strict sin `any`.** Parámetros y datos importables se validan con zod.
- **Unidad de tiempo del modelo:** minutos (desde las 00:00 en el consultorio).
- **Datos:** todos ficticios y marcados como supuestos hasta que se importen datos reales.

## Arquitectura

- `src/motor/` — TypeScript puro (sin React ni DOM; `tsconfig.motor.json` lo compila sin
  la lib DOM y `tests/motor/arquitectura.test.ts` lo controla): PRNG, distribuciones,
  eventos discretos, recursos/colas, estadística, teoría de colas y validación M/M/c.
- `src/modelo/` — modelo del consultorio: esquema de escenario y presets, agenda con
  pre-muestreo por identidad, simulación de un día, métricas, traza y validación.
  Solo depende de `src/motor/` (lo controla `tests/modelo/escenario-traza.test.ts`).
- `src/ui/` — React. `src/ui/diagnostico/` es la página provisoria (panel de un día +
  validación del motor).
- `tests/` — Vitest. `docs/` — modelo conceptual y material para el informe.

## Comandos

- `npm run dev` — página de diagnóstico en http://localhost:5173
- `npm test` — suite completa (motor, validación M/M/c y Little, modelo, validaciones a–e,
  pre-muestreo)
- `npm run typecheck` — tsc del motor (sin DOM) y del proyecto
- `npm run validar` — tabla de validación M/M/c, Little y curva de Welch por consola
- `npm run validar-modelo` — tablas de validación M/G/1 y red en serie del modelo
- `npm run dia -- [semilla] [réplica]` — métricas completas de un día del escenario por defecto
- `npm run rendimiento` — ms por día simulado para cada preset
- `npm run calibrar -- [semilla] [días]` — situación inicial de los presets contra las metas de
  calibración (ver `docs/calibracion.md`)
- `npm run barrido-control` — barrido k = 0–4 del #2b (no es el experimento del #4)
- `npm run cobertura` — estudio de cobertura del IC 95 % con 20 semillas (~40 s)

## Entorno

- Node 22, Vite 8, React 19, TypeScript 7, Vitest 5, zod 4, ECharts 6.
- Windows: en Bash usar `PYTHONIOENCODING=utf-8` si se imprime con Python.
