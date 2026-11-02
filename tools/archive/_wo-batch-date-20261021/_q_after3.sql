SET NOCOUNT ON;
SELECT TOP 20 p.pl_no 工单号, p.pl_xc 行, CONVERT(varchar(10),p.pl_date,120) 单据日期,
       CONVERT(varchar(16),p.asp_time1,120) 转单时间, ISNULL(p.[批次号],N'') 批次号,
       CONVERT(varchar(19),p.[完工时间],120) 完工时间, ISNULL(p.ja,N'') ja, p.pl_sl, p.rk_sl
FROM dbo.plang p WHERE p.pl_no IN (N'GD-2026-10-0004',N'GD-2026-10-0211',N'GD-2026-10-0221',N'GD-2026-10-0001')
ORDER BY p.pl_no, p.pl_xc;
GO
SELECT N'scjl' 单据, s.sc_no 单号, CONVERT(varchar(19),s.sc_date,120) 单据日期, ISNULL(s.[批次号],N'') 批次号,
       ISNULL(s.lot_no,N'') lot_no, CONVERT(varchar(19),s.asp_time1,120) 创建
FROM dbo.scjl s WHERE s.gldh=N'GD-2026-10-0004'
UNION ALL
SELECT N'finish_in', f.[单据编号], CONVERT(varchar(19),f.[单据日期],120), ISNULL(f.[批次号],N''), N'', CONVERT(varchar(19),f.asp_time1,120)
FROM dbo.bd_finish_in f WHERE f.[加工单号]=N'GD-2026-10-0004'
UNION ALL
SELECT N'first_insp', h.[单据编号], CONVERT(varchar(19),h.[单据日期],120), ISNULL(h.[批次号],N''), N'', CONVERT(varchar(19),h.asp_time1,120)
FROM dbo.qc_first_insp_head h WHERE h.[工单号]=N'GD-2026-10-0004'
UNION ALL
SELECT N'proc_insp', h.[单据编号], CONVERT(varchar(19),h.[单据日期],120), ISNULL(h.[批次号],N''), N'', CONVERT(varchar(19),h.asp_time1,120)
FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=N'GD-2026-10-0004'
UNION ALL
SELECT N'asm_insp', h.[单据编号], CONVERT(varchar(19),h.[单据日期],120), ISNULL(h.[批次号],N''), N'', CONVERT(varchar(19),h.asp_time1,120)
FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=N'GD-2026-10-0004';
GO
