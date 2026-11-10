"""Utilidades de python-docx para el informe y el guion: estilos de los TP4/TP5 (Calibri, títulos con
borde naranja), tablas, figuras, epígrafes con campos SEQ e índice TOC. Adaptado del TP5."""

import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Cm, Pt, RGBColor

# Paleta y medidas del TP4
NARANJA = "D9622B"
OSCURO = "1F1F1F"
GRIS_TITULO = "404040"
GRIS = "595959"
GRIS_CLARO = "F5F5F5"
BORDE = "CCCCCC"
ANCHO_TEXTO_CM = 16.0

CENTRO = WD_ALIGN_PARAGRAPH.CENTER
JUSTIFICADO = WD_ALIGN_PARAGRAPH.JUSTIFY
IZQUIERDA = WD_ALIGN_PARAGRAPH.LEFT
DERECHA = WD_ALIGN_PARAGRAPH.RIGHT

_DESPUES_DE_UPDATEFIELDS = ("hdrShapeDefaults", "footnotePr", "endnotePr", "compat", "docVars", "rsids", "mathPr",
                            "attachedSchema", "themeFontLang", "clrSchemeMapping", "doNotIncludeSubdocsInStats",
                            "doNotAutoCompressPictures", "forceUpgrade", "captions", "readModeInkLockDown",
                            "smartTagType", "schemaLibrary", "shapeDefaults", "doNotEmbedSmartTags", "decimalSymbol",
                            "listSeparator")

# Marcas de formato dentro del texto: **negrita**, ~~cursiva~~, _{subíndice}, ^{superíndice}
_MARCAS = re.compile(r"(\*\*.+?\*\*|~~.+?~~|_\{.+?\}|\^\{.+?\})")


# ==========================================
# Documento y estilos
# ==========================================
def crear_documento(plantilla: Path | None) -> Document:
    """Usa el .docx del TP4 como plantilla (sin tocarlo): se vacía el cuerpo y se conservan estilos."""
    if plantilla is not None and plantilla.exists():
        doc = Document(str(plantilla))
        cuerpo = doc.element.body
        for hijo in list(cuerpo):
            if hijo.tag != qn("w:sectPr"):
                cuerpo.remove(hijo)
    else:
        doc = Document()
    configurar_estilos(doc)
    seccion = doc.sections[0]
    seccion.page_width, seccion.page_height = Cm(21.0), Cm(29.7)   # A4
    seccion.left_margin = seccion.right_margin = Cm(2.5)           # 16 cm de texto
    seccion.top_margin = seccion.bottom_margin = Cm(2.5)
    seccion.different_first_page_header_footer = True              # sin número en la carátula
    return doc


def _fuente(estilo, tam: float, color: str | None = None, negrita: bool | None = None):
    estilo.font.name = "Calibri"
    estilo.font.size = Pt(tam)
    if negrita is not None:
        estilo.font.bold = negrita
    if color:
        estilo.font.color.rgb = RGBColor.from_string(color)
    propiedades = estilo.element.get_or_add_rPr()
    fuentes = propiedades.find(qn("w:rFonts"))
    for atributo in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        fuentes.set(qn(atributo), "Calibri")
    for atributo in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"):
        if fuentes.get(qn(atributo)) is not None:
            del fuentes.attrib[qn(atributo)]


