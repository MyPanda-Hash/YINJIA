/**
 * _chk-required-behavior.cjs — 验证必填校验的分工:草稿放行、提交拦截
 *
 * 两条路径的行为差必须成立:
 *   · 保存为草稿 → 允许必填为空(存一半)
 *   · 保存/提交  → 必填为空时**拒绝**,并给出"XX不能为空"
 *
 * ⚠ 前端校验在浏览器里(见 _walk-required.cjs),本脚本查**后端**是否也拦:
 *   后端 save() 目前没有任何必填校验,只靠前端 —— 直连接口可绕过。
 *
 * 用法:node tools/archive/_chk-required-behavior.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = 'RD_SOAK'   // 必填:单据编号/单据日期/文档编号/测试主题

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
    return { status: r.status, body: await r.json() }
  }

  // 建一张空白草稿(必填全空)
  const c = await call('新增', {})
  const no = c.body.data && c.body.data['编号']
  console.log('新建空白草稿 =', no, '(文档编号/测试主题 均为空)')

  console.log('')
  console.log('=== 后端直连:必填为空时两条路径的表现 ===')
  const d = await call('保存为草稿', { 编号: no })
  console.log(`  保存为草稿 → HTTP ${d.status}  code=${d.body.code}  ${JSON.stringify(d.body.data || d.body.message)}`)
  const s = await call('保存', { 编号: no })
  console.log(`  保存       → HTTP ${s.status}  code=${s.body.code}  ${JSON.stringify(s.body.data || s.body.message)}`)

  console.log('')
  console.log('=== 判定 ===')
  const draftOk = d.status === 200 && d.body.code === 200
  const saveRejected = !(s.status === 200 && s.body.code === 200)
  console.log(`  ${draftOk ? '✓' : '✗'} 保存为草稿 放行(必填为空也可存)`)
  console.log(`  ${saveRejected ? '✓ 后端已拦' : '✗ 后端未拦(只靠前端校验,直连接口可绕过)'} 保存 对必填为空${saveRejected ? '拒绝' : '也放行'}`)
  if (!saveRejected) {
    console.log('      ⇒ 需补后端必填校验(否则绕过界面就能把缺必填的单提交/归档)')
  }

  // 清理
  const { execFileSync } = require('node:child_process')
  const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
    '-W', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q], { encoding: 'utf8' }).trim()
  sql(`DELETE FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}'`)
  sql(`DELETE FROM rd_soak_head WHERE 单据编号='${no}'`)
  sql(`DELETE FROM rd_soak_detail WHERE 单据编号='${no}'`)
  console.log('\n清理后残留 =', sql(`SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}'`))
})()
