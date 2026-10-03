/**
 * _i18n-tcin-twolevel.cjs — 特采单(QC_TC_IN)两级审批 词条补录(2026-10-04)
 *
 * 需求:特采单改两级审批 —— 编制=提交审批的人、审核=一级审批通过的人、批准=超级管理员;
 * 对应新增 UI 文案(侧栏二级按钮)与 3 条消息模板(NOTICE 中心按中文模板作 key 渲染)。
 * 中文即 key(zh-CN.js 无需条目 —— tt 缺词条时回退原文);其余 10 语言包在 biz 段首插入。
 *
 * 用法:node tools/archive/_i18n-tcin-twolevel.cjs        (幂等:已存在的键不重复插)
 */
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEYS = [
  '批准通过',
  '批准驳回',
  '特采单待超级管理员批准',
  '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}',
  '特采单已批准',
  '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。',
  '二级审批被驳回',
  '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}',
]

const T = {
  en: {
    '批准通过': 'Approve',
    '批准驳回': 'Reject',
    '特采单待超级管理员批准': 'Special acceptance awaiting super-admin approval',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '"{panelName} {docNo}" passed first-level review by {actor}; awaiting your approval. Comment: {opinion}',
    '特采单已批准': 'Special acceptance approved',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      'The "{panelName} {docNo}" you reviewed at level 1 was approved by {actor}.',
    '二级审批被驳回': 'Second-level approval rejected',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      'The "{panelName} {docNo}" you reviewed at level 1 was rejected by {actor} and returned to draft. Comment: {opinion}',
  },
  'zh-TW': {
    '批准通过': '批准通過',
    '批准驳回': '批准駁回',
    '特采单待超级管理员批准': '特採單待超級管理員批准',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '「{panelName} {docNo}」已由 {actor} 一級審核通過，等待您批准。意見：{opinion}',
    '特采单已批准': '特採單已批准',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      '您一級審核通過的「{panelName} {docNo}」已由 {actor} 批准通過。',
    '二级审批被驳回': '二級審批被駁回',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      '您一級審核通過的「{panelName} {docNo}」被 {actor} 駁回，已退回草稿。意見：{opinion}',
  },
  ja: {
    '批准通过': '承認',
    '批准驳回': '却下',
    '特采单待超级管理员批准': '特採単：スーパー管理者の承認待ち',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '「{panelName} {docNo}」は {actor} の一次審査を通過しました。承認をお待ちしています。意見：{opinion}',
    '特采单已批准': '特採単が承認されました',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      '一次審査を通過した「{panelName} {docNo}」は {actor} により承認されました。',
    '二级审批被驳回': '二次承認が却下されました',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      '一次審査を通過した「{panelName} {docNo}」は {actor} により却下され、下書きに戻りました。意見：{opinion}',
  },
  ko: {
    '批准通过': '승인',
    '批准驳回': '반려',
    '特采单待超级管理员批准': '특채 단: 최고 관리자 승인 대기',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '「{panelName} {docNo}」은(는) {actor} 님의 1차 검토를 통과했습니다. 승인을 기다립니다. 의견: {opinion}',
    '特采单已批准': '특채 단이 승인되었습니다',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      '1차 검토를 통과한 「{panelName} {docNo}」이(가) {actor} 님에 의해 승인되었습니다.',
    '二级审批被驳回': '2차 승인이 반려되었습니다',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      '1차 검토를 통과한 「{panelName} {docNo}」이(가) {actor} 님에 의해 반려되어 초안으로 돌아갔습니다. 의견: {opinion}',
  },
  es: {
    '批准通过': 'Aprobar',
    '批准驳回': 'Rechazar',
    '特采单待超级管理员批准': 'Aceptación especial pendiente de aprobación del superadministrador',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '"{panelName} {docNo}" pasó la revisión de primer nivel por {actor}; pendiente de su aprobación. Comentario: {opinion}',
    '特采单已批准': 'Aceptación especial aprobada',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      'El "{panelName} {docNo}" que revisó en primer nivel fue aprobado por {actor}.',
    '二级审批被驳回': 'Aprobación de segundo nivel rechazada',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      'El "{panelName} {docNo}" que revisó en primer nivel fue rechazado por {actor} y devuelto a borrador. Comentario: {opinion}',
  },
  fr: {
    '批准通过': 'Approuver',
    '批准驳回': 'Rejeter',
    '特采单待超级管理员批准': "Acceptation spéciale en attente d'approbation du super-administrateur",
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '« {panelName} {docNo} » a passé la revue de premier niveau par {actor} ; en attente de votre approbation. Commentaire : {opinion}',
    '特采单已批准': 'Acceptation spéciale approuvée',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      'Le « {panelName} {docNo} » que vous avez validé au premier niveau a été approuvé par {actor}.',
    '二级审批被驳回': 'Approbation de deuxième niveau rejetée',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      'Le « {panelName} {docNo} » que vous avez validé au premier niveau a été rejeté par {actor} et renvoyé en brouillon. Commentaire : {opinion}',
  },
  de: {
    '批准通过': 'Genehmigen',
    '批准驳回': 'Ablehnen',
    '特采单待超级管理员批准': 'Sonderfreigabe wartet auf Genehmigung des Superadministrators',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '"{panelName} {docNo}" hat die Erstprüfung durch {actor} bestanden; wartet auf Ihre Genehmigung. Kommentar: {opinion}',
    '特采单已批准': 'Sonderfreigabe genehmigt',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      'Die von Ihnen erstgeprüfte "{panelName} {docNo}" wurde von {actor} genehmigt.',
    '二级审批被驳回': 'Genehmigung der zweiten Ebene abgelehnt',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      'Die von Ihnen erstgeprüfte "{panelName} {docNo}" wurde von {actor} abgelehnt und in den Entwurf zurückgegeben. Kommentar: {opinion}',
  },
  ru: {
    '批准通过': 'Утвердить',
    '批准驳回': 'Отклонить',
    '特采单待超级管理员批准': 'Специальное принятие ожидает утверждения супер-администратора',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '«{panelName} {docNo}» прошёл первичную проверку у {actor}; ожидает вашего утверждения. Комментарий: {opinion}',
    '特采单已批准': 'Специальное принятие утверждено',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      'Документ «{panelName} {docNo}», проверенный вами на первом уровне, утверждён {actor}.',
    '二级审批被驳回': 'Утверждение второго уровня отклонено',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      'Документ «{panelName} {docNo}», проверенный вами на первом уровне, отклонён {actor} и возвращён в черновик. Комментарий: {opinion}',
  },
  vi: {
    '批准通过': 'Phê duyệt',
    '批准驳回': 'Từ chối',
    '特采单待超级管理员批准': 'Phiếu chấp nhận đặc biệt chờ quản trị viên cấp cao phê duyệt',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '"{panelName} {docNo}" đã qua kiểm tra cấp một bởi {actor}; đang chờ bạn phê duyệt. Ý kiến: {opinion}',
    '特采单已批准': 'Phiếu chấp nhận đặc biệt đã được phê duyệt',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      '"{panelName} {docNo}" mà bạn kiểm tra cấp một đã được {actor} phê duyệt.',
    '二级审批被驳回': 'Phê duyệt cấp hai bị từ chối',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      '"{panelName} {docNo}" mà bạn kiểm tra cấp một đã bị {actor} từ chối và trả về bản nháp. Ý kiến: {opinion}',
  },
  th: {
    '批准通过': 'อนุมัติ',
    '批准驳回': 'ปฏิเสธ',
    '特采单待超级管理员批准': 'ใบรับรองพิเศษรอการอนุมัติจากผู้ดูแลระบบสูงสุด',
    '「{panelName} {docNo}」已由 {actor} 一级审核通过，等待您批准。意见：{opinion}':
      '"{panelName} {docNo}" ผ่านการตรวจสอบระดับหนึ่งโดย {actor} กำลังรอการอนุมัติจากคุณ ความคิดเห็น: {opinion}',
    '特采单已批准': 'ใบรับรองพิเศษได้รับอนุมัติแล้ว',
    '您一级审核通过的「{panelName} {docNo}」已由 {actor} 批准通过。':
      '"{panelName} {docNo}" ที่คุณตรวจสอบระดับหนึ่งได้รับการอนุมัติโดย {actor}',
    '二级审批被驳回': 'การอนุมัติระดับสองถูกปฏิเสธ',
    '您一级审核通过的「{panelName} {docNo}」被 {actor} 驳回，已退回草稿。意见：{opinion}':
      '"{panelName} {docNo}" ที่คุณตรวจสอบระดับหนึ่งถูก {actor} ปฏิเสธ และส่งกลับเป็นฉบับร่าง ความคิดเห็น: {opinion}',
  },
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
let changed = 0
for (const [loc, dict] of Object.entries(T)) {
  const file = path.join(DIR, `${loc}.js`)
  let txt = fs.readFileSync(file, 'utf8')
  const missing = KEYS.filter((k) => !txt.includes(`'${k}':`))
  if (!missing.length) { console.log(`${loc}.js: 已齐,跳过`); continue }
  const lines = missing.map((k) => `    '${esc(k)}': '${esc(dict[k])}',`)
  const block = [
    '    /* ── 特采单两级审批(2026-10-04):编制=提交审批的人 / 审核=一级审批通过的人 / 批准=超级管理员 ── */',
    ...lines,
    '',
  ].join('\n')
  // 插到 biz 段首(biz: { 行之后);中文即 key,zh-CN.js 无需条目
  const anchor = /(^ {2}biz: \{\n)/m
  if (!anchor.test(txt)) throw new Error(`${loc}.js 未找到 biz 段锚点`)
  txt = txt.replace(anchor, `$1${block}`)
  fs.writeFileSync(file, txt, 'utf8')
  console.log(`${loc}.js: 插入 ${missing.length} 条`)
  changed++
}
console.log(`完成:改动 ${changed} 个语言包`)
