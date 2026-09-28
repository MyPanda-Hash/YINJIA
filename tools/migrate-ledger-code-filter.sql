/* =============================================================================
   库存台账(STOCK_LEDGER)/库存状况表(STOCK_BALANCE) 查询弹窗
   —— 仓库/存货参照改绑「编码」:修同名多码的过滤歧义(单一性)

   背景(2026-09-28 实测 HSDZ_MES,探针 _q-ledger-filter-index.sql):
     存货档案 bs_inv 3838 行里 存货名称 大量重名 ——「端盖」24 个编码、「PP棉」18 个、
     「S阻垢炭棒/滤芯」16 个……而查询弹窗的联动过滤此前按**名称**收窄:
       前端 openQueryRef 注入 filter{存货名称:[台账该仓有流水的名称]},
       后端 台账联动选项 也按 bs_inv.存货名称 交集取候选。
     名称不是唯一键 ⇒ 选了仓库后,弹窗把**同名异码**的存货整批放进候选(24 个「端盖」
     全出现,只有一个有流水),用户无法分辨;查询条件本身也按名称 LIKE,同仓同名的
     多个编码流水会并进同一张台账 —— 单一仓库+单一存货的口径被破坏。

   改法(用户拍板:用仓库编码对存货编码过滤,确保单一性):
     ① yj_field 参照绑定编码:仓库 ref_field 仓库名称→仓库编码(显示仍 仓库名称),
       存货 ref_field 存货名称→存货编码(显示仍 存货名称)。弹窗存/传的都是编码。
     ② 联动与查询按编码:ButtonService 台账联动选项 改按 仓库编码/存货编码 取交集;
       QueryService 台账查询(含期初/期末合成行)改按编码列精确等值(不走 LIKE ——
       编码互为子串,如 YJ-SX-004 / YJ-SX-004-1)。
     ③ 前端 PanelxList 收窄注入 filter{存货编码:[…]}(配套同批代码改动,不在本脚本内)。
     两视图 v_stock_ledger / v_stock_balance 本就输出 仓库编码/存货编码 列,无需动视图。
     收发存汇总表(STOCK_SUMMARY)非级联面板,维持名称口径,不在本次范围。

   注:仅改 yj_field 引用键,不动表结构/字段标签;PanelRegistry 30s TTL 自动生效。
   自检:末尾 SELECT 应输出 4 行 ref_field=仓库编码/存货编码;重复执行不改变结果(幂等)。
   ============================================================================= */
SET NOCOUNT ON;
GO

-- 台账:仓库/存货 参照绑定编码(显示层 display_field 不变,下拉/弹窗仍见名称)
UPDATE yj_field SET ref_field = N'仓库编码'
 WHERE panel_code = N'STOCK_LEDGER' AND col_name = N'仓库' AND ref_panel = N'WH'
   AND ref_field <> N'仓库编码';   -- 幂等
UPDATE yj_field SET ref_field = N'存货编码'
 WHERE panel_code = N'STOCK_LEDGER' AND col_name = N'存货' AND ref_panel = N'INV'
   AND ref_field <> N'存货编码';   -- 幂等
GO

-- 库存状况表(同一套级联联动,与台账同口径改编码)
UPDATE yj_field SET ref_field = N'仓库编码'
 WHERE panel_code = N'STOCK_BALANCE' AND col_name = N'仓库' AND ref_panel = N'WH'
   AND ref_field <> N'仓库编码';   -- 幂等
UPDATE yj_field SET ref_field = N'存货编码'
 WHERE panel_code = N'STOCK_BALANCE' AND col_name = N'存货' AND ref_panel = N'INV'
   AND ref_field <> N'存货编码';   -- 幂等
GO

PRINT N'== 自检:台账/状况表 仓库/存货 应为参照 + 编码键,display 仍名称 ==';
SELECT panel_code, col_name, data_type, ref_panel, ref_field, display_field
  FROM yj_field
 WHERE panel_code IN (N'STOCK_LEDGER', N'STOCK_BALANCE') AND col_name IN (N'仓库', N'存货')
 ORDER BY panel_code, seq;
GO

PRINT N'== 自检:两视图编码列齐备(联动/查询按编码的前提) ==';
SELECT v.name AS 视图, c.name AS 列
  FROM sys.columns c JOIN sys.views v ON v.object_id = c.object_id
 WHERE v.name IN (N'v_stock_ledger', N'v_stock_balance')
   AND c.name IN (N'仓库编码', N'存货编码')
 ORDER BY v.name, c.name;
GO
