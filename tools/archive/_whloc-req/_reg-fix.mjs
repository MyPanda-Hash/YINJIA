// 登记两条修复迁移到链清单(逐字节追加,保留原换行)
import fs from 'node:fs'
const p = 'D:/workspace/yinjia/tools/db-migrations.txt'
let t = fs.readFileSync(p, 'utf8')
const entries = [
  {
    name: 'migrate-whloc-fix-dup-zone-field-20261008.sql',
    text: `# migrate-whloc-fix-dup-zone-field-20261008.sql(2026-10-08):修复 WHLOC 出现**重复的「存储分区」列**
#   用户报障:仓位明细里「存储分区」列**出现两次**。
#   根因(实锤,yj_schema_log):migrate-whloc-area-a-raw §3 用 \`IF NOT EXISTS (... col_name=N'库区')\` 守卫,
#     而链上后续 migrate-whloc-clean-coord §2 把该列**改名成「存储分区」**⇒ area-a-raw 一旦重跑,守卫
#     再也找不到「库区」⇒ **又插一行「库区」**,紧接着 clean-coord 又把它改名 ⇒ 同面板两行「存储分区」。
#     正式库:zonepick 15:23:48 → area-a-raw 16:04:52 → clean-coord 16:04:52.66 ⇒ 多一行 id=16157(文本,seq 34);
#     测试库:重跑两次 ⇒ 多两行。即「历史脚本重跑撞 schema 演进」。
#   本脚本:① 删 WHLOC 内同 (col_name,label) 的重复登记行(保留 MIN(id));
#     ② 规范化幸存的 大区/存储分区(类型=分区选择、seq 34/36),**补上 zonepick 因命中重复行而漏改的 data_type**;
#     ③ 自检。根因同批修在 area-a-raw(守卫跨改名)。幂等;两账套均执行。`,
  },
  {
    name: 'migrate-whloc-drop-stale-cols-20261008.sql',
    text: `# migrate-whloc-drop-stale-cols-20261008.sql(2026-10-08):清理同一事故留下的**废弃列/漂移字段/孤儿译名**
#   现象:bs_wh_loc 多出两个 100% 空列(厂区/库区),列数 38→40;且 yj_field 多一行挂在仓位表上的「厂区」
#     ⇒ 体检 05 项「元数据漂移」FAIL。
#   来由:migrate-whloc-area-a-raw §2 的 \`IF COL_LENGTH('厂区') IS NULL ALTER TABLE ADD\` 在重跑时把
#     zone-logic 刻意删掉的列**"自愈"补了回来**,§3 的字段守卫随之放行;库区 同理(它已被改名成 存储分区)。
#   步骤顺序是关键:**先 DROP 列、再删漂移行**(漂移判据是"列不存在",列还在就判不出来)。
#   ⚠ 整段必须用**动态 SQL**:T-SQL 对「存在的表+不存在的列」是编译期绑定,写在未执行的 IF 分支里
#     也会报 Invalid column name(实测踩到,初版 §1.2 就因此整脚本 FAIL)。
#   DROP 前做空列校验,非空则拒绝并告警,绝不静默丢数据。幂等(已清则全 0 行);两账套均执行;
#   实测:列数回 38、WHLOC 字段 12、漂移 0、679 仓位与 259 个分区值未动。`,
  },
]
let added = 0
for (const e of entries) {
  if (t.split(/\r?\n/).some((L) => L.trim() === e.name)) { console.log(`  = ${e.name} 已在清单`); continue }
  if (!t.endsWith('\n')) t += '\n'
  t += '\n' + e.text + '\n' + e.name + '\n'
  added++
}
fs.writeFileSync(p, t, 'utf8')
console.log(`  ✓ 新增登记 ${added} 条`)
