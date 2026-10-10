-- q-09-req-codes.sql — 探针:找两个真实商品做探针用(一个**有**来料检验要求 / 一个**没有**)
SELECT TOP 3 r.物料编号, COUNT(*) AS 要求列 FROM qc_insp_req r GROUP BY r.物料编号 ORDER BY COUNT(*) DESC;

PRINT N'=== 气泡袋 YJ-KBL-021 在要求表里有几行 ===';
SELECT COUNT(*) AS 行数 FROM qc_insp_req WHERE 物料编号 = N'YJ-KBL-021';

PRINT N'=== 折叠棉 YJ-YCYX-006 在要求表里有几行 ===';
SELECT COUNT(*) AS 行数 FROM qc_insp_req WHERE 物料编号 = N'YJ-YCYX-006';

PRINT N'=== 有要求行的商品编码(取样) ===';
SELECT DISTINCT TOP 5 物料编号 FROM qc_insp_req WHERE ISNULL(物料编号, N'') <> N'';
