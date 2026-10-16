/**
 * attachmentViewable.test.js —— 附件**能不能看**不能取决于「单据能不能编辑」
 *
 * 【为什么要有这条】2026-10-16 用户报障:「产品信息表上传的附件保存之后不能查看,
 * 有查看这个面板权限的人就可以查看上传的附件」。
 *
 * 实测复现(测试账套 PI-2026-10-0006,单据状态「审批中」——**普通用户点保存后的正常状态**):
 *   · `.fac-cell` 不存在、`.fac-chip` 不存在,附件名只是纸面上的纯文本(3 处),点不开、也没有下载请求。
 * 根因在渲染条件:`RecordSheetPanels.vue` 的附件格写成 `v-else-if="editable && pair.type === 'file'"`,
 * 而 editable=false 的时机非常多 —— 普通用户保存即送审(审批中)、管理员保存即归档、已审核/已归档、
 * 四文件非责任人只读…**上传者本人、审核人都点不开自己刚传的附件**。
 *
 * 口径:可编辑只决定「能不能上传/删除」;能不能看只由**该面板的查看权**决定(后端 requirePanelView)。
 * 单测跑不了模板分支,故按仓库既有做法读源码钉住(同 docSheetConfigs.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const recSheet = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const attachCell = readFileSync(new URL('./FileAttachCell.vue', import.meta.url), 'utf8')
const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

test('RecordSheetPanels:附件格不得被 editable 挡在门外', () => {
  // ⚠ 匹配必须带 v-else-if=" 前缀:新代码的注释里就写明了这个反面写法(不带前缀),按裸文本匹配会误报
  assert.ok(!/v-else-if="editable && pair\.type === 'file'"/.test(recSheet),
    '附件格写成 v-else-if="editable && pair.type===\'file\'" ⇒ 单据一旦不可编辑(审批中/已归档/只读责任人),' +
    '附件名退化成纯文本,上传者与审核人都点不开(2026-10-16 报障)')
  assert.match(recSheet, /v-else-if="pair\.type === 'file'"/, '附件格必须无条件进入可查看分支')
  assert.match(recSheet, /:can-edit="editable"/, '能不能上传/删除仍然跟 editable 走')
  assert.match(recSheet, /hide-when-empty/, '只读且没有附件时不该多出一行「暂无附件」(纸张要干净)')
})

test('DocSheet:备注栏附件同样只要查看权(走 attachCanEdit,不受 editable 影响)', () => {
  assert.match(docSheet, /:can-edit="attachCanEdit"/)
  assert.ok(!/:can-edit="editable"/.test(docSheet), '附件闸门不能直接绑 editable')
})

test('FileAttachCell:hideWhenEmpty 语义 = 有内容 或 可上传 才占位', () => {
  assert.match(attachCell, /hideWhenEmpty: \{ type: Boolean, default: false \}/)
  assert.match(attachCell, /const shouldShow = computed\(\(\) => !props\.hideWhenEmpty \|\| !!props\.canEdit \|\| files\.value\.length > 0 \|\| !!legacyText\.value\)/)
  // shouldShow 必须在 legacyText 之后声明:引用后声明的 const 会命中 TDZ(本仓踩过多次)
  assert.ok(attachCell.indexOf('const legacyText = computed') < attachCell.indexOf('const shouldShow = computed'),
    'shouldShow 必须声明在 legacyText 之后,否则 TDZ')
})
