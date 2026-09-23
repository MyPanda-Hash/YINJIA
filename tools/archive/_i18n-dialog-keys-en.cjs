/**
 * _i18n-dialog-keys-en.cjs — 为「弹窗族 tt 化」新增的词条补英文(手写,en.js)
 *
 * 只写 en.js:其余 9 个语言包由仓库既有链路 `tools/gen/gen-locales-gap.cjs`
 * 以 en.js 为基准机翻补齐(AGENTS.md:至少 en.js,机翻兜底其余)。
 * 幂等:已存在的键跳过。用法:node tools/archive/_i18n-dialog-keys-en.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const FILE = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales', 'en.js')

// 注意:含 \n 的键在源码里是**真实换行**(写在 tt('...\n...') 里),这里用 \n 表示真实换行,
// 写盘时会被转义成 \\n,与语言包既有写法一致。
const ROWS = [
  ['当前单据不可编辑，扫描结果将保存为一张新草稿。', 'This document is not editable; the scan result will be saved as a new draft.'],
  ['继续扫描', 'Continue scanning'],
  ['当前单据尚未保存，切换新增将丢弃修改，是否继续？', 'The current document is not saved; switching to New will discard the changes. Continue?'],
  ['单据：{no}（当前状态：{st}）', 'Document: {no} (current status: {st})'],
  ['人工审核确认', 'Manual review confirmation'],
  ['确认审核', 'Confirm review'],
  ['审核意见（选填）', 'Review comment (optional)'],
  ['仅已审核状态可弃审', 'Only audited documents can be un-audited'],
  ['确认弃审该单据？弃审后需重新审核。', 'Un-audit this document? It must be audited again afterwards.'],
  ['弃审确认', 'Un-audit confirmation'],
  ['{action}确认', '{action} confirmation'],
  ['确认{n}', 'Confirm {n}'],
  ['仅草稿状态可提交审批', 'Only draft documents can be submitted for approval'],
  ['仅审批中状态可审批通过', 'Only documents under approval can be approved'],
  ['审批意见（选填）', 'Approval comment (optional)'],
  ['提交说明（选填）', 'Submission note (optional)'],
  ['仅审批中状态可审批驳回', 'Only documents under approval can be rejected'],
  ['单据：{no}（当前状态：审批中）\n驳回必须填写审批意见', 'Document: {no} (current status: under approval)\nA rejection comment is required'],
  ['审批驳回确认', 'Approval rejection confirmation'],
  ['确认驳回', 'Confirm rejection'],
  ['驳回原因（必填）', 'Rejection reason (required)'],
  ['驳回必须填写审批意见', 'A rejection comment is required'],
  ['请先选择一行数据', 'Please select a row first'],
  ['确认删除整张单据 {no}？该操作不可恢复。', 'Delete the whole document {no}? This cannot be undone.'],
  ['删除单据确认', 'Delete document confirmation'],
  ['请先勾选要删除的行', 'Please tick the rows to delete first'],
  ['确认删除勾选的 {n} 行明细？', 'Delete the {n} selected detail row(s)?'],
  ['仅审批中或待二级审批状态可审批驳回', 'Only documents under approval or awaiting second-level approval can be rejected'],
  ['单据：{no}（当前状态：会签中）\n驳回必须填写意见', 'Document: {no} (current status: in countersign)\nA rejection comment is required'],
  ['会签驳回确认', 'Countersign rejection confirmation'],
  ['驳回意见（必填）', 'Rejection comment (required)'],
  ['会签驳回必须填写意见', 'A countersign rejection comment is required'],
  ['确认删除模板「{name}」？删除后不可恢复。', 'Delete template "{name}"? This cannot be undone.'],
]

// ⚠ 换行/回车必须转成 \n \r —— 否则真实换行会把单引号字符串截断,整个语言包语法坏掉
//   (2026-09-23 实测:含 \n 的键直接写盘 ⇒ en.js `Invalid or unexpected token`)
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/'/g, "\\'")
const lines = fs.readFileSync(FILE, 'utf8').split('\n')
const bizIdx = lines.findIndex((l) => /^\s*biz:\s*\{/.test(l))
if (bizIdx < 0) { console.error('en.js 找不到 biz 块'); process.exit(1) }

const missing = ROWS.filter(([k]) => !lines.some((l) => l.includes("'" + esc(k) + "':")))
if (!missing.length) { console.log('已齐,无需改动'); process.exit(0) }

lines.splice(bizIdx + 1, 0, ...missing.map(([k, v]) => "    '" + esc(k) + "': '" + esc(v) + "',"))
fs.writeFileSync(FILE, lines.join('\n'))
console.log('en.js 补 ' + missing.length + ' 条:');
for (const [k] of missing) console.log('  + ' + k.replace(/\n/g, '\\n').slice(0, 50));
