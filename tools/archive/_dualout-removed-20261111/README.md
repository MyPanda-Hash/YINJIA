# 切炭直销（裁切双出口）下线 — 2026-11-11

> 用户口径（2026-11-11）：「没有这个路线直接删除掉，不要实现了」。

## 一、删了什么

| 位置 | 删除内容 |
|---|---|
| `ButtonService.java` | 审核钩子 `dualOutFinishIn(def.code(), no, user)`、弃审钩子 `dualOutRedReverse(...)` 两个调用点；两个方法体（约 150 行；含建 `FINISH_IN` 并自动审核、红字负数量冲回、`form_flow_link` 幂等/释放） |
| `WoReportService.java` | `rows()` 里的 `ISNULL([直销数量],0) AS dual_qty` 取数；`validateRow()` 里的「直销数量 ≤ 报工数量」校验 |
| `tools/migrate-drop-dualout-direct-sale-20261111.sql`（新增，已登记 `tools/db-migrations.txt`） | `DELETE yj_field`（`WO_REPORT` id 13265 / `WO_REPORT_LIST` id 13278）、`DELETE yj_translation`（`直销数量`、历史 `直销数量(切炭)`）；末尾自检 PASS |
| `docs/design/生产流程-现役实现.md` §4.1 | 标注**已下线**，下面保留为历史记录 |

**没有删**（有意保留）：
- 物理列 `scjl.直销数量` / `wo_report.直销数量` / `wo_stage_report.dual_out_qty` / `pr_cut_daily.直销数量`
  —— 冻结登记遗留表 / 已停用表，全库 **0 条非零数据**、代码 **0 引用**；DROP COLUMN 会牵动表清单列数、
  历史导入脚本与冻结表红线，故按「功能下线」处理。要彻底删列另开一次性迁移。
- 前端 10 个语言包里的 `'直销数量'` 词条（字段下架后无引用，留着无害；改它们会撞并行会话的 i18n 改动）。

## 二、验证

| 项 | 结果 |
|---|---|
| `mvn -DskipTests compile` | 通过 |
| 后端残留引用 | 仅 1 处注释（`ButtonService` 里说明「已下线」），无代码引用 |
| 正式库 `HSDZ_MES` 执行迁移 | `[PASS] 切炭直销字段已下架；物理列保留`，`[OK] 1 batches`，已写 `yj_schema_log` |
| 测试库 `HSDZ_MES_TEST` 执行迁移 | 同上 |
| 两库 `DbSync`（同步） | 正式 / 测试均「执行 0、失败 0」（跳过 738） |
| `yj_field` 核对 | 两库 `col_name='直销数量'` 均 **0 行**；`WO_REPORT` 13 个字段，含「直销」= 0 |
| 5173 界面（ego，`round-04.png`） | 打开「工序报工单」列表：表头 11 列**无「直销数量」**，整页文本命中「直销」= 0 |

## 三、生效范围说明

- 面板字段已从数据库元数据删除 ⇒ **5173 与 8090 立即不再显示该列**（面板是元数据驱动）。
- 8090 现役 jar 仍是 13:49 打包的（里面还有两个旧方法），但因为报工单已无法录入 `直销数量`（恒 NULL/0），
  两个钩子必然早退，实际行为等价于已下线；**下次 repack 后旧方法即从字节码消失**。

## 四、复跑方式

```powershell
cd tools
java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-dualout-direct-sale-20261111.sql        # 正式库
$env:YINJIA_SQL_DB='HSDZ_MES_TEST'; java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-dualout-direct-sale-20261111.sql
```

界面取证：`round-04.mjs`（ego，5173 工序报工单面板）+ `round-04.png`。
