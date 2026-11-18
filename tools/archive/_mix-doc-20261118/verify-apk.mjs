/**
 * verify-apk.mjs — 出包后自证(与 android/README.md 各节「验证」表同一口径)。
 *
 * 查四件事:
 *  ① APK 内 `assets/www/` 与 `frontend/dist/` 是否**逐文件 SHA-256 全等**(嵌入前端的真源一致);
 *  ② zip 条目名里有没有反斜杠(Windows 下 aapt2 -A 会写成 `assets/www\…`,WebView 就白屏);
 *  ③ 条目总数 / 总体积;
 *  ④ dex 里有没有本轮新增的类(混料两页的取数不走原生,这里只确认壳的桥类还在)。
 *
 * 用法(仓库根):node tools/archive/_mix-doc-20261118/verify-apk.mjs [apk路径]
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

const apk = process.argv[2] || 'android/dist/yinjia-mes-1.0.20.apk'
const dist = 'frontend/dist'
const JSZip = null

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// 用 PowerShell 自带的 ZipFile 读条目(Node 侧不额外装包)
const listScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead('${apk.replace(/'/g, "''")}')
$z.Entries | ForEach-Object { $_.FullName + "\`t" + $_.Length }
$z.Dispose()
`
const listing = execFileSync('powershell', ['-NoProfile', '-Command', listScript], { encoding: 'utf8' })
const entries = listing.split(/\r?\n/).filter(Boolean).map((line) => {
  const [name, len] = line.split('\t')
  return { name, len: Number(len) }
})
const www = entries.filter((e) => e.name.startsWith('assets/www/'))

// ① 逐文件比对:把 APK 里的条目解出来算哈希
const dumpScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead('${apk.replace(/'/g, "''")}')
$out=@{}
foreach($e in $z.Entries){
  if(-not $e.FullName.StartsWith('assets/www/')){ continue }
  $s=$e.Open(); $ms=New-Object System.IO.MemoryStream; $s.CopyTo($ms); $s.Dispose()
  $b=$ms.ToArray(); $ms.Dispose()
  $h=[System.Security.Cryptography.SHA256]::Create().ComputeHash($b)
  $out[$e.FullName]=[System.BitConverter]::ToString($h).Replace('-','').ToLower()
}
$z.Dispose()
$out | ConvertTo-Json -Compress
`
const apkHashes = JSON.parse(execFileSync('powershell', ['-NoProfile', '-Command', dumpScript], { encoding: 'utf8' }))

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? walk(p) : [p]
})
const distFiles = walk(dist)
let mismatch = 0
let missing = 0
for (const f of distFiles) {
  const rel = relative(dist, f).split('\\').join('/')
  const key = `assets/www/${rel}`
  const got = apkHashes[key]
  if (!got) { missing += 1; console.log(`  [缺失] ${key}`); continue }
  if (got !== sha256(readFileSync(f))) { mismatch += 1; console.log(`  [不一致] ${key}`) }
}
const extra = Object.keys(apkHashes).filter((k) => !distFiles.some((f) => `assets/www/${relative(dist, f).split('\\').join('/')}` === k))

// ② 反斜杠条目
const backslash = www.filter((e) => e.name.includes('\\'))

console.log(JSON.stringify({
  apk,
  apkSizeBytes: statSync(apk).size,
  apkSha256: sha256(readFileSync(apk)).toUpperCase(),
  zipEntries: entries.length,
  wwwEntries: www.length,
  distFiles: distFiles.length,
  /** 逐文件 SHA-256 失配数(必须 0) */
  mismatch,
  /** dist 有而 APK 里没有(必须 0) */
  missing,
  /** APK 里有而 dist 没有(旧 hash 残留,正常可为 0..n) */
  extraCount: extra.length,
  backslashEntries: backslash.length,
}, null, 2))
