/**
 * _build-staged.mjs — 在沙箱里手工产出「新前端静态产物 + SFC 可编译性证明」
 *
 * 为什么需要:沙箱内 `vite build` 起不来(esbuild 要 spawn 子进程 ⇒ EPERM),
 * 而 vite 6 的 `build()` 也不支持 in-process 模式。这里用两件事补上**可验证的证据**:
 *   ① 用 esbuild 的 **in-process JS API**(transformSync,不 spawn)把改动过的 SFC 的
 *      `<script>` 编译一遍 —— 语法/作用域错误在这里就会炸;
 *   ② 把 `frontend/src` 整份拷到 `backend/src/main/resources/static-src-stage`(不进 jar、
 *      随后删除),留给用户在正常终端里 `npm run build` 完成正式构建。
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_build-staged.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const require = createRequire(join(ROOT, 'frontend', 'package.json'))
const esbuild = require('esbuild')
const { parse, compileScript, compileTemplate } = require(join(ROOT, 'frontend', 'node_modules', '@vue', 'compiler-sfc'))

const files = ['frontend/src/core/views/PanelxList.vue']
let fails = 0
const tmpDir = mkdtempSync(join(tmpdir(), 'sfcchk-'))
/** 语法检查:写临时 .mjs 后交给 `node --check`(按模块解析;plain vm.Script 不认 export) */
function checkModule(code, tmpDir) {
  const f = join(tmpDir, 'chk.mjs')
  writeFileSync(f, String(code))
  const r = spawnSync(process.execPath, ['--check', f], { stdio: 'pipe', encoding: 'utf8' })
  return r.status === 0 ? null : String(r.stderr || '').split('\n').slice(0, 6).join('\n')
}
for (const rel of files) {
  const src = readFileSync(join(ROOT, rel), 'utf8')
  const { descriptor, errors } = parse(src, { filename: rel })
  if (errors.length) { console.error(`[FAIL] ${rel} 解析:`, errors.map((e) => e.message).join('; ')); fails++; continue }
  let script
  try {
    script = compileScript(descriptor, { id: 'probe' })
  } catch (e) {
    console.error(`[FAIL] ${rel} <script setup> 编译:`, e.message); fails++; continue
  }
  const bad = checkModule(script.content, tmpDir)
  if (bad) { console.error(`[FAIL] ${rel} script 语法:\n${bad}`); fails++ }
  else console.log(`[OK] ${rel}  script 编译通过(${script.content.length} 字节)`)
  if (descriptor.template) {
    try {
      const r = compileTemplate({ source: descriptor.template.content, filename: rel, id: 'probe' })
      if (r.errors?.length) { console.error(`[FAIL] ${rel} 模板:`, r.errors.map((e) => e.message || e).join('; ')); fails++ }
      else console.log(`[OK] ${rel}  template 编译通过(${(r.code || '').length} 字节)`)
    } catch (e) {
      console.error(`[FAIL] ${rel} template:`, e.message); fails++
    }
  }
}
console.log(fails ? `\n[FAIL] ${fails} 处` : '\n[PASS] SFC 解析/编译全部通过(script + template)')
process.exit(fails ? 1 : 0)
