# _i18n-destroy-keys.ps1 — 彻底删除功能 3 词条补进 10 个静态语言包(幂等;JS 单引号转义 \')
$ErrorActionPreference = 'Stop'
$dir = 'C:\INCER\YINJIA-MES\frontend\src\i18n\locales'
$K1 = '彻底删除'
$K2 = '彻底删除该条目？不可恢复，已录入单据不受影响。'
$K3 = '已彻底删除'
$entries = @{
  'en'    = @{ $K1 = 'Delete Permanently'; $K2 = 'Delete this entry permanently? This cannot be undone. Recorded sheets are not affected.'; $K3 = 'Entry permanently deleted' }
  'zh-TW' = @{ $K1 = '徹底刪除'; $K2 = '徹底刪除該條目？不可恢復，已錄入單據不受影響。'; $K3 = '已徹底刪除' }
  'ja'    = @{ $K1 = '完全削除'; $K2 = 'この条目を完全に削除しますか？元に戻せません。入力済み伝票には影響しません。'; $K3 = '完全に削除しました' }
  'ko'    = @{ $K1 = '완전 삭제'; $K2 = '이 항목을 완전히 삭제하시겠습니까? 복구할 수 없습니다. 입력된 전표에는 영향이 없습니다.'; $K3 = '완전 삭제되었습니다' }
  'es'    = @{ $K1 = 'Eliminar definitivamente'; $K2 = '¿Eliminar esta entrada definitivamente? No se puede deshacer. Las hojas registradas no se ven afectadas.'; $K3 = 'Entrada eliminada definitivamente' }
  'fr'    = @{ $K1 = 'Supprimer définitivement'; $K2 = "Supprimer définitivement cette entrée ? Action irréversible. Les fiches saisies ne sont pas affectées."; $K3 = 'Entrée supprimée définitivement' }
  'de'    = @{ $K1 = 'Endgültig löschen'; $K2 = 'Diesen Eintrag endgültig löschen? Nicht wiederherstellbar. Erfasste Bögen sind nicht betroffen.'; $K3 = 'Eintrag endgültig gelöscht' }
  'ru'    = @{ $K1 = 'Удалить окончательно'; $K2 = 'Окончательно удалить эту запись? Восстановление невозможно. Введённые листы не затрагиваются.'; $K3 = 'Запись окончательно удалена' }
  'vi'    = @{ $K1 = 'Xóa vĩnh viễn'; $K2 = 'Xóa vĩnh viễn mục này? Không thể khôi phục. Chứng từ đã nhập không bị ảnh hưởng.'; $K3 = 'Đã xóa vĩnh viễn' }
  'th'    = @{ $K1 = 'ลบถาวร'; $K2 = 'ลบรายการนี้ถาวรหรือไม่? ไม่สามารถกู้คืนได้ เอกสารที่บันทึกแล้วไม่ได้รับผลกระทบ'; $K3 = 'ลบถาวรแล้ว' }
}
foreach ($loc in $entries.Keys) {
  $file = Join-Path $dir "$loc.js"
  $text = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
  $anchor = $text.LastIndexOf("`n  },")
  if ($anchor -lt 0) { Write-Host "[$loc] ANCHOR NOT FOUND"; continue }
  $lines = New-Object System.Text.StringBuilder
  $added = 0
  foreach ($k in @($K1, $K2, $K3)) {
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
