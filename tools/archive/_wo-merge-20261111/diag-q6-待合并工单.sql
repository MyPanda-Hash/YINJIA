SELECT p.od_no AS 销售订单, COUNT(DISTINCT p.pl_no) AS 工单张数, COUNT(*) AS 工单行数,
       CONVERT(varchar(10), MIN(p.asp_time1), 120) AS 最早, CONVERT(varchar(10), MAX(p.asp_time1), 120) AS 最晚
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.od_no,N'')<>N''
  AND ISNULL(p.[是否切单],'N')<>'Y'
  AND p.asp_time1 >= CONVERT(datetime, '2026-11-11', 120)
GROUP BY p.od_no
HAVING COUNT(DISTINCT p.pl_no) > 1
ORDER BY 工单张数 DESC, 最晚 DESC;
GO
SELECT p.pl_no, p.pl_xc, p.od_no, p.od_xc, p.dm, p.pl_sl, p.ja,
       ISNULL(p.scx,N'') AS 生产线, ISNULL(p.rk_sl,0) AS 入库, ISNULL(p.ll_no2,N'') AS 领料单号,
       (SELECT COUNT(*) FROM dbo.plang_pc pc WHERE pc.plang_id=p.id) AS 排产行,
       (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gd_id IN (SELECT id FROM dbo.plang_pc pc2 WHERE pc2.plang_id=p.id)) AS 报工行,
       (SELECT COUNT(*) FROM dbo.wo_process_line w WHERE w.工单行id=p.id) AS 台账行
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND p.od_no IN (N'XQ-20261019-01', N'LZW-20261019-02')
ORDER BY p.od_no, p.pl_no, p.pl_xc;
GO
