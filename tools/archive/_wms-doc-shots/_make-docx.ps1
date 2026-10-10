# _make-docx.ps1 -- append a "WMS" section to the user's screenshot document (2026-10-05)
#
# Why Word COM: the source document already holds 18 pictures with hand-tuned paragraph
# spacing/indent. Editing OOXML by hand would risk the layout; opening in Word, appending
# and saving as a NEW file keeps the original untouched and matches its look
# (bold top heading, sub heading indented 21pt, picture centred 14.63cm).
#
# NOTE: this file is deliberately ASCII-only. Windows PowerShell 5.1 reads .ps1 as ANSI
# unless it has a UTF-8 BOM, so all Chinese text lives in sections.json (read as UTF-8).
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File tools\archive\_wms-doc-shots\_make-docx.ps1
# Output: MES管理系统-界面截图-含WMS.docx next to the source document.

$ErrorActionPreference = 'Stop'
$root  = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent   # repo root
$shots = Join-Path $PSScriptRoot 'shots'
$json  = Join-Path $PSScriptRoot 'sections.json'

$cfg = Get-Content $json -Raw -Encoding UTF8 | ConvertFrom-Json
$src = Join-Path $root $cfg.source
$out = Join-Path $root $cfg.output
if (-not (Test-Path $src)) { throw "source document not found: $src" }

$IMG_W = [double]$cfg.imageWidthPt   # 414.7pt = 14.63cm, same width as the pictures already in the doc

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $null
try {
  $doc = $word.Documents.Open($src, $false, $true)   # ReadOnly
  $doc.SaveAs2($out, 16)                             # 16 = wdFormatDocumentDefault (.docx)
  $sel = $word.Selection
  $sel.EndKey(6) | Out-Null                          # 6 = wdStory
  $pf = $sel.ParagraphFormat

  foreach ($sec in $cfg.sections) {
    $sel.InsertBreak(7)                              # 7 = wdPageBreak
    $pf.LeftIndent = 0; $pf.SpaceBefore = 12; $pf.SpaceAfter = 4; $pf.Alignment = 0
    $sel.Font.Bold = $true
    $sel.TypeText($sec.title)
    $sel.Font.Bold = $false
    $sel.TypeParagraph()
    Write-Host ("[section] " + $sec.title)

    foreach ($it in $sec.items) {
      $pf.LeftIndent = 21; $pf.SpaceBefore = 0; $pf.SpaceAfter = 2; $pf.Alignment = 0
      $sel.Font.Bold = $false
      $sel.TypeText($it.sub)
      $sel.TypeParagraph()
      Write-Host ("  [item] " + $it.sub)
      foreach ($f in $it.imgs) {
        $p = Join-Path $shots $f
        if (-not (Test-Path $p)) { Write-Warning "missing picture: $f"; continue }
        $pf.LeftIndent = 0; $pf.SpaceBefore = 0; $pf.SpaceAfter = 6; $pf.Alignment = 1
        $shape = $sel.InlineShapes.AddPicture($p, $false, $true)
        $shape.LockAspectRatio = -1
        $shape.Width = $IMG_W
        $sel.TypeParagraph()
        Write-Host ("    [img] $f  " + [math]::Round($shape.Width) + 'x' + [math]::Round($shape.Height) + 'pt')
      }
    }
  }
  $doc.Save()
  Write-Host ""
  Write-Host ("[OK] written: " + $out)
  Write-Host ("     pages=" + $doc.ComputeStatistics(2) + " paragraphs=" + $doc.Paragraphs.Count + " pictures=" + $doc.InlineShapes.Count)
} finally {
  if ($doc) { $doc.Close($false) }
  $word.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
