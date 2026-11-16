// 只把「本任务新增的那一行」暂存进 en.js(工作区里还有别的任务的未提交词条:本线排产数量 / 生产工单滚动加载)
const { execSync } = await import('node:child_process')
const fs = await import('node:fs/promises')
const ROOT = 'D:/workspace/yinjia'
const PATH = 'frontend/src/i18n/locales/en.js'
const cur = await fs.readFile(`${ROOT}/${PATH}`, 'utf8')
const lines = cur.split(/\r?\n/)
const drop = new Set()
lines.forEach((l, i) => {
  if (l.includes('本线排产数量')) drop.add(i)
  if (l.includes('// ---- 生产工单·滚动加载')) drop.add(i)
  if (/^\s*'已加载':/.test(l) || /^\s*'向下滚动加载更多':/.test(l) || /^\s*'已全部加载':/.test(l)) drop.add(i)
})
const clean = lines.filter((_, i) => !drop.has(i)).join('\n') + '\n'
const tmp = `${ROOT}/.tmp-clean-en.js`
await fs.writeFile(tmp, clean, 'utf8')
const sha = execSync(`git hash-object -w "${tmp}"`, { cwd: ROOT, encoding: 'utf8' }).trim()
execSync(`git update-index --cacheinfo 100644,${sha},${PATH}`, { cwd: ROOT })
await fs.unlink(tmp)
console.log('STAGED_CLEAN en.js sha=' + sha.slice(0, 10) + ' dropped=' + drop.size)
