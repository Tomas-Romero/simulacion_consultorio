---
name: Sobreturnos
description: Simulación de un policonsultorio para decidir cuántos sobreturnos dar y dónde ubicarlos.
colors:
  cian-dato: "#06b6d4"
  cian-dato-texto: "#0e7490"
  cian-dato-suave: "#ecfeff"
  verde-positivo: "#10b981"
  verde-positivo-texto: "#047857"
  verde-positivo-suave: "#ecfdf5"
  naranja-accion: "#f97316"
  naranja-accion-hover: "#ea580c"
  naranja-accion-texto: "#c2410c"
  naranja-accion-suave: "#fff7ed"
  tinta-sobre-accion: "#1c0a00"
  rojo-alerta: "#dc2626"
  rojo-alerta-texto: "#b91c1c"
  rojo-alerta-suave: "#fef2f2"
  clase-tardio: "#a16207"
  clase-espontaneo: "#8b5cf6"
  clase-urgencia: "#ef4444"
  zinc-fondo: "#fafafa"
  zinc-panel: "#ffffff"
  zinc-panel-2: "#f4f4f5"
  zinc-panel-3: "#e4e4e7"
  zinc-borde: "#e4e4e7"
  zinc-borde-fuerte: "#d4d4d8"
  zinc-texto: "#18181b"
  zinc-texto-2: "#52525b"
  zinc-texto-3: "#71717a"
  plano-muro: "#a1a1aa"
  plano-texto: "#3f3f46"
  oscuro-fondo: "#09090b"
  oscuro-panel: "#18181b"
  oscuro-panel-2: "#1f1f23"
  oscuro-borde: "#27272a"
  oscuro-borde-fuerte: "#3f3f46"
  oscuro-texto: "#f4f4f5"
  oscuro-texto-2: "#a1a1aa"
  oscuro-texto-3: "#8b8b94"
  oscuro-dato-texto: "#22d3ee"
  oscuro-positivo-texto: "#34d399"
  oscuro-accion-texto: "#fb923c"
  oscuro-alerta-texto: "#f87171"
typography:
  placa:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "4.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "'opsz' 144"
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "3.25rem"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.018em"
    fontVariation: "'opsz' 144"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 96"
  headline-sm:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
    fontVariation: "'opsz' 72"
  title:
    fontFamily: "Fira Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title-sm:
    fontFamily: "Fira Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: "Fira Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'kern', 'liga'"
  body-sm:
    fontFamily: "Fira Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Fira Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  label-grupo:
    fontFamily: "Fira Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  chico: "4px"
  base: "6px"
  pildora: "999px"
spacing:
  e-1: "4px"
  e-2: "8px"
  e-3: "12px"
  e-4: "16px"
  e-5: "24px"
  e-6: "32px"
  e-7: "48px"
  e-8: "64px"
components:
  button-primary:
    backgroundColor: "{colors.naranja-accion}"
    textColor: "{colors.tinta-sobre-accion}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.naranja-accion-hover}"
    textColor: "{colors.tinta-sobre-accion}"
  button-primary-grande:
    backgroundColor: "{colors.naranja-accion}"
    textColor: "{colors.tinta-sobre-accion}"
    typography: "{typography.body}"
    rounded: "{rounded.base}"
    padding: "0 24px"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.zinc-panel}"
    textColor: "{colors.zinc-texto}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "38px"
  button-secondary-activo:
    backgroundColor: "{colors.naranja-accion-suave}"
    textColor: "{colors.naranja-accion-texto}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.zinc-texto-2}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "38px"
  button-ghost-hover:
    backgroundColor: "{colors.zinc-panel-2}"
    textColor: "{colors.zinc-texto}"
  input-field:
    backgroundColor: "{colors.zinc-panel}"
    textColor: "{colors.zinc-texto}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "38px"
  input-field-error:
    backgroundColor: "{colors.rojo-alerta-suave}"
    textColor: "{colors.zinc-texto}"
  panel:
    backgroundColor: "{colors.zinc-panel}"
    textColor: "{colors.zinc-texto}"
    rounded: "{rounded.base}"
    padding: "16px"
  placa-numero:
    backgroundColor: "{colors.zinc-texto}"
    textColor: "{colors.zinc-panel}"
    typography: "{typography.placa}"
    rounded: "{rounded.base}"
    width: "72px"
    height: "88px"
  placa-mini:
    backgroundColor: "{colors.zinc-texto}"
    textColor: "{colors.zinc-panel}"
    rounded: "{rounded.chico}"
    height: "22px"
  placa-letra:
    backgroundColor: "{colors.naranja-accion}"
    textColor: "{colors.tinta-sobre-accion}"
    rounded: "{rounded.chico}"
    height: "22px"
  reloj:
    backgroundColor: "{colors.zinc-texto}"
    textColor: "{colors.zinc-panel}"
    typography: "{typography.headline}"
    rounded: "{rounded.base}"
    padding: "6px 12px"
  aviso-error:
    backgroundColor: "{colors.rojo-alerta-suave}"
    textColor: "{colors.rojo-alerta-texto}"
    rounded: "{rounded.base}"
    padding: "12px 16px"
