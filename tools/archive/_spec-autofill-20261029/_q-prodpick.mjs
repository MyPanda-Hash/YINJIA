/**
 * _q-prodpick.mjs —— 规格书「产品编号」引用产品信息表:到底断在哪一步
 * 用法: node _q-prodpick.mjs [base]
 *
 * 用户报障(2026-10-29):「现在规格书选择产品编号没有出现产品信息表填写的内容,应该是关联断掉了」。
 * 逐段取证,不猜:
 *   ① 打开弹窗前:封面当前值;
 *   ② 弹窗里**有多少候选行**、列有哪些、值是什么(如果 0 行 ⇒ 取数或过滤断了);
 *   ③ 选中一行 → 点确定 → 封面各字段的**前后值对比**(如果没变 ⇒ 映射断了);
 *   ④ 前后各字段的 key 是否与 prodPick.map 的 to 对得上。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

// 独立佐证:产品信息表有几张单、产品编号是否非空
const pi = await (await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_PROD_INFO', pageNo: 1, pageSize: 500, condition: {} }),
})).json()
const piRows = pi?.data?.list || []
log('RD_PROD_INFO 单据数', piRows.length)
log('其中产品编号非空', piRows.filter((r) => String(r['产品编号'] || '').trim()).length)
log('前 3 张', piRows.slice(0, 3).map((r) => ({
  产品编号: r['产品编号'], 产品名称: r['产品名称'], 单据日期: r['单据日期'], 单据编号: r['单据编号'],
})))

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

/** 读封面字段表(label → 值) */
const READ_COVER = `(() => {
  const rows=[...document.querySelectorAll('.rsp-cover-fields tr')]
  const o={}
  for(const tr of rows){
    const tds=[...tr.children]
    if(tds.length<2) continue
    const lb=(tds[0].textContent||'').trim()
    const v=(tds[1].querySelector('input,textarea')?.value ?? tds[1].textContent ?? '').trim()
    if(lb) o[lb]=v
  }
  return o
})()`

const s = await launch({ port: 9490 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)

  // 新建一张规格书(草稿态才能编辑/引用)
  const mk = await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '提交', formData: {}, buttonParam: {} }),
  })).json()
  const newNo = String(mk?.data?.['编号'] || '')
  log('新建规格书', newNo || '(失败)')

  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC${newNo ? '?docNo=' + encodeURIComponent(newNo) : ''}`)
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    if (await s.evaluate(`document.querySelectorAll('.rsp-cover-fields tr').length > 0`)) break
  }
  log('引用前封面', await s.evaluate(READ_COVER))

  // 点产品编号那一行的引用控件(class 见 RecordSheetPanels 模板:rsp-cover-docno-pick)
  const clicked = await s.evaluate(`(() => {
    const el=document.querySelector('.rsp-cover-vl-pick, .rsp-cover-docno-pick')
    if(!el) return 'not-found:' + [...document.querySelectorAll('[class*=pick]')].map(e=>e.className).slice(0,5).join('|')
    el.click(); return 'clicked'
  })()`)
  log('点引用控件', clicked)

  let dlg = null
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    dlg = await s.evaluate(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
      if(!d) return null
      const title=(d.querySelector('.el-dialog__title')?.textContent||'').trim()
      const headers=[...d.querySelectorAll('.el-table__header th')].map(x=>(x.textContent||'').trim()).filter(Boolean)
      const trs=[...d.querySelectorAll('.el-table__body tr')]
      const rows=trs.slice(0,4).map(tr=>[...tr.children].map(td=>(td.textContent||'').trim()))
      const hint=(d.querySelector('.pp-foot')?.textContent||'').trim()
      return { title, headers, nRows: trs.length, rows, hint }
    })()`)
    if (dlg && dlg.nRows > 0) break
  }
  log('弹窗', dlg)

  // 选一行**可引用**的(点单元格,不是 tr —— Element 的行点击在 td 上冒泡才稳)
  if (dlg && dlg.nRows > 0) {
    log('可引用行', await s.evaluate(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
      const trs=[...d.querySelectorAll('.el-table__body tr')]
      const ok=trs.find(tr=>!(tr.textContent||'').includes('已开发'))
      if(!ok) return 'no-available'
      const td=ok.querySelector('td')
      if(!td) return 'no-cell'
      td.click()
      return 'clicked:' + (ok.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40)
    })()`))
    await sleep(1500)
    log('点确定', await s.evaluate(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
      if(!d) return 'no-dialog'
      const btns=[...d.querySelectorAll('button')]
      const ok=btns.find(b=>(b.textContent||'').trim()==='确定')
      if(!ok) return 'no-ok'
      if(ok.disabled) return 'disabled'
      ok.click(); return 'clicked'
    })()`))
    await sleep(2500)
    log('引用后封面', await s.evaluate(READ_COVER))
    log('提示', await s.evaluate(`(()=>[...document.querySelectorAll('.el-message__content')].map(e=>(e.textContent||'').trim()).filter(Boolean).slice(-3))()`))
  }

  // 作废探针单
  if (newNo) {
    const { execFileSync } = require('node:child_process')
    const q = `UPDATE rd_spec_doc_head SET asp_cancel='Y' WHERE 单据编号='${newNo}'; SELECT 单据编号,ISNULL(asp_cancel,'N') AS 作废 FROM rd_spec_doc_head WHERE 单据编号='${newNo}'`
    try {
      const r = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
        'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
        'yinjia', 'Yinjia@2026', q], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' })
      log('探针单作废', r.trim().split('\n').slice(-2).join(' | '))
    } catch (e) { log('探针单作废失败', String(e.message).slice(0, 120)) }
  }
} finally {
  await fs.writeFile(new URL('./out-prodpick.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
