/**
 * _q-spec-carry2.mjs —— 规格书选产品编号 ⇒ 关键物料列表自动整表重带(用探针数据,可控可复核)
 * 用法: node _q-spec-carry2.mjs [base]
 *
 * 库里只有一个产品(01111)有 BOM 明细,而它已被探针规格书引用("已开发",不可再选)。
 * ⇒ 本脚本先造一张**有 BOM 的探针产品信息表**(归档,顺带验一次 mate 同步),
 *   再用规格书引用它,验关键物料列表是否自动带出;末尾清理干净。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const { launch, sleep } = require('./_cdpclient.cjs')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PROD = 'ZZ-CARRY-01'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log('\n' + k + ' ='); console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }

function q(sql) {
  return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
    'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
    'yinjia', 'Yinjia@2026', sql], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' }).trim()
}

// 预清理
q(`DELETE FROM mate WHERE m_no='${PROD}';
   UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}';`)

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
async function pi(buttonName, formData) {
  return (await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName, formData, buttonParam: {} }),
  })).json())
}

// ── 造探针产品信息表:3 行 BOM,走完整审批归档(顺带验 mate 同步)──
const mk = await pi('提交', {})
const prodDoc = String(mk?.data?.['编号'] || '')
log('探针产品信息表', prodDoc)
log('保存', JSON.stringify(await pi('保存', {
  编号: prodDoc, 产品编号: PROD, 产品名称: '带料验证件', 单据日期: '2026-10-29',
  detail: { items: [
    { 序号: '1', 物料编号: 'CC-A', 物料名称: '带料甲', 尺寸规格: 'Φ20*30', 数量: '4' },
    { 序号: '2', 物料编号: 'CC-B', 物料名称: '带料乙', 尺寸规格: 'Φ21*31', 数量: '6' },
    { 序号: '3', 物料编号: 'CC-C', 物料名称: '带料丙', 尺寸规格: 'Φ22*32', 数量: '8' },
  ] },
})).slice(0, 120))
await pi('审批通过', { 编号: prodDoc, 二级审批人: 'admin' })
log('归档1', JSON.stringify(await pi('审批通过', { 编号: prodDoc })).slice(0, 120))
await new Promise((r) => setTimeout(r, 900))
log('mate(归档后)', q(`SELECT wzdm2, wzmc2, gg2, bzl FROM mate WHERE m_no='${PROD}' ORDER BY wzdm2`))

// ── 新建规格书,选这个产品编号 ──
const mkS = await (await fetch(BASE + '/api/px/callButton', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '提交', formData: {}, buttonParam: {} }),
})).json()
const specNo = String(mkS?.data?.['编号'] || '')
log('探针规格书', specNo)

const LOGIN_JS = `(() => {
  const ph=(p)=>[...document.querySelectorAll('input')].find(i=>(i.placeholder||'').includes(p))
  const set=(el,v)=>{if(!el)return false;el.focus();const d=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value');d&&d.set?d.set.call(el,v):(el.value=v);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
  set(ph('登录账号')||ph('账号'),'admin');set(ph('登录密码')||ph('密码'),'123456')
  const b=document.querySelector('.login-submit');b&&b.click();return 'ok'
})()`

const READ_ROWS = `(() => {
  const tables=[...document.querySelectorAll('table.rs-t')].filter(t=>{
    const h=(t.querySelector('tr')?.textContent||'')
    return h.includes('物料编码') && h.includes('规格参数')
  })
  if(!tables.length) return { err:'未找到关键物料列表' }
  const t=tables[tables.length-1]
  const rows=[...t.querySelectorAll('tr')].slice(1).map(tr=>[...tr.children].map(td=>{
    const inp=td.querySelector('input,textarea')
    return (inp?inp.value:td.textContent||'').trim()
  })).filter(r=>r.join('').replace(/[＋×—／\\s]/g,'').length>0)
  return { n: rows.length, rows: rows.slice(0,6) }
})()`

const s = await launch({ port: 9492 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  await s.evaluate(LOGIN_JS); await sleep(5000)
  await s.navigate(`${BASE}/#/panelx/list/RD_SPEC_DOC${specNo ? '?docNo=' + encodeURIComponent(specNo) : ''}`)
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    if (await s.evaluate(`document.querySelectorAll('.rsp-cover-fields tr').length>0`)) break
  }
  log('点引用', await s.evaluate(`(() => {
    const el=document.querySelector('.rsp-cover-vl-pick, .rsp-cover-docno-pick')
    if(!el) return 'not-found'
    el.click(); return 'clicked'
  })()`))
  for (let i = 0; i < 20; i++) {
    await sleep(1500)
    if (await s.evaluate(`(() => {const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null); return !!(d&&d.querySelectorAll('.el-table__body tr').length)})()`)) break
  }
  log('选中探针行', await s.evaluate(`(() => {
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    const trs=[...d.querySelectorAll('.el-table__body tr')]
    const tr=trs.find(x=>(x.textContent||'').includes('${PROD}'))
    if(!tr) return 'not-in-list:' + trs.map(x=>(x.textContent||'').replace(/\\s+/g,' ').trim().slice(0,30)).join(' | ')
    tr.querySelector('td').click()
    return 'clicked'
  })()`))
  await sleep(1200)
  log('确定', await s.evaluate(`(() => {
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null)
    if(!d) return 'no-dialog'
    const ok=[...d.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='确定')
    if(!ok || ok.disabled) return 'disabled'
    ok.click(); return 'clicked'
  })()`))
  await sleep(4000)
  log('提示', await s.evaluate(`(()=>[...document.querySelectorAll('.el-message__content')].map(e=>(e.textContent||'').trim()).filter(Boolean).slice(-4))()`))

  // 切页 4 读关键物料列表
  await s.evaluate(`(() => {
    const t=[...document.querySelectorAll('.rsp-page-tab')].find(x=>(x.textContent||'').trim()==='成品及包装运输')
    if(t) t.click(); return !!t
  })()`)
  await sleep(2500)
  log('关键物料列表(带料后)', await s.evaluate(READ_ROWS))
} finally {
  if (specNo) q(`UPDATE rd_spec_doc_head SET asp_cancel='Y' WHERE 单据编号='${specNo}'; UPDATE rd_spec_doc_detail SET asp_cancel='Y' WHERE 单据编号='${specNo}';`)
  log('清理', q(`DELETE FROM mate WHERE m_no='${PROD}';
    UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}';
    SELECT COUNT(*) AS mate残留 FROM mate WHERE m_no='${PROD}'`))
  await fs.writeFile(new URL('./out-spec-carry2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  process.exit(0)
}
