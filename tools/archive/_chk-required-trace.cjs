/**
 * _chk-required-trace.cjs — 精确复现"保存"是否被必填校验拦下,并打印服务端返回原文
 *
 * 上一版探针只传了 { 编号 },信息不足。这里按前端 currentFormData 的口径传**完整表头**
 * (含空字符串),并分别试「草稿」与「保存」,把 HTTP/后端 message 原样打出来。
 *
 * 用法:node tools/archive/_chk-required-trace.cjs [面板码]
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = process.argv[2] || 'RD_SOAK'

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q], { encoding: 'utf8' }).trim()

;(async () => {
  const lg = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const tk = lg.data ? lg.data.token : lg.token
  const H = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }
  const call = async (buttonName, formData) => {
    const r = await fetch(BASE + '/api/px/callButton', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: PANEL, buttonName, formData, buttonParam: {} }),
    })
    const t = await r.text()
    let j
    try { j = JSON.parse(t) } catch { j = { raw: t.slice(0, 300) } }
    return { status: r.status, body: j }
  }

  // 受控字段:必填的两个(文档编号/测试主题)刻意留空
  const mkHead = (no) => ({ 编号: no, 文档编号: '', 测试主题: '', 备注: 'trace' })

  const c = await call('新增', {})
  const no = c.body.data && c.body.data['编号']
  console.log('新建草稿 =', no)
  console.log('')

  console.log('=== ① 保存为草稿(必填留空)==='    )
  const d = await call('保存为草稿', mkHead(no))
  console.log(`  HTTP ${d.status}  ${JSON.stringify(d.body).slice(0, 220)}`)
  console.log('')

  console.log('=== ② 保存(必填留空,应被拦)==='    )
  const s = await call('保存', mkHead(no))
  console.log(`  HTTP ${s.status}  ${JSON.stringify(s.body).slice(0, 220)}`)
  console.log('')

  console.log('=== ③ 保存(必填补齐,应通过)==='    )
  const s2 = await call('保存', { 编号: no, 文档编号: 'DOC-TRACE-1', 测试主题: 'TRACE', 备注: 'trace' })
  console.log(`  HTTP ${s2.status}  ${JSON.stringify(s2.body).slice(0, 220)}`)
  console.log('')

  // 清理(硬删)
  sql(`DELETE FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}'`)
  sql(`DELETE FROM rd_soak_head WHERE 单据编号='${no}'`)
  sql(`DELETE FROM rd_soak_detail WHERE 单据编号='${no}'`)
  console.log('清理后残留 =', sql(`SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}'`))
})()
