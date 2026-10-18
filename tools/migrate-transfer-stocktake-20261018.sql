/* ============================================================
   migrate-transfer-stocktake-20261018.sql — 2026-10-18
   库存核算补齐两张**改库存**的单据:调拨单(TRANSFER) + 盘点单(STOCKTAKE)

   用户口径(2026-10-18):「为我的库存核算写一个调拨单和盘点单,确保单据能正常使用和修改 kucun。
   字段根据我的出入库单据简单设计。」

   ── 交付范围(每张单三件套,与 其他入库单/其他出库单 同形) ──
     单据面板   TRANSFER       / STOCKTAKE        (mode=doc,头 bd_* + 行 bl_*)
     明细表     TRANSFER_DETAIL / STOCKTAKE_DETAIL (mode=flat,视图 v_*_detail)
     统计表     TRANSFER_STATS  / STOCKTAKE_STATS  (mode=flat,视图 v_*_stats)
     单号前缀   调拨 = DB / 盘点 = PD(经查 s_allno 号池,两前缀均未占用)
     字段来源   照 其他出库单 OTHER_OUT(本系统出入库单的最近邻):头 单据日期/单据编号/业务类型/
                部门(编码)/经手人(编码)/备注/审核人/审核时间;行 序号/存货(编码/名称)/规格型号/
                仓库(编码)/批号/计量单位/数量/单价/金额/明细备注 + 调拨专属「调出/调入仓库」+ 盘点专属
                「账面数量/实盘数量/差异数量」。

   ── 库存记账口径(见 backend StockLedgerService.applyTransfer / applyStocktake) ──
     · 调拨 = **一条明细两腿过账**:调出仓 出库(applyOut) + 调入仓 入库(applyIn),同批同量同事务,
       任一条腿失败整笔回滚 ⇒ 公司总库存不变、仓库间库存守恒;
     · 盘点 = **按实盘差异调平**:审核时按 kucun 现值算 差异 = 实盘 − 账面,并把 账面数量/差异数量
       回写到明细行留档;差异 > 0 走入库(盘盈)、< 0 走出库(盘亏),**盘点后库存 == 实盘数量**;
       弃审按行上留档的 差异数量 对称冲回(不是按当时库存重算,避免"盘完又动过库存"冲错)。
     · 流水(inh/outh)段号新增 9 调拨入库 / 10 调拨出库 / 11 盘点盘盈 / 12 盘点盘亏
       (4/8 是已下架委外段的保留号,按既有口径不回收)。v_stock_movement **无改动**:
       它按 src 透传、业务类型只分 入库/出库,新段自动进台账/收发存/库存状况/成本重算。

   ── 幂等 ──
     建表 OBJECT_ID 守卫、补列 COL_LENGTH 守卫、视图 CREATE OR ALTER、面板/字段/译名/授权 全部
     NOT EXISTS;脚本末尾自检缺一即 RAISERROR。两账套(HSDZ_MES → HSDZ_MES_TEST)均需执行。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ══════════════════════ ① 调拨单:bd_transfer(头) / bl_transfer(行) ══════════════════════ */
