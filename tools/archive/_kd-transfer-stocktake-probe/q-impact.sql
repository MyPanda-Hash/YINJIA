SET NOCOUNT ON;
PRINT '=== 合并前后:总量不变(只是键合并) ===';
SELECT (SELECT SUM(yl) FROM kucun) 合并前总量, (SELECT SUM(yl) FROM kucun WHERE lot_no<>'PC0000' OR lot_no IS NULL) 除PC外总量;
PRINT '=== 负结存行分布 ===';
SELECT CASE WHEN lot_no='PC0000' THEN 'PC0000' WHEN lot_no IS NULL THEN 'NULL' ELSE 'REAL' END cat,
       COUNT(*) n, SUM(CASE WHEN yl<0 THEN 1 ELSE 0 END) 负行数, SUM(CASE WHEN yl<0 THEN yl ELSE 0 END) 负合计
FROM kucun GROUP BY CASE WHEN lot_no='PC0000' THEN 'PC0000' WHEN lot_no IS NULL THEN 'NULL' ELSE 'REAL' END;
PRINT '=== 全库负结存行总数 ===';
SELECT COUNT(*) 负行数, SUM(yl) 负合计 FROM kucun WHERE yl < 0;
