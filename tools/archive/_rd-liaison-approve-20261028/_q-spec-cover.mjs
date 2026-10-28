/**
 * _q-spec-cover.mjs —— 产品规格书封面三项改动**活体实测**(8090 + Edge 无头)
 *
 * 用户口径(2026-10-28 截图《产品规格书》):
 *   ①「把产品规格书的产品编号做成和产品类别一样的大表格进行填写，引用还是可以引用的」
 *   ②「原来的产品编号的位置改为自动生成的单据编号，现在的单据编号不是看不到吗？」
 *   ③「把产品规格书的表格做宽一点点，现在看起来有一点窄了」
 *
 * 这里量的是**真实渲染像素**(不是读源码):
 *   · 字段表第一行标签 = 产品编号?  值格里是否有引用控件(放大镜)?
 *   · 右上角那格印的是「单据编号：<SD-…>」?
 *   · 字段表宽度 = 多少 px(改前/改后对比用)
 *
 * 用法: node _q-spec-cover.mjs [base]
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

async function main() {
  // 登录拿 token(走接口,不模拟登录页 —— 页面直接注入 localStorage 更稳)
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const lj = await lr.json()
  const token = lj?.data?.token || ''
  if (!token) throw new Error('登录失败')
  // ⚠ user store 的 isLogin 只看 token,但路由守卫/权限还要 mes_user(visiblePanels 等)
  //   —— 只注入 token 会被打回 /login(实测)。两把一起给。
  const userInfo = lj?.data?.user || {}
  log('login', 'ok')

  const s = await launch({ port: 9411 })
  try {
    await s.navigate(BASE + '/')
    await sleep(1200)
    await s.evaluate(`(() => {
      localStorage.setItem('mes_token', ${JSON.stringify(token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(userInfo))});
      localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ factory: 'YJ' }))});
      return true
    })()`)
    await s.navigate(BASE + '/')
    await sleep(2000)

    // 规格书面板:带 docNo 直接定位一张已存在的单
    const list = await (await fetch(BASE + '/api/px/queryFormDataList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', pageNo: 1, pageSize: 5, condition: {} }),
    })).json()
    const rows = list?.data?.list || []
    const no = String(rows[0]?.['单据编号'] || rows[0]?.['编号'] || '')
    log('目标单据', no || '(没有规格书单)')
    if (!no) return finish()

    await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(no)}`)
    await sleep(1500)
    // ⚠ navigate 是整页重载,会清掉刚才注入的 localStorage（新文档上下文）⇒ 重载后再注入一次并刷新
    await s.evaluate(`(() => {
      localStorage.setItem('mes_token', ${JSON.stringify(token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(userInfo))});
      localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ factory: 'YJ' }))});
      return true
    })()`)
    await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(no)}`)
    await sleep(4500)

    // 诊断:页面上到底有没有东西
    const diag = await s.evaluate(`(() => ({
      url: location.href,
      bodyLen: document.body ? document.body.innerText.length : -1,
      hasSheet: !!document.querySelector('.approval-sheet, .rsp-cover-page, .panelx-list, .rs-table'),
      cls: document.body ? document.body.className : '',
      txt: document.body ? document.body.innerText.slice(0, 200) : '',
      token: (localStorage.getItem('mes_token') || '').slice(0, 8),
    }))()`)
    log('诊断', diag)

    const r = await s.evaluate(`(() => {
      const q = (sel) => document.querySelector(sel)
      const table = q('.rsp-cover-fields')
      const firstRow = table ? table.querySelector('tr') : null
      const firstLb = firstRow ? firstRow.querySelector('.rsp-cover-lb') : null
      const firstVl = firstRow ? firstRow.querySelector('.rsp-cover-vl') : null
      const docno = q('.rsp-cover-docno')
      const docnoLb = q('.rsp-cover-docno-lb')
      const docnoVal = q('.rsp-cover-docno-val')
      const rect = table ? table.getBoundingClientRect() : null
      const page = q('.rsp-cover-page')
      const prect = page ? page.getBoundingClientRect() : null
      return {
        tableW: rect ? Math.round(rect.width) : null,
        tableH: rect ? Math.round(rect.height) : null,
        rows: table ? table.querySelectorAll('tr').length : 0,
        firstLabel: firstLb ? firstLb.textContent.trim() : '',
        firstHasPick: !!(firstVl && firstVl.querySelector('.rsp-cover-docno-pick')),
        firstHasIcon: !!(firstVl && firstVl.querySelector('.rs-ref-ico')),
        firstValue: firstVl ? (firstVl.textContent || '').trim() : '',
        docnoLabel: docnoLb ? docnoLb.textContent.trim() : '',
        docnoValue: docnoVal ? docnoVal.textContent.trim() : '',
        pageW: prect ? Math.round(prect.width) : null,
        pageH: prect ? Math.round(prect.height) : null,
      }
    })()`)
    log('实测', r)

    log('① 断言 = 字段表第一行是「产品编号」', r.firstLabel === '产品编号' ? 'PASS' : 'FAIL')
    // 引用控件只在**编辑态**渲染（只读态的纸面本来就是纯文本，不该出现可点控件）
    if (r.firstHasPick || r.firstHasIcon) {
      log('① 断言 = 该行仍是引用控件(放大镜)', 'PASS')
    } else if (/^已归档|^已审核/.test(diag.txt.slice(-50))) {
      log('① 引用控件', 'SKIP(该单已审批,只读态本来就没有引用控件)')
    } else {
      // 只读态也要能证明"配置里还挂着引用":查面板配置的 prodPick 是否指向产品编号
      log('① 引用控件', `未见控件(只读态或未渲染) —— 值=${r.firstValue}`)
    }
    log('② 断言 = 右上角印「单据编号：」', /单据编号/.test(r.docnoLabel) ? 'PASS' : 'FAIL')
    log('② 断言 = 右上角有自动单号(非空)', (/\d{4}/.test(r.docnoValue) && r.docnoValue !== '—') ? 'PASS' : 'FAIL')
    log('③ 字段表宽度(px) / 画布宽(px)', `${r.tableW} / ${r.pageW}`)
    log('③ 断言 = 字段表宽度 ≥ 画布 70%（改前约 60% 偏窄）',
      (r.tableW && r.pageW && r.tableW / r.pageW >= 0.70) ? 'PASS' : 'FAIL')

    // ── ④ 编辑态:新建一张空白规格书,确认「产品编号」那一行仍是**可点的引用控件** ──
    // 直接调按钮建空草稿(saved='N' ⇒ 前端 isFreshAddedDoc ⇒ draftEditable 为真)
    const mk = await (await fetch(BASE + '/api/px/callButton', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '提交', formData: {}, buttonParam: {} }),
    })).json()
    const newNo = String(mk?.data?.['编号'] || '')
    log('④ 新建空白规格书', newNo || '(失败)')
    if (newNo) {
      await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC?docNo=${encodeURIComponent(newNo)}`)
      await sleep(4500)
      const e = await s.evaluate(`(() => {
        const table = document.querySelector('.rsp-cover-fields')
        const firstVl = table ? table.querySelector('tr .rsp-cover-vl') : null
        return {
          hasPick: !!(firstVl && firstVl.querySelector('.rsp-cover-docno-pick')),
          hasIcon: !!(firstVl && firstVl.querySelector('.rs-ref-ico')),
          text: firstVl ? (firstVl.textContent || '').trim() : '',
        }
      })()`)
      log('④ 编辑态首行值格', e)
      log('④ 断言 = 编辑态仍是引用控件(可点选产品信息表)', (e.hasPick && e.hasIcon) ? 'PASS' : 'FAIL')
      log('④ 待清理的空白探针单', newNo)
    }
    await s.close?.()
  } finally {
    finish()
  }
}

async function finish() {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-spec-cover.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  console.log('\n[written] out-spec-cover.json')
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e.message); finish() })
