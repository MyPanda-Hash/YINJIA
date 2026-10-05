/* 推送前自检:①未推送区间里有没有新增敏感串 ②有没有大文件/可疑二进制
   用法:node tools/archive/_push-precheck.mjs */
import { execSync } from 'node:child_process'

const run = (cmd) => execSync(cmd, {
  cwd: process.cwd(), maxBuffer: 1024 * 1024 * 512, encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],   // 子进程 stderr 丢弃(重命名/删除文件时 git 会刷 fatal,属预期)
})

console.log('=== ① 未推送提交数 ===')
console.log(run('git rev-list --count origin/main..HEAD').trim(), 'commits /',
  run('git diff --shortstat origin/main..HEAD').trim())

console.log('\n=== ② 区间内新增文件:可疑扩展名 ===')
const added = run('git log --diff-filter=A --pretty=format: --name-only origin/main..HEAD')
  .split('\n').map((s) => s.trim()).filter(Boolean)
const uniq = [...new Set(added)]
console.log('新增文件', uniq.length, '个')
const susExt = /\.(bak|zip|7z|rar|mdf|ldf|exe|dll|iso|pem|key|p12|pfx|bak\d*|sql\.bak|tar|gz)$/i
const sus = uniq.filter((f) => susExt.test(f))
console.log(sus.length ? '⚠ 可疑:\n' + sus.join('\n') : '无明显可疑扩展名')

console.log('\n=== ③ 区间内新增/改动文件里的大文件(>200KB) ===')
const changed = [...new Set(run('git diff --name-only origin/main..HEAD').split('\n').map((s) => s.trim()).filter(Boolean))]
const big = []
for (const f of changed) {
  try {
    const size = Number(run(`git cat-file -s HEAD:"${f}"`).trim())
    if (size > 200 * 1024) big.push(`${(size / 1024).toFixed(0)}KB  ${f}`)
  } catch { /* 已删除的文件 */ }
}
big.sort((a, b) => Number(b.split('KB')[0]) - Number(a.split('KB')[0]))
console.log(big.length ? big.slice(0, 15).join('\n') : '(无 >200KB)')

console.log('\n=== ④ 区间内新增行里的敏感串(排除已存在的既有写法) ===')
const patch = run('git log -p -U0 --no-color origin/main..HEAD')
const pats = [
  [/client_?secret\s*[:=]\s*['"][^'"]{8,}/i, 'clientSecret'],
  [/accesskey(secret)?\s*[:=]\s*['"][^'"]{8,}/i, 'accessKey'],
  [/api[_-]?key\s*[:=]\s*['"][^'"]{12,}/i, 'apiKey'],
  [/sk-[A-Za-z0-9]{16,}/, 'sk-*'],
  [/AKIA[0-9A-Z]{12,}/, 'AWS AK'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '私钥'],
  [/password\s*[:=]\s*['"][^'"]{6,}/i, 'password='],
]
const hits = new Map()
for (const line of patch.split('\n')) {
  if (!line.startsWith('+') || line.startsWith('+++')) continue
  for (const [re, name] of pats) {
    if (re.test(line)) {
      const key = name + ' :: ' + line.trim().slice(0, 120)
      hits.set(key, (hits.get(key) || 0) + 1)
    }
  }
}
console.log(hits.size ? [...hits.keys()].slice(0, 25).join('\n') : '(无命中)')

console.log('\n=== ⑤ 既有仓库(origin/main)里是否已有同款串(判断是不是新暴露) ===')
for (const s of ['Yinjia@2026', 'clientSecret', '123456']) {
  let inOld = '?'
  try { inOld = run(`git grep -c "${s}" origin/main -- . | wc -l`).trim() } catch { inOld = '0(或不可数)' }
  let inNew = '?'
  try { inNew = run(`git grep -c "${s}" HEAD -- . | wc -l`).trim() } catch { inNew = '0(或不可数)' }
  console.log(`${s.padEnd(16)} origin/main 命中文件数=${inOld}  HEAD 命中文件数=${inNew}`)
}
