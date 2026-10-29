/**
 * rdInspPlanDocNo.test.js —— 出货检验计划表的纸面编号必须绑**真实自动单号**
 *
 * 【用户口径 2026-10-28，选 A】「这个默认的编号去掉，只保留背景提示词：请填写编号」
 *   + 「为什么其他的没有系统自动发的单据号」
 *
 * 【实测事实（正式账套 HSDZ_MES）】四个受控文件**都已经在自动发单号**：
 *   规格书 SD-2026-10-0002 / 成型工艺清单 MP-2026-10-0004 / 组装工艺清单 AP-2026-10-0003
 *   / 出货检验计划表 **IP-2026-10-0015** —— 后者这个号一直在正常生成。
 *
 * 问题只在纸面：出货检验计划表那一格绑的是 `yj_field.文档编号`，而 `rd_insp_plan_head.文档编号`
 * 上挂着数据库默认约束 `DF_insp_docno DEFAULT N'YJ-RD001'` ⇒ 10 张单全部同一个值，
 * 屏幕上看着像"固定编号"。它跟单据号（IP-…）毫无关系。
 *
 * 【改法（方案 A）】
 *   ① 删掉那条 DEFAULT 约束（脚本 tools/migrate-drop-insp-docno-default-20261028.sql）；
 *   ② `yj_field` 不再把「文档编号」登记成 header 字段 ⇒ 前端 `docNoKeyOf` 落到「单据编号」，
 *      与成型/组装/规格书三张完全一致（只读显示 IP-… 自动号）；
 *   ③ 物理列保留（历史数据不丢），只是不再上纸、不再有默认值。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { docNoKeyOf } from '../panel/sheetDocNo.js'

const migration = readFileSync(
  new URL('../../../../tools/migrate-drop-insp-docno-default-20261028.sql', import.meta.url), 'utf8')

test('docNoKeyOf：head 里没有「文档编号」时落到「单据编号」（纸面就显示自动号）', () => {
  // 这正是改完之后 RD_INSP_PLAN 拿到的形状 —— 它不再下发 文档编号 这个 header 字段
  assert.equal(docNoKeyOf({ 单据编号: 'IP-2026-10-0015' }), '单据编号')
  // 反例守卫：只要还下发 文档编号（哪怕是空串），就会绑回它 —— 那 YJ-RD001 会继续出现
  assert.equal(docNoKeyOf({ 文档编号: 'YJ-RD001', 单据编号: 'IP-2026-10-0015' }), '文档编号')
})

test('迁移脚本删掉 DF_insp_docno 默认约束，且是幂等的', () => {
  assert.match(migration, /DF_insp_docno/, '要点名那条约束')
  assert.match(migration, /DROP CONSTRAINT/i, '要真的删约束')
  // 幂等：先查存在再删（可重复执行，两账套都跑）
  assert.match(migration, /IF\s+EXISTS|OBJECT_ID|sys\.default_constraints/i, '必须存在性判断后才删')
  assert.ok(!/DROP\s+COLUMN/i.test(migration), '物理列必须保留（历史数据不丢）')
})

test('迁移脚本自带自检：删完后该列不再有默认约束', () => {
  assert.match(migration, /SELECT/i, '末尾要有自检查询')
  assert.match(migration, /自检|检查/i, '自检要写明在查什么')
})

test('注册进 db-migrations.txt（否则 DbSync 不会执行它）', () => {
  const reg = readFileSync(new URL('../../../../tools/db-migrations.txt', import.meta.url), 'utf8')
  assert.match(reg, /migrate-drop-insp-docno-default-20261028\.sql/,
    '迁移清单没登记 = 服务器上永远不会执行')
})
