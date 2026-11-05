/**
 * _print-station-i18n-20261104.mjs — 自动打印(按电脑 + 按打印类型)改造的新增 UI 文案补进 9 个语言包
 *
 * 为什么用脚本而不是手改:本次在 PrintStation.vue 里新增/改写了二十多条界面文案,
 * 逐个人工编辑 9 个语言包必漏(AGENTS 硬规范:新 UI 文案必须走 tt(),且切换语言后
 * 不能还是中文)。脚本做法 = 在语言包 biz 对象**末尾、闭合括号之前**插入一批键值;
 * 已存在的键**不覆盖**(人工校对过的译名优先),只补缺失的。
 *
 * 用法(在仓库根):
 *   node tools/archive/_print-station-i18n-20261104.mjs            # 干跑,只报告缺哪些
 *   node tools/archive/_print-station-i18n-20261104.mjs --write    # 真写
 *   node tools/archive/_print-station-i18n-20261104.mjs --audit    # 只列 PrintStation.vue 里缺译名的 tt() 文案
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const locDir = resolve(root, 'frontend/src/i18n/locales')
const vueFile = resolve(root, 'frontend/src/views/sys/PrintStation.vue')
const WRITE = process.argv.includes('--write')
const AUDIT = process.argv.includes('--audit')

const LOCALES = { en: 1, ja: 2, ko: 3, es: 4, fr: 5, de: 6, ru: 7, vi: 8, th: 9 }

/**
 * 词条表:[中文原文, en, ja, ko, es, fr, de, ru, vi, th]
 *
 * 收录范围 = 本次改造后的 PrintStation.vue 全部 tt() 文案里**其它页面没有译过**的那些
 * (「自动打印」「站点名称」「打印机」「保存失败」等全站通用词条已在语言包里,不重复)。
 */
