import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * 架构审计(移植自 light-mes tools/architecture-audit.mjs):
 * 1) frontend/src/core/(面板引擎)禁止 import business 层 —— 通用视图与业务适配层隔离;
 * 2) PxController 只能面向 PanelRuntimeService 接口,不得直接依赖 PxRuntimeService 实现。
 * 提交前运行:node tools/architecture-audit.mjs(违规 exit 1)。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const core = path.join(root, 'frontend', 'src', 'core')
const errors = []

function sourceFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) sourceFiles(target, output)
    else if (/\.(?:js|vue)$/.test(entry.name)) output.push(target)
  }
  return output
}

for (const file of sourceFiles(core)) {
  const source = fs.readFileSync(file, 'utf8')
  // core 层只允许经 usePanelRuntime() 间接访问业务适配层;import business = 违反边界
  if (/from\s+['"](?:@\/business|\.\.\/business|\.\.\/\.\.\/business)/.test(source)) {
    errors.push(`${path.relative(root, file)} imports the business layer`)
  }
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
