/**
 * 换账号必须清页签（2026-11-17 用户报障）。
 *
 * 用户原话：「使用一个账号打开一些面板的时候，然后中途你退出，然后切换账号进来的时候
 *   还是在对应的面板」。
 *
 * 根因**不在路由**：登出确实 `router.replace('/login')`（实测 hash 变 #/login、token 已清），
 * 登录也确实 `router.replace('/dashboard')`。问题在 **pinia 的页签 store 活在内存里**：
 *   · `logout()` 只清了 token / userInfo / 权限位，`tabs` 与 `active` 原样留着；
 *   · 重新登录后 PortalLayout 重新挂载，TabsBar 仍渲染上一个账号的面板页签，
 *     `active` 还指着那一页 ⇒ 界面看起来"还停在原来的面板"。
 *
 * 修法：login() 与 logout() **两处都 `closeAll()`**（只留 affix「我的桌面」+ active='/dashboard'）。
 * 两处都要：登出清是为了不留痕；登录清是为了兜住 401 被动登出 / 别处登录等没走 logout() 的路径。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { useTabsStore } from './tabs.js'

const userSrc = readFileSync(new URL('./user.js', import.meta.url), 'utf8')

test('closeAll()：只留 affix「我的桌面」，active 回 /dashboard', () => {
  setActivePinia(createPinia())
  const tabs = useTabsStore()
  tabs.open({ title: '项目实施计划', path: '/panelx/list/RD_PLAN' })
  tabs.open({ title: '产品信息表', path: '/panelx/list/RD_PROD_INFO?code=C-01' })
  assert.equal(tabs.tabs.length, 3, '此时应有 桌面 + 2 个面板页签')
  assert.equal(tabs.active, '/panelx/list/RD_PROD_INFO')

  tabs.closeAll()

  assert.deepEqual(tabs.tabs.map((t) => t.path), ['/dashboard'], '只留 affix 的「我的桌面」')
  assert.equal(tabs.active, '/dashboard', 'active 必须回桌面，不能停在旧面板')
})

test('user store：login() 与 logout() 都必须清理页签', () => {
  assert.match(userSrc, /import \{ useTabsStore \} from '@\/stores\/tabs'/, '要引入 tabs store')
  const loginAt = userSrc.indexOf('async login(payload)')
  assert.ok(loginAt > 0, '缺 login()')
  const loginSeg = userSrc.slice(loginAt, loginAt + 2200)
  assert.match(loginSeg, /useTabsStore\(\)\.closeAll\(\)/, 'login() 里要 closeAll()')

  const logoutAt = userSrc.indexOf('logout() {')
  assert.ok(logoutAt > 0, '缺 logout()')
  const logoutSeg = userSrc.slice(logoutAt, logoutAt + 1200)
  assert.match(logoutSeg, /useTabsStore\(\)\.closeAll\(\)/, 'logout() 里要 closeAll()')
  // 登出清理必须在移除 token 附近（同一动作内），不能只在别处
  assert.match(logoutSeg, /localStorage\.removeItem\('mes_token'\)/, '仍要清 token')
})

test('两处清理都做了容错（无 pinia 实例的单测环境不炸）', () => {
  const hits = userSrc.match(/try \{ useTabsStore\(\)\.closeAll\(\) \} catch/g) || []
  assert.equal(hits.length, 2, `login/logout 两处都要 try-catch，实际 ${hits.length} 处`)
})
