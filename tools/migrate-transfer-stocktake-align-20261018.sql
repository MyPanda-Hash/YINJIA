/* ============================================================
   migrate-transfer-stocktake-align-20261018.sql — 2026-10-18(第二批)
   调拨单 / 盘点单 **与出入库单对齐**:附件位 + ERP 留位 + 业务补充字段 + 库存选货面板

   用户口径(2026-10-18):「这两个单据功能和界面要和出入库单对齐,图片上的也要有。
   ……看看字段是否还需要补充」

   ── 本脚本做四件事 ──
   ① **头表补列**(对齐 bd_purchase_in 的列族):
      · 两个表都补 `附件1..附件6` nvarchar(1000) —— 界面的「附件」区是由
        `yj_field.dataType='附件'` 驱动的**通用**渲染(见 PanelxForm visibleAttachMeta),
        没有这几列/字段就没有附件区;文件本体落 yj_attachment(锚=面板+单号+附件N)。
      · 两个表都补 ERP 留位四列(`ERP单号`/`是否已转ERP`/`转ERP操作人`/`转ERP时间`)——
        与采购入库单同名列同类型。**本批不接转ERP**(金蝶调拨单/盘点单的保存报文未经实测,
        见文件末尾「六、为什么不接转ERP」),先留列位,接上时不必再改表。
      · 调拨单 + `调拨原因`;盘点单 + `盘点类型`/`盘点人`/`复核人`(盘点纸面签字栏)。
   ② **新建库存选货视图 `v_stock_pick` + 面板 `STOCK_PICK`**:调拨单/盘点单的「选单」来源。
      为什么不能直接用「库存明细 STOCK_DETAIL」:它是按 (仓库,存货) **跨批号聚合**的视图,
      选出来的行没有批号,而 kucun 是三键 (物料,仓库,批号) —— 没有批号就落不到正确的结存行,
      审核会报「台账无该批库存」。故另起一个**批号级**的可用量视图(只读,不写任何表)。
   ③ **字段登记 + 译名 + 授权**(STOCK_PICK 必须授权,否则选单弹窗 403)。
   ④ **自检**:列/字段/视图/面板/授权缺一即 RAISERROR。

   幂等:COL_LENGTH 判列、NOT EXISTS 判字段/译名/授权、CREATE OR ALTER 视图。两账套均需执行。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ════════════ ① 头表补列(逐列判存在,幂等) ════════════ */
-- 调拨单
IF COL_LENGTH(N'dbo.bd_transfer', N'附件1') IS NULL ALTER TABLE dbo.bd_transfer ADD [附件1] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'附件2') IS NULL ALTER TABLE dbo.bd_transfer ADD [附件2] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'附件3') IS NULL ALTER TABLE dbo.bd_transfer ADD [附件3] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'附件4') IS NULL ALTER TABLE dbo.bd_transfer ADD [附件4] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'附件5') IS NULL ALTER TABLE dbo.bd_transfer ADD [附件5] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'附件6') IS NULL ALTER TABLE dbo.bd_transfer ADD [附件6] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'调拨原因') IS NULL ALTER TABLE dbo.bd_transfer ADD [调拨原因] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'ERP单号') IS NULL ALTER TABLE dbo.bd_transfer ADD [ERP单号] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'是否已转ERP') IS NULL ALTER TABLE dbo.bd_transfer ADD [是否已转ERP] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'转ERP操作人') IS NULL ALTER TABLE dbo.bd_transfer ADD [转ERP操作人] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_transfer', N'转ERP时间') IS NULL ALTER TABLE dbo.bd_transfer ADD [转ERP时间] nvarchar(60) NULL;
-- 盘点单
IF COL_LENGTH(N'dbo.bd_stocktake', N'附件1') IS NULL ALTER TABLE dbo.bd_stocktake ADD [附件1] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'附件2') IS NULL ALTER TABLE dbo.bd_stocktake ADD [附件2] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'附件3') IS NULL ALTER TABLE dbo.bd_stocktake ADD [附件3] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'附件4') IS NULL ALTER TABLE dbo.bd_stocktake ADD [附件4] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'附件5') IS NULL ALTER TABLE dbo.bd_stocktake ADD [附件5] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'附件6') IS NULL ALTER TABLE dbo.bd_stocktake ADD [附件6] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'盘点类型') IS NULL ALTER TABLE dbo.bd_stocktake ADD [盘点类型] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'盘点人') IS NULL ALTER TABLE dbo.bd_stocktake ADD [盘点人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'复核人') IS NULL ALTER TABLE dbo.bd_stocktake ADD [复核人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'ERP单号') IS NULL ALTER TABLE dbo.bd_stocktake ADD [ERP单号] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'是否已转ERP') IS NULL ALTER TABLE dbo.bd_stocktake ADD [是否已转ERP] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'转ERP操作人') IS NULL ALTER TABLE dbo.bd_stocktake ADD [转ERP操作人] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_stocktake', N'转ERP时间') IS NULL ALTER TABLE dbo.bd_stocktake ADD [转ERP时间] nvarchar(60) NULL;
GO

