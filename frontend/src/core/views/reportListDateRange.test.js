/**
 * reportListDateRange.test.js —— 报工记录「日期段 + 数量合计」的渲染层护栏(2026-11-18)
 *
 * 【用户口径】
 *   ① 「报工记录，要可以选择某个日期段的」—— 查询区「单据日期」原来只有单日选择;
 *   ② 「报工数量下面要有一个合计数量」—— 页脚合计行在「报工数量」格是空的。
 *
 * 【为什么读源码钉住】
 *   两条都发生在 PanelxList.vue 的渲染/查询胶水里(模板分支 + sumMethod 的类型判据),
 *   组件本身没法在 node --test 里挂载(CSS/Element 依赖),仓库既有做法就是读源码守规则
 *   (docSheetWidth.test.js / recordSheetDateCellWidth.test.js 同款)。
 *   纯逻辑(区间规整/反序/不完整不落条件)在 @core/report/reportQuery.test.js 里另有用例。
 *
 * 【这次改动的三个不可回退点】
 *   A. 单据日期控件必须是 DateRangeQuery(区间),不能退回单日 el-date-picker;
 *      **只对报工记录** 放开(与 2026-11-13「输入即查只改报工记录」同一条口径)。
 *   B. 区间值只能落到 condition.开始日期/结束日期(后端 queryFlat 认这两个键),
 *      并且只在 change(两端齐全/清空)时落 —— 中途只有一端的值不能拿去查。
 *   C. sumMethod 的数值判据必须包含「数值」—— 报工数量在 yj_field 里就是 data_type='数值',
 *      旧判据只认 小数/整数 ⇒ 合计行在该列永远空白。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const pure = readFileSync(new URL('../report/reportQuery.js', import.meta.url), 'utf8')

test('报工记录的单据日期用区间控件;其它报表面板仍是单日查询(范围只放开报工记录)', () => {
  // 常量里只登记报工记录
  assert.match(vue, /const INLINE_DATE_RANGE_PANELS = \['WO_REPORT_LIST'\]/,
    'INLINE_DATE_RANGE_PANELS 必须只含 WO_REPORT_LIST —— 用户口径只改报工记录')
  // 区间控件分支:严格「单据日期 + 该面板在常量里」才走 DateRangeQuery
  const branch = vue.slice(vue.indexOf('<DateRangeQuery'), vue.indexOf('<DateRangeQuery') + 700)
  assert.match(branch, /qr\.dataName === '单据日期'/, 'DateRangeQuery 分支必须只接「单据日期」这个查询字段')
  assert.match(branch, /inlineDateRangePanel/, 'DateRangeQuery 分支必须带面板白名单判定(inlineDateRangePanel)')
  assert.match(branch, /clearable/, '日期段要能清空(清空 = 查全量)')
  // 单日 el-date-picker 分支必须还在(其它报表面板继续用)
  assert.match(vue, /v-else-if="qType\(qr\) === 'date'"/,
    '单日日期分支必须保留 —— 非白名单面板的查询口径不能被动到')
})

test('日期段只在 change 落 condition 的两个控制键(中途只有一端不能查)', () => {
  const fn = vue.slice(vue.indexOf('function onPageDateRange'), vue.indexOf('function syncPageDateRange'))
  assert.match(fn, /normalizeDateRange\(range\)/, '必须走纯函数规整(反序交换 / 两端齐全判定)')
  assert.match(fn, /condition\['开始日期'\]/, '必须写 condition.开始日期(后端 queryFlat 的日期段契约)')
  assert.match(fn, /condition\['结束日期'\]/, '必须写 condition.结束日期')
  assert.match(fn, /delete condition\['开始日期'\]/, '清空时两个键都要删掉')
  assert.match(fn, /search\(\)/, '选完/清空后要重新查询')
  // 控件 v-model 侧保持独立 ref,不直接绑 condition(否则选择中会给后端半截条件)
  const tpl = vue.slice(vue.indexOf('<DateRangeQuery'), vue.indexOf('<DateRangeQuery') + 700)
  assert.match(tpl, /:model-value="pageDateRange"/, '控件显示值必须用独立的 pageDateRange(不与 condition 直接双向绑定)')
  assert.match(tpl, /@change="onPageDateRange"/, '只有 change(选完/清空)才落条件')
})

test('切面板 / reset / 弹窗应用后控件按 condition 回显(否则显示的区间与生效条件不一致)', () => {
  const calls = vue.match(/syncPageDateRange\(\)/g) || []
  // 定义 1 次 + 三个清空点(resetHeaderQuery / reset / 切面板 watch)+ 弹窗应用 1 次
  assert.ok(calls.length >= 5, `syncPageDateRange 调用点不足(实际 ${calls.length} 处):reset、切面板、弹窗应用都要回显`)
  const sw = vue.slice(vue.indexOf("Object.keys(condition).forEach((key) => delete condition[key])", vue.indexOf('watch(')))
  assert.match(sw.slice(0, 500), /syncPageDateRange\(\)/,
    '切面板清空 condition 后必须同步清空日期段控件')
})

test('页脚合计必须把「数值」当数值列(报工数量 data_type=数值),且只作用于报表页脚', () => {
  const fn = vue.slice(vue.indexOf('function sumMethod'), vue.indexOf('// 审批流', vue.indexOf('function sumMethod')))
  assert.match(fn, /\['小数', '整数', '数值'\]\.includes\(f\.dataType\)/,
    'sumMethod 的数值判据必须包含「数值」—— 否则报工数量下面永远没有合计')
  // 该方法的调用面:只有报表表(show-summary)用它,不能悄悄接到单据明细页脚
  // (单据明细是 :summary-method="(p) => sumMethodFor(b, p)",名字前缀相同 ⇒ 必须排除)
  const callers = vue.match(/:summary-method="(?:\(p\) => )?sumMethod(?![A-Za-z])/g) || []
  assert.equal(callers.length, 1, 'sumMethod 只能给报表表这一处用(单据明细走 archSumsMap / sumMethodFor)')
})

test('日期段合计要覆盖整段查询(服务端 sums),不能只算当前页 50 行', () => {
  // 服务端契约:平表查询响应带 sums(列 label → 合计值),按同一条 WHERE 算
  assert.match(vue, /reportSums\.value = reportMode\.value && res && res\.sums/,
    'load() 必须接住服务端 sums(否则 50 行/页的报表合计只算当前页)')
  const fn = vue.slice(vue.indexOf('function sumMethod'), vue.indexOf('// 审批流', vue.indexOf('function sumMethod')))
  assert.match(fn, /reportSums\.value/, 'sumMethod 必须优先用服务端整段合计')
  assert.match(fn, /sumKeepScale\(\[serverSum\]\)/, '服务端合计要按明细位数收口(不能出现 3100.000000)')
  // 切面板时必须清空,防上一个面板的合计串到下一个面板
  assert.match(vue, /reportSums\.value = null/,
    '切面板/清空时必须把 reportSums 置空(否则报表页脚会显示上一个查询的合计)')
})

test('纯逻辑模块导出的区间契约与组件使用的是同一份', () => {
  for (const name of ['dateRangeToCondition', 'dateRangeFromCondition', 'normalizeDateRange']) {
    assert.ok(pure.includes(`export function ${name}`), `@core/report/reportQuery 必须导出 ${name}`)
    assert.ok(vue.includes(name), `PanelxList 必须使用 ${name}(不要在组件里另写一套区间口径)`)
  }
  assert.match(pure, /DATE_RANGE_START_KEY = '开始日期'/, '开始日期键必须与后端 QueryService 一致')
  assert.match(pure, /DATE_RANGE_END_KEY = '结束日期'/, '结束日期键必须与后端 QueryService 一致')
})
