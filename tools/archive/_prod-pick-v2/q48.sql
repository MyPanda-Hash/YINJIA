SET NOCOUNT ON;
SELECT 单据编号, 单据类型, 物料编码, 数量, 仓库名称, asp_time1 FROM inh WHERE 单据编号 IN ('OI-2026-10-0006','OI-2026-10-0007') ORDER BY id;
GO
SELECT wzdm, ckdm, lot_no, rkl, ckl, yl, update_date FROM kucun WHERE wzdm IN ('YJ-ZZ-001','YJ-KBL-012') ORDER BY wzdm, ckdm;
