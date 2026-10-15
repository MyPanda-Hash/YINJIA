/*
 * _stage-first-insp-reqs.mjs — 把「首件检验单相关要求落地」这一批改动只写进**索引**(工作区不动)。
 *
 * 背景同 `_stage-first-insp-hunks.mjs`:同一棵工作树里还有另一个任务在改**同一批文件**
 * (`ButtonService.java`、`tools/db-migrations.txt`、10 个语言包),而 AGENTS 要求「一个任务一个 commit」。
 * 做法:取 `git show HEAD:<file>` 作基线,在本任务改动处**做与工作区同一处替换/插入**
 * (内容直接从工作区文件里抠出来,所以与最终工作区逐字一致),再 `git hash-object -w` +
 * `git update-index --cacheinfo` 挂到索引上 —— 别人的改动一行都进不了本次提交。
 *
 * 三种形态:
 *   ① 语言包:把本批 5 条词条(锚点 = 「已按成型工艺清单」行)插到锚点前;
 *   ② ButtonService.firstInspGenerate:把「规格型号 … → 生产线」之间那段换成工作区那段(本任务新增客户代码带入);
 *   ③ tools/db-migrations.txt:把文件末尾追加的本任务登记块补上。
 *
 * 用法: node tools/archive/_stage-first-insp-reqs.mjs [--dry]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const ROOT = 'D:/workspace/yinjia'
const dry = process.argv.includes('--dry')
const git = (args, input) => execFileSync('git', args, { cwd: ROOT, input, encoding: 'utf8' })
const read = (p) => fs.readFileSync(`${ROOT}/${p}`, 'utf8').replace(/\r\n/g, '\n')
const head = (p) => git(['show', `HEAD:${p}`])
const setIndex = (p, content) => {
  if (dry) { console.log(`  (dry) ${p}: ${content.split('\n').length} 行`); return }
  const tmp = `${process.env.TEMP || '/tmp'}/yinjia-stage-${p.replace(/[^A-Za-z0-9]/g, '_')}`
  fs.writeFileSync(tmp, content)
  // ⚠ 必须 --no-filters:临时文件在仓库外,`.gitattributes` 管不到它,于是 core.autocrlf=true 会把
  //   CRLF 洗成 LF —— `tools/db-migrations.txt` 在仓库里是 CRLF(-text),洗过之后整文件假重写(6448 行 diff 的教训)
  const blob = git(['hash-object', '-w', '--no-filters', tmp]).trim()
  git(['update-index', '--cacheinfo', `100644,${blob},${p}`])
  console.log(`  staged ${p} (${blob.slice(0, 8)})`)
}

/* ── ① 语言包:5 条词条插到锚点前 ─────────────────────────────────────────── */
const LOCALES = ['zh-TW', 'en', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'vi', 'th']
const KEYS = [
  '按相关要求：每个测试项目只记录 2 支样品（1#、2#）',
  '按相关要求：内外径、长度及重量保留小数点后1位',
  '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）',
  '按表显数据记录（不取整）',
  '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。',
]
const ANCHOR = '    "已按成型工艺清单":'
for (const loc of LOCALES) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  const base = head(p)
  if (base.includes(`"${KEYS[0]}":`)) { console.log(`  skip ${p}(基线里已有)`); continue }
  const work = read(p)
  const block = KEYS.map((k) => work.split('\n').find((l) => l.startsWith(`    ${JSON.stringify(k)}:`)))
  if (block.some((l) => !l)) { console.error(`  ✗ ${p}: 工作区里找不到本批词条,跳过`); continue }
  const i = base.indexOf(ANCHOR)
  if (i < 0) { console.error(`  ✗ ${p}: 锚点缺失`); continue }
  setIndex(p, base.slice(0, i) + block.join('\n') + '\n' + base.slice(i))
}

/* ── ② ButtonService:规格型号 → 生产线 之间那段(含本任务新增的客户带入) ──── */
{
  const p = 'backend/src/main/java/com/yinjia/mes/service/ButtonService.java'
  const START = '        if (!str(r.get("规格型号")).isEmpty()) head.put("规格型号", r.get("规格型号"));'
  const END = '        String line = str(r.get("生产线"));'
  const seg = (text) => {
    const lines = text.split('\n')
    const a = lines.indexOf(START)
    const b = lines.indexOf(END, a)
    if (a < 0 || b < 0) return null
    return lines.slice(a, b).join('\n') + '\n'
  }
  const base = head(p)
  const oldSeg = seg(base)
  const newSeg = seg(read(p))
  if (!oldSeg || !newSeg) { console.error('  ✗ ButtonService:锚点缺失,跳过'); }
  else if (oldSeg === newSeg) { console.log('  skip ButtonService(基线已含本任务改动)'); }
  else setIndex(p, base.replace(oldSeg, newSeg))
}

/* ── ③ db-migrations.txt:末尾追加本任务登记块 ─────────────────────────────── */
{
  const p = 'tools/db-migrations.txt'
  const MARK = '# ── 2026-10-16 首件检验单「相关要求」落地'
  const base = head(p)
  if (base.includes(MARK)) console.log('  skip db-migrations.txt(基线里已有)')
  else {
    // ⚠ 这个文件在 .gitattributes 里是 `-text`(混合行尾的历史文件,禁用行尾转换)⇒
    //   必须**按原始字节**取用,别把 CRLF 归一成 LF(否则整文件假重写,6448 行 diff 的教训)
    const work = fs.readFileSync(`${ROOT}/${p}`, 'utf8')
    const i = work.indexOf(MARK)
    if (i < 0) console.error('  ✗ db-migrations.txt:找不到本任务登记块')
    else setIndex(p, base.replace(/\n*$/, '\n\n') + work.slice(i))
  }
}
if (dry) console.log('(dry 只打印,不写索引)')
console.log('完成。核对: git diff --cached --stat')
