// round-02:调试追溯弹窗结构
import { readFileSync } from 'node:fs'
const fixture = JSON.parse(readFileSync('D:/workspace/yinjia/.tmp/fixture-wo.json', 'utf8'))
const task = await taskSpace('wo-finishin-multibatch-20261113')
const page = (await task.pages())[0]
const sleep = (ms) => page.waitForTimeout(ms)
console.log('url=' + await page.url())
const st = await page.evaluate(() => {
  const dialogs = [...document.querySelectorAll('.el-dialog')].map((d) => ({
    title: (d.querySelector('.el-dialog__title') || {}).textContent?.trim(),
    cls: d.className,
    w: d.getBoundingClientRect().width,
    hasIn: (d.textContent || '').includes('入库单据'),
    blocks: [...d.querySelectorAll('[class*="trace"]')].map((x) => x.className).slice(0, 8),
  })).filter((d) => d.w > 100)
  return { dialogs, bodyHas: (document.body.innerText || '').includes('入库单据'), traceBlocks: document.querySelectorAll('.wb-trace-block').length }
})
console.log('state=' + JSON.stringify(st, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-finishin-multibatch-20261113/r02-debug.png' })
