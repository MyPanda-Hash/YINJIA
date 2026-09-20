/**
 * _chk-filtereff-live.cjs — RD_FILTER_EFF 保存为何未被必填拦截:全链路实况
 *
 * 步骤:新增 → dump 头表 → 保存为草稿 → dump → 保存(dump 响应) → dump
 * 用法:node tools/archive/_chk-filtereff-live.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = 'RD_FILTER_EFF'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

function dumpHead(no) {
  const cols = sql(`SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('rd_filter_eff_head') ORDER BY column_id`)
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  const keep = cols.filter((c) => /文档编号|测试主题|单据编号|备注|创建时间|编辑人|编辑日期/.test(c))
  const sel = keep.map((c) => `'['+ISNULL(CONVERT(nvarchar(80), [${c}]),N'<null>')+']'`).join(" + N'|' + ")
  console.log(`  头表行数 = ${sql(`SELECT COUNT(*) FROM rd_filter_eff_head WHERE 单据编号='${no}'`)}`)
  console.log(`  列(${keep.join(',')})`)
  console.log(sql(`SELECT ${sel} FROM rd_filter_eff_head WHERE 单据编号='${no}'`).split(/\r?\n/).map((l) => '    ' + l).join('\n'))
  console.log(`  该列存在? 文档编号=${sql(`SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('rd_filter_eff_head') AND name=N'文档编号'`)} 测试主题=${sql(`SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('rd_filter_eff_head') AND name=N'测试主题'`)}`)
}

;(async () => {
  const lg = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const tk = lg.data.token
  const H = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }
  const call = async (buttonName, formData) => {
    const r = await fetch(BASE + '/api/px/callButton', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: PANEL, buttonName, formData, buttonParam: {} }),
    })
    const j = await r.json().catch(() => ({}))
    return { http: r.status, code: j.code, msg: j.message, data: j.data }
  }

  const c = await call('新增', {})
  const no = c.data && c.data['编号']
  if (!no) { console.log('⊘ 建单失败:', JSON.stringify(c)); process.exit(2) }
  console.log(`新增 → 编号=${no}  HTTP ${c.http}`)
  console.log('--- 新增后 ---'); dumpHead(no)

  const d = await call('保存为草稿', { 编号: no, 备注: 'probe' })
  console.log(`保存为草稿 → HTTP ${d.http} code=${d.code} msg=${JSON.stringify(d.msg)}`)
  console.log('--- 草稿后 ---'); dumpHead(no)

  const s = await call('保存', { 编号: no, 备注: 'probe' })
  console.log(`保存 → HTTP ${s.http} code=${s.code} msg=${JSON.stringify(s.msg)}`)
  console.log('--- 保存后 ---'); dumpHead(no)

  console.log('')
  console.log('=== yj_doc_status ===')
  console.log(sql(`SELECT doc_no+'|saved='+ISNULL(saved,'<null>')+'|archived='+ISNULL(archived,'<null>')+'|pending='+ISNULL(pending,'<null>')
    FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}'`))

  // 清理
  sql(`DELETE FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}';
       DELETE FROM rd_filter_eff_detail WHERE 单据编号='${no}';
       DELETE FROM rd_filter_eff_head WHERE 单据编号='${no}';`)
  console.log('已清理探针单')
})().catch((e) => { console.error('异常:', e.stack); process.exit(1) })
