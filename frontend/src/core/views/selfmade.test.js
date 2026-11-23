/**
 * 研发管理·自制料（2026-11-19 用户口径，《新建 XLS 工作表.xls》）：
 *   录入面板：材料名/主批次手填，子批次自动 `主批次-N`（1~10 行），流程卡/配料表为附件格，
 *             录入人默认练庆文；无审批。
 *   查询页：材料名 + 批次起止，结果含录入日期；导出 Excel + 打印二维码（材料名+主批次）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'
import { applyDocDefaults } from '../panel/docDefaults.js'

const sheet = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const page = readFileSync(new URL('../../views/rd/SelfmadeQuery.vue', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../../views/rd/SelfmadeEntry.vue', import.meta.url), 'utf8')
const attachCell = readFileSync(new URL('./FileAttachCell.vue', import.meta.url), 'utf8')
const querySvc = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java', import.meta.url), 'utf8')
const mig = readFileSync(new URL('../../../../tools/migrate-selfmade-20261119.sql', import.meta.url), 'utf8')

test('录入面板：两格手填 + 附件格 + 子批次自动编号(1~10)', () => {
  const cfg = recordSheetConfigs.RD_SELFMADE
  assert.ok(cfg, '缺 RD_SELFMADE 面板配置')
  const heads = cfg.sections.flatMap((s) => s.rows.flatMap((r) => r.pairs || [])).map((p) => p.key)
  assert.deepEqual(heads, ['材料名', '主批次'], '材料名与主批次都是手填格')
  const dt = cfg.dataTables[0]
  assert.deepEqual(dt.subBatch, { key: '子批次', from: '主批次', max: 10, min: 1 })
  const fileCols = dt.cols.filter((c) => c.type === 'file').map((c) => c.key)
  assert.deepEqual(fileCols, ['流程卡', '配料表'], '两格都是附件格（图片或文件）')
  assert.equal(dt.blankRows, 1, '默认 1 行（最少一个子批次）')
})

test('录入人默认练庆文（可改）', () => {
  const form = {}
  applyDocDefaults('RD_SELFMADE', form, { realName: '系统管理员', userName: 'admin' }, { isNew: true, today: '2026-11-19' })
  assert.equal(form['录入人'], '练庆文')
})

test('子批次由行序推导：上限拦截 + 增删行重排，不让人手填', () => {
  assert.match(sheet, /function applySubBatch\(dt\)/, '缺子批次重排')
  assert.match(sheet, /r\[sb\.key\] = base \? `\$\{base\}-\$\{no\}` : String\(no\)/, '格式 = 主批次-序号')
  assert.match(sheet, /function subBatchFull\(dt\)/, '缺上限判断')
  assert.match(sheet, /if \(subBatchFull\(dt\)\) \{ ElMessage\.warning/, '到 10 行要拦住')
  assert.match(sheet, /for \(const dt of \(cfg\.value\?\.dataTables \|\| \[\]\)\) if \(dt && dt\.subBatch\) applySubBatch\(dt\)/, '删行后重排')
})

test('查询页：材料名+批次区间、录入日期列、导出 Excel、二维码=材料名+主批次', () => {
  assert.match(page, /\/px\/selfmadeQuery/, '走查询端点')
  assert.match(page, /batchFrom/, '有批次起')
  assert.match(page, /batchTo/, '有批次止')
  assert.match(page, /tt\('录入日期'\)/, '结果要显示录入日期')
  assert.match(page, /xlsx/, '导出 Excel')
  assert.match(page, /const text = `\$\{row\['材料名'\] \|\| ''\} \$\{row\['主批次'\] \|\| ''\}`\.trim\(\)/, '二维码内容 = 材料名 + 主批次')
})

test('查询页附件列：只读 FileAttachCell + 后端附件清单，点击走预览', () => {
  assert.ok(page.includes('<FileAttachCell'), '流程卡/配料表必须用附件组件渲染，否则只是不可点文本')
  assert.ok(page.includes(':can-edit="false"'), '查询页只读：不能上传/删除，但必须能点开看')
  assert.ok(page.includes(':attachments="attachList(row, \'流程卡\')"'), '流程卡用后端返回的附件清单渲染')
  assert.ok(page.includes(':attachments="attachList(row, \'配料表\')"'), '配料表用后端返回的附件清单渲染')
  assert.ok(page.includes('function attachList(row, field)'), '缺附件清单取值函数')
  assert.ok(page.includes('`流程卡-${row[\'明细id\']}`'), '锚点与录入页一致：流程卡-明细行id')
  assert.ok(page.includes('`配料表-${row[\'明细id\']}`'), '锚点与录入页一致：配料表-明细行id')
  // 点击 chip 由 FileAttachCell 内部调 openAttachmentPreview（预览/下载复用现成实现）
  assert.ok(attachCell.includes('openAttachmentPreview(a, {'), '附件点击必须进预览，不是纯文本')
})

test('查询页附件 legacy 分支：清单为空但列里有文件名时保留文本，不再藏成「—」', () => {
  // 2026-11-20 用户报障：附件行在库、查询拼错单号 ⇒ 后端回空数组，前端把**列里已有的文件名**也藏了。
  assert.ok(page.includes('function legacyText(row, field)'), '缺「列内文件名」取值函数')
  assert.ok(page.includes("v-else-if=\"legacyText(row, '流程卡')\""), '流程卡：无附件清单但有文件名时要显示文本')
  assert.ok(page.includes("v-else-if=\"legacyText(row, '配料表')\""), '配料表：无附件清单但有文件名时要显示文本')
  assert.ok(page.includes('class="smq-file smq-legacy"'), 'legacy 文本要可点（样式钩子）')
  assert.ok(page.includes('仅记录文件名，原文件未入库'), '点击 legacy 文本要提示原文件未入库')
  assert.ok(page.includes('ElMessageBox.alert'), '提示要弹窗，不是静默')
})

test('FileAttachCell：attachments 清单模式不再按锚点请求列表', () => {
  assert.ok(attachCell.includes('attachments: { type: Array, default: null }'), '缺只读附件清单入参')
  assert.ok(attachCell.includes('if (Array.isArray(props.attachments)) {'), '传清单时必须直接渲染，不能再猜锚点')
  assert.ok(attachCell.includes('files.value = props.attachments.map((a) => ({ ...a }))'), '清单要复制进本地列表')
})

test('查询接口：每行带 流程卡附件/配料表附件，老数据按文件名/字段名兜底', () => {
  assert.ok(querySvc.includes('row.put("流程卡附件"'), '后端必须回传流程卡附件清单')
  assert.ok(querySvc.includes('row.put("配料表附件"'), '后端必须回传配料表附件清单')
  assert.ok(querySvc.includes('a.doc_no IN ('), '一次批量取本页单据的附件（避免 N+1）')
  assert.ok(querySvc.includes('baseKey + "-" + id'), '一级锚点 = 字段-明细行id')
  assert.ok(querySvc.includes('split("[、,，;；'), '按列里的文件名兜底拆分（历史「、」拼接）')
  assert.ok(querySvc.includes('baseKey.equals(String.valueOf(f.get("fieldKey")))'), '最后按字段名锚点兜底')
  assert.ok(querySvc.includes('boolean singleRow'), '多行单不能把同一份旧附件贴到每一行（错行比空着更糟）')
  assert.ok(querySvc.includes('if (!singleRow) return java.util.List.of();'), '字段名兜底只对单行单开放')
})

test('查询接口：明细行 id 跨单兜底 + 字段名-序号，覆盖「保存换号后附件留在旧单号下」', () => {
  // 2026-11-20 生产库实测：附件在 0001/0004，明细行已随保存挪到 0002/0005，
  // field_key 的数字是**明细行 id**（0005 的 8..11 与序号 1..4 对不上）。
  assert.ok(querySvc.includes('ISNULL(d.[序号], N\'\') AS 序号'), '明细行序号要取出来（旧数据锚点 字段名-序号）')
  assert.ok(querySvc.includes('row.put("序号"'), '序号要带进行对象，解析锚点用')
  assert.ok(querySvc.includes('baseKey + "-" + seq'), '二级锚点 = 字段-序号')
  assert.ok(querySvc.includes('EXISTS (SELECT 1 FROM rd_selfmade_detail'),
    '附件候选要按明细行 id 跨单捞（同一行保存换号后，旧附件仍在旧单号下）')
  assert.ok(querySvc.includes('selfmadeHitByAnchor(files, anchor, docNo, false)'),
    '一级锚点先本单、再跨单（明细行 id 全局唯一，不会串行）')
  assert.ok(querySvc.includes('names.contains(strOf(f.get("fileName")))'), '文件名匹配兜底仍在')
  assert.ok(querySvc.includes(':：'), '文件名分隔符要认冒号')
})

test('录入页保存必须带 编号：否则后端每次保存都新建单号，附件留在旧单号下', () => {
  assert.ok(entry.includes("{ ...head, 编号: head['单据编号'], detail:"),
    '保存载荷缺 编号 ⇒ 后端 save() 只读 编号、以为新建单，把明细行挪到新单号')
})

test('迁移：头/明细表 + 面板 + 附件字段 + 权限骨架', () => {
  assert.match(mig, /CREATE TABLE dbo\.rd_selfmade_head/)
  assert.match(mig, /CREATE TABLE dbo\.rd_selfmade_detail/)
  assert.match(mig, /RD_SELFMADE/)
  assert.match(mig, /N'流程卡',\s*N'流程卡',\s*N'附件'/, '流程卡必须是附件类型')
  assert.match(mig, /INSERT INTO yj_role_panel/)
})
