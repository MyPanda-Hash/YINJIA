const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
const dom = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll('input')].map(i => ({
    type: i.type, placeholder: i.placeholder, cls: String(i.className).slice(0,40), name: i.name
  })),
  buttons: [...document.querySelectorAll('button')].map(b => (b.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,8),
  hasAccountSelect: !!document.querySelector('.el-select'),
}))
console.log(JSON.stringify(dom, null, 1))
await task.finish({ keep: [] })
process.exit(0)
