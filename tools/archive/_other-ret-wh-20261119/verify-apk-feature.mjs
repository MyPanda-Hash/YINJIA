/**
 * 出包后自证(2026-11-19 / 1.0.24):确认「其他退料可选退到哪个仓库」的代码**真的在 APK 里**,
 * 而不是把旧 dist 打进去了。
 *
 * 查三件事:
 *  ① APK 里 `assets/www/assets/MobileOtherScan-*.js` 含本轮新增的文案与逻辑字面量;
 *  ② `scanOther-*.js` 含 `toWarehouseOptions` 的判定字面量(`停用` / `仓库编码`);
 *  ③ 包内 `index.html` 的入口 chunk 与 `frontend/dist/index.html` 一致。
 *
 * 用法(仓库根):node tools/archive/_other-ret-wh-20261119/verify-apk-feature.mjs [apk路径]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const apk = process.argv[2] || 'android/dist/yinjia-mes-1.0.24.apk'

const script = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead('${apk.replace(/'/g, "''")}')
foreach($e in $z.Entries){
  if($e.FullName -match 'assets/www/assets/(MobileOtherScan|scanOther|index)-[^/]+\\.js$' -or $e.FullName -eq 'assets/www/index.html'){
    $s=$e.Open(); $ms=New-Object System.IO.MemoryStream; $s.CopyTo($ms); $s.Dispose()
    $txt=[System.Text.Encoding]::UTF8.GetString($ms.ToArray()); $ms.Dispose()
    "===ENTRY $($e.FullName)"
    $txt
    "===END"
  }
}
$z.Dispose()
`
const out = execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const blocks = {}
const re = /===ENTRY ([^\r\n]+)\r?\n([\s\S]*?)===END/g
let m
while ((m = re.exec(out))) blocks[m[1]] = m[2]

const find = (pat) => Object.keys(blocks).filter((k) => new RegExp(pat).test(k))
const scanJs = find('assets/www/assets/MobileOtherScan-[^/]+\\.js$')
const otherJs = find('assets/www/assets/scanOther-[^/]+\\.js$')
const indexHtml = blocks['assets/www/index.html'] || ''

const assert = (ok, msg) => {
  console.log((ok ? '  [PASS] ' : '  [FAIL] ') + msg)
  if (!ok) process.exitCode = 1
}

console.log('APK 内命中的分块:', scanJs.concat(otherJs).join(', ') || '(无)')
const scan = scanJs.map((k) => blocks[k]).join('\n')
const other = otherJs.map((k) => blocks[k]).join('\n')

assert(scan.length > 0, 'MobileOtherScan 分块在包内')
assert(scan.includes('退到仓库'), 'MobileOtherScan 含「退到仓库」文案(本轮新增的下拉)')
assert(scan.includes('库存仓'), 'MobileOtherScan 含「库存仓」(退料页候选卡改称)')
assert(scan.includes('仓库档案没加载出来'), 'MobileOtherScan 含仓库档失败的提示文案')
assert(other.includes('仓库编码') && other.includes('仓库名称'), 'scanOther 含 仓库编码/仓库名称 两个落库标签')
assert(other.includes('停用'), 'scanOther 含「停用」判定(排掉停用仓)')
assert(scan.includes('mo-wh-sel') && scan.includes('请选择仓库'),
  'MobileOtherScan 含下拉控件(类名 mo-wh-sel + 占位「请选择仓库」)—— 打包后 showWh 变量名会被压掉,故按这两条字面量判')

const distIndex = readFileSync('frontend/dist/index.html', 'utf8')
const entryOf = (html) => (html.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [''])[0]
assert(entryOf(distIndex) !== '' && entryOf(distIndex) === entryOf(indexHtml),
  `包内 index.html 入口 = dist 入口(${entryOf(distIndex)})`)

console.log('\n结论:', process.exitCode ? '有 FAIL,不要发布这个包' : '全部 PASS —— 本轮的「退到仓库」确实在包里')
