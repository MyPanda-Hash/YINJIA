/* 选真实数据:批次 20261019/20261016 下 GD-2026-10-0018 的工单行 + 工序台账/报工(只读) */
SET NOCOUNT ON;
PRINT N'==== @DB = ' + DB_NAME() + N' ====';

SELECT p.id AS 工单行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号, p.dm AS 产品编码, p.mc AS 产品名称,
       p.pl_sl AS 计划数量, p.[批次号] AS plang批次, CONVERT(varchar(8), p.pl_date, 112) AS 工单日期,
       (SELECT TOP 1 pc.[批次号] FROM dbo.plang_pc pc WHERE pc.plang_id=p.id ORDER BY pc.id DESC) AS pc批次
  FROM dbo.plang p
 WHERE p.pl_no = N'GD-2026-10-0018' AND ISNULL(p.asp_cancel,N'N')<>'Y'
 ORDER BY p.pl_xc, p.id;
GO

SELECT p.id AS 工单行id, l.[工序序], l.[工序], l.计划数量
  FROM dbo.plang p JOIN dbo.wo_process_line l ON l.工单行id = p.id AND ISNULL(l.asp_cancel,N'N')<>'Y'
 WHERE p.pl_no = N'GD-2026-10-0018' AND ISNULL(p.asp_cancel,N'N')<>'Y'
 ORDER BY p.pl_xc, ISNULL(l.工序序,999);
GO

SELECT p.id AS 工单行id, CONVERT(varchar(8), p.pl_date, 112) AS 推定批次, p.[批次号] AS plang批次
  FROM dbo.plang p WHERE ISNULL(p.asp_cancel,N'N')<>'Y'
   AND CONVERT(varchar(8), p.pl_date, 112) IN (N'20261019', N'20261016')
 ORDER BY p.id;
GO
