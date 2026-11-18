const task = await taskSpace('finish-in-failqty')
const page = task.page('p1')
console.log(JSON.stringify(await page.evaluate(() => {
  const ls = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    const v = localStorage.getItem(k) || ''
    ls[k] = v.length > 120 ? v.slice(0, 60) + '…' + v.slice(-20) : v
  }
  return {
    hash: location.hash,
    topbar: (document.querySelector('.topbar, .app-header, header')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
    lsKeys: Object.keys(ls),
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  }
}), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/finish-in-gate-qty/ego/round-02-state.png' })
console.log('shot ok')
