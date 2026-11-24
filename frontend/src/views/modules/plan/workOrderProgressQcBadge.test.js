/**
 * workOrderProgressQcBadge.test.js —— 「待检验只做信息提示」的回归钉子(2026-11-24)。
 *
 * 用户口径(两轮原话):
 *   1)「这个待检验需要能制作的更加明显，符合操作逻辑」⇒ 环下检验徽标原来只有 10px/14px,确实看不清;
 *   2)「卡在检验这道关卡 —— 这个不需要，因为当前的检验不卡整体的工单流程」
 *      + 「『!』角标和实心块显得土/像报警」「文案不对（待开单/去开单 这类说法）」
 *      「刚改完的观感跟系统其他页面不搭」
 * ⇒ 最终做法(用户拍板「按推荐执行」)= **只**把徽标升到与页面其它状态标签同规格
 *   (11px / 18px 高 / radius 10px),位置、浅底配色、文案全不动;整环染色 / 光圈 / 角标 /
 *   实心块 / 关卡节点 / 新状态词 一律不许再加回来。
 *
 * 这些断言都是「口径」而不是「实现细节」,口径变了就同步改这里(并在注释里写明用户原话)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ring = readFileSync(new URL('./WoProgressRing.vue', import.meta.url), 'utf8')
const board = readFileSync(new URL('./WorkOrderProgressBoard.vue', import.meta.url), 'utf8')
const chain = readFileSync(new URL('./WoProgressChain.vue', import.meta.url), 'utf8')

test('① 徽标规格 = 与页面其它状态标签一致(11px / 18px 高 / radius 10px)', () => {
  const block = ring.match(/\.wpr-ins \{[\s\S]*?\n\}/)
  assert.ok(block, '找不到 .wpr-ins 规则')
  const css = block[0]
  assert.match(css, /font-size: 11px;/, '字号要 11px(与 .wpb-qc / .wpb-status 同规格)')
  assert.match(css, /line-height: 18px;/, '行高要 18px')
  assert.match(css, /border-radius: 10px;/, '圆角要 10px')
  assert.match(css, /padding: 0 6px;/, '内边距要 0 6px')
  // 行级徽标(.wpb-qc)仍是同一套数值:两处必须同规格,不然又「跟系统其它页面不搭」
  assert.match(board, /\.wpb-qc \{[\s\S]*?padding: 0 6px;[\s\S]*?border-radius: 10px;[\s\S]*?font-size: 11px;[\s\S]*?line-height: 18px;/,
    '行级徽标 .wpb-qc 也应是 11px / 18px / radius 10')
})

test('② 不许再给工序环染色/加角标(检验不阻断流程,也不该像报警)', () => {
  assert.doesNotMatch(ring, /is-waiting/, '不许再加「等品质」整环态')
  assert.doesNotMatch(ring, /wpr-flag/, '不许再加环角「!」角标')
  assert.doesNotMatch(ring, /\.wpr\.is-waiting \.wpr-ring \{[\s\S]*?box-shadow/, '不许加光圈')
  const wait = ring.match(/\.wpr-ins\.ins-wait \{[\s\S]*?\n\}/)
  assert.ok(wait, '找不到 .wpr-ins.ins-wait 规则')
  assert.match(wait[0], /background: #fdf6ec;/, '待检验徽标仍是浅底')
  assert.doesNotMatch(wait[0], /background: #e6a23c;/, '不许改成实心橙块')
  assert.doesNotMatch(wait[0], /font-weight: 700;/, '不许加粗成告警样式')
})

/** 去掉注释后再查词:注释里写「明确不做 待开单」是在解释口径,不算违规文案 */
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')
}

test('③ 不许自造状态词(待开单 / 去开单 / 去检验 …),缺单只在 title 里说「暂无检验单」', () => {
  for (const src of [ring, board, chain]) {
    const code = stripComments(src)
    for (const word of ['待开单', '去开单', '去检验', '应开检验单', '已打开检验面板']) {
      assert.ok(!code.includes(word), `代码/模板里出现了自造词「${word}」`)
    }
  }
  assert.ok(ring.includes("tt('暂无检验单')"), '缺单信息应留在悬停 title 里(沿用既有词条)')
})

test('④ 行级徽标/提示条/图例保持原样(本次只动环下徽标一条 CSS)', () => {
  assert.match(board, /\.wpb-qc\.tone-warn \{\s*\n\s*background: #fdf6ec;\s*\n\s*color: #e6a23c;/, '行级徽标仍浅底橙字')
  assert.doesNotMatch(board, /is-urgent/, '不许再给行级徽标加「紧急」实心态')
  assert.doesNotMatch(board, /wpb-qc-hint-ic/, '不许再给提示条加感叹号图标')
  assert.match(board, /\.wpb-qc-hint \{[\s\S]*?color: #e6a23c;/, '提示条仍是原来那行橙字')
  assert.doesNotMatch(board, /lg-wait/, '图例不许再加「橙=待检验」色点')
})
