/**
 * _q-spec-pick.mjs —— 规格书「1.关键物料列表」的引用按钮:文案 + 弹窗内容
 * 用法: node _q-spec-pick.mjs [base]
 *
 * 验四件事(2026-10-29 用户口径「规格书的从商品引用改回去引用物料清单」):
 *   ① 按钮文案 = 「从物料清单引用」(不再是「从商品引用」);
 *   ② 点开后弹窗标题一致;
 *   ③ 弹窗列 = 物料编码 / 单据日期 / 物料代码 / 物料名称 / 子件数(**不是** 所属类别/存货编码…);
 *   ④ 弹窗有真实物料清单行(数量 > 0)且子件数 > 0。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v) : v) }

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', pageNo: 1, pageSize: 1, condition: {} }),
})).json()
const no = String((r?.data?.list || [])[0]?.['单据编号'] || '')
log('规格书单', no)

// 顺便直查 WLBOM 有多少张单 / 多少子件,作为弹窗应有数据的独立佐证
const wl = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'WLBOM', pageNo: 1, pageSize: 500, condition: {} }),
})).json()
const masters = wl?.data?.list || []
log('WLBOM 单据数', masters.length)
log('WLBOM 子件总数', masters.reduce((s, m) => s + ((m?.detail?.items || []).length), 0))

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

const s = await launch({ port: 9485 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC${no ? '?docNo=' + encodeURIComponent(no) : ''}`)

  // 切到第 4 页(成品及包装运输,页 3)
  for (let i = 0; i < 15; i++) {
    await sleep(2000)
    if (await s.evaluate(`[...document.querySelectorAll('.rsp-page-tab')].length > 0`)) break
  }
  log('切页签', await s.evaluate(`(() => {
    const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').trim()==='成品及包装运输')
    if(!t) return 'not-found'
    t.click(); return 'clicked'
  })()`))
  await sleep(2500)

  // ① 按钮文案
  log('引用按钮', await s.evaluate(`(() => {
    const bs=[...document.querySelectorAll('.rs-tool')].map(x=>(x.textContent||'').trim())
    return bs
  })()`))

  // 点它
  const clicked = await s.evaluate(`(() => {
    const el=[...document.querySelectorAll('.rs-tool')].find(x=>/引用/.test(x.textContent||''))
    if(!el) return 'not-found'
    el.click(); return 'clicked'
  })()`)
  log('点引用', clicked)

  // ③④ 弹窗
  let dlg = null
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    dlg = await s.evaluate(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
      if(!d) return null
      const title=(d.querySelector('.el-dialog__title')?.textContent||'').trim()
      const headers=[...d.querySelectorAll('.el-table__header th')].map(x=>(x.textContent||'').trim()).filter(Boolean)
      const rows=d.querySelectorAll('.el-table__body tr').length
      const hint=(d.querySelector('div[style*="909399"]')?.textContent||'').trim()
      return { title, headers, rows, hint }
    })()`)
    if (dlg && dlg.rows > 0) break
  }
  log('弹窗', dlg)
} finally {
  await fs.writeFile(new URL('./out-spec-pick.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
