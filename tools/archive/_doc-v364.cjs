/**
 * _doc-v364.cjs — 追加 v3.64:打印期间不再触发重绘/请求(2026-10-29)
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', '..', 'docs', 'development', '数据库表清单.md')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')

const ROW = [
  '| v3.64 | 2026-10-29 | **打印期间不再触发重绘/请求(缓解「打印时页面像卡死」)**(用户反馈「供应商打印会卡死浏览器」;',
  '**无数据库变更**,纯前端)。**实测结论**:打印层本身很小(7 张材料码 = 169 个节点 / 18KB),',
  '主线程实测卡顿 **135ms**(远达不到"卡死");真正的问题是**`window.print()` 会冻结渲染进程等打印对话框**,',
  '而原代码在它返回后**立刻** `await load()` 刷新弹窗(又发 `/px/puLabel/dialog` + 重绘整张表)⇒',
  '打印对话框还开着的时候又画一遍,现场体感就是卡死。**修法**:① `printChannel.printInPage(title, body, opts)`',
  '新增 `opts.onDone` —— 打印层摘掉(`afterprint`)后回调一次;② `printProductCards(rows, opts)` 透传该回调;',
  '③ `MaterialLabelDialog` 把「刷新剩余可打/已打印记录」从**紧接着打印**改成在 `onDone` 里执行,',
  '并用 `printDone` 标记兜住"打印被浏览器拒/层已摘"的立即刷新。**验证**:`_v-print-freeze.cjs` 前后对比 ——',
  '修复前打印后紧跟一次 `puLabel/dialog` 请求,修复后**只有 `puLabel/print` 一次**,',
  '主线程最大卡顿 135ms、打印层 169 节点;面板回归 19/19、采购订单 10/10、前端单测 1031/1031。',
  '⚠ 供应商侧打印若仍然卡,基本可判定为**打印机驱动/虚拟 PDF 打印机的阻塞**(与 wangEditor/浏览器同进程),',
  '按 `printChannel.js` 头部注释的既有口径处理:先在系统里把默认打印机换成真实打印机或"另存为 PDF"再试。',
  '⚠ 本行手写(理由同 v3.31) |',
].join('')

const out = []
for (const line of lines) {
  if (line.startsWith('| v3.64 |')) continue
  out.push(line)
}
const lastVer = out.map((l, i) => (l.startsWith('| v3.') ? i : -1)).filter((i) => i >= 0).pop()
out.splice(lastVer + 1, 0, ROW)
fs.writeFileSync(FILE, out.join('\n'), 'utf8')
console.log(`v3.64 已插入(位置 ${lastVer + 1});v3.64 行数 =`, out.filter((l) => l.startsWith('| v3.64 |')).length)
