/**
 * _q-docno-width2.mjs —— 真实表单登录 + 销售端页编号格几何实测
 *
 * 前两个版本直塞 localStorage token 都会被路由守卫弹回 #/login(会话要服务端校验),
 * 故本版走**真实登录框**:填账号/密码 → 点「进入系统」→ 再进面板页。
 *
 * 量的东西:编号格 colspan / 宽度 / 文字行框数(Range.getClientRects 去重 top)/
 *          与「文件管理员」标签格左边缘是否对齐。
 * 用法: node _q-docno-width2.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://36.140.66.163:8090'
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`)
}

async function main() {
  const s = await launch({ port: 9454 })
  try {
    await s.navigate(BASE + '/#/login'); await sleep(4000)

    const filled = await s.evaluate(`(() => {
      const setVal = (el, v) => {
        const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        d.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const inputs = [...document.querySelectorAll('input')]
      const acc = inputs.find(i => (i.placeholder || '').includes('登录账号')) || inputs[0]
      const pwd = inputs.find(i => i.type === 'password')
      if (!acc || !pwd) return { ok: false, n: inputs.length }
      setVal(acc, 'admin')
      setVal(pwd, '123456')
      return { ok: true, acc: acc.placeholder, pwd: !!pwd }
    })()`)
    log('填登录框', filled)
    await sleep(600)

    const clicked = await s.evaluate(`(() => {
      const btns = [...document.querySelectorAll('button')]
      const b = btns.find(x => (x.textContent || '').includes('进入系统')) || btns[0]
      if (!b) return false
      b.click(); return true
    })()`)
    log('点进入系统', clicked)
    await sleep(6000)

    const after = await s.evaluate(`(() => ({ hash: location.hash, hasList: document.querySelectorAll('.panelx-list').length }))()`)
    log('登录后', after)
    if (after.hash.includes('login')) { log('结论', 'FAIL 登录未成功'); return }

    await s.navigate(BASE + '/#/panelx/list/RD_DOM_TEST'); await sleep(9000)
    const tabs = await s.evaluate(`(() => [...document.querySelectorAll('.rsp-page-tab')].map(x => (x.textContent||'').trim()))()`)
    log('页签', tabs)
    const clicked2 = await s.evaluate(`(() => {
      const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').includes('销售端'))
      if (!t) return false
      t.click(); return true
    })()`)
    log('切到销售端页', clicked2)
    await sleep(2000)

    const m = await s.evaluate(`(() => {
      const vis = (el) => el && el.offsetParent !== null
      const cell = [...document.querySelectorAll('td.rs-docno')].filter(vis)[0]
      if (!cell) return { err: '找不到可见的 td.rs-docno', tdCount: document.querySelectorAll('td.rs-docno').length }
      const b = cell.getBoundingClientRect()
      const txt = (cell.textContent || '').trim()
      const rg = document.createRange(); rg.selectNodeContents(cell)
      const rects = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0)
      const lineBoxes = new Set(rects.map(r => Math.round(r.top)))
      const label = [...document.querySelectorAll('td.rs-info-label')].filter(vis)[0]
      const lb = label ? label.getBoundingClientRect() : null
      return {
        colspan: cell.colSpan,
        cellW: Math.round(b.width), cellH: Math.round(b.height),
        left: Math.round(b.left), text: txt, lines: lineBoxes.size,
        labelLeft: lb ? Math.round(lb.left) : null,
        labelText: label ? (label.textContent || '').trim() : '',
        aligned: lb ? Math.abs(Math.round(b.left) - Math.round(lb.left)) <= 2 : null,
      }
    })()`)
    log('编号格', m)
    if (!m.err) {
      log('不折行', m.lines === 1 ? 'PASS(1 行)' : `FAIL(${m.lines} 行)`)
      log('与文件管理员左边缘对齐', m.aligned ? 'PASS' : `FAIL(编号 left=${m.left} / 标签 left=${m.labelLeft})`)
    }
    await s.close?.()
  } finally {
    finish()
  }
}

async function finish() {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-docno-width2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-docno-width2.json')
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e.message); finish() })
