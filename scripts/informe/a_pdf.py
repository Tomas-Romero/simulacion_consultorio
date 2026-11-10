"""Exporta los .docx a PDF con Microsoft Word (COM, vía PowerShell), actualizando antes los campos y el índice, como
en el TP5. Informa las páginas y guarda el texto del índice para controlar la numeración. Es opcional: si Word no
está, avisa y sigue."""

import shutil
import subprocess
import tempfile
from pathlib import Path

GUION_PS = r"""param([string]$Docx, [string]$Pdf, [string]$Indice)
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($Docx, $false, $false)
  $doc.Fields.Update() | Out-Null
  if ($doc.TablesOfContents.Count -gt 0) {
    $doc.TablesOfContents.Item(1).Update()
    $doc.Repaginate()
    $doc.TablesOfContents.Item(1).Update()
    [System.IO.File]::WriteAllText($Indice, $doc.TablesOfContents.Item(1).Range.Text, [System.Text.Encoding]::UTF8)
  }
  $doc.Repaginate()
  $doc.Save()
  $doc.ExportAsFixedFormat($Pdf, 17)
  Write-Output ("paginas=" + $doc.ComputeStatistics(2))
  $doc.Close($false)
} finally { $word.Quit() }
"""


def exportar(rutas: list[Path]) -> dict:
    if shutil.which("powershell") is None:
        print("  [pdf] PowerShell no disponible: no se generan los PDF de control")
        return {}
    paginas = {}
    with tempfile.TemporaryDirectory() as tmp:
        guion = Path(tmp) / "a_pdf.ps1"
        guion.write_text(GUION_PS, encoding="utf-8-sig")
        for docx in rutas:
            pdf = docx.with_suffix(".pdf")
            indice = docx.with_name(docx.stem + "_indice.txt")
            r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(guion), "-Docx", str(docx),
                                "-Pdf", str(pdf), "-Indice", str(indice)], capture_output=True, text=True)
            if r.returncode == 0 and pdf.exists():
                n = int(r.stdout.strip().split("=")[-1]) if "paginas=" in r.stdout else None
                paginas[docx.name] = n
                print(f"  [pdf]     {pdf.name} ({n} páginas)")
            else:
                print(f"  [pdf] no se pudo exportar {docx.name}: {r.stderr.strip()[:300]}")
    return paginas
