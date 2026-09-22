import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unwrap, unwrapStrict, errMsg } from './panel-engine.js'

/**
 * 这组断言守的是 2026-09-22 用户报的既有行为:
 * 「无权限面板只显示空表不解释」——要加上解释。
 *
 * 背景(实查,别退回旧写法):
 *  · 服务端权限拒绝走的是 `AccessDeniedException` → GlobalExceptionHandler 归一成
 *    **HTTP 200 + body code 403**(故意不用 403 状态码,否则前端 axios 拦截器会把用户登出)。
 *  · 而 `unwrap(res)` 遇到这种响应**不抛错**,返回的是整个 body 对象(`res.data` 为 null 时
 *    `res.data ?? res` 落到 body)。列表页随后 `list.value = res.list || []` ⇒ 空数组 ⇒
 *    界面就是"空表 + 完整工具栏",用户看不出是被拒绝了。
 *  · 所以要有"严格解包":body code != 200 一律当错误抛出,交给各页既有的 catch → ElMessage 显示原因。
 */
const denied = { code: 403, message: '当前角色无该面板的查看权限：BOM', data: null }

test('unwrapStrict:body code 403 抛错,并带上后端原因', () => {
  let err = null
  try { unwrapStrict(denied) } catch (e) { err = e }
  assert.ok(err, '必须抛错(否则调用方只会看到空结果)')
  assert.match(String(err.message), /无该面板的查看权限/)
  // 各页统一用 errMsg(e) 取文案 ⇒ e.response.data.message 必须能被取到
  assert.match(errMsg(err), /无该面板的查看权限/)
  assert.equal(err.code, 403, '原样保留后端 code,便于调用方区分')
})

test('unwrapStrict:正常响应与旧 unwrap 行为完全一致', () => {
  const okBody = { code: 200, message: 'ok', data: { list: [1, 2], totalSize: 2 } }
  assert.deepEqual(unwrapStrict(okBody), unwrap(okBody))
  assert.deepEqual(unwrapStrict(okBody), { list: [1, 2], totalSize: 2 })

  // 无 code 字段(不是 ApiResult,例如第三方/直返对象)按原样走,不误判成错误
  const plain = { list: [], totalSize: 0 }
  assert.deepEqual(unwrapStrict(plain), unwrap(plain))

  // code=200 但 data 为 null:沿用旧 unwrap 的语义(返回 body),不改动既有调用方行为
  const nullData = { code: 200, message: 'ok', data: null }
  assert.deepEqual(unwrapStrict(nullData), unwrap(nullData))

  // 空值不炸
  assert.equal(unwrapStrict(null), unwrap(null))
  assert.equal(unwrapStrict(undefined), unwrap(undefined))
})

test('unwrapStrict:其它非 200 的 body code 也当错误(403 之外的 400/503 等)', () => {
  for (const code of [400, 409, 429, 503]) {
    let err = null
    try { unwrapStrict({ code, message: '后端说明' + code, data: null }) } catch (e) { err = e }
    assert.ok(err, code + ' 应抛错')
    assert.equal(err.code, code)
  }
})
