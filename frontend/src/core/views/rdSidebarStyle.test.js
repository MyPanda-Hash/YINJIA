/**
 * 研发管理侧边栏按设计库口径重做（2026-11-23 用户口径：
 *   「我觉得这个研发管理的侧边栏样式不好看，尝试使用设计库进行优化一下」）。
 *
 * 取值全部来自 antd 设计库 light token：
 *   colorBorder #d9d9d9 / colorBorderSecondary #f0f0f0 / colorText rgba(0,0,0,.88)
 *   colorTextSecondary rgba(0,0,0,.65) / colorTextTertiary rgba(0,0,0,.45)
 *   colorPrimary #1677ff / colorError #ff4d4f / colorErrorBorder #ffccc7
 *   controlHeight 32 / borderRadius 6
 * 作用域必须限定在 .approval-side.is-rd —— 其它模块观感不变。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('RD 类只在研发面板挂上（不波及其它模块）', () => {
  assert.match(src, /'is-rd': isRdPanel/, '根容器未按 isRdPanel 挂类')
  assert.match(src, /const isRdPanel = computed\(\(\) => String\(panelCode\.value \|\| ''\)\.startsWith\('RD_'\)\)/)
})

test('按钮统一 32px 高 / 6px 圆角 / #d9d9d9 边框', () => {
  const seg = src.slice(src.indexOf('.approval-side.is-rd .as-side-btn {'), src.indexOf('.approval-side.is-rd .as-side-btn:hover'))
  assert.match(seg, /height: 32px/, '控件高应为 controlHeight 32')
  assert.match(seg, /border-radius: 6px/, '圆角应为 borderRadius 6')
  assert.match(seg, /border: 1px solid #d9d9d9/, '边框应为 colorBorder')
  assert.match(seg, /font-size: 13px/, '正文 13px')
})

test('主按钮改用设计库主色 #1677ff（不再自定义深蓝）', () => {
  const seg = src.slice(src.indexOf('.approval-side.is-rd .as-side-btn.primary {'), src.indexOf('.approval-side.is-rd .as-side-btn.primary:hover'))
  assert.match(seg, /background: #1677ff/)
  assert.match(seg, /border-color: #1677ff/)
})

test('分组标题用三级文字色 + 细实线分隔', () => {
  const seg = src.slice(src.indexOf('.approval-side.is-rd .as-side-section {'), src.indexOf('.approval-side.is-rd .as-side-section:first-child'))
  assert.match(seg, /color: rgba\(0, 0, 0, 0\.45\)/, 'colorTextTertiary')
  assert.match(seg, /border-bottom: 1px solid #f0f0f0/, 'colorBorderSecondary')
})

test('危险操作走设计库 error 色系', () => {
  const seg = src.slice(src.indexOf('.approval-side.is-rd .as-side-del.danger .as-side-btn {'), src.indexOf('.approval-side.is-rd .as-side-del.danger .as-side-btn:hover'))
  assert.match(seg, /color: #ff4d4f/)
  assert.match(seg, /border-color: #ffccc7/)
})

test('禁 transition: all（项目红线）', () => {
  assert.ok(!/\.approval-side\.is-rd[^{]*\{[^}]*transition:\s*all/.test(src), 'is-rd 样式里不得出现 transition: all')
})