const ROWS = [
  // ── 页头 / 本机配置 ──
  ['只在这台电脑生效:打开开关 + 勾选要打的报表', 'Applies to this computer only: turn it on and tick the reports to print', 'このパソコンだけに適用:スイッチを入れて印刷する帳票にチェック', '이 PC에만 적용: 스위치를 켜고 인쇄할 보고서를 선택', 'Solo afecta a este equipo: actívelo y marque los informes a imprimir', 'S\'applique à ce poste : activez et cochez les états à imprimer', 'Nur für diesen Rechner: aktivieren und Berichte ankreuzen', 'Только для этого компьютера: включите и отметьте нужные отчёты', 'Chỉ áp dụng cho máy này: bật công tắc và chọn báo biểu cần in', 'ใช้กับเครื่องนี้เท่านั้น: เปิดสวิตช์และเลือกแบบฟอร์มที่จะพิมพ์'],
  ['本机配置', 'This computer', 'このパソコンの設定', '이 PC 설정', 'Este equipo', 'Ce poste', 'Dieser Rechner', 'Этот компьютер', 'Máy này', 'เครื่องนี้'],
  ['只对这台电脑生效', 'Applies to this computer only', 'このパソコンだけに適用', '이 PC에만 적용', 'Solo afecta a este equipo', 'Ce poste uniquement', 'Nur für diesen Rechner', 'Только этот компьютер', 'Chỉ áp dụng cho máy này', 'ใช้กับเครื่องนี้เท่านั้น'],
  ['启用自动打印(本机)', 'Enable auto print (this computer)', '自動印刷を有効化(このパソコン)', '자동 인쇄 사용(이 PC)', 'Activar impresión automática (este equipo)', 'Activer l\'impression auto (ce poste)', 'Automatischen Druck aktivieren (dieser Rechner)', 'Включить автопечать (этот компьютер)', 'Bật in tự động (máy này)', 'เปิดพิมพ์อัตโนมัติ (เครื่องนี้)'],
  ['只影响这台电脑;没打开的电脑不会收到打印任务', 'Affects this computer only; computers that are not enabled receive no print jobs', 'このパソコンだけに影響。有効でないパソコンには印刷ジョブが届きません', '이 PC에만 영향. 켜지 않은 PC에는 인쇄 작업이 가지 않습니다', 'Solo afecta a este equipo; los equipos no activados no reciben trabajos', 'Concerne ce poste uniquement ; les postes non activés ne reçoivent rien', 'Betrifft nur diesen Rechner; nicht aktivierte Rechner erhalten keine Druckaufträge', 'Влияет только на этот компьютер; выключенные не получают задания', 'Chỉ ảnh hưởng máy này; máy không bật sẽ không nhận lệnh in', 'มีผลกับเครื่องนี้เท่านั้น เครื่องที่ไม่ได้เปิดจะไม่ได้รับงานพิมพ์'],
  ['手机上提示"已发送到打印电脑「…」"时显示的名字', 'Name shown in the mobile hint "sent to print computer «…»"', 'スマホの「印刷PC『…』に送信しました」に表示される名前', '모바일의 "인쇄 PC «…»로 보냄"에 표시되는 이름', 'Nombre que aparece en el aviso "enviado al equipo «…»"', 'Nom affiché dans « envoyé au poste « … » » sur mobile', 'Name im Handy-Hinweis „an Druckrechner «…» gesendet"', 'Имя в сообщении «отправлено на компьютер «…»»', 'Tên hiển thị trong thông báo "đã gửi tới máy in «…»"', 'ชื่อที่แสดงในข้อความ "ส่งไปยังเครื่องพิมพ์ «…»" บนมือถือ'],

  // ── 打印类型 ──
  ['打印类型', 'Print types', '印刷種別', '인쇄 유형', 'Tipos de impresión', 'Types d\'impression', 'Druckarten', 'Виды печати', 'Loại in', 'ประเภทการพิมพ์'],
  ['勾选的类型才会发到这台电脑;同一类型多台电脑都勾了,那几台都会打印', 'Only ticked types are sent to this computer; if several computers tick the same type, all of them print', 'チェックした種別だけがこのパソコンに届きます。同じ種別を複数台でチェックすると全て印刷します', '체크한 유형만 이 PC로 전송됩니다. 같은 유형을 여러 PC가 체크하면 모두 인쇄합니다', 'Solo los tipos marcados llegan a este equipo; si varios equipos marcan el mismo tipo, todos imprimen', 'Seuls les types cochés arrivent à ce poste ; si plusieurs postes cochent le même type, tous impriment', 'Nur angekreuzte Arten gehen an diesen Rechner; mehrere Rechner mit derselben Art drucken alle', 'На этот компьютер идут только отмеченные виды; если отметили несколько, печатают все', 'Chỉ loại được chọn mới gửi tới máy này; nhiều máy cùng chọn thì tất cả đều in', 'เฉพาะประเภทที่เลือกจะส่งมาที่เครื่องนี้ ถ้าหลายเครื่องเลือกเหมือนกัน ทุกเครื่องจะพิมพ์'],
  ['服务端还没有登记任何打印类型', 'No print type registered on the server yet', 'サーバーに印刷種別がまだ登録されていません', '서버에 등록된 인쇄 유형이 없습니다', 'Aún no hay tipos de impresión registrados en el servidor', 'Aucun type d\'impression enregistré sur le serveur', 'Auf dem Server ist noch keine Druckart registriert', 'На сервере ещё не зарегистрированы виды печати', 'Máy chủ chưa đăng ký loại in nào', 'ยังไม่มีประเภทการพิมพ์ลงทะเบียนบนเซิร์ฟเวอร์'],
  ['本机开关已打开,但一个打印类型都没勾 —— 这台电脑不会收到任何打印任务', 'The switch is on but no print type is ticked — this computer will receive no print jobs', 'スイッチは入っていますが印刷種別が未チェックです。このパソコンには印刷ジョブが届きません', '스위치는 켜져 있지만 인쇄 유형이 없습니다. 이 PC는 인쇄 작업을 받지 않습니다', 'El interruptor está activo pero no hay tipos marcados: este equipo no recibirá trabajos', 'L\'interrupteur est actif mais aucun type n\'est coché : ce poste ne recevra rien', 'Der Schalter ist an, aber keine Druckart angekreuzt — dieser Rechner erhält keine Aufträge', 'Выключатель включён, но виды печати не отмечены — этот компьютер не получит заданий', 'Đã bật công tắc nhưng chưa chọn loại in — máy này sẽ không nhận lệnh in', 'เปิดสวิตช์แล้วแต่ยังไม่ได้เลือกประเภทการพิมพ์ เครื่องนี้จะไม่ได้รับงานพิมพ์'],

  // ── 连接状态 ──
  ['服务端总闸', 'Server master switch', 'サーバー側マスタースイッチ', '서버 마스터 스위치', 'Interruptor maestro del servidor', 'Interrupteur maître serveur', 'Server-Hauptschalter', 'Главный выключатель сервера', 'Công tắc tổng máy chủ', 'สวิตช์หลักฝั่งเซิร์ฟเวอร์'],
  ['常开(由服务器固定,不需要在这里开)', 'Always on (fixed on the server; nothing to switch here)', '常時オン(サーバーで固定。ここで操作不要)', '항상 켜짐(서버에서 고정, 여기서 조작 불필요)', 'Siempre activo (fijado en el servidor; aquí no se toca)', 'Toujours actif (fixé côté serveur ; rien à faire ici)', 'Immer an (serverseitig fest; hier nichts zu schalten)', 'Всегда включён (задан на сервере; здесь не переключается)', 'Luôn bật (cố định trên máy chủ; không cần bật ở đây)', 'เปิดตลอด (กำหนดที่เซิร์ฟเวอร์ ไม่ต้องเปิดที่นี่)'],
  ['本机开关', 'This computer switch', 'このパソコンのスイッチ', '이 PC 스위치', 'Interruptor de este equipo', 'Interrupteur de ce poste', 'Schalter dieses Rechners', 'Выключатель этого компьютера', 'Công tắc máy này', 'สวิตช์ของเครื่องนี้'],
  ['本机订阅', 'Types subscribed here', 'このパソコンの購読種別', '이 PC 구독 유형', 'Tipos suscritos aquí', 'Types souscrits ici', 'Hier abonnierte Arten', 'Виды, выбранные здесь', 'Loại đã chọn ở máy này', 'ประเภทที่เลือกที่เครื่องนี้'],
  ['未勾选任何类型', 'No type ticked', '種別未選択', '선택된 유형 없음', 'Sin tipos marcados', 'Aucun type coché', 'Keine Art angekreuzt', 'Виды не отмечены', 'Chưa chọn loại nào', 'ยังไม่ได้เลือกประเภท'],
  ['打印电脑', 'Print computers', '印刷パソコン', '인쇄 PC', 'Equipos de impresión', 'Postes d\'impression', 'Druckrechner', 'Компьютеры печати', 'Máy in tính toán', 'เครื่องพิมพ์'],
  ['还没有电脑打开过这一页', 'No computer has opened this page yet', 'まだどのパソコンもこの画面を開いていません', '아직 이 화면을 연 PC가 없습니다', 'Ningún equipo ha abierto esta página todavía', 'Aucun poste n\'a encore ouvert cette page', 'Noch kein Rechner hat diese Seite geöffnet', 'Ни один компьютер ещё не открывал эту страницу', 'Chưa có máy nào mở trang này', 'ยังไม่มีเครื่องใดเปิดหน้านี้'],
  ['本机', 'This computer', 'このパソコン', '이 PC', 'Este equipo', 'Ce poste', 'Dieser Rechner', 'Этот компьютер', 'Máy này', 'เครื่องนี้'],
  ['开关关着', 'Switch off', 'スイッチOFF', '스위치 꺼짐', 'Interruptor apagado', 'Interrupteur coupé', 'Schalter aus', 'Выключатель выключен', 'Công tắc đang tắt', 'สวิตช์ปิด'],
  ['本机已开启', 'Enabled here', 'このパソコンで有効', '이 PC에서 켜짐', 'Activado aquí', 'Activé ici', 'Hier aktiviert', 'Включено здесь', 'Đã bật ở máy này', 'เปิดที่เครื่องนี้'],
  ['本机未启用', 'Not enabled here', 'このパソコンでは無効', '이 PC에서 꺼짐', 'No activado aquí', 'Non activé ici', 'Hier nicht aktiviert', 'Здесь не включено', 'Chưa bật ở máy này', 'ยังไม่เปิดที่เครื่องนี้'],
  ['已开启', 'Enabled', '有効', '켜짐', 'Activado', 'Activé', 'Aktiviert', 'Включено', 'Đã bật', 'เปิดแล้ว'],
  ['已关闭', 'Disabled', '無効', '꺼짐', 'Desactivado', 'Désactivé', 'Deaktiviert', 'Выключено', 'Đã tắt', 'ปิดแล้ว'],

  // ── 保存提示 / 出纸记录 ──
  ['这台电脑已开启自动打印', 'Auto print enabled on this computer', 'このパソコンで自動印刷を有効にしました', '이 PC에서 자동 인쇄를 켰습니다', 'Impresión automática activada en este equipo', 'Impression auto activée sur ce poste', 'Automatischer Druck auf diesem Rechner aktiviert', 'Автопечать включена на этом компьютере', 'Đã bật in tự động trên máy này', 'เปิดพิมพ์อัตโนมัติบนเครื่องนี้แล้ว'],
  ['这台电脑已关闭自动打印', 'Auto print disabled on this computer', 'このパソコンで自動印刷を無効にしました', '이 PC에서 자동 인쇄를 껐습니다', 'Impresión automática desactivada en este equipo', 'Impression auto désactivée sur ce poste', 'Automatischer Druck auf diesem Rechner deaktiviert', 'Автопечать выключена на этом компьютере', 'Đã tắt in tự động trên máy này', 'ปิดพิมพ์อัตโนมัติบนเครื่องนี้แล้ว'],
  ['没有勾选任何打印类型:这台电脑不会收到打印任务', 'No print type ticked: this computer will receive no print jobs', '印刷種別が未選択です。このパソコンには印刷ジョブが届きません', '인쇄 유형이 없습니다. 이 PC는 인쇄 작업을 받지 않습니다', 'Sin tipos marcados: este equipo no recibirá trabajos', 'Aucun type coché : ce poste ne recevra rien', 'Keine Druckart angekreuzt: dieser Rechner erhält keine Aufträge', 'Виды печати не отмечены: этот компьютер не получит заданий', 'Chưa chọn loại in: máy này sẽ không nhận lệnh in', 'ยังไม่ได้เลือกประเภทการพิมพ์ เครื่องนี้จะไม่ได้รับงานพิมพ์'],
  ['已出纸', 'Printed', '印刷済み', '인쇄됨', 'Impresa', 'Imprimé', 'Gedruckt', 'Напечатано', 'Đã in', 'พิมพ์แล้ว'],
  ['已生成 PDF', 'PDF created', 'PDF作成済み', 'PDF 생성됨', 'PDF creado', 'PDF créé', 'PDF erstellt', 'PDF создан', 'Đã tạo PDF', 'สร้าง PDF แล้ว'],
  ['浏览器打印', 'Browser print', 'ブラウザ印刷', '브라우저 인쇄', 'Impresión del navegador', 'Impression navigateur', 'Browserdruck', 'Печать из браузера', 'In bằng trình duyệt', 'พิมพ์ผ่านเบราว์เซอร์'],
  ['已发送到打印电脑', 'Sent to the print computer', '印刷パソコンに送信しました', '인쇄 PC로 보냈습니다', 'Enviado al equipo de impresión', 'Envoyé au poste d\'impression', 'An den Druckrechner gesendet', 'Отправлено на компьютер печати', 'Đã gửi tới máy in', 'ส่งไปยังเครื่องพิมพ์แล้ว'],

  // ── 后端 enqueue 的提示文案(手机端会把它当 errText 显示)──
  ['生产领料单', 'Picking slip', '払出伝票', '출고전표', 'Vale de retirada', 'Bon de prélèvement', 'Entnahmeschein', 'Накладная выдачи', 'Phiếu xuất', 'ใบเบิก'],

  // ── 2026-11-01 就加进来、但当时漏了译名的输出方式/代理文案(本次一并补齐)──
  ['输出方式', 'Output method', '出力方法', '출력 방식', 'Método de salida', 'Mode de sortie', 'Ausgabemodus', 'Способ вывода', 'Cách xuất', 'วิธีการส่งออก'],
  ['自动 = 有打印机就出纸,打不出来自动存 PDF', 'Auto = print when a printer is available, otherwise save a PDF', '自動 = プリンタがあれば印刷、なければ PDF 保存', '자동 = 프린터가 있으면 인쇄, 없으면 PDF 저장', 'Auto = imprime si hay impresora; si no, guarda PDF', 'Auto = imprime si possible, sinon PDF', 'Auto = drucken, sonst PDF speichern', 'Авто = печать при наличии принтера, иначе PDF', 'Tự động = có máy in thì in, không thì lưu PDF', 'อัตโนมัติ = พิมพ์ถ้ามีเครื่องพิมพ์ ไม่มีก็บันทึก PDF'],
  ['自动(推荐)', 'Auto (recommended)', '自動(推奨)', '자동(권장)', 'Auto (recomendado)', 'Auto (recommandé)', 'Auto (empfohlen)', 'Авто (рекомендуется)', 'Tự động (khuyến nghị)', 'อัตโนมัติ (แนะนำ)'],
  ['直接打印', 'Print directly', '直接印刷', '직접 인쇄', 'Imprimir directamente', 'Imprimer directement', 'Direkt drucken', 'Печатать напрямую', 'In trực tiếp', 'พิมพ์โดยตรง'],
  ['只生成 PDF', 'PDF only', 'PDF のみ', 'PDF만', 'Solo PDF', 'PDF uniquement', 'Nur PDF', 'Только PDF', 'Chỉ PDF', 'เฉพาะ PDF'],
  ['PDF 存放目录', 'PDF folder', 'PDF 保存先', 'PDF 저장 폴더', 'Carpeta de PDF', 'Dossier PDF', 'PDF-Ordner', 'Папка PDF', 'Thư mục PDF', 'โฟลเดอร์ PDF'],
  ['仅「自动/只生成 PDF」时使用;留空 = 代理默认 print-out', 'Used for Auto / PDF only; empty = agent default (print-out)', '「自動/PDFのみ」で使用。空欄 = エージェント既定 print-out', '"자동/PDF만"에서 사용. 비우면 에이전트 기본 print-out', 'Solo para Auto / Solo PDF; vacío = print-out del agente', 'Utilisé pour Auto / PDF ; vide = print-out de l\'agent', 'Nur bei Auto / Nur PDF; leer = Agent-Standard print-out', 'Только для Авто / Только PDF; пусто = print-out агента', 'Chỉ dùng cho Tự động / Chỉ PDF; trống = print-out mặc định', 'ใช้เฉพาะ Auto / PDF เท่านั้น ว่าง = ค่าเริ่มต้น print-out ของเอเจนต์'],
  ['如 D:\\MES-PDF', 'e.g. D:\\MES-PDF', '例 D:\\MES-PDF', '예 D:\\MES-PDF', 'p. ej. D:\\MES-PDF', 'ex. D:\\MES-PDF', 'z. B. D:\\MES-PDF', 'напр. D:\\MES-PDF', 'vd D:\\MES-PDF', 'เช่น D:\\MES-PDF'],
  ['已连接(本机页面可直接控制)', 'Connected (this page controls it directly)', '接続済み(この画面から操作可)', '연결됨(이 화면에서 제어 가능)', 'Conectado (esta página lo controla)', 'Connecté (contrôlé depuis cette page)', 'Verbunden (direkt von dieser Seite steuerbar)', 'Подключён (управляется с этой страницы)', 'Đã kết nối (trang này điều khiển trực tiếp)', 'เชื่อมต่อแล้ว (ควบคุมจากหน้านี้ได้)'],
  ['由打印电脑自行取任务,不受本页面控制', 'Print computers fetch jobs themselves; this page does not control them', '印刷パソコンが自分で取得します。この画面からは制御しません', '인쇄 PC가 직접 가져갑니다. 이 화면에서 제어하지 않습니다', 'Los equipos recogen los trabajos solos; esta página no los controla', 'Les postes récupèrent les travaux eux-mêmes ; cette page ne les contrôle pas', 'Druckrechner holen Aufträge selbst; diese Seite steuert sie nicht', 'Компьютеры забирают задания сами; эта страница ими не управляет', 'Máy in tự lấy lệnh; trang này không điều khiển chúng', 'เครื่องพิมพ์ดึงงานเอง หน้านี้ไม่ได้ควบคุม'],
  ['代理出纸方式', 'Agent output mode', 'エージェント出力モード', '에이전트 출력 모드', 'Modo de salida del agente', 'Mode de sortie de l\'agent', 'Ausgabemodus des Agenten', 'Режим вывода агента', 'Chế độ xuất của agent', 'โหมดส่งออกของเอเจนต์'],
  ['只生成 PDF 文件', 'PDF file only', 'PDF ファイルのみ', 'PDF 파일만', 'Solo archivo PDF', 'Fichier PDF uniquement', 'Nur PDF-Datei', 'Только файл PDF', 'Chỉ tệp PDF', 'เฉพาะไฟล์ PDF'],
  ['自动(有打印机出纸,否则存 PDF)', 'Auto (print if possible, otherwise save PDF)', '自動(印刷できれば印刷、なければ PDF)', '자동(가능하면 인쇄, 아니면 PDF)', 'Auto (imprime si puede; si no, PDF)', 'Auto (imprime si possible, sinon PDF)', 'Auto (drucken wenn möglich, sonst PDF)', 'Авто (печать при возможности, иначе PDF)', 'Tự động (in nếu được, không thì PDF)', 'อัตโนมัติ (พิมพ์ได้ก็พิมพ์ ไม่ได้ก็ PDF)'],
  ['最近生成', 'Last generated', '直近の生成', '최근 생성', 'Último generado', 'Dernier généré', 'Zuletzt erzeugt', 'Последний созданный', 'Mới tạo gần đây', 'สร้างล่าสุด'],
  ['无打印机时:print-agent.ps1 -Mode Pdf(只生成 PDF 文件,不出纸)', 'No printer: print-agent.ps1 -Mode Pdf (PDF file only, no paper)', 'プリンタ無し: print-agent.ps1 -Mode Pdf(PDF のみ)', '프린터 없음: print-agent.ps1 -Mode Pdf(PDF만)', 'Sin impresora: print-agent.ps1 -Mode Pdf (solo PDF)', 'Sans imprimante : print-agent.ps1 -Mode Pdf (PDF seul)', 'Ohne Drucker: print-agent.ps1 -Mode Pdf (nur PDF)', 'Без принтера: print-agent.ps1 -Mode Pdf (только PDF)', 'Không có máy in: print-agent.ps1 -Mode Pdf (chỉ PDF)', 'ไม่มีเครื่องพิมพ์: print-agent.ps1 -Mode Pdf (เฉพาะ PDF)'],
  ['有打印机时:print-agent.ps1 -Mode Printer(直接打系统打印机)', 'With a printer: print-agent.ps1 -Mode Printer (system printer directly)', 'プリンタ有り: print-agent.ps1 -Mode Printer(直接印刷)', '프린터 있음: print-agent.ps1 -Mode Printer(직접 인쇄)', 'Con impresora: print-agent.ps1 -Mode Printer (impresión directa)', 'Avec imprimante : print-agent.ps1 -Mode Printer (impression directe)', 'Mit Drucker: print-agent.ps1 -Mode Printer (direkt drucken)', 'С принтером: print-agent.ps1 -Mode Printer (печать напрямую)', 'Có máy in: print-agent.ps1 -Mode Printer (in trực tiếp)', 'มีเครื่องพิมพ์: print-agent.ps1 -Mode Printer (พิมพ์โดยตรง)'],
  ['加 -Install 参数跑一次即可设为开机自启', 'Run once with -Install to start automatically at boot', '-Install を付けて一度実行するとスタートアップ登録', '-Install 로 한 번 실행하면 시작프로그램 등록', 'Ejecute una vez con -Install para iniciar con el sistema', 'Lancez une fois avec -Install pour démarrer au boot', 'Einmal mit -Install starten = Autostart', 'Запустите раз с -Install для автозапуска', 'Chạy một lần với -Install để tự khởi động', 'รันหนึ่งครั้งด้วย -Install เพื่อเริ่มตอนเปิดเครื่อง'],
  ['已保存到打印代理', 'Saved to the print agent', '印刷エージェントに保存しました', '인쇄 에이전트에 저장됨', 'Guardado en el agente de impresión', 'Enregistré dans l\'agent d\'impression', 'Im Druckagenten gespeichert', 'Сохранено в агенте печати', 'Đã lưu vào agent in', 'บันทึกไปยังเอเจนต์พิมพ์แล้ว'],

  // ── 2026-11-04 第二轮:改成「打印电脑清单」形态后的文案 ──
  ['哪台电脑打什么报表,在这里勾选;没勾的电脑不会出纸', 'Tick which reports each computer prints; unticked computers never print', 'どのパソコンで何を印刷するかをここで選択。チェックの無いパソコンは印刷しません', '어느 PC가 무엇을 인쇄할지 여기서 선택. 체크하지 않은 PC는 인쇄하지 않습니다', 'Marque qué informes imprime cada equipo; los no marcados no imprimen', 'Cochez les états imprimés par chaque poste ; les postes non cochés n\'impriment pas', 'Ankreuzen, welcher Rechner welche Berichte druckt; nicht angekreuzte drucken nicht', 'Отметьте, какие отчёты печатает каждый компьютер; неотмеченные не печатают', 'Chọn báo biểu cho từng máy in; máy không chọn sẽ không in', 'เลือกว่าเครื่องใดพิมพ์แบบฟอร์มใด เครื่องที่ไม่ได้เลือกจะไม่พิมพ์'],
  ['站点名 = 安装打印代理时填的 -Station', 'Station name = the -Station given when installing the print agent', 'ステーション名 = 印刷エージェント導入時の -Station', '스테이션 이름 = 인쇄 에이전트 설치 시 -Station', 'Nombre del puesto = el -Station indicado al instalar el agente', 'Nom du poste = le -Station saisi à l\'installation de l\'agent', 'Stationsname = das -Station bei der Agent-Installation', 'Имя станции = -Station при установке агента', 'Tên trạm = -Station khi cài agent in', 'ชื่อสถานี = -Station ที่ใส่ตอนติดตั้งเอเจนต์'],
  ['还没有打印电脑报上来:请确认那台电脑的打印代理在运行(每 4 秒会自己拉一次任务)', 'No print computer has checked in yet: make sure the print agent is running on that computer (it fetches jobs every 4 seconds)', 'まだ印刷パソコンが応答していません。そのパソコンで印刷エージェントが動作しているか確認してください(4 秒ごとに取得します)', '아직 인쇄 PC가 응답하지 않았습니다. 해당 PC에서 인쇄 에이전트가 실행 중인지 확인하세요(4초마다 가져옵니다)', 'Ningún equipo de impresión se ha conectado aún: compruebe que el agente se está ejecutando (consulta cada 4 s)', 'Aucun poste ne s\'est encore signalé : vérifiez que l\'agent tourne (interrogation toutes les 4 s)', 'Noch kein Druckrechner gemeldet: läuft der Druckagent dort? (holt alle 4 s)', 'Ни один компьютер ещё не откликнулся: проверьте, запущен ли агент печати (опрос каждые 4 с)', 'Chưa có máy in nào báo về: kiểm tra agent in có đang chạy (lấy lệnh mỗi 4 giây)', 'ยังไม่มีเครื่องพิมพ์รายงานเข้ามา ตรวจสอบว่าเอเจนต์พิมพ์ทำงานอยู่ (ดึงงานทุก 4 วินาที)'],
  ['开关打开了,但一个打印类型都没勾 —— 这台电脑不会收到任何打印任务', 'The switch is on but no print type is ticked — this computer will receive no print jobs', 'スイッチは入っていますが印刷種別が未チェックです。このパソコンには印刷ジョブが届きません', '스위치는 켜져 있지만 인쇄 유형이 없습니다. 이 PC는 인쇄 작업을 받지 않습니다', 'El interruptor está activo pero no hay tipos marcados: este equipo no recibirá trabajos', 'L\'interrupteur est actif mais aucun type n\'est coché : ce poste ne recevra rien', 'Der Schalter ist an, aber keine Druckart angekreuzt — dieser Rechner erhält keine Aufträge', 'Выключатель включён, но виды печати не отмечены — этот компьютер не получит заданий', 'Đã bật công tắc nhưng chưa chọn loại in — máy này sẽ không nhận lệnh in', 'เปิดสวิตช์แล้วแต่ยังไม่ได้เลือกประเภทการพิมพ์ เครื่องนี้จะไม่ได้รับงานพิมพ์'],
  ['本机打印代理', 'Local print agent', 'ローカル印刷エージェント', '로컬 인쇄 에이전트', 'Agente de impresión local', 'Agent d\'impression local', 'Lokaler Druckagent', 'Локальный агент печати', 'Agent in cục bộ', 'เอเจนต์พิมพ์ในเครื่อง'],
  ['代理自己每 4 秒拉任务,不需要一直开着本页', 'The agent fetches jobs every 4 seconds; this page need not stay open', 'エージェントが 4 秒ごとに取得します。この画面を開き続ける必要はありません', '에이전트가 4초마다 가져갑니다. 이 화면을 계속 열 필요는 없습니다', 'El agente recoge trabajos cada 4 s; esta página no necesita estar abierta', 'L\'agent récupère les travaux toutes les 4 s ; inutile de garder cette page ouverte', 'Der Agent holt Aufträge alle 4 s; diese Seite muss nicht offen bleiben', 'Агент забирает задания каждые 4 с; страницу держать открытой не нужно', 'Agent tự lấy lệnh mỗi 4 giây; không cần mở trang này', 'เอเจนต์ดึงงานเองทุก 4 วินาที ไม่ต้องเปิดหน้านี้ค้างไว้'],
  ['没有代理时,手机端会退回自己弹打印(需要人点一次对话框)。', 'Without the agent, the mobile side falls back to its own print dialog (needs one tap).', 'エージェントが無い場合、スマホ側の印刷ダイアログに戻ります(1 回タップが必要)。', '에이전트가 없으면 모바일에서 인쇄 대화상자로 대체됩니다(한 번 눌러야 함).', 'Sin agente, el móvil usa su propio diálogo de impresión (hay que pulsar una vez).', 'Sans agent, le mobile revient à sa boîte d\'impression (un clic requis).', 'Ohne Agent fällt das Handy auf seinen Druckdialog zurück (ein Tipp nötig).', 'Без агента печать уходит в диалог браузера на телефоне (нужно нажать).', 'Không có agent, điện thoại sẽ mở hộp thoại in (cần bấm một lần).', 'หากไม่มีเอเจนต์ มือถือจะกลับไปใช้หน้าต่างพิมพ์เอง (ต้องกดหนึ่งครั้ง)'],
  ['没有启用的打印电脑', 'No print computer enabled', '有効な印刷パソコンがありません', '켜진 인쇄 PC 없음', 'Ningún equipo de impresión activado', 'Aucun poste d\'impression activé', 'Kein Druckrechner aktiviert', 'Нет включённых компьютеров печати', 'Chưa bật máy in nào', 'ยังไม่มีเครื่องพิมพ์ที่เปิดใช้'],
  ['已开启这台电脑的自动打印', 'Auto print enabled for this computer', 'このパソコンの自動印刷を有効にしました', '이 PC의 자동 인쇄를 켰습니다', 'Impresión automática activada para este equipo', 'Impression auto activée pour ce poste', 'Automatischer Druck für diesen Rechner aktiviert', 'Автопечать включена для этого компьютера', 'Đã bật in tự động cho máy này', 'เปิดพิมพ์อัตโนมัติให้เครื่องนี้แล้ว'],
  ['已关闭这台电脑的自动打印', 'Auto print disabled for this computer', 'このパソコンの自動印刷を無効にしました', '이 PC의 자동 인쇄를 껐습니다', 'Impresión automática desactivada para este equipo', 'Impression auto désactivée pour ce poste', 'Automatischer Druck für diesen Rechner deaktiviert', 'Автопечать выключена для этого компьютера', 'Đã tắt in tự động cho máy này', 'ปิดพิมพ์อัตโนมัติของเครื่องนี้แล้ว'],

  // ── 2026-11-05 第三轮:认机信息(心跳/IP)、离线含义、新增打印电脑 ──
  ['这台电脑还没有连过:代理没装或没启动', 'This computer has never checked in: agent not installed or not running', 'このパソコンはまだ接続していません。エージェント未導入か未起動', '이 PC는 아직 연결된 적이 없습니다. 에이전트 미설치/미실행', 'Este equipo nunca se ha conectado: agente no instalado o detenido', 'Ce poste ne s\'est jamais signalé : agent absent ou arrêté', 'Dieser Rechner hat sich nie gemeldet: Agent fehlt oder läuft nicht', 'Этот компьютер ещё не подключался: агент не установлен или не запущен', 'Máy này chưa từng kết nối: chưa cài hoặc chưa chạy agent', 'เครื่องนี้ยังไม่เคยเชื่อมต่อ: ยังไม่ติดตั้งหรือไม่ได้เปิดเอเจนต์'],
  ['来源 IP', 'Source IP', '接続元 IP', '연결 IP', 'IP de origen', 'IP source', 'Quell-IP', 'IP источника', 'IP nguồn', 'IP ต้นทาง'],
  ['离线 = 90 秒内没收到那台电脑的心跳(电脑关机 / 打印代理没运行 / 代理不是带 -Server 启动的);离线时不派单,手机端会退回自己弹打印', 'Offline = no heartbeat from that computer within 90 s (machine off / agent not running / agent not started with -Server). Offline stations get no jobs; the phone falls back to its own print dialog', 'オフライン = 90 秒間そのパソコンから心跳が無い(電源OFF/エージェント停止/-Server 無しで起動)。オフラインには配信せず、スマホ側の印刷に戻ります', '오프라인 = 90초간 해당 PC의 하트비트 없음(전원 꺼짐/에이전트 미실행/-Server 없이 시작). 오프라인에는 배송하지 않고 모바일이 자체 인쇄로 대체합니다', 'Sin conexión = sin latido de ese equipo en 90 s (apagado / agente parado / agente sin -Server). No recibe trabajos; el móvil usa su propio diálogo', 'Hors ligne = aucun battement de ce poste en 90 s (éteint / agent arrêté / agent sans -Server). Aucun travail envoyé ; le mobile imprime lui-même', 'Offline = 90 s kein Heartbeat (Rechner aus / Agent gestoppt / Agent ohne -Server). Offline bekommt keine Aufträge; das Handy druckt selbst', 'Не в сети = 90 с без сигнала (выключен / агент не запущен / запущен без -Server). В офлайне задания не отправляются, телефон печатает сам', 'Ngoại tuyến = 90 giây không có tín hiệu (máy tắt / agent không chạy / agent không có -Server). Ngoại tuyến không nhận lệnh, điện thoại tự in', 'ออฟไลน์ = ไม่มีสัญญาณ 90 วินาที (ปิดเครื่อง / เอเจนต์ไม่ทำงาน / ไม่ได้รันด้วย -Server) จะไม่ส่งงาน มือถือจะพิมพ์เอง'],
  ['新增打印电脑', 'Add print computer', '印刷パソコンを追加', '인쇄 PC 추가', 'Añadir equipo de impresión', 'Ajouter un poste d\'impression', 'Druckrechner hinzufügen', 'Добавить компьютер печати', 'Thêm máy in', 'เพิ่มเครื่องพิมพ์'],
  ['填那台电脑的站点名(默认就是计算机名)', 'Enter that computer\'s station name (defaults to its computer name)', 'そのパソコンのステーション名(既定はコンピューター名)', '그 PC의 스테이션 이름(기본값은 컴퓨터 이름)', 'Escriba el nombre de puesto de ese equipo (por defecto el nombre del equipo)', 'Saisissez le nom de poste (par défaut le nom de l\'ordinateur)', 'Stationsname des Rechners (Standard: Computername)', 'Имя станции того компьютера (по умолчанию — имя компьютера)', 'Nhập tên trạm của máy đó (mặc định là tên máy tính)', 'ใส่ชื่อสถานีของเครื่องนั้น (ค่าเริ่มต้นคือชื่อคอมพิวเตอร์)'],
  ['在那台电脑上双击「安装.bat」装打印代理,「这台打印机的名字」填成同一个名字(回车 = 计算机名);代理连上后这一行会自动变成在线,再打开开关、勾上要打的报表。', 'Install the print agent on that computer with "安装.bat" and give it the same name (Enter = computer name). Once it connects, this row turns online — then switch it on and tick the reports.', 'そのパソコンで「安装.bat」を実行し、同じ名前を入力(Enter = コンピューター名)。接続するとこの行がオンラインになり、開關と帳票を選択できます。', '그 PC에서 "安装.bat"로 에이전트를 설치하고 같은 이름을 입력하세요(Enter = 컴퓨터 이름). 연결되면 이 행이 온라인이 되고, 스위치와 보고서를 선택하면 됩니다.', 'Instale el agente con «安装.bat» en ese equipo con el mismo nombre (Enter = nombre del equipo). Al conectar, la fila pasa a en línea; luego active y marque los informes.', 'Installez l\'agent sur ce poste avec « 安装.bat » et le même nom (Entrée = nom de l\'ordinateur). Une fois connecté, la ligne passe en ligne ; activez et cochez les états.', 'Dort den Agenten mit „安装.bat" installieren und denselben Namen vergeben (Enter = Computername). Nach der Verbindung wird die Zeile online; dann einschalten und Berichte ankreuzen.', 'Установите агента на том компьютере через «安装.bat» с тем же именем (Enter = имя компьютера). После подключения строка станет онлайн — включите и отметьте отчёты.', 'Cài agent trên máy đó bằng «安装.bat» với cùng tên (Enter = tên máy). Khi kết nối, dòng này sẽ online; bật công tắc và chọn báo biểu.', 'ติดตั้งเอเจนต์บนเครื่องนั้นด้วย «安装.bat» และใส่ชื่อเดียวกัน (Enter = ชื่อคอมพิวเตอร์) เมื่อเชื่อมต่อแล้วแถวนี้จะเป็นออนไลน์ จากนั้นเปิดสวิตช์และเลือกแบบฟอร์ม'],
  ['请先填站点名', 'Enter a station name first', '先にステーション名を入力してください', '먼저 스테이션 이름을 입력하세요', 'Escriba primero el nombre del puesto', 'Saisissez d\'abord un nom de poste', 'Bitte zuerst den Stationsnamen eingeben', 'Сначала введите имя станции', 'Vui lòng nhập tên trạm trước', 'กรุณาใส่ชื่อสถานีก่อน'],
  ['已经有同名电脑了', 'A computer with this name already exists', '同名のパソコンが既にあります', '같은 이름의 PC가 이미 있습니다', 'Ya existe un equipo con ese nombre', 'Un poste de ce nom existe déjà', 'Ein Rechner mit diesem Namen existiert bereits', 'Компьютер с таким именем уже есть', 'Đã có máy trùng tên', 'มีเครื่องชื่อนี้อยู่แล้ว'],
  ['已登记:等那台电脑的打印代理连上来就会显示在线', 'Registered: it turns online once that computer\'s print agent connects', '登録しました。そのパソコンのエージェントが接続するとオンラインになります', '등록했습니다. 해당 PC의 에이전트가 연결되면 온라인이 됩니다', 'Registrado: pasará a en línea cuando se conecte el agente de ese equipo', 'Enregistré : la ligne passera en ligne dès que l\'agent se connectera', 'Registriert: wird online, sobald der Agent dort verbindet', 'Зарегистрировано: станет онлайн, когда агент подключится', 'Đã đăng ký: sẽ online khi agent của máy đó kết nối', 'ลงทะเบียนแล้ว จะเป็นออนไลน์เมื่อเอเจนต์ของเครื่องนั้นเชื่อมต่อ'],

  // ── 2026-11-05 第四轮:按电脑设「纸张」(只换纸不缩放)──
  ['纸张', 'Paper', '用紙', '용지', 'Papel', 'Papier', 'Papier', 'Бумага', 'Khổ giấy', 'กระดาษ'],
  ['A5 · 中一刀 210×148.5 横', 'A5 · half-cut 210×148.5 landscape', 'A5 · 中一刀 210×148.5 横', 'A5 · 중도절단 210×148.5 가로', 'A5 · medio corte 210×148.5 horizontal', 'A5 · demi-coupe 210×148.5 paysage', 'A5 · halber Schnitt 210×148.5 quer', 'A5 · половинный рез 210×148.5 альбомная', 'A5 · cắt đôi 210×148.5 ngang', 'A5 · ครึ่งแผ่น 210×148.5 แนวนอน'],
  ['A4 横 297×210(内容大小不变)', 'A4 landscape 297×210 (content size unchanged)', 'A4 横 297×210(内容サイズは変わらない)', 'A4 가로 297×210(내용 크기 동일)', 'A4 horizontal 297×210 (tamaño del contenido sin cambios)', 'A4 paysage 297×210 (taille du contenu inchangée)', 'A4 quer 297×210 (Inhalt unverändert)', 'A4 альбомная 297×210 (размер содержимого не меняется)', 'A4 ngang 297×210 (kích thước nội dung giữ nguyên)', 'A4 แนวนอน 297×210 (ขนาดเนื้อหาเท่าเดิม)'],
  ['纸张已改为', 'Paper changed to', '用紙を変更:', '용지를 변경:', 'Papel cambiado a', 'Papier changé en', 'Papier geändert auf', 'Бумага изменена на', 'Đã đổi khổ giấy sang', 'เปลี่ยนกระดาษเป็น'],
  ['(内容大小不变)', '(content size unchanged)', '(内容サイズは変わらない)', '(내용 크기 동일)', '(tamaño del contenido sin cambios)', '(taille du contenu inchangée)', '(Inhalt unverändert)', '(размер содержимого не меняется)', '(kích thước nội dung giữ nguyên)', '(ขนาดเนื้อหาเท่าเดิม)'],
]

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

