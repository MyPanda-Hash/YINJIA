/**
 * 产品文件列表「规格书批准」按钮的可见性（2026-11-17 用户报障）。
 *
 * 用户原话：「产品文件列表的所有文件完成后，规格书的批准人（冯敏）自动签核/生成日期
 *   —— 在文件列表有一个批准点击这个功能不见了」。
 *
 * 排查出**两个**原因，缺一不可修：
 *   ① 权限词 `specapprove` 从未授予任何角色（生产 20 个角色 0 个有）⇒ 迁移补上；
 *   ② 前端读的 `user.pagePerms.RD_SPEC_DOC` **永远是 undefined** ——
 *      pagePerms 由 AuthController.pagePermsOf 生成，它只遍历 PagePanelRegistry.codes()
 *      （页面级虚拟面板），真实单据面板不在其中 ⇒ 光改库不改代码，按钮照样不出现。
 *
 * 本测试钉 ②：登录载荷必须下发 panelPerms，前端必须优先读它。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/AuthController.java', import.meta.url), 'utf8')
const vue = readFileSync(new URL('./ProdDocListSheet.vue', import.meta.url), 'utf8')
const store = readFileSync(new URL('../../stores/user.js', import.meta.url), 'utf8')

test('后端必须下发 panelPerms（pagePerms 不含真实单据面板）', () => {
  assert.match(auth, /private Map<String, Object> panelPermsOf\(boolean admin, Object roleId\)/,
    '缺 panelPermsOf')
  // login() 与 currentUser() 两处都要挂（否则刷新页面后权限就丢了）
  const hits = auth.match(/user\.put\("panelPerms", panelPermsOf\(admin, u\.get\("role_id"\)\)\);/g) || []
  assert.equal(hits.length, 2, `login 与 currentUser 都要下发 panelPerms，实际 ${hits.length} 处`)
  // 管理员走 "*" 通配（与 pagePerms 同口径）
  assert.match(auth, /out\.put\("\*", "\*"\)/, '管理员应给通配')
})

test('前端 canApprove 必须优先读 panelPerms，并保留 pagePerms 兜底', () => {
  const at = vue.indexOf('function canApprove(')
  assert.ok(at > 0, '缺 canApprove')
  const seg = vue.slice(at, at + 900)
  assert.match(seg, /user\?\.panelPerms/, '必须读 panelPerms')
  assert.match(seg, /pp\.RD_SPEC_DOC/, '取的是 RD_SPEC_DOC 那一格')
  assert.match(seg, /pagePerms/, '保留 pagePerms 兜底（旧会话/旧后端）')
  assert.match(seg, /specapprove/, '判据词不变')
})

test('user store 必须保存 panelPerms（登录 + 会话还原都要）', () => {
  assert.match(store, /panelPerms: ui\?\.panelPerms/, '初始 state 要带')
  assert.match(store, /this\.panelPerms = u\?\.panelPerms/, 'setUser 要带')
  assert.match(store, /panelPerms: this\.panelPerms/, '持久化到 userInfo 要带')
})
