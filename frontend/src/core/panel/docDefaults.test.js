import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  lockedPersonLabel, applyDocDefaults, todayStr, docNoFromDate, syncBatchNoWithDocDate,
} from './docDefaults.js'

/**
 * 这组断言守的是 2026-09-11 用户报的问题:
 * 「这两个文件面板(立项申请/项目实施计划)的申请立项人,新增单据时默认为当前操作用户的姓名」。
 *
 * 背景(实查得出,别退回旧写法):
 *  · RD_APPROVAL/RD_PLAN 都在 DOC_ARCHIVE_PANELS 里——新增保存后管理员是「已归档」、
 *    普通用户是「审批中」,**都不经过草稿态**;所以旧代码把默认值挂在 PanelxList 那个
 *    要求 draftEditable 的 watch 上,等于永不执行。
 *  · 新增真正经过的界面是 NewVoucherDialog,默认值必须在那里、保存之前带出。
 *  · RD_PLAN **没有**「申请立项人」字段,它的人是「负责人」。
 */

const USER = { realName: '彭于晏', userName: 'glm53' }
const T = '2026-09-11'

test('锁定字段:立项申请=申请立项人,实施计划=负责人,其它面板没有', () => {
  assert.equal(lockedPersonLabel('RD_APPROVAL'), '申请立项人')
  assert.equal(lockedPersonLabel('RD_PLAN'), '负责人')
  assert.equal(lockedPersonLabel('RD_PROGRESS'), null)
  assert.equal(lockedPersonLabel('RD_FILTER_EFF'), null)
})

test('新增立项申请:申请立项人=当前用户姓名', () => {
  const form = {}
  applyDocDefaults('RD_APPROVAL', form, USER, { isNew: true, today: T })
  assert.equal(form['申请立项人'], '彭于晏')
})

test('新增实施计划:负责人=当前用户姓名', () => {
  const form = {}
  applyDocDefaults('RD_PLAN', form, USER, { isNew: true, today: T })
  assert.equal(form['负责人'], '彭于晏')
})

test('实施计划不该凭空多出「申请立项人」键(该面板没有这个字段,多余键会在保存时静默丢弃)', () => {
  const form = {}
  applyDocDefaults('RD_PLAN', form, USER, { isNew: true, today: T })
  assert.equal('申请立项人' in form, false)
})

test('新增:锁定字段以当前用户为准,即使表单里已有别的值也覆盖(该字段用户不可改)', () => {
  const form = { 申请立项人: '别人' }
  applyDocDefaults('RD_APPROVAL', form, USER, { isNew: true, today: T })
  assert.equal(form['申请立项人'], '彭于晏')
})

test('新增立项申请:申请立项日期=今天、文件管理人=陈秀丽(仅空值时带出)', () => {
  const form = {}
  applyDocDefaults('RD_APPROVAL', form, USER, { isNew: true, today: T })
  assert.equal(form['申请立项日期'], T)
  assert.equal(form['文件管理人'], '陈秀丽')
})

test('新增:非锁定默认值不覆盖已填内容(用户可改)', () => {
  const form = { 文件管理人: '张三', 申请立项日期: '2026-01-01' }
  applyDocDefaults('RD_APPROVAL', form, USER, { isNew: true, today: T })
  assert.equal(form['文件管理人'], '张三')
  assert.equal(form['申请立项日期'], '2026-01-01')
})

test('打开既有草稿(isNew=false):锁定字段保留原值——弃审后打开单据不能把申请人改成操作人', () => {
  const form = { 申请立项人: '张三' }
  applyDocDefaults('RD_APPROVAL', form, USER, { isNew: false, today: T })
  assert.equal(form['申请立项人'], '张三')
  assert.equal('负责人' in form, false)
})

test('打开既有草稿且申请人为空:也不补当前用户(操作人≠申请人)', () => {
  const form = { 申请立项人: '' }
  applyDocDefaults('RD_APPROVAL', form, USER, { isNew: false, today: T })
  assert.equal(form['申请立项人'], '')
})

test('打开既有草稿:非锁定默认值仍按空值补(保持原有行为)', () => {
  const form = { 文件管理人: '' }
  applyDocDefaults('RD_APPROVAL', form, USER, { isNew: false, today: T })
  assert.equal(form['文件管理人'], '陈秀丽')
})

