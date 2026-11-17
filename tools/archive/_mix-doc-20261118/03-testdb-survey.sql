SET NOCOUNT ON;
SELECT COUNT(*) AS mate_rows, COUNT(DISTINCT m_no) AS products FROM dbo.mate;
GO
SET NOCOUNT ON;
SELECT TOP 6 id, m_no, wzdm2, wzmc2, gg2, jldw2, bzl, sl2 FROM dbo.mate ORDER BY id;
GO
SET NOCOUNT ON;
SELECT pl_no, pl_xc, dm, mc, scx, pl_sl FROM dbo.plang WHERE pl_no = N'GD-2026-11-0015';
GO
SET NOCOUNT ON;
SELECT 标记 AS mark, COUNT(*) AS rows_, COUNT(DISTINCT 单据编号) AS docs FROM dbo.wo_mixing_list GROUP BY 标记;
GO
SET NOCOUNT ON;
SELECT TOP 5 id, 单据编号, 工单号, 工单行号, 物料编号, 计划用量, 实际用量, 标记 FROM dbo.wo_mixing_list ORDER BY id DESC;