IF OBJECT_ID(N'dbo.bd_transfer', N'U') IS NULL
CREATE TABLE dbo.bd_transfer (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [单据日期] date NULL,
    [单据编号] nvarchar(50) NULL,
    [业务类型] nvarchar(50) NULL,
    [业务类型编码] nvarchar(50) NULL,
    [部门] nvarchar(50) NULL,
    [部门编码] nvarchar(50) NULL,
    [经手人] nvarchar(50) NULL,
    [经手人编码] nvarchar(50) NULL,
    [备注] nvarchar(500) NULL,
    [创建人] nvarchar(50) NULL,
    [创建时间] nvarchar(30) NULL,
    [修改人] nvarchar(50) NULL,
    [修改时间] nvarchar(30) NULL,
    [审核人] nvarchar(50) NULL,
    [审核时间] datetime2 NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL,
    [备用1] nvarchar(500) NULL, [备用2] nvarchar(500) NULL, [备用3] nvarchar(500) NULL,
    [备用4] nvarchar(500) NULL, [备用5] nvarchar(500) NULL, [备用6] nvarchar(500) NULL,
    [备用7] nvarchar(500) NULL, [备用8] nvarchar(500) NULL, [备用9] nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL, [备用11] nvarchar(500) NULL, [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL, [备用14] nvarchar(500) NULL, [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL, [备用17] nvarchar(500) NULL, [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL, [备用20] nvarchar(500) NULL
);
GO
IF OBJECT_ID(N'dbo.bl_transfer', N'U') IS NULL
CREATE TABLE dbo.bl_transfer (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [单据编号] nvarchar(50) NULL,
    [序号] int NULL,
    [存货编码] nvarchar(50) NULL,
    [存货名称] nvarchar(100) NULL,
    [规格型号] nvarchar(100) NULL,
    [计量单位] nvarchar(20) NULL,
    [批号] nvarchar(50) NULL,
    [调出仓库] nvarchar(50) NULL,
    [调出仓库编码] nvarchar(50) NULL,
    [调入仓库] nvarchar(50) NULL,
    [调入仓库编码] nvarchar(50) NULL,
    [数量] decimal(18,4) NULL,
    [单价] decimal(18,4) NULL,
    [金额] decimal(18,4) NULL,
    [明细备注] nvarchar(200) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL,
    [备用1] nvarchar(500) NULL, [备用2] nvarchar(500) NULL, [备用3] nvarchar(500) NULL,
    [备用4] nvarchar(500) NULL, [备用5] nvarchar(500) NULL, [备用6] nvarchar(500) NULL,
    [备用7] nvarchar(500) NULL, [备用8] nvarchar(500) NULL, [备用9] nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL, [备用11] nvarchar(500) NULL, [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL, [备用14] nvarchar(500) NULL, [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL, [备用17] nvarchar(500) NULL, [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL, [备用20] nvarchar(500) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bl_transfer_docno' AND object_id = OBJECT_ID(N'dbo.bl_transfer'))
    CREATE INDEX ix_bl_transfer_docno ON dbo.bl_transfer([单据编号]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bd_transfer_docno' AND object_id = OBJECT_ID(N'dbo.bd_transfer'))
    CREATE INDEX ix_bd_transfer_docno ON dbo.bd_transfer([单据编号]);
GO

/* ══════════════════════ ② 盘点单:bd_stocktake(头) / bl_stocktake(行) ══════════════════════ */
IF OBJECT_ID(N'dbo.bd_stocktake', N'U') IS NULL
CREATE TABLE dbo.bd_stocktake (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [单据日期] date NULL,
    [单据编号] nvarchar(50) NULL,
    [业务类型] nvarchar(50) NULL,
    [业务类型编码] nvarchar(50) NULL,
    [部门] nvarchar(50) NULL,
    [部门编码] nvarchar(50) NULL,
    [经手人] nvarchar(50) NULL,
    [经手人编码] nvarchar(50) NULL,
    [备注] nvarchar(500) NULL,
    [创建人] nvarchar(50) NULL,
    [创建时间] nvarchar(30) NULL,
    [修改人] nvarchar(50) NULL,
    [修改时间] nvarchar(30) NULL,
    [审核人] nvarchar(50) NULL,
    [审核时间] datetime2 NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL,
    [备用1] nvarchar(500) NULL, [备用2] nvarchar(500) NULL, [备用3] nvarchar(500) NULL,
    [备用4] nvarchar(500) NULL, [备用5] nvarchar(500) NULL, [备用6] nvarchar(500) NULL,
    [备用7] nvarchar(500) NULL, [备用8] nvarchar(500) NULL, [备用9] nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL, [备用11] nvarchar(500) NULL, [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL, [备用14] nvarchar(500) NULL, [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL, [备用17] nvarchar(500) NULL, [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL, [备用20] nvarchar(500) NULL
);
GO
IF OBJECT_ID(N'dbo.bl_stocktake', N'U') IS NULL
CREATE TABLE dbo.bl_stocktake (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [单据编号] nvarchar(50) NULL,
    [序号] int NULL,
    [存货编码] nvarchar(50) NULL,
    [存货名称] nvarchar(100) NULL,
    [规格型号] nvarchar(100) NULL,
    [计量单位] nvarchar(20) NULL,
    [批号] nvarchar(50) NULL,
    [仓库] nvarchar(50) NULL,
    [仓库编码] nvarchar(50) NULL,
    [账面数量] decimal(18,4) NULL,
    [实盘数量] decimal(18,4) NULL,
    [差异数量] decimal(18,4) NULL,
    [单价] decimal(18,4) NULL,
    [金额] decimal(18,4) NULL,
    [明细备注] nvarchar(200) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel nvarchar(1) NULL,
    [备用1] nvarchar(500) NULL, [备用2] nvarchar(500) NULL, [备用3] nvarchar(500) NULL,
    [备用4] nvarchar(500) NULL, [备用5] nvarchar(500) NULL, [备用6] nvarchar(500) NULL,
    [备用7] nvarchar(500) NULL, [备用8] nvarchar(500) NULL, [备用9] nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL, [备用11] nvarchar(500) NULL, [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL, [备用14] nvarchar(500) NULL, [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL, [备用17] nvarchar(500) NULL, [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL, [备用20] nvarchar(500) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bl_stocktake_docno' AND object_id = OBJECT_ID(N'dbo.bl_stocktake'))
    CREATE INDEX ix_bl_stocktake_docno ON dbo.bl_stocktake([单据编号]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bd_stocktake_docno' AND object_id = OBJECT_ID(N'dbo.bd_stocktake'))
    CREATE INDEX ix_bd_stocktake_docno ON dbo.bd_stocktake([单据编号]);
GO

/* ══════════════════════ ③ 表/列中文注明(MS_Description,规范 §1.2 / 体检 02 项) ══════════════════════ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_transfer') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'调拨单头表(仓库间移库:审核=调出仓出库+调入仓入库双腿过账 kucun,弃审对称冲回;单号前缀 DB)', N'SCHEMA', N'dbo', N'TABLE', N'bd_transfer';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_transfer') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'调拨单行表(一行一个存货+批号,调出仓库/调入仓库逐行指定;数量单位与该存货 kucun 同单位)', N'SCHEMA', N'dbo', N'TABLE', N'bl_transfer';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_stocktake') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'盘点单头表(实盘调平:审核时按 kucun 现值算差异并回写明细,盘盈入流水/盘亏出流水;单号前缀 PD)', N'SCHEMA', N'dbo', N'TABLE', N'bd_stocktake';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_stocktake') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'盘点单行表(账面数量/差异数量由审核时按 kucun 现值回写,手工不可信;实盘数量为唯一人工输入)', N'SCHEMA', N'dbo', N'TABLE', N'bl_stocktake';
GO

/* 关键列注明(中文列名按规范可豁免,这四处是"语义≠列名"的坑,必须写清) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_transfer') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_transfer'), N'调出仓库编码', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'调出仓库在 bs_wh 的仓库编码(编码优先、名称兜底解析,解析结果即 kucun.ckdm)', N'SCHEMA', N'dbo', N'TABLE', N'bl_transfer', N'COLUMN', N'调出仓库编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_transfer') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_transfer'), N'调入仓库编码', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'调入仓库在 bs_wh 的仓库编码(与调出仓库编码必须不同,否则审核拒绝)', N'SCHEMA', N'dbo', N'TABLE', N'bl_transfer', N'COLUMN', N'调入仓库编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_stocktake') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_stocktake'), N'账面数量', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时刻 kucun.yl 的快照(只读;由审核钩子回写,界面手工填写无意义,会被覆盖)', N'SCHEMA', N'dbo', N'TABLE', N'bl_stocktake', N'COLUMN', N'账面数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_stocktake') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_stocktake'), N'差异数量', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'差异数量 = 实盘数量 − 账面数量(正=盘盈入库 / 负=盘亏出库);审核回写,弃审按此列对称冲回', N'SCHEMA', N'dbo', N'TABLE', N'bl_stocktake', N'COLUMN', N'差异数量';
GO

/* ══════════════════════ ④ 视图(明细表 / 统计表,口径照 v_other_out_detail / _stats) ══════════════════════ */
CREATE OR ALTER VIEW dbo.v_transfer_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
  h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型],
  h.[部门编码], h.[部门], h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人],
  l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[批号],
  l.[调出仓库], l.[调出仓库编码], l.[调入仓库], l.[调入仓库编码],
  l.[数量], l.[单价], l.[金额], l.[明细备注]
FROM bd_transfer h LEFT JOIN bl_transfer l ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code = 'TRANSFER' AND s.doc_no = h.[单据编号];
GO
CREATE OR ALTER VIEW dbo.v_transfer_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  l.[调出仓库], l.[调出仓库编码], l.[调入仓库], l.[调入仓库编码],
  h.[部门编码], h.[部门], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位],
  SUM(COALESCE(l.[数量], 0)) AS [调拨数量],
  SUM(COALESCE(l.[金额], 0)) AS [金额],
  SUM(COALESCE(l.[金额], 0)) / NULLIF(SUM(COALESCE(l.[数量], 0)), 0) AS [单价]
FROM bd_transfer h LEFT JOIN bl_transfer l ON h.[单据编号] = l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'TRANSFER' AND s.doc_no = h.[单据编号] AND s.canceled = 'Y')
GROUP BY h.asp_cancel, l.[调出仓库], l.[调出仓库编码], l.[调入仓库], l.[调入仓库编码],
         h.[部门编码], h.[部门], l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位];
GO
CREATE OR ALTER VIEW dbo.v_stocktake_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
  h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型],
  h.[部门编码], h.[部门], h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人],
  l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[批号],
  l.[仓库], l.[仓库编码], l.[账面数量], l.[实盘数量], l.[差异数量],
  l.[单价], l.[金额], l.[明细备注]
FROM bd_stocktake h LEFT JOIN bl_stocktake l ON h.[单据编号] = l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code = 'STOCKTAKE' AND s.doc_no = h.[单据编号];
GO
CREATE OR ALTER VIEW dbo.v_stocktake_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  h.[部门编码], h.[部门], l.[仓库], l.[仓库编码], l.[存货编码], l.[存货名称] AS [存货],
  l.[规格型号], l.[计量单位],
  SUM(COALESCE(l.[账面数量], 0)) AS [账面数量],
  SUM(COALESCE(l.[实盘数量], 0)) AS [实盘数量],
  SUM(COALESCE(l.[差异数量], 0)) AS [差异数量],
  SUM(COALESCE(l.[金额], 0)) AS [金额]
FROM bd_stocktake h LEFT JOIN bl_stocktake l ON h.[单据编号] = l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'STOCKTAKE' AND s.doc_no = h.[单据编号] AND s.canceled = 'Y')
GROUP BY h.asp_cancel, h.[部门编码], h.[部门], l.[仓库], l.[仓库编码],
         l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位];
GO

/* ══════════════════════ ⑤ 面板登记(6 个:单据 + 明细表 + 统计表 × 2) ══════════════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'TRANSFER')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('TRANSFER', N'调拨单', N'库存核算', N'doc', N'bl_transfer', N'bd_transfer', N'单据编号', N'id', N'单据编号', N'DB', N'单据日期', 50, N'items', N'库存管理', N'Stock transfer');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'TRANSFER_DETAIL')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('TRANSFER_DETAIL', N'调拨单明细表', N'报表', N'flat', N'v_transfer_detail', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'库存管理', N'Stock transfer details');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'TRANSFER_STATS')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('TRANSFER_STATS', N'调拨单统计表', N'报表', N'flat', N'v_transfer_stats', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'库存管理', N'Stock transfer summary');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCKTAKE')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('STOCKTAKE', N'盘点单', N'库存核算', N'doc', N'bl_stocktake', N'bd_stocktake', N'单据编号', N'id', N'单据编号', N'PD', N'单据日期', 50, N'items', N'库存管理', N'Stocktaking');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCKTAKE_DETAIL')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('STOCKTAKE_DETAIL', N'盘点单明细表', N'报表', N'flat', N'v_stocktake_detail', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'库存管理', N'Stocktaking details');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCKTAKE_STATS')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('STOCKTAKE_STATS', N'盘点单统计表', N'报表', N'flat', N'v_stocktake_stats', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'库存管理', N'Stocktaking summary');
GO

/* ══════════════════════ ⑥ 字段登记 ══════════════════════
   place 口径(与四单基线文档 §3 同):含 header 或恰为 query 的进表单页表头;
   含 detail 且 visible=1 且 hidden=0 的进列表页明细表格列。 */

-- ── ⑥-1 调拨单表头 ──
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'单据日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'单据编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 20, 140, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'业务类型', N'业务类型', N'下拉框', N'SELECT v FROM (VALUES (N''调拨''),(N''同价调拨''),(N''异价调拨'')) AS t(v)', NULL, NULL, NULL, N'query,header', 30, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'业务类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'业务类型编码', N'业务类型编码', N'文本', NULL, NULL, NULL, NULL, N'header', 32, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'query,header', 50, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'部门编码', N'部门编码', N'参照', NULL, N'DEPT', N'部门编码', N'部门名称', N'header', 52, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'经手人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'经手人', N'经手人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'query,header', 54, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'经手人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'经手人编码', N'经手人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 56, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'审核时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'审核时间', N'审核时间', N'日期', NULL, NULL, NULL, NULL, N'header', 152, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 900, 200, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'创建人', N'创建人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'创建时间', N'创建时间', N'文本', NULL, NULL, NULL, NULL, N'header', 142, 130, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'修改人', N'修改人', N'文本', NULL, NULL, NULL, NULL, N'header', 144, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'修改时间', N'修改时间', N'文本', NULL, NULL, NULL, NULL, N'header', 146, 130, 0, 0, 1, NULL, 0);
GO

-- ── ⑥-2 调拨单明细行 ──
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'序号', N'序号', N'整数', NULL, NULL, NULL, NULL, N'detail', 5, 60, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货名称', N'query,detail', 10, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'存货名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'存货名称', N'存货名称', N'参照', NULL, N'INV', N'存货名称', N'存货名称', N'detail', 20, 160, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 140, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调出仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'调出仓库', N'调出仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,detail', 40, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调出仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'调出仓库编码', N'调出仓库编码', N'参照', NULL, N'WH', N'仓库编码', N'仓库名称', N'detail', 42, 110, 1, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调入仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'调入仓库', N'调入仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,detail', 50, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调入仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'调入仓库编码', N'调入仓库编码', N'参照', NULL, N'WH', N'仓库编码', N'仓库名称', N'detail', 52, 110, 1, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'计量单位', N'计量单位', N'下拉框', N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)', NULL, NULL, NULL, N'detail', 60, 100, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'批号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 70, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 90, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 95, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'明细备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'明细备注', N'明细备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 160, 1, 0, 0, NULL, 1);
GO

-- ── ⑥-3 盘点单表头 ──
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'单据日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'单据编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 20, 140, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'业务类型', N'业务类型', N'下拉框', N'SELECT v FROM (VALUES (N''盘点'')) AS t(v)', NULL, NULL, NULL, N'query,header', 30, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'业务类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'业务类型编码', N'业务类型编码', N'文本', NULL, NULL, NULL, NULL, N'header', 32, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'query,header', 50, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'部门编码', N'部门编码', N'参照', NULL, N'DEPT', N'部门编码', N'部门名称', N'header', 52, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'经手人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'经手人', N'经手人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'query,header', 54, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'经手人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'经手人编码', N'经手人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 56, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'审核时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'审核时间', N'审核时间', N'日期', NULL, NULL, NULL, NULL, N'header', 152, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 900, 200, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'创建人', N'创建人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'创建时间', N'创建时间', N'文本', NULL, NULL, NULL, NULL, N'header', 142, 130, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'修改人', N'修改人', N'文本', NULL, NULL, NULL, NULL, N'header', 144, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'修改时间', N'修改时间', N'文本', NULL, NULL, NULL, NULL, N'header', 146, 130, 0, 0, 1, NULL, 0);
GO

-- ── ⑥-4 盘点单明细行(账面数量/差异数量 = 审核回写的只读列) ──
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'序号', N'序号', N'整数', NULL, NULL, NULL, NULL, N'detail', 5, 60, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货名称', N'query,detail', 10, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'存货名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'存货名称', N'存货名称', N'参照', NULL, N'INV', N'存货名称', N'存货名称', N'detail', 20, 160, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 140, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,detail', 40, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'仓库编码', N'仓库编码', N'参照', NULL, N'WH', N'仓库编码', N'仓库名称', N'detail', 42, 110, 1, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'批号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 50, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'计量单位', N'计量单位', N'下拉框', N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)', NULL, NULL, NULL, N'detail', 60, 100, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'账面数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'账面数量', N'账面数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 70, 110, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'实盘数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'实盘数量', N'实盘数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'差异数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'差异数量', N'差异数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 90, 110, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 95, 110, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 97, 110, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'明细备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'明细备注', N'明细备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 160, 1, 0, 0, NULL, 1);
GO

-- ── ⑥-5 明细表(flat)/统计表(flat)字段:从视图取,全部只读 ──
-- 调拨单明细表
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'单据日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'单据日期', N'单据日期', N'文本', N'detail', 10, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'创建时间', N'创建时间', N'文本', N'detail', 20, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'单据编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'单据编号', N'单据编号', N'文本', N'detail', 30, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'业务类型', N'业务类型', N'文本', N'detail', 40, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'部门', N'部门', N'文本', N'detail', 50, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'经手人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'经手人', N'经手人', N'文本', N'detail', 60, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'备注', N'备注', N'文本', N'detail', 70, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'制单人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'制单人', N'制单人', N'文本', N'detail', 80, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'审核人', N'审核人', N'文本', N'detail', 90, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'存货编码', N'存货编码', N'文本', N'detail', 100, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'存货')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'存货', N'存货', N'文本', N'detail', 110, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'规格型号', N'规格型号', N'文本', N'detail', 120, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'计量单位', N'计量单位', N'文本', N'detail', 130, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'批号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'批号', N'批号', N'文本', N'detail', 140, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'调出仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'调出仓库', N'调出仓库', N'文本', N'detail', 150, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'调入仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'调入仓库', N'调入仓库', N'文本', N'detail', 160, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'数量', N'数量', N'小数', N'detail', 170, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'单价', N'单价', N'小数', N'detail', 180, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'金额', N'金额', N'小数', N'detail', 190, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_DETAIL' AND label=N'明细备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_DETAIL', N'明细备注', N'明细备注', N'文本', N'detail', 200, 160, 0, 0, 0, 1);
GO
-- 调拨单统计表
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'调出仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'调出仓库', N'调出仓库', N'文本', N'detail', 10, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'调入仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'调入仓库', N'调入仓库', N'文本', N'detail', 20, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'部门', N'部门', N'文本', N'detail', 30, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'存货编码', N'存货编码', N'文本', N'detail', 40, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'存货')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'存货', N'存货', N'文本', N'detail', 50, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'规格型号', N'规格型号', N'文本', N'detail', 60, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'计量单位', N'计量单位', N'文本', N'detail', 70, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'调拨数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'调拨数量', N'调拨数量', N'小数', N'detail', 80, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'单价', N'单价', N'小数', N'detail', 90, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER_STATS' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('TRANSFER_STATS', N'金额', N'金额', N'小数', N'detail', 100, 110, 0, 0, 0, 1);
GO
-- 盘点单明细表
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'单据日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'单据日期', N'单据日期', N'文本', N'detail', 10, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'创建时间', N'创建时间', N'文本', N'detail', 20, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'单据编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'单据编号', N'单据编号', N'文本', N'detail', 30, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'业务类型', N'业务类型', N'文本', N'detail', 40, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'部门', N'部门', N'文本', N'detail', 50, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'经手人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'经手人', N'经手人', N'文本', N'detail', 60, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'备注', N'备注', N'文本', N'detail', 70, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'制单人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'制单人', N'制单人', N'文本', N'detail', 80, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'审核人', N'审核人', N'文本', N'detail', 90, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'存货编码', N'存货编码', N'文本', N'detail', 100, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'存货')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'存货', N'存货', N'文本', N'detail', 110, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'规格型号', N'规格型号', N'文本', N'detail', 120, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'计量单位', N'计量单位', N'文本', N'detail', 130, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'仓库', N'仓库', N'文本', N'detail', 140, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'批号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'批号', N'批号', N'文本', N'detail', 150, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'账面数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'账面数量', N'账面数量', N'小数', N'detail', 160, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'实盘数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'实盘数量', N'实盘数量', N'小数', N'detail', 170, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'差异数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'差异数量', N'差异数量', N'小数', N'detail', 180, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'单价', N'单价', N'小数', N'detail', 190, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_DETAIL' AND label=N'明细备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_DETAIL', N'明细备注', N'明细备注', N'文本', N'detail', 200, 160, 0, 0, 0, 1);
GO
-- 盘点单统计表
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'部门', N'部门', N'文本', N'detail', 10, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'仓库', N'仓库', N'文本', N'detail', 20, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'存货编码', N'存货编码', N'文本', N'detail', 30, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'存货')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'存货', N'存货', N'文本', N'detail', 40, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'规格型号', N'规格型号', N'文本', N'detail', 50, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'计量单位', N'计量单位', N'文本', N'detail', 60, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'账面数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'账面数量', N'账面数量', N'小数', N'detail', 70, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'实盘数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'实盘数量', N'实盘数量', N'小数', N'detail', 80, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'差异数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'差异数量', N'差异数量', N'小数', N'detail', 90, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE_STATS' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('STOCKTAKE_STATS', N'金额', N'金额', N'小数', N'detail', 100, 110, 0, 0, 0, 1);
GO

