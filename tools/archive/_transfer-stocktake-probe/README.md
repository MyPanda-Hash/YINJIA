# 调拨单 / 盘点单 验证取证(2026-10-18)

任务:为库存核算补「调拨单 TRANSFER」「盘点单 STOCKTAKE」(含明细表/统计表共 6 面板),
验收口径 = **单据能正常使用 + 能正确改 `kucun`**;第二批再补**与出入库单对齐**(附件/选单/左栏/字段)。

- 迁移脚本:`tools/migrate-transfer-stocktake-20261018.sql`(建表/视图/面板)
  + `tools/migrate-transfer-stocktake-align-20261018.sql`(附件位/补充字段/库存选货面板)
- 记账逻辑:`StockLedgerService.applyTransfer / applyStocktake`
- 功能说明:`docs/development/调拨单与盘点单.md`

## 一、端到端实测(可重复跑,跑完自清理)

```
cd tools
java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_transfer-stocktake-e2e\TransferStocktakeE2E.java http://127.0.0.1:8090
```

`TransferStocktakeE2E.java` 走真实接口(`/api/px/callButton` 保存/审核/弃审/删除单据)+ JDBC 断言,
**22/22 PASS**。逐条覆盖:

| 场景 | 断言 |
|---|---|
| 调拨 审核 | 调出仓 `-5`、调入仓 `+5`、**两仓合计守恒** |
| 调拨 流水 | `outh src=10` ×1 + `inh src=9` ×1(同一 rid,不同 src) |
| 调拨 弃审 | 两仓都回到原值 |
| 调拨 同仓 | 调出=调入 ⇒ 审核被 **409** 拒绝 |
| 盘点 盘盈 | 审核后 `kucun.yl == 实盘数量`;明细回写 账面数量/差异数量;`inh src=11` ×1 |
| 盘点 弃审 | 库存回到盘前;明细两列被清空 |
| 盘点 盘亏 | 实盘 = 账面 − 3 ⇒ 库存 == 实盘;`outh src=12` ×1;弃审回滚 |
| 明细/统计表 | 4 个 flat 面板 `queryFormDataList` 均 200 |
| 清理 | 测试单按面板分别「删除单据」+ 精确回收测出来的零结存行 |

⚠ **清理脚本的坑(已修)**:第一版按内容条件 `rkl=0 AND ckl=0 AND yl=0` 删零结存行,
一口气删了 261 条历史行(所幸全库 `预警数量 <> 0` 为 0 条,没伤到预警配置),且把 PD 单丢给
TRANSFER 面板删(接口不校验单据归属,成功返回,留下 `TRANSFER|PD-xxx` 垃圾状态行)。
现版本改为:按前缀分面板 + 只回收"测试开始前不存在"的那个 (物料,仓库,批号) 三元组。

## 二、演示数据播种(跑一次,结果保留)

```
java -cp lib\mssql-jdbc.jar archive\_transfer-stocktake-e2e\SeedDemoDocs.java YJ      HSDZ_MES
java -cp lib\mssql-jdbc.jar archive\_transfer-stocktake-e2e\SeedDemoDocs.java YJ_TEST HSDZ_MES_TEST
```

两个账套各留一张**已审核**的调拨单 + 盘点单(用户口径「数据保留,正式库也一样保留一条」):
正式库 `DB-2026-10-0001`(调拨 20 单位 华北工控仓→车间仓)/ `PD-2026-10-0001`(抽盘盘盈 8)。

## 三、界面取证(第二批「与出入库单对齐」)

```
node tools/archive/_transfer-stocktake-probe/_ui-align.mjs
```

用无头 Edge + CDP 打开真实页面,逐条断言 **16/16 PASS**:左「XX单选择」轨在、列头
= 单号/日期/中间列/审核状态、单据页有「附件」区、工具栏「选单」可点、选单弹窗「选库存」
有 10 行数据、勾选确定后**真的生成单据且映射正确**(调拨带出存货+调出仓+批号;盘点带出
存货+仓库+账面数量=现存量)。截图见 `shots/`。

⚠ 探针会把测试单留在库里,跑完按 `q-clean-probe.sql` 的思路按单号清理(保留 `…-0001`)。

## 四、辅助取证脚本

| 文件 | 用途 |
|---|---|
| `q-verify1.sql` / `q-align-verify.sql` | 迁移后自检:表/视图/面板/字段数/译名/授权/新列 |
| `q-i18n.sql` | 体检 09 项口径:确认新面板与新字段标签**都有 en 译名**(结论:0 缺失) |
| `q-cols.sql` / `q-cols2.sql` | 四张新表列数(调拨头 52 / 盘点头 54 / 两张行表各 41) |
| `q-pick.sql` | `v_stock_pick` 与档案唯一性取证(bs_inv 3874 行/3873 码 ⇒ OUTER APPLY) |
| `q-attach.sql` | 附件/ERP 列族从 `bd_purchase_in` 抄口径的依据 |
| `q-keep-demo.sql` / `q-clean-probe.sql` | 保留演示单 / 清理探针单(按单号精确) |
| `dbnorm-prod.txt` | `DbNormAudit` 正式库输出(FAIL 6 / WARN 1,逐条均为存量问题) |
| `shots/` | 界面截图(列表页/附件区/选单弹窗) |

## 五、体检结论(两账套一致)

`DbNormAudit` 结果 **FAIL 6 / WARN 1**,与本次改动前逐条同数、同内容 —— 全是存量问题:

| 项 | 内容 | 与本次的关系 |
|---|---|---|
| 01 | `erp_integ_*` 三张表命名(另一任务,后已补 erp_ 前缀规范) | 非本次 |
| 03 | `bl_pu_order.kf_period`、`bs_inv.parent_name`、`bs_inv.is_show_aux_barcode` 缺列注释 | 存量 |
| 04 | 38 张遗留 `bd_` 表缺主键/审计四件套 | 存量;**本次 4 张新表不在名单里** |
| 05 | `MANU_SCHEDULE` 23 处元数据漂移 | 存量 |
| 09 | 18 个面板 / 191 个字段标签缺 en 译名 | 存量;**本次新面板与新标签无一进名单** |
| 12 | `migrate-enable-rcsi-20261018.sql` 未登记进 `db-migrations.txt` | 非本次 |
| 08(WARN) | 40 处同列多标签 | 存量 |

## 六、环境

- 正式账套 `HSDZ_MES` / 测试账套 `HSDZ_MES_TEST` 均已 `[OK] 13 batches`(第二批),复跑 0 行;
  两个脚本都已用 `DbSync run` 登记进 `yj_schema_log`。
- 实测用临时实例:同一 jar `--server.port=8100`(不打断用户正在看的 8090),验完即撤。
