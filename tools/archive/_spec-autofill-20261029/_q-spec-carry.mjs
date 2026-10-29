/**
 * _q-spec-carry.mjs —— 规格书选产品编号 ⇒ 关键物料列表自动按 BOM 整表重带(B 方案)
 * 用法: node _q-spec-carry.mjs [base]
 *
 * 验收:
 *   ① 选一个**有 BOM 明细**的产品信息表 ⇒ 页 4「1.关键物料列表」自动出现对应行;
 *   ② 行数 = 该产品 BOM 明细行数,数量 = BOM 的 数量;
 *   ③ 再选**另一个**产品 ⇒ 旧行被清空、只剩新产品的行(B 方案:清空后整表重带)。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log('\n' + k + ' ='); console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }

function q(sql) {
  return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
    'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
    'yinjia', 'Yinjia@2026', sql], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' }).trim()
}

// 独立佐证:找两张**有 BOM 明细**的产品信息表
const withBom = q(`SELECT h.产品编号, h.单据编号, COUNT(d.id) AS 行数
  FROM rd_prod_info_head h JOIN rd_prod_info_detail d ON d.单据编号=h.单据编号
  WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(d.asp_cancel,'N')<>'Y'
    AND NULLIF(LTRIM(RTRIM(h.产品编号)),'') IS NOT NULL
  GROUP BY h.产品编号, h.单据编号 ORDER BY 行数 DESC`)
log('有 BOM 的产品信息表', withBom)

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const mk = await (await fetch(BASE + '/api/px/callButton', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '提交', formData: {}, buttonParam: {} }),
})).json()
const specNo = String(mk?.data?.['编号'] || '')
log('新建规格书', specNo)

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

/** 切到页 4 并读「1.关键物料列表」的行 */
const READ_MAT = `(() => {
  const tabs=[...document.querySelectorAll('.rsp-page-tab')]
  const t=tabs.find(x=>(x.textContent||'').trim()==='成品及包装运输')
  if(t && !t.classList.contains('active')) t.click()
  return 'switched'
})()`
const READ_ROWS = `(() => {
  const tables=[...document.querySelectorAll('table.rs-t')].filter(t=>{
    const h=(t.querySelector('tr')?.textContent||'')
    return h.includes('物料编码') && h.includes('规格参数')
  })
  if(!tables.length) return { err:'未找到关键物料列表' }
  const t=tables[tables.length-1]
  const trs=[...t.querySelectorAll('tr')].slice(1)
  const rows=trs.map(tr=>[...tr.children].map(td=>{
    const inp=td.querySelector('input,textarea')
    return (inp?inp.value:td.textContent||'').trim()
  })).filter(r=>{
    const joined=r.join('')
    return joined.replace(/[＋×—／\\s]/g,'').length>0
  })
  return { n: rows.length, rows: rows.slice(0,6) }
})()`

const s = await launch({ port: 9491 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC${specNo ? '?docNo=' + encodeURIComponent(specNo) : ''}`)
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    if (await s.evaluate(`document.querySelectorAll('.rsp-cover-fields tr').length>0`)) break
  }
  log('切页 4', await s.evaluate(READ_MAT))
  await sleep(2500)
  log('带料前', await s.evaluate(READ_ROWS))

  // ⚠ 产品编号的引用控件在**封面(页 0)**,不能停在页 4 点 —— 先切回页 0
  log('切回页 0', await s.evaluate(`(() => {
    const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').trim()==='产品信息')
    if(!t) return 'no-tab'
    t.click(); return 'clicked'
  })()`))
  await sleep(2000)

  // 打开产品编号引用弹窗,挑一个**可引用且有 BOM** 的
  log('点引用', await s.evaluate(`(() => {
    const el=document.querySelector('.rsp-cover-vl-pick, .rsp-cover-docno-pick')
    if(!el) return 'not-found:' + [...document.querySelectorAll('.rsp-cover-vl *')].map(e=>e.className).slice(0,6).join('|')
    el.click(); return 'clicked'
  })()`))
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    if (await s.evaluate(`(() => {const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null); return !!(d&&d.querySelectorAll('.el-table__body tr').length)})()`)) break
  }
  log('弹窗候选', await s.evaluate(`(() => {
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    if(!d) return null
    return [...d.querySelectorAll('.el-table__body tr')].map(tr=>[...tr.children].map(td=>(td.textContent||'').trim()))
  })()`))

  log('选可引用行', await s.evaluate(`(() => {
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    const trs=[...d.querySelectorAll('.el-table__body tr')]
    const ok=trs.find(tr=>!(tr.textContent||'').includes('已开发'))
    if(!ok) return 'no-available'
    ok.querySelector('td').click()
    return 'clicked:' + (ok.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40)
  })()`))
  await sleep(1200)
  log('确定', await s.evaluate(`(() => {
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    if(!d) return 'no-dialog'
    const ok=[...d.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='确定')
    if(!ok) return 'no-ok'
    if(ok.disabled) return 'disabled'
    ok.click(); return 'clicked'
  })()`))
  await sleep(3500)
  log('提示', await s.evaluate(`(()=>[...document.querySelectorAll('.el-message__content')].map(e=>(e.textContent||'').trim()).filter(Boolean).slice(-3))()`))
  log('带料后', await s.evaluate(READ_ROWS))
} finally {
  // 作废探针规格书
  if (specNo) {
    try {
      q(`UPDATE rd_spec_doc_head SET asp_cancel='Y' WHERE 单据编号='${specNo}';
         UPDATE rd_spec_doc_detail SET asp_cancel='Y' WHERE 单据编号='${specNo}';`)
      log('探针作废', specNo)
    } catch (e) { log('作废失败', String(e.message).slice(0, 100)) }
  }
  await fs.writeFile(new URL('./out-spec-carry.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
