import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  QC_INSPECTOR_PANELS,
  isSystemInspector,
  needsInspectorDefault,
  pcUserName,
  applyInspectorDefault,
} from './qcInspector.js'

const USER = { realName: '冯敏', userName: 'fengmin' }

test('范围=首件/制程/组装成品三张工序检验单', () => {
  assert.deepEqual([...QC_INSPECTOR_PANELS], ['QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP'])
})

test('后台占位值判定:system / system(手机端报工吸收) 都算,大小写不敏感;真人姓名不算', () => {
  assert.equal(isSystemInspector('system'), true)
  assert.equal(isSystemInspector(' system(手机端报工吸收) '), true)
  assert.equal(isSystemInspector('SYSTEM(结案自愈)'), true)
  assert.equal(isSystemInspector('systematic'), true) // 前缀口径:不是真人姓名
  assert.equal(isSystemInspector('冯敏'), false)
  assert.equal(isSystemInspector(''), false)
  assert.equal(isSystemInspector(null), false)
})

test('只有三张检验单、且检验员为空或后台占位时才需要带出', () => {
  assert.equal(needsInspectorDefault('QC_FIRST_INSP', { 检验员: '' }), true)
  assert.equal(needsInspectorDefault('QC_PROC_INSP', { 检验员: null }), true)
  assert.equal(needsInspectorDefault('QC_ASM_INSP', { 检验员: 'system(手机端报工吸收)' }), true)
  assert.equal(needsInspectorDefault('QC_ASM_INSP', { 检验员: '冯敏' }), false)
  // 别的面板(如来料检验单)不归本模块管
  assert.equal(needsInspectorDefault('QC_INSP', { 检验员: '' }), false)
  assert.equal(needsInspectorDefault('', { 检验员: '' }), false)
  assert.equal(needsInspectorDefault('QC_PROC_INSP', null), false)
})

test('带出当前电脑端登录人的姓名;没有姓名退回账号', () => {
  const a = {}
  applyInspectorDefault('QC_PROC_INSP', a, USER)
  assert.equal(a['检验员'], '冯敏')

  const b = { 检验员: 'system(手机端报工吸收)' }
  applyInspectorDefault('QC_FIRST_INSP', b, { realName: '', userName: 'glm53' })
  assert.equal(b['检验员'], 'glm53')

  // 没登录人:原样保留(后台线程/未登录预览)
  const c = { 检验员: 'system(手机端报工吸收)' }
  applyInspectorDefault('QC_ASM_INSP', c, {})
  assert.equal(c['检验员'], 'system(手机端报工吸收)')
})

test('已填真人姓名一律不覆盖(签名是事实)', () => {
  const head = { 检验员: '陈秀丽' }
  applyInspectorDefault('QC_ASM_INSP', head, USER)
  assert.equal(head['检验员'], '陈秀丽')
})

test('非工序检验面板不动', () => {
  const head = { 检验员: '' }
  applyInspectorDefault('QC_INSP_REC', head, USER)
  assert.equal(head['检验员'], '')
})

test('返回同一个 head(便于链式调用)', () => {
  const head = { 检验员: '' }
  assert.equal(applyInspectorDefault('QC_PROC_INSP', head, USER), head)
})

test('pcUserName:姓名优先、去空白、退回账号', () => {
  assert.equal(pcUserName({ realName: ' 冯敏 ', userName: 'fengmin' }), '冯敏')
  assert.equal(pcUserName({ userName: 'fengmin' }), 'fengmin')
  assert.equal(pcUserName(null), '')
})
