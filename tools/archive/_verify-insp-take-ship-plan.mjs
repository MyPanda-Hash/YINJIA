/*
 * _verify-insp-take-ship-plan.mjs — 「成品检验单(及三张工序检验单)从出货检验计划取检验要求/检验方法/检查频率」实测
 * (2026-10-16,一次性探针,只读:不改库里任何数据)
 *
 * 验四件事(全部走 API,不依赖浏览器):
 *   ① 四张检验单的面板配置里都有「取出货检验计划」入口(2026-10-16 从"仅制程检验单"扩到四张);
 *   ② 组装成品检验单(QC_ASM_INSP)明细字段里有 检验要求 与 检查频率,且**没有** 标准要求(改名生效);
 *   ③ /api/qc/inspPlan/fromShipPlan 按产品编码取回计划明细,每行都带
 *      检验项目/检验要求/检验方法/检查频率(**一一对应**:计划表 4 行 → 4 行,逐行字段对得上);
 *   ④ 计划里没有的产品编码 → 200 + 空 rows(不算错,前端给业务话术)。
 *
 * 用法: node tools/archive/_verify-insp-take-ship-plan.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PRODUCT = 'C-84-02'          // rd_insp_plan_head.产品编号(IP-TEST-0001 那张计划)
const PRODUCT_NONE = 'NO-SUCH-PRODUCT-9999'

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json()).catch((e) => ({ err: e.message }))
if (!login.data?.token) { console.error('登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(1) }
const H = { Authorization: 'Bearer ' + login.data.token }
console.log(`登录 OK(${BASE})`)

/* ── ① 四张检验单的面板配置:`取出货检验计划` 入口 + 明细字段 ── */
const PANELS = ['QC_ASM_INSP', 'QC_MOLD_INSP', 'QC_CUT_INSP', 'QC_PROC_INSP']
const cfgOf = async (p) => (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${p}`, { headers: H }).then((r) => r.json())).data
const detailLabels = (cfg) => {
  const out = new Set()
  for (const tp of cfg?.metadata?.panelPageDto?.tablePages || []) {
    for (const gt of tp.gridTabs || []) {
      for (const f of gt.columns || []) {
        // columns 既可能是裸标签字符串,也可能是字段对象(两种都收)
        out.add(typeof f === 'string' ? f : (f.dataName || f.label || f.key))
      }
    }
  }
  return out
}
const actionsOf = (cfg) => {
  const out = []
  for (const g of cfg?.metadata?.buttonGroups || []) for (const a of g.actions || []) out.push(a)
  return out
}
for (const p of PANELS) {
  const cfg = await cfgOf(p)
  const acts = actionsOf(cfg)
  ok(`${p} 工具栏有「取出货检验计划」`, acts.includes('取出货检验计划'), acts.join(',').slice(0, 150))
}

/* ── ② 组装成品检验单(成品检验单)明细字段:检验要求 在、标准要求 不在、检查频率 在 ── */
{
  const cfg = await cfgOf('QC_ASM_INSP')
  const labels = detailLabels(cfg)
  ok('QC_ASM_INSP 明细有「检验要求」', labels.has('检验要求'))
  ok('QC_ASM_INSP 明细有「检验方法」', labels.has('检验方法'))
  ok('QC_ASM_INSP 明细有「检查频率」', labels.has('检查频率'))
  ok('QC_ASM_INSP 明细已无「标准要求」(改名生效)', !labels.has('标准要求'), [...labels].join(','))
}

/* ── ③ 取数:按产品编码取回计划明细,逐行字段一一对应 ── */
{
  const res = await fetch(`${BASE}/api/qc/inspPlan/fromShipPlan?productCode=${encodeURIComponent(PRODUCT)}`, { headers: H }).then((r) => r.json())
  const d = res.data || {}
  const rows = d.rows || []
  console.log(`   计划单号=${d.planNo} 版本=${d.version} 行数=${rows.length}`)
  ok('查到了该产品的出货检验计划', !!d.planNo, JSON.stringify(res).slice(0, 200))
  ok('计划明细非空', rows.length > 0, `${rows.length} 行`)
  const missing = rows.filter((r) => !String(r['检验项目'] || '').trim() || !String(r['检验方法'] || '').trim()
    || !String(r['检验要求'] || '').trim() || !String(r['检查频率'] || '').trim())
  ok('每行都带 检验项目/检验要求/检验方法/检查频率(一一对应,无缺列)', missing.length === 0,
    '缺列行数=' + missing.length + ' ' + JSON.stringify(missing).slice(0, 200))
  console.log('   取回明细:')
  for (const r of rows) {
    console.log(`     · [${r['表区']}] ${r['检验项目']} | 要求=${String(r['检验要求']).slice(0, 24)} | 方法=${String(r['检验方法']).slice(0, 24)} | 频率=${r['检查频率']}`)
  }
  // 计划表里的真值(IP-TEST-0001:外观-端盖两头 / 尺寸-外径 / 出货重量 / 余氯去除率)
  const items = rows.map((r) => r['检验项目'])
  ok('计划 4 项逐项取回(外观/尺寸/重量/余氯)', items.length === 4, items.join(' / '))
  ok('检验方法来自计划表「控制方法」(目视/卡尺/电子秤…)',
    rows.some((r) => /目视/.test(r['检验方法'])) && rows.some((r) => /卡尺/.test(r['检验方法'])),
    rows.map((r) => r['检验方法']).join(' / '))
  ok('检查频率来自计划表「检测频率」(1PCS/一个生产批次)', rows.some((r) => /1PCS/.test(r['检查频率'])))
}

/* ── ④ 没有计划的产品:200 + 空 rows(不是错误) ── */
{
  const res = await fetch(`${BASE}/api/qc/inspPlan/fromShipPlan?productCode=${encodeURIComponent(PRODUCT_NONE)}`, { headers: H }).then((r) => r.json())
  ok('无计划产品:返回 200 且 rows 为空', res.code === 200 && (res.data?.rows || []).length === 0 && !res.data?.planNo,
    JSON.stringify(res).slice(0, 200))
}

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
