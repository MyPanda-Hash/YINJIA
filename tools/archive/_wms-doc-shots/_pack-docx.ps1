# _pack-docx.ps1 -- write the "WMS" screenshot section into .docx files (2026-10-05)
#
# Why not Word COM: on this box Word COM hangs (WINWORD stays alive, no output) when driven
# from the agent shell, so the section is added by editing the OOXML package directly:
#   copy every part of the source package, add the new PNGs under word/media/,
#   register them in word/_rels/document.xml.rels, and insert matching <w:p> blocks
#   (heading / sub-heading / centred picture) just before the body-level <w:sectPr>.
#   Styling mirrors the paragraphs already in the document: bold top heading
#   (spacing before 240 / after 80 twips), sub heading (indent 420 twips, after 40),
#   picture paragraph (centred, after 120), picture width 5267325 EMU = 14.63 cm.
#
# Two outputs (see sections.json):
#   output           : source document (already holds the MES screenshots) + the WMS section
#   outputStandalone : WMS section only, no "seven" numbering, no leading page break,
#                      and the now-unused MES pictures + their relationships are dropped
#
# IMPORTANT: keep this file pure ASCII. Windows PowerShell 5.1 decodes a .ps1 as ANSI when it
# has no UTF-8 BOM, so any non-ASCII character in code or comments can break parsing
# (observed 2026-10-05: a Chinese comment silently corrupted the next statement).
# All Chinese text lives in sections.json, which is read explicitly as UTF-8.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File tools\archive\_wms-doc-shots\_pack-docx.ps1
#   ... -From <path>   # optional: read from a copy of the source (when the original is
#                      # open in Word and therefore locked)
# The source document is never modified.
param([string]$From = '')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName WindowsBase

