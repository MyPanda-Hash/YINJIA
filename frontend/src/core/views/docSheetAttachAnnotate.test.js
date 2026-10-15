/**
 * docSheetAttachAnnotate.test.js —— 文书式面板的「附件入口 + 标注笔」接线
 *
 * 【为什么要有这条】2026-10-16 用户报障:「我在立项申请测试,没有效果,色盘没有弹出,
 * 而且旁边的备注栏都没有加上附件上传入口」。
 *
 * 根因**不是后端、不是字段元数据**(库里 rd_approval.[附件1] 与 yj_field(附件, dataType='附件') 都在,
 * 接口实测 GET /px/getPanelConfig?panelCode=RD_APPROVAL 也下发了它),而是**渲染分支走错了组件**:
 *   · 立项申请(RD_APPROVAL)属 isApprovalDoc ⇒ 走 **DocSheet.vue**(不是 RecordSheetPanels.vue);
 *   · 备注又是 docSheetConfigs 的 **config.remark 专用块**(不是表头字段格);
 *   · 草稿单整张是可编辑的,值在 <input>/<textarea> 里,HTML 无法只给其中几个字上色。
 * ⇒ 三件事当时一处没接:附件入口、只读格的划选、以及"可编辑单也得能标注"。
 *
 * 只查库、只看后端会以为已经做好了 —— 所以这里钉在**源码**上(同仓库
 * docSheetConfigs.test.js / recordSheetConfigs.docno.test.js 的既有做法:单测跑不了模板分支)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { attachFieldOf } from '../panel/attachField.js'

const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const recSheet = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

// ── A. 附件字段发现(纯函数) ────────────────────────────────────────────────
// 键口径与 PanelxList.headerFieldKey 一致(code || dataName),否则取不到行模型里的键。
test('attachFieldOf:挑出 dataType=附件 的字段,键按 code||dataName||label', () => {
  const fields = [
    { dataName: '客户名', dataType: '文本' },
    { dataName: '附件1', dataType: '附件' },
    { dataName: '附件2', dataType: '附件' },
  ]
  assert.deepEqual(attachFieldOf(fields), { key: '附件1', label: '附件1' })
  assert.deepEqual(attachFieldOf([{ code: 'FJ', label: '附件', dataType: '附件' }]), { key: 'FJ', label: '附件' })
})

test('attachFieldOf:没有附件字段/空输入 → null(不得抛错)', () => {
  assert.equal(attachFieldOf([{ dataName: '备注', dataType: '文本' }]), null)
  assert.equal(attachFieldOf([]), null)
  assert.equal(attachFieldOf(null), null)
  assert.equal(attachFieldOf([null, { dataType: '附件' }]), null, '只有 dataType 没有键 → 取不到行模型键,视为无')
})

// ── B. DocSheet:备注栏的附件入口 ────────────────────────────────────────────
test('DocSheet:备注栏(含无备注但有附件字段的文书)必须渲染附件上传入口', () => {
  assert.match(docSheet, /import FileAttachCell from '\.\/FileAttachCell\.vue'/,
    'DocSheet 必须引入 FileAttachCell —— 附件是元数据驱动(yj_field.data_type=附件)的通用能力,不能只有 RecordSheetPanels 有')
  assert.match(docSheet, /import \{ attachFieldOf \} from '@core\/panel\/attachField\.js'/,
    '附件字段要从下发的 fields 里发现(attachFieldOf),不得在 DocSheet 里写死 附件1')
  assert.match(docSheet, /v-if="config\.remark \|\| remarkAttach"[\s\S]{0,800}?<FileAttachCell/,
    '备注块必须同时容纳附件入口(该面板没有备注列、但有附件字段时也要能显示)')
  assert.match(docSheet, /<FileAttachCell[\s\S]{0,400}?:field-key="remarkAttach\.key"/,
    'FileAttachCell 的 field-key 必须绑到发现出来的附件字段键')
  assert.match(docSheet, /:can-edit="attachCanEdit"/,
    '附件闸门要走外部的 attachCanEdit(已审核的指定面板仍可补附件),不能直接绑 editable —— ' +
    '立项申请那张被报障的单就是已审核的,只跟 editable 走会"还是看不到上传入口"')
})

// ── C. DocSheet:只读文本格必须走 AnnotatedText(标注才看得见) ────────────────
test('DocSheet:不得残留"裸 div 打印纸面文字"的只读格', () => {
  assert.ok(!/class="as-ro-text[^"]*">\{\{/.test(docSheet),
    'as-ro-text 直出 {{ head[...] }} 的格必须换成 AnnotatedText(否则划选无从换算下标,色盘永远不弹)')
  assert.ok(!/class="q-ro">\{\{/.test(docSheet),
    'q-ro 直出 {{ head[...] }} 的格同理')
  assert.match(docSheet, /import AnnotatedText from '\.\/AnnotatedText\.vue'/)
})

// ── D. 两个表组件:只读分支的文本格必须走 AnnotatedText ──────────────────────
test('RecordSheetPanels:表头值格的只读分支不得是裸 span(标注只认 AnnotatedText)', () => {
  const bare = []
  recSheet.split('\n').forEach((line, i) => {
    // 表头字段(绑 head[...])的裸只读 span;明细行(r.row/ledger 计算值)不在本次范围
    if (/class="rs-txt[^"]*">\{\{\s*head\[/.test(line)) bare.push(i + 1)
  })
  assert.deepEqual(bare, [], '这些行的表头只读格是裸 span → 该格标不了')
  assert.match(recSheet, /import AnnotatedText from '\.\/AnnotatedText\.vue'/)
})

// ── E. 进标注模式必须让整张纸变只读 ─────────────────────────────────────────
// 草稿单整张可编辑 ⇒ 不进只读就永远是 <input>,划选无从换算下标,色盘不弹。
// 口径:交给表组件的 :editable 必须被标注模式关掉(false 硬编码的只读视图除外)。
test('PanelxList:交给各表组件的 :editable 必须受标注模式约束', () => {
  const bad = []
  panelx.split('\n').forEach((line, i) => {
    const m = line.match(/:editable="([^"]*)"/)
    if (!m) return
    const v = m[1].trim()
    if (v === 'false' || v.includes('!annOn')) return
    bad.push(`第 ${i + 1} 行 :editable="${v}"`)
  })
  assert.deepEqual(bad, [], '这些 :editable 没被标注模式关掉 → 草稿单上点标注笔没有反应')
})
