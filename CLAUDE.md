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

## Criterio de decisión (definido en #2c, cerrado en #2d)

- **Criterio ÚNICO de decisión:** beneficio neto esperado
  `B = ingresos − c_espera·espera − c_extra·extra − c_perdido·perdidos` (el ocio no se resta).
  Todo k* y toda recomendación salen de B.
- **Contraste (solo se informa, no decide):** costo clásico
  `C = c_espera·espera + c_ocio·ocio + c_extra·extra + c_perdido·perdidos`.
- `c_ocio` derivado = honorario / duración media de la consulta con turno de cada profesional;
  `c_extra` derivado = factor × c_ocio (factor 1,5 por defecto; coherencia c_extra ≥ c_ocio).
  El #4 incluye la sensibilidad al factor (1 a 2).
- `C + B = ingresos + c_ocio·ocio` NO es constante: solo lo sería si cada consulta adicional
  ocurriera dentro del turno y con la duración media (ver `docs/modelo-conceptual.md`, sección 1).

## Presets CONGELADOS (desde #2d)

- La calibración de los presets terminó en el #2d (iteración de validación 3). Sus parámetros
  quedan **congelados**: no se recalibran ni se ajustan para mejorar resultados del #4 en adelante.
- Lo que quedó fuera de meta (el abandono) es una **limitación documentada del modelo**
  (`docs/calibracion.md`, sección 9), no algo a seguir iterando.

## Identidad visual (implementada en el #3; detalle en `docs/diseno-ui.md`)

- Estilo **TARC Tech** adaptado a un contexto médico: base **zinc**, con **modo claro y oscuro**.
- Colores: **cian `#06B6D4`** como color principal de datos; **verde `#10B981`** para
  indicadores positivos; **naranja `#F97316`** para acentos de marca y acciones.
- Fuentes: **Fira Sans** (interfaz) y **Fraunces** (títulos destacados).
- Crédito **TARC Tech** con su isotipo en el pie y en "Acerca de".
- La autoría (nombre que figura como autor) es un **dato configurable**, no un texto fijo
  (`src/ui/app/config.ts`; por defecto "Tomás Romero · TARC Tech").
- Dirección: **señalética hospitalaria** (placas numeradas, pictogramas por clase de paciente,
  "usted está aquí" en naranja). Clases: turno círculo cian, sobreturno rombo naranja, tardío
  triángulo ocre `#A16207`, espontáneo cuadrado violeta, urgencia cruz roja (forma + color).
- Tokens de diseño como variables CSS en `src/ui/estilos/tokens.css` (claro y oscuro).

## Arquitectura

- `src/motor/` — TypeScript puro (sin React ni DOM; `tsconfig.motor.json` lo compila sin
  la lib DOM y `tests/motor/arquitectura.test.ts` lo controla): PRNG, distribuciones,
  eventos discretos, recursos/colas, estadística, teoría de colas y validación M/M/c.
- `src/modelo/` — modelo del consultorio: esquema de escenario y presets, agenda con
  pre-muestreo por identidad, simulación de un día, métricas, traza y validación.
  Solo depende de `src/motor/` (lo controla `tests/modelo/escenario-traza.test.ts`).
- `src/experimentos/` — motor de experimentos Monte Carlo (TS puro, sin React): esquema zod,
  aplicación de niveles (k, política, ausentismo vía β₀) sobre copias del escenario, tareas por
  bloque de réplicas, pool de Web Workers (`pool-web.ts`) o worker_threads (`pool-node.ts`),
  análisis (pareadas, conjunto de óptimos con Bonferroni, regla de precisión, reponderación de
  costos) y el estudio E1–E6 (`estudio.ts`). Resultado idéntico bit a bit con cualquier cantidad
  de hilos en el mismo motor JS. Diseño en `docs/experimentos.md`; resultados precalculados en
  `public/resultados/` (no editar a mano: se regeneran con `npm run estudio`).
  Análisis complementarios del #5: regla corregida por espontáneos con validación dejando uno
  afuera (`regla.ts`) y perfiles por franja de 30 min del mecanismo de las políticas
  (`mecanismo.ts`); resultados en `public/resultados/complementos.json` (`npm run complementos`).
- `src/dinamica/` — dinámica de sistemas (TS puro, sin React): modelo fluido de un día
  (`fluido.ts`), lista de espera en semanas con políticas k = 0 / fijo / adaptativo, equilibrio
  analítico, Euler y RK4 (`lista.ts`), parámetros base y tabla de beneficio desde E3
  (`parametros.ts`), comparación y convergencia (`resumen.ts`). Diseño en `docs/dinamica-sistemas.md`.
- `src/ui/` — React, SPA con rutas por hash (`#/escenario`, `#/simulacion`, `#/resultados`, …):
  `app/` (rutas, tema, estado global con localStorage, config), `componentes/`, `paginas/`,
  `animacion/` (traza → animación, canvas, reloj, indicadores en vivo; TS puro salvo el dibujo),
  `simulacion/` (Web Worker que corre el día con traza), `diagnostico/` (página del paso #1,
  en `#/diagnostico`). La animación reproduce la traza: nunca re-simula.
- `tests/` — Vitest. `docs/` — modelo conceptual y material para el informe.

## Comandos

- `npm run dev` — aplicación en http://localhost:5173 (diagnóstico en `#/diagnostico`)
- `npm run build` — typecheck + build de producción en `dist/` (rutas relativas, apta para GitHub Pages)
- `npm test` — suite completa (motor, validación M/M/c y Little, modelo, validaciones a–e,
  pre-muestreo)
- `npm run typecheck` — tsc del motor (sin DOM) y del proyecto
- `npm run validar` — tabla de validación M/M/c, Little y curva de Welch por consola
- `npm run validar-modelo` — tablas de validación M/G/1 y red en serie del modelo
- `npm run dia -- [semilla] [réplica]` — métricas completas de un día del escenario por defecto
- `npm run rendimiento` — ms por día simulado para cada preset
- `npm run calibrar -- [semilla] [días]` — situación inicial de los presets contra las metas de
  calibración (ver `docs/calibracion.md`)
- `npm run barrido-control` — barrido de control k = 0–6 con B y C (#2d, presets congelados; no es el experimento del #4)
- `npm run cobertura` — estudio de cobertura del IC 95 % con 20 semillas (~40 s)
- `npm run estudio [-- --hilos N]` — estudio Monte Carlo completo (E1–E6, ~2 min con 8 hilos):
  escribe `public/resultados/estudio.json` y los CSV
- `npm run estudio-navegador` — corre el estudio en Chrome headless (Web Workers) y compara sus
  decisiones con el JSON (con `npm run dev` corriendo)
- `npm run complementos` — análisis complementarios del #5 (regla dejando uno afuera, mecanismo
  R = 500, modelo fluido contra eventos discretos; ~100 s): escribe `public/resultados/complementos.json`
  y `regla-loo.csv`, `mecanismo.csv`, `fluido.csv`
- `npm run capturas [-- filtro]` — capturas de `docs/capturas/` con Chrome headless (con `npm run dev` corriendo)
- `npm run medir-fps` — fps de la animación con 3 y 6 profesionales, simple y comparación (con `npm run dev`)

## Entorno

- Node 22, Vite 8, React 19, TypeScript 7, Vitest 5, zod 4, ECharts 6.
- Windows: en Bash usar `PYTHONIOENCODING=utf-8` si se imprime con Python.
