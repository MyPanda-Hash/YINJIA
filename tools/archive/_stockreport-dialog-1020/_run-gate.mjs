/**
 * _run-gate.mjs — 依次跑回归闸,并把控制台输出**转成 UTF-8 落盘**(中文不乱码)
 *
 * 为什么单独一层:PowerShell 的 `node x.mjs > out` 会把标准输出按 UTF-16LE 写文件
 * (git/编辑器看成一堆乱码)。本脚本在自己的进程内把每个闸跑一遍并收集输出,
 * 用 UTF-8 写盘 —— 与闸本身同进程,不依赖子进程(受限环境里 spawn 会 EPERM)。
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_run-gate.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const collected = {}
const origLog = console.log
const origErr = console.error
console.log = (...a) => { const s = a.map(String).join(' '); (collected.cur ||= []).push(s); origLog(...a) }
console.error = (...a) => { const s = a.map(String).join(' '); (collected.cur ||= []).push(s); origErr(...a) }

/** 让出事件循环,好让被 import 的闸把异步工作跑完(它们都以 process.exit 收尾 → 这里先劫持) */
const realExit = process.exit
let exitCode = 0
process.exit = (code) => { exitCode = Math.max(exitCode, code || 0) }

const RUNS = [
  ['_v-gate.mjs', 'v-gate.out'],
  ['_v-dialog-flow.mjs', 'v-dialog-flow.out'],
  ['_probe-ledger-filter.mjs', 'probe-ledger-filter.out'],
]

for (const [script, out] of RUNS) {
  collected.cur = []
  exitCode = 0
  try {
    await import(new URL(`./${script}`, import.meta.url).href)
    // 闸内部 top-level await 已跑完;给它一个微任务/宏任务循环清空
    await new Promise((r) => setTimeout(r, 50))
  } catch (e) {
    collected.cur.push(`[脚本异常] ${script}: ${e?.message || e}`)
    exitCode = 1
  }
  const text = collected.cur.join('\n') + '\n'
  writeFileSync(join(DIR, out), text, 'utf8')
  origLog(`—— ${script} exit=${exitCode} · 输出已写 ${out}(UTF-8,${text.length} 字节)`)
}
process.exit = realExit
process.exit(exitCode)
