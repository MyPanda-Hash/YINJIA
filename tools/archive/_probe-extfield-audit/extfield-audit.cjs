/**
 * 研发/全库「字段管理」(动态字段·备用列池)可用性审计 —— 只读
 *
 * 背景(2026-10-16 用户口径「检测一遍研发管理里面的面板的字段编辑功能是否完善可用」):
 * 逐面板调 `GET /api/px/extFields`(前端「字段管理」对话框打开时的唯一一次调用),记录
 * 容量/已用/空闲/脏行/报错,并挑出真正让功能不可用的情形。
 *
 * 当时查出 3 张 RD 面板不可用,两条根因:
 *   ① RD_SHARE_FILE:承载表 yj_share_file **没有预置 备用1..20** ⇒ 后端逐列
 *      `SELECT COUNT(*) FROM [表] WHERE [备用N] IS NOT NULL` 第 1 列就打炸 → 500
 *      → 界面弹「Request failed with status code 500」并自动关闭对话框。
 *   ② RD_ASM_BOM / RD_MOLD_FORMULA:yj_panel 指向的 rd_asm_bom_* / rd_mold_formula_* 表
 *      在 2026-09-11 合并清理时已被 DROP(这两个面板菜单也早已下线)。
 *
 * 修法(用户 2026-10-16 选定):后端对"表里没有备用列"改为下发空池 + poolAvailable:false(不再 500),
 * 前端据此给出明确提示;另给 yj_share_file 预置 备用1..20,让共享文件库真能加自定义字段。
 *
 * 用法:
 *   node extfield-audit.cjs [ledger]            # ledger ∈ prod|test,默认 prod
 *   node extfield-audit.cjs prod --assert       # 契约断言(建议进回归):全 200 + 无池面板给明确契约
 */
const path = require('node:path')

const API = process.env.MES_API || 'http://127.0.0.1:8090/api'
const LEDGER = (process.argv[2] || 'prod') === 'test' ? 'YJ_TEST' : 'YJ_FORMAL'
const ASSERT = process.argv.includes('--assert')
/** 承载表**没有**备用列池的面板(durable 契约样本:用它钉住"无池不报 500") */
const NO_POOL_PANELS = ['QC_FIN_SPEC']
/** 研发管理 26 张(仅在本脚本里用于逐面板报告) */
const RD_PANELS = ['RD_ALKALINE', 'RD_ANTIBACT', 'RD_APPROVAL', 'RD_ASM_BOM', 'RD_ASM_PROC', 'RD_CHANGE',
  'RD_DOM_TEST', 'RD_DROP_PREC', 'RD_EQUIP_USE', 'RD_FILTER_EFF', 'RD_INSP_PLAN', 'RD_INSTR_USE',
  'RD_MINERAL', 'RD_MOLD_FORMULA', 'RD_MOLD_PROC', 'RD_PLAN', 'RD_PROD_DOCLIST', 'RD_PROD_INFO',
  'RD_PROGRESS', 'RD_RO_PROTECT', 'RD_SCALE', 'RD_SHARE_FILE', 'RD_SINTER_TOL', 'RD_SOAK',
  'RD_SPEC_DOC', 'RD_SPIKE_WATER', 'QC_FIN_SPEC']
/** 表不存在的下线面板:数据本身取不到(面板 500),但「字段管理」不得再 500 */
const RETIRED_PANELS = ['RD_ASM_BOM', 'RD_MOLD_FORMULA']

