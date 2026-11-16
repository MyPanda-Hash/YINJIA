// 字节级手术:把「本任务 3 行」追加到 db-migrations.txt 的 HEAD blob 上(该文件 EOL 混合,禁止整文件重写)
const { execSync, spawnSync } = await import('node:child_process')
const fs = await import('node:fs/promises')
const ROOT = 'D:/workspace/yinjia'
const PATH = 'tools/db-migrations.txt'
const headBuf = spawnSync('git', ['cat-file', 'blob', `HEAD:${PATH}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).stdout
const curBuf = await fs.readFile(`${ROOT}/${PATH}`)
const marker = Buffer.from('\n# 2026-11-11 出货检验功能记录表', 'utf8')
const s = curBuf.indexOf(marker)
if (s < 0) throw new Error('找不到本任务注释')
let block = curBuf.slice(s)
const eol = headBuf.includes('\r\n') ? '\r\n' : '\n'
block = Buffer.from(block.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, eol), 'utf8')
let base = headBuf
if (!base.toString('utf8').endsWith(eol)) base = Buffer.concat([base, Buffer.from(eol, 'utf8')])
const clean = Buffer.concat([base, block])
const tmp = `${ROOT}/.tmp-dbmig-clean.txt`
await fs.writeFile(tmp, clean)
const sha = execSync(`git hash-object -w --no-filters "${tmp}"`, { cwd: ROOT, encoding: 'utf8' }).trim()
execSync(`git update-index --cacheinfo 100644,${sha},${PATH}`, { cwd: ROOT })
await fs.unlink(tmp)
console.log('STAGED_CLEAN ' + PATH + ' sha=' + sha.slice(0, 10) + ' eol=' + JSON.stringify(eol))
