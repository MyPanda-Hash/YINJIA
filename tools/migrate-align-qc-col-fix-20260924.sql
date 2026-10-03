-- migrate-align-qc-col-fix-20260924.sql — 检验/退料明细缺列补齐(2026-09-24 三连坑收口)
-- 根因:远程库对 qc_insp_detail/qc_return_detail 库上直改补列未入链(spec-unify/不合格数量 依赖),本地旧表无列 → 代码 500。
-- 本支:补 规格型号/不合格数量/处置方式 三列并从同义列搬值;幂等可重跑。
SET NOCOUNT ON;
IF COL_LENGTH('qc_insp_detail', N'规格型号') IS NULL ALTER TABLE qc_insp_detail ADD [规格型号] nvarchar(200) NULL;
GO
IF COL_LENGTH('qc_insp_detail', N'不合格数量') IS NULL ALTER TABLE qc_insp_detail ADD [不合格数量] decimal(18,4) NULL;
GO
IF COL_LENGTH('qc_insp_detail', N'处置方式') IS NULL ALTER TABLE qc_insp_detail ADD [处置方式] nvarchar(20) NULL;
GO
IF COL_LENGTH('qc_return_detail', N'规格型号') IS NULL ALTER TABLE qc_return_detail ADD [规格型号] nvarchar(200) NULL;
GO
-- 搬值(独立批次)
UPDATE qc_insp_detail SET [规格型号]=[型号] WHERE ISNULL([规格型号],N'')=N'' AND ISNULL([型号],N'')<>N'';
UPDATE qc_return_detail SET [规格型号]=[型号] WHERE ISNULL([规格型号],N'')=N'' AND ISNULL([型号],N'')<>N'';
UPDATE qc_insp_detail SET [不合格数量]=[不良数量] WHERE [不合格数量] IS NULL AND [不良数量] IS NOT NULL;
UPDATE qc_insp_detail SET [不良数量]=[不合格数量] WHERE [不良数量] IS NULL AND [不合格数量] IS NOT NULL;
GO
-- 面板字段统一:QC_INSP/QC_RETURN 的 型号 → 规格型号
UPDATE yj_field SET col_name=N'规格型号', label=N'规格型号' WHERE panel_code IN ('QC_INSP','QC_RETURN') AND col_name=N'型号';
GO
PRINT N'migrate-align-qc-col-fix-20260924 完成';
GO
