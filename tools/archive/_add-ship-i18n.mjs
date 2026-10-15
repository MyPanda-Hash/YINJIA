/*
 * _add-ship-i18n.mjs — 一次性补齐「检验项目维护 · 来源②出货检验计划」词条的 9 个语言包。
 *
 * 为什么要手写而不是跑 tools/gen/gen-locales-gap.cjs:
 *   本机没有 backend/.env ⇒ 阿里云机翻密钥未注入 ⇒ /api/locale/dict 返回空词典,
 *   gen-locales-gap 会「一条都不补」(静默),而多语言规范不可豁免(en 已有,其余语言必须有)。
 *   故按 en.js 的 10 条键人工翻译后落盘;日后机翻通道恢复时这些词条已存在,不会被覆盖(脚本查重跳过)。
 *
 * 用法(仓库根):node tools/archive/_add-ship-i18n.mjs
 * 幂等:已存在该键的语言包不动。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'frontend', 'src', 'i18n', 'locales')

const K = {
  lib: '检验标准库',
  ship: '出货检验计划',
  planNo: '计划单号',
  noHead: '（表头未填）',
  freq: '检查频率',
  needCode: '本单还没填「产品编码」，先在表头填写后再取计划',
  noPlan: '该产品没有出货检验计划或计划里没有检验项目',
  tip: '下面列出本单产品对应的《出货检验计划表》里已经填好的检验项目（控制项目/控制标准及要求/控制方法/检测频率）。这里是只读来源：勾选后点「带入明细」写进本单，不会改动标准库、也不会改动计划本身；要改计划请到「研发管理 → 出货检验计划表」。',
  typeTip: '检验类型 = 项目分类（如 外观检测/重量检测）：一个方案 = 一类项目，带入检验单后它就是横表的「表区」。项目的检验数量可留空；填了 N，带入后该项目在横表里就有 N 格、列头「＋」加不过它。',
  catPh: '如 外观 / 重要尺寸 / 性能 / 材质 / 包装(可直接输入新类别)',
}

/** locale -> [lib, ship, planNo, noHead, freq, needCode, noPlan, tip, typeTip, catPh] */
const T = {
  ja: ['検査標準ライブラリ', '出荷検査計画', '計画番号', '（ヘッダー未入力）', '検査頻度',
    'この伝票には「製品コード」が未入力です。先にヘッダーへ入力してから計画を取得してください',
    'この製品の出荷検査計画がないか、計画に検査項目がありません',
    'この伝票の製品に対応する《出荷検査計画表》に入力済みの検査項目（管理項目／管理基準と要求／管理方法／検査頻度）を以下に表示します。ここは参照専用です。チェックして「明細へ取込」を押すと本伝票に書き込まれ、標準ライブラリも計画自体も変更しません。計画を変更するには「研究開発管理 → 出荷検査計画表」を開いてください。',
    '検査タイプ＝項目分類（例：外観検査／重量検査）。1 つの方案＝1 つの分類で、検査伝票に取り込むとそれが横表の「表区」になります。項目の検査数量は空欄可。N を入れると、取り込み後にその項目は横表で N マスになり、列頭の「＋」ではそれを超えて増やせません。',
    '例：外観／重要寸法／性能／材質／包装（新しい分類を直接入力できます）'],

  ko: ['검사 표준 라이브러리', '출하 검사 계획', '계획 번호', '(상단 미입력)', '검사 빈도',
    '이 전표에 「제품 코드」가 없습니다. 먼저 상단에 입력한 뒤 계획을 가져오세요',
    '이 제품의 출하 검사 계획이 없거나 계획에 검사 항목이 없습니다',
    '이 전표의 제품에 해당하는 《출하 검사 계획표》에 이미 입력된 검사 항목(관리 항목/관리 기준 및 요구/관리 방법/검사 빈도)을 아래에 표시합니다. 여기는 읽기 전용입니다. 선택 후 「명세에 추가」를 누르면 이 전표에 기록되며, 표준 라이브러리와 계획 자체는 변경되지 않습니다. 계획을 수정하려면 「연구개발 관리 → 출하 검사 계획표」로 가세요.',
    '검사 유형 = 항목 분류(예: 외관 검사/중량 검사). 하나의 방안 = 하나의 분류이며, 검사 전표에 반영되면 그 분류가 횡표의 「표구역」이 됩니다. 항목의 검사 수량은 비워 둘 수 있습니다. N을 입력하면 반영 후 해당 항목이 횡표에서 N칸이 되고, 열 머리의 「＋」로는 그 이상 늘릴 수 없습니다.',
    '예: 외관 / 주요 치수 / 성능 / 재질 / 포장 (새 분류를 직접 입력할 수 있습니다)'],

  de: ['Prüfstandard-Bibliothek', 'Versandprüfplan', 'Plannummer', '(im Kopf nicht ausgefüllt)', 'Prüfhäufigkeit',
    'Auf diesem Beleg fehlt der Produktcode – bitte zuerst im Kopf eintragen, dann den Plan laden',
    'Für dieses Produkt gibt es keinen Versandprüfplan oder der Plan enthält keine Prüfpositionen',
    'Unten stehen die im Versandprüfplan bereits ausgefüllten Prüfpositionen für das Produkt dieses Belegs (Kontrollposition / Kontrollstandard und Anforderung / Kontrollmethode / Prüfhäufigkeit). Diese Quelle ist schreibgeschützt: auswählen und „In Positionen übernehmen“ schreibt sie in diesen Beleg; weder die Standardbibliothek noch der Plan selbst werden geändert. Zum Bearbeiten des Plans: Forschung & Entwicklung → Versandprüfplan.',
    'Prüfart = Positionskategorie (z. B. Sichtprüfung / Gewichtsprüfung): ein Plan = eine Kategorie, und beim Übernehmen in den Prüfbeleg wird sie zum „Tabellenbereich“ der Quertabelle. Die Prüfmenge der Position darf leer bleiben; bei N erhält die Position N Felder in der Quertabelle, und das „+“ in der Spaltenüberschrift kann sie nicht überschreiten.',
    'z. B. Aussehen / Hauptmaße / Leistung / Material / Verpackung (neue Kategorie direkt eingeben)'],

  es: ['Biblioteca de estándares de inspección', 'Plan de inspección de envío', 'N.º de plan', '(sin rellenar en el encabezado)', 'Frecuencia de inspección',
    'Esta hoja aún no tiene código de producto: rellénelo en el encabezado y luego obtenga el plan',
    'Este producto no tiene plan de inspección de envío, o el plan no tiene partidas de inspección',
    'Abajo se listan las partidas de inspección ya rellenadas en el Plan de inspección de envío para el producto de esta hoja (partida de control / estándar y requisito de control / método de control / frecuencia de inspección). Esta fuente es de solo lectura: marque y pulse «Añadir al detalle» para escribirlas en esta hoja; no modifica ni la biblioteca de estándares ni el propio plan. Para editar el plan, vaya a Gestión de I+D → Plan de inspección de envío.',
    'Tipo de inspección = categoría de la partida (p. ej. Inspección visual / Inspección de peso): un plan = una categoría, y al añadirla a la hoja de inspección se convierte en el «área de tabla» de la tabla horizontal. La cantidad de inspección de la partida puede quedar vacía; si pone N, esa partida tendrá N casillas en la tabla y el «+» de la cabecera de columna no podrá superarlo.',
    'p. ej. Aspecto / Medidas principales / Rendimiento / Material / Embalaje (puede escribir una categoría nueva)'],

  fr: ['Bibliothèque des normes d\'inspection', 'Plan d\'inspection d\'expédition', 'N° de plan', '(non renseigné dans l\'en-tête)', 'Fréquence d\'inspection',
    'Ce document n\'a pas encore de code produit : saisissez-le dans l\'en-tête puis récupérez le plan',
    'Aucun plan d\'inspection d\'expédition pour ce produit, ou le plan ne contient aucune rubrique d\'inspection',
    'Ci-dessous figurent les rubriques d\'inspection déjà saisies dans le Plan d\'inspection d\'expédition pour le produit de ce document (rubrique de contrôle / norme et exigence de contrôle / méthode de contrôle / fréquence d\'inspection). Cette source est en lecture seule : cochez puis cliquez sur « Ajouter au détail » pour les écrire dans ce document ; ni la bibliothèque de normes ni le plan lui-même ne sont modifiés. Pour modifier le plan : Gestion R&D → Plan d\'inspection d\'expédition.',
    'Type d\'inspection = catégorie de rubrique (ex. Contrôle visuel / Contrôle du poids) : un plan = une catégorie, et une fois ajoutée au document d\'inspection elle devient la « zone de tableau » du tableau horizontal. La quantité d\'inspection de la rubrique peut rester vide ; si vous saisissez N, cette rubrique disposera de N cases dans le tableau et le « + » de l\'en-tête de colonne ne pourra pas la dépasser.',
    'ex. Aspect / Dimensions principales / Performance / Matériau / Emballage (vous pouvez saisir une nouvelle catégorie)'],

  ru: ['Библиотека стандартов контроля', 'План выходного контроля', 'Номер плана', '(не заполнено в шапке)', 'Частота контроля',
    'В этом документе не указан код продукта — сначала заполните его в шапке, затем загрузите план',
    'Для этого продукта нет плана выходного контроля либо в плане нет пунктов контроля',
    'Ниже перечислены пункты контроля, уже заполненные в «Плане выходного контроля» для продукта этого документа (контролируемый пункт / контрольный стандарт и требование / метод контроля / частота контроля). Этот источник доступен только для чтения: отметьте пункты и нажмите «Добавить в спецификацию» — они будут записаны в этот документ; ни библиотека стандартов, ни сам план не изменяются. Чтобы изменить план, перейдите в «Управление НИОКР → План выходного контроля».',
    'Тип контроля = категория пункта (например, Визуальный контроль / Контроль массы): один план = одна категория, и после добавления в документ контроля она становится «областью таблицы» горизонтальной таблицы. Количество измерений можно оставить пустым; если указать N, пункт получит в таблице N ячеек, и «+» в заголовке столбца не сможет это превысить.',
    'например, Внешний вид / Основные размеры / Характеристики / Материал / Упаковка (можно ввести новую категорию)'],

  th: ['คลังมาตรฐานการตรวจสอบ', 'แผนตรวจสอบก่อนส่งออก', 'เลขที่แผน', '(ยังไม่ได้กรอกในส่วนหัว)', 'ความถี่ในการตรวจสอบ',
    'เอกสารนี้ยังไม่มีรหัสผลิตภัณฑ์ กรุณากรอกในส่วนหัวก่อนแล้วจึงดึงแผน',
    'ผลิตภัณฑ์นี้ไม่มีแผนตรวจสอบก่อนส่งออก หรือแผนไม่มีรายการตรวจสอบ',
    'ด้านล่างคือรายการตรวจสอบที่กรอกไว้แล้วใน《แผนตรวจสอบก่อนส่งออก》ของผลิตภัณฑ์ในเอกสารนี้ (รายการควบคุม/มาตรฐานและข้อกำหนดการควบคุม/วิธีการควบคุม/ความถี่ในการตรวจสอบ) แหล่งนี้เป็นแบบอ่านอย่างเดียว เลือกแล้วกด「เพิ่มในรายละเอียด」เพื่อเขียนลงเอกสารนี้ โดยไม่แก้ไขคลังมาตรฐานและไม่แก้ไขตัวแผน หากต้องการแก้ไขแผนไปที่「การจัดการวิจัยและพัฒนา → แผนตรวจสอบก่อนส่งออก」',
    'ประเภทการตรวจสอบ = หมวดหมู่รายการ (เช่น ตรวจสอบภายนอก/ตรวจสอบน้ำหนัก) หนึ่งแผน = หนึ่งหมวดหมู่ เมื่อนำเข้าตารางตรวจสอบแล้วจะกลายเป็น「พื้นที่ตาราง」ของตารางแนวนอน จำนวนการตรวจสอบของรายการเว้นว่างได้ หากกรอก N รายการนั้นจะมี N ช่องในตาราง และปุ่ม「＋」ที่หัวคอลัมน์จะเพิ่มเกินกว่านั้นไม่ได้',
    'เช่น ภายนอก / ขนาดสำคัญ / สมรรถนะ / วัสดุ / บรรจุภัณฑ์ (พิมพ์หมวดหมู่ใหม่ได้เลย)'],

  vi: ['Thư viện tiêu chuẩn kiểm tra', 'Kế hoạch kiểm tra xuất hàng', 'Số kế hoạch', '(chưa điền ở phần đầu)', 'Tần suất kiểm tra',
    'Phiếu này chưa có mã sản phẩm — hãy điền ở phần đầu rồi lấy kế hoạch',
    'Sản phẩm này không có kế hoạch kiểm tra xuất hàng, hoặc kế hoạch không có hạng mục kiểm tra',
    'Dưới đây là các hạng mục kiểm tra đã được điền trong《Kế hoạch kiểm tra xuất hàng》của sản phẩm trên phiếu này (hạng mục kiểm soát/tiêu chuẩn và yêu cầu kiểm soát/phương pháp kiểm soát/tần suất kiểm tra). Nguồn này chỉ để đọc: tích chọn rồi bấm「Đưa vào chi tiết」để ghi vào phiếu này, không thay đổi thư viện tiêu chuẩn và không thay đổi bản thân kế hoạch. Muốn sửa kế hoạch, vào「Quản lý R&D → Kế hoạch kiểm tra xuất hàng」.',
    'Loại kiểm tra = phân loại hạng mục (ví dụ Kiểm tra ngoại quan/Kiểm tra trọng lượng): một phương án = một phân loại, khi đưa vào phiếu kiểm tra nó trở thành「vùng bảng」của bảng ngang. Số lượng kiểm tra của hạng mục có thể để trống; nếu điền N, hạng mục đó sẽ có N ô trong bảng và nút「＋」ở đầu cột không thể vượt quá.',
    'ví dụ Ngoại quan / Kích thước chính / Tính năng / Vật liệu / Bao bì (có thể nhập phân loại mới)'],

  'zh-TW': ['檢驗標準庫', '出貨檢驗計劃', '計劃單號', '（表頭未填）', '檢查頻率',
    '本單還沒填「產品編號」，先在表頭填寫後再取計劃',
    '該產品沒有出貨檢驗計劃，或計劃裡沒有檢驗項目',
    '下方列出本單產品對應的《出貨檢驗計劃表》裡已經填好的檢驗項目（控制項目／控制標準及要求／控制方法／檢測頻率）。這裡是唯讀來源：勾選後點「帶入明細」寫進本單，不會改動標準庫、也不會改動計劃本身；要改計劃請到「研發管理 → 出貨檢驗計劃表」。',
    '檢驗類型＝項目分類（如 外觀檢測／重量檢測）：一個方案＝一類項目，帶入檢驗單後它就是橫表的「表區」。項目的檢驗數量可留空；填了 N，帶入後該項目在橫表裡就有 N 格、列頭「＋」加不過它。',
    '如 外觀／重要尺寸／性能／材質／包裝（可直接輸入新類別）'],
}

