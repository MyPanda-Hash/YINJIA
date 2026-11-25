/**
 * batchStatus.test.js —— 「送料」浮层必须把**所有已送单据**都列出来的回归闸(2026-11-25 客户)
 *
 * 客户原话:「这上面关联的单据不应该都能看到吗」/「为什么这个记录找不到送料的单」
 * 病根:浮层只列 yj_doc_batch 里 ACTIVE/PENDING 的台账行,而占用不等于台账行 ——
 *   ① 统一生单/选单/手工建的送料暂收单只写 form_flow_link、不建台账行;
 *   ② 台账行被释放、或与单据「批次键」对不上时被过滤(生产实例 SL-2026-10-0053,批次键 240)。
 *   ⇒ 出现「已送 35000/35000/5000、浮层只有 2 批且都不是这张单」。
 *
 * 本测试守四件事:
 *   ① 状态文案口径:ACTIVE/PENDING/UNREGISTERED/RELEASED 都翻成中文键,未知状态不漏英文码;
 *   ② 去向单号口径:整链作废时**回显首跳单号**(不然现场无从排查),正常行仍可点;
 *   ③ 前后端接线真的在:后端 BatchService 产出 UNREGISTERED 合成行、前端浮层吃这两个函数;
 *   ④ 新词条「未登记台账」在**所有**语言包里都有译名(切 en/ja 不露中文)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

import { batchStatusKey, batchTargetDisplay } from './batchStatus.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')

test('状态文案:四种状态都翻成中文键,未知/空值按「已释放」兜底', () => {
  assert.equal(batchStatusKey('ACTIVE'), '有效')
  assert.equal(batchStatusKey('PENDING'), '待编号')
  assert.equal(batchStatusKey('UNREGISTERED'), '未登记台账', '后端补的合成行必须有中文文案')
  assert.equal(batchStatusKey('RELEASED'), '已释放')
  assert.equal(batchStatusKey('active'), '有效', '大小写不敏感')
  assert.equal(batchStatusKey(' active '), '有效', '两端空白要吃掉')
  assert.equal(batchStatusKey('WHATEVER'), '已释放', '未知状态不许把英文码漏到界面')
  assert.equal(batchStatusKey(null), '已释放')
  assert.equal(batchStatusKey(undefined), '已释放')
})

test('去向单号:正常行可点;整链作废时回显首跳单号并标已作废', () => {
  const ok = batchTargetDisplay({ targetFormNo: 'PI-2026-11-0057', firstTargetFormNo: 'SL-2026-11-0043' })
  assert.deepEqual(ok, { text: 'PI-2026-11-0057', voided: false, clickable: true })

  // 台账行登记的 SL-2026-09-0016 已作废/删除 ⇒ 后端 targetFormNo 置空 + targetInvalid
  const dead = batchTargetDisplay({ targetFormNo: '', firstTargetFormNo: 'SL-2026-09-0016', targetInvalid: true })
  assert.deepEqual(dead, { text: 'SL-2026-09-0016', voided: true, clickable: false },
    '必须回显它当初指向哪张单,否则现场不知道去哪查')

  const empty = batchTargetDisplay({})
  assert.deepEqual(empty, { text: '', voided: true, clickable: false })

  // 合成行(孤儿占用):targetFormNo 就是它自己,必须可点
  const orphan = batchTargetDisplay({ targetFormNo: 'SL-2026-10-0053', orphan: true })
  assert.equal(orphan.clickable, true)
  assert.equal(orphan.text, 'SL-2026-10-0053')
})

test('接线:后端产 UNREGISTERED 合成行,前端浮层吃这两个口径', () => {
  const svc = read('./../../../../backend/src/main/java/com/yinjia/mes/service/BatchService.java')
  assert.match(svc, /appendOrphanRows/, '后端必须补孤儿占用行')
  assert.match(svc, /"UNREGISTERED"/, '合成行状态码 = UNREGISTERED')
  // 合成行不许影响取号:nextBatchNo 与 batch_seq 都不看它
  assert.match(svc, /row\.put\("batchSeq", 0\)/, '合成行 batchSeq 固定 0,不改台账序号')

  const vue = read('./../views/PanelxList.vue')
  assert.match(vue, /batchStatusKey\(row\.status\)/, '浮层状态列要走 batchStatusKey')
  assert.match(vue, /batchTargetDisplay\(row\)/, '浮层去向单号列要走 batchTargetDisplay')
  assert.match(vue, /from '@core\/selection\/batchStatus'/, 'helpers 必须真的被 import 进来')
})

test('词条:每个语言包都有「未登记台账」(切语言不露中文)', () => {
  const dir = new URL('./../../i18n/locales/', import.meta.url)
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'))
  assert.ok(files.length >= 10, '语言包数量异常:' + files.join(','))
  const missing = []
  for (const f of files) {
    if (f === 'zh-CN.js') continue            // 中文是原文,不需要自译
    const text = readFileSync(new URL(f, dir), 'utf8')
    if (!text.includes("'未登记台账'")) missing.push(f)
  }
  assert.deepEqual(missing, [], '缺译名的语言包:' + missing.join(','))
})
