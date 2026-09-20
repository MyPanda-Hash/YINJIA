-- migrate-qc-return-chain-link.sql — 暂收退回单(QC_RETURN)链路字段补齐(2026-09-20)
-- ════════════════════════════════════════════════════════════════════════════
-- 背景:采购链有两条下游支路——合格→采购入库(inspAutoPurchaseIn)、不良→暂收退回单(inspAutoReturn)。
-- 采购入库侧已补齐「采购订单号(头)+采购订单行号(行)」,退回侧此前缺失,导致退回单无法追溯到原采购订单;
-- 另有两条历史遗留断点(退回侧):
--   ① `inspAutoReturn` 已在写 计量单位/单价,但 qc_return_detail **没有这两列** → 值与「型号」一样被静默丢弃
--      (列不存在时保存按标签查不到列即忽略);
--   ② 代码写「型号」,而退回行的字段标签是「规格型号」→ 同样丢失。
--
-- 本迁移补齐(幂等,可重复执行):
--   头 qc_return:采购订单号(可见,进查询区)
--   行 qc_return_detail:采购订单行号、计量单位、单价、规格型号(若表缺列一并建,标签对齐)
-- 配套代码:
--   ButtonService.inspAutoReturn(自动生单带 采购订单号/行号,并修正 型号→规格型号、落 计量单位/单价)
--   PanelConfigService.FLOW_HEAD_SYNONYMS(QC_INSP|QC_RETURN 增 采购订单号→采购订单号,供选单路径)
--   ButtonService.syncInspFromSlRecv(送料暂收→检验镜像增 采购订单行号)
-- ════════════════════════════════════════════════════════════════════════════
SET NOCOUNT ON;

-- ══════════ 1) 头:采购订单号 ══════════
IF COL_LENGTH('dbo.qc_return', N'采购订单号') IS NULL
    ALTER TABLE dbo.qc_return ADD [采购订单号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'采购订单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_RETURN', N'采购订单号', N'采购订单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 35, 150, 1, 0, 0, 1);

-- ══════════ 2) 行:采购订单行号 / 计量单位 / 单价 ══════════
IF COL_LENGTH('dbo.qc_return_detail', N'采购订单行号') IS NULL
    ALTER TABLE dbo.qc_return_detail ADD [采购订单行号] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'采购订单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_RETURN', N'采购订单行号', N'采购订单行号', N'文本', NULL, NULL, NULL, NULL, N'detail', 205, 110, 1, 0, 0, 1);

IF COL_LENGTH('dbo.qc_return_detail', N'计量单位') IS NULL
    ALTER TABLE dbo.qc_return_detail ADD [计量单位] nvarchar(50) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_RETURN', N'计量单位', N'计量单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 235, 90, 1, 0, 0, 1);

IF COL_LENGTH('dbo.qc_return_detail', N'单价') IS NULL
    ALTER TABLE dbo.qc_return_detail ADD [单价] decimal(18, 6) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_RETURN', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 245, 90, 1, 0, 0, 1);

-- 规格型号:退回行已有该列(检验行叫「型号」,代码原先按「型号」写导致丢弃)→ 仅确保字段注册存在
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('QC_RETURN', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 110, 1, 0, 0, 1);

-- ══════════ 3) 列中文注明 ══════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.qc_return') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_return'), N'采购订单号', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来源采购订单号(链路带入:采购订单→送料暂收→来料检验→暂收退回)', N'SCHEMA', N'dbo', N'TABLE', N'qc_return', N'COLUMN', N'采购订单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.qc_return_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_return_detail'), N'采购订单行号', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'对应采购订单行号(链路带入)', N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'采购订单行号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.qc_return_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_return_detail'), N'计量单位', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位(自检验行带入)', N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'计量单位';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.qc_return_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_return_detail'), N'单价', 'ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单价(自检验行带入)', N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'单价';
GO

-- ══════════ 自检 ══════════
SELECT N'qc_return.采购订单号' AS 项, CAST((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_return' AND COLUMN_NAME=N'采购订单号') AS nvarchar(10)) AS 结果
UNION ALL SELECT N'qc_return_detail.采购订单行号', CAST((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_return_detail' AND COLUMN_NAME=N'采购订单行号') AS nvarchar(10))
UNION ALL SELECT N'qc_return_detail.计量单位', CAST((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_return_detail' AND COLUMN_NAME=N'计量单位') AS nvarchar(10))
UNION ALL SELECT N'qc_return_detail.单价', CAST((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_return_detail' AND COLUMN_NAME=N'单价') AS nvarchar(10))
UNION ALL SELECT N'QC_RETURN 面板字段数', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code='QC_RETURN';
GO
PRINT N'migrate-qc-return-chain-link 完成:暂收退回单 采购订单号/采购订单行号/计量单位/单价 已就绪';
GO