let fails = 0
const chk = (name, ok, detail) => {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${name}${detail === undefined ? '' : '  → ' + detail}`)
  if (!ok) fails++
}

async function main() {
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: LEDGER }),
  })
  const tok = (await lr.json())?.data?.token
  if (!tok) throw new Error('登录失败')
  const H = { Authorization: 'Bearer ' + tok }

  console.log(`账套=${LEDGER}  面板=${RD_PANELS.length}  接口=${API}\n`)
  const rows = []
  for (const p of RD_PANELS) {
    const res = await fetch(`${API}/px/extFields?panel=${p}`, { headers: H })
    let body = null
    try { body = await res.json() } catch { body = null }
    const d = body?.data
    const line = Array.isArray(d?.linePool) ? d.linePool : []
    const head = Array.isArray(d?.headPool) ? d.headPool : []
    const free = (pool) => pool.filter((x) => !x.bound).length
    const dirty = [...line, ...head].filter((x) => !x.bound && (x.dirtyRows || 0) > 0)
    rows.push({
      panel: p, http: res.status, code: body?.code, msg: body?.message,
      capacity: d?.capacity, poolAvailable: d?.poolAvailable,
      fieldCount: (d?.fields || []).length,
      hasHeadPool: !!d?.headPool, linePool: line.length, headPool: head.length,
      lineFree: free(line), headFree: free(head),
      dirtyFree: dirty.length, dirtyCols: dirty.map((x) => `${x.col}:${x.dirtyRows}`).join(','),
      fields: (d?.fields || []).map((f) => `${f.label}(${f.col}/${f.dataType}/${f.place})`).join(' '),
    })
  }

  for (const r of rows) {
    const err = r.http !== 200 || r.code !== 200
    const noPool = r.poolAvailable === false || ((r.linePool || 0) === 0 && (r.headPool || 0) === 0)
    const tag = err ? '✗ 报错' : noPool ? '! 无备用列池' : '✓'
    console.log(`${tag.padEnd(12)} ${r.panel.padEnd(16)} http=${r.http} 容量=${r.capacity} poolAvailable=${r.poolAvailable} 自定义=${r.fieldCount} 明细池=${r.lineFree}free/${r.linePool} 表头池=${r.hasHeadPool ? r.headFree + 'free/' + r.headPool : '—'} 空闲列脏行=${r.dirtyFree}${r.dirtyCols ? '(' + r.dirtyCols + ')' : ''}${r.msg ? ' msg=' + r.msg : ''}`)
    if (r.fields) console.log(`${''.padEnd(12)}   └ 已有自定义字段: ${r.fields}`)
  }
  require('node:fs').writeFileSync(path.join(process.env.TEMP, 'mes-extfield-audit', `extfield-${LEDGER}.json`).replace(/mes-extfield-audit/, 'mes-ann2'), JSON.stringify(rows, null, 1))

  // ── 契约断言 ──
  console.log('\n契约断言:')
  const errs = rows.filter((r) => r.http !== 200 || r.code !== 200)
  chk('研发面板的「字段管理」接口一律不报 500(表不存在也只下发空池)',
    errs.length === 0, errs.map((r) => `${r.panel}:${r.http} ${String(r.msg || '').slice(0, 60)}`).join(' | ') || '全部 200')
  for (const p of NO_POOL_PANELS) {
    const r = rows.find((x) => x.panel === p)
    chk(`${p}(承载表未预置备用列)必须给出 poolAvailable=false + 空池,而不是报错`,
      r && r.http === 200 && r.poolAvailable === false && r.linePool === 0 && r.headPool === 0,
      r ? `http=${r.http} poolAvailable=${r.poolAvailable} linePool=${r.linePool} headPool=${r.headPool}` : '未取到')
  }
  const share = rows.find((x) => x.panel === 'RD_SHARE_FILE')
  chk('RD_SHARE_FILE(共享文件库)可用:要么有池能加字段,要么明确告知无池',
    share && share.http === 200, share ? `poolAvailable=${share.poolAvailable} 明细池=${share.lineFree}free/${share.linePool}` : '未取到')
  for (const p of RETIRED_PANELS) {
    const r = rows.find((x) => x.panel === p)
    chk(`${p}(已下线面板)的字段管理接口不报 500`, r && r.http === 200, r ? `http=${r.http} poolAvailable=${r.poolAvailable}` : '未取到')
  }
  console.log(fails ? `\n${fails} 项未通过` : '\n全部通过')
  process.exit(ASSERT && fails ? 1 : 0)
}
main().catch((e) => { console.error('审计异常:', e); process.exit(2) })
