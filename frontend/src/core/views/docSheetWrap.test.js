import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 文书纸面「自动换行」回归(2026-10-25 用户口径:
 *   「这个研发管理模块的表不会自动换行,现在确定一下宽度,固定宽度然后可以自动换行」)。
 *
 * 背景:纸宽早就定死了(RD_APPROVAL/RD_PLAN = 1242),但**单元格里的长内容不换行** ——
 *   文本域默认只对真实换行生效,一长串连续字符(客户名/机型/一串数字)会顶出格子;
 *   只读态是 AnnotatedText 的 inline span,同样按最长不可断词算宽。
 *
 * 这些断言钉住三件事,任何一条被删都会让「长文本又顶出格子」:
 *   ① 纸面范围内的文本容器都允许换行(pre-wrap)
 *   ② 任意长串可在字符间断行(word-break / overflow-wrap,不是只有 hyphens)
 *   ③ 值区允许收缩(min-width:0),且**不许**用 ellipsis/nowrap 截断单行长文本字段
 */

const SRC = path.resolve(import.meta.dirname, 'DocSheet.vue')
const css = fs.readFileSync(SRC, 'utf8')

/** 取 <style> 段(避免把 template 里的字符串算进来) */
const styleBlock = (() => {
  const m = css.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  return m ? m[1] : ''
})()

test('纸面文本容器统一允许换行(pre-wrap)', () => {
  assert.ok(styleBlock.includes('white-space: pre-wrap'), '缺少 pre-wrap 换行声明')
  for (const sel of ['.as-ro-text', '.q-ro', '.ann-host', '.ann-seg', 'el-textarea__inner']) {
    assert.ok(styleBlock.includes(sel), `换行规则应覆盖 ${sel}`)
  }
})

test('任意长串可在字符间断行(不只靠连字符)', () => {
  assert.ok(/word-break:\s*break-word/.test(styleBlock), '缺少 word-break: break-word')
  assert.ok(/overflow-wrap:\s*anywhere/.test(styleBlock), '缺少 overflow-wrap: anywhere')
})

test('值区/填写区可收缩,不会按内容把整行撑出纸外', () => {
  for (const sel of ['.as-fill', '.as-fill-main', '.q-value', '.q-section-body']) {
    const idx = styleBlock.indexOf(sel)
    assert.ok(idx >= 0, `${sel} 缺少样式`)
  }
  assert.ok(/min-width:\s*0/.test(styleBlock), '缺少 min-width: 0 收缩兜底')
})

test('长文本字段不得被 ellipsis 截断(纸面是打印件)', () => {
  // 按「选择器 { 声明 }」成对解析,避免把相邻规则的选择器与别处的声明混在一起判断。
  // 允许单行 input(单据号/日期)用 ellipsis;textarea / 只读文本不许。
  const rules = [...styleBlock.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ sel: m[1].trim(), body: m[2] }))
  const longText = rules.filter((r) =>
    /el-textarea__inner|\.as-ro-text|\.q-ro/.test(r.sel) && !/\.el-input__inner/.test(r.sel))
  assert.ok(longText.length > 0, '应能解析出 textarea/只读文本规则')

  const ellipsis = longText.filter((r) => /text-overflow:\s*ellipsis/.test(r.body))
  assert.equal(ellipsis.length, 0,
    'textarea/只读文本不得用 text-overflow: ellipsis:\n' + ellipsis.map((r) => r.sel).join('\n'))

  const nowrap = longText.filter((r) => /white-space:\s*nowrap/.test(r.body))
  assert.equal(nowrap.length, 0,
    'textarea/只读文本不得 white-space: nowrap:\n' + nowrap.map((r) => r.sel).join('\n'))
})

test('两份研发文书都定死纸宽(换行必须建立在确定宽度上)', async () => {
  const cfg = await import('./docSheetConfigs.js')
  assert.equal(cfg.fixedSheetWidth('RD_APPROVAL'), 1242)
  assert.equal(cfg.fixedSheetWidth('RD_PLAN'), 1242)
})

test('文本域不得被锁死高度(否则长文本只能框内滚动/被裁)', () => {
  // 2026-10-25 实测:「滤芯/炭棒规格」行 360 字需 143px,而 height:100%!important 把它锁在 101px 行高内。
  // 纸面是打印件,裁掉即丢内容 ⇒ 必须是内容自适应高度。
  const rules = [...styleBlock.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({
      sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(),
      // 注释里会引用旧写法(height:100%!important),必须一并剥掉,否则断言被注释骗过
      body: m[2].replace(/\/\*[\s\S]*?\*\//g, ''),
    }))
  const area = rules.filter((r) => /as-fill-area/.test(r.sel) && /el-textarea__inner/.test(r.sel))
  assert.ok(area.length > 0, '应存在 as-fill-area 内 textarea 规则')

  // 任何锁死高度的写法都不允许(无论 100% 还是 !important)
  const locked = area.filter((r) => /height:\s*100%\s*!important/.test(r.body))
  assert.equal(locked.length, 0,
    'textarea 不得 height:100%!important(会裁掉换行后的长文本):\n' + locked.map((r) => r.sel).join('\n'))

  // 填写区那条必须显式 auto(按选择器精确匹配,别把同批其它规则算进来);
  // 2026-10-25 起高度由 Element Plus autosize 接管,故不能加 !important(会压掉内联高度)
  const auto = area.filter((r) => /^\.as-fill-main \.as-fill-area/.test(r.sel))
  assert.ok(auto.length > 0, '应有 .as-fill-main .as-fill-area 内 textarea 规则')
  for (const r of auto) {
    assert.ok(/height:\s*auto/.test(r.body),
      '.as-fill-main .as-fill-area textarea 应为 height:auto:\n' + r.sel + '\n' + r.body)
    assert.ok(!/height:\s*auto\s*!important/.test(r.body),
      'textarea 不得用 !important 覆盖 autosize 的内联高度:\n' + r.sel)
  }

  // 大填写区(q-col)同样不能锁死:允许 auto + min-height,但不得裸 height:100%
  const qcol = area.filter((r) => /q-col/.test(r.sel))
  for (const r of qcol) {
    const heightDecls = [...r.body.matchAll(/(^|[;\s])height\s*:\s*([^;]+)/g)].map((m) => m[2].trim())
    // min-height 不会被上面的正则命中(要求 height 前是行首/分号/空白),这里只判真实 height
    assert.ok(!heightDecls.some((v) => /^100%/.test(v)),
      '.q-value.q-col textarea 不得 height:100%(长文本会被裁):\n' + r.sel + '\n' + r.body)
    assert.ok(heightDecls.some((v) => /^auto/.test(v)),
      '.q-value.q-col textarea 应为内容自适应高度:\n' + r.sel + '\n' + r.body)
  }
  assert.ok(/overflow-y:\s*hidden/.test(styleBlock), '长文本应在纸面展开而不是框内滚动')
})