test('当前用户姓名为空:不写入空串,也不新增空键', () => {
  const form = {}
  applyDocDefaults('RD_APPROVAL', form, { realName: '', userName: '' }, { isNew: true, today: T })
  assert.equal('申请立项人' in form, false)
})

test('当前用户只有账号没有姓名:退回账号(与 user store 的 realName getter 同口径)', () => {
  const form = {}
  applyDocDefaults('RD_APPROVAL', form, { realName: '', userName: 'glm53' }, { isNew: true, today: T })
  assert.equal(form['申请立项人'], 'glm53')
})

test('其它面板的既有默认值不变:进度查询=工程技术中心,数据记录表=密级/适用范围/测试主题', () => {
  const prog = {}
  applyDocDefaults('RD_PROGRESS', prog, USER, { isNew: true, today: T })
  assert.equal(prog['文件使用范围'], '工程技术中心')
  assert.equal('申请立项人' in prog, false)

  const rec = {}
  applyDocDefaults('RD_FILTER_EFF', rec, USER, { isNew: true, today: T })
  assert.equal(rec['密级'], '保密')
  assert.equal(rec['适用范围'], '银嘉内部')
  assert.equal(rec['测试主题'], '伊可普需求2炭棒除VOC测试')
  assert.equal('负责人' in rec, false)
})

test('未知面板:不做任何写入', () => {
  const form = {}
  applyDocDefaults('MANU_ORDER', form, USER, { isNew: true, today: T })
  assert.deepEqual(form, {})
})

/**
 * 2026-09-18 第二轮:产品信息表两级审批人固定填写 冯总 / 秀丽。
 * 口径:走"默认值"(仅空时填、可人工改),不是"锁定只读" —— 与 文件管理人=陈秀丽 同款。
 * 若将来要收紧成不可改,改 yj_field.editable=0 即可(那时这条测试要改成断言 lockedPersonLabel)。
 */
test('产品信息表:两级审批人默认带出 冯总 / 秀丽', () => {
  const form = {}
  applyDocDefaults('RD_PROD_INFO', form, USER, { isNew: true, today: T })
  assert.equal(form['审核人一级'], '冯总')
  assert.equal(form['审核人二级'], '秀丽')
  // 不是锁定字段(不在 LOCKED_PERSON 里):用户可改 ⇒ 已填值时不再覆盖
  const filled = { 审核人一级: '张三' }
  applyDocDefaults('RD_PROD_INFO', filled, USER, { isNew: true, today: T })
  assert.equal(filled['审核人一级'], '张三', '已有值不应被默认值覆盖')
  assert.equal(filled['审核人二级'], '秀丽', '空值仍应带出默认')
})

test('todayStr:按本地时区给 YYYY-MM-DD(不能因 UTC 偏移差一天)', () => {
  assert.match(todayStr(new Date(2026, 8, 11, 0, 30, 0)), /^2026-09-11$/)
  assert.match(todayStr(new Date(2026, 8, 11, 23, 30, 0)), /^2026-09-11$/)
})

/* ────────── 采购入库单批次号(2026-09-21 二次口径:纯入库日期,同一日期同一批次) ──────────
 * 用户报的原始问题:「批次号只要日期并且按入库日期算,并且在填入库订单时有预设,也可以人工修改」。
 * 这组断言守三件事:①预设=入库日期(8 位纯数字,无序号);②改了单据日期,号跟着走;
 * ③人工改过的号不被日期联动覆盖(人工优先)。
 */

test('docNoFromDate:各种日期写法都归一为 8 位,不足 8 位给空串', () => {
  assert.equal(docNoFromDate('2026-09-21'), '20260921')
  assert.equal(docNoFromDate('2026/09/21'), '20260921')
  assert.equal(docNoFromDate('20260921'), '20260921')
  assert.equal(docNoFromDate('2026092101'), '20260921')  // 旧 10 位号截前 8 位合规
  assert.equal(docNoFromDate(''), '')
  assert.equal(docNoFromDate(null), '')
  assert.equal(docNoFromDate('2026-09'), '')
})

test('新增采购入库单:批次号预设 = 该单「单据日期」(不是当天、也不是送料当天)', () => {
  const form = { 单据日期: '2026-09-25' }
  applyDocDefaults('PURCHASE_IN', form, USER, { isNew: true, today: T })
  assert.equal(form['批次号'], '20260925')
})

