SELECT p.id, p.pl_no, p.pl_xc, p.od_no, p.od_xc, p.dm, p.pl_sl, p.xq_sl,
       CONVERT(varchar(19), p.asp_time1, 120) AS 创建时间
FROM dbo.plang p
WHERE p.od_no = N'ZL-20261016-01'
ORDER BY p.id;
GO
SELECT source_form_no, source_line_key, target_form_no, target_line_key, linked_quantity
FROM dbo.form_flow_link WHERE source_form_no = N'ZL-20261016-01' ORDER BY id;
GO
