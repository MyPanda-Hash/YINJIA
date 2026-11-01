SET NOCOUNT ON;
DECLARE @no nvarchar(56)=N'GD-2026-10-0004';
SELECT N'scjl' AS 单据, s.sc_no AS 单号, CONVERT(varchar(19),s.sc_date,120) AS 单据日期,
       CONVERT(varchar(19),s.wgsj,120) AS 完工时间, CONVERT(varchar(19),s.asp_time1,120) AS 创建, ISNULL(s.[批次号],N'') AS 批次号
FROM dbo.scjl s WHERE s.gldh=@no
UNION ALL
SELECT N'finish_in', f.[单据编号], CONVERT(varchar(19),f.[单据日期],120), CONVERT(varchar(19),f.[审核时间],120), CONVERT(varchar(19),f.asp_time1,120), ISNULL(f.[批次号],N'')
FROM dbo.bd_finish_in f WHERE f.[加工单号]=@no
UNION ALL
SELECT N'first_insp', h.[单据编号], CONVERT(varchar(19),h.[单据日期],120), CONVERT(varchar(19),h.[检验日期],120), CONVERT(varchar(19),h.asp_time1,120), ISNULL(h.[批次号],N'')
FROM dbo.qc_first_insp_head h WHERE h.[工单号]=@no
UNION ALL
SELECT N'proc_insp', h.[单据编号], CONVERT(varchar(19),h.[单据日期],120), CONVERT(varchar(19),h.[检验日期],120), CONVERT(varchar(19),h.asp_time1,120), ISNULL(h.[批次号],N'')
FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=@no
UNION ALL
SELECT N'asm_insp', h.[单据编号], CONVERT(varchar(19),h.[单据日期],120), CONVERT(varchar(19),h.[检验日期],120), CONVERT(varchar(19),h.asp_time1,120), ISNULL(h.[批次号],N'')
FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=@no
UNION ALL
SELECT N'wo_progress', ISNULL(p.[工序],N''), CONVERT(varchar(19),p.asp_time1,120), N'', N'', ISNULL(p.[批次号],N'')
FROM dbo.wo_progress p WHERE p.[单据编号]=@no;
GO
