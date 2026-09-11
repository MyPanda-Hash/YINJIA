import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lockedPersonLabel, applyDocDefaults, todayStr } from './docDefaults.js'

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

test('todayStr:按本地时区给 YYYY-MM-DD(不能因 UTC 偏移差一天)', () => {
  assert.match(todayStr(new Date(2026, 8, 11, 0, 30, 0)), /^2026-09-11$/)
  assert.match(todayStr(new Date(2026, 8, 11, 23, 30, 0)), /^2026-09-11$/)
})
