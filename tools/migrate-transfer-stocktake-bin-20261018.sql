/* ============================================================
   migrate-transfer-stocktake-bin-20261018.sql — 2026-10-18(第三批)
   调拨单 / 盘点单补「库位(仓位)」字段,并按系统既有套路把**关联**做实

   用户口径(2026-10-18):「两个单据都少了库位字段,并且要把字段关联做好,
   即使是测试也要是系统的真实数据。而且整个流程都要验收,模拟真实操作可能出现的各种真实情况。」

   ── 一、本系统里「库位」到底长什么样(照出入库单的既有约定,不新造轮子) ──
   现役唯一范式见 `PURCHASE_IN` 明细的「仓位」字段:
     label=仓位, col_name=仓位编码, data_type=参照, ref_panel=WHLOC(MES 仓位档案)
     ref_field=仓位编码, display_field=仓位编码, ref_filter=仓库=$仓库, place=detail
   即:**字段名叫「仓位」、物理列叫「仓位编码」、参照源是仓位档案、按本行仓库级联过滤**
   (`ref_filter` 的 `$字段` 由前端 RefPickDialog 从当前行取值,见该组件注释)。
   库存/流水层(kucun、inh、outh)只有 (物料, 仓库, 批号) 三键 + 仓库,**没有仓位维度** ——
   所以仓位在 MES 里是**单据留痕**,不参与 `kucun` 记账;这一点与采购入库单/销售出库单完全一致
   (实测 `bl_purchase_in` 964 行,填过仓位的 0 行)。

   ── 二、本脚本加什么 ──
   · `bl_transfer`   + `调出仓位编码` / `调入仓位编码`(nvarchar(200),与 bs_wh_loc.仓位编码 同宽)
   · `bl_stocktake`  + `仓位编码`
   · 字段登记:调拨行「调出仓位」「调入仓位」;盘点行「仓位」——三者都参照 WHLOC 并按各自仓库级联
   · 4 个视图(v_transfer_detail/_stats、v_stocktake_detail/_stats)重建,把仓位列带出去
   · 译名 + 授权 + 自检
   幂等:COL_LENGTH 判列 / NOT EXISTS 判字段 / CREATE OR ALTER 视图。两账套均需执行。

   ── 三、校验口径(实现在 StockLedgerService.ensureBinValid,审核时) ──
   ① 填了仓位 ⇒ 必须是**该仓库**名下、**未停用**、未作废的仓位;跨仓/不存在/停用一律拒绝;
   ② 该仓库**有仓位档案**(bs_wh_loc 有行)或 `bs_wh.启用仓位管理=1` ⇒ **必填**;
   ③ 该仓库没有仓位档案且未启用仓位管理 ⇒ 允许留空(系统里多数仓是这种,如 华北工控仓 346 行库存、
      仓位档案 0 条)。留空时审核照常。
   这条「有档案就必填」比只看 `启用仓位管理` 更严,理由:**空着仓位等于让库位字段形同虚设**,
   而某个仓一旦维护了仓位,业务上就是要按位管理的。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ═════════════ ① 明细表补列 ═════════════ */
IF COL_LENGTH(N'dbo.bl_transfer', N'调出仓位编码') IS NULL ALTER TABLE dbo.bl_transfer ADD [调出仓位编码] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bl_transfer', N'调入仓位编码') IS NULL ALTER TABLE dbo.bl_transfer ADD [调入仓位编码] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bl_stocktake', N'仓位编码') IS NULL ALTER TABLE dbo.bl_stocktake ADD [仓位编码] nvarchar(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bl_transfer') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_transfer'),N'调出仓位编码','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'调出仓位编码(bs_wh_loc.仓位编码;必须属于本行「调出仓库」且未停用。审核时校验;kucun 无仓位维度,故只作单据留痕)', N'SCHEMA',N'dbo',N'TABLE',N'bl_transfer',N'COLUMN',N'调出仓位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bl_transfer') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_transfer'),N'调入仓位编码','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'调入仓位编码(bs_wh_loc.仓位编码;必须属于本行「调入仓库」且未停用。该仓有仓位档案或启用仓位管理时必填)', N'SCHEMA',N'dbo',N'TABLE',N'bl_transfer',N'COLUMN',N'调入仓位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bl_stocktake') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_stocktake'),N'仓位编码','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓位编码(bs_wh_loc.仓位编码;必须属于本行「仓库」且未停用。该仓有仓位档案或启用仓位管理时必填;kucun 无仓位维度,只作单据留痕)', N'SCHEMA',N'dbo',N'TABLE',N'bl_stocktake',N'COLUMN',N'仓位编码';
GO

/* ═════════════ ② 视图重建(把仓位列带出去) ═════════════ */
CREATE OR ALTER VIEW dbo.v_transfer_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
  h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型],
  h.[部门编码], h.[部门], h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人],
  l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[批号],
  l.[调出仓库], l.[调出仓位编码] AS [调出仓位], l.[调入仓库], l.[调入仓位编码] AS [调入仓位],
  l.[数量], l.[单价], l.[金额], l.[明细备注]
