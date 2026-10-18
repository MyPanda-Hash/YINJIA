/**
 * _repack-jar.mjs — 把 frontend/dist 同步进 backend static 并打进 fat jar(一条命令 + 自检)
 *
 * 用法(必须**先停服务**,jar 被占用时 jar 命令会失败):
 *   cd D:\YINJIA-main\frontend && node node_modules\vite\bin\vite.js build && cd ..
 *   node tools/archive/_stockreport-dialog-1020/_repack-jar.mjs
 *   node tools/archive/_stockreport-dialog-1020/_repack-jar.mjs --classes backend/target/_cc2
 *
 * 🔴 两条踩过的红线(2026-10-20 实测,别再试):
 *   1. **不能用 `jar cfm` 重打整包**:`jar` 会重新压缩所有条目,而 Spring Boot 的
 *      BOOT-INF/lib/*.jar 必须是 **STORED**(不压缩)才能被嵌套 ClassLoader 读取;
 *      重打后启动直接 `NoClassDefFoundError: org/springframework/security/crypto/password/PasswordEncoder`。
 *   2. **不能用 ZipArchive(Update) 删条目**:会把 fat jar 写坏
 *      (`java.util.zip.ZipException: invalid entry size`)。
 *   ⇒ 只用 `jar uf`(只增不删)。代价是每重建一次多留一份旧 hash 的 chunk,
 *     但这**不影响正确性**(index.html 只引用当次构建的 hash);
 *     要彻底瘦身请在**有 maven** 的环境 `mvn package` 重打。
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

// 支持 cwd:`jar xf` 是解到**当前工作目录**的(早先漏传把整个 jar 解到了仓库根,事后手工清)
const run = (args, cwd) => {
  const r = spawnSync(JAREXE, args, { encoding: 'utf8', cwd: cwd || undefined })
  if (r.status !== 0) { console.error('[FAIL]', JAREXE, args.join(' '), '\n', r.stderr || r.stdout); process.exit(1) }
  return r.stdout || ''
}
// ⚠ Windows 下 `jar tf` 是 CRLF 输出:不按 \r?\n 切 + trim,条目会带 '\r' ⇒ 自检假失败
const listJar = () => run(['tf', JAR]).split(/\r?\n/).map((e) => e.trim()).filter(Boolean)

if (!existsSync(JAR)) { console.error('[FAIL] jar 不存在:', JAR); process.exit(1) }
if (!existsSync(join(DIST, 'index.html'))) { console.error('[FAIL] 先跑 vite build:', DIST); process.exit(1) }

// ① dist -> static
const libBefore = listJar().filter((e) => e.startsWith('BOOT-INF/lib/')).length
rmSync(join(STATIC, 'assets'), { recursive: true, force: true })
cpSync(DIST, STATIC, { recursive: true })
console.log(`[1/4] dist -> static:assets ${readdirSync(join(STATIC, 'assets')).length} 个文件`)

// ② 组装 stage(只放要覆盖的 classes 子树)
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

// ③ jar uf(只增不删,嵌套 jar 一个字节不动)
run(['uf', JAR, '-C', STAGE, 'BOOT-INF'])
console.log('[3/4] jar uf 完成')

// ④ 自检
const entries = listJar()
const libAfter = entries.filter((e) => e.startsWith('BOOT-INF/lib/')).length
const hasIndex = entries.some((e) => e === 'BOOT-INF/classes/static/index.html')
const newChunk = readdirSync(join(STATIC, 'assets')).find((f) => f.startsWith('PanelxList-') && f.endsWith('.js'))
const hasChunk = entries.some((e) => e.endsWith('static/assets/' + newChunk))
const chunkCount = entries.filter((e) => /static\/assets\/PanelxList-[^/]+\.js$/.test(e)).length
const size = statSync(JAR).size
console.log(`[4/4] 自检: lib ${libBefore} -> ${libAfter} | index.html ${hasIndex} | ${newChunk} ${hasChunk} | 包里 PanelxList chunk ${chunkCount} 份 | ${(size / 1048576).toFixed(1)} MB`)
if (libAfter !== libBefore || !hasIndex || !hasChunk) { console.error('[FAIL] 自检未过'); process.exit(1) }
console.log(`[PASS] jar 已更新${chunkCount > 1 ? `(注:包内还有 ${chunkCount - 1} 份历史 chunk,不影响正确性;瘦身请用 mvn package)` : ''}`)
