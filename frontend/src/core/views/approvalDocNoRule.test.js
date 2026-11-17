/**
 * 立项申请表「立项编号」自动带入规则（用户口径，2026-11-06 提、2026-11-17 修）。
 *
 * 用户话：「这个项目编号在选择客户的时候自己根据规则带入」（规则 = 客户编码 + 日期，日期 20261106 形态）。
 *
 * 现状：规则 `applyApprovalDocNo` 早就有了，但**正式环境永远不生效** ——
 *   它只从 `客户编码`/`dm`/`客户编号` 这些列取编码，而客户参照（RD_APPROVAL.客户名）
 *   的 ref_field 是 `mc`（只回填客户名）⇒ 取不到编码 ⇒ 立项编号一直空白。
 *   用户同时给了新口径：「客户名里已含编码（如『B-85-06 青岛伊可普』）挤一格」
 *   ⇒ 从**客户名开头**把 ASCII 编码段抠出来。
 *
 * 本例直接验规则本身（与实现同一段正则），并钉住"纯中文名不许当编码"。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

/** 与 DocSheet.applyApprovalDocNo 同一套取值顺序（改那边必须同步这里，否则测试会空转） */
function codeOf(source) {
  const CODE_KEYS = ['客户编码', '客户代码', 'dm', '客户编号', '编码']
  for (const k of CODE_KEYS) {
    const v = source?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  const NAME_KEYS = ['客户名', '客户名称', 'mc']
  for (const k of NAME_KEYS) {
    const name = source?.[k]
    if (name === undefined || name === null) continue
    // 与实现同一套正则：编码位置不固定，全串扫
    const m = String(name).match(/[A-Za-z]{1,4}-[0-9][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*/)
    if (m && m[0]) return m[0]
  }
  return ''
}

test('从客户名抠编码：B-85-06 青岛伊可普 → B-85-06', () => {
  assert.equal(codeOf({ mc: 'B-85-06 青岛伊可普' }), 'B-85-06')
  assert.equal(codeOf({ 客户名: 'B-85-06 青岛伊可普' }), 'B-85-06')
})

test('各种真实形态都能抠出来（**编码位置不固定**）', () => {
  assert.equal(codeOf({ mc: 'B-85-06 青岛伊可普' }), 'B-85-06')     // 编码在前（用户给的例子）
  // 生产实测的真实形态：编码在中文名之后，后面还跟着电话 —— 只看开头会永远抠不到
  assert.equal(codeOf({ mc: '浙江德凌电器有限公司 A-60 跟单客户 18658439031 林小姐 谢琴' }), 'A-60')
  assert.equal(codeOf({ mc: 'C-112' }), 'C-112')                    // 只有编码
  assert.equal(codeOf({ mc: '某公司 c-112 客户' }), 'c-112')          // 小写也行
})

test('纯中文名 / 纯数字电话 都不许当成编码', () => {
  assert.equal(codeOf({ mc: '青岛伊可普电器有限公司' }), '')
  assert.equal(codeOf({ mc: '欧科塑胶制品(深圳)有限公司' }), '')
  assert.equal(codeOf({ mc: '浙江德凌电器有限公司 18658439031' }), '', '纯数字电话不是编码')
  assert.equal(codeOf({}), '')
  assert.equal(codeOf(null), '')
})

test('显式编码列优先于从名字抠', () => {
  assert.equal(codeOf({ 客户编码: 'K-777', mc: 'B-85-06 青岛伊可普' }), 'K-777')
})

test('实现里这两条链路都在（防只剩其一）', () => {
  assert.match(vue, /const CODE_KEYS = \['客户编码', '客户代码', 'dm', '客户编号', '编码'\]/, '显式编码列')
  assert.match(vue, /const NAME_KEYS = \['客户名', '客户名称', 'mc'\]/, '客户名兜底')
  assert.match(vue, /\[A-Za-z\]\{1,4\}-\[0-9\]\[A-Za-z0-9\]\*\(\?:-\[A-Za-z0-9\]\+\)\*/, '编码段正则（字母+连字符+数字）')
  assert.doesNotMatch(vue, /match\(\/\^\(\[A-Za-z0-9\]/, '不得再只看开头（生产实测编码在名字后面）')
  assert.match(vue, /props\.head\['文档编号'\] = code \+ ymd/, '规则 = 客户编码 + 日期')
  assert.match(vue, /String\(d\.getFullYear\(\)\)[\s\S]{0,120}padStart\(2, '0'\)/, '日期 YYYYMMDD')
})
