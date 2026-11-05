/**
 * render-task-sheet.mjs — 把《成型生产任务单》的打印 HTML 落到文件,用于核对列宽(2026-11-05)
 *
 * 背景:用户反馈「扫出来的码和信息很难对应是哪一条」——纸面上「单据编号」
 * 被 word-break:break-all 折成两行(GD-2026-11-001 / 8),跟扫码列表里对不上眼。
 * 本任务把列宽定死 + 单据编号不折行;这个脚本把新版式渲染成 HTML,浏览器打开即所见。
 *
 * 用法(仓库根):
 *   node tools/archive/_print-sheet-cols-20261105/render-task-sheet.mjs
 * 产出:同目录 task-sheet.html
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../../frontend/src/business/print-formats.js')

// 与 frontend/src/business/print-formats.test.js 同一套 mock:页面内打印层把 HTML 塞进 #yj-print-host
let captured = ''
function makeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), id: '', innerHTML: '', textContent: '', style: {}, children: [],
    appendChild(child) {
      this.children.push(child)
      if (child && child.id === 'yj-print-host') captured = child.innerHTML
      return child
    },
    remove() { },
  }
}
globalThis.document = {
  title: '', head: makeEl('head'), body: makeEl('body'),
  createElement: makeEl, getElementById: () => null,
  addEventListener() { }, removeEventListener() { },
}
globalThis.window = { addEventListener() { }, removeEventListener() { }, print() { } }
globalThis.requestAnimationFrame = (cb) => { cb(); return 1 }

const { printWorkTaskSheet } = await import('file:///' + src.replace(/\\/g, '/'))

const rows = [
  { 单据编号: 'GD-2026-11-0018', 工单行号: 1, 公司代码: '0', 是否重点管控产品: '否', 商品编码: 'T073', 商品名称: 'A+级烧结炭棒/滤芯', 规格型号: '45*25*143', 订单数量: 500, 成型折算后数量: 500, 计划完工日期: '2026-09-10' },
  { 单据编号: 'GD-2026-11-0017', 工单行号: 3, 公司代码: '0', 是否重点管控产品: '否', 商品编码: 'C-78-21', 商品名称: 'X级烧结炭棒/滤芯Z062', 规格型号: '35*10*161.7', 订单数量: 1026, 成型折算后数量: 1026, 计划完工日期: '2026-09-16' },
  { 单据编号: 'GD-2026-11-0016', 工单行号: 1, 公司代码: '0', 是否重点管控产品: '是', 商品编码: 'D-18-10', 商品名称: 'A+级口感炭棒', 规格型号: '45*22*97', 订单数量: 1020, 成型折算后数量: 1020, 计划完工日期: '2026-09-09' },
]

const ok = await printWorkTaskSheet('成型生产任务单', rows)
const out = resolve(here, 'task-sheet.html')
writeFileSync(out, '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">' + captured + '</body>', 'utf8')
console.log({ ok, out, hasColgroup: captured.includes('<colgroup>'), noWrap: captured.includes('td.no{white-space:nowrap') })
