// 只把本任务(表观单)新增的 4 行追加到 db-migrations.txt 的 HEAD blob(文件里还有别的任务的未提交块)
const { execSync, spawnSync } = await import('node:child_process')
const fs = await import('node:fs/promises')
const ROOT = 'D:/workspace/yinjia'
const PATH = 'tools/db-migrations.txt'
const headBuf = spawnSync('git', ['cat-file', 'blob', `HEAD:${PATH}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).stdout
const curBuf = await fs.readFile(`${ROOT}/${PATH}`)
const marker = Buffer.from('\n# 2026-11-12 出货检验表观', 'utf8')
const s = curBuf.indexOf(marker)
if (s < 0) throw new Error('找不到本任务注释')
let block = curBuf.slice(s).toString('utf8')
// 只取到脚本行为止(后面若有别的任务块也不带)
const lines = block.split(/\r?\n/)
const cut = []
for (const ln of lines) {
  cut.push(ln)
  if (ln.trim() === 'migrate-qc-asm-insp-batch-table-20261112.sql') break
}
block = cut.join('\r\n')
let base = headBuf
if (!base.toString('utf8').endsWith('\n')) base = Buffer.concat([base, Buffer.from('\r\n')])
const clean = Buffer.concat([base, Buffer.from(block, 'utf8')])
const tmp = `${ROOT}/.tmp-dbmig-asm.txt`
await fs.writeFile(tmp, clean)
const sha = execSync(`git hash-object -w --no-filters "${tmp}"`, { cwd: ROOT, encoding: 'utf8' }).trim()
execSync(`git update-index --cacheinfo 100644,${sha},${PATH}`, { cwd: ROOT })
await fs.unlink(tmp)
console.log('STAGED_CLEAN ' + PATH + ' sha=' + sha.slice(0, 10))