---

# Design System: Sobreturnos

## Overview

**Creative North Star: "La señalética del policonsultorio"**

La interfaz se lee como la cartelería de un centro de salud: placas oscuras numeradas que nombran consultorios y escenarios, rótulos de zona en la planta, flechas de recorrido que indican el paso siguiente y pictogramas de forma fija para cada clase de paciente. Las superficies son paneles zinc lisos, sin relieve, con bordes de 1px y esquinas de 6px, como chapas atornilladas a una pared. La jerarquía no la dan las tarjetas apiladas sino las placas, las reglas gruesas que abren cada sección y las cifras monumentales en Fraunces.

La densidad es de instrumento: el usuario opera (reproduce un día, mueve la línea de tiempo, compara dos agendas) y los números del modelo están siempre a la vista con cifras tabulares. Fraunces aparece solo donde la señalética pondría un número grande o un título de cartel; todo lo demás es Fira Sans. El color es funcional y escaso: cian para el dato, verde para lo positivo, naranja para la acción y el "usted está aquí". El sistema funciona en claro y oscuro con los mismos roles, y tiene que leerse en un proyector con luz adversa.

La identidad rechaza explícitamente el dashboard de tarjetas genérico (la tesis del contrato de dirección): nada de grillas de tarjetas con métricas sueltas, sombras flotantes ni gradientes decorativos.

**Key Characteristics:**
- Placas oscuras (texto zinc 900 sobre fondo, o al revés en oscuro) con números en Fraunces como identificador primario de consultorios, escenarios, pasos y el reloj.
- Reglas superiores de 3px en color de texto para abrir secciones; un solo nivel de contenedor debajo.
- Paneles planos de 1px de borde y 6px de radio; sin sombras en reposo.
- Cinco pictogramas de clase (círculo, rombo, triángulo, cuadrado, cruz): el color nunca es el único código.
- Naranja reservado a la acción, al estado activo y al cursor temporal.
- Cifras tabulares en todo número que cambia.

## Colors

Base zinc neutra con tres tonos de marca TARC Tech de roles fijos; cada rol tiene un relleno puro, una variante de texto con contraste suficiente y un fondo suave.

### Primary
- **Cian dato** (relleno `cian-dato`; texto `cian-dato-texto`, `oscuro-dato-texto` en modo oscuro; fondo `cian-dato-suave`): todo lo que es medición del modelo. Líneas y barras de los minigráficos, la curva de B, el estado "atendiendo" de un médico, los enlaces, el recuadro de dato derivado (c_ocio, c_extra) y la clase "turno".

### Secondary
- **Naranja acción** (relleno `naranja-accion`, hover `naranja-accion-hover`; texto `naranja-accion-texto`; fondo `naranja-accion-suave`): botones primarios, la pestaña activa de la navegación, el progreso de la línea de tiempo y su cursor, el anillo de foco, el caret, las flechas de recorrido, la placa de letra (A/B) de la comparación y la clase "sobreturno". El texto sobre relleno naranja es siempre `tinta-sobre-accion`, casi negro, nunca blanco.

### Tertiary
- **Verde positivo** (relleno `verde-positivo`; texto `verde-positivo-texto`; fondo `verde-positivo-suave`): indicadores favorables, el médico libre, la validación correcta del escenario y el punto "en vivo" de la miniatura.

