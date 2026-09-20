/**
 * _chk-save-behavior.cjs — 验证「保存为草稿」与「保存」的真实差异(后端行为,不经界面)
 *
 * 用户要的两条路必须**真的不一样**,否则加了按钮也没意义:
 *   · 保存为草稿 → markSaved=false → 不归档、不送审,单据仍为「草稿」
 *   · 保存       → markSaved=true  → 归档面板上:管理员即归档 / 普通用户自动提交审批
 *
 * 做法:对同一张新建单分别走两条路径,读回 单据状态 与 archived_at / pending 比对。
 *
 * 用法:node tools/archive/_chk-save-behavior.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')

const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = 'RD_SOAK'   // 归档面板,且字段少、易建单

const sql = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '\t', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

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
    const j = await r.json()
    return { status: r.status, data: j.data, msg: j.message }
  }

  // ── 1. 新建一张空白草稿(directAdd 语义:传 新增) ──
  const created = await call('新增', {})
  const no1 = created.data && created.data['编号']
  console.log('① 新建草稿 =', no1, ' 状态 =', created.data && created.data['单据状态'])

  // ── 2. 走「保存为草稿」 ──
  const draft = await call('保存为草稿', { 编号: no1, 备注: 'probe-draft' })
  console.log('② 保存为草稿 →', draft.status, JSON.stringify(draft.data))

  // ── 3. 另建一张,走「保存」 ──
  const created2 = await call('新增', {})
  const no2 = created2.data && created2.data['编号']
  const save = await call('保存', { 编号: no2, 备注: 'probe-save' })
  console.log('③ 新建草稿 =', no2, ' → 保存 →', save.status, JSON.stringify(save.data))

  // ── 4. 读库比对 ──
  // ⚠ yj_doc_status **没有 status 列**:单据状态是后端按
  //   canceled > stopped > pending > archived 等标记**推导**出来的
  //   (见 ButtonService.docStatusOf 的推导注释)。故这里比对的是这些原始标记,
  //   而不是去查一个不存在的列(第一版就踩了:列名 'status' 无效)。
  console.log('')
  console.log('=== DB 侧状态标记比对 ===')
  const flags = (no) => {
    const row = sql(`SELECT ISNULL(pending,'-')+'|'+ISNULL(archived,'-')+'|'+ISNULL(canceled,'-')+'|'+ISNULL(stopped,'-')
      +'|'+ISNULL(CONVERT(varchar,archived_at,120),'-')+'|'+ISNULL(saved,'-')
      FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}'`)
    const [pending, archived, canceled, stopped, archivedAt, saved] = row.split('|')
    return { pending, archived, canceled, stopped, archivedAt, saved }
  }
  const f1 = flags(no1)
  const f2 = flags(no2)
  console.log(`  保存为草稿 ${no1}:`, JSON.stringify(f1))
  console.log(`  保存       ${no2}:`, JSON.stringify(f2))

  let bad = 0
  const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }
  console.log('')
  chk('「保存为草稿」未归档(archived ≠ Y)', f1.archived !== 'Y', f1.archived)
  chk('「保存为草稿」未归档时间戳(archived_at 空)', f1.archivedAt === '-', f1.archivedAt)
  chk('「保存为草稿」未送审(pending ≠ Y)', f1.pending !== 'Y', f1.pending)
  chk('「保存」(管理员)已归档(archived=Y)', f2.archived === 'Y', f2.archived)
  chk('「保存」写入归档时间戳', f2.archivedAt !== '-', f2.archivedAt)

  // 「保存为草稿」是否**真的落库**:去业务表读回备注。
  // ⚠ 不要用 saved 标记判断落库 —— saved='Y' 只表示"走过 保存/提交"路径,
  //   草稿路径刻意保持 saved='N'(前端 isFreshAddedDoc 据此界定"本次新增"窗口,
  //   离开守卫仍会提示"尚未保存"),见 ButtonService.markDocSaved 注释。第一版断言错在这。
  const note1 = sql(`SELECT ISNULL(备注,'(空)') FROM rd_soak_head WHERE 单据编号='${no1}'`)
  const note2 = sql(`SELECT ISNULL(备注,'(空)') FROM rd_soak_head WHERE 单据编号='${no2}'`)
  console.log('')
  console.log(`  业务表读回: 草稿单备注=${JSON.stringify(note1)}  提交单备注=${JSON.stringify(note2)}`)
  chk('「保存为草稿」确实落库(备注写进业务表)', note1 === 'probe-draft', note1)
  chk('「保存」也落库', note2 === 'probe-save', note2)

  // ── 5. 清理探针单据 ──
  // ⚠ 走「删除」按钮对**已归档**单只是提交删除申请(需管理员审批),不会真删 ⇒ 探针必须硬清,
  //    否则残留单会污染列表(第一版就是这样留下 2 条残留)。
  console.log('')
  console.log('=== 清理(硬删探针单,不走删除审批流)==='    )
  for (const no of [no1, no2]) {
    sql(`DELETE FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${no}'`)
  }
  // 业务行:RD_SOAK 是头行式(head + detail);两张表都按单据编号清
  const headTbl = sql(`SELECT name FROM sys.tables WHERE name='rd_soak_head'`)
  if (headTbl) sql(`DELETE FROM rd_soak_head WHERE 单据编号 IN ('${no1}','${no2}')`)
  const detTbl = sql(`SELECT name FROM sys.tables WHERE name='rd_soak_detail'`)
  if (detTbl) sql(`DELETE FROM rd_soak_detail WHERE 单据编号 IN ('${no1}','${no2}')`)
  const left = sql(`SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no IN ('${no1}','${no2}')`)
  console.log('  清理后 yj_doc_status 残留 =', left)
  console.log('  head 残留 =', headTbl ? sql(`SELECT COUNT(*) FROM rd_soak_head WHERE 单据编号 IN ('${no1}','${no2}')`) : '(无该表)')
  if (left !== '0') bad++

  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 两条保存路径行为确实不同')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