$root   = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$shots  = Join-Path $PSScriptRoot 'shots'
$cfg    = Get-Content (Join-Path $PSScriptRoot 'sections.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$srcPath = Join-Path $root $cfg.source
if ($From) { $srcPath = $From }
if (-not (Test-Path $srcPath)) { throw "source document not found: $srcPath" }

$EMU_W = 5267325                      # 14.63cm, same width as the pictures already in the doc

function Get-PngSize([string]$path) {
  $b = [IO.File]::ReadAllBytes($path)
  $w = [int]$b[16] * 16777216 + [int]$b[17] * 65536 + [int]$b[18] * 256 + [int]$b[19]
  $h = [int]$b[20] * 16777216 + [int]$b[21] * 65536 + [int]$b[22] * 256 + [int]$b[23]
  return @($w, $h)
}
function XmlEsc([string]$s) { return $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;') }

# ---------- 1. build the section XML (and collect the picture list) ----------
function Build-Section([string]$topTitle, [bool]$withPageBreak) {
  $sb = New-Object Text.StringBuilder
  $script:docPrId = 100
  $script:rid = 900
  $media = New-Object Collections.ArrayList
  if ($withPageBreak) { [void]$sb.Append('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>') }
  [void]$sb.Append('<w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">' + (XmlEsc $topTitle) + '</w:t></w:r></w:p>')
  foreach ($it in $cfg.sections[0].items) {
    [void]$sb.Append('<w:p><w:pPr><w:spacing w:after="40"/><w:ind w:left="420"/></w:pPr><w:r><w:t xml:space="preserve">' + (XmlEsc $it.sub) + '</w:t></w:r></w:p>')
    foreach ($f in $it.imgs) {
      $p = Join-Path $shots $f
      if (-not (Test-Path $p)) { Write-Warning "missing picture: $f"; continue }
      $wh = Get-PngSize $p
      $cy = [int]([math]::Round($EMU_W * $wh[1] / $wh[0]))
      $script:docPrId++; $script:rid++
      $part = 'media/wms' + ($script:docPrId - 100) + '.png'
      [void]$media.Add([pscustomobject]@{ File = $f; Part = $part; Rid = ('rId' + $script:rid) })
      $pic = @(
        '<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing>',
        '<wp:inline distT="0" distB="0" distL="0" distR="0">',
        '<wp:extent cx="' + $EMU_W + '" cy="' + $cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>',
        '<wp:docPr id="' + $script:docPrId + '" name="Picture ' + $script:docPrId + '"/>',
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>',
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">',
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name=""/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>',
        '<pic:blipFill><a:blip r:embed="rId' + $script:rid + '"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>',
        '<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + $EMU_W + '" cy="' + $cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>',
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
      ) -join ''
      [void]$sb.Append($pic)
      Write-Host ("    [img] $f -> $part  " + [math]::Round($EMU_W / 360000, 2) + 'x' + [math]::Round($cy / 360000, 2) + 'cm (aspect ' + $wh[0] + 'x' + $wh[1] + ')')
    }
  }
  return [pscustomobject]@{ Xml = $sb.ToString(); Media = $media }
}

Write-Host ("[build] " + $cfg.sections[0].title)
$full = Build-Section $cfg.sections[0].title $true
Write-Host ("[build] " + $cfg.titleStandalone)
$only = Build-Section $cfg.titleStandalone $false

# ---------- 2. write one .docx per output ----------
function Write-Docx([string]$outPath, [string]$insert, $media, [bool]$emptyBody) {
  if (Test-Path $outPath) {
    try { Remove-Item $outPath -Force -ErrorAction Stop }
    catch {
      # locked (the user has it open in Word): leave the existing file alone
      Write-Warning ("skipped, file is open in Word: " + $outPath)
      return
    }
  }
  $srcZip = [IO.Compression.ZipFile]::OpenRead($srcPath)
  $outZip = [IO.Compression.ZipFile]::Open($outPath, [IO.Compression.ZipArchiveMode]::Create)
  $docXml = $null; $relsXml = $null
  try {
    foreach ($e in $srcZip.Entries) {
      $name = $e.FullName
      # standalone document: the MES pictures are no longer in the body, so drop them too
      if ($emptyBody -and $name -like 'word/media/image*') { continue }
      if ($name -eq 'word/document.xml' -or $name -eq 'word/_rels/document.xml.rels') {
        # these two parts get rewritten: read them fully into memory first
        $ms = New-Object IO.MemoryStream
        $es = $e.Open(); $es.CopyTo($ms); $es.Dispose()
        $text = [Text.Encoding]::UTF8.GetString($ms.ToArray())
        $ms.Dispose()
        if ($name -eq 'word/document.xml') { $docXml = $text } else { $relsXml = $text }
        continue
      }
      $ne = $outZip.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
      $is = $e.Open(); $os = $ne.Open()
      $is.CopyTo($os); $os.Dispose(); $is.Dispose()
    }
    $sect = $docXml.LastIndexOf('<w:sectPr')
    if ($sect -lt 0) { throw 'body-level <w:sectPr> not found; cannot place content' }
    if ($emptyBody) {
      # standalone document: keep the XML declaration + <w:document ...> + <w:body>, drop the body
      $declEnd = $docXml.IndexOf('?>')
      $decl = ''
      if ($declEnd -ge 0) { $decl = $docXml.Substring(0, $declEnd + 2) }
      $docOpenStart = $docXml.IndexOf('<w:document')
      $docOpenEnd = $docXml.IndexOf('>', $docOpenStart)
      $docOpen = $docXml.Substring($docOpenStart, $docOpenEnd - $docOpenStart + 1)
      $head = $decl + "`r`n" + $docOpen + '<w:body>'
      $docXml = $head + $insert + $docXml.Substring($sect)
    } else {
      $docXml = $docXml.Substring(0, $sect) + $insert + $docXml.Substring($sect)
    }
    $ne = $outZip.CreateEntry('word/document.xml', [IO.Compression.CompressionLevel]::Optimal)
    $os = $ne.Open(); $sw = New-Object IO.StreamWriter($os, (New-Object Text.UTF8Encoding($false))); $sw.Write($docXml); $sw.Dispose(); $os.Dispose()

    $add = ''
    foreach ($m in $media) {
      $add += '<Relationship Id="' + $m.Rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + $m.Part + '"/>'
    }
    $relsXml = $relsXml.Replace('</Relationships>', $add + '</Relationships>')
    if ($emptyBody) {
      # drop relationships whose target media were not packed (would be dangling otherwise)
      $relsXml = [regex]::Replace($relsXml, '<Relationship[^>]*Target="media/image\d+\.png"[^>]*/>', '')
    }
    $ne = $outZip.CreateEntry('word/_rels/document.xml.rels', [IO.Compression.CompressionLevel]::Optimal)
    $os = $ne.Open(); $sw = New-Object IO.StreamWriter($os, (New-Object Text.UTF8Encoding($false))); $sw.Write($relsXml); $sw.Dispose(); $os.Dispose()

    foreach ($m in $media) {
      $ne = $outZip.CreateEntry(('word/' + $m.Part), [IO.Compression.CompressionLevel]::Optimal)
      $os = $ne.Open(); $fs = [IO.File]::OpenRead((Join-Path $shots $m.File)); $fs.CopyTo($os); $os.Dispose(); $fs.Dispose()
    }
  } finally {
    $outZip.Dispose(); $srcZip.Dispose()
  }
  Write-Host ("[OK] " + $outPath + "  (pictures added: " + $media.Count + ", body emptied: " + $emptyBody + ")")
}

Write-Docx (Join-Path $root $cfg.output) $full.Xml $full.Media $false
if ($cfg.outputStandalone) { Write-Docx (Join-Path $root $cfg.outputStandalone) $only.Xml $only.Media $true }
