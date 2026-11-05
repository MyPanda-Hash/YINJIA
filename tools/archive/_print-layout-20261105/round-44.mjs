// round-44: 走**浏览器打印层**(站点离线时的兜底):拦下 window.print,抓出真正要打的 HTML
const { writeFileSync } = await import('node:fs')
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK/doc?id=827', { timeout: 30000 })
await page.waitForTimeout(3500)

const html = await page.evaluate(async () => {
  // 拦住真打印(否则会弹系统打印对话框挡住页面)
  window.print = () => { window.__printed = (window.__printed || 0) + 1 }
  const btn = [...document.querySelectorAll('.mp-foot button')].find((b) => (b.textContent || '').includes('打印二维码'))
  if (!btn) return { err: 'no print button' }
  btn.click()
  await new Promise((r) => setTimeout(r, 2500))
  const host = document.getElementById('yj-print-host')
  return { printed: window.__printed || 0, html: host ? host.innerHTML : '', len: host ? host.innerHTML.length : 0 }
})
console.log(JSON.stringify({ printed: html.printed, len: html.len, err: html.err }))
if (html.html) {
  const out = 'C:/Users/Lenovo/ego/pick-main-material-20261104/pick-slip-print.html'
  writeFileSync(out, '<!doctype html><meta charset="utf-8"><body style="margin:0">' + html.html + '</body>', 'utf8')
  console.log({ out })
}
