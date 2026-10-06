# _pack-docx.ps1 -- append a "WMS" section to the user's screenshot document (2026-10-05)
#
# Why not Word COM: on this box Word COM hangs (WINWORD stays alive, no output) when driven
# from the agent shell, so the section is appended by editing the OOXML package directly:
#   copy every part of the source package, add the new PNGs under word/media/,
#   register them in word/_rels/document.xml.rels, and insert matching <w:p> blocks
#   (heading / sub-heading / centred picture) just before the body-level <w:sectPr>.
#   Styling mirrors the paragraphs already in the document: bold top heading
#   (spacing before 240 / after 80 twips), sub heading (indent 420 twips, after 40),
#   picture paragraph (centred, after 120), picture width 5267325 EMU = 14.63 cm.
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 reads .ps1 as ANSI without a BOM);
#       all Chinese text comes from sections.json, read as UTF-8.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File tools\archive\_wms-doc-shots\_pack-docx.ps1
# Output: MES管理系统-界面截图-含WMS.docx next to the source document (source untouched).

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName WindowsBase

$root   = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$shots  = Join-Path $PSScriptRoot 'shots'
$cfg    = Get-Content (Join-Path $PSScriptRoot 'sections.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$srcPath = Join-Path $root $cfg.source
$outPath = Join-Path $root $cfg.output
if (-not (Test-Path $srcPath)) { throw "source document not found: $srcPath" }

$EMU_W = 5267325                      # 14.63cm, same as the pictures already in the doc

function Get-PngSize([string]$path) {
  $b = [IO.File]::ReadAllBytes($path)
  $w = [int]$b[16] * 16777216 + [int]$b[17] * 65536 + [int]$b[18] * 256 + [int]$b[19]
  $h = [int]$b[20] * 16777216 + [int]$b[21] * 65536 + [int]$b[22] * 256 + [int]$b[23]
  return @($w, $h)
}
function XmlEsc([string]$s) { return $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;') }

# ---------- 1. build the XML for the new section ----------
$sb = New-Object Text.StringBuilder
$docPrId = 100
$rid = 900                              # high rIds so they cannot clash with the source rels
$media = @()                            # @{ File=...; Part=...; Rid=... }
[void]$sb.Append('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>')

foreach ($sec in $cfg.sections) {
  [void]$sb.Append('<w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">' + (XmlEsc $sec.title) + '</w:t></w:r></w:p>')
  Write-Host ("[section] " + $sec.title)
  foreach ($it in $sec.items) {
    [void]$sb.Append('<w:p><w:pPr><w:spacing w:after="40"/><w:ind w:left="420"/></w:pPr><w:r><w:t xml:space="preserve">' + (XmlEsc $it.sub) + '</w:t></w:r></w:p>')
    Write-Host ("  [item] " + $it.sub)
    foreach ($f in $it.imgs) {
      $p = Join-Path $shots $f
      if (-not (Test-Path $p)) { Write-Warning "missing picture: $f"; continue }
      $wh = Get-PngSize $p
      $cy = [int]([math]::Round($EMU_W * $wh[1] / $wh[0]))
      $docPrId++; $rid++
      $part = 'media/wms' + ($docPrId - 100) + '.png'
      $media += [pscustomobject]@{ File = $f; Part = $part; Rid = ('rId' + $rid) }
      $pic = @(
        '<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing>',
        '<wp:inline distT="0" distB="0" distL="0" distR="0">',
        '<wp:extent cx="' + $EMU_W + '" cy="' + $cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>',
        '<wp:docPr id="' + $docPrId + '" name="Picture ' + $docPrId + '"/>',
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>',
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">',
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name=""/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>',
        '<pic:blipFill><a:blip r:embed="rId' + $rid + '"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>',
        '<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + $EMU_W + '" cy="' + $cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>',
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
      ) -join ''
      [void]$sb.Append($pic)
      Write-Host ("    [img] $f -> $part  " + [math]::Round($EMU_W / 360000, 2) + 'x' + [math]::Round($cy / 360000, 2) + 'cm')
    }
  }
}
$insert = $sb.ToString()

# ---------- 2. rewrite the package ----------
if (Test-Path $outPath) { Remove-Item $outPath -Force }
$srcZip = [IO.Compression.ZipFile]::OpenRead($srcPath)
$outZip = [IO.Compression.ZipFile]::Open($outPath, [IO.Compression.ZipArchiveMode]::Create)
$docXml = $null; $relsXml = $null
try {
  foreach ($e in $srcZip.Entries) {
    $name = $e.FullName
    if ($name -eq 'word/document.xml' -or $name -eq 'word/_rels/document.xml.rels') {
      # 这两部分要改内容:先读进内存,循环结束后再写(避免边读边写同一个 zip)
      $sr = New-Object IO.StreamReader($e.Open(), [Text.Encoding]::UTF8)
      if ($name -eq 'word/document.xml') { $docXml = $sr.ReadToEnd() } else { $relsXml = $sr.ReadToEnd() }
      $sr.Dispose()
      continue
    }
    $ne = $outZip.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
    $is = $e.Open(); $os = $ne.Open()
    $is.CopyTo($os); $os.Dispose(); $is.Dispose()
  }
  # document.xml: insert before the body-level <w:sectPr (keeps the trailing sectPr last)
  $sect = $docXml.LastIndexOf('<w:sectPr')
  if ($sect -lt 0) { throw 'body-level <w:sectPr> not found; cannot place content' }
  $docXml = $docXml.Substring(0, $sect) + $insert + $docXml.Substring($sect)
  $ne = $outZip.CreateEntry('word/document.xml', [IO.Compression.CompressionLevel]::Optimal)
  $os = $ne.Open(); $sw = New-Object IO.StreamWriter($os, (New-Object Text.UTF8Encoding($false))); $sw.Write($docXml); $sw.Dispose(); $os.Dispose()
  # rels: add one image relationship per new picture
  $add = ''
  foreach ($m in $media) {
    $add += '<Relationship Id="' + $m.Rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + $m.Part + '"/>'
  }
  $relsXml = $relsXml.Replace('</Relationships>', $add + '</Relationships>')
  $ne = $outZip.CreateEntry('word/_rels/document.xml.rels', [IO.Compression.CompressionLevel]::Optimal)
  $os = $ne.Open(); $sw = New-Object IO.StreamWriter($os, (New-Object Text.UTF8Encoding($false))); $sw.Write($relsXml); $sw.Dispose(); $os.Dispose()
  # media parts
  foreach ($m in $media) {
    $ne = $outZip.CreateEntry(('word/' + $m.Part), [IO.Compression.CompressionLevel]::Optimal)
    $os = $ne.Open(); $fs = [IO.File]::OpenRead((Join-Path $shots $m.File)); $fs.CopyTo($os); $os.Dispose(); $fs.Dispose()
  }
} finally {
  $outZip.Dispose(); $srcZip.Dispose()
}
Write-Host ("`n[OK] written: " + $outPath)
Write-Host ("     pictures added: " + $media.Count)
