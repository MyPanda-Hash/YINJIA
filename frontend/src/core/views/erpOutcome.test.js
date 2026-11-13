import test from 'node:test'
import assert from 'node:assert/strict'
import { erpOutcome, erpOutcomeText, erpFailureOutcome, erpClickBlocked, ERP_ALREADY_KEY, ERP_CALL_TIMEOUT_MS, ERP_BUSY_KEY, ERP_TIMEOUT_KEY, ERP_UNAUDIT_WARN } from './erpOutcome.js'

/**
 * 「转ERP」结果提示(2026-11-09 用户报障):
 *   「已转erp的要弃审后,重新审核后才可以转erp,但是现在可以直接转erp会一直显示转erp执行成功,
 *     应该需要已转的有已经转的提示。」
 *
 * 服务端的真实语义(KingdeePushService.pushDocument):
 *   · 是否已转ERP = 是 ⇒ 不推金蝶,原样返回 message='该单据已转入ERP，不可重复转入' + ERP单号
 *   · 未转且已审核     ⇒ 真推,push 成功后回写 是否已转ERP=是 + ERP单号
 *
 * 所以:已转必须弹 warning 并说清"要重转请先弃审再审核";成功才弹 success。
 */

test('已转(新服务端给 already=true)⇒ warning,带 ERP 单号与"弃审再审核"指引', () => {
  const o = erpOutcome({ 是否已转ERP: '是', ERP单号: 'CGRK-20261014-03407', already: true })
  assert.equal(o.already, true)
  assert.equal(o.level, 'warning', '不能报成功 —— 这正是"没弃审也说转成功了"的根源')
  assert.equal(o.erpNo, 'CGRK-20261014-03407')
  assert.equal(o.key, ERP_ALREADY_KEY)
  const text = erpOutcomeText(o, (s) => s)
  assert.ok(text.includes('CGRK-20261014-03407'), '文案要带出已有的 ERP 单号')
  assert.ok(text.includes('弃审') && text.includes('审核'), '文案要说清"要重转得先弃审再审核"')
  assert.ok(text.includes('删除'), '还要说清"旧那张要在金蝶删掉" —— 不删金蝶侧就是两张(2026-11-12 用户口径)')
})

/**
 * 弃审一张已转过 ERP 的单据时,确认框必须把话说完(2026-11-12 用户口径):
 * 「弃审后重新审核要确保是可以重新转erp的…原先修改前的单据就可以他们在 erp 上删除就行」
 * —— 重推是允许的正常流程,但**旧单必须先删**,否则金蝶侧留两张。这句话弹在弃审那一刻才有人看。
 */
test('弃审已转单:提示里同时出现"已转过/金蝶删除/再审核再转",不能只是"确认弃审？"', () => {
  const t = ERP_UNAUDIT_WARN
  assert.ok(t.includes('{no}'), '要带 ERP 单号占位')
  assert.ok(t.includes('已转过ERP'))
  assert.ok(t.includes('删除'), '必须点明去金蝶删除原单据')
  assert.ok(t.includes('审核') && t.includes('重新转ERP'), '要说清重推的路径:审核后再转')
  assert.notEqual(t, '确认弃审该单据？弃审后需重新审核。', '不能退回通用文案')
})

test('老 jar 没有 already 标记 ⇒ 按文案里的「已转入ERP」认出来(部署过渡期必须成立)', () => {
  const o = erpOutcome({ 是否已转ERP: '是', ERP单号: 'X1', message: '该单据已转入ERP，不可重复转入' })
  assert.equal(o.already, true)
  assert.equal(o.level, 'warning')
})

test('推送成功 ⇒ success,且**不**能因为回写的 是否已转ERP=是 被误判成"已转"', () => {
  const o = erpOutcome({ 是否已转ERP: '是', ERP单号: 'CGRK-20260917-00033' })
  assert.equal(o.already, false, '成功推送也会回写 是,拿它当判据会把每次成功都误报成已转')
  assert.equal(o.level, 'success')
  assert.equal(o.key, '')
})

test('成功推送的 ERP 单号仍然带出来(调用方可用)', () => {
  assert.equal(erpOutcome({ ERP单号: ' CGRK-1 ' }).erpNo, 'CGRK-1', 'ERP 单号要去空白')
})

test('没有返回体(null/undefined/空对象)⇒ 不能当成已转,也不能炸', () => {
  for (const v of [null, undefined, {}]) {
    const o = erpOutcome(v)
    assert.equal(o.already, false)
    assert.equal(o.level, 'success')
  }
  assert.doesNotThrow(() => erpOutcome({ message: null, ERP单号: null }))
})