// ── --audit:PrintStation.vue 里出现但 en.js 没有的 tt() 文案 ──
if (AUDIT) {
  const src = readFileSync(vueFile, 'utf8')
  const en = readFileSync(resolve(locDir, 'en.js'), 'utf8')
  // 模板里的 `tt('如 D:\\MES-PDF')` 是 JS 表达式,运行时键是单个反斜杠 ⇒ 审计前先还原
  const unesc = (s) => s.replace(/\\\\/g, '\\').replace(/\\'/g, "'")
  const uniq = new Set()
  for (const m of src.matchAll(/tt\('([^']*)'\)/g)) uniq.add(unesc(m[1]))
  const miss = [...uniq].filter((k) => !en.includes(`'${esc(k)}':`))
  console.log(`tt() 文案 ${uniq.size} 条,缺译名 ${miss.length} 条`)
  miss.forEach((k) => console.log('  缺: ' + k))
  process.exit(0)
}

let totalAdded = 0
for (const [loc, idx] of Object.entries(LOCALES)) {
  const file = resolve(locDir, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const missing = ROWS.filter((r) => !src.includes(`'${esc(r[0])}':`))
  if (!missing.length) {
    console.log(`[SKIP] ${loc}: 无缺失`)
    continue
  }
  if (!WRITE) {
    console.log(`[DRY]  ${loc}: 缺 ${missing.length} 条(例:${missing.slice(0, 3).map((m) => m[0]).join('、')})`)
    continue
  }
  const lines = missing
    .map((r) => (r[idx] == null || r[idx] === '' ? null : `    '${esc(r[0])}': '${esc(r[idx])}',`))
    .filter(Boolean)
  if (!lines.length) { console.log(`[SKIP] ${loc}: 无可插入行`); continue }
  // 插到 biz 对象末尾(该文件 biz 在文件末尾,收尾是最后一个 "\n  }")
  const lastClose = src.lastIndexOf('\n  }')
  if (lastClose < 0) { console.error(`[FAIL] ${loc}: 找不到 biz 收尾,跳过`); continue }
  writeFileSync(file, src.slice(0, lastClose) + '\n' + lines.join('\n') + src.slice(lastClose), 'utf8')
  totalAdded += lines.length
  console.log(`[OK]   ${loc}: +${lines.length} 条`)
}
if (WRITE) console.log(`\n合计新增 ${totalAdded} 条`)
