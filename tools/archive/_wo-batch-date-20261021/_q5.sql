SET NOCOUNT ON;
DECLARE @w TABLE(pl_no nvarchar(56) PRIMARY KEY);
INSERT @w SELECT DISTINCT pl_no FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';

SELECT TOP 40 s.gldh AS 工单号, s.[工单行号], ISNULL(s.[批次号],N'') AS 批次号, s.sc_no AS 报工单号, s.gxdm AS 工序,
       CONVERT(varchar(19), s.sc_date, 120) AS 生产日期, CONVERT(varchar(19), s.wgsj, 120) AS 完工时间,
       CONVERT(varchar(19), s.asp_time1, 120) AS 创建时间, ISNULL(s.wgzt,N'') AS wgzt
FROM dbo.scjl s JOIN @w w ON w.pl_no=s.gldh ORDER BY s.gldh, s.id;
GO
SELECT TOP 40 f.[加工单号] AS 工单号, f.[工单行号], ISNULL(f.[批次号],N'') AS 批次号, f.[单据编号] AS 入库单号,
       CONVERT(varchar(19), f.[单据日期], 120) AS 单据日期, CONVERT(varchar(19), f.[审核时间], 120) AS 审核时间,
       CONVERT(varchar(19), f.asp_time1, 120) AS 创建时间, ISNULL(f.[单据状态],N'') AS 单据状态
FROM dbo.bd_finish_in f JOIN @w w ON w.pl_no=f.[加工单号] ORDER BY f.[加工单号], f.id;
GO
SELECT TOP 40 h.[工单号], ISNULL(h.[批次号],N'') AS 批次号, h.[单据编号] AS 首件单号,
       CONVERT(varchar(19), h.[单据日期], 120) AS 单据日期, CONVERT(varchar(19), h.[检验日期], 120) AS 检验日期,
       ISNULL(h.[生产日期],N'') AS 生产日期, ISNULL(h.[单据状态],N'') AS 状态
FROM dbo.qc_first_insp_head h JOIN @w w ON w.pl_no=h.[工单号] ORDER BY h.[工单号], h.id;
GO
SELECT TOP 40 h.[工单号], ISNULL(h.[批次号],N'') AS 批次号, h.[单据编号] AS 制程单号,
       CONVERT(varchar(19), h.[单据日期], 120) AS 单据日期, CONVERT(varchar(19), h.[检验日期], 120) AS 检验日期,
       ISNULL(h.[单据状态],N'') AS 状态
FROM dbo.qc_proc_insp_head h JOIN @w w ON w.pl_no=h.[工单号] ORDER BY h.[工单号], h.id;
GO
SELECT TOP 40 h.[工单号], ISNULL(h.[批次号],N'') AS 批次号, h.[单据编号] AS 组装单号,
       CONVERT(varchar(19), h.[单据日期], 120) AS 单据日期, CONVERT(varchar(19), h.[检验日期], 120) AS 检验日期,
       ISNULL(h.[单据状态],N'') AS 状态
FROM dbo.qc_asm_insp_head h JOIN @w w ON w.pl_no=h.[工单号] ORDER BY h.[工单号], h.id;
GO
