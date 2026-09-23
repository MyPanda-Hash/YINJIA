/**
 * _chk-moldproc-live.cjs — RD_MOLD_PROC「保存」为何放行:全链路实况
 *
 * 现象:必填=产品编号/产品名称(place=header,required=1),但
 *   · 只传 {编号,备注}          → 400 被拦(第一版探针)
 *   · 传 {编号,备注,产品编号:'',产品名称:''} → 200 放行(第二版探针)
 * 要查清:① 新增出来的编号是否已存在旧单(编号生成撞车 ⇒ isStoredBlank 读到旧值)
 *         ② 头表这一行的 产品编号/产品名称 到底存了什么
 * 用法:node tools/archive/_chk-moldproc-live.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = 'RD_MOLD_PROC'
const HEAD = 'rd_mold_proc_head'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 1 << 24 }).trim()

const dumpRow = (no, tag) => {
  const n = sql(`SELECT COUNT(*) FROM ${HEAD} WHERE 单据编号='${no}'`)
  const row = n === '0' ? '(无行)' : sql(`SELECT '产品编号=['+ISNULL(产品编号,N'<null>')+'] 产品名称=['+ISNULL(产品名称,N'<null>')
    +'] 备注=['+ISNULL(备注,N'<null>')+'] id='+CAST(id AS varchar) FROM ${HEAD} WHERE 单据编号='${no}'`).replace(/\r?\n/g, ' ⏎ ')
  console.log(`    ${tag}: 行数=${n} ${row}`)
}

;(async () => {
  const lg = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const H = { Authorization: 'Bearer ' + lg.data.token, 'Content-Type': 'application/json' }
  const call = async (buttonName, formData) => {
    const r = await fetch(BASE + '/api/px/callButton', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: PANEL, buttonName, formData, buttonParam: {} }),
    })
    const j = await r.json().catch(() => ({}))
    return { http: r.status, code: j.code, msg: j.message, data: j.data }
  }

  console.log('=== 头表现有单据(编号 | 产品编号 | 产品名称)===')
  console.log(sql(`SELECT ISNULL(单据编号,N'<null>')+' | '+ISNULL(产品编号,N'<null>')+' | '+ISNULL(产品名称,N'<null>') FROM ${HEAD} ORDER BY id`))

  console.log('')
  console.log('=== 场景 A:只传 {编号,备注} ===')
  const a = await call('新增', {})
  const noA = a.data && a.data['编号']
  console.log(`  新增 → ${noA}`)
  dumpRow(noA, '新增后')
  const sA = await call('保存', { 编号: noA, 备注: 'probe-A' })
  console.log(`  保存(键缺失) → HTTP ${sA.http} msg=${JSON.stringify(sA.msg)}`)
  dumpRow(noA, '保存后')

  console.log('')
  console.log('=== 场景 B:传 {编号,备注,产品编号:"",产品名称:""} ===')
  const b = await call('新增', {})
  const noB = b.data && b.data['编号']
  console.log(`  新增 → ${noB}`)
  dumpRow(noB, '新增后')
  const sB = await call('保存', { 编号: noB, 备注: 'probe-B', 产品编号: '', 产品名称: '' })
  console.log(`  保存(空串键在) → HTTP ${sB.http} msg=${JSON.stringify(sB.msg)}`)
  dumpRow(noB, '保存后')

  console.log('')
  console.log('=== 场景 C:同 B 但先走一次「保存为草稿」 ===')
  const c = await call('新增', {})
  const noC = c.data && c.data['编号']
  const dC = await call('保存为草稿', { 编号: noC, 备注: 'probe-C', 产品编号: '', 产品名称: '' })
  console.log(`  新增 → ${noC}  草稿 → HTTP ${dC.http}`)
  dumpRow(noC, '草稿后')
  const sC = await call('保存', { 编号: noC, 备注: 'probe-C', 产品编号: '', 产品名称: '' })
  console.log(`  保存 → HTTP ${sC.http} msg=${JSON.stringify(sC.msg)}`)
  dumpRow(noC, '保存后')

  console.log('')
  console.log('=== yj_field 定义(产品编号/产品名称)===')
  console.log(sql(`SELECT col_name+' | label='+label+' | ['+place+'] | type='+ISNULL(data_type,'')+' | ref='+ISNULL(ref_panel,'-')
    +' | req='+CAST(required AS varchar)+' | editable='+CAST(editable AS varchar)
    FROM yj_field WHERE panel_code='${PANEL}' AND label IN (N'产品编号',N'产品名称')`))

  for (const no of [noA, noB, noC]) {
    if (!no) continue
    sql(`DELETE FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}';
         DELETE FROM ${HEAD} WHERE 单据编号='${no}';`)
  }
  console.log('')
  console.log('已清理探针单')
})().catch((e) => { console.error('异常:', e.stack); process.exit(1) })