test('新增采购入库单且单据日期未填:批次号预设 = 当天', () => {
  const form = {}
  applyDocDefaults('PURCHASE_IN', form, USER, { isNew: true, today: T })
  assert.equal(form['批次号'], '20260911')
})

test('采购入库单:已有批次号(含人工改过的)不被预设覆盖', () => {
  const form = { 单据日期: '2026-09-25', 批次号: 'YJ-20260915-11-003' }
  applyDocDefaults('PURCHASE_IN', form, USER, { isNew: true, today: T })
  assert.equal(form['批次号'], 'YJ-20260915-11-003')
})

test('采购入库单:不因预设批次号而多带出别的字段', () => {
  const form = { 单据日期: '2026-09-25' }
  applyDocDefaults('PURCHASE_IN', form, USER, { isNew: true, today: T })
  assert.deepEqual(Object.keys(form).sort(), ['单据日期', '批次号'].sort())
})

test('联动:单据日期改了 → 批次号跟走(原值是上一次自动带出的)', () => {
  const form = { 单据日期: '2026-09-25', 批次号: '20260925' }
  const next = syncBatchNoWithDocDate(form, '20260925', T)
  form['单据日期'] = '2026-09-26'
  assert.equal(syncBatchNoWithDocDate(form, next, T), '20260926')
  assert.equal(form['批次号'], '20260926')
})

test('联动:人工改过批次号 → 改日期不动它(人工优先)', () => {
  const form = { 单据日期: '2026-09-25', 批次号: 'RK-自定义-01' }
  assert.equal(syncBatchNoWithDocDate(form, '20260925', T), 'RK-自定义-01')
  assert.equal(form['批次号'], 'RK-自定义-01')
})

test('联动:批次号被清空 → 按当前单据日期重新带出', () => {
  const form = { 单据日期: '2026-09-27', 批次号: '' }
  assert.equal(syncBatchNoWithDocDate(form, '20260925', T), '20260927')
  assert.equal(form['批次号'], '20260927')
})

test('联动:没有单据日期时退回当天', () => {
  const form = { 批次号: '' }
  assert.equal(syncBatchNoWithDocDate(form, '', T), '20260911')
})

/**
 * 2026-09-22:立项申请表 / 项目实施计划补「密级」默认值。
 * 依据:两份设计纸的右上信息表印的就是「密级 = 保密」
 *   (立项申请表.xlsx G3 / 项目实施计划.xlsx G4);
 * 同族面板(RD_FILTER_EFF / RD_SAMPLE_NO / RD_PROD_DOCLIST)早就带该默认值,
 * 唯独这两张漏了 ⇒ 新建单据时密级是空的,与纸面对不上。
 * 口径与 文件管理人=陈秀丽 一致:走"默认值"(仅空时填、可人工改),不是锁定只读。
 */
test('新增立项申请/实施计划:密级默认带出「保密」(设计纸面印的固定值)', () => {
  for (const code of ['RD_APPROVAL', 'RD_PLAN']) {
    const form = {}
    applyDocDefaults(code, form, USER, { isNew: true, today: T })
    assert.equal(form['密级'], '保密', `${code} 的密级应默认保密(设计 G3/G4)`)
  }
})

test('密级默认不得覆盖用户已选值(仅空时填)', () => {
  const form = { 密级: '内部' }
  applyDocDefaults('RD_APPROVAL', form, USER, { isNew: true, today: T })
  assert.equal(form['密级'], '内部', '已有值不应被默认值覆盖')
})

/**
 * 2026-09-22:项目进度查询(控制列表)纸面右上印的是「密级=绝密 / 适用范围=工程技术中心」
 * (设计 P2/Q2、P3/Q3)。适用范围早就带了默认值,密级漏了 ⇒ 补上。
 */
test('项目进度查询:密级默认「绝密」+ 适用范围默认「工程技术中心」', () => {
  const form = {}
  applyDocDefaults('RD_PROGRESS', form, USER, { isNew: true, today: T })
  assert.equal(form['密级'], '绝密', '设计 P2/Q2 印的是绝密')
  assert.equal(form['文件使用范围'], '工程技术中心', '设计 P3/Q3 印的是工程技术中心')
})
