/**
 * sampleL2Backfill.test.js — 外部开发样品申请单「二级签核也能改配方」(用户口径 2026-11-11)
 *
 * 【用户原话】表格第 1 行：「样品-开发外部 | 二级签核无法修改配方 | 需要修改配方 | 未解决」
 *   以及追问「二级改配方要不要留原值→新值的 diff」→ 用户答：**「留」**。
 *
 * 【改动前的真实机制】
 *   · `ButtonService.applyL1Backfill` 的白名单 `{配方及工艺要求, 组装要求, 性能要求}` **只在
 *     approveApproval 里被调用一次**，而那次调用点在「一级通过 → 转待二级」的 return 之前；
 *   · 走二级（node=2）的那条分支从不调它 ⇒ 二级审批人即使提交了回填载荷也被静默丢弃；
 *   · 前端 `openSampleL1` 的触发条件是 `单据状态 === '审批中'`，待二级审批时**弹窗根本打不开**。
 *
 * 【本次口径】
 *   ① 二级节点也走同一份白名单回填（同一函数同一 DB 约束，不另写一套）；
 *   ② 留痕词区分 `L1_BACKFILL` / `L2_BACKFILL`，且**记录原值→新值**（用户明确要 diff）；
 *   ③ 前端：待二级审批也能打开回填弹窗，标题按节点切换。
 *
 * 单测跑不了运行时，按仓库既有做法读源码钉住（同 permWordDrift.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')

const btn = read('../backend/src/main/java/com/yinjia/mes/service/ButtonService.java')
const panelx = read('src/core/views/PanelxList.vue')

test('① 回填不再写死 node=1("一级")——接口要能表达二级', () => {
  // 改前:applyL1Backfill(def, no, formData) 无节点参数
  const at = btn.indexOf('private void applySampleBackfill(')
  assert.ok(at > 0, '找不到 applySampleBackfill（可能被改名，需同步本测试）')
  const sig = btn.slice(at, btn.indexOf('{', at))
  assert.match(sig, /int\s+node|nodeNo|node_no/,
    '回填方法必须接收节点号，否则二级无法复用（现在只在一级调用点被调）')
})

test('② 二级节点也调用回填(这是"二级签核能改配方"的唯一落点)', () => {
  // 找 approveApproval 里 node==2 的处理段
  const twoLevel = btn.indexOf('approve_node = 2')
  assert.ok(twoLevel > 0, '找不到一级通过转二级的 UPDATE')
  // 二级审批通过的处理:留痕是 recordApproval(..., "APPROVE", "APPROVED", opinion, 2)(node=2),
  // 不是 "APPROVE_L2" 这个词(实测全库无此词,第一版断言写错)。
  const l2At = btn.indexOf('recordApproval(def.code(), no, "APPROVE", "APPROVED", opinion, 2)')
  assert.ok(l2At > 0, '找不到二级审批通过留痕(node=2)')
  const before = btn.slice(Math.max(0, l2At - 2500), l2At)
  assert.match(before, /applySampleBackfill|applyL1Backfill/,
    '二级审批通过前必须调用回填（否则二级改的配方被静默丢弃）')
})

test('③ 留痕区分 L1_BACKFILL / L2_BACKFILL', () => {
  assert.match(btn, /L1_BACKFILL/, '一级回填留痕词丢了')
  assert.match(btn, /L2_BACKFILL/, '缺二级回填留痕词（审批情况里分不清是哪一级改的）')
})

test('④ 回填要记原值→新值(用户 2026-11-11 明确答"留" diff)', () => {
  const at = btn.indexOf('private void applySampleBackfill(')
  const fnAt = at > 0 ? at : btn.indexOf('private void applySampleBackfill(')
  assert.ok(fnAt > 0, '找不到回填方法')
  const body = btn.slice(fnAt, fnAt + 4000)
  // 必须先查旧值再写
  assert.match(body, /SELECT[\s\S]{0,200}FROM\s+"?\s*\+?\s*def\.lineTable|SELECT[\s\S]{0,300}lineTable/,
    '回填方法必须先 SELECT 出旧值（否则无从记 diff）')
  // 留痕文案里要带旧/新
  assert.match(body, /old|原值|旧值/i, '留痕里没有旧值')
  assert.match(body, /new|新值/i, '留痕里没有新值')
})

test('⑤ 前端:待二级审批也能打开回填弹窗,标题按节点切换', () => {
  // ⚠ 别用 indexOf("if (String(panelCode.value) === 'RD_SAMPLE_EXT')") 定位:全文件有**两处**
  //   (另一处是二级审批人判定 l2ApproverNow),indexOf 命中的是前者之前那个 ⇒ 断言恒假。
  //   改成以"审批通过"分派里那句独有注释为锚点,再往后找调用。
  const anchor = panelx.indexOf('外部开发样品申请单:一/二级审批都要能**回填配方及工艺要求**')
  assert.ok(anchor > 0, '找不到 RD_SAMPLE_EXT 一级/二级回填入口的口径注释')
  assert.match(panelx.slice(anchor, anchor + 900), /openSampleL1\(no1[^)]*\?\s*2\s*:\s*1|openSampleL1\(no1, current/,
    '入口没按节点调用 openSampleL1(no1, node)')
  // 入口的守卫条件不能只认 '审批中'
  const guard = panelx.slice(Math.max(0, anchor - 800), anchor)
  assert.match(guard, /待二级审批/,
    '入口守卫必须也放行「待二级审批」，否则二级审批人打不开这个弹窗')
  // 弹窗标题要能区分一级/二级。
  // ⚠ 两版宽松断言都被现网其他文案误满足了(第一版命中"一级审批 · 回填"自身;
  //   第二版命中第 2084 行「二级审批人」标签)⇒ 必须锚定 **el-dialog 的 :title 属性**本身。
  const dlgAt = panelx.indexOf('v-model="sampleL1Visible"')
  assert.ok(dlgAt > 0, '找不到回填弹窗（sampleL1Visible）')
  const dlgTag = panelx.slice(dlgAt, panelx.indexOf('>', dlgAt) + 1)
  const m = panelx.slice(Math.max(0, dlgAt - 200), dlgAt)
  const titleAttr = (m + dlgTag).match(/:title="([^"]+)"/)
  assert.ok(titleAttr, '弹窗缺 :title 绑定')
  // 标题可以是 tt('...') 包一层,也可以直接是表达式 —— 一律剥掉 tt( ) 外壳再比
  const raw = titleAttr[1].trim()
  const plain = (raw.match(/^tt\(\s*'([^']*)'\s*\)$/) || [null, raw])[1]
  assert.notEqual(plain, '一级审批 · 回填配方及工艺要求',
    '弹窗标题写死成"一级审批 · 回填…" ⇒ 二级审批人看到的却是一级字样')
})
