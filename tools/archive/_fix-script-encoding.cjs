/**
 * _fix-script-encoding.cjs — 脚本编码健壮性(2026-09-23)
 *
 * ① .ps1「含中文但无 BOM」⇒ PS5.1 按 ANSI 解析:中文输出乱码,某些字节对还会被解成引号/花括号
 *    ⇒ 直接语法错(实测踩到 Missing closing '}')。统一补 UTF-8 BOM。
 * ② .bat/.cmd 含中文:cmd 走控制台代码页,即便加 BOM,`echo 中文` 在默认 GBK 控制台仍是乱码,
 *    且中文字节对可能被解析成 & | " 等元字符 —— 仓库对部署脚本本就有「ASCII 纪律」。
 *    故 .bat 一律改成 ASCII 英文文案(不改逻辑,只改 rem/echo 的文字)。
 *
 * 用法:node tools/archive/_fix-script-encoding.cjs [--dry]
 */
const fs = require('node:fs')
const path = require('node:path')

const DRY = process.argv.includes('--dry')
const ROOT = path.join(__dirname, '..', '..')
const BOM = Buffer.from([0xEF, 0xBB, 0xBF])

// ① 需补 BOM 的 .ps1(全都不含 BOM 且有中文)
const PS1 = [
  'deploy/install-tasks.ps1',
  'tools/scripts/enable-mixed-auth.ps1',
  'tools/scripts/trigger-mt.ps1',
  'tools/scripts/verify-i18n.ps1',
  'tools/archive/_clone-db-for-migration-test.ps1',
  'tools/archive/_grant-net.ps1',
  'tools/archive/_kill-backend-tree.ps1',
  'tools/archive/_rdp-run.ps1',
  'tools/archive/_repair-chain.ps1',
  'tools/archive/_start-docker.ps1',
  'tools/_minimize-hang.ps1',
  'tools/_pdf-evidence.ps1',
  'tools/_real-click-min.ps1',
  'tools/_restore-watch-min.ps1',
  'tools/_win-watch.ps1',
]

