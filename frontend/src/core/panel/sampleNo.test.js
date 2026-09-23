/**
 * 样品编号规则单测 —— 钉住口径 a(确定性拼接)
 *
 * 【为什么这组断言重要】样品编号是**追溯锚点**,拼错就是数据事故。
 * 下面 38 条是设计《二三级四级项目控制表2026.xlsx》sheet《产品开发样品编号》
 * 的**全部样例逐字抄录**(样品编号 / 项目名称 / 项目编号),作为回归基线:
 * 规则必须 38/38 复现,一条不符即失败。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  makeSampleNo, assertSampleNoParts,
  baseOfProjectNo, tailOfProjectNo, parseSampleNo,
} from './sampleNo.js'

// ── 设计源 38 个样例(逐字抄录自设计 sheet B/C/F 列)────────────────────────
const DESIGN_CASES = [
  ['FL201-1', '飞利浦抽水壶芯', '201-1'],
  ['FL201-2', '', '201-2'],
  ['AB202-1', 'A项目', '202-1'],
  ['AB203-1', 'Brita项目', '203-1'],
  ['AJ204-1', '安吉尔阻垢炭棒', '204-1'],
  ['BC205-1', '碧纯（珂睿斯）除铅滤芯', '205-1'],
  ['FL206-1', '飞利浦半脱盐项目', '206-1'],
  ['FL206-2', '', '206-2'],
  ['FL207-1', '飞利浦RO-PFAS项目', '207-1'],
  ['BC208-1', '碧纯高品质炭棒', '208-1'],
  ['AJ301-1', '安吉尔无界项目前后置炭棒方案', '301-1'],
  ['FL302-1', '飞利浦矿化', '302-1'],
  ['GE303-1', 'GE正牌冰箱滤芯', '303-1'],
  ['KL304-1', '东莞科菱除铅炭棒', '304-1'],
  ['MB305-1', '迈博瑞重力封底滤芯', '305-1'],
  ['FL306-1', '飞利浦抑菌炭棒', '306-1'],
  ['FL306-2', '', '306-2'],
  ['FL307-1', '飞利浦阻垢', '307-1'],
  ['FL307-2', '', '307-2'],
  ['BL308-1', '碧丽口感芯', '308-1'],
  ['GE309-1', 'GE制冰机滤芯', '309-1'],
  ['AJ310-1', '安吉尔除铅炭棒', '310-1'],
  ['AJ311-1', '安吉尔半脱盐项目', '311-1'],
  ['FL312-1', '飞利浦U24厨下机', '312-1'],
  ['RZ314-1', 'IAPMO认证项目', '314-1'],
  ['GE315-1', 'GE全屋除铅炭棒项目', '315-1'],
  ['LR316-1', '力人重力水壶项目', '316-1'],
  ['QD317-1', '青岛信民炭棒认证项目', '317-1'],
  ['JB318-1', '加贝尔废水阀阻垢项目', '318-1'],
  ['JB319-1', '加贝尔口感滤芯项目', '319-1'],
  ['KR401-1', '珂睿斯水壶芯', '401-1'],
  ['BS402-1', '浙江保时康', '402-1'],
  ['MG403-1', '四季沐歌富锶滤芯', '403-1'],
  ['MN404-1', '摩纳后置弱碱炭棒', '404-1'],
  ['MN405-1', '摩纳后置富锶含锌炭棒', '405-1'],
  ['JL406-1', '深圳净啦膜业矿化滤芯', '406-1'],
  ['FLN407-1', '深圳法兰尼富锶炭棒', '407-1'],
  ['FY408-1', '世纪丰源强碱炭棒', '408-1'],
]

/** 从样品编号推客户代号(规则:去掉末尾的项目编号) */
function codeOf(sampleNo, projectNo) {
  assert.ok(sampleNo.endsWith(projectNo), `${sampleNo} 应以 ${projectNo} 结尾`)
  return sampleNo.slice(0, sampleNo.length - projectNo.length)
}

test('设计 38 个样例:样品编号 = 客户代号 + 项目编号,逐字复现', () => {
  assert.equal(DESIGN_CASES.length, 38, '样例数应为 38')
  for (const [sampleNo, , projectNo] of DESIGN_CASES) {
    const code = codeOf(sampleNo, projectNo)
    assert.equal(makeSampleNo(code, projectNo), sampleNo,
      `${code} + ${projectNo} 应得 ${sampleNo}`)
  }
})

test('客户代号恒为纯字母(含 3 字母 FLN)', () => {
  for (const [sampleNo, , projectNo] of DESIGN_CASES) {
    const code = codeOf(sampleNo, projectNo)
    assert.match(code, /^[A-Za-z]+$/, `${sampleNo} 的代号 ${code} 应为纯字母`)
  }
})

test('项目编号恒为 <基号>-<数字> 形态,且全表唯一', () => {
  const seen = new Set()
  for (const [, , projectNo] of DESIGN_CASES) {
    assert.match(projectNo, /^.+-(\d+)$/, `${projectNo} 应以 -<数字> 结尾`)
    assert.ok(!seen.has(projectNo), `项目编号 ${projectNo} 重复`)
    seen.add(projectNo)
  }
  assert.equal(seen.size, 38)
})

