# _i18n-samples-keys.ps1 — 动态样品列 6 词条补进 10 个静态语言包(幂等;JS 单引号转义 \')
$ErrorActionPreference = 'Stop'
$dir = 'C:\INCER\YINJIA-MES\frontend\src\i18n\locales'
$K = @('样品列', '增加样品列', '减少样品列(清空该列数据)', '减少样品列', '减少样品列将清空该列已填数据，确定减少吗？', '已是最少列数', '已是最大列数')
$entries = @{
  'en'    = @{ '样品列' = 'Sample Columns'; '增加样品列' = 'Add sample column'; '减少样品列(清空该列数据)' = 'Remove sample column (clears its data)'; '减少样品列' = 'Remove Sample Column'; '减少样品列将清空该列已填数据，确定减少吗？' = 'Removing a sample column clears the data in that column. Continue?'; '已是最少列数' = 'Minimum column count reached'; '已是最大列数' = 'Maximum column count reached' }
  'zh-TW' = @{ '样品列' = '樣品列'; '增加样品列' = '增加樣品列'; '减少样品列(清空该列数据)' = '減少樣品列(清空該列數據)'; '减少样品列' = '減少樣品列'; '减少样品列将清空该列已填数据，确定减少吗？' = '減少樣品列將清空該列已填數據，確定減少嗎？'; '已是最少列数' = '已是最少列數'; '已是最大列数' = '已是最大列數' }
  'ja'    = @{ '样品列' = 'サンプル列'; '增加样品列' = 'サンプル列を追加'; '减少样品列(清空该列数据)' = 'サンプル列を減らす(その列のデータを消去)'; '减少样品列' = 'サンプル列を減らす'; '减少样品列将清空该列已填数据，确定减少吗？' = 'サンプル列を減らすとその列の入力済みデータが消えます。実行しますか？'; '已是最少列数' = '最小列数です'; '已是最大列数' = '最大列数です' }
  'ko'    = @{ '样品列' = '샘플 열'; '增加样品列' = '샘플 열 추가'; '减少样品列(清空该列数据)' = '샘플 열 줄이기(해당 열 데이터 삭제)'; '减少样品列' = '샘플 열 줄이기'; '减少样品列将清空该列已填数据，确定减少吗？' = '샘플 열을 줄이면 해당 열의 입력된 데이터가 삭제됩니다. 계속할까요?'; '已是最少列数' = '최소 열 수입니다'; '已是最大列数' = '최대 열 수입니다' }
  'es'    = @{ '样品列' = 'Columnas de muestra'; '增加样品列' = 'Añadir columna de muestra'; '减少样品列(清空该列数据)' = 'Quitar columna de muestra (borra sus datos)'; '减少样品列' = 'Quitar columna de muestra'; '减少样品列将清空该列已填数据，确定减少吗？' = 'Quitar una columna de muestra borra los datos de esa columna. ¿Continuar?'; '已是最少列数' = 'Número mínimo de columnas'; '已是最大列数' = 'Número máximo de columnas' }
  'fr'    = @{ '样品列' = 'Colonnes échantillon'; '增加样品列' = 'Ajouter une colonne échantillon'; '减少样品列(清空该列数据)' = "Retirer une colonne échantillon (efface ses données)"; '减少样品列' = 'Retirer une colonne échantillon'; '减少样品列将清空该列已填数据，确定减少吗？' = "Retirer une colonne échantillon efface les données saisies dans cette colonne. Continuer ?"; '已是最少列数' = 'Nombre minimal de colonnes atteint'; '已是最大列数' = 'Nombre maximal de colonnes atteint' }
  'de'    = @{ '样品列' = 'Probenspalten'; '增加样品列' = 'Probenspalte hinzufügen'; '减少样品列(清空该列数据)' = 'Probenspalte entfernen (löscht deren Daten)'; '减少样品列' = 'Probenspalte entfernen'; '减少样品列将清空该列已填数据，确定减少吗？' = 'Das Entfernen einer Probenspalte löscht die darin erfassten Daten. Fortfahren?'; '已是最少列数' = 'Minimale Spaltenzahl erreicht'; '已是最大列数' = 'Maximale Spaltenzahl erreicht' }
  'ru'    = @{ '样品列' = 'Столбцы образцов'; '增加样品列' = 'Добавить столбец образца'; '减少样品列(清空该列数据)' = 'Убрать столбец образца (удаляет его данные)'; '减少样品列' = 'Убрать столбец образца'; '减少样品列将清空该列已填数据，确定减少吗？' = 'При удалении столбца образца введённые в нём данные будут стёрты. Продолжить?'; '已是最少列数' = 'Достигнут минимум столбцов'; '已是最大列数' = 'Достигнут максимум столбцов' }
  'vi'    = @{ '样品列' = 'Cột mẫu'; '增加样品列' = 'Thêm cột mẫu'; '减少样品列(清空该列数据)' = 'Bớt cột mẫu (xóa dữ liệu cột đó)'; '减少样品列' = 'Bớt cột mẫu'; '减少样品列将清空该列已填数据，确定减少吗？' = 'Bớt cột mẫu sẽ xóa dữ liệu đã nhập trong cột đó. Tiếp tục?'; '已是最少列数' = 'Đã đạt số cột tối thiểu'; '已是最大列数' = 'Đã đạt số cột tối đa' }
  'th'    = @{ '样品列' = 'คอลัมน์ตัวอย่าง'; '增加样品列' = 'เพิ่มคอลัมน์ตัวอย่าง'; '减少样品列(清空该列数据)' = 'ลดคอลัมน์ตัวอย่าง (ลบข้อมูลในคอลัมน์นั้น)'; '减少样品列' = 'ลดคอลัมน์ตัวอย่าง'; '减少样品列将清空该列已填数据，确定减少吗？' = 'การลดคอลัมน์ตัวอย่างจะลบข้อมูลที่กรอกในคอลัมน์นั้น ดำเนินการต่อหรือไม่?'; '已是最少列数' = 'ถึงจำนวนคอลัมน์ขั้นต่ำแล้ว'; '已是最大列数' = 'ถึงจำนวนคอลัมน์สูงสุดแล้ว' }
}
foreach ($loc in $entries.Keys) {
  $file = Join-Path $dir "$loc.js"
  $text = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
  $anchor = $text.LastIndexOf("`n  },")
  if ($anchor -lt 0) { Write-Host "[$loc] ANCHOR NOT FOUND"; continue }
  $lines = New-Object System.Text.StringBuilder
  $added = 0
  foreach ($k in $K) {
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
