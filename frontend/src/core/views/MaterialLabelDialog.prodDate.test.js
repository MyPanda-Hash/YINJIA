import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * MaterialLabelDialog.prodDate.test.js — 钉住「打印材料码」弹窗的**生产日期**链路(2026-10-23)
 *
 * 用户原话:「采购订单的打印材料码界面需要在批次号后面加个生产日期,进行填写,
 *            填写后可以打印的材料码会加上生产日期」。
 *
 * 这条需求的链路有 4 个环节,任何一环丢掉都会表现为「填了但纸上看不见」:
 *   ① 界面:批次号 chip **后面**紧跟一个日期框(值格式 YYYY-MM-DD 字符串,不是 Date 对象);
 *   ② 提交:confirm() 把 prodDate 一起发给接口(puLabelPrint 的 body);
 *   ③ 出纸:cardsOf() 把**服务端回读**的 `生产日期` 灌进卡面字段(不取输入框值);
 *   ④ 重打:同一条 cardsOf 路径 ⇒ 重打也带日期。
 *
 * 本测按源码钉住这 4 处(与 recordSheetConfigs.*.test.js 同款做法:读源码断言,不起浏览器)。
 */
const src = readFileSync(new URL('./MaterialLabelDialog.vue', import.meta.url), 'utf8')

/** 取模板里批次号 chip 到生产日期 chip 的片段(用来断言"在批次号后面") */
const barIdx = src.indexOf('<div class="mlq-bar">')
const onelineIdx = src.indexOf('<div class="mlq-oneline">')
const barBlock = src.slice(barIdx, onelineIdx)

/** 取 script 里 cardsOf 函数体 */
const cardsOfStart = src.indexOf('function cardsOf(')
const cardsOfBody = src.slice(cardsOfStart, src.indexOf('\n}', cardsOfStart) + 2)

test('① 界面:日期框在批次号 chip 之后(同一条 mlq-bar 里,顺序在后)', () => {
  assert.ok(barIdx > 0, '应找到 .mlq-bar')
  const batchAt = barBlock.indexOf('mlq-batch-inp')
  const dateAt = barBlock.indexOf('mlq-prod-inp')
  assert.ok(batchAt > 0, '批次号输入框应在 mlq-bar 里')
  assert.ok(dateAt > 0, '生产日期日期框(.mlq-prod-inp)应在 mlq-bar 里')
  assert.ok(dateAt > batchAt, '生产日期必须在批次号**之后**出现(用户口径:批次号后面加)')
  assert.ok(barBlock.includes("tt('生产日期')"), '日期框标签走 tt(多语言)')
  assert.ok(/value-format="YYYY-MM-DD"/.test(barBlock), '日期值必须是 YYYY-MM-DD 字符串(与后端 parseDate 同口径)')
})

test('① 界面:占位词走 tt(禁止裸写中文)', () => {
  assert.ok(/mlq-prod-inp[\s\S]{0,400}:placeholder="tt\('选择日期'\)"/.test(barBlock),
    '日期框 placeholder 必须是 tt(\'选择日期\')')
})

test('② 提交:confirm 把 prodDate 一起发给 puLabelPrint', () => {
  const confirmIdx = src.indexOf('async function confirm()')
  const confirmBody = src.slice(confirmIdx, src.indexOf('\n}', src.indexOf('await load()', confirmIdx)) + 2)
  assert.ok(/prodDate:\s*String\(prodDate\.value/.test(confirmBody),
    'confirm 的 body 必须带 prodDate(= 日期框当前值)')
  assert.ok(confirmBody.includes('puLabelPrint({'), '仍走 engine.puLabelPrint')
})

test('③ 出纸:cardsOf 用**服务端回读**的 生产日期,不读取输入框', () => {
  assert.ok(cardsOfStart > 0, '应找到 cardsOf')
  assert.ok(/res\['生产日期'\]/.test(cardsOfBody), 'date 取自 res[\'生产日期\'](先落库再出纸)')
  assert.ok(/生产日期:\s*date/.test(cardsOfBody), '卡面字段 生产日期 填 date')
  assert.ok(!/prodDate\.value/.test(cardsOfBody), 'cardsOf 不得直接读输入框(纸上的日期必须是库里那个)')
})

test('④ 重打与打印共用 cardsOf(重打也带生产日期)', () => {
  const reprintIdx = src.indexOf('async function doReprint(')
  const reprintBody = src.slice(reprintIdx, src.indexOf('\n}', src.indexOf('await load()', reprintIdx)) + 2)
  assert.ok(reprintBody.includes('cardsOf(res)'), '重打必须走同一个 cardsOf')
})

test('记录表:已打印记录有「生产日期」列', () => {
  assert.ok(/prop="生产日期"\s+:label="tt\('生产日期'\)"/.test(src),
    '「已打印记录」表要有 生产日期 列(可反查这张纸上的日期)')
})

test('进入弹窗时重置生产日期(不沿用上次的值)', () => {
  const loadIdx = src.indexOf('async function load()')
  const loadBody = src.slice(loadIdx, src.indexOf('async function', loadIdx + 10))
  assert.ok(/prodDate\.value\s*=\s*String\(data\.value\?\.\['生产日期'\]/.test(loadBody),
    'load() 必须重置 prodDate(默认空,由人工填)')
})
