/**
 * _repack-jar.mjs — 把 frontend/dist 同步进 backend static 并重新打包 fat jar(一次成型)
 *
 * 为什么需要:本机没有 mvn(且沙箱里 maven 起不来),`jar uf` 手工拼又容易漏(2026-10-20 实测:
 * 只用 javac 编 class 而**没带 -parameters** ⇒ Spring 起不来 `expected single matching bean but found 3`;
 * 只换 static 又得保证 BOOT-INF/lib 不动)。这里把三步固定成一条命令,并加自检:
 *   ① dist → backend/src/main/resources/static(先清 assets,避免旧 hash 文件残留)
 *   ② 以**现有 jar** 为底,只覆盖 BOOT-INF/classes/static(前端)
 *   ③ 若给了 --classes 目录,再把编译好的 class 一起覆盖(**必须**是带 -parameters 的产物)
 *   ④ 自检:BOOT-INF/lib 条数不变、static/index.html 存在、新 PanelxList chunk 在包里
 *
 * 用法:
 *   node tools/archive/_stockreport-dialog-1020/_repack-jar.mjs
 *   node tools/archive/_stockreport-dialog-1020/_repack-jar.mjs --classes backend/target/_cc2
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const JAR = join(ROOT, 'backend', 'target', 'yinjia-mes-backend-0.1.0.jar')
const DIST = join(ROOT, 'frontend', 'dist')
const STATIC = join(ROOT, 'backend', 'src', 'main', 'resources', 'static')
const STAGE = join(ROOT, 'backend', 'target', '_stage_repack')
const JAREXE = join(process.env.JAVA_HOME || 'C:\\Users\\Lenovo\\.jdks\\temurin-25.0.4.1', 'bin', 'jar.exe')

const classDirArg = process.argv.indexOf('--classes')
const classDir = classDirArg > 0 ? join(ROOT, process.argv[classDirArg + 1]) : null

const run = (args) => {
  const r = spawnSync(JAREXE, args, { encoding: 'utf8' })
  if (r.status !== 0) { console.error('[FAIL]', JAREXE, args.join(' '), '\n', r.stderr || r.stdout); process.exit(1) }
  return r.stdout || ''
}
// ⚠ Windows 下 `jar tf` 是 CRLF 输出:不按 \r?\n 切 + trim,条目会带 '\r',
//   `e === 'BOOT-INF/classes/static/index.html'` 恒 false ⇒ 自检假失败(2026-10-20 实测)。
const listJar = () => run(['tf', JAR]).split(/\r?\n/).map((e) => e.trim()).filter(Boolean)

if (!existsSync(JAR)) { console.error('[FAIL] jar 不存在:', JAR); process.exit(1) }
if (!existsSync(join(DIST, 'index.html'))) { console.error('[FAIL] 先跑 vite build:', DIST); process.exit(1) }

// ① dist -> static
const libBefore = listJar().filter((e) => e.startsWith('BOOT-INF/lib/')).length
rmSync(join(STATIC, 'assets'), { recursive: true, force: true })
cpSync(DIST, STATIC, { recursive: true })
const assets = readdirSync(join(STATIC, 'assets')).length
console.log(`[1/4] dist -> static:assets ${assets} 个文件`)

// ② 组装 stage
rmSync(STAGE, { recursive: true, force: true })
mkdirSync(join(STAGE, 'BOOT-INF', 'classes'), { recursive: true })
cpSync(STATIC, join(STAGE, 'BOOT-INF', 'classes', 'static'), { recursive: true })
if (classDir) {
  if (!existsSync(join(classDir, 'com'))) { console.error('[FAIL] --classes 下没有 com/', classDir); process.exit(1) }
  cpSync(join(classDir, 'com'), join(STAGE, 'BOOT-INF', 'classes', 'com'), { recursive: true })
  console.log(`[2/4] 同时覆盖 class:${classDir}`)
} else {
  console.log('[2/4] 只覆盖前端 static(未给 --classes)')
}

// ③ jar uf
run(['uf', JAR, '-C', STAGE, 'BOOT-INF'])
console.log('[3/4] jar uf 完成')

// ④ 自检
const entries = listJar()
const libAfter = entries.filter((e) => e.startsWith('BOOT-INF/lib/')).length
const hasIndex = entries.some((e) => e === 'BOOT-INF/classes/static/index.html')
const newChunk = readdirSync(join(STATIC, 'assets')).find((f) => f.startsWith('PanelxList-') && f.endsWith('.js'))
const hasChunk = entries.some((e) => e.endsWith('static/assets/' + newChunk))
const size = statSync(JAR).size
console.log(`[4/4] 自检: lib ${libBefore} -> ${libAfter} | index.html ${hasIndex} | ${newChunk} ${hasChunk} | jar ${size} 字节`)
if (libAfter !== libBefore || !hasIndex || !hasChunk) { console.error('[FAIL] 自检未过'); process.exit(1) }
console.log('[PASS] jar 已更新(static 与 class 均为最新)')
