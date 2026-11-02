/** 检查供应商格的换行样式是否生效 */
import { attachCdp } from '../_cdp.mjs'
import { readdirSync } from 'node:fs'

const PORT = 9477
const WORK = 'D:/YINJIA-main/tools/archive/_negative-fix-20261022/_t8'
let html = null
for (const f of readdirSync(WORK)) if (f.endsWith('.html')) html = f
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const cdp = await attachCdp(PORT, tabs.find((t) => t.type === 'page').id)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: `file:///${WORK}/${html}` })
await sleep(2000)
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(500)

const r = await cdp.ev(`(() => {
  const p = document.getElementById('a1');
  const t = p.querySelector('.as-ref-text');
  const c = p.querySelector('.as-ref-ctl');
  const cs = getComputedStyle(t);
  return JSON.stringify({
    whiteSpace: cs.whiteSpace, overflowWrap: cs.overflowWrap, textOverflow: cs.textOverflow,
    overflow: cs.overflow, width: cs.width,
    txtRect: t.getBoundingClientRect().toJSON(), ctlRect: c.getBoundingClientRect().toJSON(),
    lineHeight: cs.lineHeight, fontSize: cs.fontSize,
    maxWidth: cs.maxWidth, wordBreak: cs.wordBreak
  });
})()`)
console.log(r)
await cdp.send('Emulation.setEmulatedMedia', { media: '' })
cdp.close()
