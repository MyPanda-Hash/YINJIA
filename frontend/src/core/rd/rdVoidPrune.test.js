/**
 * rdVoidPrune.test.js —— 已作废/删除的研发单据必须从「项目流程管控」「项目进度查询」里消失(2026-10-30)
 *
 * 【需求来源·用户原文】
 *   「我服务器上已经把这个213项目的立项申请和项目实施计划删掉了，但是现在还出现在项目进度查询，
 *    以及项目流程管控那些已经弃审废弃删除的单据流程就不需要再追踪了，现在还能看到，而且删除不了」
 *
 * 【根因】作废/删除单据时 ButtonService.voidDoc 只写 yj_doc_status.canceled='Y'，
 *   **不动业务表的 asp_cancel**。而下面四处只按 asp_cancel 判活 ⇒ 已作废的单据一律被当成还活着：
 *     ① RdProjectFlowService.query  —— 立项申请列表
 *     ② RdProjectFlowService.plansByDocNo —— 实施计划
 *     ③ ButtonService.pruneProgressRows —— 进度行孤儿清理(live 集合把作废单算了进去 ⇒ 永远不清)
 *     ④ ButtonService.voidDoc —— 作废后根本没有触发清理
 *   界面表现就是「删了还在，还删不掉」(项目进度查询是只读面板，本来就不给人工删)。
 *
 * 【为什么用源码断言】判活口径分散在 4 处 SQL 里，mount 端到端成本过高；而这类回归的典型形态
 *   就是「有人把某一段过滤删了/改回只按 asp_cancel」——源码断言正好钉住每条判活口径。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../../../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

const flowSvc = read('backend/src/main/java/com/yinjia/mes/service/RdProjectFlowService.java')
const buttonSvc = read('backend/src/main/java/com/yinjia/mes/service/ButtonService.java')
const dashSvc = read('backend/src/main/java/com/yinjia/mes/service/DashboardStatsService.java')

/** 取某个方法/长字符串片段的源码(找不到返回空串，让断言失败而不是抛错) */
function slice(src, from, to, len = 4000) {
  const i = src.indexOf(from)
  if (i < 0) return ''
  const j = to ? src.indexOf(to, i + from.length) : -1
  return src.slice(i, j > i ? j : i + len)
}

test('① 项目流程管控：已作废(canceled=Y)的立项申请不进清单', () => {
  const seg = flowSvc.slice(flowSvc.indexOf('FROM rd_approval'))
  assert.ok(seg, 'RdProjectFlowService 的立项取数片段要能找到')
  assert.match(
    seg.slice(0, 700),
    /yj_doc_status/,
    '立项取数只按 asp_cancel 判活 ⇒ 已作废的单据仍被当成活着（界面「删了还在」的根因）',
  )
  assert.match(seg.slice(0, 700), /canceled/, '必须判 yj_doc_status.canceled')
  assert.match(seg.slice(0, 700), /'RD_APPROVAL'|N'RD_APPROVAL'/, '状态行要按面板 RD_APPROVAL 定位')
})

test('② 项目流程管控：已作废的实施计划不进清单', () => {
  const seg = slice(flowSvc, 'private Map<String, List<Map<String, Object>>> plansByDocNo(', 'for (Map<String, Object> r : rows)', 3000)
  assert.ok(seg, 'plansByDocNo 要能找到')
  assert.match(seg, /FROM rd_plan WHERE/, '实施计划取数要能找到')
  assert.match(seg, /yj_doc_status/, '实施计划取数只按 asp_cancel 判活 ⇒ 已作废的计划仍被当成活着')
  assert.match(seg, /'RD_PLAN'|N'RD_PLAN'/, '状态行要按面板 RD_PLAN 定位')
})

test('③ 进度行孤儿清理：作废(canceled=Y)的源单据等同于"已删除"', () => {
  const seg = slice(buttonSvc, 'private int pruneProgressRows(', 'if (n > 0)', 4000)
  assert.ok(seg, 'pruneProgressRows 要能找到')
  // live 集合的两条子查询(rd_plan / rd_approval)都要带状态表过滤
  const planSub = seg.slice(seg.indexOf('FROM rd_plan'), seg.indexOf('UNION'))
  assert.ok(planSub, 'rd_plan 子查询要能找到')
  assert.match(planSub, /yj_doc_status/, 'rd_plan 子查询没排除作废单 ⇒ 进度行永远清不掉')
  const apSub = seg.slice(seg.indexOf('FROM rd_approval'), seg.indexOf('))'))
  assert.ok(apSub, 'rd_approval 子查询要能找到')
  assert.match(apSub, /yj_doc_status/, 'rd_approval 子查询没排除作废单 ⇒ 进度行永远清不掉')
})