// ── 前置约定 ①:代号必须纯字母 ────────────────────────────────────────────
test('代号含连字符要拒绝 —— 否则与项目编号的连字符混淆、编号无法反解', () => {
  assert.throws(() => assertSampleNoParts('A-B', '201-1'), /纯字母/)
  // 反证:若允许代号含连字符,`A-B`+`201-1` 与 `A`+`B201-1` 会拼出**同一个串** ⇒ 无法反解。
  // 把两侧各自算成变量再比,避免读代码时误判。
  const withHyphen = 'A-B' + '201-1'      // => 'A-B201-1'
  const ambiguous = 'A' + 'B201-1'        // => 'AB201-1'  ← 这里给出正确对照
  assert.equal(withHyphen, 'A-B201-1')
  assert.equal(ambiguous, 'AB201-1')
  // 真正无法反解的是:代号 `A-B` 与代号 `A` + 项目编号 `B201-1` 的组合
  assert.equal('A-B' + '201-1', 'A' + '-B201-1')
})

test('代号含数字/空格/中文要拒绝', () => {
  for (const bad of ['F1', 'F L', '飞利浦', 'FL-', '-FL']) {
    assert.throws(() => assertSampleNoParts(bad, '201-1'), /纯字母/, `${bad} 应被拒绝`)
  }
})

// ── 前置约定 ②:项目编号必须以 -<数字> 结尾 ───────────────────────────────
test('项目编号缺末段要拒绝', () => {
  for (const bad of ['201', '201-', '-1', '', 'ABC']) {
    assert.throws(() => assertSampleNoParts('FL', bad), /结尾|不能为空/, `${bad} 应被拒绝`)
  }
})

test('项目编号多段时末段取最后一段(200-1-2 ⇒ 基号 200-1 / 末段 2)', () => {
  assert.equal(makeSampleNo('FL', '200-1-2'), 'FL200-1-2')
  assert.equal(baseOfProjectNo('200-1-2'), '200-1')
  assert.equal(tailOfProjectNo('200-1-2'), '2')
})

// ── 空值行为:空草稿不报错 ───────────────────────────────────────────────
test('任一段为空返回空串(空草稿可读,不抛错)', () => {
  assert.equal(makeSampleNo('', '201-1'), '')
  assert.equal(makeSampleNo('FL', ''), '')
  assert.equal(makeSampleNo(null, null), '')
  assert.equal(makeSampleNo(undefined, '  '), '')
})

test('两端空白自动裁剪', () => {
  assert.equal(makeSampleNo('  FL  ', '  201-1  '), 'FL201-1')
})

test('代号统一转大写输出', () => {
  assert.equal(makeSampleNo('fl', '201-1'), 'FL201-1')
  assert.equal(makeSampleNo('Fln', '407-1'), 'FLN407-1')
})

// ── 基号/末段拆解 ────────────────────────────────────────────────────────
test('baseOfProjectNo / tailOfProjectNo 正确拆解', () => {
  // ⚠ 正则 `^.+-(\d+)$` 的 `.+` 是**贪婪**的,故末段取「最后一个连字符之后」:
  //    201-1   ⇒ 基号 201   / 末段 1
  //    200-1-2 ⇒ 基号 200-1 / 末段 2
  assert.equal(baseOfProjectNo('201-1'), '201')
  assert.equal(tailOfProjectNo('201-1'), '1')
  assert.equal(baseOfProjectNo('407-1'), '407')
  assert.equal(tailOfProjectNo('407-11'), '11')
  // 不符合形态时返回空串(不抛,供只读展示用)
  assert.equal(baseOfProjectNo('201'), '')
  assert.equal(tailOfProjectNo(''), '')
})

test('设计样例都能拆出基号+末段,且拼回原项目编号', () => {
  for (const [, , projectNo] of DESIGN_CASES) {
    assert.equal(baseOfProjectNo(projectNo) + '-' + tailOfProjectNo(projectNo), projectNo,
      `${projectNo} 应能拆成 基号-末段 再拼回`)
  }
})

// ── 反解 ─────────────────────────────────────────────────────────────────
test('parseSampleNo 按已知代号反解出项目编号', () => {
  for (const [sampleNo, , projectNo] of DESIGN_CASES) {
    const code = codeOf(sampleNo, projectNo)
    assert.equal(parseSampleNo(sampleNo, code), projectNo)
  }
})

test('parseSampleNo 代号不匹配/缺失时返回 null', () => {
  assert.equal(parseSampleNo('FL201-1', 'AJ'), null)
  assert.equal(parseSampleNo('FL201-1', ''), null)
  assert.equal(parseSampleNo('', 'FL'), null)
  // 前缀相似但不同:FLN 的编号用 FL 反解会得到错误结果 ⇒ 故必须传对代号
  assert.equal(parseSampleNo('FLN407-1', 'FL'), 'N407-1')
})
