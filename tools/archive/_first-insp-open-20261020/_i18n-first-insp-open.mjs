import fs from 'node:fs'

/**
 * _i18n-first-insp-open.mjs — 「首件检验单直接关联生产工单(不再卡成型报工)」这批显示层词条,
 * 一次写进 10 个语言包(2026-10-20)。
 *
 * 用户口径:
 *   「当前是被流程卡死,不完成成型报工就不能产生当前的首件检验单,当前直接实现对这个,
 *    首件检验单需要关联当前的生产工单即可,不需要实现成型报工完成流程才产生。就是当前检验单能选取
 *    工单,未完工的工单就可以选取,但是已经完成的就不需要能被选取,已经被当前的检验单选取的
 *    也不能被再次选取。」
 *
 * 做两件事(幂等):
 *   ① **替换**首件模式那句旧提示 —— 旧话说「已建单的行会标出来，重复选择不会重复建单」,
 *      现在这类行**根本不会列出来**,原话会误导现场 ⇒ 旧键连同译文整行换掉,不留死词条;
 *   ② **新增**首件模式的门槛提示(制程模式那句「只列已排产（成型已排）…」原样保留)。
 */
const TIP_OLD = '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。'
const TIP_NEW = '选择一条未完工的生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）。'
const HINT_NEW = '只列未完工的工单行；已完工、已结案或已有首件检验单的工单行不再列出。'
/** 新增提示的插入锚点(制程模式那句门槛提示 —— 两个 mode 的提示挨着放) */
const ANCHOR = '    "只列已排产（成型已排）的工单行；成型未报工的行会置灰并写明原因。":'

const BLOCKS = {
  'zh-TW': {
    tip: '選擇一條未完工的生產工單行（工單號 + 工單行號唯一確定）生成首件檢驗單草稿（明細按成型工藝清單預鋪）。',
    hint: '只列未完工的工單行；已完工、已結案或已有首件檢驗單的工單行不再列出。',
    done: '完工狀態',
    idle: '未開工',
  },
  en: {
    tip: 'Pick an unfinished production work-order line (work order no. + line no. uniquely identify it) to create a first-article inspection draft (details pre-filled from the molding process sheet).',
    hint: 'Only unfinished work-order lines are listed; lines that are finished, closed, or already have a first-article inspection sheet are no longer shown.',
    done: 'Completion status',
    idle: 'Not started',
  },
  ja: {
    tip: '未完了の生産指示行（指示書番号＋行番号で一意）を選択すると初品検査表の下書きを作成します（明細は成形工程票から展開）。',
    hint: '未完了の生産指示行のみ表示します。完了済み・クローズ済み・既に初品検査表がある行は表示されません。',
    done: '完了状態',
    idle: '未開始',
  },
  ko: {
    tip: '미완료 생산 작업지시 행(작업지시 번호 + 행 번호로 유일)을 선택하면 초품 검사표 초안이 생성됩니다(명세는 성형 공정표에서 미리 채움).',
    hint: '미완료 작업지시 행만 표시합니다. 완료·종결되었거나 이미 초품 검사표가 있는 행은 표시되지 않습니다.',
    done: '완료 상태',
    idle: '미착수',
  },
  es: {
    tip: 'Seleccione una línea de orden de producción sin terminar (n.º de orden + n.º de línea la identifican) para crear un borrador de informe de inspección de primera pieza (detalles precargados desde la hoja de proceso de moldeo).',
    hint: 'Solo se muestran líneas de orden sin terminar; las líneas terminadas, cerradas o que ya tienen un informe de inspección de primera pieza no se muestran.',
    done: 'Estado de finalización',
    idle: 'Sin iniciar',
  },
  fr: {
    tip: "Sélectionnez une ligne d'ordre de fabrication non terminée (n° d'ordre + n° de ligne l'identifient) pour créer un brouillon de fiche de contrôle de première pièce (détails préremplis depuis la fiche de process de moulage).",
    hint: "Seules les lignes d'ordre non terminées sont affichées ; les lignes terminées, clôturées ou ayant déjà une fiche de contrôle de première pièce ne sont plus listées.",
    done: "État d'achèvement",
    idle: 'Non démarré',
  },
  de: {
    tip: 'Wählen Sie eine nicht abgeschlossene Fertigungsauftragszeile (Auftrags-Nr. + Zeilen-Nr. identifizieren sie), um einen Entwurf des Erstmusterprüfberichts zu erstellen (Details aus dem Formprozessblatt vorbelegt).',
    hint: 'Es werden nur nicht abgeschlossene Auftragszeilen angezeigt; abgeschlossene, geschlossene oder bereits mit einem Erstmusterprüfbericht versehene Zeilen erscheinen nicht mehr.',
    done: 'Fertigstellungsstatus',
    idle: 'Nicht begonnen',
  },
  ru: {
    tip: 'Выберите незавершённую строку производственного заказа (номер заказа + номер строки однозначно её определяют), чтобы создать черновик листа контроля первой детали (детали предзаполнены из технологической карты формования).',
    hint: 'Показываются только незавершённые строки заказов; завершённые, закрытые строки и строки, по которым уже есть лист контроля первой детали, не отображаются.',
    done: 'Статус завершения',
    idle: 'Не начато',
  },
  vi: {
    tip: 'Chọn một dòng lệnh sản xuất chưa hoàn thành (số lệnh + số dòng xác định duy nhất) để tạo bản nháp phiếu kiểm tra chế phẩm đầu tiên (chi tiết được điền sẵn từ phiếu công nghệ đúc).',
    hint: 'Chỉ hiển thị các dòng lệnh sản xuất chưa hoàn thành; các dòng đã hoàn thành, đã kết thúc hoặc đã có phiếu kiểm tra chế phẩm đầu tiên sẽ không còn hiển thị.',
    done: 'Trạng thái hoàn thành',
    idle: 'Chưa bắt đầu',
  },
  th: {
    tip: 'เลือกหนึ่งบรรทัดใบสั่งผลิตที่ยังไม่เสร็จ (เลขที่ใบสั่ง + ลำดับบรรทัดระบุได้ไม่ซ้ำ) เพื่อสร้างฉบับร่างใบตรวจสอบชิ้นแรก (รายละเอียดเติมล่วงหน้าจากใบกระบวนการขึ้นรูป)',
    hint: 'แสดงเฉพาะบรรทัดใบสั่งผลิตที่ยังไม่เสร็จ; บรรทัดที่เสร็จแล้ว ปิดงานแล้ว หรือมีใบตรวจสอบชิ้นแรกอยู่แล้วจะไม่แสดง',
    done: 'สถานะการเสร็จสิ้น',
    idle: 'ยังไม่เริ่ม',
  },
}

