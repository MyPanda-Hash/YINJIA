/**
 * docNoRoFallback.test.js —— 只读态编号格不能再印「假编号」
 *
 * 【用户原话 2026-10-28】「编号的占位背景提示词会让人误会是固定的一个编号在这边」
 *
 * 除了输入框 placeholder，还有一处更误导：**只读态**（无编辑权/已归档）编号格
 * 在值为空时直接印出 `YJ-PD-01` / `YJ-XS002` / `YJ-QR-88` 这类写死的模板号 ——
 * 那是一张还没发号的单，屏幕上却显示得像个真实编号。
 *
 * 【为什么要保留纸面原值的语义】`YJ-PD-01` 等是**设计纸面印的样板号**（7 张数据记录表
 * 的 B2/F2/K2/L2 原值，`recordSheetConfigs.docno.test.js` 逐张核过），
 * 打印空白模板时它本来就该印着；但**在线查看一张真实单据**时印假号会误导。
 * 所以：纸张打印/空白模板继续用 `cfg.docNoDefault`；electron 在线查看且拿不到号时
 * 显示占位说明（`—`），不再编造一个号。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const dataRec = readFileSync(new URL('./DataRecordSheet.vue', import.meta.url), 'utf8')
const progress = readFileSync(new URL('./ProgressControlSheet.vue', import.meta.url), 'utf8')
const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

test('RecordSheetPanels 只读态不再写死 YJ-PD-01 兜底', () => {
  assert.ok(!/head\[docNoKey\] \|\| cfg\.docNoDefault \|\| 'YJ-PD-01'/.test(panels),
    "写死 'YJ-PD-01' 会让没发号的单看起来有个真实编号")
  // 仍要保留 cfg.docNoDefault（设计纸面的样板号，打印空白模板用）
  assert.match(panels, /head\[docNoKey\] \|\| cfg\.docNoDefault/, 'cfg.docNoDefault 这条回退要保留')
})

test('DataRecordSheet 只读态不再写死 YJ-PD-01 兜底', () => {
  assert.ok(!/head\['文档编号'\] \|\| head\['单据编号'\] \|\| 'YJ-PD-01'/.test(dataRec),
    "写死 'YJ-PD-01' 同样会误导")
})

test('ProgressControlSheet 只读态不再写死 YJ-XS002 兜底', () => {
  assert.ok(!/head\['文档编号'\] \|\| 'YJ-XS002'/.test(progress),
    "写死 'YJ-XS002' 同样会误导")
})

test('DocSheet 只读态不再写死 YJ-XS002 兜底', () => {
  assert.ok(!/config\.docno \|\| 'YJ-XS002'/.test(docSheet),
    "写死 'YJ-XS002' 同样会误导")
})

test('空值改为破折号占位（看得懂是"还没发号"，不是编号）', () => {
  // 统一用 em dash + 提示词，避免"看起来像编号"
  assert.match(panels, /\|\| '—'/, 'RecordSheetPanels 空号显示 —')
  assert.match(dataRec, /\|\| '—'/, 'DataRecordSheet 空号显示 —')
  assert.match(progress, /\|\| '—'/, 'ProgressControlSheet 空号显示 —')
})