/* 新增列的列级注明(中文列名按规范可豁免,这几处是语义坑,写清) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bd_transfer') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_transfer'),N'附件1','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'附件列位1..6:文件本体在 yj_attachment(panel_code=TRANSFER, doc_no=单据编号, field_key=附件N),本列只作"该位已用"标记', N'SCHEMA',N'dbo',N'TABLE',N'bd_transfer',N'COLUMN',N'附件1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bd_stocktake') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_stocktake'),N'附件1','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'附件列位1..6:文件本体在 yj_attachment(panel_code=STOCKTAKE, doc_no=单据编号, field_key=附件N),本列只作"该位已用"标记', N'SCHEMA',N'dbo',N'TABLE',N'bd_stocktake',N'COLUMN',N'附件1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bd_transfer') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_transfer'),N'调拨原因','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'调拨原因(人工填写,审计/追溯用;不参与记账)', N'SCHEMA',N'dbo',N'TABLE',N'bd_transfer',N'COLUMN',N'调拨原因';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bd_stocktake') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_stocktake'),N'盘点类型','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'盘点类型(全盘/抽盘/循环盘点,业务分类用;不参与记账)', N'SCHEMA',N'dbo',N'TABLE',N'bd_stocktake',N'COLUMN',N'盘点类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bd_stocktake') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_stocktake'),N'盘点人','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'盘点人(实际执行盘点的人,纸面签字栏;可与经手人不同)', N'SCHEMA',N'dbo',N'TABLE',N'bd_stocktake',N'COLUMN',N'盘点人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bd_stocktake') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_stocktake'),N'复核人','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'复核人(仓库主管复点签字栏;只作留痕)', N'SCHEMA',N'dbo',N'TABLE',N'bd_stocktake',N'COLUMN',N'复核人';
GO

/* ════════════ ② 库存选货视图 v_stock_pick(批号级可用量) ════════════
   · 粒度严格 = kucun 的三键(物料,仓库,批号),与审核过账落库的键**完全一致**;
   · 只出「现存量 > 0」的行(盘点若也要盘 0 行,把 WHERE 的 yl>0 去掉即可,当前口径=只挑有货的);
   · 档案取单一值:bs_inv 的「存货编码」实测有 1 组重复(3874 行 / 3873 码)、bs_wh 无重复,
     故一律用 OUTER APPLY TOP 1 —— LEFT JOIN 会让同一个 kucun 行被翻倍(v_stock_movement 同类坑)。 */
CREATE OR ALTER VIEW dbo.v_stock_pick AS
SELECT ROW_NUMBER() OVER (ORDER BY k.ckdm, k.wzdm, k.lot_no) AS id,
       CAST('N' AS nvarchar(1)) AS asp_cancel,
       k.wzdm AS [存货编码],
       ISNULL(i.[存货名称], k.wzdm) AS [存货名称],
       i.[规格型号] AS [规格型号],
       i.[计量单位] AS [计量单位],
       k.ckdm AS [仓库编码],
       ISNULL(w.[仓库名称], k.ckdm) AS [仓库],
       NULLIF(RTRIM(k.lot_no), N'') AS [批号],
       CAST(ISNULL(k.yl, 0) AS decimal(18,4)) AS [现存量],
       CAST(ISNULL(k.price, 0) AS decimal(18,4)) AS [结存单价],
       k.update_date AS [更新时间]
