/**
 * _q-verify-build-patch.mjs —— 直接验证**构建产物**里 buildPatch 的口径
 *
 * 为什么要打产物而不是源码:8090 跑的是 jar 内嵌 static,用户看到的就是它。
 * 若产物里「理论水分」还取 powder_avg,单元测试全绿也没意义。
 *
 * 做法:从 backend/src/main/resources/static/assets 里 grep 出 buildPatch 的
 *   对应代码片段(压缩后的),确认它引用的是 actual_moisture 而不是 powder_avg。
 * 用法:node _q-verify-build-patch.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const STATIC = 'C:/INCER/YINJIA-MES/backend/src/main/resources/static/assets'

let files = []
try { files = readdirSync(STATIC).filter((f) => f.endsWith('.js')) } catch (e) {
  console.error('读不到 static/assets: ' + e.message); process.exit(1)
}

// buildPatch 在压缩后长这样(关键特征:理论水分 后面紧跟的面包屑)
// 源:理论水分: fixed(result.actual_moisture * 100, 2)
// 压缩:理论水分:` + i.actual_moisture * 100 + ` 之类;也可能 xxx(…actual_moisture*100,2)
let hitActual = []
let hitPowder = []
for (const f of files) {
  const txt = readFileSync(join(STATIC, f), 'utf8')
  if (!txt.includes('理论水分')) continue
  // 取 理论水分 附近的 240 字符窗口逐一看
  let i = -1
  while ((i = txt.indexOf('理论水分', i + 1)) >= 0) {
    const win = txt.slice(i, i + 240)
    if (win.includes('actual_moisture')) hitActual.push({ file: f, win: win.slice(0, 120) })
    if (win.includes('powder_avg')) hitPowder.push({ file: f, win: win.slice(0, 120) })
  }
}

console.log('扫了 ' + files.length + ' 个 chunk')
console.log('')
console.log('=== 「理论水分」附近出现 actual_moisture(应为新口径) ===')
hitActual.forEach((h) => console.log('  ' + h.file + ' :: ' + h.win))
console.log('')
console.log('=== 「理论水分」附近出现 powder_avg(旧口径残留) ===')
hitPowder.forEach((h) => console.log('  ' + h.file + ' :: ' + h.win))
console.log('')

// 参考行也该在产物里
const anyFile = files.map((f) => readFileSync(join(STATIC, f), 'utf8')).join('\n')
console.log('产物含「物料平均水分（参考）」= ' + anyFile.includes('物料平均水分（参考）'))
console.log('结论 = ' + (hitActual.length > 0 && hitPowder.length === 0 ? 'PASS 新口径已进产物' : 'FAIL 需检查'))
