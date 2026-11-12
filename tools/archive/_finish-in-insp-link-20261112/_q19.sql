SELECT TOP 8 s.gldh, s.[工单行号] AS xc, s.gxdm, s.lot_no, SUM(s.sl) AS qty
FROM dbo.scjl s
WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,N'')<>N'' AND ISNULL(s.lot_no,N'')<>N''
GROUP BY s.gldh, s.[工单行号], s.gxdm, s.lot_no
ORDER BY s.gldh DESC;
