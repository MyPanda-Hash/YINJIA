/**
 * _q-docno-width.mjs —— 测试申请单「销售端-测试/检测申请表」编号格真实几何实测
 *
 * 【用户报障 2026-11-02】截图里右上角编号挤成两行:
 *   「这个编号有点挤到一起了,把框拉长对齐到文件管理员前边」
 * 改法(recordSheetConfigs.js RD_DOM_TEST 销售端页):noSpan 1→2 / noGapSpan 4→3。
 *
 * 量的东西(真实 getBoundingClientRect + Range 行框,不是读源码):
 *   · 编号格的列宽、colspan
 *   · 编号文字占几行(Range.getClientRects().length === 1 ⇔ 不折行)
 *   · 编号格左边缘 vs 下面「文件管理员」标签格的左边缘(用户要求两者对齐)
 *
 * 用法: node _q-docno-width.mjs [base]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`)
}

async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  return { token: j?.data?.token || '', user: j?.data?.user || {} }
}

async function main() {
  const { token, user } = await login()
  if (!token) throw new Error('登录失败')

  const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'RD_DOM_TEST', pageNo: 1, pageSize: 5, condition: {} }),
  })).json()
  const rows = list?.data?.list || []
  log('候选单据', rows.map((r) => r['单据编号']).join(','))
  const docNo = String(rows[0]?.['单据编号'] || '')
  log('目标单据', docNo || '(无)')
  if (!docNo) return finish()

  const s = await launch({ port: 9452 })
  try {
    const inject = `(() => {
      localStorage.setItem('mes_token', ${JSON.stringify(token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
      localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ factory: 'YJ' }))});
      return true
    })()`
    const url = `${BASE}/#/panelx/list/RD_DOM_TEST?docNo=${encodeURIComponent(docNo)}`
    await s.navigate(BASE + '/'); await sleep(1200)
    await s.evaluate(inject)
    await s.navigate(url); await sleep(1500)
    await s.evaluate(inject)
    await s.navigate(url); await sleep(5000)

    const tabs = await s.evaluate(`(() => [...document.querySelectorAll('.rsp-page-tab')].map(x => (x.textContent||'').trim()))()`)
    log('页签', tabs)
    const clicked = await s.evaluate(`(() => {
      const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').includes('销售端'))
      if (!t) return false
      t.click(); return true
    })()`)
    log('切到销售端页', clicked)
    await sleep(1500)

    const m = await s.evaluate(`(() => {
      const vis = (el) => el && el.offsetParent !== null
      const cell = [...document.querySelectorAll('td.rs-docno')].filter(vis)[0]
      if (!cell) return { err: '找不到 td.rs-docno' }
      const b = cell.getBoundingClientRect()
      const txt = (cell.textContent || '').trim()
      // 文字实际行框数：Range 覆盖整格内容 ⇒ 折行会返回多个 rect
      const rg = document.createRange(); rg.selectNodeContents(cell)
      const rects = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0)
      const lineBoxes = new Set(rects.map(r => Math.round(r.top)))
      const label = [...document.querySelectorAll('td.rs-info-label')].filter(vis)[0]
      const lb = label ? label.getBoundingClientRect() : null
      return {
        colspan: cell.colSpan,
        cellW: Math.round(b.width), cellH: Math.round(b.height),
        left: Math.round(b.left), right: Math.round(b.right),
        text: txt,
        lines: lineBoxes.size,
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
  await fs.writeFile(new URL('./out-docno-width.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-docno-width.json')
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e.message); finish() })
