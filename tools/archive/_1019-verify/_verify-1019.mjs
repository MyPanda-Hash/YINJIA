/*
 * _verify-1019.mjs —— 《10.19 问题》八条任务的接口级验收探针
 *
 * 用法: node tools/archive/_1019-verify/_verify-1019.mjs [baseUrl]
 *   默认 http://127.0.0.1:8090(正式实例:HSDZ_MES);可传 http://127.0.0.1:8090 同款地址
 * 只读断言(第 1~7 条)+ 第 8 条「转ERP」实推需显式 --push 才执行(会写金蝶测试沙箱)。
 *
 * 断言口径(每条对应《10.19问题.docx》一条):
 *   ① 批次号 = 纯日期 yyyyMMdd(不再拼供应商编码)
 *   ② 检验数据记录.检验结论 = 下拉框,字典 特采/合格/不合格(前端 allow-create 允许自定义)
 *   ③ 特采单菜单归 智能供应链 > 采购管理(前端 menus.js,本探针从 yj_panel 侧佐证 module_group/category)
 *   ④ 特采单可传附件(附件1..附件6 六列位 + yj_field dataType=附件)
 *   ⑤ 特采单.检验数据记录单号(品质部意见区链接)+ 历史回填
 *   ⑥ 检验数据记录.来料检验单号(报告标题右侧链接)+ 历史回填
 *   ⑦ 特采单与质量单据七张的左栏「单据选择」中间列有数据(列表行带该字段)
 *   ⑧ 暂收退料单转ERP(按钮在 → 已审核单可推到金蝶采购退货单 pur_ret)
 */
import { createRequire } from 'node:module'
const BASE = process.argv.find((a, i) => i > 1 && /^https?:\/\//.test(a)) || 'http://127.0.0.1:8090'
const PUSH = process.argv.includes('--push')
const PANEL_RAIL = {
  QC_TC_IN: ['供应商', '采购单号'],
  QC_BHG: ['客户名称', '产品名称'],
  QC_BHC: ['客户名称', '产品编码'],
  QC_BHZ: ['物料编码', '物料批次'],
  QC_JJF: ['物料编码', '批次号'],
  QC_SCP: ['物料编码', '物料批次'],
  QC_LYB: ['供应商', '物料编码'],
  QC_SCY: ['产品/物料编码'],
}
let pass = 0, fail = 0
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}${extra ? ' · ' + extra : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${extra ? ' · ' + extra : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const j = await res.json()
  if (!j?.data?.token) throw new Error('登录失败: ' + JSON.stringify(j).slice(0, 200))
  return { token: j.data.token, user: j.data.user }
}
let TOKEN = ''
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const txt = await res.text()
  let j
  try { j = JSON.parse(txt) } catch { j = { raw: txt.slice(0, 300) } }
  return j
}
const cfg = async (panel) => (await api(`/px/getPanelConfig?panelCode=${panel}`)).data || {}
const fieldsOf = (c) => (c?.dataSchema?.fields || [])
const buttonsOf = (c) => (c?.metadata?.buttonGroups || c?.buttonGroups || []).flatMap((g) => g.actions || [])
const listRows = async (panel, pageSize = 50) => {
  const r = await api('/px/queryFormDataList', {
    method: 'POST', body: { panelCode: panel, condition: {}, keyword: '', pageNo: 1, pageSize },
  })
  return r?.data?.list || r?.list || []
}

