SET NOCOUNT ON;
SELECT TOP 5 a.pl_no AS a_plno, LEN(a.pl_no) AS a_len, DATALENGTH(a.pl_no) AS a_bytes,
       s.gldh AS s_gldh, LEN(s.gldh) AS s_len, DATALENGTH(s.gldh) AS s_bytes,
       CASE WHEN s.gldh = a.pl_no THEN 1 ELSE 0 END AS eq
FROM (SELECT p.id AS 工单行id, p.pl_no FROM dbo.plang p WHERE p.pl_no = N'GD-2026-10-0018') a
JOIN dbo.scjl s ON ISNULL(s.asp_cancel,'N') <> 'Y'
WHERE s.gldh LIKE N'%GD-2026-10-0018%';

SELECT N'--- 直接比较 ---' AS x;
SELECT TOP 3 s.gldh, CASE WHEN s.gldh = N'GD-2026-10-0018' THEN 1 ELSE 0 END AS eq_const
FROM dbo.scjl s WHERE s.gldh LIKE N'%GD-2026-10-0018%';