### Neutral
- **Zinc fondo / panel / panel-2 / panel-3** (`zinc-fondo`, `zinc-panel`, `zinc-panel-2`, `zinc-panel-3`; en oscuro `oscuro-fondo`, `oscuro-panel`, `oscuro-panel-2`): fondo de página, superficie de panel, hover de filas y botones fantasma, pista de la línea de tiempo y esqueletos de carga.
- **Borde y borde fuerte** (`zinc-borde`, `zinc-borde-fuerte`): el borde de 1px de todo panel y las reglas de tabla; el fuerte va en controles de formulario, encabezados de tabla y bordes punteados de supuestos.
- **Texto, texto-2, texto-3** (`zinc-texto`, `zinc-texto-2`, `zinc-texto-3`): contenido principal, texto secundario (bajadas, párrafos) y rótulos o notas. `zinc-texto` también es el relleno de las placas y de las reglas gruesas.
- **Planta** (`plano-muro`, `plano-texto`, más piso, sala y silla tomados de la escala zinc): colores propios del canvas, con su par oscuro en `tokens.css`.

### Alerta y clases de paciente
- **Rojo alerta** (`rojo-alerta`, `rojo-alerta-texto`, `rojo-alerta-suave`): errores de validación, pérdidas e indicadores desfavorables.
- **Clases** (turno = cian, sobreturno = naranja, `clase-tardio`, `clase-espontaneo`, `clase-urgencia`): idénticas en claro y oscuro, siempre acompañadas de su pictograma.

### Named Rules
**The Un Rol, Un Tono Rule.** Cian es dato, verde es positivo, naranja es acción y "usted está aquí", rojo es alerta. Un tono nunca cambia de rol entre pantallas, y ninguno se usa como decoración.

**The Texto Sobre Relleno Rule.** Sobre un relleno de marca se escribe con tinta oscura (`tinta-sobre-accion`); el texto coloreado sobre panel usa la variante "texto" del rol, nunca el relleno puro.

## Typography

**Display Font:** Fraunces (con Georgia, serif)
**Body Font:** Fira Sans (con system-ui, -apple-system, Segoe UI, sans-serif)

**Character:** Fraunces, con su eje óptico al máximo (opsz 144 en placas y portada), hace de letra de cartel: números de consultorio, el reloj, la cifra de B y los títulos de página. Fira Sans es la voz operativa, legible a tamaño chico y en proyector.

### Hierarchy
- **Placa** (600, 4.5rem, 1): el número de una placa de escenario y la cifra de B en Resultados. En celular baja a 3.25rem.
- **Display** (600, 3.25rem, 1.04): el titular de Inicio, uno por sitio. En celular baja a 2.25rem.
- **Headline** (600, 2.25rem, 1.15): títulos de página y el reloj de la simulación. **Headline-sm** (1.75rem) para subtítulos destacados y la cifra de B del panel en vivo.
- **Title** (Fira Sans 600, 1.375rem): subtítulos de sección y nombres en placas de preset. **Title-sm** (1.125rem): títulos de figura, encabezados de tabla, bajadas.
- **Body** (400, 1rem, 1.5): texto corrido, con un máximo de 70ch (52ch en la bajada de portada, con interlineado de 1.6). **Body-sm** (0.875rem): botones, navegación, filas de indicadores y tablas.
- **Label** (500, 0.8125rem): rótulos de campo, leyendas, notas, ayudas y errores.
- **Label-grupo** (600, 0.75rem, 0.06em, mayúsculas, texto-3): nombre de un grupo de indicadores dentro del panel en vivo ("Pacientes", "Ahora", "Médicos", "Acumulado del día"). Es el encabezado del grupo, no una línea sobre un título.

La escala es fija (razón ≈ 1,2): 0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 / 3.25 / 4.5rem. Los títulos llevan `text-wrap: balance`; los párrafos, `pretty`.

### Named Rules
**The Fraunces Es Cartel Rule.** Fraunces solo en números de placa, reloj, cifras clave (B, diferencias, número de figura) y títulos de página. Nunca en texto corrido, rótulos ni botones.

**The Cifra Tabular Rule.** Todo número que cambia (reloj, indicadores, tablas, ejes, campos numéricos) usa `font-variant-numeric: tabular-nums`, con formato es-AR.

**The Mayúscula Es Rótulo Rule.** Las mayúsculas espaciadas solo nombran una zona de la planta o un grupo de indicadores. Nunca van sobre un título como antetítulo.

