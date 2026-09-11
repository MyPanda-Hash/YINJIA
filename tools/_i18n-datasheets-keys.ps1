# _i18n-datasheets-keys.ps1 — 项目进度查数据记录表 5 词条补进 10 语言包(幂等;转义 \')
$ErrorActionPreference = 'Stop'
$dir = 'C:\INCER\YINJIA-MES\frontend\src\i18n\locales'
$K = @('数据记录表单据', '数据记录表', '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）', '该行未填项目编号，无法关联数据记录表', '查看', '查询失败')
$entries = @{
  'en'    = @{ '数据记录表单据'='Data Record Sheets'; '数据记录表'='Data Record Sheet'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='No data record sheets for this project. Sheets link to the project approval by document no. — make sure the project code is filled in.'; '该行未填项目编号，无法关联数据记录表'='No project code on this row; cannot link data record sheets'; '查看'='View'; '查询失败'='Query failed' }
  'zh-TW' = @{ '数据记录表单据'='數據記錄表單據'; '数据记录表'='數據記錄表'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='該項目暫無數據記錄表單據（數據記錄表按文檔編號關聯立項申請，請確認已按該項目編號填寫）'; '该行未填项目编号，无法关联数据记录表'='該行未填項目編號，無法關聯數據記錄表'; '查看'='查看'; '查询失败'='查詢失敗' }
  'ja'    = @{ '数据记录表单据'='データ記録表伝票'; '数据记录表'='データ記録表'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='本プロジェクトのデータ記録表はありません（文書番号で立項申請と紐づくため、項目番号の記入をご確認ください）'; '该行未填项目编号，无法关联数据记录表'='項目番号未記入のため紐付けできません'; '查看'='表示'; '查询失败'='照会失敗' }
  'ko'    = @{ '数据记录表单据'='데이터 기록표 전표'; '数据记录表'='데이터 기록표'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='이 프로젝트의 데이터 기록표가 없습니다(문서번호로 입항 신청과 연결됨 — 프로젝트 번호 기입을 확인하세요)'; '该行未填项目编号，无法关联数据记录表'='프로젝트 번호 미기입으로 연결 불가'; '查看'='보기'; '查询失败'='조회 실패' }
  'es'    = @{ '数据记录表单据'='Hojas de registro de datos'; '数据记录表'='Hoja de registro'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='Sin hojas de registro para este proyecto (se vinculan por n.º de documento; verifique el código del proyecto).'; '该行未填项目编号，无法关联数据记录表'='Fila sin código de proyecto; no se puede vincular'; '查看'='Ver'; '查询失败'='Error de consulta' }
  'fr'    = @{ '数据记录表单据'='Fiches de relevé de données'; '数据记录表'='Fiche de relevé'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'="Aucune fiche pour ce projet (liées par n° de document ; vérifiez le code projet)."; '该行未填项目编号，无法关联数据记录表'='Code projet manquant ; liaison impossible'; '查看'='Voir'; '查询失败'='Échec de la requête' }
  'de'    = @{ '数据记录表单据'='Datenerfassungsbögen'; '数据记录表'='Datenerfassungsbogen'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='Keine Bögen für dieses Projekt (Verknüpfung über Dokumentnr.; Projektnr. prüfen).'; '该行未填项目编号，无法关联数据记录表'='Keine Projektnummer in der Zeile; Verknüpfung nicht möglich'; '查看'='Ansehen'; '查询失败'='Abfrage fehlgeschlagen' }
  'ru'    = @{ '数据记录表单据'='Листы записи данных'; '数据记录表'='Лист записи'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='Нет листов записи по проекту (связь по номеру документа; проверьте номер проекта).'; '该行未填项目编号，无法关联数据记录表'='В строке нет номера проекта — привязка невозможна'; '查看'='Открыть'; '查询失败'='Ошибка запроса' }
  'vi'    = @{ '数据记录表单据'='Chứng từ ghi dữ liệu'; '数据记录表'='Biểu ghi dữ liệu'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='Chưa có biểu ghi dữ liệu cho dự án (liên kết theo số tài liệu; kiểm tra mã dự án).'; '该行未填项目编号，无法关联数据记录表'='Dòng chưa có mã dự án, không thể liên kết'; '查看'='Xem'; '查询失败'='Truy vấn thất bại' }
  'th'    = @{ '数据记录表单据'='เอกสารบันทึกข้อมูล'; '数据记录表'='แบบบันทึกข้อมูล'; '该项目暂无数据记录表单据（数据记录表按文档编号关联立项申请，请确认已按该项目编号填写）'='ยังไม่มีแบบบันทึกข้อมูลของโปรเจกต์ (เชื่อมโดยเลขที่เอกสาร โปรดตรวจรหัสโปรเจกต์)'; '该行未填项目编号，无法关联数据记录表'='แถวไม่มีรหัสโปรเจกต์ เชื่อมไม่ได้'; '查看'='ดู'; '查询失败'='สอบถามล้มเหลว' }
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
