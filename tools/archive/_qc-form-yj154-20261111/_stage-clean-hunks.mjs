// 只暂存「本任务」的行:hunk 级手术(en.js / db-migrations.txt 里混着别的任务的未提交改动)
const { execSync } = await import('node:child_process')
const fs = await import('node:fs/promises')
const ROOT = 'D:/workspace/yinjia'
const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' })
const showHead = (p) => run(`git show HEAD:${p}`)

async function stageClean(path, buildClean) {
  const clean = buildClean(showHead(path), await fs.readFile(`${ROOT}/${path}`, 'utf8'))
  const tmp = `${ROOT}/.tmp-clean-${path.replace(/\W+/g, '_')}`
  await fs.writeFile(tmp, clean, 'utf8')
  const sha = run(`git hash-object -w "${tmp}"`).trim()
  run(`git update-index --cacheinfo 100644,${sha},${path}`)
  await fs.unlink(tmp)
  console.log('STAGED_CLEAN ' + path + ' sha=' + sha.slice(0, 10))
}

// 1) en.js:HEAD + 本任务块(从"出货检验功能记录表 YJ-QR-154"注释到业务对象收尾前)
await stageClean('frontend/src/i18n/locales/en.js', (head, cur) => {
  const startMarker = '    // ---- 出货检验功能记录表 YJ-QR-154 表样改造'
  const s = cur.indexOf(startMarker)
  const endCur = cur.lastIndexOf('  },\n\n}')
  if (s < 0 || endCur < 0) throw new Error('en.js 找不到本任务块')
  const block = cur.slice(s, endCur)
  const endHead = head.lastIndexOf('  },\n\n}')
  if (endHead < 0) throw new Error('en.js HEAD 收尾找不到')
  return head.slice(0, endHead) + block + head.slice(endHead)
})

// 2) db-migrations.txt:HEAD + 本任务 3 行(空行/注释/脚本名)
await stageClean('tools/db-migrations.txt', (head, cur) => {
  const s = cur.indexOf('\n# 2026-11-11 出货检验功能记录表')
  if (s < 0) throw new Error('db-migrations.txt 找不到本任务注释')
  const block = cur.slice(s)
  return head.replace(/\s*$/, '\n') + block
})
