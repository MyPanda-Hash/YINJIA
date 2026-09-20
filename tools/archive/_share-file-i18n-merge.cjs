// _share-file-i18n-merge.cjs — 共享文件库词条一次性合并进 11 个语言包(2026-09-17)
// 只补缺失键(已存在的跳过,防重复);插入位置=biz 块开头,4 空格缩进对齐既有条目。
// 用 node 直接跑:node tools/archive/_share-file-i18n-merge.cjs
const fs = require('fs')
const path = require('path')

const dir = path.resolve(__dirname, '../../frontend/src/i18n/locales')

// 中文原文 → 各语言译文(键=中文原文,与 tt() 用法一致)
const T = {
  en: {
    '共享文件库': 'Shared Files',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': 'Standards, test reports and certification reports. Designated maintainers upload; everyone else reads only.',
    '分类': 'Category', '全部文件': 'All files', '新增分类': 'Add category', '编辑分类': 'Edit category',
    '分类名称': 'Category name', '请输入分类名称': 'Enter a category name', '上级分类': 'Parent category', '一级分类': 'Top level',
    '上传': 'Upload', '搜索：名称/关键词/备注': 'Search: name / keyword / remark',
    '共': 'Total ', '份文件': 'files', '暂无文件': 'No files',
    '文件名称': 'File name', '生效日期': 'Effective date', '失效日期': 'Expiry date', '大小': 'Size', '下载': 'Download',
    '关键词': 'Keywords', '文件': 'File', '请选择分类': 'Select a category', '请输入文件名称': 'Enter a file name',
    '如 2024版或V2.1': 'e.g. 2024 / V2.1', '检索用，空格分隔多词': 'For search; separate words with spaces',
    '替换文件': 'Replace file', '选择文件': 'Choose file', '请选择文件': 'Choose a file',
    '确认删除该分类？': 'Delete this category?', '确认删除该文件？': 'Delete this file?',
    '上传成功': 'Uploaded', '保存成功': 'Saved', '删除成功': 'Deleted',
    '上传失败': 'Upload failed', '保存失败': 'Save failed', '删除失败': 'Delete failed',
    '加载分类失败': 'Failed to load categories', '加载文件失败': 'Failed to load files',
    '已开始下载': 'Download started',
  },
  ja: {
    '共享文件库': '共有ファイル',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': '標準・試験報告・認証報告。指定者がアップロード・管理し、他は閲覧のみ',
    '分类': '分類', '全部文件': 'すべてのファイル', '新增分类': '分類を追加', '编辑分类': '分類を編集',
    '分类名称': '分類名', '请输入分类名称': '分類名を入力してください', '上级分类': '上位分類', '一级分类': '最上位',
    '上传': 'アップロード', '搜索：名称/关键词/备注': '検索：名称・キーワード・備考',
    '共': '計 ', '份文件': '件', '暂无文件': 'ファイルがありません',
    '文件名称': 'ファイル名', '生效日期': '発効日', '失效日期': '失効日', '大小': 'サイズ', '下载': 'ダウンロード',
    '关键词': 'キーワード', '文件': 'ファイル', '请选择分类': '分類を選択してください', '请输入文件名称': 'ファイル名を入力してください',
    '如 2024版或V2.1': '例 2024版 / V2.1', '检索用，空格分隔多词': '検索用、スペース区切り',
    '替换文件': 'ファイルを置換', '选择文件': 'ファイルを選択', '请选择文件': 'ファイルを選択してください',
    '确认删除该分类？': 'この分類を削除しますか？', '确认删除该文件？': 'このファイルを削除しますか？',
    '上传成功': 'アップロードしました', '保存成功': '保存しました', '删除成功': '削除しました',
    '上传失败': 'アップロード失敗', '保存失败': '保存失敗', '删除失败': '削除失敗',
    '加载分类失败': '分類の読み込みに失敗', '加载文件失败': 'ファイルの読み込みに失敗',
    '已开始下载': 'ダウンロードを開始しました',
  },
  ko: {
    '共享文件库': '공유 파일',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': '표준·시험 보고서·인증 보고서. 지정 담당자만 업로드·관리, 그 외 열람 전용',
    '分类': '분류', '全部文件': '전체 파일', '新增分类': '분류 추가', '编辑分类': '분류 편집',
    '分类名称': '분류명', '请输入分类名称': '분류명을 입력하세요', '上级分类': '상위 분류', '一级分类': '최상위',
    '上传': '업로드', '搜索：名称/关键词/备注': '검색: 이름·키워드·비고',
    '共': '총 ', '份文件': '개 파일', '暂无文件': '파일이 없습니다',
    '文件名称': '파일명', '生效日期': '발효일', '失效日期': '실효일', '大小': '크기', '下载': '다운로드',
    '关键词': '키워드', '文件': '파일', '请选择分类': '분류를 선택하세요', '请输入文件名称': '파일명을 입력하세요',
    '如 2024版或V2.1': '예: 2024판 / V2.1', '检索用，空格分隔多词': '검색용, 공백으로 구분',
    '替换文件': '파일 교체', '选择文件': '파일 선택', '请选择文件': '파일을 선택하세요',
    '确认删除该分类？': '이 분류를 삭제할까요?', '确认删除该文件？': '이 파일을 삭제할까요?',
    '上传成功': '업로드됨', '保存成功': '저장됨', '删除成功': '삭제됨',
    '上传失败': '업로드 실패', '保存失败': '저장 실패', '删除失败': '삭제 실패',
    '加载分类失败': '분류 로드 실패', '加载文件失败': '파일 로드 실패',
    '已开始下载': '다운로드를 시작했습니다',
  },
  es: {
    '共享文件库': 'Archivos compartidos',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': 'Normas, informes de ensayo e informes de certificación. Solo personas designadas suben; el resto solo consulta',
    '分类': 'Categoría', '全部文件': 'Todos los archivos', '新增分类': 'Añadir categoría', '编辑分类': 'Editar categoría',
    '分类名称': 'Nombre de categoría', '请输入分类名称': 'Introduzca el nombre de la categoría', '上级分类': 'Categoría superior', '一级分类': 'Nivel superior',
    '上传': 'Subir', '搜索：名称/关键词/备注': 'Buscar: nombre / palabra clave / nota',
    '共': 'Total ', '份文件': 'archivos', '暂无文件': 'Sin archivos',
    '文件名称': 'Nombre del archivo', '生效日期': 'Fecha de entrada en vigor', '失效日期': 'Fecha de caducidad', '大小': 'Tamaño', '下载': 'Descargar',
    '关键词': 'Palabras clave', '文件': 'Archivo', '请选择分类': 'Seleccione una categoría', '请输入文件名称': 'Introduzca el nombre del archivo',
    '如 2024版或V2.1': 'p. ej. 2024 / V2.1', '检索用，空格分隔多词': 'Para búsqueda; separe con espacios',
    '替换文件': 'Reemplazar archivo', '选择文件': 'Elegir archivo', '请选择文件': 'Elija un archivo',
    '确认删除该分类？': '¿Eliminar esta categoría?', '确认删除该文件？': '¿Eliminar este archivo?',
    '上传成功': 'Subido', '保存成功': 'Guardado', '删除成功': 'Eliminado',
    '上传失败': 'Error al subir', '保存失败': 'Error al guardar', '删除失败': 'Error al eliminar',
    '加载分类失败': 'Error al cargar categorías', '加载文件失败': 'Error al cargar archivos',
    '已开始下载': 'Descarga iniciada',
  },
  fr: {
    '共享文件库': 'Fichiers partagés',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': "Ressources partagées de toute l'entreprise : normes / rapports d'essai / rapports de certification. Seules les personnes désignées téléversent ; les autres consultent seulement",
    '分类': 'Catégorie', '全部文件': 'Tous les fichiers', '新增分类': 'Ajouter une catégorie', '编辑分类': 'Modifier la catégorie',
    '分类名称': 'Nom de la catégorie', '请输入分类名称': 'Saisissez le nom de la catégorie', '上级分类': 'Catégorie parente', '一级分类': 'Niveau supérieur',
    '上传': 'Téléverser', '搜索：名称/关键词/备注': 'Rechercher : nom / mot-clé / remarque',
    '共': 'Total ', '份文件': 'fichiers', '暂无文件': 'Aucun fichier',
    '文件名称': 'Nom du fichier', '生效日期': "Date d'effet", '失效日期': "Date d'expiration", '大小': 'Taille', '下载': 'Télécharger',
    '关键词': 'Mots-clés', '文件': 'Fichier', '请选择分类': 'Sélectionnez une catégorie', '请输入文件名称': 'Saisissez le nom du fichier',
    '如 2024版或V2.1': 'ex. 2024 / V2.1', '检索用，空格分隔多词': 'Pour la recherche ; séparez par des espaces',
    '替换文件': 'Remplacer le fichier', '选择文件': 'Choisir un fichier', '请选择文件': 'Choisissez un fichier',
    '确认删除该分类？': 'Supprimer cette catégorie ?', '确认删除该文件？': 'Supprimer ce fichier ?',
    '上传成功': 'Téléversé', '保存成功': 'Enregistré', '删除成功': 'Supprimé',
    '上传失败': 'Échec du téléversement', '保存失败': "Échec de l'enregistrement", '删除失败': 'Échec de la suppression',
    '加载分类失败': 'Échec du chargement des catégories', '加载文件失败': 'Échec du chargement des fichiers',
    '已开始下载': 'Téléchargement démarré',
  },
  de: {
    '共享文件库': 'Freigegebene Dateien',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': 'Normes, rapports d\'essai et rapports de certification. Seules les personnes désignées téléversent ; les autres consultent seulement',
    '分类': 'Kategorie', '全部文件': 'Alle Dateien', '新增分类': 'Kategorie hinzufügen', '编辑分类': 'Kategorie bearbeiten',
    '分类名称': 'Kategoriename', '请输入分类名称': 'Kategorienamen eingeben', '上级分类': 'Übergeordnete Kategorie', '一级分类': 'Oberste Ebene',
    '上传': 'Hochladen', '搜索：名称/关键词/备注': 'Suche: Name / Stichwort / Bemerkung',
    '共': 'Gesamt ', '份文件': 'Dateien', '暂无文件': 'Keine Dateien',
    '文件名称': 'Dateiname', '生效日期': 'Wirksam ab', '失效日期': 'Gültig bis', '大小': 'Größe', '下载': 'Herunterladen',
    '关键词': 'Stichwörter', '文件': 'Datei', '请选择分类': 'Kategorie auswählen', '请输入文件名称': 'Dateinamen eingeben',
    '如 2024版或V2.1': 'z. B. 2024 / V2.1', '检索用，空格分隔多词': 'Für die Suche; Wörter mit Leerzeichen trennen',
    '替换文件': 'Datei ersetzen', '选择文件': 'Datei wählen', '请选择文件': 'Wählen Sie eine Datei',
    '确认删除该分类？': 'Diese Kategorie löschen?', '确认删除该文件？': 'Diese Datei löschen?',
    '上传成功': 'Hochgeladen', '保存成功': 'Gespeichert', '删除成功': 'Gelöscht',
    '上传失败': 'Hochladen fehlgeschlagen', '保存失败': 'Speichern fehlgeschlagen', '删除失败': 'Löschen fehlgeschlagen',
    '加载分类失败': 'Kategorien laden fehlgeschlagen', '加载文件失败': 'Dateien laden fehlgeschlagen',
    '已开始下载': 'Download gestartet',
  },
  ru: {
    '共享文件库': 'Общие файлы',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': 'Normen, Prüfberichte und Zertifizierungsberichte. Nur benannte Personen laden hoch; alle anderen lesen nur',
    '分类': 'Категория', '全部文件': 'Все файлы', '新增分类': 'Добавить категорию', '编辑分类': 'Изменить категорию',
    '分类名称': 'Название категории', '请输入分类名称': 'Введите название категории', '上级分类': 'Родительская категория', '一级分类': 'Верхний уровень',
    '上传': 'Загрузить', '搜索：名称/关键词/备注': 'Поиск: название / ключевое слово / примечание',
    '共': 'Всего ', '份文件': 'файлов', '暂无文件': 'Нет файлов',
    '文件名称': 'Название файла', '生效日期': 'Дата вступления', '失效日期': 'Дата истечения', '大小': 'Размер', '下载': 'Скачать',
    '关键词': 'Ключевые слова', '文件': 'Файл', '请选择分类': 'Выберите категорию', '请输入文件名称': 'Введите название файла',
    '如 2024版或V2.1': 'напр. 2024 / V2.1', '检索用，空格分隔多词': 'Для поиска; слова через пробел',
    '替换文件': 'Заменить файл', '选择文件': 'Выбрать файл', '请选择文件': 'Выберите файл',
    '确认删除该分类？': 'Удалить эту категорию?', '确认删除该文件？': 'Удалить этот файл?',
    '上传成功': 'Загружено', '保存成功': 'Сохранено', '删除成功': 'Удалено',
    '上传失败': 'Ошибка загрузки', '保存失败': 'Ошибка сохранения', '删除失败': 'Ошибка удаления',
    '加载分类失败': 'Не удалось загрузить категории', '加载文件失败': 'Не удалось загрузить файлы',
    '已开始下载': 'Загрузка началась',
  },
  vi: {
    '共享文件库': 'Tệp chia sẻ',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': 'Стандарты, протоколы испытаний и сертификаты. Загружают только назначенные лица; остальные только читают',
    '分类': 'Phân loại', '全部文件': 'Tất cả tệp', '新增分类': 'Thêm phân loại', '编辑分类': 'Sửa phân loại',
    '分类名称': 'Tên phân loại', '请输入分类名称': 'Nhập tên phân loại', '上级分类': 'Phân loại cha', '一级分类': 'Cấp cao nhất',
    '上传': 'Tải lên', '搜索：名称/关键词/备注': 'Tìm: tên / từ khóa / ghi chú',
    '共': 'Tổng ', '份文件': 'tệp', '暂无文件': 'Không có tệp',
    '文件名称': 'Tên tệp', '生效日期': 'Ngày hiệu lực', '失效日期': 'Ngày hết hiệu lực', '大小': 'Kích thước', '下载': 'Tải xuống',
    '关键词': 'Từ khóa', '文件': 'Tệp', '请选择分类': 'Chọn phân loại', '请输入文件名称': 'Nhập tên tệp',
    '如 2024版或V2.1': 'vd. 2024 / V2.1', '检索用，空格分隔多词': 'Dùng để tìm kiếm; cách nhau bằng dấu cách',
    '替换文件': 'Thay thế tệp', '选择文件': 'Chọn tệp', '请选择文件': 'Hãy chọn tệp',
    '确认删除该分类？': 'Xóa phân loại này?', '确认删除该文件？': 'Xóa tệp này?',
    '上传成功': 'Đã tải lên', '保存成功': 'Đã lưu', '删除成功': 'Đã xóa',
    '上传失败': 'Tải lên thất bại', '保存失败': 'Lưu thất bại', '删除失败': 'Xóa thất bại',
    '加载分类失败': 'Tải phân loại thất bại', '加载文件失败': 'Tải tệp thất bại',
    '已开始下载': 'Đã bắt đầu tải xuống',
  },
  th: {
    '共享文件库': 'ไฟล์แชร์',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': 'Tiêu chuẩn, báo cáo thử nghiệm, báo cáo chứng nhận. Chỉ người được chỉ định tải lên; phần còn lại chỉ xem',
    '分类': 'หมวดหมู่', '全部文件': 'ไฟล์ทั้งหมด', '新增分类': 'เพิ่มหมวดหมู่', '编辑分类': 'แก้ไขหมวดหมู่',
    '分类名称': 'ชื่อหมวดหมู่', '请输入分类名称': 'กรอกชื่อหมวดหมู่', '上级分类': 'หมวดหมู่บน', '一级分类': 'ระดับบนสุด',
    '上传': 'อัปโหลด', '搜索：名称/关键词/备注': 'ค้นหา: ชื่อ / คีย์เวิร์ด / หมายเหตุ',
    '共': 'รวม ', '份文件': 'ไฟล์', '暂无文件': 'ไม่มีไฟล์',
    '文件名称': 'ชื่อไฟล์', '生效日期': 'วันที่มีผล', '失效日期': 'วันที่หมดอายุ', '大小': 'ขนาด', '下载': 'ดาวน์โหลด',
    '关键词': 'คีย์เวิร์ด', '文件': 'ไฟล์', '请选择分类': 'เลือกหมวดหมู่', '请输入文件名称': 'กรอกชื่อไฟล์',
    '如 2024版或V2.1': 'เช่น 2024 / V2.1', '检索用，空格分隔多词': 'ใช้ค้นหา คั่นด้วยวรรค',
    '替换文件': 'แทนที่ไฟล์', '选择文件': 'เลือกไฟล์', '请选择文件': 'โปรดเลือกไฟล์',
    '确认删除该分类？': 'ลบหมวดหมู่นี้?', '确认删除该文件？': 'ลบไฟล์นี้?',
    '上传成功': 'อัปโหลดแล้ว', '保存成功': 'บันทึกแล้ว', '删除成功': 'ลบแล้ว',
    '上传失败': 'อัปโหลดล้มเหลว', '保存失败': 'บันทึกล้มเหลว', '删除失败': 'ลบล้มเหลว',
    '加载分类失败': 'โหลดหมวดหมู่ล้มเหลว', '加载文件失败': 'โหลดไฟล์ล้มเหลว',
    '已开始下载': 'เริ่มดาวน์โหลดแล้ว',
  },
  'zh-TW': {
    '共享文件库': '共享文件庫',
    '标准、测试报告、认证报告，指定人上传维护，其余仅查阅': 'มาตรฐาน รายงานทดสอบ รายงานรับรอง ผู้ที่ได้รับมอบหมายเท่านั้นที่อัปโหลด ส่วนอื่นอ่านอย่างเดียว',
    '分类': '分類', '全部文件': '全部文件', '新增分类': '新增分類', '编辑分类': '編輯分類',
    '分类名称': '分類名稱', '请输入分类名称': '請輸入分類名稱', '上级分类': '上級分類', '一级分类': '一級分類',
    '上传': '上傳', '搜索：名称/关键词/备注': '搜尋：名稱 / 關鍵詞 / 備註',
    '共': '共 ', '份文件': '份文件', '暂无文件': '暫無文件',
    '文件名称': '檔案名稱', '生效日期': '生效日期', '失效日期': '失效日期', '大小': '大小', '下载': '下載',
    '关键词': '關鍵詞', '文件': '檔案', '请选择分类': '請選擇分類', '请输入文件名称': '請輸入檔案名稱',
    '如 2024版或V2.1': '如 2024版或V2.1', '检索用，空格分隔多词': '檢索用，空格分隔多詞',
    '替换文件': '替換檔案', '选择文件': '選擇檔案', '请选择文件': '請選擇檔案',
    '确认删除该分类？': '確認刪除該分類？', '确认删除该文件？': '確認刪除該檔案？',
    '上传成功': '上傳成功', '保存成功': '儲存成功', '删除成功': '刪除成功',
    '上传失败': '上傳失敗', '保存失败': '儲存失敗', '删除失败': '刪除失敗',
    '加载分类失败': '載入分類失敗', '加载文件失败': '載入文件失敗',
    '已开始下载': '已開始下載',
  },
}
// zh-CN 恒等映射(tt 缺键回退原文,补上是为文档化)
T['zh-CN'] = Object.fromEntries(Object.keys(T.en).map((k) => [k, k]))

let report = []
for (const [locale, words] of Object.entries(T)) {
  const file = path.join(dir, `${locale}.js`)
  let src = fs.readFileSync(file, 'utf8')
  const marker = '  biz: {'
  const at = src.indexOf(marker)
  if (at < 0) { report.push(`${locale}.js: biz 块未找到,跳过`); continue }
  const insertAt = at + marker.length
  const lines = []
  let added = 0
  for (const [zh, tr] of Object.entries(words)) {
    if (src.includes(`'${zh}'`)) continue // 已有(任意命名空间)不重复
    const v = String(tr).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    lines.push(`\r\n    '${zh.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}': '${v}',`)
    added++
  }
  if (lines.length) src = src.slice(0, insertAt) + lines.join('') + src.slice(insertAt)
  fs.writeFileSync(file, src, 'utf8')
  report.push(`${locale}.js: +${added} 词条`)
}
console.log(report.join('\n'))
