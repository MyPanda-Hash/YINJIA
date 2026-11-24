/**
 * 立项申请表「客户编号前缀」渲染钉子（2026-11-20 用户报障）。
 *
 * 【用户报障】「立项申请表在选择客户之后，客户名后面没有带出客户编号
 *   （应有『A-60 欧科塑胶制品(深圳)有限公司』这种前缀效果）」。
 *
 * 【生产实测根因】选完客户后：
 *   · head['文档编号'] 已被 `applyApprovalDocNo` 写成 `C-11220261120`（el-input 的 value 可读到），
 *     说明客户编码 C-112 已取到、`props.head['客户编号']` 也已写入（同一分支下一行）；
 *   · 但「客户名」那一格的 DOM 是 `.as-row > .as-name + .as-fill > .as-fill-main >
 *     .as-ref-ctl.as-fill-ref`（单字段行分支），里面**没有** `.as-ref-code`。
 *   2026-11-19 两次改动只把前缀 span 加在了「表格式信息条」与「vcell 合并竖列」两个分支；
 *   立项申请的 rows 是 `{ num, label, key, kind:'input' }`（没有 cells / 不是 grid），
 *   实际命中模板里的「单字段行」分支 —— 这就是「代码改了、界面没效果」的真相。
 *
 * 本文件按仓库既有做法（node:test 读源码）钉住：
 *   ① 实际命中的分支必须有前缀；
 *   ② 只读态（归档/无权限）也不许把前缀吞掉；
 *   ③ 前缀用 v-if 判空 —— 取不到编码时宁可不出，也不出空冒号/空灰块。
 * 逻辑单测见 approvalCustomerCode.test.js；编号规则见 approvalDocNoRule.test.js。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

/** 从锚点起截一段模板源码（锚点缺失立即失败，避免"测试空转"） */
function segment(anchor, len = 1400) {
  const at = vue.indexOf(anchor)
  assert.ok(at > 0, `DocSheet.vue 缺少锚点：${anchor}`)
  return vue.slice(at, at + len)
}

test('客户名实际命中的「单字段行」参照分支必须渲染客户编号前缀', () => {
  // 这是生产 DOM 实测命中的那一支：<div class="as-row"><div class="as-name">客户名</div>
  //   <div class="as-fill"><div class="as-fill-main"><div class="as-ref-ctl as-fill-ref">…
  // 注意不能只搜全文件：前缀此前就加在别的分支（as-info-ref / q-vrun）里，全文件搜得到、
  // 界面上却看不到。必须限定「as-fill-ref」这一段。
  const seg = segment('class="as-ref-ctl as-fill-ref"', 900)
  assert.match(seg, /custCodeOf\(row\.key\)/, '单字段行参照控件缺 custCodeOf(row.key)')
  assert.match(seg, /class="as-ref-code is-prefix"/, '单字段行参照控件缺前缀 span')
})

test('只读态（已归档/无权限）也显示「编码 客户名」，老单打开不能退回纯名字', () => {
  const seg = segment('class="as-ro-ref"', 700)
  assert.match(seg, /custCodeOf\(row\.key\)/, '单字段行只读分支缺 custCodeOf(row.key)')
  assert.match(seg, /class="as-ref-code is-prefix"/, '单字段行只读分支缺前缀 span')
})

test('取不到编码时不许渲染空前缀：每个前缀 span 都必须有 v-if 判空', () => {
  const spans = [...vue.matchAll(/<span[^>]*class="as-ref-code is-prefix"[^>]*>/g)].map((m) => m[0])
  assert.ok(spans.length >= 3, `前缀 span 数量异常（${spans.length}），至少要覆盖信息条/参照控件/只读态`)
  for (const tag of spans) {
    assert.match(tag, /v-if="custCodeOf\(/, `前缀 span 缺 v-if 判空，可能渲染出空灰块：${tag}`)
  }
})