test('erpOutcomeText:未转时返回空串(调用方沿用原来的「执行成功」)', () => {
  assert.equal(erpOutcomeText(erpOutcome({ ERP单号: 'A' }), (s) => s), '')
  assert.equal(erpOutcomeText(null, (s) => s), '')
})

test('erpOutcomeText:没有 ERP 单号时用占位符,不留裸 {no}', () => {
  const text = erpOutcomeText(erpOutcome({ already: true }), (s) => s)
  assert.ok(!text.includes('{no}'))
  assert.ok(text.includes('—'))
})

test('erpOutcomeText:翻译函数生效(切英文后不出现中文)', () => {
  const text = erpOutcomeText(erpOutcome({ already: true, ERP单号: 'E1' }), () => 'Pushed to ERP ({no})')
  assert.equal(text, 'Pushed to ERP (E1)')
})

test('超时 ≠ 失败:给"先刷新确认"的警告,而不是英文 timeout 报错', () => {
  // 2026-11-09 实测:冷启动那发推送 >15s,axios 超时弹「timeout of 15000ms exceeded」,
  // 而服务端 15:36:03 其实推成功并回写了 ERP单号 ⇒ 用户看到的是"失败",实际是成功。
  const f = erpFailureOutcome({ message: 'timeout of 15000ms exceeded', code: 'ECONNABORTED' })
  assert.equal(f.timeout, true)
  assert.equal(f.level, 'warning')
  assert.ok(f.key.includes('超时'))
  assert.ok(f.key.includes('是否已转ERP'), '要引导用户先刷新看是否已转')
  assert.ok(f.key.includes('不要立刻重复点'))
})

test('普通失败(服务端报错)保持 error,不冒充超时', () => {
  const f = erpFailureOutcome(new Error('转ERP失败: 请填写"材料分录"第1行:"仓库"'))
  assert.equal(f.timeout, false)
  assert.equal(f.level, 'error')
  assert.equal(f.key, '')
  assert.equal(erpFailureOutcome(null).key, '')
  assert.equal(erpFailureOutcome(undefined).level, 'error')
})

test('转ERP 的请求超时必须比默认 15s 宽(金蝶取 token + 保存可能远超)', () => {
  assert.ok(ERP_CALL_TIMEOUT_MS >= 60000, '15s 默认值会把"推成功但慢"错报成失败')
})

/**
 * 「推送中点第二下」的文案(2026-11-12 客户报障「转ERP 反应好慢,有时点了两下就生成两个入库单」)。
 *
 * 这条文案是前端置灰按钮时唯一的解释来源:必须让用户明白 ①正在推、②别重复点、③结果以后看列表。
 * 光靠灰按钮不说原因 = 用户以为按钮坏了,反而更会去点。
 */
test('推送中的提示:说清"正在连金蝶/别重复点/完成后看列表",不能只是"请稍候"', () => {
  assert.ok(ERP_BUSY_KEY.includes('正在转ERP'))
  assert.ok(ERP_BUSY_KEY.includes('请勿重复点击'), '必须直接说"请勿重复点击" —— 重复点=重复入库')
  assert.ok(ERP_BUSY_KEY.includes('金蝶'), '要让用户知道慢的原因是在等金蝶')
  assert.ok(ERP_BUSY_KEY.includes('ERP 单号'), '要告诉用户结果去哪看(列表里的 ERP 单号)')
  assert.notEqual(ERP_BUSY_KEY, ERP_TIMEOUT_KEY, '与"请求超时"是两件事,别复用同一句')
})

/**
 * 拦截判据(列表页与表单页共用,2026-11-12)。
 * 只要「这一次转ERP 还在飞」,同一个按钮的第二次点击必须被拦下 —— 这是前端这一侧唯一的口径,
 * 两个组件都调它,避免"只改了一边"。
 */
test('erpClickBlocked:转ERP 在飞时拦下,飞完放行;别的动作一律不受影响', () => {
  assert.equal(erpClickBlocked('转ERP', true), true, '在飞 ⇒ 拦')
  assert.equal(erpClickBlocked('转ERP', false), false, '没在飞 ⇒ 放行(第一次点击)')
  // 不能误伤其它按钮:批量转ERP/审核/保存 都照常
  for (const a of ['批量转ERP', '审核', '保存', '弃审', '删除']) {
    assert.equal(erpClickBlocked(a, true), false, `「${a}」不能被转ERP 的进行中状态影响`)
  }
  // 值不是严格 true(未初始化/undefined)时不拦 —— 宁可漏拦(服务端还有单号级互斥),也不能把按钮卡死
  assert.equal(erpClickBlocked('转ERP', undefined), false)
})
