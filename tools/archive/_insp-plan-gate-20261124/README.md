# 新判据的种子数据：为订单结转里的产品补计划单 + 成型工艺清单（2026-11-24）

## 为什么

2026-11-24 出单判据改成「按出货检验计划 / 成型工艺清单」（`ProcessInspPlanGate`），正式库只有
2 个产品有出货检验计划、5 个有成型工艺清单 ⇒ 自动出单几乎全停。本目录是一次性数据补齐，
从**订单结转（bd_so_order / bl_so_order）待结转行**里选产品，补两份主数据。

## 选了哪个产品

`A-32-32`（PP复合阻垢抑菌炭棒/滤芯，订单结转待结转 8 行 / 6000 支），补齐后它是目前唯一
「首件 + 功能 + 表观」三张单都会出的产品。

## 建了什么（两账套）

| 库 | 出货检验计划 | 成型工艺清单 |
|---|---|---|
| HSDZ_MES（正式） | `IP-2026-11-0002`（2 行 1PCS + 3 行 1%） | `MP-2026-11-0004`（产品编号 `A-32-32-tb`） |
| HSDZ_MES_TEST（测试） | `IP-2026-11-0024`（同上） | `MP-2026-11-0001`（同上） |

- 计划明细（表区 = 检验项目）：
  - 功能（1PCS/一个生产批次）：压降 ≤3 kPa、抗压强度 ≥8 kgf
  - 表观（生产量*1%）：炭棒表观状态、外径 32±0.5 / 长度 121±1、出货重量 ≥25 g/支
- 成型工艺清单头：产品编号 `A-32-32-tb`、产品名称、密级=保密、生产车间=成型车间、外观要求、
  长度要求 121±1、外径 32±0.5、强度 8 kgf、压降 3 kPa（首件检验单的「标准」列会取这些值）。
- 都**没有审核**（草稿态），留给品质确认后走审批；`asp_user1=admin`。

## 怎么复跑 / 回滚

```bash
cd tools
java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar \
  ../tools/archive/_insp-plan-gate-20261124/SeedPlanData.java HSDZ_MES A-32-32
```

脚本幂等（已有该产品的计划/清单就跳过）。回滚：

```sql
DELETE FROM dbo.rd_insp_plan_detail WHERE 单据编号 IN (N'IP-2026-11-0002', N'IP-2026-11-0024');
DELETE FROM dbo.rd_insp_plan_head   WHERE 单据编号 IN (N'IP-2026-11-0002', N'IP-2026-11-0024');
DELETE FROM dbo.rd_mold_proc_head   WHERE 单据编号 IN (N'MP-2026-11-0004', N'MP-2026-11-0001');
```

## 复核（判据决策表）

```
java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar ../tools/archive/_insp-plan-gate-20261124/InspGateProbe.java HSDZ_MES 8
```

改前：8 个在用产品全部「不出单」；改后：`A-32-32` 首件/功能/表观 全部「是」，其余仍不出单。

## 界面取证

`C:/Users/vigna/ego/wpb-qc-preview-20261124/seed-plan.png`、`seed-mold.png`
（测试库打开 `IP-2026-11-0024` / `MP-2026-11-0001` 两张单：产品编号、明细 3 种频率都渲染出来）。