const ORDER = [K.lib, K.ship, K.planNo, K.noHead, K.freq, K.needCode, K.noPlan, K.tip, K.typeTip, K.catPh]
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

let changed = 0
for (const [loc, vals] of Object.entries(T)) {
  const file = path.join(DIR, `${loc}.js`)
  let src = fs.readFileSync(file, 'utf8')
  const lines = []
  ORDER.forEach((k, i) => {
    // 查重(单/双引号两种写法都算已有):已有则跳过,不覆盖人工翻译
    const re = new RegExp(`(['"])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`)
    if (re.test(src)) return
    lines.push(`    '${esc(k)}': '${esc(vals[i])}',`)
  })
  if (!lines.length) { console.log(`${loc}: 无需补(已齐)`); continue }
  // ⚠ 语言包是 CRLF 行尾(仓库 checkout 设置),锚点要兼容 \r\n —— 只找 '  biz: {\n' 会一条都匹配不上
  const m = /\r?\n(\s*)biz:\s*\{\r?\n/.exec(src)
  if (!m) { console.log(`${loc}: ⚠ 找不到 biz 锚点,跳过`); continue }
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const at = m.index + m[0].length
  const block = `    // ---- 检验项目维护·来源②「出货检验计划」(组装成品检验单专用,2026-10-17)----${nl}${lines.join(nl)}${nl}`
  src = src.slice(0, at) + block + src.slice(at)
  fs.writeFileSync(file, src, 'utf8')
  console.log(`${loc}: 补 ${lines.length} 条`)
  changed++
}
console.log(`\n完成:${changed} 个语言包有改动`)
