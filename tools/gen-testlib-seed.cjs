// gen-testlib-seed.cjs — 检验项目标准库种子生成器(规格书 spec.test + 出货检验计划 insp.plan)
// 数据源 = 前端两处内置常量(重构后仅作种子与未迁移环境兜底,DB 为唯一真源):
//   · frontend/src/core/views/specTestLib.js        SPEC_TEST_LIB(26 组/48 子项,规格书检验项目)
//   · frontend/src/core/views/recordSheetConfigs.js RD_INSP_PLAN.dataTables[].lib(必测项 7 + 型式检验 6)
// 产物 tools/migrate-testlib-seed.sql:幂等(NOT EXISTS 按 lib+item+JSON $.name 去重,用户已建同名条目不覆盖);
//   条目正文 = testItemLib 规范结构 v2(JSON),asp_user1='seed' 留痕。
// 注意:章节库(spec.section)种子走既有 tools/gen-stdlib-seed.cjs,本脚本不碰它。
// 用法: node tools/gen-testlib-seed.cjs     (生成后用 SqlRunner 执行 SQL)
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(__dirname, 'migrate-testlib-seed.sql')

/** 读 ESM 数据文件为对象:剥掉 import/export 后求值(纯数据常量;deps 提供被剥 import 的绑定) */
function loadModule(file, names, deps = {}) {
  const src = fs.readFileSync(file, 'utf8')
    .replace(/^import[^\n]*$/gm, '')
    .replace(/^export\s+/gm, '')
  const fn = new Function(...Object.keys(deps), src + '\nreturn {' + names.join(',') + '}')
  return fn(...Object.values(deps))
}

const specLib = loadModule(path.join(ROOT, 'frontend/src/core/views/specTestLib.js'), ['SPEC_TEST_LIB']).SPEC_TEST_LIB
const cfgs = loadModule(path.join(ROOT, 'frontend/src/core/views/recordSheetConfigs.js'), ['recordSheetConfigs'], { SPEC_TEST_LIB: specLib }).recordSheetConfigs

if (!Array.isArray(specLib) || !specLib.length) throw new Error('SPEC_TEST_LIB 加载失败')
const inspTables = cfgs.RD_INSP_PLAN?.dataTables || []
const inspLibs = inspTables.filter((dt) => Array.isArray(dt.lib) && dt.lib.length)
if (inspLibs.length !== 2) throw new Error('RD_INSP_PLAN lib 数量异常: ' + inspLibs.length)

// ── 规范结构 v2(与 frontend/src/core/panel/testItemLib.js 的键一致;加字段时两边同步) ──
const V = 2
const specEntries = []
for (const g of specLib) {
  for (const s of g.subs || []) {
    specEntries.push({ item: g.name, seq: (specEntries.length + 1) * 10, content: JSON.stringify({
      v: V, group: g.name, name: s.name || '', req: s.req || '', method: s.method || '', basis: s.basis || '',
    }) })
  }
}
const inspEntries = []
for (const dt of inspLibs) {
  for (const r of dt.lib) {
    inspEntries.push({ item: dt.filterVal, seq: (inspEntries.length + 1) * 10, content: JSON.stringify({
      v: V, group: dt.filterVal, name: r['控制项目'] || '', req: r['控制标准及要求'] || '', method: r['控制方法'] || '',
      quality: r['质量控制内容'] || '', instrument: r['检测仪器'] || '', inspect: r['检验'] || '',
      measure: r['不合格应对措施'] || '', freq: r['检测频率'] || '', sampling: r['取样方式'] || '',
      content: r['检验内容'] || '',
    }) })
  }
}

const nq = (s) => 'N\'' + String(s).replace(/'/g, '\'\'') + '\''
// 去重键 = lib+item+name+quality:name 在规格书侧=子项目名(组内唯一);
// 出货计划侧 name=控制项目(组名口径,同组多条靠 quality 质量控制内容区分),必须带上 quality 才不误杀
function emit(lib, entries) {
  return entries.map((e) => {
    const c = JSON.parse(e.content)
    // 谓词字面量与 content 同源;缺键(如规格书侧无 quality)必须落 N'',绝不能变 N'undefined'(会全量重插)
    return `IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=${nq(lib)} AND item_code=${nq(e.item)} AND ISNULL(JSON_VALUE(content,'$.name'),N'')=${nq(c.name || '')} AND ISNULL(JSON_VALUE(content,'$.quality'),N'')=${nq(c.quality || '')}) INSERT INTO yj_std_lib (lib_code, item_code, seq, content, asp_user1, asp_time1) VALUES (${nq(lib)}, ${nq(e.item)}, ${e.seq}, ${nq(e.content)}, N'seed', SYSDATETIME());`
  })
}

const sql = [
  '-- migrate-testlib-seed.sql — 检验项目标准库种子(生成物,由 tools/gen-testlib-seed.cjs 生成,勿手改)',
  '-- 规格书(spec.test)=SPEC_TEST_LIB 26 组/48 子项;出货检验计划(insp.plan)=必测项 7 + 型式检验 6。',
  '-- 幂等:按 lib+item+JSON $.name 去重;用户已建同名条目不覆盖。条目正文=规范结构 v2。',
  '-- 运行(UTF-8 无 BOM): java -cp .m2-repo/.../mssql-jdbc-*.jar SqlRunner.java <url> yinjia <pw> migrate-testlib-seed.sql',
  'USE HSDZ_MES;',
  'SET NOCOUNT ON;',
  ...emit('spec.test', specEntries),
  ...emit('insp.plan', inspEntries),
  `SELECT lib_code, COUNT(*) AS total_rows, SUM(CASE WHEN asp_user1=N'seed' THEN 1 ELSE 0 END) AS seed_rows FROM yj_std_lib WHERE lib_code IN (N'spec.test', N'insp.plan') GROUP BY lib_code;`,
  '',
].join('\n')
fs.writeFileSync(OUT, sql, 'utf8')
console.log(`OK ${OUT}: spec.test ${specEntries.length} 条, insp.plan ${inspEntries.length} 条`)