def configurar_estilos(doc: Document):
    """Reproduce los estilos de títulos del TP4 (Calibri, 16/13/11,5 pt, borde naranja en el 1)."""
    _fuente(doc.styles["Normal"], 11)
    for nombre, tam, color, antes, despues in [("Heading 1", 16, OSCURO, 20, 10),
                                               ("Heading 2", 13, NARANJA, 16, 8),
                                               ("Heading 3", 11.5, GRIS_TITULO, 11, 5.5)]:
        estilo = doc.styles[nombre]
        _fuente(estilo, tam, color, True)
        estilo.font.italic = False
        formato = estilo.paragraph_format
        formato.space_before, formato.space_after = Pt(antes), Pt(despues)
        formato.keep_with_next = True
        formato.alignment = IZQUIERDA
    h1 = doc.styles["Heading 1"].element.get_or_add_pPr()
    for viejo in h1.findall(qn("w:pBdr")):
        h1.remove(viejo)
    h1.append(parse_xml(
        f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="4" w:color="{NARANJA}"/></w:pBdr>'))
    # el orden de los hijos de pPr importa para Word: el borde va antes de spacing/outlineLvl
    borde = h1.find(qn("w:pBdr"))
    h1.remove(borde)
    h1.insert(0, borde)


# ==========================================
# Texto
# ==========================================
def agregar_texto(par, texto: str, tam: float | None = None, color: str | None = None,
                  italica: bool = False, negrita: bool = False, fuente: str | None = None,
                  marcas: bool = True):
    for parte in (_MARCAS.split(texto) if marcas else [texto]):
        if not parte:
            continue
        if parte.startswith("**"):
            corrida, parte_negrita = par.add_run(parte[2:-2]), True
        elif parte.startswith("~~"):
            corrida, parte_negrita = par.add_run(parte[2:-2]), negrita
            corrida.italic = True
        elif parte.startswith("_{"):
            corrida, parte_negrita = par.add_run(parte[2:-1]), negrita
            corrida.font.subscript = True
        elif parte.startswith("^{"):
            corrida, parte_negrita = par.add_run(parte[2:-1]), negrita
            corrida.font.superscript = True
        else:
            corrida, parte_negrita = par.add_run(parte), negrita
        if parte_negrita:
            corrida.bold = True
        if italica:
            corrida.italic = True
        if tam:
            corrida.font.size = Pt(tam)
        if color:
            corrida.font.color.rgb = RGBColor.from_string(color)
        if fuente:
            corrida.font.name = fuente
            corrida._r.get_or_add_rPr().find(qn("w:rFonts")).set(qn("w:eastAsia"), fuente)
    return par


def parrafo(doc, texto: str, alinear=JUSTIFICADO, antes: float = 0, despues: float = 8,
            interlineado: float | None = 1.15, estilo: str | None = None, **formato_texto):
    par = doc.add_paragraph(style=estilo)
    par.alignment = alinear
    f = par.paragraph_format
    f.space_before, f.space_after = Pt(antes), Pt(despues)
    if interlineado:
        f.line_spacing = interlineado
    agregar_texto(par, texto, **formato_texto)
    return par


def ecuacion(doc, texto: str):
    """Ecuación centrada en cursiva, como en el TP4."""
    return parrafo(doc, texto, alinear=CENTRO, antes=6, despues=6, interlineado=None, tam=12, italica=True)


def salto_pagina(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def _campo(par, instruccion: str, resultado: str, **formato_texto):
    """Campo complejo de Word (begin / instrText / separate / resultado en caché / end)."""
    def marca(tipo):
        corrida = par.add_run()
        elemento = OxmlElement("w:fldChar")
        elemento.set(qn("w:fldCharType"), tipo)
        corrida._r.append(elemento)

    marca("begin")
    corrida = par.add_run()
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f" {instruccion} "
    corrida._r.append(instr)
    marca("separate")
    agregar_texto(par, resultado, **formato_texto)
    marca("end")


def indice(doc):
    """Índice como campo TOC; Word ofrece actualizarlo al abrir (updateFields)."""
    par = doc.add_paragraph()
    _campo(par, r'TOC \o "1-2" \h \z \u',
           "Clic derecho sobre este texto > Actualizar campo (o F9) para generar el índice.",
           italica=True, color=GRIS)
    actualizar = OxmlElement("w:updateFields")
    actualizar.set(qn("w:val"), "true")
    ajustes = doc.settings.element
    # en el esquema de settings, updateFields precede a estos elementos
    siguiente = next((h for h in ajustes if h.tag.split("}")[1] in _DESPUES_DE_UPDATEFIELDS), None)
    if siguiente is not None:
        siguiente.addprevious(actualizar)
    else:
        ajustes.append(actualizar)


def titulo_fuera_del_indice(doc, texto: str):
    """Título con el aspecto de Heading 1 pero sin entrar en el índice (párrafo normal con formato directo)."""
    par = doc.add_paragraph()
    f = par.paragraph_format
    f.space_before, f.space_after, f.keep_with_next = Pt(20), Pt(10), True
    par._p.get_or_add_pPr().append(parse_xml(
        f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="4" w:color="{NARANJA}"/></w:pBdr>'))
    agregar_texto(par, texto, tam=16, negrita=True, color=OSCURO)
    return par


def numerar_paginas(doc):
    pie = doc.sections[0].footer
    pie.is_linked_to_previous = False
    par = pie.paragraphs[0]
    par.alignment = CENTRO
    _campo(par, "PAGE", "1", tam=9, color=GRIS)


# ==========================================
# Listas
# ==========================================
def _definir_numeracion(doc):
    """Agrega dos definiciones abstractas (viñeta y decimal) al numbering del documento."""
    numeracion = doc.part.numbering_part.element
    primera_num = numeracion.find(qn("w:num"))
    for id_abstracto, formato, texto in [(90, "bullet", "•"), (91, "decimal", "%1.")]:
        if numeracion.xpath(f'w:abstractNum[@w:abstractNumId="{id_abstracto}"]'):
            continue
        fuente = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>' if formato == "bullet" else ""
        definicion = parse_xml(
            f'<w:abstractNum {nsdecls("w")} w:abstractNumId="{id_abstracto}"><w:multiLevelType w:val="hybridMultilevel"/>'
            f'<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="{formato}"/><w:lvlText w:val="{texto}"/>'
            f'<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr>{fuente}</w:lvl></w:abstractNum>')
        if primera_num is not None:
            primera_num.addprevious(definicion)
        else:
            numeracion.append(definicion)


def lista(doc, items: list[str], numerada: bool = False):
    """Lista con viñetas o numerada (cada lista numerada reinicia en 1)."""
    _definir_numeracion(doc)
    numeracion = doc.part.numbering_part.element
    ids = [int(n.get(qn("w:numId"))) for n in numeracion.findall(qn("w:num"))]
    nuevo = max(ids + [0]) + 1
    numeracion.append(parse_xml(
        f'<w:num {nsdecls("w")} w:numId="{nuevo}"><w:abstractNumId w:val="{91 if numerada else 90}"/>'
        f'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>'))
    for texto in items:
        par = doc.add_paragraph(style="List Paragraph")
        propiedades = par._p.get_or_add_pPr()
        propiedades.append(parse_xml(
            f'<w:numPr {nsdecls("w")}><w:ilvl w:val="0"/><w:numId w:val="{nuevo}"/></w:numPr>'))
        par.alignment = JUSTIFICADO
        par.paragraph_format.space_after = Pt(4.5)
        agregar_texto(par, texto)


# ==========================================
# Epígrafes, figuras y tablas
# ==========================================
def epigrafe(doc, rotulo: str, numero: int, texto: str, arriba: bool = False):
    """'Figura N. texto' / 'Tabla N. texto' en cursiva gris centrado; el número es un campo SEQ."""
    par = doc.add_paragraph()
    par.alignment = CENTRO
    f = par.paragraph_format
    f.space_before, f.space_after = (Pt(8), Pt(4)) if arriba else (Pt(0), Pt(10))
    f.keep_with_next = arriba
    formato = dict(tam=9.5, italica=True, color=GRIS)
    agregar_texto(par, f"{rotulo} ", **formato)
    _campo(par, f"SEQ {rotulo} \\* ARABIC", str(numero), **formato)
    agregar_texto(par, f". {texto}", **formato)
    return par


def figura(doc, ruta: Path, numero: int, texto: str, ancho_cm: float = ANCHO_TEXTO_CM):
    par = doc.add_paragraph()
    par.alignment = CENTRO
    par.paragraph_format.space_before, par.paragraph_format.space_after = Pt(6), Pt(4)
    par.paragraph_format.keep_with_next = True
    par.add_run().add_picture(str(ruta), width=Cm(ancho_cm))
    epigrafe(doc, "Figura", numero, texto)


def _sombrear(celda, color: str):
    propiedades = celda._tc.get_or_add_tcPr()
    propiedades.append(parse_xml(f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="{color}"/>'))


def _borde_tabla(tabla, color: str = BORDE, margen_lateral: int = 70):
    propiedades = tabla._tbl.tblPr
    bordes = "".join(f'<w:{lado} w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
                     for lado in ("top", "left", "bottom", "right", "insideH", "insideV"))
    propiedades.append(parse_xml(f'<w:tblBorders {nsdecls("w")}>{bordes}</w:tblBorders>'))
    propiedades.append(parse_xml(
        f'<w:tblCellMar {nsdecls("w")}><w:top w:w="30" w:type="dxa"/><w:left w:w="{margen_lateral}" w:type="dxa"/>'
        f'<w:bottom w:w="30" w:type="dxa"/><w:right w:w="{margen_lateral}" w:type="dxa"/></w:tblCellMar>'))
    propiedades.append(parse_xml(f'<w:tblLayout {nsdecls("w")} w:type="fixed"/>'))


def tabla_datos(doc, numero: int, texto: str, encabezados: list[str], filas: list[list[str]],
                anchos: list[float] | None = None, alinear: list | None = None, tam: float = 9.5,
                resaltar_filas: tuple = (), mantener_junta: bool = True):
    """Tabla numerada: epígrafe arriba, encabezado naranja y filas que no se parten entre páginas.

    Con mantener_junta=False la tabla puede continuar en la página siguiente (el encabezado se repite).
    """
    epigrafe(doc, "Tabla", numero, texto, arriba=True)
    columnas = len(encabezados)
    anchos = anchos or [1] * columnas
    escala = ANCHO_TEXTO_CM / sum(anchos)
    anchos_cm = [a * escala for a in anchos]
    alinear = alinear or [IZQUIERDA] + [CENTRO] * (columnas - 1)

    tabla = doc.add_table(rows=1, cols=columnas)
    tabla.alignment = WD_TABLE_ALIGNMENT.CENTER
    tabla.autofit = False
    _borde_tabla(tabla)

    def escribir(fila, valores, encabezado=False, sombra=None, negrita=False, juntar=True):
        propiedades_fila = fila._tr.get_or_add_trPr()
        propiedades_fila.append(OxmlElement("w:cantSplit"))
        if encabezado:
            propiedades_fila.append(OxmlElement("w:tblHeader"))
        for i, valor in enumerate(valores):
            celda = fila.cells[i]
            celda.width = Cm(anchos_cm[i])
            par = celda.paragraphs[0]
            par.alignment = CENTRO if encabezado else alinear[i]
            par.paragraph_format.space_after = par.paragraph_format.space_before = Pt(0)
            par.paragraph_format.keep_with_next = juntar
            agregar_texto(par, valor, tam=tam, negrita=encabezado or negrita,
                          color="FFFFFF" if encabezado else None)
            if encabezado:
                _sombrear(celda, NARANJA)
            elif sombra:
                _sombrear(celda, sombra)

    escribir(tabla.rows[0], encabezados, encabezado=True)
    for k, valores in enumerate(filas):
        fila = tabla.add_row()
        resaltada = k in resaltar_filas
        escribir(fila, valores, sombra=GRIS_CLARO if (k % 2 == 1 or resaltada) else None, negrita=resaltada,
                 juntar=mantener_junta or k < 3 or k >= len(filas) - 4)
    # la última fila no mantiene con el párrafo siguiente
    for celda in tabla.rows[-1].cells:
        celda.paragraphs[0].paragraph_format.keep_with_next = False
    espacio = doc.add_paragraph()
    espacio.paragraph_format.space_after = Pt(6)
    return tabla


# ==========================================
# Código
# ==========================================
def caja_codigo(doc, lineas: list[str], tam: float = 9):
    """Caja de código de una celda (fondo gris, borde fino, Consolas), como en el TP4."""
    tabla = doc.add_table(rows=1, cols=1)
    tabla.alignment = WD_TABLE_ALIGNMENT.CENTER
    _borde_tabla(tabla, margen_lateral=10)
    tabla.rows[0]._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
    celda = tabla.rows[0].cells[0]
    celda.width = Cm(ANCHO_TEXTO_CM)
    _sombrear(celda, GRIS_CLARO)
    celda._tc.get_or_add_tcPr().append(parse_xml(
        f'<w:tcMar {nsdecls("w")}><w:top w:w="160" w:type="dxa"/><w:left w:w="220" w:type="dxa"/>'
        f'<w:bottom w:w="160" w:type="dxa"/><w:right w:w="220" w:type="dxa"/></w:tcMar>'))
    for i, linea in enumerate(lineas):
        par = celda.paragraphs[0] if i == 0 else celda.add_paragraph()
        par.paragraph_format.space_after = Pt(1)
        agregar_texto(par, linea, tam=tam, fuente="Consolas", marcas=False)
    espacio = doc.add_paragraph()
    espacio.paragraph_format.space_after = Pt(6)


def bloque_codigo_anexo(doc, lineas: list[str], tam: float = 7.5):
    """Código completo del anexo: un párrafo por línea con fondo gris, Consolas chica."""
    for linea in lineas:
        par = doc.add_paragraph()
        formato = par.paragraph_format
        formato.space_before = formato.space_after = Pt(0)
        formato.line_spacing_rule = WD_LINE_SPACING.SINGLE
        par._p.get_or_add_pPr().append(parse_xml(
            f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="{GRIS_CLARO}"/>'))
        corrida = par.add_run(linea.replace("\t", "    "))
        corrida.font.name = "Consolas"
        corrida.font.size = Pt(tam)
        corrida._r.get_or_add_rPr().find(qn("w:rFonts")).set(qn("w:eastAsia"), "Consolas")


# ==========================================
# Orden de las propiedades según el esquema de Word
# ==========================================
_ORDEN = {
    "pPr": ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr",
            "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap",
            "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid",
            "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection",
            "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"],
    "tblPr": ["tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize", "tblStyleColBandSize",
              "tblW", "jc", "tblCellSpacing", "tblInd", "tblBorders", "shd", "tblLayout", "tblCellMar", "tblLook"],
    "tcPr": ["cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders", "shd", "noWrap", "tcMar",
             "textDirection", "tcFitText", "vAlign", "hideMark"],
}


def ordenar_propiedades(raiz):
    """Reordena los hijos de pPr, tblPr y tcPr como exige el esquema (Word es estricto con algunos)."""
    for nombre, orden in _ORDEN.items():
        for elemento in raiz.iter(qn(f"w:{nombre}")):
            hijos = list(elemento)
            clave = lambda h: orden.index(h.tag.split("}")[1]) if h.tag.split("}")[1] in orden else len(orden)  # noqa: E731
            ordenados = sorted(hijos, key=clave)
            if ordenados != hijos:
                for h in hijos:
                    elemento.remove(h)
                for h in ordenados:
                    elemento.append(h)


def finalizar(doc):
    ordenar_propiedades(doc.element.body)
    ordenar_propiedades(doc.styles.element)
