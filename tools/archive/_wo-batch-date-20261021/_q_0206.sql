SET NOCOUNT ON;
SELECT id, pl_no, pl_xc, ISNULL([批次号],N'') 批次号, ISNULL([完工状态],N'') 完工状态, ISNULL(ja,N'') ja, pl_sl, rk_sl,
       CONVERT(varchar(10),pl_date,120) 单据日期, ISNULL(asp_cancel,'N') cancel
FROM dbo.plang WHERE pl_no=N'GD-2026-10-0206' ORDER BY id;
GO
SELECT pc.id, pc.pl_no, pc.pl_xc, pc.plang_id, ISNULL(pc.[批次号],N'') 批次号, ISNULL(pc.lot_no,N'') lot_no, ISNULL(pc.asp_cancel,'N') cancel
FROM dbo.plang_pc pc WHERE pc.pl_no=N'GD-2026-10-0206' ORDER BY pc.id;
GO
SELECT s.id, s.gldh, s.[工单行号], s.gd_id, ISNULL(s.[批次号],N'') 批次号, ISNULL(s.lot_no,N'') lot_no, ISNULL(s.asp_cancel,'N') cancel, s.sc_no
FROM dbo.scjl s WHERE s.gldh=N'GD-2026-10-0206' ORDER BY s.id;
GO
