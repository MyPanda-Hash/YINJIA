/**
 * _check-merge-i18n-dupes-20261017.mjs — 合并 origin/main 后,前端语言包有没有被"两侧各加一行"搞出重名键。
 *
 * 为什么专门查:语言包是对象字面量,**后写的键覆盖先写的** ⇒ 两侧并行会话各加一条同名词条时,
 * git 会两条都并进去(不冲突),结果是**先写的那条永远不生效**(2026-10-17 审查时在 en.js 已实测过一次)。
 * 判据:某键在**合并后**的文件里出现多次,且它在 HEAD 与 feat 两个父提交里**各自都只出现一次**
 *      ⇒ 这条重名是合并引入的(两侧各加),要人工定夺保留哪条/两条是否同义。
 *
 * ⚠ 同一键的单引号/双引号写法算**同一个键**(JS 对象字面量里是同一个属性名),故两种引号一并计。
 * 只读:不改任何文件。用法(仓库根):node tools/archive/_check-merge-i18n-dupes-20261017.mjs [--lines 键]
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const LOCALES = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const pathOf = (l) => `frontend/src/i18n/locales/${l}.js`
const show = (ref, path) =>
  execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** 键 → {count, lines[]}(键=引号内的属性名;单/双引号视为同一个键) */
function keyInfo(text) {
  const map = new Map()
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*(['"])(.+?)\1\s*:/)
    if (!m) return
    const k = m[2]
    const cur = map.get(k) || { count: 0, lines: [] }
    cur.count++
    cur.lines.push({ no: i + 1, text: line.trim().slice(0, 110) })
    map.set(k, cur)
  })
  return map
}

const wantKey = process.argv.includes('--lines') ? process.argv[process.argv.indexOf('--lines') + 1] : ''
let introduced = 0
const perFile = []
for (const loc of LOCALES) {
  const path = pathOf(loc)
  const merged = keyInfo(readFileSync(path, 'utf8'))
  const head = keyInfo(show('HEAD', path))
  const feat = keyInfo(show('feat/qc-proc-insp-record-20261012', path))
  const dupes = [...merged].filter(([, v]) => v.count > 1)
  const bad = dupes.filter(([k]) => (head.get(k)?.count || 0) === 1 && (feat.get(k)?.count || 0) === 1)
  introduced += bad.length
  perFile.push(`${path}: 重名键 ${dupes.length} 个${dupes.length ? ' → ' + dupes.slice(0, 4).map(([k]) => k).join(' / ') : ''}`)
  if (bad.length) perFile.push(`  ⚠ 合并引入(${bad.length}):${bad.map(([k]) => k).join(' / ')}`)
  if (wantKey && merged.get(wantKey)?.count > 1) {
    perFile.push(`  ── '${wantKey}' 在 ${path} 的 ${merged.get(wantKey).count} 处:`)
    for (const l of merged.get(wantKey).lines) perFile.push(`     L${l.no}: ${l.text}`)
  }
}
console.log(perFile.join('\n'))
console.log(introduced === 0
  ? '\n[PASS] 没有"合并引入"的语言包重名键'
  : `\n[ATTENTION] 合并引入 ${introduced} 个重名键,需人工定夺`)
