import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * 架构审计(移植自 light-mes tools/architecture-audit.mjs):
 * 1) frontend/src/core/(面板引擎)禁止 import business / stores / views 层
 *    —— 通用面板引擎必须与业务适配层、全局状态 store、路由页面三者隔离;
 * 2) PxController 只能面向 PanelRuntimeService 接口,不得直接依赖 PxRuntimeService 实现。
 * 提交前运行:node tools/verify/architecture-audit.mjs(违规 exit 1)。
 *
 * 逐行判定而非整文件判定:违规要能直接跳到 文件:行号 去改。
 * core 层允许经 usePanelRuntime() 间接访问业务能力;直接 import 即违规。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const core = path.join(root, 'frontend', 'src', 'core')
const src = path.join(root, 'frontend', 'src')
const errors = []

// 禁止 core 直接 import 的三个上层目录(相对 frontend/src 解析)。
// 旧版只判 business 且只认别名写法 —— 实测 core 已向 stores 层漂移,故补齐。
const forbiddenLayers = ['business', 'stores', 'views']
const forbiddenDirs = forbiddenLayers.map((name) => path.join(src, name))

// 命中判断改走「解析后的真实路径」而非正则:core/qc/x.js 里的 '../views/y'
// 指的是 core/views/y(core 内部交叉引用,合法),不能因为层名撞名就误报。
function specifierOf(line) {
  // 四种写法都要抓:静态 import/export ... from、import 'x'、`import('x')` 动态导入。
  // 动态 import 是真实违规点(core/request.js 曾在此绕过校验去取 user store),不能漏。
  const hit = line.match(/from\s+['"]([^'"]+)['"]/)
    || line.match(/^\s*import\s+['"]([^'"]+)['"]/)
    || line.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/)
  return hit ? hit[1] : null
}

function resolveSpecifier(file, specifier) {
  if (specifier.startsWith('@/')) return path.resolve(src, specifier.slice(2))
  if (specifier.startsWith('@core/')) return path.resolve(core, specifier.slice(6))
  if (specifier.startsWith('.')) return path.resolve(path.dirname(file), specifier)
  return null // 裸包名:不归本条边界管
}

function layerOf(resolved) {
  return forbiddenDirs.find((dir) => resolved === dir || resolved.startsWith(dir + path.sep))
}

function sourceFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) sourceFiles(target, output)
    else if (/\.(?:js|vue)$/.test(entry.name)) output.push(target)
  }
  return output
}

for (const file of sourceFiles(core)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    const specifier = specifierOf(line)
    if (!specifier) return
    const resolved = resolveSpecifier(file, specifier)
    if (!resolved) return
    const hitDir = layerOf(resolved)
    if (!hitDir) return
    const layerName = forbiddenLayers[forbiddenDirs.indexOf(hitDir)]
    const rel = path.relative(root, file).replace(/\\/g, '/')
    errors.push(`${rel}:${index + 1} imports the ${layerName} layer — ${line.trim()}`)
  })
}

const pxController = path.join(root, 'backend', 'src', 'main', 'java', 'com', 'yinjia', 'mes', 'controller', 'PxController.java')
if (fs.existsSync(pxController)) {
  const source = fs.readFileSync(pxController, 'utf8')
  if (source.includes('com.yinjia.mes.service.PxRuntimeService')) {
    errors.push('PxController depends on PxRuntimeService instead of PanelRuntimeService')
  }
}

if (errors.length) {
  console.error(`Architecture audit failed (${errors.length}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Architecture audit passed: panel core is isolated from business adapters')