## Layout

Contenedor centrado de hasta 1440px, con 32px arriba, 24px a los lados y 64px abajo (24/16/48 en celular). La escala de espaciado es de 4px (4, 8, 12, 16, 24, 32, 48, 64; 96 reservado); los huecos entre bloques mayores son de 48px, entre paneles hermanos de 16px y dentro de un panel de 12 a 16px.

La banda de navegación es fija arriba (56px), y los controles de la simulación y el estado de validación del editor también se pegan debajo de ella. Inicio es una portada de dos columnas (titular a la izquierda, planta en miniatura a la derecha); el editor usa un índice lateral de 180px; la simulación pone la planta junto a un panel en vivo de 300px; la comparación, dos escenas iguales lado a lado.

Puntos de quiebre observados: 1320px (la navegación compacta las secciones próximas a su número), 1100px (el panel en vivo baja debajo de la planta y la comparación se apila), 1080px (la navegación pasa a menú desplegable), 960px (todas las grillas a una columna, sin índice) y 640px (celular: tipografía de display reducida y controles en dos filas).

### Named Rules
**The Regla Gruesa Rule.** Una sección mayor se abre con una regla superior de 3px en color de texto (presets de Inicio, secciones del editor, resumen de Resultados) y debajo admite un solo nivel de contenedor. No se anidan paneles dentro de paneles.

## Elevation & Depth

El sistema es plano. La profundidad se marca con tono (fondo → panel → panel-2) y con bordes de 1px, no con sombras. La única sombra del sistema (`--sombra`, en dos capas difusas, más densa en oscuro) se reserva a capas que flotan sobre el contenido: el menú desplegable de la navegación en pantallas angostas y el tooltip de los gráficos. La banda superior usa un panel al 92% con desenfoque de fondo en lugar de sombra.

### Shadow Vocabulary
- **Flotante** (`--sombra`; ver `.impeccable/design.json`): menús y tooltips que se superponen al contenido. Nada más.

### Named Rules
**The Chapa Plana Rule.** Los paneles en reposo no tienen sombra. Si algo necesita destacarse, lleva un borde más fuerte, una regla gruesa o un fondo suave del rol, nunca relieve.

## Shapes

Esquinas apenas redondeadas y uniformes: 6px para paneles, botones, campos, placas y planta; 4px para elementos chicos (placas mini, chips de estado, opciones del segmentado, teclas, foco). Solo son circulares los indicadores puntuales (punto en vivo, cursor de la línea de tiempo, médico en la planta) y el pulgar de la barra de desplazamiento. El borde punteado significa supuesto o pendiente: la marca "Datos ficticios", el pie de costos derivados, el cupo vacío y el paciente ausente en la planta. Las flechas de recorrido (trazo redondeado de 2.2) marcan secuencia en listas y pasos.

## Components

