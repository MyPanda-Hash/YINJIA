/**
 * 「申请立项人」不需要用户填，谁填写的就是谁（2026-11-23 用户口径）。
 *
 * 该格由系统写入：新增时带当前登录人（docDefaults.LOCKED_PERSON），提交审批时按**提交人**回写
 * （ButtonService.doSubmitApproval / submitApproval 两处 UPDATE）。
 * 因此它**不能**再当必填拦住用户 —— 否则点提交会弹「申请立项人不能为空」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lockedPersonLabel } from '../panel/docDefaults.js'

const btn = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('申请立项人仍是「锁定=当前登录人」字段（新增即带出）', () => {
  assert.equal(lockedPersonLabel('RD_APPROVAL'), '申请立项人')
})

test('后端把申请立项人归入系统字段集合（不参与必填校验）', () => {
  const seg = btn.slice(btn.indexOf('REQUIRED_SYS_FIELDS'), btn.indexOf('REQUIRED_SYS_FIELDS') + 900)
  assert.match(seg, /"申请立项人"/, 'REQUIRED_SYS_FIELDS 必须含 申请立项人')
})

test('后端仍在提交审批时按提交人回写申请立项人（两处）', () => {
  const hits = btn.match(/UPDATE rd_approval SET 申请立项人 = \?/g) || []
  assert.ok(hits.length >= 2, `应至少两处回写（保存=送审 + 提交审批），实际 ${hits.length}`)
})

test('前端必填校验跳过申请立项人（与后端同口径）', () => {
  assert.match(list, /key === '单据编号' \|\| key === '规格书种类' \|\| key === '申请立项人'/, '前端未跳过')
})