test('③a 孤儿清理的判据要带 [说明] = [项目编号] 守卫，四级行不该进 ① 分支', () => {
  const seg = slice(buttonSvc, 'private int pruneProgressRows(', 'if (n > 0)', 4000)
  assert.match(
    seg,
    /\[说明\], N''\) = ISNULL\(\[项目编号\]|ISNULL\(\[说明\], N''\) = ISNULL\(\[项目编号\]/,
    '四级行的 [说明] 是测试背景文本、[项目编号] 才是单号；不加这个守卫会把四级行当孤儿清掉',
  )
})

test('③b 四级行不走「说明」判活：改由 ①b 无条件清理（2026-10-30 口径变更）', () => {
  const seg = slice(buttonSvc, 'private int pruneProgressRows(', 'if (n > 0)', 4000)
  assert.match(seg, /\[项目层级\] = N'四级'/, '要能识别四级行')
  assert.match(
    seg,
    /asp_user1/,
    '四级行的清理判据要用 asp_user1(旧版 syncTestDocsToProgress 的 sync 落库标记)，不能按源单据判活',
  )
})

test('⑤ 测试申请单(RD_DOM_TEST)不再同步进项目进度查询', () => {
  // 【需求来源·用户原文 2026-10-30】
  //   「测试申请单不在这个项目进度查询里面显示，那个不是在测试申请单的汇总里面显示吗？修复这个问题」
  // 旧实现(syncTestDocsToProgress，2026-09-30 引入)会把 RD_DOM_TEST 的每张单同步成一条
  // 「项目层级=四级」的进度行 ⇒ 服务器上出现「立项申请里根本没有单据，进度查询却有 DT-xxx 两行」。
  const seg = slice(buttonSvc, 'public Map<String, Object> syncAllPlansToProgress(', 'out.put("清理孤儿行"', 3000)
  assert.ok(seg, 'syncAllPlansToProgress 要能找到')
  assert.doesNotMatch(seg, /syncTestDocsToProgress\(\)/, '测试申请单不得再同步进进度查询')
  assert.doesNotMatch(
    buttonSvc,
    /private Map<String, Object> syncTestDocsToProgress\(/,
    '旧同步方法要整段删掉，否则点「同步进度」又会把 DT-xxx 写回进度查询',
  )
})

test('⑥ 桌面看板「面板单据量」必须与面板列表同口径（排除 canceled=Y）', () => {
  // 【需求来源·用户原文 2026-10-30】
  //   「服务器上的单据与看板的数据对的上吗？」
  // 实测服务器:rd_approval 19 张全活着(asp_cancel='N'),但 yj_doc_status 19/19 canceled='Y';
  //   面板列表(QueryService.queryDocs 排除 canceled)⇒ 0 张,
  //   看板 docStats 只按 asp_cancel 判活 ⇒ 19 张。两边差 19。
  const seg = slice(dashSvc, 'private List<Map<String, Object>> docStats(', 'return docStats', 3000)
  assert.ok(seg, 'docStats 要能找到')
  assert.match(
    seg,
    /yj_doc_status/,
    '看板只按 asp_cancel 判活 ⇒ 已作废单据仍被计数，与面板列表对不上（实测 19 vs 0）',
  )
  assert.match(seg, /canceled/, '必须判 yj_doc_status.canceled')
})

test('④ 作废/删除单据后立刻清理进度行（不用等下一次同步）', () => {
  const seg = slice(buttonSvc, 'private Map<String, Object> voidDoc(', 'private String approvalDocNoOf(', 4000)
  assert.ok(seg, 'voidDoc 要能找到')
  assert.match(
    seg,
    /syncAllPlansToProgress\(\)/,
    '作废立项/计划后没触发进度清理 ⇒ 用户必须手工点「同步进度」才消失',
  )
  assert.match(seg, /RD_APPROVAL|RD_PLAN/, '要按研发两张源单据判断，不能无条件全量同步')
})
