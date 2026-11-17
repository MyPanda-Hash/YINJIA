/**
 * purInSplit.test.js —— 采购入库单「多仓库入库」的回归闸(2026-11-17 客户口径,第三轮)
 *
 * 客户原话(第三轮定稿):
 *   「写法还是改成有个多仓库入库按钮(在顶部)。点击后和生单一样的界面。
 *     然后每行明细的头部有个下拉扩展的倒三角,点一下就多出一行明细来。但是总数量不超过最大数量。」
 *
 * 前两轮的做法(操作列拆分图标 / 仓库格子多选弹窗)都被否掉了,本测试的第一个作用就是
 * **钉住"别再长回来"**;第二个作用是守住拆行链路的关键口径(来源行号/批次号不变、
 * 合计不超上限、整批一个事务)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  SPLIT_EPS, allocSum, allocSummary, canSplitRow, defaultAllocs, numOr0, remainingQty,
  rowTotalQty, toPayload, validateAllocs,
} from './purInSplit.js'

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const ROW = {
  id: 1434,
  存货编码: 'YJ-ZZ-001',
  实收数量: 8,
  仓库: '恒亿仓',
  仓库编码: 'CK00006',
  仓位编码: 'A-01',
  批次号: '20261113',
  源单行号: '1',
}

test('① 取数与可拆判定:没有 id(未落库)不能拆、实收数量 0 不能拆', () => {
  assert.equal(numOr0(null), 0)
  assert.equal(numOr0('8'), 8)
  assert.equal(numOr0('abc'), 0)
  assert.equal(rowTotalQty(ROW), 8)
  assert.equal(canSplitRow(ROW), true)
  assert.equal(canSplitRow({ ...ROW, id: null }), false, '未落库的行服务端按 id 找不到,不许拆')
  assert.equal(canSplitRow({ ...ROW, 实收数量: 0 }), false)
  assert.equal(canSplitRow(null), false)
})

test('① 分配口径:默认一条原仓全量;合计/剩余/校验都按"不超过上限"来', () => {
  const allocs = defaultAllocs(ROW)
  assert.equal(allocs.length, 2)
  assert.equal(allocSum(allocs), 8)
  assert.equal(remainingQty(allocs, 8), 0)
  // 合计小于上限(用户口径「总数量不超过最大数量」):合法,余量留在原行
  const partial = [{ 仓库: '恒亿仓', 数量: 5 }, { 仓库: '成品B仓', 数量: 2 }]
  assert.equal(allocSum(partial), 7)
  assert.equal(remainingQty(partial, 8), 1)
  // 合计超过上限:不合法
  const over = [{ 仓库: 'A', 数量: 6 }, { 仓库: 'B', 数量: 3 }]
  assert.ok(remainingQty(over, 8) < 0)
})

test('① 校验:少行 / 没选仓库 / 数量非正 / 合计不等于上限 都要能判出来', () => {
  assert.deepEqual(validateAllocs([{ 仓库: 'A', 数量: 8 }], 8).problems.map((p) => p.code), ['needTwo'])
  const noWh = validateAllocs([{ 仓库: '', 数量: 8 }, { 仓库: 'B', 数量: 0 }], 8)
  assert.ok(noWh.problems.some((p) => p.code === 'noWh'))
  const badQty = validateAllocs([{ 仓库: 'A', 数量: 0 }, { 仓库: 'B', 数量: 8 }], 8)
  assert.ok(badQty.problems.some((p) => p.code === 'qtyNotPositive'))
  const mismatch = validateAllocs([{ 仓库: 'A', 数量: 3 }, { 仓库: 'B', 数量: 4 }], 8)
  assert.equal(mismatch.ok, false)
  assert.equal(mismatch.diff, -1, '差额 = 已分 - 实收')
})

test('① 容差按 4 位小数:0.00004 算平,0.001 不算平(与 decimal(18,4) 同口径)', () => {
  const ok = validateAllocs([{ 仓库: 'A', 数量: 4.00002 }, { 仓库: 'B', 数量: 3.99998 }], 8)
  assert.equal(ok.ok, true)
  assert.ok(Math.abs(ok.diff) <= SPLIT_EPS)
  assert.equal(validateAllocs([{ 仓库: 'A', 数量: 4 }, { 仓库: 'B', 数量: 3.999 }], 8).ok, false)
})

test('① 提交清单:空仓库行剔除、数量收口到 4 位小数、仓库名两端去空格', () => {
  const payload = toPayload([
    { 仓库: ' 恒亿仓 ', 仓位编码: ' A-01 ', 数量: 6.00001 },
    { 仓库: '', 仓位编码: '', 数量: 2 },
    { 仓库: '成品B仓', 数量: 2 },
  ])
  assert.equal(payload.length, 2)
  assert.deepEqual(payload[0], { 仓库: '恒亿仓', 仓位编码: 'A-01', 数量: 6 })
  assert.equal(allocSummary([{ 仓库: '恒亿仓', 数量: 6 }, { 仓库: '成品B仓', 数量: 2 }]), '恒亿仓 6 / 成品B仓 2')
})

test('② 入口是工具栏按钮「多仓库入库」,前两轮的做法已彻底撤掉', () => {
  const form = src('./../views/PanelxForm.vue')
  assert.ok(/if \(action === '多仓库入库'\)/.test(form), '工具栏动作必须接上 openPurInMultiWh')
  assert.ok(/function openPurInMultiWh\(/.test(form), '缺 openPurInMultiWh')
  assert.ok(/多仓库入库: s !== '草稿' \|\| !isEdit\.value \|\| !editable\.value/.test(form),
    '只在已保存的草稿上可点(拆行按行 id 动库)')
  assert.ok(/<PurInMultiWhDialog/.test(form), '多仓库入库弹窗要挂载')
  assert.ok(/:doc-no="form\['单据编号'\]/.test(form), '弹窗要带单据编号(服务端据此校验草稿/ERP)')
  assert.ok(/:rows="purInDetailRows"/.test(form), '弹窗吃当前单据的明细行')
  // 前两轮:操作列拆分图标 / 仓库格子多选弹窗 —— 都不许再出现
  assert.ok(!/openPurInSplit|openPurInWhPick|isPurInWhField/.test(form), '旧入口必须删干净')
  assert.ok(!/class="split"|<PurInSplitDialog|<PurInWhPickDialog/.test(form), '旧组件必须删干净')
  assert.ok(!/split icon/.test(form))
})

test('② 列表页(内联表单)也接了这颗按钮 —— 否则会落到通用 callButton 报「未定义按钮规则」', () => {
  const list = src('./../views/PanelxList.vue')
  assert.ok(/if \(action === '多仓库入库'\)/.test(list), '列表页 onButton 必须接同一动作')
  assert.ok(/<PurInMultiWhDialog/.test(list), '列表页也要挂载弹窗')
  assert.ok(/多仓库入库: !current\.value \|\| st !== '草稿'/.test(list), '列表页按钮同样只在草稿可点')
  assert.ok(/onPurInMultiWhSaved/.test(list), '拆完要重载列表(明细行已按仓库拆开)')
  assert.ok(/hasUnsavedChanges\(\)/.test(list), '有未保存修改时先拦住(界面与库不一致时拆行会错)')
})

test('② 弹窗:每行 ▾ 加一行仓库子行,合计不超过可入库数量,确定走 multiWh 一次性提交', () => {
  const dlg = src('./../views/PurInMultiWhDialog.vue')
  assert.ok(/addAlloc\(/.test(dlg) && /@click="addAlloc\(row\.L\)"/.test(dlg), '每行 ▾ 要能加一行仓库子行')
  assert.ok(/maxOf\(/.test(dlg) && /可入库数量/.test(dlg), '要有"可入库数量"这一列作为上限')
  assert.ok(/remainingOf\(L\) < 0/.test(dlg) && /不能超过可入库数量/.test(dlg), '超过上限要拦')
  assert.ok(/withRemainder\(/.test(dlg), '没分完的余量要补回原行(否则服务端合计不等于实收数量)')
  assert.ok(/splitPurInMultiWh\(/.test(dlg), '提交走 splitPurInMultiWh(整批一次)')
  assert.ok(/同一行要拆至少两个仓库/.test(dlg), '只填一个仓库要说明"不会拆行"')
  assert.ok(/:disabled="!canSubmit"/.test(dlg), '校验不过时不许提交')
})

test('② 自动计算:最后一条仓库子行 = 可入库数量 − 其它行(禁用输入),并拦同仓重复', () => {
  const dlg = src('./../views/PurInMultiWhDialog.vue')
  assert.ok(/function recalcRemainder\(/.test(dlg), '缺自动计算(最后一行吃余量)')
  assert.ok(/recalcRemainder\(L\)/.test(dlg), '加行/删行/改数量后要重算余量')
  assert.ok(/@change="recalcRemainder\(row\.L\)"/.test(dlg), '改前面的行要触发重算')
  assert.ok(/:disabled="row\.i === row\.L\.allocs\.length - 1"/.test(dlg), '最后一行是自动行,不允许手填')
  assert.ok(/同一行不能出现重复的仓库（仓位）/.test(dlg), '同仓同仓位重复要拦(否则金蝶收到两条一样的分录)')
})

test('② 仓位:服务端只校验归属,不再查 bs_wh_loc.仓位名称(该列不存在,2026-11-17 实测 SQL 207)', () => {
  const svc = src('./../../../../backend/src/main/java/com/yinjia/mes/service/PurInSplitService.java')
  assert.ok(!/SELECT 仓位编码, 仓位名称 FROM bs_wh_loc/.test(svc), '不能查不存在的列')
  assert.ok(/SELECT 仓位编码 FROM bs_wh_loc/.test(svc), '仓位校验只取编码')
  assert.ok(/或已停用/.test(svc), '停用的仓位也要拦')
})

test('② 回退 + 缩进:按 [源行id] 归组,拆过的行再打开还是"父行 + 缩进的子行",并能合并回一行', () => {
  const dlg = src('./../views/PurInMultiWhDialog.vue')
  assert.ok(/purInWhGroups\(/.test(dlg), '打开时先取拆分组锚点(源行id 不是面板字段,通用取数带不出来)')
  assert.ok(/groups\.get\(gid\)/.test(dlg), '按组id 把同组行归到一起')
  assert.ok(/gid !== Number\(r\.id\)\) continue/.test(dlg), '子行不能单独成行(否则缩进就没了)')
  assert.ok(/groupRows/.test(dlg), '每行要带整组行,可入库数量按整组合计算')
  assert.ok(/mergeBack\(/.test(dlg) && /合并回一行/.test(dlg), '要有「合并回一行」(回退)入口')
  assert.ok(/isGrouped\(/.test(dlg) && /needsApply/.test(dlg), '拆过的行只留一个仓库 = 合并回一行,也要提交')
  // 服务端:组锚点查询 + 合并 = 子行软删 + 父行数量/金额合回 + 占用链回流
  const svc = src('./../../../../backend/src/main/java/com/yinjia/mes/service/PurInSplitService.java')
  assert.ok(/public List<Map<String, Object>> groups\(/.test(svc), '服务端要能按单据返回组锚点')
  assert.ok(/mergeChildren\(/.test(svc) && /asp_cancel\] = 'Y'/.test(svc), '合并要把子行软删(不物理删)')
  assert.ok(/target_line_key/.test(svc) && /\[link_status\] = 'RELEASED'/.test(svc),
    '合并要把子行的占用链释放')
  assert.ok(/allocs\.size\(\) < 2/.test(svc), '只给一个仓库 = 走合并(回退),不再要求"至少两个仓库"')
  assert.ok(/\[源行id\]/.test(svc), '拆行要写组锚点')
  const ctrl = src('./../../../../backend/src/main/java/com/yinjia/mes/controller/PxController.java')
  assert.ok(/@GetMapping\("\/purIn\/groups"\)/.test(ctrl), '控制器要有组锚点查询')
  const engine = src('./../../business/engine.js')
  assert.ok(/purInWhGroups/.test(engine) && /'\/px\/purIn\/groups'/.test(engine), '引擎要打 /px/purIn/groups')
  const mig = src('./../../../../tools/migrate-pur-in-wh-group-20261117.sql')
  assert.ok(/COL_LENGTH\('dbo\.bl_purchase_in', N'源行id'\)/.test(mig) && /MS_Description/.test(mig),
    '迁移要幂等加列并写中文注明')
})

test('③ 服务端:整批一个事务、来源行号/批次号原样、占用链一起拆', () => {
  const engine = src('./../../business/engine.js')
  assert.ok(/splitPurInMultiWh/.test(engine) && /'\/px\/purIn\/multiWh'/.test(engine), '引擎要打 purIn/multiWh')
  const ctrl = src('./../../../../backend/src/main/java/com/yinjia/mes/controller/PxController.java')
  assert.ok(/@PostMapping\("\/purIn\/multiWh"\)/.test(ctrl), '控制器要有 /px/purIn/multiWh')
  assert.ok(/requireButton\("PURCHASE_IN", "修改"\)/.test(ctrl), '权限词沿用 PURCHASE_IN 的「修改」')
  const cfg = src('./../../../../backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java')
  assert.ok(/new String\[\]\{"多仓库入库", "多仓库入库"\}/.test(cfg), '采购入库单工具栏要登记这颗按钮')
  const svc = src('./../../../../backend/src/main/java/com/yinjia/mes/service/PurInSplitService.java')
  assert.ok(/public Map<String, Object> splitMulti\(/.test(svc) && /@Transactional/.test(svc), '整批一个事务')
  assert.ok(/只有草稿状态的采购入库单可以拆分/.test(svc), '非草稿不能拆')
  assert.ok(/是否已转ERP/.test(svc), '已转ERP 不能拆')
  assert.ok(/yj_doc_status/.test(svc) && /已作废,不能拆分/.test(svc), '作废单(单头仍写草稿)不能拆')
  assert.ok(/必须等于本行实收数量/.test(svc), '合计口径服务端再校验一遍')
  assert.ok(/原样复制/.test(svc) && /源单行号/.test(svc), '拆出来的行要原样带 源单行号')
  assert.ok(/form_flow_link/.test(svc) && /replicateLinks/.test(svc), '占用链要一起拆')
})

test('④ 新词条在 10 个语言包里都有译名(切 en / ja 不露中文)', () => {
  const keys = [
    '多仓库入库', '点一下加一行仓库', '可入库数量', '已分配 / 剩余',
    '这张单没有可拆分的明细行', '要拆分的行', '拆出来', '未选',
    '拆分失败', '拆分成功，已拆成 {n} 行', '请先保存单据，再拆分仓库',
  ]
  for (const locale of ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']) {
    const text = src(`../../i18n/locales/${locale}.js`)
    for (const k of keys) {
      const hit = new RegExp(`'${k}':\\s*'([^']+)'`).exec(text)
      assert.ok(hit, `${locale}.js 缺词条:${k}`)
      // zh-TW 是中文繁体:繁简同形时译名与原文相同是正常的,只要求非中文语言不回落中文
      if (locale !== 'zh-TW') assert.notEqual(hit[1].trim(), k, `${locale}.js 的「${k}」还是中文原文`)
    }
  }
})
