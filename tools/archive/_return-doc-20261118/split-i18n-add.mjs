/**
 * split-i18n-add.mjs — 把「本任务」与「并行会话」在同一个语言包里的改动拆开:
 * 只把**本批 32/35 条生产退料词条**留在工作区并交给 git 暂存,并行会话那几行原样不动。
 *
 * 步骤(每步可核对):
 *   ① 先把当前 en.js / ja.js 各存一份(里面同时含双方改动);
 *   ② `git checkout HEAD --` 两个文件 ⇒ 回到已提交版本;
 *   ③ 重跑 add-i18n.mjs(幂等,只补本批词条)⇒ 工作区 = HEAD + 本任务;
 *   ④ `git add` 两个文件(索引里只有本任务);
 *   ⑤ 把①的副本写回工作区 ⇒ 工作区恢复成"双方合体",但索引仍只含本任务。
 *
 * 用法(仓库根):node tools/archive/_return-doc-20261118/split-i18n-add.mjs
 */
import { copyFileSync, unlinkSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const files = ['frontend/src/i18n/locales/en.js', 'frontend/src/i18n/locales/ja.js']
const backups = files.map((f) => f + '.both.tmp')

// ① 备份双方合体版
files.forEach((f, i) => copyFileSync(f, backups[i]))

// ② 回到已提交版本
for (const f of files) execFileSync('git', ['checkout', 'HEAD', '--', f], { stdio: 'inherit' })

// ③ 只补本任务词条
execFileSync(process.execPath, ['tools/archive/_return-doc-20261118/add-i18n.mjs'], { stdio: 'inherit' })

// ④ 暂存
for (const f of files) execFileSync('git', ['add', f], { stdio: 'inherit' })

// ⑤ 恢复双方合体版到工作区(索引不动)
files.forEach((f, i) => {
  copyFileSync(backups[i], f)
  if (existsSync(backups[i])) unlinkSync(backups[i])
})

console.log('完成:索引 = HEAD + 本任务词条;工作区 = 双方合体(并行会话的改动仍未暂存)')
