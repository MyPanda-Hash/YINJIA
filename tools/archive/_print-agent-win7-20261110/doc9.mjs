// 2026-11-10 第九节:打印失败/打印机被删 的排障说明(现场 agent.log 触发)
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'D:/YINJIA-main/deploy/print-agent/说明.md'
let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
if (t.includes('## 九、')) { console.log('[skip] 已有第九节'); process.exit(0) }
t = t.trimEnd() + `

## 九、打印失败:「已删除指定的打印机。」(2026-11-10)

现场 \`agent.log\`:

\`\`\`
打印机: EPSON LQ-635KII ESC/P2 (副本 1)
[兜底] 打印失败,改落 PDF:使用"0"个参数调用"Print"时发生异常:"已删除指定的打印机。"
[错误] 找不到虚拟打印机「Microsoft Print to PDF」…
\`\`\`

两个原因:

1. 配置里记的是打印机**副本** \`EPSON LQ-635KII ESC/P2 (副本 1)\`,这台在系统里已被删/驱动丢了;
2. PDF 兜底写死了 \`Microsoft Print to PDF\` —— **Win7 没有这台**(Win10 才自带)。

现在(build 2026-11-10 16:20 之后):

- 打印前会拿配置的名字去系统清单里核对(忽略 \`(副本 N)\`、空格、大小写),
  **对不上就自动换一台可用真机**,并在 \`agent.log\` 记一行:
  \`[打印机] 配置的「…(副本 1)」不在系统里,改用「EPSON LQ-635KII ESC/P2」\`;
- 真打失败时按候选列表**换机重试**(最多 3 台);
- 还不行才落 PDF:自动找系统里的 PDF 打印机(WPS「导出为WPS PDF」/ 福昕 / Adobe / Microsoft),
  存到 \`print-out\\\` 目录;一台 PDF 打印机都没有时,报错会**列出本机所有打印机名**。

客户侧建议:在「手机扫码 → 自动打印」页把**打印机**改成系统里真实存在的那台(或留空用系统默认),
别选带 \`(副本 1)\` 的名字。
`
writeFileSync(p, '\uFEFF' + t, 'utf8')
console.log('[ok] 说明.md 第九节')
