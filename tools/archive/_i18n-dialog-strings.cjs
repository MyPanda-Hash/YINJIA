/**
 * _i18n-dialog-strings.cjs — 把「弹窗族」的裸中文改成 tt()(2026-09-23)
 *
 * 范围:ElMessageBox 确认/提示/输入框的文案、标题、按钮、占位符、校验提示,
 *       以及同一操作流程里的 ElMessage 守卫提示(仅 PanelxForm / PanelxList 两处)。
 * 判定:字符串拼接式一律改**占位符键**(如 '单据：{no}（当前状态：{st}）'),否则换语言后语序必错。
 *
 * 用法:node tools/archive/_i18n-dialog-strings.cjs [--dry]
 * 安全:逐行按 trim 后全文匹配;每条必须命中(未命中即报错退出,不写盘);改完复扫弹窗族裸中文。
 */
const fs = require('node:fs')
const path = require('node:path')

const DRY = process.argv.includes('--dry')
const ROOT = path.join(__dirname, '..', '..')

// [文件, 原行(trim 后), 新行(trim 后)] —— 缩进由脚本保留
const PATCH = [
  // ---------- PanelxForm.vue ----------
  ['frontend/src/core/views/PanelxForm.vue',
    "'当前单据不可编辑，扫描结果将保存为一张新草稿。',",
    "tt('当前单据不可编辑，扫描结果将保存为一张新草稿。'),"],
  ['frontend/src/core/views/PanelxForm.vue',
    "'扫描填单',",
    "tt('扫描填单'),"],
  ['frontend/src/core/views/PanelxForm.vue',
    "{ confirmButtonText: '继续扫描', cancelButtonText: '取消', type: 'warning' },",
    "{ confirmButtonText: tt('继续扫描'), cancelButtonText: tt('取消'), type: 'warning' },"],
  ['frontend/src/core/views/PanelxForm.vue',
    "await ElMessageBox.confirm('当前单据尚未保存，切换新增将丢弃修改，是否继续？', '提示', { type: 'warning' })",
    "await ElMessageBox.confirm(tt('当前单据尚未保存，切换新增将丢弃修改，是否继续？'), tt('提示'), { type: 'warning' })"],
  ['frontend/src/core/views/PanelxForm.vue',
    "'单据：' + no + '（当前状态：' + status.value + '）',",
    "tt('单据：{no}（当前状态：{st}）').replace('{no}', no).replace('{st}', status.value),"],
  ['frontend/src/core/views/PanelxForm.vue',
    "'人工审核确认',",
    "tt('人工审核确认'),"],
  ['frontend/src/core/views/PanelxForm.vue',
    "{ confirmButtonText: '确认审核', cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: '审核意见（选填）' }",
    "{ confirmButtonText: tt('确认审核'), cancelButtonText: tt('取消'), inputType: 'textarea', inputPlaceholder: tt('审核意见（选填）') }"],
  ['frontend/src/core/views/PanelxForm.vue',
    "if (status.value !== '已审核') return ElMessage.warning('仅已审核状态可弃审')",
    "if (status.value !== '已审核') return ElMessage.warning(tt('仅已审核状态可弃审'))"],
  ['frontend/src/core/views/PanelxForm.vue',
    "await ElMessageBox.confirm('确认弃审该单据？弃审后需重新审核。', '弃审确认', { type: 'warning' })",
    "await ElMessageBox.confirm(tt('确认弃审该单据？弃审后需重新审核。'), tt('弃审确认'), { type: 'warning' })"],
  ['frontend/src/core/views/PanelxForm.vue',
    "if (status.value !== need) return ElMessage.warning(action === '提交审批' ? '仅草稿状态可提交审批' : '仅审批中状态可审批通过')",
    "if (status.value !== need) return ElMessage.warning(tt(action === '提交审批' ? '仅草稿状态可提交审批' : '仅审批中状态可审批通过'))"],
  ['frontend/src/core/views/PanelxForm.vue',
    "action + '确认',",
    "tt('{action}确认').replace('{action}', tt(action)),"],
  ['frontend/src/core/views/PanelxForm.vue',
    "{ confirmButtonText: '确认' + action, cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: action === '审批通过' ? '审批意见（选填）' : '提交说明（选填）' }",
    "{ confirmButtonText: tt('确认{n}').replace('{n}', tt(action)), cancelButtonText: tt('取消'), inputType: 'textarea', inputPlaceholder: tt(action === '审批通过' ? '审批意见（选填）' : '提交说明（选填）') }"],
  ['frontend/src/core/views/PanelxForm.vue',
    "if (status.value !== '审批中') return ElMessage.warning('仅审批中状态可审批驳回')",
    "if (status.value !== '审批中') return ElMessage.warning(tt('仅审批中状态可审批驳回'))"],
  ['frontend/src/core/views/PanelxForm.vue',
    "'单据：' + no + '（当前状态：审批中）\\n驳回必须填写审批意见',",
    "tt('单据：{no}（当前状态：审批中）\\n驳回必须填写审批意见').replace('{no}', no),"],
  ['frontend/src/core/views/PanelxForm.vue',
    "'审批驳回确认',",
    "tt('审批驳回确认'),"],
  ['frontend/src/core/views/PanelxForm.vue',
    "{ confirmButtonText: '确认驳回', cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: '驳回原因（必填）', inputValidator: (v) => (v && v.trim() ? true : '驳回必须填写审批意见') }",
    "{ confirmButtonText: tt('确认驳回'), cancelButtonText: tt('取消'), inputType: 'textarea', inputPlaceholder: tt('驳回原因（必填）'), inputValidator: (v) => (v && v.trim() ? true : tt('驳回必须填写审批意见')) }"],

  // ---------- PanelxList.vue ----------
  ['frontend/src/core/views/PanelxList.vue',
    "if (!current.value) return ElMessage.warning('请先选择一行数据')",
    "if (!current.value) return ElMessage.warning(tt('请先选择一行数据'))"],
  ['frontend/src/core/views/PanelxList.vue',
    "await ElMessageBox.confirm('确认删除整张单据 ' + no + '？该操作不可恢复。', '删除单据确认', { type: 'warning' })",
    "await ElMessageBox.confirm(tt('确认删除整张单据 {no}？该操作不可恢复。').replace('{no}', no), tt('删除单据确认'), { type: 'warning' })"],
  ['frontend/src/core/views/PanelxList.vue',
    "if (!delSel.value.length) return ElMessage.warning('请先勾选要删除的行')",
    "if (!delSel.value.length) return ElMessage.warning(tt('请先勾选要删除的行'))"],
  ['frontend/src/core/views/PanelxList.vue',
    "await ElMessageBox.confirm('确认删除勾选的 ' + delSel.value.length + ' 行明细？', '删除确认', { type: 'warning' })",
    "await ElMessageBox.confirm(tt('确认删除勾选的 {n} 行明细？').replace('{n}', delSel.value.length), tt('删除确认'), { type: 'warning' })"],
  ['frontend/src/core/views/PanelxList.vue',
    "'单据：' + no + '（当前状态：' + (current.value['单据状态'] || '') + '）',",
    "tt('单据：{no}（当前状态：{st}）').replace('{no}', no).replace('{st}', current.value['单据状态'] || ''),"],
  ['frontend/src/core/views/PanelxList.vue',
    "if (current.value['单据状态'] !== '已审核') return ElMessage.warning('仅已审核状态可弃审')",
    "if (current.value['单据状态'] !== '已审核') return ElMessage.warning(tt('仅已审核状态可弃审'))"],
  ['frontend/src/core/views/PanelxList.vue',
    "await ElMessageBox.confirm('确认弃审该单据？弃审后需重新审核。', '弃审确认', { type: 'warning' })",
    "await ElMessageBox.confirm(tt('确认弃审该单据？弃审后需重新审核。'), tt('弃审确认'), { type: 'warning' })"],
  ['frontend/src/core/views/PanelxList.vue',
    "if (!IN_APPROVAL.includes(current.value['单据状态'])) return ElMessage.warning('仅审批中或待二级审批状态可审批驳回')",
    "if (!IN_APPROVAL.includes(current.value['单据状态'])) return ElMessage.warning(tt('仅审批中或待二级审批状态可审批驳回'))"],
  ['frontend/src/core/views/PanelxList.vue',
    "'单据：' + no + '（当前状态：审批中）\\n驳回必须填写审批意见',",
    "tt('单据：{no}（当前状态：审批中）\\n驳回必须填写审批意见').replace('{no}', no),"],
  ['frontend/src/core/views/PanelxList.vue',
    "'审批驳回确认',",
    "tt('审批驳回确认'),"],
  ['frontend/src/core/views/PanelxList.vue',
    "{ confirmButtonText: '确认驳回', cancelButtonText: '取消', inputType: 'textarea', inputPlaceholder: '驳回原因（必填）', inputValidator: (v) => (v && v.trim() ? true : '驳回必须填写审批意见') }",
    "{ confirmButtonText: tt('确认驳回'), cancelButtonText: tt('取消'), inputType: 'textarea', inputPlaceholder: tt('驳回原因（必填）'), inputValidator: (v) => (v && v.trim() ? true : tt('驳回必须填写审批意见')) }"],
  ['frontend/src/core/views/PanelxList.vue',
    "'单据：' + no2 + '（当前状态：会签中）\\n驳回必须填写意见',",
    "tt('单据：{no}（当前状态：会签中）\\n驳回必须填写意见').replace('{no}', no2),"],
  ['frontend/src/core/views/PanelxList.vue',
    "'会签驳回确认',",
    "tt('会签驳回确认'),"],
  ['frontend/src/core/views/PanelxList.vue',
    "inputPlaceholder: '驳回意见（必填）', inputValidator: (v) => (v && v.trim() ? true : '会签驳回必须填写意见') }",
    "inputPlaceholder: tt('驳回意见（必填）'), inputValidator: (v) => (v && v.trim() ? true : tt('会签驳回必须填写意见')) }"],
  ['frontend/src/core/views/PanelxList.vue',
    "'单据：' + no2 + '（当前状态：' + (current.value['单据状态'] || '') + '）',",
    "tt('单据：{no}（当前状态：{st}）').replace('{no}', no2).replace('{st}', current.value['单据状态'] || ''),"],
  ['frontend/src/core/views/PanelxList.vue',
    "await ElMessageBox.confirm(`确认删除模板「${row.name}」？删除后不可恢复。`, tt('删除确认'), { type: 'warning' })",
    "await ElMessageBox.confirm(tt('确认删除模板「{name}」？删除后不可恢复。').replace('{name}', row.name), tt('删除确认'), { type: 'warning' })"],
]

// 按文件分组应用(逐行 trim 匹配)
const byFile = {}
for (const [f, from, to] of PATCH) (byFile[f] ||= []).push({ from, to })

const problems = []
let applied = 0
const results = new Map()

for (const [rel, items] of Object.entries(byFile)) {
  const abs = path.join(ROOT, rel)
  const lines = fs.readFileSync(abs, 'utf8').split('\n')
  for (const it of items) {
    const idxs = []
    lines.forEach((l, i) => { if (l.trim() === it.from) idxs.push(i) })
    if (!idxs.length) { problems.push(rel + ' 未命中: ' + it.from.slice(0, 60)); continue }
    for (const i of idxs) {
      const indent = lines[i].match(/^\s*/)[0]
      lines[i] = indent + it.to
      applied++
    }
  }
  results.set(rel, lines.join('\n'))
}

console.log('命中 ' + applied + ' 处 / 计划 ' + PATCH.length + ' 条')
if (problems.length) {
  console.log('未命中:')
  for (const p of problems) console.log('  ! ' + p)
  process.exit(1)
}
if (DRY) { console.log('dry-run,未写盘'); process.exit(0) }
for (const [rel, text] of results) fs.writeFileSync(path.join(ROOT, rel), text)
console.log('已写盘');
