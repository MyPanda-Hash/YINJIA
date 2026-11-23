/**
 * 样品模块的侧边栏「单据预览」改名「样品查询」（2026-11-23 用户口径）：
 *   「样品模块的侧边栏的单据预览改名为样品查询」。
 * 三张样品单（外部开发 / 内部开发 / 外部非开发）统一改名，按钮与浮层标题同名；
 * 其它面板的文案不动（产品搜索 / 立项查询 / 单据预览）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

const btn = src.slice(src.indexOf('const previewBtnLabel = computed'), src.indexOf('const previewOverlayTitle'))
const title = src.slice(src.indexOf('const previewOverlayTitle'), src.indexOf('const approvalPreviewOpen'))

test('三张样品单在改名名单里', () => {
  const m = src.match(/const SAMPLE_PANELS = new Set\(\[([^\]]+)\]\)/)
  assert.ok(m, '缺 SAMPLE_PANELS 常量')
  for (const p of ['RD_SAMPLE_EXT', 'RD_SAMPLE_INT', 'RD_SAMPLE_ND']) {
    assert.ok(m[1].includes(p), `名单缺 ${p}`)
  }
})

test('按钮与浮层标题都返回「样品查询」', () => {
  assert.match(btn, /SAMPLE_PANELS\.has\(p\)\) return '样品查询'/, '按钮未改名')
  assert.match(title, /SAMPLE_PANELS\.has\(p\)\) return '样品查询'/, '浮层标题未改名')
})

test('其它面板文案不变（产品搜索 / 立项查询 / 单据预览）', () => {
  assert.match(btn, /RD_PROD_INFO'\) return '产品搜索'/)
  assert.match(btn, /RD_APPROVAL'\) return '立项查询'/)
  assert.match(btn, /return '单据预览'$|return '单据预览'\s*\n\}/m)
  assert.match(title, /RD_PROD_INFO'\) return '产品信息查询'/)
  assert.match(title, /RD_APPROVAL'\) return '立项查询'/)
})
