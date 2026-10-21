# 库存状况异常取证(2026-10-21)

> 对应文档:[库存状况异常-当前取证与提交影响-20261021.md](../../../docs/development/库存状况异常-当前取证与提交影响-20261021.md)
> 口径:**只读**。所有脚本都是 `SELECT`,没有任何 DML。库 = 本地 `HSDZ_MES`(SQL Server 2019 容器 `mssql2019`,15.00.4480)。

## 怎么跑

```powershell
cd tools\archive\_stock-ledger-diagnose-20261021
$JAVA = "$env:USERPROFILE\.jdks\ms-25.0.4\bin\java.exe"
# _Q.java = 通用只读探针:打印列名 + 制表符分隔的行,<库名> <sql 文件> [<sql 文件> ...]
& $JAVA -Dstdout.encoding=UTF-8 -cp ..\..\lib\mssql-jdbc.jar _Q.java HSDZ_MES q3-reconcile.sql
```

`_Q.java` 的两个注意事项(踩过):

1. **整个文件当一条批处理执行**(只按 `GO` 切),这样 `DECLARE @x` 能跨语句用;
2. 中文**列名**引用要用方括号(`[现存量]`),裸写会报 `Invalid column name`(驱动按 GBK 送标识符)。

`msdb` 相关的 `q7`/`q9` 用三段名(`msdb.dbo.restorehistory`),从任何库跑都行。
25 个脚本 2026-10-21 全量跑过一遍,全部 OK。

## 文件

| 文件 | 查什么 | 关键结论 |
|---|---|---|
| `q1-overview.sql` | 结存总览、流水按段汇总、批号口径分布 | 1,480 行 / 474 负 / −180,187.63 |
| `q2-lot-dist.sql` | `kucun`/`inh`/`outh` 的批号写法分布 | `NULL` 542 / `'(未填批号)'` 231 |
| `q3-reconcile.sql` | 三键对账(排除月结结转)、负结存 TOP20、真缺货 vs 批次错配 | 406 组总账为负 |
| `q4-timeline.sql` | **写入批次**:谁在什么时候写了哪些流水/结存 | 补流水 10-16、月结 10-19 |
| `q6-init-and-srv.sql` | 期初现状 + INIT 前缀行 | 只剩 `INIT-20261003` 31 行 |
| `q7-restorehist.sql` / `q9-restore-detail.sql` | `msdb` 整库还原记录与源备份文件 | 10-19~10-20 共 4 次 `WITH REPLACE` |
| `q8-bak-compare.sql` | `_bak_pc0000_*` 快照表还在不在 | 已被 `4ba6f63b` 全部删除(现剩 0 张) |
| `q10-cutoff.sql` | `kucun` vs "≤9/30 流水净额" | **逐键 0 差异** ⇒ 结存停在 9 月末 |
| `q11-cause.sql` | 只出无进 / 批号错配 / 各口径合计 / 成本分区末行 | 244 键从未入过库;成本末行 **−9,714.8 万** |
| `q12-panel.sql` / `q13-views.sql` | 库存面板指向哪张表/视图、视图定义 | 库存明细 ← `v_stock_kucun` |
| `q14-oneitem.sql` | 单物料逐批次流水 vs 结存(默认 `YJ-SX-002-2`) | 入真实批次、出 `NULL` 批号 |
| `q15-cols.sql` / `q15-cost.sql` | 成本表列与分段合计 | 期初 31 行 / 19,130 |
| `q18-test.sql` / `q26-balance-view.sql` | 库存明细 / 库存状况表的行数·负数·合计 | 697/406、876/451 |
| `q19-future-doclot.sql` | 单据侧 `PC0000`/空白批号、未来日期单 | 3,440 行 `PC0000`、1 张 2027 单据 |
| `q20-doccols.sql` | 四张单据行表的批号列名(有的只有 `批号`,没有 `批次号`) | — |
| `q21-pc0000.sql` | `PC0000` 与 `'(未填批号)'` 的当前计数 | `PC0000` = 0 |
| `q22-double.sql` | 期初行 + 结转行同键重复 | 自检"2 倍数"的来源 |
| `q23-opening-rows.sql` | 期初 31 行是什么 | **全是演示物料**(`M-001…T382`) |
| `q24/q25-schemalog*.sql` | `yj_schema_log` 里库存相关脚本的执行时间 | 月结/重算脚本是手工一次性 |
| `q27-export-kucun.sql` + `out-kucun.tsv` | 导出 `kucun` 供反事实用 | — |
| `_cf-opening.mjs` | **反事实**:把 8/31 金蝶期初加回来 | 负组合 **406 → 32**、合计 **−180,187.63 → +5,480,558.61** |
