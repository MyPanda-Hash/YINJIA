/**
 * flowSpec.test.js —— 「流程管控」链路规格的钉子(2026-10-16)
 *
 * 钉三件事:
 *   ① 链路/泳道/节点数量与用户给的流程图一致(生产 4 泳道、库存 4 泳道;两条链的关口节点一个不少)
 *   ② 每个节点的 ref 都能在服务端 FlowBoardService 的返回结构里取到值(契约不漂)
 *   ③ 状态分级规则:block 优先于 warn,再落到主数字(数字为 0 = 无在办,取不到 = 无数据)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHAINS, LEVEL_TEXT, allNodes, chainSummary, fmtNum, get, levelOf, metricsOf, routeOf } from './flowSpec.js'

const svc = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/FlowBoardService.java', import.meta.url), 'utf8')

/** 服务端 FlowBoardService 实际会产出的节点键(面板清单 + special 四块) */
const PANEL_NODES = (svc.match(/private static final List<String> PANEL_NODES = List\.of\(([\s\S]*?)\);/)?.[1] || '')
  .match(/"([A-Z_]+)"/g)?.map((s) => s.replace(/"/g, '')) || []
const SPECIAL = ['workorder', 'convert', 'schedule', 'warn']

test('链路与泳道结构与设计图一致:生产 4 段、库存 4 段', () => {
  assert.equal(CHAINS.length, 2, '两条主链:生产过程 / 库存流转')
  assert.deepEqual(CHAINS.map((c) => c.key), ['prod', 'stock'])
  for (const c of CHAINS) assert.equal(c.lanes.length, 4, `${c.name} 应为 4 段泳道`)
  assert.ok(allNodes().length >= 25, `节点数 ${allNodes().length} 偏少,疑似漏节点`)
})

test('流程关口节点一个不少(用户口径逐节点点名)', () => {
  const codes = new Set(allNodes().map((n) => n.code))
  for (const need of [
    'SO_ORDER', 'ORDER_CONVERT', 'WORK_ORDER_LIST', 'MATERIAL_OUT', 'SCHEDULE_BOARD', 'WORK_ORDER_BOARD',
    'LINE_LOAD', 'WO_REPORT', 'WO_COMPLETION_LIST', 'WO_REPORT_LIST', 'QC_FIRST_INSP', 'QC_PROC_INSP',
    'QC_ASM_INSP', 'QC_BHC', 'FINISH_IN',
    'PU_ORDER', 'QC_RECV', 'QC_INSP', 'QC_INSP_REC', 'QC_CATALOG', 'PURCHASE_IN', 'QC_RETURN', 'QC_TC_IN',
    'STOCK_DETAIL',
  ]) assert.ok(codes.has(need), `链路里缺节点 ${need}`)
})

test('每个节点的取数 ref 都落在服务端契约内(面板节点在 PANEL_NODES,special 只有四块)', () => {
  for (const n of allNodes()) {
    const refs = [n.main.ref, ...(n.subs || []).map((s) => s.ref), ...(n.warn || []), ...(n.block || [])]
      .filter(Boolean)
    for (const ref of refs) {
      const [head, key, field] = ref.split('.')
      if (head === 'nodes') {
        assert.ok(PANEL_NODES.includes(key), `${n.key} 引用了服务端不产出的面板节点 ${key}`)
      } else if (head === 'special') {
        assert.ok(SPECIAL.includes(key), `${n.key} 引用了未知 special 段 ${key}`)
      } else {
        assert.fail(`${n.key} 的 ref「${ref}」不是 nodes./special. 开头`)
      }
      assert.ok(field, `${n.key} 的 ref「${ref}」缺字段名`)
    }
  }
})

test('状态分级:block 压过 warn,再落到主数字;取不到数据 = na', () => {
  const node = { key: 'x', main: { label: 'm', ref: 'nodes.WO_REPORT.docs' }, block: ['nodes.WO_REPORT.pending'], warn: ['nodes.WO_REPORT.draft'] }
  const d = (docs, pending, draft) => ({ nodes: { WO_REPORT: { docs, pending, draft } } })
  assert.equal(levelOf(node, d(10, 2, 0)), 'block', '有待审核 = 阻断')
  assert.equal(levelOf(node, d(10, 0, 3)), 'warn', '有草稿积压 = 积压')
  assert.equal(levelOf(node, d(10, 0, 0)), 'ok', '有量且无卡点 = 通畅')
  assert.equal(levelOf(node, d(0, 0, 0)), 'idle', '零 = 无在办')
  assert.equal(levelOf(node, null), 'na', '整块没数据 = 无数据')
  assert.equal(levelOf({ key: 'y', main: { label: 'm', ref: 'nodes.WO_REPORT.docs' } }, d(null, 0, 0)), 'na', '主数字为 null = 无数据')
  assert.deepEqual(Object.keys(LEVEL_TEXT), ['block', 'warn', 'ok', 'idle', 'na'])
})

test('取数与展示:点路径取值、null 落「—」、整数千分位、小数一位', () => {
  const data = { nodes: { FINISH_IN: { docs: 1234, draft: null } }, special: { warn: { below: 3.14159 } } }
  assert.equal(get(data, 'nodes.FINISH_IN.docs'), 1234)
  assert.equal(get(data, 'nodes.FINISH_IN.draft'), null)
  assert.equal(get(data, 'nodes.NOPE.docs'), null)
  assert.equal(get(data, 'special.warn.below'), 3.14159)
  assert.equal(get(data, 'special.nope.x'), null)
  assert.equal(fmtNum(1234), '1,234')
  assert.equal(fmtNum(3.14159), '3.1')
  assert.equal(fmtNum(null), '—')
  const m = metricsOf(allNodes().find((n) => n.key === 'finishin'), data)
  assert.equal(m.main.text, '1,234')
  assert.equal(m.subs[0].text, '—', '待审核为 null ⇒ —')
})

test('空数据首屏不崩:data=null 时每个节点都能取指标且分级为 na', () => {
  // 2026-10-16 回归钉:视图在接口回来之前先渲染一帧(data=null),
  // 早先某个 text 处理器写了 d.special.x ⇒ render 抛 TypeError ⇒ 整块看板空白(vite dev 上实测)。
  for (const n of allNodes()) {
    const m = metricsOf(n, null)
    assert.equal(m.main.text, '—', `${n.key} 主数字应为 —`)
    for (const s of m.subs) assert.equal(s.text, '—', `${n.key} 的「${s.label}」应为 —`)
    assert.equal(levelOf(n, null), 'na', `${n.key} 应为无数据`)
  }
  assert.equal(chainSummary(CHAINS[0], null).total > 0, true)
})

test('链路汇总能点出阻断节点(顶部卡点条之外的链路级提示)', () => {
  const data = {
    nodes: { SO_ORDER: { docs: 5, pending: 0 } },
    special: { convert: { pendingRows: 7 }, workorder: { unassigned: 1 } },
  }
  const s = chainSummary(CHAINS[0], data)
  assert.ok(s.total > 0)
  assert.ok(s.levels.warn >= 2, `生产链至少 2 个积压节点,实际 ${JSON.stringify(s.levels)}`)
})

test('排产与领料:排产三节点必须排在「材料出库单」之前(先排产后领料)', () => {
  // 2026-10-18 用户口径:「先要完成排产才进入到领料,同时需要让当前的一个生产工单
  //   可以对应多个领料单据」—— 流程看板第二段必须是 排产 → 领料,不能倒过来。
  const lane = CHAINS[0].lanes.find((l) => l.key === 'release')
  assert.ok(lane, '生产链必须有 release 泳道')
  assert.equal(lane.name, '排产与领料', '泳道名改为「排产与领料」')
  const order = lane.nodes.map((n) => n.key)
  const at = (k) => order.indexOf(k)
  for (const k of ['schedule', 'board', 'lineload']) {
    assert.ok(at(k) >= 0 && at(k) < at('matout'), `${k} 必须排在 matout(材料出库单)之前,实际顺序 ${order.join(' → ')}`)
  }
  // 领料单的说明要写清「排产入线后才放行 + 一张工单行可开多张」,别再写"按工单行去重生成"
  const matout = lane.nodes.find((n) => n.key === 'matout')
  assert.match(matout.note, /排产入线后才放行/)
  assert.match(matout.note, /一张工单行可开多张/)
  assert.doesNotMatch(matout.note, /去重生成/)
})

test('当前卡点跳转:页面级面板必须走专页路由,不能拼成 /panelx/list/<code>', () => {
  // 2026-10-18 报障:「当前这上方的卡点转跳页面好像有问题,转跳的内容是……旧的生产工单」——
  //   气泡只传了 panelCode,前端一律拼 /panelx/list/<code>;而 ORDER_CONVERT / SCHEDULE_BOARD /
  //   WORK_ORDER_BOARD / WORK_ORDER_LIST 是**页面级**面板(yj_panel 无行)⇒ 落到空白面板壳。
  //   规格里节点声明的 route 才是唯一真源,routeOf() 就取它。
  const pagePanels = ['ORDER_CONVERT', 'SCHEDULE_BOARD', 'WORK_ORDER_BOARD', 'WORK_ORDER_LIST']
  for (const code of pagePanels) {
    const route = routeOf(code)
    assert.ok(route && route.startsWith('/prod/plan/'), `${code} 是页面级面板,必须跳专页,实际 ${route}`)
  }
  assert.equal(routeOf('ORDER_CONVERT'), '/prod/plan/orderConvert')
  assert.equal(routeOf('WORK_ORDER_LIST'), '/prod/plan/workOrderList')
  assert.equal(routeOf('SCHEDULE_BOARD'), '/prod/plan/scheduleBoard')
  assert.equal(routeOf('WORK_ORDER_BOARD'), '/prod/plan/workOrderBoard')
  assert.equal(routeOf('FINISH_IN'), '/panelx/list/FINISH_IN', '普通面板仍走面板路径')
  assert.equal(routeOf(''), null)

  // 服务端 blocks() 真正会产出的 panelCode 清单(读源码,防契约漂):每一个都必须有可跳转路由
  const blockCodes = [...svc.matchAll(/add\(out,\s*"[^"]+",\s*"[^"]+",\s*[^,]+,\s*"([A-Z_]+)"/g)].map((m) => m[1])
  assert.ok(blockCodes.length >= 8, `未从 FlowBoardService.blocks 解析到卡点面板清单,实际 ${blockCodes.length}`)
  for (const code of blockCodes) {
    const route = routeOf(code)
    assert.ok(route && route.startsWith('/'), `卡点 ${code} 没有可跳转的路由`)
    if (pagePanels.includes(code)) {
      assert.ok(route.startsWith('/prod/plan/'), `卡点 ${code} 必须跳专页,实际 ${route}`)
    }
  }
})
