import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsRelogin, pickCurrentFactory } from './factory.js'

/**
 * 这组断言守的是 2026-09-22 用户报的问题:
 * 「系统内部左上角的工厂切换是无效使用功能,并未进行切换」。
 *
 * 根因(实查,别退回旧写法):
 *  · 数据源是按 JWT 里的工厂声明路由的 —— JwtAuthFilter.java:36 `DataSourceRouter.use(t.factory())`;
 *    登录时 AuthController 把 factory 写进声明(YJ → HSDZ_MES / YJ_TEST → HSDZ_MES_TEST)。
 *  · 而顶栏下拉原先只调 stores/user.js 的 switchFactory():改本地对象 + localStorage,
 *    令牌没换 ⇒ 后续请求照样查旧库 —— 名字变了、数据没变,就是这个"无效"。
 *  · ADR-0003 写明:切换账套 = 按新工厂重新登录(账套绑在令牌里)。所以这里只做两件可测的判定:
 *    要不要重登、当前到底算哪个账套;真正的重登+刷新在 TopBar / FactorySwitchDialog 里做。
 */

const FACTORIES = [
  { code: 'YJ', name: 'YINJIA-MES' },
  { code: 'YJ_TEST', name: 'YINJIA-MES·测试库' },
]

test('目标账套与当前一致时不必重登', () => {
  assert.equal(needsRelogin('YJ', 'YJ'), false)
  assert.equal(needsRelogin('YJ', 'YJ_TEST'), true)
  assert.equal(needsRelogin('YJ_TEST', 'YJ'), true)
  assert.equal(needsRelogin('', 'YJ_TEST'), true, '不知道当前账套时按需要重登处理')
  assert.equal(needsRelogin('YJ', '  '), false, '没选到账套不该弹窗')
  assert.equal(needsRelogin('YJ', undefined), false)
  assert.equal(needsRelogin(' YJ ', 'YJ'), false, '两端空白不该误判成需要重登')
})

test('当前账套判定:会话里的工厂码最权威,缓存次之,最后落列表首项', () => {
  assert.equal(pickCurrentFactory(FACTORIES, { sessionCode: 'YJ_TEST', cachedCode: 'YJ' }).code, 'YJ_TEST',
    '缓存陈旧时以会话为准 —— 否则顶栏显示的名字与正在查的库不一致(就是用户报的那个"看起来没切")')
  assert.equal(pickCurrentFactory(FACTORIES, { sessionCode: 'YJ', cachedCode: 'YJ_TEST' }).code, 'YJ')
  assert.equal(pickCurrentFactory(FACTORIES, { cachedCode: 'YJ_TEST' }).code, 'YJ_TEST', '会话没带(旧登录缓存)时退回缓存')
  assert.equal(pickCurrentFactory(FACTORIES, {}).code, 'YJ', '都没有时退回首个账套')
  assert.equal(pickCurrentFactory(FACTORIES, { sessionCode: 'NOPE', cachedCode: 'ALSO_NOPE' }).code, 'YJ',
    '认不出的码不能原样显示')
})

test('账套清单异常时返回 null,不抛错', () => {
  assert.equal(pickCurrentFactory([], { sessionCode: 'YJ' }), null)
  assert.equal(pickCurrentFactory(null, { sessionCode: 'YJ' }), null)
  assert.equal(pickCurrentFactory([null, FACTORIES[1]], {}).code, 'YJ_TEST', '跳过空项')
})
