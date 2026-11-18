/**
 * 项目流程管控必须在**每次切回页签时重新取数**（2026-11-17 用户报障）。
 *
 * 用户原话：「为什么立项申请的单据已经删除了，这个流程管控还有被删除单据的流程追踪」。
 *
 * 根因不在服务端过滤（RdProjectFlowService 早排掉了 asp_cancel='Y' /
 * yj_doc_status.canceled='Y'），而在**页面从不重新取数**：
 * PortalLayout 用 <keep-alive :max="20"> 按页签缓存实例 ⇒ onMounted 只跑一次，
 * 删除后切回来看到的仍是删除前的快照。
 *
 * 这两条断言分别钉「取数挂 onActivated」与「服务端确实有作废过滤」，缺一条都会复发。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./ProjectFlow.vue', import.meta.url), 'utf8')
const svc = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/RdProjectFlowService.java', import.meta.url), 'utf8')

test('流程管控页：取数必须在 onActivated（keep-alive 下 onMounted 只跑一次）', () => {
  assert.match(page, /onActivated, onBeforeUnmount, onMounted/, '必须引入 onActivated')
  assert.match(page, /onActivated\(\(\) => load\(\)\)/, '取数要挂在 onActivated')
  // onMounted 里不得再调 load()，否则首屏会请求两遍（onActivated 首次挂载也会触发）
  const m = page.match(/onMounted\(\(\) => \{[\s\S]*?\n\}\)/)
  assert.ok(m, '找不到 onMounted 块')
  assert.doesNotMatch(m[0], /\bload\(\)/, 'onMounted 里不要再 load()，避免首屏双请求')
})

test('服务端必须过滤「已作废/已删除」的立项（否则前端刷新也没用）', () => {
  // 业务表侧：asp_cancel
  assert.match(svc, /FROM rd_approval WHERE ISNULL\(asp_cancel,'N'\) <> 'Y'/, '要排掉业务表已作废')
  // 状态表侧：voidDoc 只写 yj_doc_status.canceled，不动 asp_cancel ⇒ 必须另有 NOT EXISTS
  assert.match(svc, /NOT EXISTS \(SELECT 1 FROM yj_doc_status s WHERE s\.panel_code = N'RD_APPROVAL'/, '要排掉状态表已作废')
  assert.match(svc, /ISNULL\(s\.canceled,'N'\) = 'Y'/, '判据是 canceled=Y')
})
