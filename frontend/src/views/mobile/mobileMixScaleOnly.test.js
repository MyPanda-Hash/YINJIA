/**
 * 扫码混料明细页的守卫(2026-11-19 用户口径):
 *   「手机扫码混料,扫物料码解锁后,不能手动填写数据,应该实时抓取电子秤的数据。
 *    等他们确认数量无误后再点击确认就可以。」
 *
 * 钉住四件事,防止以后有人"顺手把输入框加回来":
 * ① 页面里不存在可编辑的数量控件(没有 el-input-number / 没有 curQty / 没有「取秤」按钮);
 * ② 实投重量是**只读实时读数**(data-test="mix-live-qty" + liveQty 绑定);
 * ③ 「确认」写的必须是**当下这一秤**(saveQty 用 liveQty,不是任何本地输入值);
 * ④ 读数不稳定/取不到时按钮点不亮(canConfirm 含 scaleOk 与 liveQty > 0);
 * ⑤ 轮询 1 秒一抓,且新增文案 en/ja 都有译名(否则切语言会掉回中文)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scaleDeviceIdOf } from '../../business/mixScan.js'

const vue = readFileSync(new URL('./MobileMixDoc.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')
const ja = readFileSync(new URL('../../i18n/locales/ja.js', import.meta.url), 'utf8')

test('页面没有可编辑的数量控件(不能手填)', () => {
  // 只看模板段:CSS 里 .mp-row :deep(.el-input-number) 是与生产领料共用的行样式,不算输入控件
  const tpl = vue.slice(0, vue.indexOf('<script setup>'))
  assert.equal(tpl.includes('el-input-number'), false, '实投重量不许是输入框')
  assert.equal(vue.includes('curQty'), false, '旧的 curQty 双向绑定必须彻底删掉')
  assert.equal(vue.includes('takeScale'), false, '「取秤」按钮也去掉:数字本来就一直跟着秤跳')
  assert.equal(vue.includes('scaleLoading'), false, '取秤按钮的 loading 状态应一并删除')
})

test('实投重量是只读实时读数', () => {
  assert.match(vue, /data-test="mix-live-qty"/, '缺少实时读数容器')
  assert.match(vue, /liveQty > 0 \? fmtQty\(liveQty\) : '—'/, '读数区必须直接渲染 liveQty')
  const at = vue.indexOf('const liveQty = computed(')
  assert.ok(at > 0, '缺 liveQty')
  const seg = vue.slice(at, at + 400)
  assert.match(seg, /scaleOk\.value/, 'liveQty 必须受稳定判定约束')
  assert.match(seg, /scaleVal\.value > 0/, 'liveQty 必须来自电子秤读数')
})

test('「确认」写入的是当下秤值', () => {
  const at = vue.indexOf('async function saveQty()')
  assert.ok(at > 0, '缺 saveQty')
  const seg = vue.slice(at, at + 700)
  assert.match(seg, /const qty = liveQty\.value/, '确认必须取当前实时读数')
  assert.match(seg, /qty,[\s\S]*batch: cur\.value\.批号/, '请求体用量必须是这份秤值')
  assert.match(seg, /applyConfirm\(rows\.value, \{ code: cur\.value\.编码, qty,/, '本地回填也要用同一份秤值')
})

test('读数不稳定/取不到时确认按钮点不亮', () => {
  const at = vue.indexOf('const canConfirm = computed(')
  assert.ok(at > 0, '缺 canConfirm')
  const seg = vue.slice(at, at + 260)
  assert.match(seg, /liveQty\.value > 0/, '没读数不许确认')
  assert.match(seg, /scaleOk\.value/, '不稳定不许确认')
  assert.match(vue, /:disabled="!canConfirm"/, '按钮必须绑 canConfirm')
})

test('电子秤 1 秒一抓(实时)', () => {
  const at = vue.indexOf('function startScalePolling()')
  assert.ok(at > 0, '缺 startScalePolling')
  const seg = vue.slice(at, at + 300)
  assert.match(seg, /setInterval\(readScale, 1000\)/, '用户要的是实时读数,轮询间隔应为 1 秒')
})

test('先认准电子秤设备,再按 deviceId 取它的读数', () => {
  // 后端 /dc/monitor 不带 deviceId 时取「排序第一台设备」,实测不是秤 ⇒ 必须自己找秤
  const at = vue.indexOf('async function readScale()')
  assert.ok(at > 0, '缺 readScale')
  const seg = vue.slice(at, at + 900)
  assert.match(seg, /scaleDeviceIdOf\(/, '必须用 scaleDeviceIdOf 找秤设备')
  assert.match(seg, /params: \{ deviceId: scaleDeviceId\.value \}/, '取数要带 deviceId,否则永远读不到秤')

  const dev = (id, type, name, code) => ({ id, type, name, code })
  // 秤排在后面也要挑出来(实测设备表里第一台是「加工设备」)
  assert.equal(scaleDeviceIdOf({
    devices: [dev(7, '加工设备', '成型机 01', 'LW-001'), dev(1, '电子秤', '电子秤', 'DZ-001')],
  }), 1, '要跳过排在前面的非秤设备')
  // 只有名称能认出来,也认
  assert.equal(scaleDeviceIdOf({ devices: [dev(3, '计量设备', '台车电子秤', 'X-9')] }), 3, '名称含「秤」也要认')
  // 只有设备号像秤,也认(老数据 device_type 可能为空)
  assert.equal(scaleDeviceIdOf({ devices: [dev(5, '', '', 'DZ-007')] }), 5, 'DZ- 前缀是兜底识别')
  // 一台秤都没有:返回 null,页面退回默认 payload(不报错、不编数)
  assert.equal(scaleDeviceIdOf({ devices: [dev(7, '加工设备', '成型机 01', 'LW-001')] }), null)
  assert.equal(scaleDeviceIdOf(null), null, '载荷缺失也不能抛')
})

test('新增文案 en / ja 都有译名', () => {
  const keys = [
    '实时',
    '未稳定',
    '电子秤当前读数',
    '数量来自电子秤实时读数,核对无误后点「确认」',
    '取不到秤读数:请把料放上台车电子秤(或检查秤与网关是否在线)',
    '读数还在跳动,稳定后才可确认',
    '扫物料码解锁:只有本单混料物料清单里的料才能确认;数量只取电子秤实时读数,不能手输',
    '核对电子秤读数无误后点「确认」;确认后重新锁回扫码状态,再扫下一个物料',
  ]
  for (const k of keys) {
    assert.ok(vue.includes(k), `页面上应出现文案「${k}」`)
    assert.ok(en.includes(`'${k}'`), `en.js 缺译名:${k}`)
    assert.ok(ja.includes(`'${k}'`), `ja.js 缺译名:${k}`)
  }
})
