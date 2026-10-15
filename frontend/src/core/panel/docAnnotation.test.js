/**
 * docAnnotation.test.js —— 标注笔/橡皮擦的边界算术
 *
 * 钉子(全是"算错也不报错、只是纸面少一格或打印丢颜色"的地方):
 *   · segments 顺序拼接必须**逐字等于原文**(丢字/多字在纸面上极难发现)
 *   · 越界/取反/空区间必须被 normalize 收拾干净
 *   · 重叠时后写入覆盖先写入,且不产生重复文本
 *   · 橡皮擦命中:半开区间 [start,end),边界上不能误擦邻段
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalize, segments, hitIndex, makeAnnotation, isValidAnnotation, ANNOTATION_COLORS,
} from './docAnnotation.js'

// 下标图例(改断言前先数一遍,别凭字形猜):
//   外0 径1 5②  *3  内4  径5  2⑥  *7  长8  度9  6⑩ 0⑪      len=12
const T = '外径5*内径2*长度60'

test('segments:无标注时原样一段', () => {
  assert.deepEqual(segments(T, []), [{ text: T, color: null, bold: false }])
  assert.deepEqual(segments('', []), [])
  assert.deepEqual(segments(null, []), [])
})

test('segments:标注中间一段 → 三段,且拼接逐字等于原文', () => {
  const out = segments(T, [{ start: 2, end: 3, color: '#d0021b', bold: true }])
  assert.deepEqual(out, [
    { text: '外径', color: null, bold: false },
    { text: '5', color: '#d0021b', bold: true },
    { text: '*内径2*长度60', color: null, bold: false },
  ])
  assert.equal(out.map((s) => s.text).join(''), T)
})

test('segments:整段标注 → 一段,不产生空段', () => {
  const out = segments(T, [{ start: 0, end: T.length, color: '#116a5b', bold: true }])
  assert.equal(out.length, 1)
  assert.deepEqual(out[0], { text: T, color: '#116a5b', bold: true })
})

test('segments:多段各自成立', () => {
  const out = segments(T, [
    { start: 2, end: 3, color: '#d0021b', bold: true },   // '5'
    { start: 6, end: 7, color: '#4a6fa5', bold: false },  // '2'
  ])
  assert.equal(out.map((s) => s.text).join(''), T)
  const colored = out.filter((s) => s.color)
  assert.deepEqual(colored.map((s) => [s.text, s.color]), [['5', '#d0021b'], ['2', '#4a6fa5']])
})

test('normalize:裁越界 + 丢掉空段/反段', () => {
  const out = normalize(T, [
    { start: -5, end: 2, color: '#d0021b' },      // 起点越界 → 0
    { start: 4, end: 4, color: '#d0021b' },       // 空段 → 丢
    { start: 9, end: 100, color: '#4a6fa5' },     // 终点越界 → len
    { start: 3, end: 2, color: '#417505' },       // 反段 → 丢(不自动换序,换序是 makeAnnotation 的事)
  ])
  assert.deepEqual(out, [
    { start: 0, end: 2, color: '#d0021b' },
    { start: 9, end: T.length, color: '#4a6fa5' },
  ])
})

test('normalize:按 start 升序', () => {
  const out = normalize(T, [
    { start: 9, end: 10, color: '#a' },
    { start: 0, end: 1, color: '#b' },
  ])
  assert.deepEqual(out.map((a) => a.start), [0, 9])
})

test('normalize:重叠时后写入的覆盖先写入的(不留重复文本)', () => {
  // old[0,5) 盖 0..4(外径5*内),new[2,4) 盖 2..3(5*) ⇒ 中间被 new 顶掉,两侧仍是 old
  const out = normalize(T, [
    { start: 0, end: 5, color: '#old' },
    { start: 2, end: 4, color: '#new' },
  ])
  const segs = segments(T, out)
  assert.equal(segs.map((s) => s.text).join(''), T, '拼接必须还原原文')
  const colored = segs.filter((s) => s.color)
  assert.deepEqual(colored.map((s) => [s.text, s.color]), [
    ['外径', '#old'], ['5*', '#new'], ['内', '#old'],
  ])
})

test('hitIndex:[start,end) 半开;边界不误擦邻段', () => {
  const anns = [
    { start: 2, end: 3, color: '#a' },
    { start: 5, end: 6, color: '#b' },
  ]
  assert.equal(hitIndex(anns, 2), 0, '起点命中')
  assert.equal(hitIndex(anns, 3), -1, '终点不命中(半开)')
  assert.equal(hitIndex(anns, 5), 1)
  assert.equal(hitIndex(anns, 6), -1)
  assert.equal(hitIndex(anns, 0), -1)
  assert.equal(hitIndex([], 0), -1)
})

test('hitIndex:重叠取最内层(最后一段)', () => {
  const anns = [
    { start: 0, end: 9, color: '#outer' },
    { start: 2, end: 4, color: '#inner' },
  ]
  assert.equal(hitIndex(anns, 3), 1)
  assert.equal(hitIndex(anns, 7), 0)
})

test('makeAnnotation:自动换序、越界裁剪、空区间拒绝', () => {
  assert.equal(makeAnnotation(T, 5, 2, '#d0021b').ann.start, 2)
  assert.equal(makeAnnotation(T, 5, 2, '#d0021b').ann.end, 5)
  assert.deepEqual(makeAnnotation(T, -3, 100, '#d0021b', 1).ann, { start: 0, end: T.length, color: '#d0021b', bold: true })
  assert.equal(makeAnnotation(T, 4, 4, '#d0021b').ok, false)
  assert.equal(makeAnnotation(T, 0, 2, '').ok, false, '没选颜色不算')
})

test('色盘:8 档且都是合法 #RRGGBB', () => {
  assert.equal(ANNOTATION_COLORS.length, 8)
  for (const c of ANNOTATION_COLORS) assert.match(c, /^#[0-9a-f]{6}$/i)
})

test('isValidAnnotation:形状校验', () => {
  assert.equal(isValidAnnotation({ start: 0, end: 1, color: '#fff000' }), true)
  assert.equal(isValidAnnotation({ start: 0, end: 0, color: '#fff000' }), false)
  assert.equal(isValidAnnotation({ start: 0, end: 1 }), false)
  assert.equal(isValidAnnotation(null), false)
})
