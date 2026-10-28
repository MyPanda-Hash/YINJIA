/**
 * _q-geom.mjs —— 组装工艺清单「组装BOM表」页签真实几何实测(8090 + Edge 无头)
 *
 * 用户口径(2026-10-28 截图《组装工艺控制-BOM表》):
 *   ①「把这个面板表格的外观那一列去掉不需要了」
 *   ②「表格调整对齐表格宽度，也可以同时调整上边宽度，不单单是调整下边的，这样子观感会好一点」
 *
 * 量的东西(真实 getBoundingClientRect,不是读源码):
 *   · 报告头 / 产品基本信息(上边) / BOM表(下边) 各自的 width、left、right
 *   · 三者左右缘是否齐平
 *   · BOM 表每一列的像素边界(判断与上边竖线是否对得上)
 *
 * 用法: node _q-geom.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || ''
const out = []
const log = (k, v) => {
  out.push({ k, v })
  console.log(`${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`)
}

async function login() {
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  return { token: lj?.data?.token || '', user: lj?.data?.user || {} }
}

async function main() {
  const { token, user } = await login()
  if (!token) throw new Error('登录失败')

  // 没有指定单号就取列表第一张
  let docNo = DOC
  if (!docNo) {
    const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ panelCode: 'RD_ASM_PROC', pageNo: 1, pageSize: 5, condition: {} }),
    })).json()
    const rows = list?.data?.list || []
    docNo = String(rows[0]?.['单据编号'] || '')
    log('候选单据', rows.map((r) => r['单据编号']).join(','))
  }
  log('目标单据', docNo || '(无)')
  if (!docNo) return finish()

  const s = await launch({ port: 9451 })
  try {
    const inject = `(() => {
      localStorage.setItem('mes_token', ${JSON.stringify(token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
      localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ factory: 'YJ' }))});
      return true
    })()`
    const url = `${BASE}/#/panelx/list/RD_ASM_PROC?docNo=${encodeURIComponent(docNo)}`
    await s.navigate(BASE + '/'); await sleep(1000)
    await s.evaluate(inject)
    await s.navigate(url); await sleep(1500)
    await s.evaluate(inject)
    await s.navigate(url); await sleep(5000)

    // 切到「组装BOM表」页签(第 2 个)
    const tabs = await s.evaluate(`(() => [...document.querySelectorAll('.rsp-page-tab')].map(x => (x.textContent||'').trim()))()`)
    log('页签', tabs)
    const clicked = await s.evaluate(`(() => {
      const t = [...document.querySelectorAll('.rsp-page-tab')].find(x => (x.textContent||'').includes('组装BOM表'))
      if (!t) return false
      t.click(); return true
    })()`)
    log('点击组装BOM表', clicked)
    await sleep(1200)

    const geom = await s.evaluate(`(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) } }
      const vis = (el) => el && el.offsetParent !== null
      const tables = [...document.querySelectorAll('.rs-t')].filter(vis).map((t) => {
        const b = r(t)
        const cells = [...t.querySelectorAll('tr')][0]
          ? [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(td => (td.textContent||'').trim().slice(0,10)))
          : []
        // 第一行(或表头行)的列边界
        const hdr = [...t.querySelectorAll('tr')].find(tr => tr.querySelector('th'))
        const cols = hdr ? [...hdr.children].map(td => ({ t: (td.textContent||'').trim(), ...r(td) })) : []
        return { w: b.w, l: b.l, r: b.r, rows: t.querySelectorAll('tr').length, cols, firstRow: cells[0] || [] }
      })
      const dt = [...document.querySelectorAll('.rs-t.rs-dt')].filter(vis).map(t => { const b = r(t); return { w: b.w, l: b.l, r: b.r } })
      return { tables, dt, bodyW: Math.round(document.querySelector('.rsp-page, .rs-page, .panelx-list')?.getBoundingClientRect().width || 0) }
    })()`)
    log('几何', geom)

    // 结论式断言
    const sections = geom.tables.filter(t => !geom.dt.some(d => d.l === t.l && d.w === t.w && d.r === t.r))
    const bom = geom.dt[geom.dt.length - 1]
    log('上边区块宽度集合', [...new Set(geom.tables.map(t => t.w))])
    log('下边明细表宽度', bom ? bom.w : null)
    if (bom && geom.tables.length) {
      const sec = geom.tables[0]
      log('左右缘是否齐平', (sec.l === bom.l && sec.r === bom.r) ? 'PASS(齐平)' : `FAIL(上 l=${sec.l} r=${sec.r} / 下 l=${bom.l} r=${bom.r})`)
    }
    await s.close?.()
  } finally {
    finish()
  }
}

async function finish() {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-geom.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-geom.json')
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e.message); finish() })
