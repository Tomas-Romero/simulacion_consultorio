# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Mesa del oral de Simulación (UTN FRSR, 2026):** profesores que evalúan el proyecto integrador
  en una defensa en vivo. Conocen simulación de eventos discretos, Monte Carlo y teoría de colas;
  quieren ver el modelo funcionando, su validación y que las decisiones salgan de datos.
- **Visitantes del portfolio (GitHub Pages):** personas que no conocen el tema y llegan desde el
  GitHub de Tomás. Tienen que entender en segundos qué problema resuelve y verlo andar.
- Tomás presenta la aplicación en el oral: la usa en vivo, con proyector, delante de la mesa.

## Product Purpose

Simula un policonsultorio (agenda con turnos, ausentismo, puntualidad, demanda espontánea,
admisión, sala de espera, consultorios) para decidir **cuántos sobreturnos** dar y **dónde
ubicarlos** en la agenda. El criterio único de decisión es el beneficio neto esperado
B = ingresos − c_espera·espera − c_extra·extra − c_perdido·perdidos; el costo clásico C se informa
como contraste. Éxito: que la mesa y el visitante vean, con datos reales del modelo, por qué
sobrereservar compensa el ausentismo y dónde deja de convenir.

## Positioning

No es un juguete animado: la animación reproduce la traza autocontenida de un modelo de eventos
discretos validado (M/M/c, M/G/1, Little, red en serie) y calibrado contra metas fijadas a priori.
Con números aleatorios comunes, dos escenarios con la misma semilla tienen exactamente los mismos
pacientes: la comparación lado a lado aísla el efecto de los sobreturnos.

## Operating Context

- Defensa oral con proyector (pantalla ancha, a veces con poca luz o mucha) y portfolio en
  escritorio; tablet usable; celular con animación simplificada.
- Sin backend: todo corre en el navegador; las corridas pesadas en Web Workers.
- Escenarios importables/exportables como JSON validado con zod (paso #6).
- Página de diagnóstico (/diagnostico) con la validación del motor, para mostrar en el oral.

## Capabilities and Constraints

- Motor (`src/motor/`) y modelo (`src/modelo/`) CONGELADOS: la UI no cambia su comportamiento.
- Presets congelados: consultorio chico (1 médico), policonsultorio (3, por defecto), centro (6).
- Clases de paciente: turno, sobreturno, tardío, espontáneo, urgencia. Pérdidas: tardío
  rechazado, abandono, fuera de horario, sin profesional. Ausentes no son pérdidas.
- Reproducible con semilla; nunca `Math.random` en el modelo.
- Plan: #3 interfaz y animación (este paso) · #4 experimentos Monte Carlo y k* · #5 dinámica de
  sistemas · #6 import/export, reportes, deploy e informe. Las secciones #4–#6 existen como
  pantallas vacías con su descripción hasta su paso.
- Todos los datos son ficticios y se marcan como supuestos.

## Brand Commitments

- Identidad **TARC Tech** adaptada a un contexto médico: base zinc, modo claro y oscuro;
  cian #06B6D4 para datos, verde #10B981 para lo positivo, naranja #F97316 para acentos de marca
  y acciones; Fira Sans (interfaz) y Fraunces (títulos destacados). Pinned por el brief.
- Crédito TARC Tech con su isotipo en el pie y en "Acerca de" (`public/marca/`).
- Autoría configurable; valor por defecto **"Tomás Romero · TARC Tech"**.
- Todo el texto en español; números con formato es-AR.

## Evidence on Hand

- Modelo validado y calibrado: `docs/modelo-conceptual.md`, `docs/calibracion.md`.
- Barrido de control #2d (policonsultorio, 1000 días): k*_B = 2–3 (empate), k*_C = 1.
- Isotipo TARC Tech en PNG.
- No hay usuarios reales, testimonios ni datos reales de consultorios: no inventarlos.

## Product Principles

1. Los números salen del modelo: nada en pantalla se calcula aparte ni se inventa.
2. Mostrar el mecanismo antes que la conclusión: ver a los pacientes moverse, faltar y esperar.
3. Comparar con la misma semilla: la diferencia que se ve es el efecto de la decisión.
4. Legible en un proyector: jerarquía clara, contraste alto, color nunca como único código.
5. Honesto con las limitaciones (abandono fuera de meta, datos ficticios).

## Accessibility & Inclusion

- Navegable con teclado; clase del paciente codificada por color y por forma.
- Respeta `prefers-color-scheme` y `prefers-reduced-motion`.
