/**
 * attachmentPreview.test.js —— 单据附件要能「点开就看」,不能一律下载
 *
 * 【为什么要有这条】用户 2026-10-28 口径:
 *   「上传的附件在单据未保存的时候,点击也可以查看,现在是只能是下载下来再查看,
 *    看看能不能加上预览的功能就不需要每次都下载再看,归档的也是一样」
 *
 * 现状(实测 FileAttachCell.vue):openFile() 只对 image/ · text/ · application/pdf 走
 * window.open(blob),**其余类型(含 .docx / .xlsx / .doc)一律 a.download** —— 所以「开题报告-修改版.doc」
 * 这类 Word 附件每次都要先下载。分享文件库(ShareFileCenter.vue)早就有 docx-preview 预览,
 * 但那是页面内private实现,单据附件没接。
 *
 * 口径:
 *   · 预览能力抽成**共用工具** core/panel/attachmentPreview.js(与分享文件库同一套 docx-preview 渲染);
 *   · FileAttachCell.openFile 对可预览类型走预览,不可预览类型(老 .doc/.xls/压缩包)保底下载;
 *   · 预览与「单据是否可编辑」无关 —— 未保存新单(附件在保存前传的)、审批中、已归档都能点开。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const attachCell = readFileSync(new URL('./FileAttachCell.vue', import.meta.url), 'utf8')
const shareFile = readFileSync(new URL('../../views/rd/ShareFileCenter.vue', import.meta.url), 'utf8')
const previewUtil = readFileSync(new URL('../panel/attachmentPreview.js', import.meta.url), 'utf8')

test('附件预览工具:支持 docx/xlsx/图片/PDF,并有降级下载', () => {
  assert.match(previewUtil, /export function isDocxLike/, '需按扩展名+contentType 判定 docx')
  assert.match(previewUtil, /export function canPreview/, '需给出「能否在线预览」的统一判定')
  assert.match(previewUtil, /export async function openAttachmentPreview/, '需提供统一预览入口')
  assert.match(previewUtil, /docx-preview/, 'docx 用 docx-preview 渲染(与分享文件库同源)')
  assert.match(previewUtil, /triggerDownload|downloadBlob/, '不可预览类型要能降级为下载')
})

test('FileAttachCell:点击附件走预览(不再一律下载),且不受 editable 影响', () => {
  assert.match(attachCell, /openAttachmentPreview/, 'FileAttachCell 必须调用共用预览工具')
  assert.ok(!/el\.download = a\.fileName/.test(attachCell), '旧实现「一律 a.download」必须移除')
  // 预览入口不能被 canEdit 门住:canEdit 只决定上传/删除
  assert.match(attachCell, /async function openFile[\s\S]{0,400}openAttachmentPreview/, 'openFile 内需调用预览工具')
})

test('预览工具:Word/Excel 走可预览分支,老 .doc 说明降级', () => {
  assert.match(previewUtil, /wordprocessingml|\.docx/i, '需识别 docx contentType/扩展名')
  assert.match(previewUtil, /sheetjs|readAsArrayBuffer|xlsx/i, '需支持 xlsx(可用 xlsx 库转 HTML 预览)')
})

/**
 * 2026-10-28 现场实测:附件《开题报告-修改版.doc》文件头 D0 CF 11 E0 = OLE2 真·老 Word,
 * docx-preview 解析不了 ⇒ 必须走后端 HWPF 转 HTML(/attachment/{id}/preview-doc)。
 * 这条测试钉住:① 工具能区分 .doc 与 .docx;② .doc 走 loadLegacyDocHtml;③ 两个调用方都传了该 loader。
 */
test('老 .doc(OLE2)走「后端转 HTML」分支,不与 docx 混为一谈', () => {
  assert.match(previewUtil, /export function isLegacyDoc/, '需单独的 isLegacyDoc 判定')
  assert.match(previewUtil, /application\/msword/, 'contentType=application/msword 要认')
  assert.match(previewUtil, /loadLegacyDocHtml/, 'openAttachmentPreview 需接收后端转 HTML 的 loader')
  assert.match(previewUtil, /isLegacyDoc\(file\)[\s\S]{0,600}loadLegacyDocHtml/, '.doc 分支要实际调用该 loader')
  assert.match(attachCell, /preview-doc/, 'FileAttachCell 要请求 /attachment/{id}/preview-doc')
  assert.match(shareFile, /preview-doc/, 'ShareFileCenter 同样要接后端转换(两处同源)')
})
