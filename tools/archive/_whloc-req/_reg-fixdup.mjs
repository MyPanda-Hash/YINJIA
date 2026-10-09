// 登记 migrate-whloc-fix-dup-zone-field-20261008.sql 到迁移链清单(逐字节追加,不重写全文 ⇒ 不翻转换行)
import fs from 'node:fs'
const p = 'D:/workspace/yinjia/tools/db-migrations.txt'
let t = fs.readFileSync(p, 'utf8')
const name = 'migrate-whloc-fix-dup-zone-field-20261008.sql'
if (t.includes(name)) { console.log('  已登记,跳过'); process.exit(0) }
const entry = `
# migrate-whloc-fix-dup-zone-field-20261008.sql(2026-10-08):修复 WHLOC 出现**重复的「存储分区」列**
#   用户报障(2026-10-08):仓位明细里「存储分区」列**出现两次**。
#   根因(实锤,yj_schema_log 时间线):migrate-whloc-area-a-raw §3 用 \`IF NOT EXISTS (... col_name=N'库区')\`
#     守卫注册「库区」字段,而链上后续的 migrate-whloc-clean-coord §2 把该列**改名成「存储分区」**⇒
#     area-a-raw 一旦重跑,守卫再也找不到「库区」⇒ **又插一行「库区」**,紧接着 clean-coord 又把它改名
#     ⇒ 同面板两行 (col_name='存储分区', label='存储分区') ⇒ 网格渲染出**两列同名**。
#     正式库:zonepick 15:23:48 → area-a-raw 16:04:52 → clean-coord 16:04:52.66 ⇒ 多一行 id=16157(文本,seq 34);
#     测试库:该对脚本重跑了两次 ⇒ 多两行(7408/7410)。这正是「历史脚本重跑撞 schema 演进」。
#   本脚本:① 删除 WHLOC 内同 (col_name,label) 的重复登记行(保留 MIN(id));
#     ② 规范化幸存的 大区/存储分区(类型=分区选择、seq 34/36、位置/宽度/可见性),
#        **补上 zonepick 那次因命中重复行而漏改的 data_type**(幸存行原本仍是「文本」);
#     ③ 自检重复组数=0、类型非分区选择=0、元数据漂移=0。
#   ⚠ 同批修复**根因**:migrate-whloc-area-a-raw 的守卫改为跨改名(库区 IN(库区,存储分区))+
#     跨删列(厂区 加 COL_LENGTH 前置),否则下次重跑还会再造重复。规范同步见 数据库规范.md §4.2。
#   幂等;两账套均执行。
${name}
`
if (!t.endsWith('\n')) t += '\n'
fs.writeFileSync(p, t + entry, 'utf8')
console.log('  ✓ 已登记')
