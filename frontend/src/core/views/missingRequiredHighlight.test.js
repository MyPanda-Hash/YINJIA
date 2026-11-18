/**
 * 必填缺失的「高亮 + 红星」在**单据卡片 / 网格布局**上也要有（2026-11-17 用户报障）
 *
 * 用户原话：「必填项在原来的工艺路线中没有体现为必填，且点击保存后也并没高亮提示是那个数据行」。
 *
 * 背景（为什么会缺）：
 *  · 高亮一直只实现在**纸面组件**里（RecordSheetPanels / DocSheet / 各 sheet 暴露 focusField(s)），
 *    PanelxList.focusMissingFields 只调 `approvalSheetRef.value?.focusFields`；
 *  · 工艺路线（ROUTE）这类单据卡片/网格布局走的是 PanelxList 自己的表头字段条 + el-table，
 *    **根本没有 approvalSheetRef** ⇒ 那句可选链永远是 no-op，
 *    弹窗却写着「以下内容还没填写完，已用高亮标出」—— 用户在界面上看不到任何标记。
 *  · 红星则是在 2026-11-13「去掉必填红点」时被连同单据卡片表头一起清掉的（那条口径本意是弹窗）。
 *
 * 钉住的口径（改坏了要立刻变红）：
 *  ① 表头字段条：`.field` 带 data-code，缺失时挂 `field-blink`；
 *  ② 明细表格：el-table 挂 `cell-class-name`，缺失行整行 `row-missing-hint` + 具体格 `cell-blink`；
 *  ③ 明细缺失项必须带 `tabKey` + **行对象**（不能用行号：表里混着 `_placeholder` 空行，
 *     排序/筛选后行号更不可靠）；
 *  ④ 没有纸面 sheet 时也要点亮（不能只依赖 approvalSheetRef）；
 *  ⑤ 单据卡片表头 label 与明细列头恢复红星；弹窗内的红星保持去掉。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('① 表头字段条：每个 .field 带 data-code，缺必填时挂 field-blink', () => {
  const tpl = list.slice(list.indexOf('header-fields udl-fields'), list.indexOf('header-fields udl-fields') + 900)
  assert.match(tpl, /:data-code="headerFieldKey\(field\)"/, '表头字段格要有 data-code（供定位/测试）')
  assert.match(tpl, /'field-blink': isMissingHintHead\(headerFieldKey\(field\)\)/, '缺必填的表头格要挂 field-blink')
  assert.match(list, /function isMissingHintHead\(/, '缺 isMissingHintHead')
  assert.match(list, /\.field-blink \{[\s\S]{0,200}animation:/, 'field-blink 要有可见动画')
})

test('② 明细表格：cell-class-name → missingCellCls，行挂 row-missing-hint', () => {
  assert.match(list, /:cell-class-name="\(o\) => missingCellCls\(o\)"/, '明细表格要挂 cell-class-name')
  assert.match(list, /function missingCellCls\(/, '缺 missingCellCls')
  assert.match(list, /set\.has\(prop\) \? 'cell-blink' : ''/, '命中的格要给 cell-blink')
  assert.match(list, /if \(isMissingHintRow\(row\)\) return 'row-missing-hint'/, '缺必填的行要整行标记')
  // el-table 的 tr/td 由子组件渲染，scoped 样式拿不到 —— 必须走 :deep
  assert.match(list, /:deep\(\.el-table \.row-missing-hint > td\.el-table__cell\)/, '整行样式必须用 :deep')
  assert.match(list, /:deep\(\.el-table \.cell-blink\)/, '单元格闪烁必须用 :deep')
})

test('③ 明细缺失项带 tabKey + 行对象（行号不可靠：混着 _placeholder 空行）', () => {
  const fn = list.slice(list.indexOf('function validateInlineDraft('), list.indexOf('function saveInlineDraft('))
  assert.match(fn, /missing\.push\(\{ key: field\.dataName, tabKey: tab\.key, row, text: /,
    '明细缺失项必须带 tabKey 与行对象')
  // 明细行是 markRaw 过的对象 ⇒ 按对象身份记(WeakMap),且必须 shallowRef(ref 会把 WeakMap 包成 Proxy)
  assert.match(list, /missingHintRows = shallowRef\(null\)[\s\S]{0,80}WeakMap/, '按行对象身份记高亮（WeakMap + shallowRef）')
  assert.doesNotMatch(fn, /rowIndex: index/, '不要用行号记高亮')
})

test('④ 没有纸面 sheet 时也要点亮（不能只依赖 approvalSheetRef）', () => {
  const fn = list.slice(list.indexOf('function focusMissingFields('), list.indexOf('function validateArchiveUniqueKeys('))
  assert.match(fn, /applyMissingHint\(list\)/, '无 sheet 布局要自己点亮')
  // 只有字段名(后端拒收文案反解)的那条路径是 focusMissingField(单数)
  const single = list.slice(list.indexOf('function focusMissingField('), list.indexOf('function focusMissingFields('))
  assert.match(single, /if \(!approvalSheetRef\.value\) applyHintByFieldName\(key\)/, '后端拒收路径也要点亮')
  assert.match(list, /function applyHintByFieldName\(/, '缺 applyHintByFieldName')
})

test('⑤ 单据卡片表头与明细列头恢复红星；查询弹窗按 2026-11-17/18 口径也画', () => {
  const headCss = list.slice(list.indexOf('.field label.req::before'))
  assert.match(headCss.slice(0, 160), /content:\s*'\*'/, '单据卡片表头要画红星')
  const colCss = list.slice(list.indexOf('.col-hdr-text.req::before'))
  assert.match(colCss.slice(0, 160), /content:\s*'\*'/, '明细列头要画红星')
  // ⚠ 2026-11-18 合并说明:本行原为 `doesNotMatch(list, /class="req-star"/)`
  //   (2026-11-13「把必填项的红点标识去掉」口径)。但用户 2026-11-17/18 又明确
  //   「必填要标红。之前的标红也没了」⇒ 本地分支把查询弹窗/单据日期等处的红星一并画回来了
  //   (`.req-star` span + `.query-dialog-field > label .req-star` 样式)。
  //   两口径冲突时以**更晚的用户口径**为准 ⇒ 这里改成断言红星在,与
  //   `pickDialogRowClick.test.js` ⑦(其它面板红星一并画回来)保持一致。
  assert.match(list, /class="req-star"/, '查询弹窗红星(2026-11-17/18 口径)要画')
  assert.match(list, /\.query-dialog-field > label \.req-star/, '查询弹窗红星的样式要在')
})

test('⑥ 换单据要清高亮（表头键各单同名，不清会亮到另一张单上）', () => {
  assert.match(list, /watch\(curDocNo, \(\) => clearMissingHint\(\)\)/, '换单据要清掉高亮')
  assert.match(list, /function clearMissingHint\(/, '缺 clearMissingHint')
})
