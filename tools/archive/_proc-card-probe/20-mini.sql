SET NOCOUNT ON;
SELECT N'--- 1 直接 count ---' AS x;
SELECT COUNT(*) AS n FROM dbo.plang p WHERE p.pl_no = N'GD-2026-10-0018';

SELECT N'--- 2 派生表 count ---' AS x;
SELECT COUNT(*) AS n FROM (SELECT p.id, p.pl_no FROM dbo.plang p WHERE p.pl_no = N'GD-2026-10-0018') a;

SELECT N'--- 3 派生表 join scjl(有 on 条件) ---' AS x;
SELECT COUNT(*) AS n
FROM (SELECT p.id, p.pl_no FROM dbo.plang p WHERE p.pl_no = N'GD-2026-10-0018') a
JOIN dbo.scjl s ON s.gldh = a.pl_no;

SELECT N'--- 4 派生表 与 scjl 直连对比 ---' AS x;
SELECT COUNT(*) AS n FROM dbo.scjl s WHERE s.gldh IN (SELECT p.pl_no FROM dbo.plang p WHERE p.pl_no = N'GD-2026-10-0018');