FROM dbo.kucun k
OUTER APPLY (SELECT TOP 1 x.[存货名称], x.[规格型号], x.[计量单位] FROM dbo.bs_inv x WHERE x.[存货编码] = k.wzdm ORDER BY x.id) i
OUTER APPLY (SELECT TOP 1 y.[仓库名称] FROM dbo.bs_wh y WHERE y.[仓库编码] = k.ckdm ORDER BY y.id) w
WHERE ISNULL(k.asp_cancel, N'N') <> N'Y' AND ISNULL(k.yl, 0) > 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.v_stock_pick') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'库存选货视图(调拨单/盘点单「选单」来源):kucun 三键(物料,仓库,批号)粒度的可用量,只出 现存量>0 的行;只读', N'SCHEMA',N'dbo',N'VIEW',N'v_stock_pick';
GO

/* ════════════ ③ 选货面板 STOCK_PICK(flat,只读;无菜单入口,只做选单来源) ════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCK_PICK')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('STOCK_PICK', N'库存选货', N'报表', N'flat', N'v_stock_pick', NULL, NULL, N'id', NULL, NULL, N'更新时间', 50, N'items', N'库存管理', N'Stock picker');
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货名称', N'query,detail', 10, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'存货名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'存货名称', N'存货名称', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 160, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 140, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,detail', 40, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 42, 110, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'批号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 50, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'计量单位', N'计量单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'现存量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'现存量', N'现存量', N'小数', NULL, NULL, NULL, NULL, N'detail', 70, 110, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'结存单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'结存单价', N'结存单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 110, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCK_PICK' AND label=N'更新时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCK_PICK', N'更新时间', N'更新时间', N'日期时间', NULL, NULL, NULL, NULL, N'detail', 90, 140, 0, 0, 0, NULL, 1);
GO

/* ════════════ ④ 新字段登记(两个单据) ════════════ */
-- 调拨单:附件1..6 + 调拨原因 + ERP 留位
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'附件1')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'附件1', N'附件1', N'附件', NULL, NULL, NULL, NULL, N'header', 90, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'附件2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'附件2', N'附件2', N'附件', NULL, NULL, NULL, NULL, N'header', 100, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'附件3')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'附件3', N'附件3', N'附件', NULL, NULL, NULL, NULL, N'header', 110, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'附件4')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'附件4', N'附件4', N'附件', NULL, NULL, NULL, NULL, N'header', 120, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'附件5')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'附件5', N'附件5', N'附件', NULL, NULL, NULL, NULL, N'header', 130, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'附件6')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'附件6', N'附件6', N'附件', NULL, NULL, NULL, NULL, N'header', 140, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'调拨原因')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'调拨原因', N'调拨原因', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 200, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'ERP单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'ERP单号', N'ERP单号', N'文本', NULL, NULL, NULL, NULL, N'header', 300, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'转ERP操作人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'转ERP操作人', N'转ERP操作人', N'文本', NULL, NULL, NULL, NULL, N'header', 310, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'转ERP时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'转ERP时间', N'转ERP时间', N'日期', NULL, NULL, NULL, NULL, N'header', 320, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TRANSFER' AND label=N'是否已转ERP')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('TRANSFER', N'是否已转ERP', N'是否已转ERP', N'文本', NULL, NULL, NULL, NULL, N'header', 330, 80, 0, 0, 1, NULL, 0);
GO
-- 盘点单:附件1..6 + 盘点类型/盘点人/复核人 + ERP 留位
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'附件1')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'附件1', N'附件1', N'附件', NULL, NULL, NULL, NULL, N'header', 90, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'附件2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'附件2', N'附件2', N'附件', NULL, NULL, NULL, NULL, N'header', 100, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'附件3')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'附件3', N'附件3', N'附件', NULL, NULL, NULL, NULL, N'header', 110, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'附件4')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'附件4', N'附件4', N'附件', NULL, NULL, NULL, NULL, N'header', 120, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'附件5')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'附件5', N'附件5', N'附件', NULL, NULL, NULL, NULL, N'header', 130, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'附件6')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'附件6', N'附件6', N'附件', NULL, NULL, NULL, NULL, N'header', 140, 220, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'盘点类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'盘点类型', N'盘点类型', N'下拉框', N'SELECT v FROM (VALUES (N''全盘''),(N''抽盘''),(N''循环盘点'')) AS t(v)', NULL, NULL, NULL, N'query,header', 60, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'盘点人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'盘点人', N'盘点人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'query,header', 62, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'复核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'复核人', N'复核人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'header', 64, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'ERP单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'ERP单号', N'ERP单号', N'文本', NULL, NULL, NULL, NULL, N'header', 300, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'转ERP操作人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'转ERP操作人', N'转ERP操作人', N'文本', NULL, NULL, NULL, NULL, N'header', 310, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'转ERP时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'转ERP时间', N'转ERP时间', N'日期', NULL, NULL, NULL, NULL, N'header', 320, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='STOCKTAKE' AND label=N'是否已转ERP')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('STOCKTAKE', N'是否已转ERP', N'是否已转ERP', N'文本', NULL, NULL, NULL, NULL, N'header', 330, 80, 0, 0, 1, NULL, 0);
GO

