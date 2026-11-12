// round-03.mjs — 用真实受限账号(sc 角色:有 QC_FLOW/QC_INSP,无 QC_RECV/PURCHASE_IN)验证
//                 「看板能看,但没有该面板权限的节点点了不跳」;顺带核对节点锁标记与提示文案。
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(2500)

// 换成受限账号(测试账套 YJ_TEST)的真实会话:走 /api/auth/login,把 token/user 写进 localStorage(与 store.login 同款)
const loginInfo = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'qcflowdemo', password: '123456', factory: 'YJ_TEST' }),
  })
  const j = await r.json()
  if (j.code !== 200) return { err: j.message || 'login failed' }
  const u = j.data.user
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(u))
  localStorage.setItem('mes_factory', JSON.stringify({ code: u.factory || 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
  return { isAdmin: u.isAdmin, visiblePanels: u.visiblePanels, factory: u.factory, name: u.realName || u.userName }
})
console.log('受限账号会话 =', JSON.stringify(loginInfo))

await page.goto('http://localhost:5173/#/qc/flowMonitor', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(4000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }

const state = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const pick = rows.find((r) => [...r.querySelectorAll('.qcf-node')].every((n) => n.querySelector('.qcf-node-no') && !n.querySelector('.qcf-node-no.is-empty')))
  return {
    hash: location.hash,
    header: text(document.querySelector('.qcf-datatime')),
    rowCount: rows.length,
    hasBoard: !!document.querySelector('.qcf-board'),
    menuHasEntry: document.body.innerText.includes('品质流程监控'),
    sample: pick ? {
      batch: text(pick.querySelector('.qcf-batch')),
      nodes: [...pick.querySelectorAll('.qcf-node')].map((n) => ({
        name: text(n.querySelector('.qcf-node-name')),
        no: text(n.querySelector('.qcf-node-no')),
        locked: !!n.querySelector('.qcf-lock'),
        link: n.classList.contains('is-link'),
      })),
    } : null,
  }
})
console.log('board state =', JSON.stringify(state, null, 2))

// 点「送料暂收单」节点(该角色没有 QC_RECV 查看权)→ 只提示不跳
const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const pick = rows.find((r) => [...r.querySelectorAll('.qcf-node')].every((n) => n.querySelector('.qcf-node-no') && !n.querySelector('.qcf-node-no.is-empty')))
  if (!pick) return { err: 'no full row' }
  const nodes = [...pick.querySelectorAll('.qcf-node')]
  nodes[0].click()
  return { clicked: (nodes[0].textContent || '').replace(/\s+/g, ' ').trim() }
})
await page.waitForTimeout(1200)
const after = await page.evaluate(() => ({
  hash: location.hash,
  msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('点无权限节点后 =', JSON.stringify({ clicked, after }, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-03-no-perm.png' })

// 再点「来料检验单」节点(该角色有 QC_INSP 查看权)→ 应真的跳过去
const clicked2 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const pick = rows.find((r) => [...r.querySelectorAll('.qcf-node')].every((n) => n.querySelector('.qcf-node-no') && !n.querySelector('.qcf-node-no.is-empty')))
  if (!pick) return { err: 'no full row' }
  const nodes = [...pick.querySelectorAll('.qcf-node')]
  nodes[1].click()
  return { clicked: (nodes[1].textContent || '').replace(/\s+/g, ' ').trim() }
})
await page.waitForTimeout(2500)
const after2 = await page.evaluate(() => ({ hash: location.hash, hasResult: !!document.querySelector('.el-table, .doc-sheet, .cs-page') }))
console.log('点有权限节点后 =', JSON.stringify({ clicked2, after2 }, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-03-jump-ok.png' })

// 收尾:恢复管理员会话(别把用户的浏览器留在演示账号上)
await page.goto('http://localhost:5173/#/login', { timeout: 60000 })
await page.waitForTimeout(1500)
await page.evaluate(() => { localStorage.removeItem('mes_token'); localStorage.removeItem('mes_user') })
console.log('cleared demo session (next open will ask login)')