/* ══════════════════════ ⑦ 多语言(AGENTS.md 硬规范:新面板/新字段必须同时交付译名) ══════════════════════
   en/ja/ko/es/fr/de/ru/vi/th 九语;已存在的标签(单据日期/存货编码… )由既有迁移覆盖,这里只补缺失项。 */
-- 面板名
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'调拨单' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'调拨单', 'en', N'Stock transfer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'调拨单' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'调拨单', 'ja', N'振替伝票', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'调拨单' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'调拨单', 'ko', N'이동 전표', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'调拨单明细表' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'调拨单明细表', 'en', N'Stock transfer details', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'调拨单明细表' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'调拨单明细表', 'ja', N'振替伝票明細', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'调拨单统计表' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'调拨单统计表', 'en', N'Stock transfer summary', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'调拨单统计表' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'调拨单统计表', 'ja', N'振替伝票集計表', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'盘点单' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'盘点单', 'en', N'Stocktaking', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'盘点单' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'盘点单', 'ja', N'棚卸伝票', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'盘点单' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'盘点单', 'ko', N'재고 조사표', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'盘点单明细表' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'盘点单明细表', 'en', N'Stocktaking details', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'盘点单明细表' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'盘点单明细表', 'ja', N'棚卸伝票明細', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'盘点单统计表' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'盘点单统计表', 'en', N'Stocktaking summary', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'盘点单统计表' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'盘点单统计表', 'ja', N'棚卸伝票集計表', 'manual');
GO
-- 新增字段标签(调出/调入仓库族 + 盘点数量族 + 调拨数量)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓库' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调出仓库', 'en', N'From warehouse', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓库' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调出仓库', 'ja', N'払出倉庫', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓库' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调出仓库', 'ko', N'출고 창고', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调出仓库编码', 'en', N'From warehouse code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓库编码' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调出仓库编码', 'ja', N'払出倉庫コード', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调入仓库' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调入仓库', 'en', N'To warehouse', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调入仓库' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调入仓库', 'ja', N'受入倉庫', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调入仓库' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调入仓库', 'ko', N'입고 창고', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调入仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调入仓库编码', 'en', N'To warehouse code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调入仓库编码' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调入仓库编码', 'ja', N'受入倉庫コード', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'账面数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'账面数量', 'en', N'Book quantity', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'账面数量' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'账面数量', 'ja', N'帳簿数量', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'账面数量' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'账面数量', 'ko', N'장부 수량', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实盘数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实盘数量', 'en', N'Counted quantity', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实盘数量' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实盘数量', 'ja', N'実地棚卸数量', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实盘数量' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实盘数量', 'ko', N'실사 수량', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'差异数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'差异数量', 'en', N'Variance quantity', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'差异数量' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'差异数量', 'ja', N'差異数量', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'差异数量' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'差异数量', 'ko', N'차이 수량', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调拨数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调拨数量', 'en', N'Transfer quantity', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调拨数量' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调拨数量', 'ja', N'振替数量', 'manual');
GO

