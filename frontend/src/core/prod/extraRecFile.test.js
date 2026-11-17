import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canPreviewInline, delStateLabel, delStateOf, deleteActionOf, formatSize,
} from './extraRecFile.js'

/**
 * 「特殊数据记录表」的纯口径（2026-11-17 用户口径）。
 *
 * 钉住四件事：
 *   ① 删除审批状态只有两档（正常 / 待审批删除），后端的 'PENDING' 大小写/空白都要认；
 *   ② 文件大小格式化（表格里给人看的，不是给机器）；
 *   ③ 「能不能在浏览器里直接看」必须与后端 inline 判定同一套，否则会出现
 *      「点预览却下载了个文件」或「明明能看却提示下载」；
 *   ④ 删除按钮的三种形态（申请/撤回/等待），别让普通人看到「撤回别人的申请」。
 */

test('① 删除状态两档：PENDING 大小写/空白都认，其它一律正常', () => {
  assert.equal(delStateOf({ delState: 'PENDING' }), 'pending')
  assert.equal(delStateOf({ delState: ' pending ' }), 'pending', '带空白也要认（后端 trim 过，前端别漏）')
  assert.equal(delStateOf({ delState: '' }), 'normal')
  assert.equal(delStateOf({ delState: null }), 'normal')
  assert.equal(delStateOf(null), 'normal', '空行不能抛')
  assert.equal(delStateLabel({ delState: 'PENDING' }), '待审批删除')
  assert.equal(delStateLabel({}), '正常')
})

test('② 文件大小：B / KB / MB 三档，无值给 —', () => {
  assert.equal(formatSize(0), '—')
  assert.equal(formatSize(null), '—')
  assert.equal(formatSize(undefined), '—')
  assert.equal(formatSize(512), '512 B')
  assert.equal(formatSize(1536), '1.5 KB')
  assert.equal(formatSize(1024), '1 KB')
  assert.equal(formatSize(5 * 1024 * 1024), '5 MB')
  assert.equal(formatSize(1024 * 1024 * 1024), '1024 MB', '大文件不进 GB —— 记录表不会那么大，多一档反而占列宽')
})

test('③ 能否内联预览：与后端 inline 判定同一套（image/* · text/* · pdf）', () => {
  assert.equal(canPreviewInline('image/png', 'a.png'), true)
  assert.equal(canPreviewInline('application/pdf', 'a.pdf'), true)
  assert.equal(canPreviewInline('text/plain', 'a.txt'), true)
  assert.equal(canPreviewInline('application/vnd.ms-excel', 'a.xls'), false, 'Excel 浏览器看不了 ⇒ 走下载')
  assert.equal(canPreviewInline('', 'b.JPG'), true, 'contentType 缺失时按扩展名兜底(现场常见)')
  assert.equal(canPreviewInline(null, 'c.pdf'), true)
  assert.equal(canPreviewInline('', 'd.docx'), false)
})

test('④ 删除按钮三形态：正常=申请 / 我申请的=撤回 / 别人的且我无审批权=等待', () => {
  assert.deepEqual(deleteActionOf({ delState: '' }, { user: 'zhang' }), { action: 'request', disabled: false })
  // 我申请的待删 ⇒ 可撤回
  assert.deepEqual(deleteActionOf({ delState: 'PENDING', delReqBy: 'zhang' }, { user: 'zhang' }),
    { action: 'cancel', disabled: false })
  // 别人申请的，我没有审批权 ⇒ 只能等（置灰，不能撤回别人的）
  assert.deepEqual(deleteActionOf({ delState: 'PENDING', delReqBy: 'li' }, { user: 'zhang' }),
    { action: 'wait', disabled: true })
  // 别人申请的，但我有审批权 ⇒ 也显示撤回（管理员可撤）
  assert.deepEqual(deleteActionOf({ delState: 'PENDING', delReqBy: 'li' }, { user: 'zhang', canApprove: true }),
    { action: 'cancel', disabled: false })
  // 未登录(空用户名)时,别人的待删单不能被误判成"我的"
  assert.deepEqual(deleteActionOf({ delState: 'PENDING', delReqBy: 'li' }, { user: '' }),
    { action: 'wait', disabled: true })
})

