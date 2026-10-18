# 调拨单 / 盘点单 验证取证(2026-10-18)

任务:为库存核算补「调拨单 TRANSFER」「盘点单 STOCKTAKE」(含明细表/统计表共 6 面板),
验收口径 = **单据能正常使用 + 能正确改 `kucun`**。迁移脚本 `tools/migrate-transfer-stocktake-20261018.sql`,
记账逻辑 `StockLedgerService.applyTransfer / applyStocktake`。

## 一、端到端实测(主证据)

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

## 二、辅助取证脚本

| 文件 | 用途 |
|---|---|
| `q-verify1.sql` | 迁移后自检:表/视图/面板/字段数/译名/授权 全量点一遍 |
| `q-i18n.sql` | 体检 09 项口径:确认 6 个新面板与全部新字段标签**都有 en 译名**(结论:0 缺失) |
| `q-cols.sql` | 四张新表列数(各 41) |
| `q-schema.sql` / `q-3.sql` | 参照表结构(`kucun` / `bd_other_out` / `bl_other_out`)与 `OTHER_OUT` 字段基线 |
| `q-2.sql` / `q-4.sql` / `q-6.sql` | `yj_panel` 列、`v_stock_movement` 定义、`inh/outh` 唯一索引、角色与授权现状 |
| `q-7.sql` / `q-8.sql` | `v_other_out_detail/_stats` 视图口径、面板行登记样例 |
| `q-cleanup*.sql` | 第一轮实测残留的精确清理(按单据编号;可复用的模板) |
| `dbnorm-prod.txt` | `DbNormAudit` 正式库全量输出(FAIL 6 / WARN 1,逐条均为存量问题,详见下方) |
| `_v-8090*.mjs` | 8090 现役实例的只读验证:6 面板可查、按钮组、表头/明细字段、服务端已下发新菜单 |

## 三、体检结论(两账套一致)

`DbNormAudit` 结果 **FAIL 6 / WARN 1**,与本次改动前逐条同数、同内容 —— 全是存量问题:

| 项 | 内容 | 与本次的关系 |
|---|---|---|
| 01 | `erp_integ_api/_device/_field` 三张表不匹配命名规范 | 另一任务的表 |
| 03 | `bl_pu_order.kf_period`、`bs_inv.parent_name`、`bs_inv.is_show_aux_barcode` 缺列注释 | 存量 |
| 04 | 38 张遗留 `bd_` 表缺主键/审计四件套 | 存量;**本次 4 张新表不在名单里** |
| 05 | `MANU_SCHEDULE` 23 处元数据漂移 | 存量 |
| 09 | 18 个面板 / 191 个字段标签缺 en 译名 | 存量;**本次 6 面板 + 13 标签无一进名单** |
| 12 | `migrate-enable-rcsi-20261018.sql` 未登记进 `db-migrations.txt` | 另一任务 |
| 08(WARN) | 40 处同列多标签 | 存量 |

## 四、环境

- 正式账套 `HSDZ_MES` / 测试账套 `HSDZ_MES_TEST` 均已 `[OK] 33 batches`,复跑 0 行;
  已用 `DbSync run migrate-transfer-stocktake-20261018.sql` 登记进 `yj_schema_log`。
- 实测用临时实例:同一 jar `--server.port=8100`(不打断用户正在看的 8090),验完即撤。
