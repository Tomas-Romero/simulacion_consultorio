# Diseño de la interfaz (paso #3)

> Documento de diseño escrito antes de programar la interfaz. La identidad visual viene fijada
> por el proyecto (TARC Tech en contexto médico); acá se decide cómo se aplica.
> La interacción toma como referencia los visualizadores de la playa de combustibles de
> Investigación Operativa (canvas animado, panel de indicadores, línea de tiempo, comparación
> sincronizada). De esos visualizadores se toma la interacción, no los colores.

## 1. Idea rectora: la señalética de un policonsultorio

Toda la aplicación habla el idioma de la cartelería de un hospital:

- **Placas numeradas.** Cada consultorio es una placa con su número en grande (Fraunces). Las
  cifras clave del día (B, atendidos, k) se muestran igual, como números de placa.
- **Pictogramas.** Cada clase de paciente tiene su forma y su color: el color nunca es el único
  código.
- **"Usted está aquí."** La navegación es una banda de señalética: la sección actual lleva la
  marca naranja.
- **Recorrido.** El canvas es la planta del edificio, con la misma señalética: entrada →
  admisión → sala de espera → consultorios → salida.

Se descartó un dashboard de tarjetas iguales: no dice nada del dominio y en un proyector se
vuelve una grilla de rectángulos idénticos.

**Modo de uso:** operar. La persona está haciendo una tarea: editar un escenario, mirar el día,
comparar. Inicio y Acerca de tienen algo de presentación, pero con la misma gramática.

**Escena física:** Tomás proyecta la aplicación en un aula, delante de la mesa del oral; después la
visitan desde el portfolio en un escritorio. En los proyectores el modo claro se lee mejor, así
que es el predeterminado si el sistema no pide otro. El selector permite oscuro (sala a oscuras,
uso nocturno) y respeta `prefers-color-scheme`.

## 2. Arquitectura de información

SPA con rutas por hash, para que funcione en GitHub Pages sin configurar el servidor:

| Ruta | Pantalla | Contenido |
|---|---|---|
| `#/` | Inicio | Problema, uso en 3 pasos, planta en miniatura en vivo, presets |
| `#/escenario` | Escenario | Editor del escenario con validación en vivo |
| `#/simulacion` | Simulación del día | Planta animada, controles, panel en vivo, modo comparación |
| `#/resultados` | Resultados del día | Gantt, sala en el tiempo, esperas, desglose de B y C, tabla |
| `#/experimentos` | Experimentos (#4) | Pantalla vacía con su descripción |
| `#/dinamica` | Dinámica de sistemas (#5) | Pantalla vacía con su descripción |
| `#/datos` | Datos (#6) | Pantalla vacía con su descripción |
| `#/acerca` | Acerca de | Proyecto, temas, metodología, validación, autoría, crédito |
| `#/diagnostico` | Diagnóstico | Página de validación del motor (paso #1), para el oral |

**Parámetros de la URL** (después de `?` dentro del hash), para compartir un estado y para las
capturas automáticas:

- `tema=claro|oscuro`;
- `t=HH:MM` (hora inicial de la animación);
- `comparar=1`;
- `vel=N`.

**Flujo:** Inicio → (preset) → Escenario → Simulación del día → Resultados del día. El escenario
activo y su simulación del día viven en un estado global compartido: simulación y resultados
muestran la misma corrida.

## 3. Wireframes

### 3.1 Estructura común

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ [isotipo] Sobreturnos   Inicio  Escenario  Simulación  Resultados │ #4 #5 #6 │ Acerca  ◐ │  ← banda de señalética
│                                 ▔▔▔▔▔▔▔▔▔ (naranja = usted está aquí)                │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│                                   contenido                                          │
│                                                                                      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Tomás Romero · TARC Tech · UTN FRSR 2026         [isotipo] Diseño y desarrollo TARC Tech │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Debajo de 900 px la banda se vuelve un menú desplegable. La marca "usted está aquí" queda en el
título de la sección.

### 3.2 Inicio

```
┌───────────────────────────────────────┬──────────────────────────────────────────────┐
│ ¿Cuántos sobreturnos                  │  ┌ planta en miniatura (canvas en vivo) ──┐ │
│ conviene dar?            (Fraunces)   │  │ entrada · admisión · sala · consult. 1–3 │ │
│                                       │  └────────────────────────────────────────┘ │
│ Uno de cada siete pacientes falta.    │   10:42 · policonsultorio · k = 0 → 3        │
│ Sobrerreservar recupera esas horas,   │                                              │
│ pero alarga la espera y las horas     │                                              │
│ extra. El simulador busca el punto…   │                                              │
│ [Abrir el policonsultorio →]  (naranja)                                              │
├───────────────────────────────────────┴──────────────────────────────────────────────┤
│  1 Elegí un escenario  →  2 Mirá el día  →  3 Compará con la misma semilla           │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  ┌ placa 1 ──────────┐  ┌ placa 3 ──────────┐  ┌ placa 6 ──────────┐                  │
│  │ Consultorio chico │  │ Policonsultorio   │  │ Centro completo   │   ← presets como  │
│  │ 1 médico · mañana │  │ 3 prof. · defecto │  │ 6 profesionales   │     placas con el │
│  │ [Usar →]          │  │ [Usar →]          │  │ [Usar →]          │     número grande │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Escenario (editor)

```
┌ Escenario: Policonsultorio (3 profesionales) ─────────── [Preset ▾] [Semilla ____] [Restaurar] ┐
│ ● válido · se guarda solo en este navegador                       [Simular este escenario →]  │
├─ índice ─────┬────────────────────────────────────────────────────────────────────────────────┤
│ Profesionales│  Profesionales (3 de 6)                                        [+ Agregar]   │
│ Pacientes    │  ┌ 1 ─────────────┐ ┌ 2 ─────────────┐ ┌ 3 ─────────────┐                     │
│ Ausentismo   │  │ Clínica mañana │ │ Pediatría      │ │ Clínica tarde  │                     │
│ Espontáneos  │  │ esp ▾ turno ▾  │ │ …              │ │ …              │                     │
│ Admisión     │  │ D ▾ cupos 1/N  │ │                │ │                │                     │
│ Sobreturnos  │  │ c_ocio c_extra │ │                │ │                │                     │
│ Costos       │  └────────────────┘ └────────────────┘ └────────────────┘                     │
│ (sticky)     │  Pacientes · Ausentismo [curva logística] · Espontáneos [perfil por hora] …   │
└──────────────┴────────────────────────────────────────────────────────────────────────────────┘
```

Los errores aparecen junto al campo, con el mensaje de zod traducido a lenguaje del dominio.
Mientras haya errores, la simulación sigue usando el último escenario válido y la barra superior
lo avisa.

### 3.4 Simulación del día

```
┌ [▶] [⟲] Velocidad [120× ▾]   10:42  ═══════════●══════════════════════  [ ] Comparar ─┐
│                              08 09 10 11 12 13 14 15 16 17 18 19 20 21               │
├──────────────────────────────────────────────────────────────┬───────────────────────┤
│  ENTRADA → ADMISIÓN [1][2]                       ┌─1─┐ ┌─2─┐ │ Pacientes             │
│     ○◇△ cola              SALA DE ESPERA         │Dr │ │Dr │ │  llegadas  …          │
│                           ▢ ▢ ▢ ▢ ▢ ▢            │ ● │ │ ● │ │  atendidos …          │
│                           ▢ ▢ ▢ ▢ ▢ ▢            │███│ │█  │ │  ausentes  …          │
│                           ▢ ▢ ▢ ▢ ▢ ▢            └───┘ └───┘ │  perdidos por motivo  │
│                                                  ┌─3─┐ ┌─4─┐ │ Ahora: en sala, cola  │
│                                                  …         │ │ Médicos: ocio, extra  │
│                                           SALIDA →           │ B y C acumulados ~~~  │
├──────────────────────────────────────────────────────────────┴───────────────────────┤
│ Leyenda: ● turno  ◆ sobreturno  ▲ tardío  ■ espontáneo  ✚ urgencia · anillo = paciencia │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

En **modo comparación** hay dos plantas lado a lado, con el mismo reloj y un panel compacto cada
una. Arriba se elige qué cambia en B: k y política de los sobreturnos. Al final se muestra ΔB.

**Atajos de teclado:**

| Tecla | Acción |
|---|---|
| Espacio | Reproducir o pausar |
| ← / → | ±5 min |
| Shift + ← / → | ±30 min |
| ↑ / ↓ | Velocidad |
| Inicio / Fin | Principio o final del día |

**En celular:** se dibuja una planta simplificada (sin sillas ni agenda; los pacientes como
puntos), con el panel debajo. La comparación se apila en vertical.

### 3.5 Resultados del día

```
┌ Resultados del día · Policonsultorio · semilla 2026 ─────────────────────────────────┐
│ B $ 1.349.058 (Fraunces) · C $ 774.605 · atendidos 59 · espera media 17,2 min        │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Fig. 1  Gantt por profesional                                            [PNG ↓]     │
│ P1 ▕██▏▕███▏ ▕█▏···ocio···▕██▏│░extra░                                                │
├──────────────────────────────────────────┬───────────────────────────────────────────┤
│ Fig. 2  Pacientes en sala                │ Fig. 3  Espera por clase                  │
├──────────────────────────────────────────┼───────────────────────────────────────────┤
│ Fig. 4  Desglose de B                    │ Fig. 5  Desglose de C                     │
├──────────────────────────────────────────┴───────────────────────────────────────────┤
│ Tabla por profesional                                                                │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.6 Experimentos / Dinámica / Datos

Una placa grande con el número del paso (#4, #5, #6), qué va a contener y qué preguntas va a
responder. Sin contenido falso.

### 3.7 Acerca de

Texto en columna de lectura (65–75 caracteres):

- el proyecto;
- los temas de la materia aplicados;
- la metodología;
- la validación, con enlace a `#/diagnostico`;
- las limitaciones;
- la autoría, que es configurable;
- el crédito de TARC Tech con su isotipo.

## 4. Sistema de diseño

### 4.1 Color (tokens como variables CSS en `src/ui/estilos/tokens.css`)

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--fondo` | zinc-50 `#fafafa` | zinc-950 `#09090b` | fondo de página |
| `--panel` | `#ffffff` | zinc-900 `#18181b` | placas y paneles |
| `--panel-2` | zinc-100 `#f4f4f5` | zinc-800/60 `#1f1f23` | segunda capa (barras, índices) |
| `--borde` | zinc-200 `#e4e4e7` | zinc-800 `#27272a` | bordes de 1 px |
| `--borde-fuerte` | zinc-300 `#d4d4d8` | zinc-700 `#3f3f46` | separadores marcados |
| `--texto` | zinc-900 `#18181b` | zinc-100 `#f4f4f5` | texto principal |
| `--texto-2` | zinc-600 `#52525b` | zinc-400 `#a1a1aa` | texto secundario (≥ 4,5:1) |
| `--texto-3` | zinc-500 `#71717a` | zinc-500 `#8b8b94` | rótulos, ejes |
| `--dato` | cian `#06B6D4` / texto `#0e7490` | `#22d3ee` | color principal de datos |
| `--positivo` | verde `#10B981` / texto `#047857` | `#34d399` | lo positivo (B que sube, atendidos) |
| `--accion` | naranja `#F97316` / texto `#c2410c` | `#fb923c` | acciones, marca, "usted está aquí" |
| `--alerta` | `#dc2626` | `#f87171` | errores, pérdidas |

Cuando el color va como texto sobre fondo claro se usa la variante oscura del mismo tono (cian
700, verde 700, naranja 700), para llegar a 4,5:1. Las superficies grandes son zinc: el color se
reserva para datos, estados y acciones (estrategia restringida, propia de una herramienta).

**Clases de paciente.** Paleta categórica: forma y color; el color de cada clase es igual en los
dos modos.

| Clase | Forma | Color | Por qué |
|---|---|---|---|
| Turno | círculo | cian `#06B6D4` | el dato base |
| Sobreturno | rombo | naranja `#F97316` | la variable de decisión: acento |
| Tardío | triángulo | ocre `#A16207` | advertencia leve (validado: el ámbar `#EAB308` quedaba muy claro y muy cerca del naranja) |
| Espontáneo | cuadrado | violeta `#8B5CF6` | demanda no agendada |
| Urgencia | cruz | rojo `#EF4444` | prioridad máxima |

Ausente: silla o slot con contorno punteado y una barra cruzada, sin relleno.

### 4.2 Tipografía

- **Fira Sans** (400, 500, 600, 700) para toda la interfaz, con `font-variant-numeric:
  tabular-nums` en datos y tablas.
- **Fraunces** (variable `opsz` 9–144, 400–700) solo para títulos destacados, números de placa
  y cifras clave. Nunca en rótulos ni botones.
- Escala fija en rem, razón ≈ 1,2: 0,75 · 0,8125 · 0,875 · 1 · 1,125 · 1,375 · 1,75 · 2,25 ·
  3,25 · 4,5 (placas). Interlineado 1,5 en texto y 1,1 en títulos.

### 4.3 Espaciado y forma

- Escala de 4 px: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
- Bordes de 1 px; radio de 6 px en placas y controles, 4 px en chips, 999 px solo en
  interruptores.
- Sombra única para lo que flota (menús, tooltips): `0 8px 24px -8px` con alfa baja. Las placas
  no llevan sombra: son cartelería plana.

### 4.4 Componentes

| Componente | Cómo es |
|---|---|
| `BandaNavegacion` | Banda superior con la marca naranja de "usted está aquí" |
| `Placa` | Panel de cartelería con número opcional en Fraunces |
| `Boton` | Variantes primaria (naranja), secundaria (borde) y fantasma; estados hover, focus, active, disabled y cargando |
| `Campo` | Rótulo, control, ayuda y error; incluye número, select, rango y casilla |
| `Pictograma` | SVG de la clase de paciente |
| Íconos | SVG propios, trazo 1,75 px |
| `MiniGrafico` | SVG para la logística y el perfil por hora; canvas para B y C en vivo |
| `Figura` | Marco numerado (Fig. N) con título, gráfico ECharts y botón de exportar PNG |

Los bordes de foco son un anillo naranja de 2 px con 2 px de separación, siempre visible al
navegar con teclado (`:focus-visible`). También se tematizan la selección de texto, el
`accent-color` de los controles nativos y las barras de desplazamiento.

### 4.5 Movimiento

- Transiciones de interfaz de 150–200 ms con ease-out.
- El único movimiento con autoría es la animación del día. Los pacientes se deslizan entre
  etapas con interpolación exponencial: posiciones suavizadas en tiempo real, así que se ven
  fluidos a cualquier velocidad. Al arrastrar la línea de tiempo se reposicionan sin
  interpolar.
- Con `prefers-reduced-motion` se desactiva la interpolación y la miniatura de Inicio arranca
  en pausa.

## 5. Arquitectura técnica

```
src/ui/
  app/            App, rutas por hash, estado global (escenario, corridas), tema
  componentes/    Banda, Placa, Boton, Campo, Pictograma, Iconos, Figura, MiniGraficos
  estilos/        tokens.css (variables), base.css, componentes.css
  paginas/        Inicio, Escenario, Simulacion, Resultados, Proximamente, Acerca
  animacion/      preparar.ts (traza → datos de animación, puro), plano.ts (geometría),
                  dibujo.ts (canvas), reproductor.ts (reloj y rAF), indicadores.ts (panel en vivo)
  trabajador/     simulacion.worker.ts (corre simularDia con traza)
  diagnostico/    página del paso #1, sin cambios funcionales
```

**Simulación:** un Web Worker recibe `{escenario, semilla, réplica}` y devuelve
`{traza, métricas, pacientes, paciencias}`. La paciencia de cada espontáneo se obtiene de
`generarDia`, que es determinista para la misma semilla y réplica (no se toca el modelo). La
animación reproduce esa traza autocontenida y no vuelve a simular.

**Reproductor:** reloj en minutos del modelo con un bucle `requestAnimationFrame`.

- El canvas se dibuja en cada cuadro.
- El panel y la línea de tiempo se actualizan unas 10 veces por segundo, con
  `useSyncExternalStore`, así React no renderiza 60 veces por segundo.
- Canvas con `devicePixelRatio` y el fondo estático (planta, sillas, placas) en un canvas
  aparte, cacheado.

**Indicadores en vivo:** se calculan a partir de la traza en función de t (llegadas, atendidos,
ausentes, pérdidas, en sala, ocio y extra por médico, B(t) y C(t)). Al final del día coinciden
exactamente con las métricas del modelo; lo controla un test nuevo.

## 6. Librerías

| Librería | Decisión |
|---|---|
| React 19, zod 4 | Ya estaban |
| ECharts 6 | Ya elegida en el #1. Se importa por módulos (`echarts/core` con barras, líneas, dispersión, boxplot, custom y renderer canvas) para no cargar la librería completa, y en un *chunk* aparte que solo baja Resultados |
| Enrutador | Propio, unas 40 líneas con `hashchange`. No hace falta react-router para 9 rutas |
| Formularios | Propios, validados con los esquemas zod existentes |
| Íconos | SVG propios: sin dependencia y con un trazo coherente |
| Fuentes | Google Fonts (Fira Sans, Fraunces) |
| Capturas | Edge en modo headless (`--screenshot`), ya instalado en Windows. No se agrega Playwright ni Puppeteer |

**Resultado: ninguna dependencia nueva.**