/* ══════════════════════ ⑧ 角色授权(与 OTHER_IN/OTHER_OUT 同权限集,不掉任何现有账号) ══════════════════════ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, p.code, 'N', 'view,query,add,modify,modlog,del,export'
FROM yj_role r CROSS JOIN (VALUES ('TRANSFER'),('TRANSFER_DETAIL'),('TRANSFER_STATS'),
                                  ('STOCKTAKE'),('STOCKTAKE_DETAIL'),('STOCKTAKE_STATS')) AS p(code)
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = p.code)
  AND (r.is_admin = 'Y'
       OR EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id AND s.panel_code = N'OTHER_IN' AND s.perms LIKE '%view%'));
GO

/* ══════════════════════ ⑨ 自检:表/视图/面板/字段/译名/授权/注释 缺一即失败 ══════════════════════ */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.bd_transfer', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.bl_transfer', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.bd_stocktake', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.bl_stocktake', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_transfer_detail', N'V') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_transfer_stats', N'V') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_stocktake_detail', N'V') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_stocktake_stats', N'V') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'TRANSFER') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'TRANSFER_DETAIL') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'TRANSFER_STATS') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCKTAKE') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCKTAKE_DETAIL') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCKTAKE_STATS') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'TRANSFER') < 29 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCKTAKE') < 27 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'TRANSFER_DETAIL') < 20 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'TRANSFER_STATS') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCKTAKE_DETAIL') < 20 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCKTAKE_STATS') < 10 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'调拨单' AND locale='en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'盘点单' AND locale='en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调出仓库' AND locale='en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实盘数量' AND locale='en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = 'TRANSFER' AND role_id = 1) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = 'STOCKTAKE' AND role_id = 1) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_transfer') AND minor_id = 0 AND name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_stocktake') AND minor_id = 0 AND name = N'MS_Description') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_transfer', N'调出仓库编码') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_stocktake', N'差异数量') IS NULL SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'调拨单/盘点单三件套自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'调拨单/盘点单三件套就绪(表 4 / 视图 4 / 面板 6 / 字段 / 译名 / 授权 / 注释;幂等)';
GO
