# _i18n-testlib-keys.ps1 — 检验项目标准库重构 2 词条补进 10 个静态语言包(幂等)
$ErrorActionPreference = 'Stop'
$dir = 'C:\INCER\YINJIA-MES\frontend\src\i18n\locales'
$K1 = '请先勾选一条要编辑的条目'
$K2 = '库条目均可维护：勾选一条可「编辑」，✕ 停用、↩ 恢复启用；改库只影响以后的勾选，已录入单据不变。'
$entries = @{
  'en'    = @{ $K1 = 'Check one entry to edit first'; $K2 = 'All library entries are maintainable: check one to Edit; ✕ disables, ↩ re-enables. Library changes only affect future picks; recorded sheets stay unchanged.' }
  'zh-TW' = @{ $K1 = '請先勾選一條要編輯的條目'; $K2 = '庫條目均可維護：勾選一條可「編輯」，✕ 停用、↩ 恢復啟用；改庫只影響以後的勾選，已錄入單據不變。' }
  'ja'    = @{ $K1 = '編集する条目を1つ選択してください'; $K2 = 'ライブラリ条目はすべてメンテナンス可能：1つ選択して「編集」、✕ で停用、↩ で再有効化。ライブラリ変更は今後の選択候補にのみ影響し、入力済み伝票は変わりません。' }
  'ko'    = @{ $K1 = '편집할 항목을 하나 선택하세요'; $K2 = '라이브러리 항목은 모두 유지 관리 가능: 항목 하나를 선택해 «편집», ✕ 정지, ↩ 재사용. 라이브러리 변경은 이후 선택에만 적용되며 이미 입력된 전표는 바뀌지 않습니다.' }
  'es'    = @{ $K1 = 'Primero marque una entrada para editar'; $K2 = 'Todas las entradas de la biblioteca se pueden mantener: marque una para Editar; ✕ deshabilita, ↩ reactiva. Los cambios solo afectan a selecciones futuras; las hojas registradas no cambian.' }
  'fr'    = @{ $K1 = "Cochez d'abord une entrée à modifier"; $K2 = "Toutes les entrées de la bibliothèque sont maintenables : cochez-en une pour Modifier ; ✕ désactive, ↩ réactive. Les changements n'affectent que les sélections futures ; les fiches saisies restent inchangées." }
  'de'    = @{ $K1 = 'Zum Bearbeiten zuerst einen Eintrag auswählen'; $K2 = 'Alle Bibliothekseinträge sind pflegbar: einen zum Bearbeiten markieren; ✕ deaktiviert, ↩ reaktiviert. Änderungen wirken nur auf künftige Auswahlen; erfasste Bögen bleiben unverändert.' }
  'ru'    = @{ $K1 = 'Сначала отметьте одну запись для правки'; $K2 = 'Все записи библиотеки можно редактировать: отметьте одну для «Изменить»; ✕ — отключить, ↩ — включить снова. Изменения влияют только на будущий выбор; введённые листы не меняются.' }
  'vi'    = @{ $K1 = 'Hãy chọn một mục để sửa trước'; $K2 = 'Mọi mục trong thư viện đều có thể bảo trì: chọn một mục để «Sửa»; ✕ tạm dừng, ↩ kích hoạt lại. Thay đổi chỉ ảnh hưởng lần chọn sau; chứng từ đã nhập không đổi.' }
  'th'    = @{ $K1 = 'โปรดเลือกรายการที่จะแก้ไขหนึ่งรายการก่อน'; $K2 = 'รายการในคลังทุกรายการดูแลได้: เลือกหนึ่งรายการเพื่อ «แก้ไข»; ✕ ปิดใช้งาน, ↩ เปิดใช้งานใหม่ การแก้คลังมีผลกับการเลือกครั้งถัดไปเท่านั้น เอกสารที่บันทึกแล้วไม่เปลี่ยน' }
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
    # JS 单引号转义是 \'(不是 SQL 的 '');值里出现 ' 时必须转对,否则语言包语法错误
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
