/**
 * prodDocListLayout.test.js —— 产品文件列表(RD_PROD_DOCLIST)布局钉子
 *
 * 【2026-11-11 实测缺陷】1440 窗口打开该面板，右侧 176px 操作栏被整条推出视口
 * （`railClipped=true`，rail.right=1604 > vw=1440），面板正文也出现 180px 横向溢出。
 *
 * 【根因】`.approval-layout :deep(.approval-sheet/.progress-sheet/.catalog-sheet/.qc-rec-sheet)`
 *   那一组只给了"纸面类"组件 `flex:1; min-width:0`，而本面板的根节点是普通 div `.prod-doc-sheet`
 *   —— 它没被任何规则覆盖 ⇒ 按 min-content 撑开（4 文件×状态矩阵最小列宽和 1216 + padding），
 *   容器装不下就顶出去，把 `.approval-side`（flex:none 176px）挤出屏幕。
 *
 * 【判据】根节点必须进那组弹性规则，横向溢出交给组件自己的 `.pds-scroll{overflow:auto}` 承担。
 *   单测跑不了 CSS，按仓库既有做法读源码钉住（同 docSheetWidth.test.js）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const sheet = readFileSync(new URL('./ProdDocListSheet.vue', import.meta.url), 'utf8')

test('产品文件列表根节点进了 .approval-layout 的弹性规则(flex:1 + min-width:0)', () => {
  const block = panelx.match(/\.approval-layout :deep\(\.approval-sheet\)[\s\S]*?\n\}/)
  assert.ok(block, '找不到 .approval-layout :deep(.approval-sheet) 那组弹性规则')
  assert.match(block[0], /\.prod-doc-sheet/, '弹性规则必须包含 .prod-doc-sheet（否则右侧操作栏被顶出视口）')
  assert.match(block[0], /min-width:\s*0/, '必须 min-width:0（否则 min-content 撑开容器）')
})

test('横向溢出由组件自己的 .pds-scroll 承担', () => {
  assert.match(sheet, /\.pds-scroll \{[^}]*overflow:\s*auto/, '.pds-scroll 必须 overflow:auto')
})
