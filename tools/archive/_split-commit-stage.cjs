// _split-commit-stage.cjs — 提交拆分:PanelxList 只暂存「空表头修复」hunk;db-migrations 只暂存 share-file 行
const { execSync } = require('child_process')
const fs = require('fs')

// ── PanelxList.vue:取 git diff 的第一个 hunk(我的修复),git apply --cached ──
const diff = execSync('git diff -- frontend/src/core/views/PanelxList.vue', { maxBuffer: 1e8 }).toString('utf8')
const idx = diff.indexOf('@@')
const header = diff.slice(0, idx)
const hunks = diff.slice(idx).split('\n@@ ')
console.log('PanelxList hunk 数:', hunks.length)
hunks.forEach((h, i) => console.log(`  [${i}] ${h.slice(0, 55).replace(/\n/g, ' ')}`))
const patch = header + hunks[0] + (hunks[0].endsWith('\n') ? '' : '\n') // split 吃掉了 hunk 尾部 \n,补回
fs.writeFileSync('tools/archive/_p1.patch', patch)
execSync('git apply --cached tools/archive/_p1.patch')
console.log('已暂存 hunk0。staged:')
console.log(execSync('git diff --cached --stat').toString().trim())

// ── db-migrations.txt:只把 migrate-share-file.sql 行入索引,工作区保留全部 ──
const f = 'tools/db-migrations.txt'
const head = execSync('git show HEAD:tools/db-migrations.txt', { maxBuffer: 1e8 })
const cur = fs.readFileSync(f)
if (!cur.slice(0, head.length).equals(head)) throw new Error('HEAD 不是当前文件的前缀,需人工检查')
const added = cur.slice(head.length).toString('utf8')
console.log('db-migrations 尾部新增:', JSON.stringify(added))
if (!added.includes('migrate-share-file.sql')) throw new Error('未找到 share-file 登记行')
const eol = added.includes('\r\n') ? '\r\n' : '\n'
const staged = Buffer.concat([head, Buffer.from('migrate-share-file.sql' + eol, 'utf8')])
fs.writeFileSync(f, staged)
execSync('git add tools/db-migrations.txt')
fs.writeFileSync(f, cur)
console.log('db-migrations 部分暂存完成')
console.log('staged:', execSync('git diff --cached --stat').toString().trim())
console.log('worktree 剩余:', execSync('git diff --stat').toString().trim())
