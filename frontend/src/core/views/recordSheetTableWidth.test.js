/**
 * recordSheetTableWidth.test.js — 数据记录表「表格宽 = colgroup 宽」钉子
 *
 * 【2026-11-17 生产缺陷】碱性(RD_ALKALINE)纸面：上方章节表 1183px，
 *   下方「3.测试数据」表 1540px —— 下边那排填写数据的列整个比纸宽出去一大截
 *   （用户口径「就是下面的那些填写数据的列比上边的超出来」）。
 *
 * 【根因（浏览器实测）】数据表有两条「宽度」口径：
 *   · <table style="width: …">      走 dtOwnsWidth(dt) ? dtW(dt) : …   —— dtW **不乘 dtFillK**
 *   · <colgroup><col style="width">  走 (c.w||100) * dtFillK(dt)        —— 已缩放到纸宽
 *   平时两者相等（只有 yj_field 的 detail 字段带 width 时 dtOwnsWidth 才为真，
 *   而 8 张记录表的静态列本来都不带 w）。一旦有人用「字段管理」加一列
 *   （碱性实测：备用2「累积流量」/ 备用3「累积流量（L）」，width=120），
 *   dtFillK = 1183/1540 生效，colgroup 缩到 1183，width 却还是 1540 ⇒
 *   表被撑宽到 1540，整张纸跟着变宽，上方章节表停在 1183。实测纸面 1540 / 上方 1183。
 *
 * 【口径】<table> 的 width 必须与 colgroup 同源：两者都走 dtTableW(dt)
 *   （= 含 span 的列宽和 × design/dtFillK）。equal 是结构性要求，
 *   不是「顺手把数字调成一样」——单测跑不了布局，按仓库既有做法钉住源码（同 docSheetFitWidth.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')

/** 取数据表 <table ...> 起始标签（rs-dt 只在模板里出现一次） */
function dtTableTag() {
  const i = sheet.indexOf('class="rs-t rs-dt"')
  assert.ok(i > 0, '找不到数据表 <table class="rs-t rs-dt">')
  const start = sheet.lastIndexOf('<table', i)
  const end = sheet.indexOf('>', i)
  return sheet.slice(start, end + 1)
}

test('① 数据表 <table> 的 width 与 colgroup 同源（都走 dtTableW，否则加一列就撑破纸面）', () => {
  const tag = dtTableTag()
  // 宽度是三元：dtOwnsWidth(dt) ? dtTableW(dt) : plain/grid —— 关键是「自持列宽」那条分支用哪个函数
  assert.match(tag, /dtOwnsWidth\(dt\)\s*\?\s*dtTableW\(dt\)/,
    '<table> 自持列宽时必须用 dtTableW(dt)（含 span、含 dtFillK），不能是未缩放的 dtW(dt)')
  // dtTableW 内部会调用 dtTableW(…) 之外不得再有裸 dtW( —— 那是不乘缩放系数的旧口径
  assert.ok(!/dtW\(dt\)/.test(tag.replace(/dtTableW\(dt\)/g, '')),
    '<table> 的 width 不得再退回 dtW(dt)（不乘 dtFillK ⇒ 加列后表比纸宽）')
})

test('② colgroup 与 table 用同一个缩放系数（不能一边 dtFillK 一边 1）', () => {
  const i = sheet.indexOf('class="rs-t rs-dt"')
  const block = sheet.slice(i, sheet.indexOf('</colgroup>', i))
  assert.match(block, /dtFillK\(dt\)/, 'colgroup 的列宽必须乘 dtFillK')
  assert.match(block, /\(\s*c\.span \|\| 1\s*\)/, '缩放必须按 span 计入宽度（与 dtTableW/dtColSum 同口径）')
})

test('③ dtTableW 与 colgroup 完全同口径（列**总**宽 × 缩放，不再乘 span）', () => {
  // 2026-11-18 口径变更：`w` = 该列总宽。
  //   旧写法 `span × w` 会让 span 列被放大 N 倍（炭棒配方表 780 → 1779px 溢出纸面）。
  //   现在三处同源：colgroup 宽度 = (w×K)/span，dtColSum / dtFillK.want = Σw。
  const m = sheet.match(/function dtTableW\(dt\)[\s\S]*?\n\}/)
  assert.ok(m, '找不到 dtTableW')
  assert.match(m[0], /dtColSum\(dt\)/, 'dtTableW 必须基于 dtColSum')
  assert.match(m[0], /dtFillK\(dt\)/, 'dtTableW 必须乘 dtFillK')
  const s = sheet.match(/function dtColSum\(dt\)[\s\S]*?\n\}/)
  assert.ok(s, '找不到 dtColSum')
  assert.doesNotMatch(s[0], /\(c\.span \|\| 1\)\s*\*/, 'dtColSum 不得再乘 span')
  assert.match(s[0], /sum \+ \(c\.w \|\| 100\)/, 'dtColSum 按列总宽累加')
})

test('④ 「＋ 新增数据记录行」条与表格同宽（不能被漏下）', () => {
  const line = sheet.split('\n').find((l) => l.includes('新增数据记录行') && l.includes('class="rs-add"'))
  assert.ok(line, '找不到加行条')
  assert.match(line, /dtTableW\(dt\)/, '加行条宽度必须与表格同源')
})
