# _i18n-dsback-keys.ps1 — 「返回列表」词条补进 10 语言包(幂等)
$ErrorActionPreference = 'Stop'
$dir = 'C:\INCER\YINJIA-MES\frontend\src\i18n\locales'
$K = '返回列表'
$entries = @{
  'en'='Back to list'; 'zh-TW'='返回列表'; 'ja'='一覧へ戻る'; 'ko'='목록으로'; 'es'='Volver a la lista';
  'fr'='Retour à la liste'; 'de'='Zurück zur Liste'; 'ru'='К списку'; 'vi'='Về danh sách'; 'th'='กลับไปรายการ'
}
foreach ($loc in $entries.Keys) {
  $file = Join-Path $dir "$loc.js"
  $text = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
  if ($text.Contains("'" + $K + "':")) { Write-Host "[$loc] skip"; continue }
  $anchor = $text.LastIndexOf("`n  },")
  if ($anchor -lt 0) { Write-Host "[$loc] ANCHOR NOT FOUND"; continue }
  $v = $entries[$loc]
  $text = $text.Insert($anchor + 1, "    '$K': '$($v.Replace("'", "\'"))',`n")
  [System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))
  Write-Host "[$loc] +1"
}
Write-Host 'done'
