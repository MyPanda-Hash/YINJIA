// round-01:复核登录页「工厂信息加载失败」是否还在(8090 打包版 + 5173 源码版)
const task = await taskSpace('qc-insp-rec-login-check-20261119')
const page = task.page('p1')

const probe = async (url, tag) => {
  await page.goto(url, { timeout: 40000 })
  await page.waitForTimeout(5000)
  const st = await page.evaluate(() => {
    const txt = document.body.innerText || ''
    return {
      hash: location.hash,
      factoryErr: txt.includes('工厂信息加载失败'),
      loginErr: txt.includes('登录失败'),
      factorySelectText: (document.querySelector('.el-select__placeholder, .el-select__selected-item')?.textContent || '').trim(),
      selects: [...document.querySelectorAll('.el-select')].length,
      hasAccountInput: !!document.querySelector('input[placeholder*="账号"]'),
      bodyHead: txt.replace(/\s+/g, ' ').slice(0, 160),
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { /* skip */ }
  await page.screenshot({ path: `C:/Users/Lenovo/ego/qc-insp-rec-login-check-20261119/${tag}.png` })
}

await probe('http://127.0.0.1:8090/#/login', '8090-login')
await probe('http://localhost:5173/#/login', '5173-login')
