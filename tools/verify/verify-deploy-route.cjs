/**
 * verify-deploy-route.cjs —— 部署路线闸门回归(2026-10-25)
 *
 * 背景:2026-10-25 用户口径「先做 P0 统一上线方式,禁止默认全量覆盖」。
 * 服务器已有真实业务数据(外部小程序/参考库直写 plang/scjl),整库还原 = 丢数据。
 *
 * 本脚本只做**静态+行为**校验,不连库、不改任何东西:
 *   ① deploy-all.bat 必须是纯 ASCII(bat 混 UTF-8 中文在 zh-CN cmd 里必炸)
 *   ② 未带 CONFIRM-FULL-REPLACE 的 GO / GO DB 必须被拦,且拦在"停应用"之前
 *   ③ GO APP(只换 jar)不受闸限制
 *   ④ 文档默认路线必须是增量(deploy-incremental.bat),不得再写"部署默认全量"
 *
 * 用法(仓库根):node tools/verify/verify-deploy-route.cjs
 * 退出码:0 = PASS / 1 = FAIL
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const BAT = path.join(ROOT, 'deploy', 'deploy-all.bat')
const INCR = path.join(ROOT, 'deploy', 'deploy-incremental.bat')

let fail = 0
const ok = (m) => console.log('  [PASS] ' + m)
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }

function runBatRaw(file, args, cwd) {
  // 非零退出码是预期结果之一(本机没有 C:\yinjia / 闸门主动拦截),只取输出判断
  try {
    return execFileSync('cmd', ['/c', file, ...args], {
      cwd, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
    }).toString()
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || '')
  }
}

function runBat(args) {
  return runBatRaw(BAT, args, path.dirname(BAT))
}

// ① 纯 ASCII
const bytes = fs.readFileSync(BAT)
const nonAscii = [...bytes].filter((b) => b > 127).length
if (nonAscii === 0) ok(`① deploy-all.bat 纯 ASCII(${bytes.length} 字节)`)
else bad(`① deploy-all.bat 含 ${nonAscii} 个非 ASCII 字节 —— zh-CN cmd 会解析失败`)

// ② 未确认的 GO / GO DB 必被拦
for (const args of [['GO'], ['GO', 'DB']]) {
  const out = runBat(args)
  const label = 'deploy-all.bat ' + args.join(' ')
  if (!out.includes('RESULT: FAIL-FULL-REPLACE-NOT-CONFIRMED')) {
    bad(`② ${label} 未被拦(缺 FAIL-FULL-REPLACE-NOT-CONFIRMED)`)
    continue
  }
  // 拦在停应用之前:输出里不许出现停应用/备份/还原任何一个动作标记
  const touched = ['APP-STOPPED', 'BACKUP-GATE-PASSED', 'RESTORE-GATE-PASSED', 'NEW-JAR-IN-PLACE']
    .filter((m) => out.includes(m))
  if (touched.length) bad(`② ${label} 在被拦之前已执行动作:${touched.join(',')}`)
  else ok(`② ${label} 在改动任何东西之前被拦下`)
}

// ③ 带确认必须能越闸(否则等于把合法的首次安装/重建也锁死),且 SCOPE 仍要正确识别
for (const [args, wantScope] of [[['GO', 'CONFIRM-FULL-REPLACE'], 'SCOPE=ALL'],
                                 [['GO', 'DB', 'CONFIRM-FULL-REPLACE'], 'SCOPE=DB']]) {
  const out = runBat(args)
  const label = 'deploy-all.bat ' + args.join(' ')
  if (out.includes('FAIL-FULL-REPLACE-NOT-CONFIRMED')) {
    bad(`③ ${label} 带确认却被拦(合法全量流程被误锁)`)
    continue
  }
  if (!out.includes(wantScope)) bad(`③ ${label} 参数解析错,期望 ${wantScope}`)
  else ok(`③ ${label} 越闸且 ${wantScope} 解析正确`)
}

// ④ GO APP 不受限(用输出里的提示行判定,不真的去换包)
const appOut = runBat(['GO', 'APP'])
if (appOut.includes('FAIL-FULL-REPLACE-NOT-CONFIRMED')) bad('④ GO APP 被误拦(只换 jar 应放行)')
else ok('④ GO APP(只换 jar)不被全量闸拦')

// ④ 文档与脚本默认路线 = 增量
const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')
if (/部署默认增量/.test(agents) && !/部署默认全量/.test(agents)) ok('④ AGENTS.md 默认路线 = 增量部署')
else bad('④ AGENTS.md 仍写着「部署默认全量」或缺少「部署默认增量」')

const doc = fs.readFileSync(path.join(ROOT, 'deploy', '部署说明.md'), 'utf8')
if (/默认且唯一常规路线\s*=\s*§二 B/.test(doc)) ok('④ 部署说明.md 顶部声明默认路线 = 增量')
else bad('④ 部署说明.md 顶部缺少默认路线声明')
if (!fs.existsSync(INCR)) bad('④ deploy-incremental.bat 不存在')
else ok('④ deploy-incremental.bat 存在(默认路线脚本)')

// ⑤ 默认入口 deploy-production.bat:纯 ASCII + 只路由到增量 + 拒收全量确认参数
const PROD = path.join(ROOT, 'deploy', 'deploy-production.bat')
if (!fs.existsSync(PROD)) bad('⑤ deploy-production.bat 不存在(默认入口缺失)')
else {
  const pb = fs.readFileSync(PROD)
  const pna = [...pb].filter((b) => b > 127).length
  if (pna === 0) ok('⑤ deploy-production.bat 纯 ASCII')
  else bad(`⑤ deploy-production.bat 含 ${pna} 个非 ASCII 字节`)

  const defOut = runBatRaw(PROD, [], path.join(ROOT, 'deploy'))
  if (defOut.includes('INCREMENTAL') && !defOut.includes('restore')) ok('⑤ 默认入口 = 增量路线')
  else bad('⑤ 默认入口没有走增量路线')

  const wrongOut = runBatRaw(PROD, ['GO', 'CONFIRM-FULL-REPLACE'], path.join(ROOT, 'deploy'))
  if (wrongOut.includes('FAIL-WRONG-ENTRYPOINT')) ok('⑤ 默认入口拒绝全量确认参数(需改用 deploy-all.bat)')
  else bad('⑤ 默认入口未拦 CONFIRM-FULL-REPLACE')
}

// ⑥ 残留的旧口径提示:全量路线不得再被描述成默认
const legacy = []
for (const f of ['tools/archive/_demo-flow-20261016/README.md', 'tools/archive/_wo-flow-20261018/README.md']) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8')
  if (/部署默认全量/.test(t)) legacy.push(f)
}
if (!legacy.length) ok('⑤ 归档 README 无「部署默认全量」旧口径')
else bad('⑤ 仍有旧口径: ' + legacy.join(', '))

console.log(fail ? `\n== FAIL ${fail} 项 ==` : '\n== ALL PASS ==')
process.exit(fail ? 1 : 0)