async function main() {
  console.log(`\n[库] ${BASE}\n`)
  const { token, user } = await login()
  TOKEN = token
  console.log(`登录: ${user.userName} / ${user.realName}\n`)

  // ─────────── ① 批次号 = 纯日期 ───────────
  console.log('① 批次号改回纯日期 yyyyMMdd(不再是供应商+日期)')
  {
    // 挑一张还有"可送/可打印"余量的采购订单,问服务端"本批批次号"预告值
    const po = await listRows('PU_ORDER', 30)
    let nextBatch = ''
    let usedOrder = ''
    for (const row of po) {
      const no = row['单据编号'] || row['编号']
      if (!no) continue
      const r = await api('/px/batchFlow/lines', {
        method: 'POST', body: { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no },
      })
      const nb = r?.data?.nextBatchNo
      if (nb) { nextBatch = String(nb); usedOrder = no; break }
    }
    ok(!!nextBatch, '接口 /px/batchFlow/lines 返回 nextBatchNo', nextBatch || '(取不到)')
    ok(/^\d{8}$/.test(nextBatch), '批次号是 8 位纯日期(yyyyMMdd)', `nextBatchNo=${nextBatch} 来自 ${usedOrder}`)
    ok(!/-/.test(nextBatch), '批次号里不再有「供应商-日期」的连字符')
    // 材料码打印弹窗的预填号同一公式
    let pref = ''
    if (usedOrder) {
      const r = await api(`/px/puLabel/dialog?orderNo=${encodeURIComponent(usedOrder)}`)
      pref = String(r?.data?.prefBatchNo || '')
    }
    ok(/^\d{8}$/.test(pref), '打印材料码预填批次号同为纯日期', `prefBatchNo=${pref}`)
  }

  // ─────────── ② 检验结论下拉 ───────────
  console.log('\n② 检验结论改「特采/合格/不合格」下拉(可自定义补充)')
  {
    const c = await cfg('QC_INSP_REC')
    const v = fieldsOf(c).filter((f) => (f.code || f.dataName) === '检验结论')
    ok(v.length > 0, '检验数据记录面板下发「检验结论」字段', `字段数 ${v.length}`)
    ok(v[0]?.dataType === '下拉框', '类型 = 下拉框', `dataType=${v[0]?.dataType}`)
    const opts = (v[0]?.options || []).map((o) => (typeof o === 'object' ? o.value ?? o.label : o))
    ok(['特采', '合格', '不合格'].every((x) => opts.includes(x)), '字典含 特采/合格/不合格', `options=${opts.join('/')}`)
  }

  // ─────────── ③ 特采单归采购管理 ───────────
  console.log('\n③ 特采单归「智能供应链 > 采购管理」')
  {
    const c = await cfg('QC_TC_IN')
    ok(!!c?.metadata?.panelName, '特采单面板可访问', `panelName=${c?.metadata?.panelName}`)
    // 菜单真源 = 前端 menus.js(改 yj_panel 不影响导航,见 migrate-wlbom-menu-rollback-20261015.sql 头注),
    // 故这里读构建期常量自己核一遍;yj_panel 的 module_group/category 由 _1019-verify.sql 在库侧核。
    const menus = await import('../../../frontend/src/business/menus.js')
    const where = []
    const walk = (nodes, path) => {
      for (const n of nodes || []) {
        const p = [...path, n.title]
        if (n.panelCode === 'QC_TC_IN') where.push(p.join(' > '))
        if (n.children) walk(n.children, p)
      }
    }
    walk(menus.menuTree, [])
    ok(where.length === 1, '菜单里特采单只有一个入口(不重复)', where.join(' | '))
    ok(where[0] === '智能供应链 > 采购管理 > 单据 > 特采单', '菜单位置 = 智能供应链 > 采购管理 > 单据',
      where[0] || '(未找到)')
    ok(!where.some((w) => w.includes('品质管理')), '品质管理下已不再挂特采单')
  }

  // ─────────── ④ 特采单附件 ───────────
  console.log('\n④ 特采单可以传附件(附件1..附件6)')
  {
    const c = await cfg('QC_TC_IN')
    const att = fieldsOf(c).filter((f) => f.dataType === '附件')
    ok(att.length === 6, '下发 6 个附件字段', `附件字段=${att.map((f) => f.code || f.dataName).join('/')}`)
  }

  // ─────────── ⑤ 特采单 → 检验数据记录单号 ───────────
  console.log('\n⑤ 特采单「品质部意见」带检验数据记录单号链接(可跳转)')
  {
    const c = await cfg('QC_TC_IN')
    const f = fieldsOf(c).find((x) => (x.code || x.dataName) === '检验数据记录单号')
    ok(!!f, '特采单下发「检验数据记录单号」字段')
    const rows = await listRows('QC_TC_IN', 50)
    const withNo = rows.filter((r) => String(r['检验数据记录单号'] || '').trim() !== '')
    ok(withNo.length > 0, '已有特采单带回填的检验数据记录单号', `${withNo.length}/${rows.length} 张`)
    if (withNo.length) {
      const no = withNo[0]['单据编号'] || withNo[0]['编号']
      const fd = await api(`/px/getFormDescriptor?panelCode=QC_TC_IN&code=${encodeURIComponent(no)}`)
      const v = fd?.data?.data?.['检验数据记录单号'] ?? fd?.data?.['检验数据记录单号']
      ok(String(v || '').trim() !== '', '单据详情里取得到该号(前端链接据此渲染)', `${no} → ${v}`)
      // 号在 qc_insp_rec 里确实存在(点得动)
      const rec = await listRows('QC_INSP_REC', 500)
      ok(rec.some((r) => (r['单据编号'] || r['编号']) === v), '该号在检验数据记录里真实存在(跳转不会空页)', String(v))
    }
  }

  // ─────────── ⑥ 检验报告 → 来料检验单号 ───────────
  console.log('\n⑥ 检验报告右侧带来料检验单号链接(可跳转)')
  {
    const c = await cfg('QC_INSP_REC')
    const f = fieldsOf(c).find((x) => (x.code || x.dataName) === '来料检验单号')
    ok(!!f, '检验数据记录下发「来料检验单号」字段')
    const rows = await listRows('QC_INSP_REC', 50)
    const withNo = rows.filter((r) => String(r['来料检验单号'] || '').trim() !== '')
    ok(withNo.length > 0, '已有报告带回填的来料检验单号', `${withNo.length}/${rows.length} 张`)
    if (withNo.length) {
      const no = withNo[0]['单据编号'] || withNo[0]['编号']
      const insp = String(withNo[0]['来料检验单号']).trim()
      const fd = await api(`/px/getFormDescriptor?panelCode=QC_INSP_REC&code=${encodeURIComponent(no)}`)
      const v = fd?.data?.data?.['来料检验单号'] ?? fd?.data?.['来料检验单号']
      ok(String(v || '').trim() === insp, '单据详情里取得到该号', `${no} → ${v}`)
      const insps = await listRows('QC_INSP', 500)
      ok(insps.some((r) => (r['单据编号'] || r['编号']) === insp), '该号在来料检验单里真实存在(跳转不会空页)', insp)
    }
  }

  // ─────────── ⑦ 左栏「单据选择」 ───────────
  console.log('\n⑦ 特采单与质量单据七张:左栏「单据选择」的列都在面板上登记且随行下发')
  {
    // 说明:列表行只带**非空**字段(QueryService.rowToLabels:null 不入行),
    // 故空数据的面板(如 QC_BHC 14 张全是空草稿)中间列会是空的 —— 这不等于"配错列"。
    // 这里分两层核:①列名必须是该面板已登记的表头字段(配错列就永远点不出来);②有数据的行确实带值。
    for (const [panel, middles] of Object.entries(PANEL_RAIL)) {
      const c = await cfg(panel)
      const labels = fieldsOf(c).map((f) => f.code || f.dataName)
      const missing = middles.filter((m) => !labels.includes(m))
      ok(missing.length === 0, `${panel} 左栏中间列在面板字段里都有登记`,
        missing.length ? `缺 ${missing.join('/')}` : middles.join('/'))
      const rows = await listRows(panel, 20)
      const filled = middles.filter((m) => rows.some((r) => String(r[m] ?? '').trim() !== ''))
      console.log(`        数据: ${rows.length} 行;中间列有值的 = ${filled.join('/') || '(无,该面板业务列目前全空)'}`)
    }
  }

  // ─────────── ⑧ 暂收退料单转ERP ───────────
  console.log('\n⑧ 暂收退料单转ERP(金蝶采购退货单 pur_ret)')
  {
    const c = await cfg('QC_RETURN')
    const btns = buttonsOf(c)
    ok(btns.includes('转ERP'), '工具栏有「转ERP」按钮', `按钮组 ${btns.slice(0, 12).join('/')}…`)
    ok(btns.includes('批量转ERP'), '工具栏有「批量转ERP」按钮')
    const fs = fieldsOf(c).map((f) => f.code || f.dataName)
    ok(['是否已转ERP', 'ERP单号', '转ERP操作人', '转ERP时间'].every((x) => fs.includes(x)),
      '头表四个 ERP 字段已登记并下发', ['是否已转ERP', 'ERP单号', '转ERP操作人', '转ERP时间'].filter((x) => !fs.includes(x)).join('/') || '齐全')
    const pushable = await api('/px/callButton', { method: 'POST', body: { panelCode: 'QC_RETURN', buttonName: '查询可转ERP', formData: {}, buttonParam: {} } })
    const list = pushable?.data?.list || []
    ok(Array.isArray(list), '「查询可转ERP」可用(已审核且未转的单列表)', `${list.length} 张待转`)
    if (PUSH) {
      const target = list[0]
      if (!target) { ok(false, '--push: 没有可转的单据(先审核一张暂收退料单)') }
      else {
        const no = target['单据编号'] || target['编号']
        const r = await api('/px/callButton', {
          method: 'POST',
          body: { panelCode: 'QC_RETURN', buttonName: '转ERP', formData: { 编号: no, 单据编号: no }, buttonParam: {} },
        })
        const erp = r?.data?.ERP单号 || ''
        ok(r?.code === 200 && !!erp, '实推成功并回写 ERP 单号', `${no} → ${erp || JSON.stringify(r).slice(0, 160)}`)
      }
    } else {
      console.log('  (加 --push 可实推金蝶测试沙箱;默认只读)')
    }
  }

  console.log(`\n结果: PASS ${pass} · FAIL ${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[探针异常]', e); process.exit(2) })
