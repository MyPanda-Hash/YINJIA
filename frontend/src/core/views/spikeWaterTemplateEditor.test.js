/**
 * spikeWaterTemplateEditor.test.js —— 加标水「标准库里的模版设计器」契约钉子（2026-11-06 第二轮）
 *
 * 【用户口径】「在标准库里面加上一个可以编辑模版的功能，现在的不行，可以让客户在页面进行一个
 *   模版自己设计，然后存进标准库里面，因为有很多种项目需要很多种表格……照着来料检验要求设计」
 *
 * 【为什么按源码钉】这条链断在"看代码全对、点下去没反应"的地方 —— 上一版就是这么坏的：
 *   编辑器发 `/stdlib/update {lib,item,content}`，而后端只认 `{id,content}`，
 *   保存永远回「id 无效」。所以这里把三条**会导致功能假装存在但实际不可用**的写法钉死：
 *     ① 改已有模版必须带 id；新建模版必须走 /stdlib/add 建条目（不是只清空列）；
 *     ② 列的 key 不许由"列名"派生（key 是落库字段名，改列名跟着改 key = 静默丢那一列的值）；
 *     ③ 用户自定义的新列必须走 /px/extField/add 登记成字段（与来料检验要求的「自定义字段」同一条路），
 *        否则值存不进明细表。
 * 纯逻辑（列集/校验/序列化）另有 spikeWaterTemplate.test.js，这里只管"接线"。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const editor = readFileSync(new URL('./StdLibLayoutEditor.vue', import.meta.url), 'utf8')
const manager = readFileSync(new URL('./StdLibTemplateManager.vue', import.meta.url), 'utf8')
const sheet = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('改已有模版：/stdlib/update 必须带 id（2026-11-06 报障「保存不了」的根因）', () => {
  const update = editor.match(/\/stdlib\/update',\s*\{[^}]*\}/)
  assert.ok(update, '编辑器里找不到 /stdlib/update 调用')
  assert.match(update[0], /\bid\b/, 'update 必须带 id（后端 StdLibController.update 只认 id:content）')
  assert.match(update[0], /content/, 'update 必须带 content')
  assert.doesNotMatch(update[0], /lib:|item:/, 'update 不该再传 lib/item（后端不认，且掩盖真实错误）')
  // id 来源必须是条目自身，不能是空的
  assert.match(editor, /entryId\.value\s*=\s*Number\(entry\?\.id\)/, '编辑模式必须记住条目 id')
})

test('新增模版：必须真的建条目（/stdlib/add），不是把当前条目的列清空', () => {
  assert.match(editor, /\/stdlib\/add',\s*\{[^}]*\}/, '新增模版必须走 /stdlib/add 建一个标准库条目')
  const add = editor.match(/\/stdlib\/add',\s*\{[^}]*\}/)[0]
  assert.match(add, /lib:\s*props\.lib/, 'add 必须带标准库编码')
  assert.match(add, /item:\s*item\.value/, 'add 必须带条目名（= 测试项目下拉里显示的名字）')
  assert.match(add, /content/, 'add 必须带表格结构 content')
  assert.match(editor, /openCreate/, '编辑器必须提供 openCreate（新增模版入口）')
  assert.match(manager, /openCreate\(value\)/, '模版清单的「新增模版」必须打开 create 模式的设计器')
})

test('列名与数据列分离：改列名不得顺手改 key（key 是落库字段名）', () => {
  assert.doesNotMatch(editor, /row\.key = String\(row\.label/, '上一版把 key 跟列名绑在一起，改列名就丢那一列的值')
  assert.doesNotMatch(editor, /function syncKey/, '不要再引入"列名→key"的同步函数')
  assert.match(editor, /key:\s*c\.key/, '打开已有模版时必须沿用原 key')
  assert.match(editor, /v-model="row\.label"/, '列名是独立可编辑的显示名')
})

test('自定义列：走 /px/extField/add 登记动态字段（与来料检验要求「自定义字段」同一条路）', () => {
  assert.match(editor, /\/px\/extField\/add/, '新建自定义列必须登记成动态字段，否则值存不进明细表')
  assert.match(editor, /pending:\s*true/, '自定义列在保存前必须是 pending（校验放行、不落库）')
  assert.match(editor, /confirmDirty/, '备用列有历史数据时要按后端要求二次确认（数据保留）')
})

test('字段池来自面板配置的明细字段：列的 key 必须能在里面找到', () => {
  assert.match(editor, /\/px\/getPanelConfig/, '编辑器必须读面板配置取字段池')
  assert.match(editor, /detail\?\.tabs\?\.\[0\]\?\.fields/, '字段池取的是明细页签的字段')
  assert.match(editor, /validateTemplate\(rows\.value,\s*pool\.value\)/, '保存前必须按字段池校验')
})

test('标准库维护弹窗：加标水用模版清单，其它面板仍用通用 StdLibManager', () => {
  assert.match(sheet, /<StdLibTemplateManager[\s\S]{0,240}?v-if="isSpikeWater"/, '加标水必须渲染模版清单')
  assert.match(sheet, /<StdLibManager v-else :lib="stdLibCode"/, '其它面板必须保持原 StdLibManager（行为不变）')
  assert.doesNotMatch(sheet, /StdLibLayoutEditor/, '旧的行内「编辑表格结构」入口已收进模版清单，不应再挂一份')
  assert.doesNotMatch(sheet, /openLayoutEditor/, '旧的单条结构编辑入口应已移除（否则两处入口打架）')
})

test('模版清单能停用/恢复/彻底删除，且新增模版先问名字', () => {
  assert.match(manager, /\/stdlib\/remove/, '缺停用')
  assert.match(manager, /\/stdlib\/enable/, '缺恢复启用')
  assert.match(manager, /\/stdlib\/destroy/, '缺彻底删除')
  assert.match(manager, /summarizeTemplate/, '清单要显示每个模版的列数/分格（读不懂的结构标「未设计」）')
  assert.match(manager, /这个名称已经有模版了/, '新增模版要拦重名（下拉里两项同名会分不清）')
  // 680px 的通用弹窗装不下模版清单的五列 —— 实测最右边的「×」被挤出可视区点不到
  assert.match(sheet, /:width="isSpikeWater \? '900px' : '680px'"/, '加标水的标准库弹窗必须更宽，否则删除按钮点不到')
})

test('模版存好后要让单据重拉配置（新模版要立刻出现在「测试项目」下拉）', () => {
  assert.match(manager, /emit\('changed'\)/, '设计器保存后必须通知外层刷新下拉选项')
  assert.match(sheet, /async function onTemplateSaved\(\)[\s\S]{0,220}?emit\('refresh-config'\)/, '保存模版后必须重拉面板配置')
  assert.match(sheet, /async function loadSpikeWaterLayout\(\) \{[\s\S]{0,2400}?parseLayout/, '纸面列集仍按标准库条目的 content 解析')
})

test('多语言：新增的模版 UI 文案至少有英文词条', () => {
  for (const k of ['编辑表格模版', '新增模版', '数据列（值存到这里）', '设计', '分格']) {
    assert.match(en, new RegExp(`'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'[^']+'`), `en.js 缺「${k}」`)
  }
})
