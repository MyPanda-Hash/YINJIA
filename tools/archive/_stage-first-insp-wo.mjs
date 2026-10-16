/*
 * _stage-first-insp-wo.mjs — 把「取成型工艺清单按列合并 + 首件检验单选生产工单」这一批只写进**索引**
 * (工作区不动)。同一批文件里另一个任务还有未提交改动(`PanelConfigService.java` 的固定项注释 +
 * 10 个语言包的明细行词条),AGENTS 要求「一个任务一个 commit」,故同前两轮一样:
 *   取 `git show HEAD:<file>` 作基线 → 在本任务改动处做与工作区**同一处**替换/插入(内容直接从工作区
 *   抠出来,与最终工作区逐字一致)→ `git hash-object -w --no-filters` + `git update-index --cacheinfo`。
 *   ⚠ --no-filters:临时文件在仓库外、`.gitattributes` 管不到,autocrlf 会改写行尾(前一轮的教训)。
 *
 * 三类形态:
 *   ① 语言包:本批 14 条词条插到「已按成型工艺清单」行之前;
 *   ② PanelConfigService:两处 —— ① 检验项目/检验方案 的注入加「首件检验单除外」守卫;
 *      ② 给首件检验单注入「选生产工单」(插在 `g.put("actions", merged)` 之前);
 *   ③ 其余文件整文件入索引(本批只有我改过,直接 git add 即可 —— 本脚本不管)。
 *
 * 用法: node tools/archive/_stage-first-insp-wo.mjs [--dry]
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
  const blob = git(['hash-object', '-w', '--no-filters', tmp]).trim()
  git(['update-index', '--cacheinfo', `100644,${blob},${p}`])
  console.log(`  staged ${p} (${blob.slice(0, 8)})`)
}
/** 从 text 里取「以 startLine 开头、到其后第一条恰为 endLine 的行」那一段(含首尾) */
const segment = (text, startLine, endLine) => {
  const lines = text.split('\n')
  const a = lines.findIndex((l) => l.startsWith(startLine))
  if (a < 0) return null
  const b = lines.findIndex((l, i) => i > a && l === endLine)
  if (b < 0) return null
  return lines.slice(a, b + 1).join('\n') + '\n'
}

/* ── ① 语言包:14 条词条插到锚点前 ───────────────────────────────────────── */
const LOCALES = ['zh-TW', 'en', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'vi', 'th']
const KEYS = [
  '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格',
  '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。',
  '未生成首件检验单', '该工单行已有首件检验单', '已生成首件检验单', '生成首件检验单失败',
  '选生产工单', '生成制程检验单失败', '未生成制程检验单', '该工单行已有制程检验单',
  '已生成制程检验单', '请先填写产品编码', '生产工单行加载失败',
  '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。',
]
const ANCHOR = '    "已按成型工艺清单":'
for (const loc of LOCALES) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  const base = head(p)
  if (base.includes(`${JSON.stringify(KEYS[0])}:`)) { console.log(`  skip ${p}(基线里已有)`); continue }
  const work = read(p)
  const block = KEYS.map((k) => work.split('\n').find((l) => l.startsWith(`    ${JSON.stringify(k)}:`)))
  if (block.some((l) => !l)) { console.error(`  ✗ ${p}: 工作区里找不到本批词条,跳过`); continue }
  const i = base.indexOf(ANCHOR)
  if (i < 0) { console.error(`  ✗ ${p}: 锚点缺失`); continue }
  setIndex(p, base.slice(0, i) + block.join('\n') + '\n' + base.slice(i))
}

/* ── ② PanelConfigService:两处(别人的固定项注释不进本次提交) ─────────────── */
{
  const p = 'backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java'
  let base = head(p)
  const work = read(p)

  // ① 检验项目/检验方案:HEAD 是一行 if;工作区是「2 行注释 + 带守卫的 if」
  const oldA = '                    if (!merged.contains("检验项目/检验方案")) merged.add(anchor + 1, "检验项目/检验方案");'
  const newA = segment(work, '                    // 2026-10-16 第三轮:**首件检验单不要这个入口**', '                    }')
  // ② 选生产工单:插在 g.put("actions", merged) 之前
  const anchorB = '                    g.put("actions", merged);'
  const newB = segment(work, '                    // 2026-10-16 第三轮:**首件检验单也要能选生产工单**', '                    }')

  if (!base.includes(oldA)) console.error('  ✗ PanelConfigService:校验点①在基线里找不到')
  else if (base.includes('FIRST_INSP_PANEL.equals(def.code()) && !merged.contains("检验项目/检验方案")')) {
    console.log('  skip PanelConfigService①(基线里已有)')
  } else base = base.replace(oldA, newA.replace(/\n$/, ''))

  if (!base.includes(anchorB)) console.error('  ✗ PanelConfigService:校验点②在基线里找不到')
  else if (base.includes('首件检验单也要能选生产工单')) console.log('  skip PanelConfigService②(基线里已有)')
  else base = base.replace(anchorB, newB + anchorB)

  if (newA && newB && !head(p).includes('FIRST_INSP_PANEL.equals(def.code()) && !merged.contains("检验项目/检验方案")')) {
    setIndex(p, base)
  }
}
if (dry) console.log('(dry 只打印,不写索引)')
console.log('完成。核对: git diff --cached --stat')
