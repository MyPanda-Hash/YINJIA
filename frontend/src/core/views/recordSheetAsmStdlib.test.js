/**
 * recordSheetAsmStdlib.test.js —— 组装工艺清单「工艺形态」必须是**可维护的标准库**
 *
 * 【用户口径 2026-10-29】
 *   「研发管理的组装工艺清单的所有 tap 的工艺形态改为标准库,可以自己新增删除维护」
 *
 * 【为什么必须自动化守】
 *   这条链**横跨三层**,任何一层断了界面都只是「看起来正常、实际不能维护」:
 *     ① 数据库:yj_field.data_type='标准库' + dict_sql='asm.form'
 *        —— 写成 '下拉框' 时选项照样能选(值来自 dict_sql 的 SQL),但**没有维护入口**;
 *     ② 后端:PanelConfigService.fieldSpec 只有 data_type='标准库' 才下发 stdLib,
 *        前端 stdLibOf() 全靠这个字段决定要不要挂「⧉ 标准库维护」;
 *     ③ 前端配置:工艺形态必须留在「产品基本信息」区(type='select'),
 *        且**不能**同时在 dt.variants 之外再走一条变体切换行(会出两个下拉)。
 *   2026-10-21 的「产品功能类别」就是漏了第 ①/② 层被返工过一次(见
 *   migrate-prod-func-type-stdlib-fix-20261021.sql 头部注释)。
 *
 * 【asm.form 与 asm.proc 是**两个库**,钉住不许合并】
 *   asm.proc:一变体一条目,item_code=变体名,content={v:1,rows:[...]} 工序 JSON
 *   asm.form:一条一个形态名,item_code='默认',content=形态名(如 裸棒)
 *   合并会让变体勾选弹窗(整表替换)里混进没 rows 的条目,
 *   也会让标准库维护弹窗把工序 JSON 当形态名展示。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const vue = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../../../../tools/migrate-asm-proc-form-stdlib-20261029.sql', import.meta.url),
  'utf8',
)

test('工艺形态仍在「产品基本信息」区,且是 select(标准库入口才挂得上)', () => {
  const cfg = recordSheetConfigs.RD_ASM_PROC
  assert.ok(cfg, 'RD_ASM_PROC 配置缺失')
  const secs = (cfg.sections || []).filter((s) => s.bar === '产品基本信息')
  assert.ok(secs.length >= 1, '组装工艺清单缺「产品基本信息」区')
  const pairs = secs.flatMap((s) => (s.rows || []).flatMap((r) => r.pairs || []))
  const hit = pairs.find((p) => p.key === '工艺形态')
  assert.ok(hit, '「产品基本信息」区里找不到 工艺形态 格')
  assert.equal(hit.type, 'select', '工艺形态 必须是 select —— 文本格挂不出标准库下拉')
})

test('工艺形态仍是变体字段(variantKey),否则 4 个关键控制清单标题不跟随', () => {
  const cfg = recordSheetConfigs.RD_ASM_PROC
  assert.equal(cfg.variantKey, '工艺形态', '工艺形态 同时是 variants 的驱动字段,不能改成别的键')
  assert.deepEqual(Object.keys(cfg.variants || {}), ['裸棒', '机器包布', '复合半成品', '成品'])
})

test('标准库入口由元数据驱动:stdLibOf 只看 dataType/标准库,不在这里写死库名', () => {
  // 若哪天有人在配置里加死 stdLib:'asm.form',就绕过了后端 fieldSpec —— 改库时两处会漂移
  const cfg = recordSheetConfigs.RD_ASM_PROC
  const secs = cfg.sections || []
  const pairs = secs.flatMap((s) => (s.rows || []).flatMap((r) => r.pairs || []))
  const hit = pairs.find((p) => p.key === '工艺形态')
  assert.equal(hit.stdLib, undefined, '工艺形态 不应在配置里写死 stdLib(必须由 yj_field.dict_sql 下发)')
  assert.match(
    vue,
    /function stdLibOf\(key\) \{[\s\S]{0,260}?f\.dataType === '标准库'/,
    'stdLibOf 必须按 dataType=标准库 判定(这是「⧉ 标准库维护」入口的唯一开关)',
  )
})

test('迁移脚本把字段改成标准库 + 库编码 asm.form,且种子覆盖 4 个现有形态', () => {
  // ⚠ 只认 UPDATE 语句本体:文件里别处还有「自检」语句同样含 dict_sql = N'asm.form',
  //   用整文件 match 会把改错的 UPDATE 放过(实测:把 UPDATE 的库编码改成 asm.wrong 仍然绿)。
  const upd = migration.match(/UPDATE yj_field\s+SET[\s\S]*?WHERE panel_code = N'RD_ASM_PROC'[\s\S]*?col_name\s*= N'工艺形态'/)
  assert.ok(upd, '找不到把 工艺形态 改成标准库的那条 UPDATE')
  assert.match(upd[0], /SET data_type = N'标准库'/, 'UPDATE 必须把 data_type 改成 标准库')
  assert.match(upd[0], /dict_sql\s*= N'asm\.form'/, 'UPDATE 的库编码必须是 asm.form')
  for (const v of ['裸棒', '机器包布', '复合半成品', '成品']) {
    assert.ok(migration.includes(`(N'${v}',`), `asm.form 种子缺形态「${v}」`)
  }
  // 与 asm.proc 分离:脚本只碰 asm.form,不许往 asm.proc 写
  assert.ok(!/INSERT INTO yj_std_lib[\s\S]{0,200}?N'asm\.proc'/.test(migration),
    'asm.proc 承载关键控制清单内容,迁移不得往里写条目')
})

test('标准库维护弹窗能增/删:StdLibManager 必须提供新增与删除/停用', () => {
  const mgr = readFileSync(new URL('./StdLibManager.vue', import.meta.url), 'utf8')
  assert.match(mgr, /\/stdlib\/add/, 'StdLibManager 缺新增(/stdlib/add)')
  assert.match(mgr, /\/stdlib\/remove/, 'StdLibManager 缺停用(/stdlib/remove)')
  // 「删除」的另一条路:变体弹窗里的彻底删除(组装工艺这类带 dbId 的卡片态)
  assert.match(vue, /\/stdlib\/destroy/, '组装工艺变体弹窗缺彻底删除(/stdlib/destroy)')
})
test('用户自己新增的工艺形态不会退回「裸棒」标题(自定义变体要派生标题)', () => {
  // 工艺形态变成可维护标准库后,用户能加 variants 里没有的形态(如 半成品A)。
  // 原实现对未知值直接回落到 Object.keys(vs)[0] ⇒ 标题印成「…---裸棒」,看着像选错了变体。
  assert.match(
    vue,
    /const derived = variantTitleOf\(first, String\(val\)\)/,
    'activeVariant 必须为未登记的自定义变体派生标题,不能直接回落到第一个变体',
  )
  assert.match(
    vue,
    /function variantTitleOf\(baseName, name\) \{[\s\S]{0,400}?return t\.slice\(0, t\.length - baseName\.length\) \+ name/,
    'variantTitleOf 必须把已登记标题结尾的变体名替换成新形态名',
  )
  // 推不出来时不许乱编(返回空串 → 上层退回面板级标题)
  assert.match(
    vue,
    /if \(!t \|\| !baseName \|\| !t\.endsWith\(baseName\)\) return ''/,
    '标题不以变体名结尾时必须返回空串,不能凭猜测拼标题',
  )
})
