/**
 * _check-i18n-effective-20261017.mjs — 语言包重名键**实际生效的是哪一条**(只读)。
 *
 * 背景:合并后 en.js 的 biz 里有 135 个重名键 —— 一半是**双引号块**(并行会话的 i18n 生成器写在
 * biz 顶部),另一半是同键的单引号条目(落在文件后面)。JS 对象字面量**后写覆盖先写** ⇒
 * 若顶部双引号块被后面的单引号条目盖住,那份新翻译就是**死词条**。
 * 本探针直接 import 语言包,打出**实际生效值**与两处候选值,用来判定而非猜测。
 *
 * 用法(仓库根):node tools/archive/_check-i18n-effective-20261017.mjs [键...]
 */
import { readFileSync } from 'node:fs'

const LOCALE = process.argv[2] && !process.argv[2].startsWith('-') ? null : null
const keys = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const want = keys.length ? keys : ['选生产工单', '生成制程检验单失败', '产线常规功能性结果']

const mod = await import(new URL('../../frontend/src/i18n/locales/en.js', import.meta.url))
const biz = mod.default.biz || {}
const raw = readFileSync(new URL('../../frontend/src/i18n/locales/en.js', import.meta.url), 'utf8').split('\n')

for (const k of want) {
  const cands = []
  raw.forEach((line, i) => {
    const m = line.replace(/\r$/, '').match(/^\s*(['"])(.+?)\1\s*:\s*(.*)$/)
    if (m && m[2] === k) cands.push({ no: i + 1, quote: m[1], value: m[3].trim().slice(0, 60) })
  })
  console.log(`\n'${k}'`)
  console.log(`  实际生效(biz 取值): ${JSON.stringify(biz[k])}`)
  for (const c of cands) console.log(`  候选 L${c.no} [${c.quote === '"' ? '双引号' : '单引号'}]: ${c.value}`)
}
