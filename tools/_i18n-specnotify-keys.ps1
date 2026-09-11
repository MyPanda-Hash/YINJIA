# _i18n-specnotify-keys.ps1 — 规格书检验项目变更提醒 2 词条补进 10 语言包(幂等;JS 转义 \')
$ErrorActionPreference = 'Stop'
$dir = 'C:\INCER\YINJIA-MES\frontend\src\i18n\locales'
$K1 = '规格书检验项目已更新'
$K2 = '「规格书 {specNo}（{specName}）」的产品性能检验项目及检验标准已由 {actor} 修改，与本表（{panelName} {docNo}）可能不一致，请核对本表的必测项/型式检验。'
$entries = @{
  'en'    = @{ $K1 = 'Spec inspection items updated'; $K2 = 'The inspection items and standards of "Spec {specNo} ({specName})" were modified by {actor} and may be inconsistent with this sheet ({panelName} {docNo}). Please review the mandatory/type-inspection items.' }
  'zh-TW' = @{ $K1 = '規格書檢驗項目已更新'; $K2 = '「規格書 {specNo}（{specName}）」的產品性能檢驗項目及檢驗標準已由 {actor} 修改，與本表（{panelName} {docNo}）可能不一致，請核對本表的必測項/型式檢驗。' }
  'ja'    = @{ $K1 = '規格書の検査項目を更新'; $K2 = '「規格書 {specNo}（{specName}）」の製品性能検査項目・検査基準が {actor} により変更されました。本表（{panelName} {docNo}）と不一致の可能性があります。必須項目/型式検査をご確認ください。' }
  'ko'    = @{ $K1 = '규격서 검사 항목 갱신됨'; $K2 = '"규격서 {specNo}({specName})"의 제품 성능 검사 항목 및 검사 기준이 {actor}에 의해 수정되어 이 표({panelName} {docNo})와 일치하지 않을 수 있습니다. 필수 항목/형식 검사를 확인하세요.' }
  'es'    = @{ $K1 = 'Ítems de inspección de la especificación actualizados'; $K2 = 'Los ítems y estándares de inspección de la "Especificación {specNo} ({specName})" fueron modificados por {actor} y pueden ser inconsistentes con esta hoja ({panelName} {docNo}). Revise los ítems obligatorios/de inspección de tipo.' }
  'fr'    = @{ $K1 = "Items d'inspection de la spécification mis à jour"; $K2 = "Les items et normes d'inspection de la « Spécification {specNo} ({specName}) » ont été modifiés par {actor} et peuvent ne pas correspondre à cette fiche ({panelName} {docNo}). Vérifiez les items obligatoires / inspection de type." }
  'de'    = @{ $K1 = 'Spezifikations-Prüfpunkte aktualisiert'; $K2 = 'Die Produktprüfpunkte und -normen der „Spezifikation {specNo} ({specName})“ wurden von {actor} geändert und können von diesem Blatt ({panelName} {docNo}) abweichen. Bitte Pflicht-/Typprüfpunkte abgleichen.' }
  'ru'    = @{ $K1 = 'Пункты проверки спецификации обновлены'; $K2 = 'Пункты и нормы проверки изделия в «Спецификации {specNo} ({specName})» изменены {actor} и могут расходиться с этим листом ({panelName} {docNo}). Проверьте обязательные пункты/типовую проверку.' }
  'vi'    = @{ $K1 = 'Hạng mục kiểm tra của spec đã cập nhật'; $K2 = 'Hạng mục và tiêu chuẩn kiểm tra của "Spec {specNo} ({specName})" đã được {actor} sửa đổi, có thể không nhất quán với biểu mẫu này ({panelName} {docNo}). Vui lòng đối chiếu hạng mục bắt buộc/kiểm tra định dạng.' }
  'th'    = @{ $K1 = 'อัปเดตรายการตรวจสอบของสเปกแล้ว'; $K2 = 'รายการและมาตรฐานตรวจสอบของ "สเปก {specNo} ({specName})" ถูกแก้ไขโดย {actor} อาจไม่สอดคล้องกับแบบฟอร์มนี้ ({panelName} {docNo}) โปรดตรวจสอบรายการบังคับ/ตรวจสอบแบบ' }
}
foreach ($loc in $entries.Keys) {
  $file = Join-Path $dir "$loc.js"
  $text = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
  $anchor = $text.LastIndexOf("`n  },")
  if ($anchor -lt 0) { Write-Host "[$loc] ANCHOR NOT FOUND"; continue }
  $lines = New-Object System.Text.StringBuilder
  $added = 0
  foreach ($k in @($K1, $K2)) {
    if ($text.Contains("'" + $k + "':")) { continue }
    $v = $entries[$loc][$k]
    [void]$lines.Append("    '$k': '$($v.Replace("'", "\'"))',`n")
    $added++
  }
  if ($added -gt 0) {
    $text = $text.Insert($anchor + 1, $lines.ToString())
    [System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))
  }
  Write-Host "[$loc] +$added keys"
}
Write-Host 'done'
