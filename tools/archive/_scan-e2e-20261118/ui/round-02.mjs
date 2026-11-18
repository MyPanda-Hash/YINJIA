const task = await taskSpace('scan-e2e-20261118')
const page = task.page('p1')

// ① 先确认现在登录的是哪个账套(YJ=正式库 / YJ_TEST=测试库),别把测试点进正式库
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK_CREATE', { timeout: 30000 })
await page.waitForTimeout(3000)
const session = await page.evaluate(() => {
  const dump = {}
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i)
      const v = String(store.getItem(k) || '')
      if (/token|factory|user|ledger/i.test(k)) dump[k] = v.length > 120 ? v.slice(0, 120) + '…' : v
    }
  }
  return dump
})
console.log('== 会话 ==')
console.log(JSON.stringify(session, null, 2))

// ② 逐页走一遍:每个手机扫码页都要求「扫码输入框存在且自动聚焦」
const pages = [
  ['MOBILE_PICK_CREATE', '生成工单领料/退料单'],
  ['MOBILE_PICK', '生产领料'],
  ['MOBILE_RETURN', '生产退料'],
  ['MOBILE_OTHER_PICK', '其他领料'],
  ['MOBILE_OTHER_RET', '其他退料'],
  ['MOBILE_MIX_SCAN', '扫码混料'],
  ['MOBILE_REPORT', '工序报工'],
]
const out = []
for (const [code, name] of pages) {
  await page.goto('http://localhost:5173/#/panelx/list/' + code, { timeout: 30000 })
  await page.waitForTimeout(3500)
  const info = await page.evaluate((code) => {
    const inputs = [...document.querySelectorAll('input')]
    const scanHints = ['扫', '二维码', '扫码', '输入工单', '物料码', '条形码', '条码']
    const scan = inputs.find((i) => {
      const txt = (i.placeholder || '') + (i.getAttribute('aria-label') || '')
      return scanHints.some((h) => txt.includes(h))
    })
    const ae = document.activeElement
    return {
      code,
      hash: location.hash,
      hasScanInput: !!scan,
      scanPlaceholder: scan ? scan.placeholder : '',
      focusIsScan: !!(scan && ae === scan),
      focusPlaceholder: ae ? ae.placeholder || ae.tagName : '',
      buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 12).slice(0, 14),
      textSample: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
    }
  }, code)
  info.name = name
  out.push(info)
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-e2e-20261118/page-' + code + '.png' })
}
console.log('== 各页 ==')
console.log(JSON.stringify(out, null, 2))