// ② .bat 的中文 → ASCII(逐行精确替换;键=原行 trim 后,值=新行全文,保留原缩进由脚本按 1:1 行替换)
const BAT = {
  'backend/build.bat': [
    ['rem YINJIA-MES 后端构建(本地 Maven + 自动探测 JDK)', 'rem YINJIA-MES backend build (local Maven + auto JDK detection)'],
    ['rem ---- JDK 探测: JAVA_HOME -> 常见安装目录 -> PATH ----', 'rem ---- JDK detection: JAVA_HOME -> common install dirs -> PATH ----'],
    ['echo [错误] 未找到 JDK 25', 'echo [ERROR] JDK 25 not found'],
    ['echo [错误] 未找到 Maven: %MAVEN_HOME%(tools 下无 apache-maven-3.9.9)', 'echo [ERROR] Maven not found: %MAVEN_HOME% (no apache-maven-3.9.9 under tools)'],
    ['echo [错误] 构建失败', 'echo [ERROR] build failed'],
  ],
  'backend/start-backend.bat': [
    ['rem 工作目录必须是仓库根:转ERP凭证兜底按 {工作目录}\\deploy\\push\\config.json 查找',
      'rem Working dir must be repo root: ERP push credential fallback looks up {cwd}\\deploy\\push\\config.json'],
  ],
  'start-project.bat': [
    ['rem YINJIA-MES 一键启动:后端(8090) + 前端 dev(5173)', 'rem YINJIA-MES one-click start: backend (8090) + frontend dev (5173)'],
    ['rem ---- JDK 探测(与 build.bat 一致) ----', 'rem ---- JDK detection (same as build.bat) ----'],
    ['where java >nul 2>nul || ( echo [错误] 未找到 JDK 25 & goto :fail )',
      'where java >nul 2>nul || ( echo [ERROR] JDK 25 not found & goto :fail )'],
    ['echo [提示] 后端未构建,先执行 backend\\build.bat', 'echo [HINT] backend not built yet; run backend\\build.bat first'],
    ['rem ---- 阿里云密钥:backend\\.env(本地,不入库);缺失时翻译/OCR 自动降级 ----',
      'rem ---- Aliyun keys: backend\\.env (local, not in git); missing => MT/OCR degrade gracefully ----'],
    ['echo [1/2] 启动后端 http://localhost:8090 ...', 'echo [1/2] starting backend  http://localhost:8090 ...'],
    ['echo [2/2] 启动前端 http://localhost:5173 ...', 'echo [2/2] starting frontend http://localhost:5173 ...'],
    ['echo 完成:浏览器访问 http://localhost:5173  (admin / 123456)', 'echo Done: open http://localhost:5173  (admin / 123456)'],
  ],
  'tools/pull-sync.bat': [
    ['rem YINJIA-MES 拉取云端 + 同步数据库:git pull -> DbSync 按 db-migrations.txt 增量执行',
      'rem YINJIA-MES pull + sync DB: git pull -> DbSync applies db-migrations.txt incrementally'],
    ['rem ---- JDK 探测(与 build.bat 一致) ----', 'rem ---- JDK detection (same as build.bat) ----'],
    ['where java >nul 2>nul || ( echo [错误] 未找到 JDK 25 & goto :fail )',
      'where java >nul 2>nul || ( echo [ERROR] JDK 25 not found & goto :fail )'],
    ['rem ---- JDBC 驱动:优先 tools\\lib,其次本地 .m2-repo ----', 'rem ---- JDBC driver: tools\\lib first, then local .m2-repo ----'],
    ['echo [错误] 未找到 mssql-jdbc 驱动: tools\\lib\\mssql-jdbc.jar', 'echo [ERROR] mssql-jdbc driver not found: tools\\lib\\mssql-jdbc.jar'],
    ['echo        也没有 %~dp0..\\.m2-repo\\...\\mssql-jdbc-12.8.2.jre11.jar ^(构建一次后端即可生成^)',
      'echo        and not under %~dp0..\\.m2-repo\\...\\mssql-jdbc-12.8.2.jre11.jar ^(built once with backend^)'],
    ['if errorlevel 1 ( echo [错误] git pull 失败,先解决冲突再同步数据库 & goto :fail )',
      'if errorlevel 1 ( echo [ERROR] git pull failed; resolve conflicts before syncing DB & goto :fail )'],
    ['echo [2/2] 同步数据库 HSDZ_MES(仅执行新增/有变化的脚本)...', 'echo [2/2] syncing database HSDZ_MES (only new/changed scripts)...'],
    ['if errorlevel 1 ( echo [错误] 数据库同步失败,查看上方输出 & goto :fail )',
      'if errorlevel 1 ( echo [ERROR] database sync failed; see output above & goto :fail )'],
    ['echo 完成:代码与数据库均已同步。', 'echo Done: code and database are in sync.'],
  ],
}

let done = 0
const problems = []

// ① .ps1 补 BOM
for (const rel of PS1) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) { problems.push(rel + ' 不存在'); continue }
  const buf = fs.readFileSync(abs)
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) { console.log('  = 已有 BOM: ' + rel); continue }
  if (buf[0] === 0xFF && buf[1] === 0xFE) { problems.push(rel + ' 是 UTF-16,需人工处理'); continue }
  if (!DRY) fs.writeFileSync(abs, Buffer.concat([BOM, buf]))
  console.log('  + 补 BOM: ' + rel)
  done++
}

// ② .bat 去中文
for (const [rel, pairs] of Object.entries(BAT)) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) { problems.push(rel + ' 不存在'); continue }
  const text = fs.readFileSync(abs, 'utf8')
  const lines = text.split(/\r?\n/)
  let hit = 0
  for (const [from, to] of pairs) {
    const idx = lines.findIndex((l) => l.trim() === from.trim())
    if (idx < 0) { problems.push(rel + ' 找不到原行: ' + from.slice(0, 40)); continue }
    const indent = lines[idx].match(/^\s*/)[0]
    lines[idx] = indent + to
    hit++
  }
  const still = lines.filter((l) => /[\u4e00-\u9fa5]/.test(l))
  if (still.length) problems.push(rel + ' 仍有中文 ' + still.length + ' 行: ' + still[0].trim().slice(0, 40))
  if (!DRY) fs.writeFileSync(abs, lines.join('\r\n'))
  console.log('  ~ ' + rel + ': 替换 ' + hit + '/' + pairs.length + ' 行')
  done++
}

console.log('\n处理 ' + done + ' 个文件' + (DRY ? '(dry-run,未写盘)' : ''))
if (problems.length) {
  console.log('需人工复核:')
  for (const p of problems) console.log('  ! ' + p)
  process.exit(1)
}