### Buttons
Firmes y compactos, con peso 600 y sin mayúsculas.
- **Shape:** esquinas de 6px; altura de 38px (46px en la variante grande, 30px en la chica).
- **Primary:** relleno naranja con tinta oscura; uno por zona de acción. Suele llevar una flecha de recorrido al final.
- **Hover / Focus:** el primario se oscurece (`naranja-accion-hover`); al presionar baja 1px; el foco es un anillo naranja de 2px con 2px de separación. Transición de 160ms con `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Secondary:** panel con borde fuerte; en hover el borde pasa a texto-3. Su estado activo (por ejemplo "Comparar") usa fondo naranja suave, borde naranja y texto naranja.
- **Ghost:** transparente con texto-2; en hover, fondo panel-2.
- **Icon:** 38×38, transparente, para tema y menú.
- **Disabled:** opacidad 0.45.

### Placas (componente firma)
- **Placa de número:** bloque de color texto (72×88px) con el número en Fraunces 4.5rem; identifica escenarios (1, 3, 6). En pequeño, la **placa mini** (22px, 38px en tarjetas de profesional) numera consultorios y secciones próximas.
- **Placa de letra:** variante naranja con tinta oscura para A y B en la comparación.
- **Reloj:** placa con la hora del modelo en Fraunces 2.25rem; es el "usted está aquí" temporal.
- **Placas de zona en la planta:** rótulos de Admisión, Sala de espera, Entrada y Salida en mayúsculas, blanco sobre zinc oscuro con 4px de radio, con flecha de recorrido en entradas y salidas.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** panel sobre fondo; los bloques de lectura destacada (hallazgo) usan panel-2 sin borde.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** 1px de borde; en hover, cuando el panel es interactivo, pasa a borde fuerte.
- **Internal Padding:** 16px; 12/16px en cabeceras y pies divididos por reglas de 1px (puntuadas si el contenido es derivado).

### Inputs / Fields
- **Style:** 38px de alto, borde fuerte de 1px, fondo panel, 6px de radio, cifras tabulares; las unidades van como sufijo gris dentro del campo; el desplegable lleva un chevrón dibujado con borde.
- **Focus:** el borde pasa a naranja y aparece un halo naranja de 3px al 22%.
- **Error:** borde rojo, fondo rojo suave y el mensaje (0.8125rem, 500) junto al campo; además, un aviso arriba de la página.
- **Segmentado:** grupo con fondo panel-2 y borde; la opción elegida es una pastilla de panel con un borde interno de 1px.

### Navigation
- **Banda:** 56px, fija, panel translúcido con desenfoque y borde inferior. A la izquierda, la marca (placa oscura de 32px con la cruz naranja y el nombre en Fraunces).
- **Ítems:** Fira Sans 0.875rem 500 en texto-2; el activo pasa a texto y 600 y muestra una barra naranja de 3px pegada al borde inferior, que se expande con la transición estándar.
- **Secciones próximas:** agrupadas tras un divisor, en texto-3 y con su placa de número de paso (#4, #5, #6).
- **Móvil (≤1080px):** menú desplegable bajo la banda; la barra activa pasa a vertical, a la izquierda.

### Planta animada (componente firma)
Canvas que dibuja el policonsultorio con los colores `plano-*` y la paleta leída de los tokens, de modo que cambia de tema sin repintar a mano. Consultorios con placa numerada en Fraunces, médico como anillo (cian si atiende, verde si está libre, punteado si todavía no llegó), barra de agenda por consultorio y pacientes como pictogramas de clase con borde del color del panel. El movimiento se suaviza en tiempo real; con `prefers-reduced-motion` se reubica sin deslizar.

### Figuras y tablas
- **Figura:** panel con número de figura en Fraunces naranja, título 1.125rem 600 y descripción en texto-3, con un máximo de 70ch.
- **Tabla:** filas de 9px × 12px con regla inferior de 1px, encabezado en texto-3 a 0.8125rem sobre una regla fuerte, total con regla superior fuerte y hover en panel-2; los números van alineados a la derecha.

## Do's and Don'ts

### Do:
- **Do** numerar con placas oscuras en Fraunces todo lo que la cartelería numeraría: escenarios, consultorios, pasos y el reloj.
- **Do** acompañar cada color de clase con su pictograma (círculo turno, rombo sobreturno, triángulo tardío, cuadrado espontáneo, cruz urgencia), tanto en el canvas como en las leyendas en SVG.
- **Do** abrir las secciones mayores con la regla superior de 3px en color de texto y mantener un único nivel de contenedor debajo.
- **Do** usar flechas de recorrido naranjas para indicar secuencia o el siguiente paso.
- **Do** marcar con borde punteado y texto-3 todo lo que es supuesto o derivado ("Datos ficticios · supuestos del modelo").
- **Do** usar cifras tabulares y formato es-AR en todo número que cambie.
- **Do** definir cada color nuevo como token con su par claro/oscuro en `tokens.css`; el canvas lee los tokens, no valores sueltos.

### Don't:
- **Don't** armar grillas de tarjetas de métricas al estilo dashboard genérico; las cifras viven en listas regladas, placas o el panel en vivo.
- **Don't** poner sombras a paneles en reposo; `--sombra` es solo para menús y tooltips flotantes.
- **Don't** usar naranja para decorar ni cian para acciones; cada tono conserva su rol.
- **Don't** escribir texto blanco sobre relleno naranja; va `tinta-sobre-accion`.
- **Don't** poner antetítulos en mayúsculas sobre los títulos; las mayúsculas espaciadas solo nombran zonas de la planta o grupos de indicadores.
- **Don't** usar Fraunces en texto corrido, botones o rótulos.
- **Don't** codificar información solo con color.
