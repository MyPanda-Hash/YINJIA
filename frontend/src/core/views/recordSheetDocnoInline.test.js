/**
 * recordSheetDocnoInline.test.js —— 数据记录表右上角编号格：前缀与编号必须同一行
 *
 * 【用户报障 2026-11-20】「项目编号：」被排到编号上面，叠成了上下两行。要求：
 *   ① 前缀与编号值同一行；
 *   ② 编号框可往左扩（左侧还有大片留白），不能因为格子窄就把前缀挤到上一行；
 *   ③ 所有数据记录表都按这个口径（RecordSheetPanels 的 7 张 + 手写纸面 DataRecordSheet）。
 *
 * 【根因】前缀是**行内** <span>，编号值/参照控件是**块级** <div> ⇒
 *   行内内容自成一行、块级另起一行，于是「项目编号：」与值上下叠。
 *
 * 【口径】
 *   · 前缀与值放进同一层单行弹性行 `.rs-docno-line--pre`
 *     （display:flex / align-items:center / justify-content:flex-end / gap:4px / white-space:nowrap）；
 *   · 值区不缩、不换行、不省略；值过长时靠 flex-end 的负剩余空间朝**左**溢出到纸张留白
 *     （不换行、不截断，也不压公司名 —— 公司名靠左，中间是空列/空格）；
 *   · flex **只加在内层 div，不能加在 <td>**：td 一旦不再是 table-cell，浏览器会另生匿名格
 *     包住它、colspan 失效（2026-11-11 实测 colspan=10 的编号格只剩一列宽）；
 *   · 打印两条路径（@media print 与 body.approval-printing）同样 nowrap，不换行、不省略。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sheet = readFileSync(new URL('./DataRecordSheet.vue', import.meta.url), 'utf8')
const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 取一条**行首**规则体（避免误中 `.rsp-sheet .x` / `x *` 这些别的选择器），声明压缩成无空格串 */
function ruleBody(src, selector) {
  const m = src.match(new RegExp('\\n' + esc(selector) + '\\s*\\{([^}]*)\\}'))
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

/** 取所有 @media print 规则体（按大括号配对，不用单行正则 —— 新规则是多行块） */
function printBodies(src) {
  const bodies = []
  const re = /@media\s+print\s*\{/g
  let m
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length
    let depth = 1
    const start = i
    while (i < src.length && depth > 0) {
      const c = src[i]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      i += 1
    }
    bodies.push(src.slice(start, i - 1))
  }
  return bodies
}

/** 功能性滤效：取报告头编号格（<td class="rs-td rs-docno"> … </td>）源码片段 */
function sheetDocnoCell() {
  const at = sheet.indexOf('<td class="rs-td rs-docno">')
  assert.ok(at >= 0, '找不到功能性滤效报告头的编号格 .rs-docno')
  const end = sheet.indexOf('</td>', at)
  assert.ok(end > at, '编号格没有闭合标签')
  return sheet.slice(at, end)
}

/** 其余 7 张：取 RecordSheetPanels 报告头编号格源码片段 */
function panelsDocnoCell() {
  const at = panels.indexOf('<td v-if="docnoSpan > 0" class="rs-td rs-docno"')
  assert.ok(at >= 0, '找不到 RecordSheetPanels 报告头的编号格 .rs-docno')
  const end = panels.indexOf('</td>', at)
  assert.ok(end > at, '编号格没有闭合标签')
  return panels.slice(at, end)
}

test('功能性滤效：前缀移入单行编号行，且排在参照/输入/只读三个分支之前', () => {
  const cell = sheetDocnoCell()
  const line = cell.indexOf('rs-docno-line')
  const pre = cell.indexOf('rs-docno-pre')
  assert.ok(line >= 0, '编号格必须有单行行容器 .rs-docno-line')
  assert.ok(pre > line, '前缀必须**在行容器之内**（在它外面就又会另起一行）')
  for (const branch of ['<div v-if="editable && isRefKey', 'class="rs-docno-input"', 'class="rs-docno-text"']) {
    assert.ok(cell.indexOf(branch) > pre, `${branch} 必须渲染在前缀之后（同一行）`)
  }
  assert.match(cell, /class="rs-docno-line rs-docno-line--pre"/, '功能性滤效本身即记录表 ⇒ 编号行常带 --pre 单行布局')
})

test('其余 7 张：编号行在 .rs-docno-in 之内，公司名（同格版式）留在行外，前缀在值之前', () => {
  const cell = panelsDocnoCell()
  const inner = cell.indexOf('rs-docno-in')
  const line = cell.indexOf('rs-docno-line')
  const pre = cell.indexOf('rs-docno-pre')
  assert.ok(inner >= 0 && line > inner, '编号行必须是 .rs-docno-in 的子元素')
  assert.ok(pre > line, '前缀必须在编号行之内')
  assert.ok(cell.indexOf('rs-company-inline') < line, '同格版式的公司名仍在行外（公司名靠左、编号靠右）')
  assert.doesNotMatch(cell.slice(0, line), /rs-docno-pre/, '前缀不能留在 <td>/<div> 的块级层（会另起一行）')
  for (const branch of ['class="rs-ref-ctl"', 'class="rs-docno-wrap"', 'class="rs-docno-static"']) {
    assert.ok(cell.indexOf(branch) > pre, `${branch} 必须渲染在前缀之后（同一行）`)
  }
  // 双源面板才加 --pre；其它 23 个面板的编号格（有 docNoStatic/别的编号）逐字不动的布局
  assert.match(cell, /:class="\{ 'rs-docno-line--pre': !!cfg\.dualDocNo \}"/, '单行布局只对 dualDocNo 记录表生效')
})

test('单行弹性布局落在内层 div 上（flex / 居中 / 右对齐 / gap 4px / nowrap）', () => {
  for (const [src, file] of [[sheet, 'DataRecordSheet.vue'], [panels, 'RecordSheetPanels.vue']]) {
    const body = ruleBody(src, '.rs-docno-line--pre')
    assert.ok(body, `${file} 缺少 .rs-docno-line--pre 规则`)
    for (const decl of ['display: flex', 'align-items: center', 'justify-content: flex-end', 'gap: 4px', 'white-space: nowrap']) {
      assert.ok(body.includes(decl), `${file} 的编号行缺 ${decl}`)
    }
    // 值过长要溢出到左侧留白：不许裁切/省略号
    assert.ok(!/overflow:\s*hidden/.test(body), `${file} 的编号行不能 overflow:hidden（会把左溢出的值裁掉）`)
    assert.ok(!/text-overflow:\s*ellipsis/.test(body), `${file} 的编号行不能省略号截断`)
    // 值区不许被 flex 压扁（压扁 + nowrap 会变成文字溢出到别的格子）
    const child = ruleBody(src, '.rs-docno-line--pre > *')
    assert.ok(child, `${file} 缺 .rs-docno-line--pre > * 规则`)
    assert.ok(child.includes('flex: 0 0 auto'), `${file} 值区必须 flex: 0 0 auto（不缩）`)
  }
})

test('flex 不能加在 <td class="rs-docno"> 上（会丢 colspan，公司名与编号挤成两行）', () => {
  const body = ruleBody(panels, '.rs-docno')
  assert.ok(body, 'RecordSheetPanels 缺少 .rs-docno 规则')
  assert.ok(!body.includes('display:flex'), '.rs-docno 是 <td>，加 flex 会让它脱离 table-cell、colspan 失效')
  assert.ok(!body.includes('display:grid'), '.rs-docno 是 <td>，不能改成 grid')
})

test('前缀样式两处同款：12px / #595959 / nowrap，间距统一由 gap 给', () => {
  const own = ruleBody(sheet, '.rs-docno-pre')
  const other = ruleBody(panels, '.rs-docno-pre')
  assert.ok(own && other, '两处都要有 .rs-docno-pre 规则')
  assert.equal(own, other, '两处样式要完全一致，别各自漂移')
  assert.equal(own, 'flex: none; white-space: nowrap; font-size: 12px; color: #595959;')
})

test('打印两条路径都保持编号单行（@media print 与 body.approval-printing）', () => {
  for (const [src, file] of [[sheet, 'DataRecordSheet.vue'], [panels, 'RecordSheetPanels.vue']]) {
    const hit = printBodies(src).find((b) => b.includes('.rs-docno-line--pre'))
    assert.ok(hit, `${file} 的 @media print 缺编号行规则（打印会把值折行/截断）`)
    assert.match(hit, /white-space:\s*nowrap\s*!important/, `${file} 打印态编号行必须 nowrap`)
    assert.ok(!/display:\s*none/.test(hit), `${file} 打印态不能把编号行藏掉`)
    assert.match(src, /body\.approval-printing [^{]*\.rs-docno-line--pre/, `${file} 缺侧栏打印（body.approval-printing）同款规则`)
    const ap = src.match(/body\.approval-printing [^{]*\.rs-docno-line--pre[^{]*\{([^}]*)\}/)
    assert.ok(ap, `${file} 的 body.approval-printing 规则体读不到`)
    assert.match(ap[1], /white-space:\s*nowrap\s*!important/, `${file} 侧栏打印态编号行必须 nowrap`)
  }
})