let files = 0
let replaced = 0
let added = 0
for (const [loc, block] of Object.entries(BLOCKS)) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  const oldKey = JSON.stringify(TIP_OLD)
  const oldVal = s.includes(oldKey)
  if (oldVal) {
    // ① 整行替换(键与译文一起换,不留旧词条)
    const lines = s.split('\n')
    const idx = lines.findIndex((l) => l.includes(oldKey))
    if (idx >= 0) {
      lines[idx] = `    ${JSON.stringify(TIP_NEW)}: ${JSON.stringify(block.tip)},`
      s = lines.join('\n')
      replaced++
    }
  } else if (!s.includes(JSON.stringify(TIP_NEW))) {
    console.log(`SKIP ${loc}: 旧提示缺失`)
    continue
  }
  // ② 新增门槛提示(锚点 = 制程模式那句;已有则跳过)
  if (!s.includes(JSON.stringify(HINT_NEW))) {
    const i = s.indexOf(ANCHOR)
    if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
    const line = `    ${JSON.stringify(HINT_NEW)}: ${JSON.stringify(block.hint)},\n`
    s = s.slice(0, i) + line + s.slice(i)
    added++
  }
  // ③ 本次新出现的两个显示词(完工状态列头 / 空值兜底「未开工」)—— 缺才补
  const extra = [['完工状态', block.done], ['未开工', block.idle]]
  for (const [k, v] of extra) {
    if (s.includes(JSON.stringify(k) + ':')) continue
    const i = s.indexOf(ANCHOR)
    if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失(词条 ${k})`); continue }
    s = s.slice(0, i) + `    ${JSON.stringify(k)}: ${JSON.stringify(v)},\n` + s.slice(i)
    added++
  }
  fs.writeFileSync(p, s, 'utf8')
  files++
  console.log(`OK   ${loc}: 替换提示=${oldVal ? 'Y' : 'N'} / 新增门槛提示=Y`)
}
console.log(`\n共 ${files} 个语言包;整行替换 ${replaced} 条、新增 ${added} 条`)
