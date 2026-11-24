/**
 * round-01 — 送货单二维码 / 标识卡二维码带每箱数量:纸面渲染取证(2026-11-24)
 *
 * 做法:在 5173(vite,源码即时生效)页面里**直接动态 import** `src/business/print-formats.js` 的
 * 出纸函数 —— 调用的就是线上那条真实代码路径(printInPage 页面内打印层 + qrcode 真出图),
 * 只把 window.print 打成桩(不弹系统打印框),再用 CDP 把媒体模拟成 print,
 * 于是打印层按「纸」的样子铺满屏、可截图。
 *
 * 为什么不用点按钮:点「打印订单无金额」会先落一张打印记录(bl_pu_print),
 * 本任务只改纸面版式,不必往两个账套写脏数据;真实弹窗链路另见 round-02。
 */
const OUT = 'D:/YINJIA-main/_scratch/ego-delivery-qr-20261124'
const task = await taskSpace('delivery-qr-20261124')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(3500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// window.print 打桩:只记次数,不弹系统打印框(否则 CDP 会话会被原生对话框卡住)
await page.evaluate(() => {
  window.__printed = 0
  window.print = () => { window.__printed += 1 }
})

// ① 送货单(两行 ⇒ 一个二维码装两条记录)
const r1 = await page.evaluate(async () => {
  const mod = await import('/src/business/print-formats.js')
  const doc = {
    单据编号: 'YJ-20261116-03', 单据日期: '2026-11-16',
    供应商编码: 'YJ-KBL', 供应商: '惠州市康佰利包装材料有限公司', 付款方式: '', '税率%': 0,
  }
  const lines = [
    { 物料编码: 'YJ-KBL-028', 物料名称: '1025气泡袋', 规格型号: '13*36cm', 单位: '个', 数量: 1440, 预计到货日期: '2026-11-16', 备注: '11/18 送华北' },
    { 物料编码: 'YJ-KBL-029', 物料名称: 'PE袋', 规格型号: '100*120', 单位: '个', 数量: 50, 预计到货日期: '2026-11-16', 备注: '' },
  ]
  const ok = await mod.printPuOrderNoAmount(doc, lines)
  const host = document.getElementById('yj-print-host')
  const img = host && host.querySelector('.hdqr img')
  return {
    ok,
    printed: window.__printed,
    qrText: mod.deliveryNoteQrText(doc, lines),
    hdqrCount: host ? host.querySelectorAll('.hdqr').length : -1,
    qrImgChars: img ? img.src.length : 0,
    // 二维码物理尺寸(打印层坐标,单位 px;96dpi 下 26mm ≈ 98.3px)
    qrBox: img ? { w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height) } : null,
  }
})
console.log('① 送货单 = ' + JSON.stringify(r1, null, 2))

await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(600)
await page.screenshot({ path: OUT + '/round-01-delivery-note.png', fullPage: true })
await page.cdp('Emulation.setEmulatedMedia', { media: '' })

// ② 标识卡(材料码):每箱数量 200 ⇒ 二维码 = 0@物料编码@批号@200
const r2 = await page.evaluate(async () => {
  const mod = await import('/src/business/print-formats.js')
  const row = {
    编码: 'YJ-KBL-028', 规格: '13*36cm', 数量: 200, 每箱数量: 200, 批次: '20261021',
    订单编号: 'YJ-20261116-03', 供应商名称: '惠州市康佰利包装材料有限公司', 生产日期: '2026-11-16',
  }
  await mod.printProductCards([row])
  const host = document.getElementById('yj-print-host')
  const img = host && host.querySelector('.card .qr img')
  return {
    qrText: mod.productCardQrText(row),
    cards: host ? host.querySelectorAll('.card').length : -1,
    qrImgChars: img ? img.src.length : 0,
    cardBox: host && host.querySelector('.card')
      ? (() => { const b = host.querySelector('.card').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) } })()
      : null,
  }
})
console.log('② 标识卡 = ' + JSON.stringify(r2, null, 2))

await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(600)
await page.screenshot({ path: OUT + '/round-01-label-card.png' })
await page.cdp('Emulation.setEmulatedMedia', { media: '' })

// 收拾打印层,别把它留在用户窗口里
await page.evaluate(() => {
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
await task.finish({ keep: [] })
