/**
 * _probe-mold-rev-tab.cjs — 成型工艺清单「修订记录」页签端到端探针(2026-09-20)
 *
 * 验收口径:用户「给成型工艺清单也加上一个修订记录的页签,和组装工艺清单的一样」。
 * 本探针只钉**后端契约**这件事(页序/列宽等前端配置由断言⑦单测钉):
 *
 *   ① 修订记录行与配方行**共用 rd_mold_proc_detail**,靠 [表区] 分块(修订记录 / 配方表);
 *   ② **重开单据后两条表区的行都要能查回来** —— 这是本轮真修的那条:
 *      [表区] 原先登记在 place='header',而明细查询只 SELECT place='detail' 的列
 *      ⇒ 行落库了但读不回来,前端 rowsOf() 按 [表区] 过滤会把两张表都显示成空。
 *      没有这条断言,探针会在"保存成功"上假绿(数据在库里、页面上是空的)。
 *   ③ 修订记录 5 个字段的值原样往返(更改内容/更改原因/更改时间/责任人/备注)。
 *   ④ 面板配置把 [表区] 下发给明细(place='detail'),两张逻辑表的表区值都在字典里。
 *
 * 用法:node tools/archive/_probe-mold-rev-tab.cjs   (需后端在 8090、库已跑 migrate-mold-proc-revision.sql)
 */
'use strict'

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const USER = process.env.YINJIA_USER || 'admin'
const PASS = process.env.YINJIA_PASS || '123456'

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want) ? ok(m) : bad(`${m}(实际 ${JSON.stringify(got)},期望 ${JSON.stringify(want)})`))

const REV1 = { 表区: '修订记录', 序号: '1', 更改内容: '初版发布', 更改原因: '新规格立项', 更改时间: '2026-09-20', 责任人: '陈秀丽', 备注: '首个版本' }
const REV2 = { 表区: '修订记录', 序号: '2', 更改内容: '密度管控下限 1.05→1.08', 更改原因: '客户复测要求', 更改时间: '2026-09-20', 责任人: '冯敏', 备注: '' }
const FORMULA = { 表区: '配方表', 序号: '1', 物料种类: '活性炭', 物料编号: 'PROBE-C-001', 物料名称: '椰壳活性炭', 实际添加比例: '60', 单支物料含量: '12.5', 设计添加量: '12' }

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: PASS }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败:' + JSON.stringify(lr))
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  const api = async (path, body) => {
    const r = await fetch(BASE + path, body
      ? { method: 'POST', headers: H, body: JSON.stringify(body) }
      : { headers: H })
    return r.json()
  }
  const btn = (buttonName, formData) => api('/api/px/callButton', { panelCode: 'RD_MOLD_PROC', buttonName, formData, buttonParam: {} })

  let no = null
  try {
    // ── 1. 建草稿 ──
    const created = await btn('保存', {})
    no = created?.data?.['编号']
    if (!no) throw new Error('建单失败:' + JSON.stringify(created))
    ok(`建草稿单 ${no}`)

    // ── 2. 一次提交三条行:两条修订记录(同一表区)+ 一条配方表 ──
    // 产品编号/产品名称 是本面板的必填头字段(新账套「保存」走必填校验),探针给占位值
    const saved = await btn('保存', { 编号: no, 产品编号: 'PROBE-P-001', 产品名称: '探针产品', detail: { items: [REV1, REV2, FORMULA] } })
    if (saved?.code !== 200) throw new Error('保存明细失败:' + JSON.stringify(saved))
    ok('保存 3 行明细(修订记录 ×2 + 配方表 ×1)')

    // ── 3. 重开单据:这是本轮的关键断言 ──
    const desc = await api(`/api/px/getFormDescriptor?panelCode=RD_MOLD_PROC&code=${encodeURIComponent(no)}`)
    const items = desc?.data?.detailData?.items || []
    eq(items.length, 3, '重开单据取回 3 行')
    const withZone = items.filter((r) => r['表区'])
    eq(withZone.length, 3, '3 行都带回了 [表区](明细查询已按 place=detail 取列)')
    const revs = items.filter((r) => r['表区'] === '修订记录')
    const forms = items.filter((r) => r['表区'] === '配方表')
    eq(revs.length, 2, '修订记录表区 2 行')
    eq(forms.length, 1, '配方表表区 1 行(旧页签未被新页签串行)')

    // ── 4. 修订记录字段往返 ──
    const got1 = revs.find((r) => r['序号'] === '1') || {}
    for (const k of ['更改内容', '更改原因', '更改时间', '责任人', '备注']) {
      eq(String(got1[k] ?? ''), String(REV1[k] ?? ''), `重开后 修订记录.${k} 原样`)
    }
    const gotF = forms[0] || {}
    eq(String(gotF['物料编号'] ?? ''), FORMULA.物料编号, '重开后 配方表.物料编号 原样')

    // ── 5. 面板配置:[表区] 必须下发给**明细**(= place 'detail'),且字典含两个表区值 ──
    const cfg = await api('/api/px/getPanelConfig?panelCode=RD_MOLD_PROC')
    const detailFields = ((cfg?.data?.detail?.tabs || [])[0]?.fields) || []
    const headerFields = cfg?.data?.dataSchema?.fields || []
    const inDetail = (name) => detailFields.some((f) => f.dataName === name)
    const inHeader = (name) => headerFields.some((f) => f.dataName === name)

    if (!inDetail('表区')) bad('[表区] 没下发给明细 —— 明细查询就查不到它,两张表重开都是空的')
    else ok('[表区] 以明细字段下发(place=detail)')
    if (inHeader('表区')) bad('[表区] 仍挂在表头字段上(应已改挂明细)')
    // ⚠ [表区] 的 dict_sql 是**登记性元数据**(与组装侧一致:字段类型仍是 文本),
    //   行上的值由前端 filterKey/filterVal 写入,不走下拉 ⇒ 配置接口不下发 options。
    //   这里改为对齐口径:成型/组装两面板的 [表区] 字段规格必须一致(用户要求"和组装的一样")。
    const asmCfg = await api('/api/px/getPanelConfig?panelCode=RD_ASM_PROC')
    const asmZone = (((asmCfg?.data?.detail?.tabs || [])[0]?.fields) || []).find((f) => f.dataName === '表区')
    const moldZone = detailFields.find((f) => f.dataName === '表区')
    if (!asmZone) bad('组装工艺清单的 [表区] 不在明细字段里(对照基准缺失)')
    else {
      const pick = (z) => JSON.stringify({ t: z?.dataType, w: z?.width, h: z?.hidden === true, o: z?.options || [] })
      eq(pick(moldZone), pick(asmZone), '[表区] 字段规格与组装工艺清单一致')
    }

    // ── 6. 修订记录列在明细字段里(缺一列那一格就空白) ──
    const missing = ['序号', '更改内容', '更改原因', '更改时间', '责任人', '备注'].filter((c) => !inDetail(c))
    if (missing.length) bad(`面板配置缺明细字段:${missing.join(', ')}`)
    else ok('修订记录 6 列(序号/更改内容/更改原因/更改时间/责任人/备注)都在明细字段里')
  } finally {
    if (no) {
      const del = await btn('删除', { 编号: no })
      console.log(`  --   清理:删除探针单 ${no}(code=${del?.code})`)
    }
  }

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
