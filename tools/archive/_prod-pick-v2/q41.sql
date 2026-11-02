SET NOCOUNT ON;
SELECT TOP 6 id, src, 单据编号, 单据类型, 物料编码, 数量, 仓库名称 FROM inh WHERE 单据编号 IN ('OI-2026-10-0006','OI-2026-10-0007');
GO
SELECT TOP 6 id, src, 单据编号, 物料编码, 数量, 仓库名称 FROM outh WHERE 单据编号='LL-2026-10-0006';
GO
SELECT kucun_no, wzdm, ckdm, lot_no, rkl, ckl, yl FROM kucun WHERE wzdm='YJ-ZZ-001' ORDER BY update_date DESC;
