# _i18n-attachment-keys.ps1 — 附件字段(FileAttachCell)11 词条补进 10 个静态语言包(插到 biz 末尾)
# 幂等:已存在的键跳过;UTF-8 无 BOM 写回。
$ErrorActionPreference = 'Stop'
$dir = 'C:\INCER\YINJIA-MES\frontend\src\i18n\locales'

$entries = @{
  'en'    = [ordered]@{
    '上传附件' = 'Upload Attachment'
    '暂无附件' = 'No attachments'
    '文件大小' = 'File Size'
    '上传人' = 'Uploaded By'
    '上传时间' = 'Upload Time'
    '请先保存单据再上传附件' = 'Save the document before uploading attachments'
    '附件上传失败' = 'Attachment upload failed'
    '确认删除该附件？' = 'Delete this attachment?'
    '附件已删除' = 'Attachment deleted'
    '附件删除失败' = 'Failed to delete attachment'
    '附件下载失败' = 'Attachment download failed'
  }
  'zh-TW' = [ordered]@{
    '上传附件' = '上傳附件'
    '暂无附件' = '暫無附件'
    '文件大小' = '檔案大小'
    '上传人' = '上傳人'
    '上传时间' = '上傳時間'
    '请先保存单据再上传附件' = '請先保存單據再上傳附件'
    '附件上传失败' = '附件上傳失敗'
    '确认删除该附件？' = '確認刪除該附件？'
    '附件已删除' = '附件已刪除'
    '附件删除失败' = '附件刪除失敗'
    '附件下载失败' = '附件下載失敗'
  }
  'ja'    = [ordered]@{
    '上传附件' = '添付ファイルをアップロード'
    '暂无附件' = '添付ファイルなし'
    '文件大小' = 'ファイルサイズ'
    '上传人' = 'アップロード者'
    '上传时间' = 'アップロード日時'
    '请先保存单据再上传附件' = '伝票を保存してから添付ファイルをアップロードしてください'
    '附件上传失败' = '添付ファイルのアップロードに失敗しました'
    '确认删除该附件？' = 'この添付ファイルを削除しますか？'
    '附件已删除' = '添付ファイルを削除しました'
    '附件删除失败' = '添付ファイルの削除に失敗しました'
    '附件下载失败' = '添付ファイルのダウンロードに失敗しました'
  }
  'ko'    = [ordered]@{
    '上传附件' = '첨부파일 업로드'
    '暂无附件' = '첨부파일 없음'
    '文件大小' = '파일 크기'
    '上传人' = '업로드한 사람'
    '上传时间' = '업로드 시간'
    '请先保存单据再上传附件' = '먼저 전표를 저장한 후 첨부파일을 업로드하세요'
    '附件上传失败' = '첨부파일 업로드 실패'
    '确认删除该附件？' = '이 첨부파일을 삭제하시겠습니까?'
    '附件已删除' = '첨부파일이 삭제되었습니다'
    '附件删除失败' = '첨부파일 삭제 실패'
    '附件下载失败' = '첨부파일 다운로드 실패'
  }
  'es'    = [ordered]@{
    '上传附件' = 'Subir adjunto'
    '暂无附件' = 'Sin adjuntos'
    '文件大小' = 'Tamaño del archivo'
    '上传人' = 'Subido por'
    '上传时间' = 'Fecha de subida'
    '请先保存单据再上传附件' = 'Guarde el documento antes de subir adjuntos'
    '附件上传失败' = 'Error al subir el adjunto'
    '确认删除该附件？' = '¿Eliminar este adjunto?'
    '附件已删除' = 'Adjunto eliminado'
    '附件删除失败' = 'Error al eliminar el adjunto'
    '附件下载失败' = 'Error al descargar el adjunto'
  }
  'fr'    = [ordered]@{
    '上传附件' = 'Téléverser une pièce jointe'
    '暂无附件' = 'Aucune pièce jointe'
    '文件大小' = 'Taille du fichier'
    '上传人' = 'Téléversé par'
    '上传时间' = 'Date de téléversement'
    '请先保存单据再上传附件' = 'Enregistrez le document avant de téléverser des pièces jointes'
    '附件上传失败' = 'Échec du téléversement de la pièce jointe'
    '确认删除该附件？' = 'Supprimer cette pièce jointe ?'
    '附件已删除' = 'Pièce jointe supprimée'
    '附件删除失败' = 'Échec de la suppression de la pièce jointe'
    '附件下载失败' = 'Échec du téléchargement de la pièce jointe'
  }
  'de'    = [ordered]@{
    '上传附件' = 'Anhang hochladen'
    '暂无附件' = 'Keine Anhänge'
    '文件大小' = 'Dateigröße'
    '上传人' = 'Hochgeladen von'
    '上传时间' = 'Upload-Zeit'
    '请先保存单据再上传附件' = 'Speichern Sie das Dokument, bevor Sie Anhänge hochladen'
    '附件上传失败' = 'Hochladen des Anhangs fehlgeschlagen'
    '确认删除该附件？' = 'Diesen Anhang löschen?'
    '附件已删除' = 'Anhang gelöscht'
    '附件删除失败' = 'Löschen des Anhangs fehlgeschlagen'
    '附件下载失败' = 'Download des Anhangs fehlgeschlagen'
  }
  'ru'    = [ordered]@{
    '上传附件' = 'Загрузить вложение'
    '暂无附件' = 'Нет вложений'
    '文件大小' = 'Размер файла'
    '上传人' = 'Загрузил'
    '上传时间' = 'Время загрузки'
    '请先保存单据再上传附件' = 'Сохраните документ, прежде чем загружать вложения'
    '附件上传失败' = 'Не удалось загрузить вложение'
    '确认删除该附件？' = 'Удалить это вложение?'
    '附件已删除' = 'Вложение удалено'
    '附件删除失败' = 'Не удалось удалить вложение'
    '附件下载失败' = 'Не удалось скачать вложение'
  }
  'vi'    = [ordered]@{
    '上传附件' = 'Tải lên tệp đính kèm'
    '暂无附件' = 'Chưa có tệp đính kèm'
    '文件大小' = 'Kích thước tệp'
    '上传人' = 'Người tải lên'
    '上传时间' = 'Thời gian tải lên'
    '请先保存单据再上传附件' = 'Hãy lưu chứng từ trước khi tải lên tệp đính kèm'
    '附件上传失败' = 'Tải lên tệp đính kèm thất bại'
    '确认删除该附件？' = 'Xóa tệp đính kèm này?'
    '附件已删除' = 'Đã xóa tệp đính kèm'
    '附件删除失败' = 'Xóa tệp đính kèm thất bại'
    '附件下载失败' = 'Tải xuống tệp đính kèm thất bại'
  }
  'th'    = [ordered]@{
    '上传附件' = 'อัปโหลดไฟล์แนบ'
    '暂无附件' = 'ยังไม่มีไฟล์แนบ'
    '文件大小' = 'ขนาดไฟล์'
    '上传人' = 'อัปโหลดโดย'
    '上传时间' = 'เวลาอัปโหลด'
    '请先保存单据再上传附件' = 'โปรดบันทึกเอกสารก่อนอัปโหลดไฟล์แนบ'
    '附件上传失败' = 'อัปโหลดไฟล์แนบไม่สำเร็จ'
    '确认删除该附件？' = 'ลบไฟล์แนบนี้?'
    '附件已删除' = 'ลบไฟล์แนบแล้ว'
    '附件删除失败' = 'ลบไฟล์แนบไม่สำเร็จ'
    '附件下载失败' = 'ดาวน์โหลดไฟล์แนบไม่สำเร็จ'
  }
}

foreach ($loc in $entries.Keys) {
  $file = Join-Path $dir "$loc.js"
  $text = [System.IO.File]::ReadAllText($file, [System.Text.UTF8Encoding]::new($false))
  $anchor = $text.LastIndexOf("`n  },")
  if ($anchor -lt 0) { Write-Host "[$loc] ANCHOR NOT FOUND"; continue }
  $lines = New-Object System.Text.StringBuilder
  $added = 0
  foreach ($k in $entries[$loc].Keys) {
    $marker = "'" + $k + "':"
    if ($text.Contains($marker)) { continue }  # 幂等:已有跳过
    $v = $entries[$loc][$k]
    [void]$lines.Append("    '$k': '$v',`n")
    $added++
  }
  if ($added -gt 0) {
    $text = $text.Insert($anchor + 1, $lines.ToString())
    [System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))
  }
  Write-Host "[$loc] +$added keys"
}
Write-Host 'done'
