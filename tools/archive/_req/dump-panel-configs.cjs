'use strict'
/* 调研用:拉取全部 RD_* 面板的真实下发配置(按钮分组/状态/字段数),作为"系统现状"证据。 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PANELS = ['RD_APPROVAL', 'RD_PLAN', 'RD_PROGRESS', 'RD_PROD_INFO', 'RD_PROD_DOCLIST', 'RD_SAMPLE_NO',
  'RD_SPEC_DOC', 'RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_INSP_PLAN', 'RD_CHANGE', 'RD_DOM_TEST',
  'RD_FILTER_EFF', 'RD_ALKALINE', 'RD_MINERAL', 'RD_ANTIBACT', 'RD_SCALE', 'RD_RO_PROTECT', 'RD_SOAK',
  'RD_DROP_PREC', 'RD_SPIKE_WATER', 'RD_EQUIP_USE', 'RD_INSTR_USE']

;(async () => {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败')
  const H = { Authorization: 'Bearer ' + token }
  const out = []
  for (const pc of PANELS) {
    const r = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${pc}`, { headers: H })).json()
    const d = r?.data
    if (!d) { out.push(`${pc}\t<取不到配置: ${JSON.stringify(r).slice(0, 120)}>`); continue }
    const bg = d.metadata?.buttonGroups || []
    const groups = bg.map((g) => `[${g.group || g.title || '?'}] ${(g.buttons || g.actions || []).map((b) => (b.name || b.buttonName || b)).join('/')}`)
    const pages = (d.metadata?.panelPageDto?.formPages || []).length
    const fields = (d.dataSchema?.fields || []).length
    const detail = (d.metadata?.panelPageDto?.tabPages || d.metadata?.tabPages || []).length
    out.push(`${pc}\t字段${fields}\t头页${pages}\t明细页${detail}\t按钮: ${groups.join(' | ')}`)
  }
  console.log(out.join('\n'))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