/* ════════════ ⑤ 译名(AGENTS 硬规范:新字段必带 en;新增标签另补 ja/ko) ════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库存选货' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库存选货', 'en', N'Stock picker', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库存选货' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库存选货', 'ja', N'在庫選択', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调拨原因' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调拨原因', 'en', N'Transfer reason', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调拨原因' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调拨原因', 'ja', N'振替理由', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'调拨原因' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'调拨原因', 'ko', N'이동 사유', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'盘点类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'盘点类型', 'en', N'Count type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'盘点类型' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'盘点类型', 'ja', N'棚卸種類', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'盘点人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'盘点人', 'en', N'Counter', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'盘点人' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'盘点人', 'ja', N'棚卸担当', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'复核人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'复核人', 'en', N'Reviewed by', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'复核人' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'复核人', 'ja', N'確認者', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结存单价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结存单价', 'en', N'Balance price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结存单价' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结存单价', 'ja', N'残高単価', 'manual');
GO

/* ════════════ ⑥ 授权(选货面板必须有 view,否则选单弹窗 403) ════════════ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'STOCK_PICK', 'N', 'view,query'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'STOCK_PICK')
  AND (r.is_admin = 'Y'
       OR EXISTS (SELECT 1 FROM yj_role_panel s WHERE s.role_id = r.id AND s.panel_code = N'TRANSFER' AND s.perms LIKE '%view%'));
GO

/* ════════════ ⑦ 自检 ════════════ */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.bd_transfer', N'附件1') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_transfer', N'附件6') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_transfer', N'调拨原因') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_transfer', N'ERP单号') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_stocktake', N'附件1') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_stocktake', N'附件6') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_stocktake', N'盘点类型') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_stocktake', N'盘点人') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_stocktake', N'复核人') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_stocktake', N'转ERP时间') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_stock_pick', N'V') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCK_PICK') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_PICK') < 9 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = 'STOCK_PICK' AND role_id = 1) SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'TRANSFER' AND label LIKE N'附件%') < 6 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCKTAKE' AND label LIKE N'附件%') < 6 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'盘点类型' AND locale='en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'调拨/盘点对齐自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'调拨单/盘点单对齐就绪(附件位 6×2 / 补充字段 / 库存选货视图与面板 / 译名 / 授权;幂等)';
GO

/* ============================================================
   六、为什么不接「转ERP」(给后人,别再重复讨论)

   金蝶云·星辰的接口路径是确认过的(`tools/archive/_kd-endpoints-qeasy.txt`):
     调拨  /jdy/v2/scm/inv_tfmove(另有 inv_tfout 调拨出库 / inv_tfin 调拨入库)
     盘点  /jdy/v2/scm/inv_check_bill(另有 inv_check_gail_bill 盘盈 / inv_check_loss_bill 盘亏)
   但**保存报文的字段名与必填项没有实测样本**:现有 7 张单据的转ERP(采购/销售/领料/产品/其他出入库)
   都是照着 `tools/archive/_dump-out/kingdee-save-*.md` 的真实请求回放实现的,
   连"业务类型 trans_type_id 必填"这种坑都是实测撞出来的。
   在**没有报文样本**的情况下凭路径猜字段,产出的会是**金蝶侧的脏单**(字段静默丢失、
   库存被记成 0 元、甚至直接建单失败),比暂时没有这个按钮更糟。
   ⇒ 本批只留 `ERP单号/是否已转ERP/转ERP操作人/转ERP时间` 四个列位与字段(隐藏/只读),
     接转ERP 时只需在 KingdeePushService 里补两个分支 + 打开按钮,不必再改表。
   ============================================================ */
