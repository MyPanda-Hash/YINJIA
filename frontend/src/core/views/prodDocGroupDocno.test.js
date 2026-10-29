/**
 * prodDocGroupDocno.test.js —— 「产品文件」分组 7 个面板,纸张右上角那格一律印「单据编号：」
 * 并绑**引擎自动发的单据编号**(2026-10-29 用户口径:
 *   「产品文件内的面板的右上角的编号应该改为单据编号,所有的都是」)。
 *
 * 【为什么不是简单改一个字符串】
 *   那格的标识一直写死在 RecordSheetPanels.vue 里(tt('编号：')),绑哪个**数据键**却由
 *   sheetDocNo.docNoKeyOf 按「head 里有没有 文档编号」动态推 —— 于是同一句话在不同面板
 *   指向两个不同的号:
 *     · 表单型面板(产品信息表/成型/组装/规格书/变更申请)= 单据编号 PI-…/MP-…/AP-… ;
 *     · 检验计划表(RD_INSP_PLAN)= **文档编号** YJ-RD001 —— 纸面印着 YJ-RD001,
 *       而这张单自己的 IP-2026-10-0015 在纸上一个字都看不到(实测 2026-10-29 探针)。
 *   ⇒ 只改文案会变成「单据编号：YJ-RD001」这种张冠李戴,故必须同时把绑键钉到 单据编号。
 *
 * 【分工】
 *   · 6 张走 RecordSheetPanels 报告头 ⇒ 配置 head.docnoPrefix + head.docNoKey;
 *   · 产品文件列表(RD_PROD_DOCLIST)走自定义视图 ProdDocListSheet.vue,自己写死文案;
 *   · 规格书(RD_SPEC_DOC)走封面另一套(coverDocNoKey,2026-10-28 已改绑单据编号并印
 *     「单据编号：」,见 specCoverLayout.test.js ②)—— 这里只断言它与封面口径一致。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'
import { docNoKeyFor, docnoPrefixOf } from '../panel/sheetDocNo.js'

/** 左导航「研发管理 › 产品文件」分组的 7 张面板(见 business/menus.js rdFiles.children) */
const GROUP = [
  'RD_PROD_INFO', 'RD_MOLD_PROC', 'RD_SPEC_DOC',
  'RD_ASM_PROC', 'RD_INSP_PLAN', 'RD_PROD_DOCLIST', 'RD_CHANGE',
]
/** 走 RecordSheetPanels 报告头那格的 6 张(规格书走封面、产品文件列表走自定义视图) */
const NEEDS_HEAD = ['RD_PROD_INFO', 'RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_INSP_PLAN', 'RD_CHANGE']

const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const prodDocList = readFileSync(new URL('./ProdDocListSheet.vue', import.meta.url), 'utf8')

test('① 走报告头的 5 张都在配置里,产品文件列表是自定义视图(不在这份配置)', () => {
  for (const p of NEEDS_HEAD) assert.ok(recordSheetConfigs[p], `recordSheetConfigs 缺少 ${p}`)
  assert.equal(recordSheetConfigs['RD_PROD_DOCLIST'], undefined,
    '产品文件列表走 ProdDocListSheet.vue 自定义视图;若哪天并入配置,本测试要同步改')
  assert.ok(GROUP.length === 7, '分组口径 = 7 张(menus.js rdFiles.children)')
})

test('② 报告头那格的标识声明为「单据编号」(不是缺省的「编号」)', () => {
  const problems = []
  for (const p of NEEDS_HEAD) {
    const v = recordSheetConfigs[p].head?.docnoPrefix
    if (v !== '单据编号') {
      problems.push(`${p} head.docnoPrefix=${JSON.stringify(v)},应为 '单据编号'(缺省 true 会印「编号：」)`)
    }
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

test('③ 那一格绑的键强制为「单据编号」(检验计划表原先误绑「文档编号」YJ-RD001)', () => {
  const problems = []
  for (const p of NEEDS_HEAD) {
    const v = recordSheetConfigs[p].head?.docNoKey
    if (v !== '单据编号') {
      problems.push(`${p} head.docNoKey=${JSON.stringify(v)},应为 '单据编号'(否则 docNoKeyOf 会按 head 里有没有 文档编号 动态推)`)
    }
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

test('④ 真值核对:检验计划表 head 同时有 文档编号(YJ-RD001)与 单据编号 时,选中的是单据编号', () => {
  // 复刻实测探针拿到的 head(IP-2026-10-0015 那张)
  const head = { 单据编号: 'IP-2026-10-0015', 文档编号: 'YJ-RD001' }
  assert.equal(docNoKeyFor(head, {}), '文档编号', '未声明时自动推断仍选 文档编号(既有行为不变)')
  assert.equal(docNoKeyFor(head, recordSheetConfigs['RD_INSP_PLAN'].head), '单据编号',
    '配置声明后必须选 单据编号,否则纸上印的是 YJ-RD001')
})

test('⑤ 标识文案三种取值(缺省不变 / false 不印 / 字符串补冒号)', () => {
  assert.equal(docnoPrefixOf(undefined), '编号：', '缺省 = 既有行为,几十张面板靠它')
  assert.equal(docnoPrefixOf(true), '编号：')
  assert.equal(docnoPrefixOf(false), '', '7 张数据记录表的设计原值是裸编号')
  assert.equal(docnoPrefixOf('单据编号'), '单据编号：')
  assert.equal(docnoPrefixOf('单据编号：'), '单据编号：', '已经带冒号的不再补第二个')
})

test('⑥ 渲染器统一走纯函数,模板里不再有第二套硬编码', () => {
  assert.match(panels, /const docnoPrefixText = computed\(\(\) => docnoPrefixOf\(/,
    '必须调用 docnoPrefixOf(单一实现,可单测)')
  assert.match(panels, /const docNoKey = computed\(\(\) => docNoKeyFor\(/,
    '必须调用 docNoKeyFor(声明优先、缺省回落推断)')
  const tpl = panels.slice(0, panels.indexOf('<script'))
  assert.ok(!/tt\('编号：'\)/.test(tpl), "模板里不该再写死 tt('编号：'),统一走 docnoPrefixText")
})

test('⑦ 产品文件列表(自定义视图)那格也印「单据编号：」', () => {
  assert.match(prodDocList, /单据编号：/, 'ProdDocListSheet 右上角要带「单据编号：」标识')
})

test('⑧ 规格书封面与这 6 张同口径(封面那套 2026-10-28 已改)', () => {
  assert.equal(recordSheetConfigs['RD_SPEC_DOC'].coverDocNoKey, '单据编号',
    '规格书封面右上角要绑单据编号(否则同一分组里只有它印别的号)')
})
