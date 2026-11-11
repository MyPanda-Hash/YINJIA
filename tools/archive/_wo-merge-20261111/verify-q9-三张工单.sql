SELECT p.id, p.pl_no, p.pl_xc, p.od_no, p.od_xc, p.dm, p.pl_sl, p.xq_sl,
       CONVERT(varchar(19), p.asp_time1, 120) AS 创建时间,
       (SELECT COUNT(*) FROM dbo.wo_process_line w WHERE w.工单行id = p.id) AS 台账行数
FROM dbo.plang p
WHERE p.od_no = N'ZL-20261016-01' ORDER BY p.id;
GO
