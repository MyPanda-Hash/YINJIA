/**
 * _q-docno.mjs —— 「产品文件」分组 7 个面板右上角编号格:当前显示的标识文案 + 绑的键
 * 用法: node _q-docno.mjs [base]
 *
 * 为什么要探:用户口径(2026-10-29)「产品文件内的面板的右上角的编号应该改为单据编号,所有的都是」。
 *   该格标识写死在 RecordSheetPanels.vue 里(tt('编号：')),绑的键由 sheetDocNo.docNoKeyOf 按
 *   head 里有没有「文档编号」决定 —— 但 RD_INSP_PLAN 的 文档编号 是 hidden=1 的物理列,
 *   若它进了 head,docNoKeyOf 会误判成「文档编号」⇒ 那格显示空值。必须先看清事实再改。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANELS = [
  'RD_PROD_INFO', 'RD_MOLD_PROC', 'RD_SPEC_DOC', 'RD_ASM_PROC',
  'RD_INSP_PLAN', 'RD_PROD_DOCLIST', 'RD_CHANGE',
]

const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v) : v) }

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

/** 每个面板取第一张单据号(没有就空串 ⇒ 页面停在列表态) */
const firstNo = {}
for (const p of PANELS) {
  try {
    const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: 1, condition: {} }),
    })).json()
    const row = (r?.data?.list || [])[0] || {}
    firstNo[p] = String(row['单据编号'] || row['编号'] || '')
  } catch { firstNo[p] = '' }
}
log('各面板首单', firstNo)

const LOGIN_JS = `(() => {
  const ph = (p) => [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes(p))
  const set = (el, v) => { if (!el) return false; el.focus(); const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value'); d && d.set ? d.set.call(el, v) : (el.value = v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }
  set(ph('登录账号') || ph('账号'), 'admin'); set(ph('登录密码') || ph('密码'), '123456')
  const btn = document.querySelector('.login-submit')
  btn && btn.click(); return 'clicked'
})()`

const s = await launch({ port: 9463 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(4500)

  for (const p of PANELS) {
    const q = firstNo[p] ? '?docNo=' + encodeURIComponent(firstNo[p]) : ''
    await s.navigate(`${BASE}/#/panelx/list/${p}${q}`); await sleep(6000)
    const r = await s.evaluate(`(() => {
      const cell = document.querySelector('.rs-docno')
      const pre = document.querySelector('.rs-docno-prefix')
      const cover = document.querySelector('.rsp-cover-docno')
      const pds = document.querySelector('.pds-docno')
      const txt = (e) => e ? (e.textContent || '').replace(/\\u00a0/g, ' ').trim() : null
      return {
        cell: txt(cell), prefix: txt(pre),
        cover: txt(cover), pds: txt(pds),
        anyPrefix: !!(pre || document.querySelector('.rs-docno') && txt(pre)),
      }
    })()`)
    log(p, r)
  }
} finally {
  const fs = await import('node:fs/promises')
  await fs.writeFile(new URL('./out-docno.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