FROM bd_transfer h LEFT JOIN bl_transfer l ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code = 'TRANSFER' AND s.doc_no = h.[单据编号];
GO
CREATE OR ALTER VIEW dbo.v_transfer_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  l.[调出仓库], l.[调出仓位编码] AS [调出仓位], l.[调入仓库], l.[调入仓位编码] AS [调入仓位],
  h.[部门编码], h.[部门], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位],
  SUM(COALESCE(l.[数量], 0)) AS [调拨数量],
  SUM(COALESCE(l.[金额], 0)) AS [金额],
  SUM(COALESCE(l.[金额], 0)) / NULLIF(SUM(COALESCE(l.[数量], 0)), 0) AS [单价]
FROM bd_transfer h LEFT JOIN bl_transfer l ON h.[单据编号] = l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'TRANSFER' AND s.doc_no = h.[单据编号] AND s.canceled = 'Y')
GROUP BY h.asp_cancel, l.[调出仓库], l.[调出仓位编码], l.[调入仓库], l.[调入仓位编码],
         h.[部门编码], h.[部门], l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位];
GO
CREATE OR ALTER VIEW dbo.v_stocktake_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
  h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型],
  h.[部门编码], h.[部门], h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人],
  l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[批号],
  l.[仓库], l.[仓位编码] AS [仓位], l.[账面数量], l.[实盘数量], l.[差异数量],
  l.[单价], l.[金额], l.[明细备注]
FROM bd_stocktake h LEFT JOIN bl_stocktake l ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code = 'STOCKTAKE' AND s.doc_no = h.[单据编号];
GO
CREATE OR ALTER VIEW dbo.v_stocktake_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  h.[部门编码], h.[部门], l.[仓库], l.[仓位编码] AS [仓位], l.[存货编码], l.[存货名称] AS [存货],
  l.[规格型号], l.[计量单位],
  SUM(COALESCE(l.[账面数量], 0)) AS [账面数量],
  SUM(COALESCE(l.[实盘数量], 0)) AS [实盘数量],
  SUM(COALESCE(l.[差异数量], 0)) AS [差异数量],
  SUM(COALESCE(l.[金额], 0)) AS [金额]
FROM bd_stocktake h LEFT JOIN bl_stocktake l ON h.[单据编号] = l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'STOCKTAKE' AND s.doc_no = h.[单据编号] AND s.canceled = 'Y')
GROUP BY h.asp_cancel, h.[部门编码], h.[部门], l.[仓库], l.[仓位编码],
         l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位];
GO

/* ═════════════ ③ 字段登记 ═════════════
   列位置按业务顺序插进现有明细:调拨 调出仓库(40/42) → 调出仓位(44) → 调入仓库(50/52) → 调入仓位(54)。
   参照配置逐字照 PURCHASE_IN.仓位:ref_field=仓位编码 / display_field=仓位编码 / ref_filter=仓库=$仓库。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调出仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, ref_filter)
    VALUES ('TRANSFER', N'调出仓位编码', N'调出仓位', N'参照', NULL, N'WHLOC', N'仓位编码', N'仓位编码', N'detail', 44, 130, 1, 0, 0, NULL, 1, N'仓库=$调出仓库');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调入仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, ref_filter)
    VALUES ('TRANSFER', N'调入仓位编码', N'调入仓位', N'参照', NULL, N'WHLOC', N'仓位编码', N'仓位编码', N'detail', 54, 130, 1, 0, 0, NULL, 1, N'仓库=$调入仓库');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, ref_filter)
    VALUES ('STOCKTAKE', N'仓位编码', N'仓位', N'参照', NULL, N'WHLOC', N'仓位编码', N'仓位编码', N'detail', 44, 130, 1, 0, 0, NULL, 1, N'仓库=$仓库');
GO
-- 明细表(flat)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'调出仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'调出仓位', N'调出仓位', N'文本', N'detail', 155, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'调入仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'调入仓位', N'调入仓位', N'文本', N'detail', 165, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'仓位', N'仓位', N'文本', N'detail', 145, 120, 0, 0, 0, 1);
GO
-- 统计表(flat)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'调出仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'调出仓位', N'调出仓位', N'文本', N'detail', 15, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'调入仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'调入仓位', N'调入仓位', N'文本', N'detail', 25, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'仓位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'仓位', N'仓位', N'文本', N'detail', 25, 120, 0, 0, 0, 1);
GO

/* ═════════════ ④ 译名 ═════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调出仓位', 'en', N'From bin', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓位' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调出仓位', 'ja', N'払出ロケーション', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调入仓位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调入仓位', 'en', N'To bin', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调入仓位' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调入仓位', 'ja', N'受入ロケーション', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位', 'en', N'Bin', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓位' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓位', 'ja', N'ロケーション', 'manual');
GO

/* ═════════════ ⑤ 自检 ═════════════ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.bl_transfer', N'调出仓位编码') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_transfer', N'调入仓位编码') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_stocktake', N'仓位编码') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调出仓位') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调入仓位') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'仓位') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.v_transfer_detail') AND name=N'调出仓位') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.v_stocktake_detail') AND name=N'仓位') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓位' AND locale='en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'调拨/盘点 库位字段自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'调拨单/盘点单 库位字段就绪(列 3 / 字段 9 / 视图 4 / 译名;幂等)';
GO
