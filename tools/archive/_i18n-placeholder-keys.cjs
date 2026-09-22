/**
 * _i18n-placeholder-keys.cjs — 手写「含占位符」的新词条(9 语言)
 *
 * 为什么不机翻:tools/gen/gen-locales-gap.cjs 明确排除含 {xxx} 的模板
 * (机翻会把占位符译坏,如 {actor}→{アクタ});这类键由人工维护。
 * 幂等:已存在跳过。用法:node tools/archive/_i18n-placeholder-keys.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales')
const L = ['zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']

// 键 + 按 L 顺序的 10 个译文(占位符原样保留)
const ROWS = [
  ['单据：{no}（当前状态：{st}）',
    '單據：{no}（當前狀態：{st}）', 'Document: {no} (current status: {st})', '伝票：{no}（現在のステータス：{st}）',
    '전표: {no} (현재 상태: {st})', 'Documento: {no} (estado actual: {st})', 'Document : {no} (statut actuel : {st})',
    'Beleg: {no} (aktueller Status: {st})', 'Документ: {no} (текущий статус: {st})', 'Chứng từ: {no} (trạng thái hiện tại: {st})',
    'เอกสาร: {no} (สถานะปัจจุบัน: {st})'],
  ['单据：{no}（当前状态：审批中）\n驳回必须填写审批意见',
    '單據：{no}（當前狀態：審批中）\n駁回必須填寫審批意見', 'Document: {no} (current status: under approval)\nA rejection comment is required',
    '伝票：{no}（現在のステータス：承認中）\n差戻しには承認コメントが必須です', '전표: {no} (현재 상태: 승인 중)\n반려 시 승인 의견을 반드시 입력해야 합니다',
    'Documento: {no} (estado actual: en aprobación)\nDebe indicar un comentario de rechazo', 'Document : {no} (statut actuel : en approbation)\nUn commentaire de rejet est obligatoire',
    'Beleg: {no} (aktueller Status: in Genehmigung)\nEin Ablehnungskommentar ist erforderlich', 'Документ: {no} (текущий статус: на утверждении)\nКомментарий к отклонению обязателен',
    'Chứng từ: {no} (trạng thái hiện tại: đang phê duyệt)\nBắt buộc nhập ý kiến từ chối', 'เอกสาร: {no} (สถานะปัจจุบัน: อยู่ระหว่างอนุมัติ)\nต้องระบุความเห็นที่ไม่อนุมัติ'],
  ['单据：{no}（当前状态：会签中）\n驳回必须填写意见',
    '單據：{no}（當前狀態：會簽中）\n駁回必須填寫意見', 'Document: {no} (current status: in countersign)\nA rejection comment is required',
    '伝票：{no}（現在のステータス：会署中）\n差戻しにはコメントが必須です', '전표: {no} (현재 상태: 회람 서명 중)\n반려 시 의견을 반드시 입력해야 합니다',
    'Documento: {no} (estado actual: en firma conjunta)\nDebe indicar un comentario de rechazo', 'Document : {no} (statut actuel : en cosignature)\nUn commentaire de rejet est obligatoire',
    'Beleg: {no} (aktueller Status: in Mitzeichnung)\nEin Ablehnungskommentar ist erforderlich', 'Документ: {no} (текущий статус: на визировании)\nКомментарий к отклонению обязателен',
    'Chứng từ: {no} (trạng thái hiện tại: đang ký nháy)\nBắt buộc nhập ý kiến từ chối', 'เอกสาร: {no} (สถานะปัจจุบัน: อยู่ระหว่างลงนามร่วม)\nต้องระบุความเห็นที่ไม่อนุมัติ'],
  ['确认{n}', '確認{n}', 'Confirm {n}', '{n}を確認', '{n} 확인', 'Confirmar {n}', 'Confirmer {n}', '{n} bestätigen', 'Подтвердить {n}', 'Xác nhận {n}', 'ยืนยัน {n}'],
  ['{action}确认', '{action}確認', '{action} confirmation', '{action}の確認', '{action} 확인', 'Confirmación de {action}', 'Confirmation de {action}', '{action} bestätigen', 'Подтверждение: {action}', 'Xác nhận {action}', 'ยืนยัน {action}'],
  ['确认删除整张单据 {no}？该操作不可恢复。',
    '確認刪除整張單據 {no}？該操作不可恢復。', 'Delete the whole document {no}? This cannot be undone.',
    '伝票 {no} を完全に削除しますか？この操作は元に戻せません。', '전표 {no} 전체를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    '¿Eliminar el documento completo {no}? Esta acción no se puede deshacer.', 'Supprimer tout le document {no} ? Cette action est irréversible.',
    'Beleg {no} vollständig löschen? Dies kann nicht rückgängig gemacht werden.', 'Удалить документ {no} целиком? Действие необратимо.',
    'Xóa toàn bộ chứng từ {no}? Thao tác này không thể hoàn tác.', 'ลบเอกสาร {no} ทั้งใบหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้'],
  ['确认删除勾选的 {n} 行明细？',
    '確認刪除勾選的 {n} 行明細？', 'Delete the {n} selected detail row(s)?',
    '選択した {n} 行の明細を削除しますか？', '선택한 {n}개 명세 행을 삭제하시겠습니까?',
    '¿Eliminar las {n} líneas de detalle seleccionadas?', 'Supprimer les {n} ligne(s) de détail sélectionnée(s) ?',
    'Die {n} ausgewählten Positionszeilen löschen?', 'Удалить выбранные строки ({n})?',
    'Xóa {n} dòng chi tiết đã chọn?', 'ลบรายการบรรทัด {n} ที่เลือกหรือไม่?'],
  ['确认删除模板「{name}」？删除后不可恢复。',
    '確認刪除模板「{name}」？刪除後不可恢復。', 'Delete template "{name}"? This cannot be undone.',
    'テンプレート「{name}」を削除しますか？削除後は復元できません。', '템플릿 "{name}"을(를) 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.',
    '¿Eliminar la plantilla "{name}"? No se puede deshacer.', 'Supprimer le modèle « {name} » ? Action irréversible.',
    'Vorlage „{name}“ löschen? Kann nicht rückgängig gemacht werden.', 'Удалить шаблон «{name}»? Действие необратимо.',
    'Xóa mẫu "{name}"? Không thể hoàn tác sau khi xóa.', 'ลบเทมเพลต "{name}" หรือไม่? ไม่สามารถกู้คืนได้'],
]

// ⚠ 换行必须转义成 \n(真实换行会截断单引号字符串 ⇒ 语言包语法坏掉)
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/'/g, "\\'")
const escKey = (s) => esc(s)
let total = 0

L.forEach((loc, ci) => {
  const file = path.join(DIR, loc + '.js')
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const bizIdx = lines.findIndex((l) => /^\s*biz:\s*\{/.test(l))
  if (bizIdx < 0) { console.log('  ⚠ ' + loc + ' 无 biz'); return }
  const missing = ROWS.filter((r) => !lines.some((l) => l.includes("'" + escKey(r[0]) + "':")))
  if (!missing.length) { console.log('  = ' + loc + ' 已齐'); return }
  lines.splice(bizIdx + 1, 0, ...missing.map((r) => "    '" + escKey(r[0]) + "': '" + esc(r[ci + 1]) + "',"))
  fs.writeFileSync(file, lines.join('\n'))
  total += missing.length
  console.log('  + ' + loc + ' 补 ' + missing.length + ' 条')
})
console.log('\n共写入 ' + total + ' 条')
