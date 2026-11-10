# Capturas de la interfaz (pasos #3 a #6)

Generadas con Chrome sin interfaz (`--headless=new`, protocolo DevTools). Viewport de 1440 × 900
salvo indicación; "página completa" = captura de toda la altura. Escenarios en sus valores
predefinidos (congelados) y semilla 2026.

| Archivo | Qué muestra |
|---|---|
| `01-inicio-claro.png` | Inicio, primera pantalla: la pregunta, la bajada, las acciones y la planta en miniatura en vivo (policonsultorio con 3 sobreturnos) |
| `02-inicio-oscuro.png` | Lo mismo en modo oscuro |
| `03-inicio-completo-claro.png` | Inicio completo: cómo se usa en 3 pasos, los tres escenarios como placas y lo que muestra el modelo |
| `04-escenario-claro.png` | Editor completo: profesionales (tarjetas con c_ocio y c_extra derivados), pacientes, ausentismo con la curva logística, espontáneos con el perfil por hora, admisión, sobreturnos y costos (página completa) |
| `05-escenario-oscuro.png` | Editor en modo oscuro |
| `06-escenario-error-claro.png` | Validación en vivo: un campo inválido (primera vez = 140 %) con el error junto al campo y el aviso arriba |
| `07-simulacion-policonsultorio-claro.png` | Simulación del día, policonsultorio a las 10:40: planta, agenda de cada consultorio y panel en vivo |
| `08-simulacion-centro-oscuro.png` | Simulación del día, centro de 6 profesionales a las 11:10, modo oscuro |
| `09-comparacion-policonsultorio-claro.png` | Comparación sincronizada: el mismo día sin sobreturnos (A) y con k = 3 intercalados (B), misma semilla |
| `10-comparacion-centro-oscuro.png` | Comparación con el centro de 6 profesionales, modo oscuro |
| `11-resultados-claro.png` | Resultados del día: resumen, Gantt por profesional, pacientes en sala, espera por clase, desglose de B y C y tabla por profesional (página completa) |
| `12-resultados-oscuro.png` | Resultados del día en modo oscuro (página completa) |
| `13-acerca-claro.png` | Acerca de: problema, temas de la materia, metodología y validación, limitaciones, autoría y crédito TARC Tech (página completa) |
| `14-datos-oscuro.png` | Datos (paso #6), primera pantalla en modo oscuro: escenario en JSON |
| `15-diagnostico-claro.png` | Página de diagnóstico del paso #1 integrada al sitio (`#/diagnostico`) |
| `16-movil-inicio-claro.png` | Inicio en celular (390 px, página completa) |
| `17-movil-simulacion-oscuro.png` | Simulación en celular: planta simplificada y panel debajo (390 px, página completa) |
| `18-tablet-simulacion-claro.png` | Simulación en tablet (820 × 1180) |
| `19-experimentos-claro.png` | Experimentos (paso #4): cabecera con semilla, R, hilos, duración y huella del estudio, y el índice de secciones |
| `20-exp-a-curva-claro.png` | a) Curva B(k): pequeños múltiplos por escenario con banda de IC y conjunto óptimo, tabla del mejor k y precisión (semiancho contra R, log-log) |
| `21-exp-b-politicas-claro.png` | b) Políticas: cada política en su mejor k con IC, balance espera/ocio, diferencias pareadas con Bonferroni y (#5) el mecanismo: perfiles de ocio y espera por franja de 30 min y totales por día |
| `22-exp-c-sensibilidad-claro.png` | c) Sensibilidad: k óptimo según el ausentismo, mapa de calor ausentismo × costo de hora extra, efecto de c_extra y de c_espera |
| `23-exp-d-regla-claro.png` | d) Regla práctica: fórmulas, k óptimo contra p̄·N̄ con las dos reglas, pérdida esperada por usarlas y (#5) la regla corregida por espontáneos con validación dejando un escenario afuera |
| `24-exp-e-riesgo-claro.png` | e) Riesgo: distribución diaria de B(k) − B(0) y P(B(k) < B(0)) |
| `25-exp-f-laboratorio-claro.png` | f) Laboratorio: experimento a medida corrido en vivo con Web Workers |
| `26-exp-a-curva-oscuro.png` | a) Curva B(k) en modo oscuro |
| `27-exp-c-sensibilidad-oscuro.png` | c) Sensibilidad en modo oscuro |
| `28-ds-estructura-claro.png` | Dinámica de sistemas (paso #5): diagrama causal con los lazos R1, B1, B2, B3 y diagrama de stocks y flujos |
| `29-ds-politicas-claro.png` | Tres políticas (k = 0, k fijo = 2, k adaptativo) ante un pico de demanda: L, anticipación, ausentismo, atendidos, perdidos, beneficio acumulado, resumen y k semanal |
| `30-ds-fluido-claro.png` | Modelo fluido del día contra la media de 500 días de eventos discretos (k = 0 y k = 2) y la subestimación de la espera |
| `31-ds-numerico-claro.png` | Convergencia Euler/RK4 según dt y equilibrio analítico contra simulado |
| `32-ds-estructura-oscuro.png` | Diagramas de la dinámica en modo oscuro |
| `33-ds-politicas-oscuro.png` | Tres políticas en modo oscuro |
| `34-ds-sensibilidad-claro.png` | Sensibilidad de la dinámica (#6): tornados de la ventaja del adaptativo en beneficio y en perdidos, y tabla de qué política gana en cada variante |
| `35-datos-tiempos-claro.png` | Datos: ajuste de los tiempos de atención de ejemplo (tabla MV, KS, χ²), histograma con densidades, QQ y vista previa de lo que cambia en el escenario |
| `36-datos-asistencia-claro.png` | Datos: regresión logística del ausentismo (β₀, β₁ con EE e IC) y proporciones observadas con IC de Wilson |
| `37-datos-tiempos-oscuro.png` | Ajuste de tiempos en modo oscuro |
| `38-reporte-claro.png` | Reporte imprimible en pantalla: escenario, un día simulado y el laboratorio corrido en la captura 25 (página completa) |
| `39-reporte-impresion.png` | El mismo reporte con los estilos de impresión (sin banda ni pie, siempre en claro aunque la pantalla esté en oscuro) |

Las capturas 7, 8 y 1 muestran los carteles de la planta agrandados para proyector (#6), y 1, 7 y 11
los pictogramas sobre placa en las leyendas.
