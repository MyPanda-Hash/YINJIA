SET NOCOUNT ON;
PRINT '===== 1. kucun 结存总览 =====';
SELECT 行数 = COUNT(*),
       正结存 = SUM(CASE WHEN yl > 0 THEN 1 ELSE 0 END),
       零结存 = SUM(CASE WHEN yl = 0 THEN 1 ELSE 0 END),
       负结存 = SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END),
       余量合计 = SUM(yl),
       负余量合计 = SUM(CASE WHEN yl < 0 THEN yl ELSE 0 END)
FROM kucun;

PRINT '===== 2. 流水与结存对账(键 = 物料+仓库+批号) =====';
;WITH f AS (
    SELECT 物料编码, 仓库编码, 批号, 净额 = SUM(净数量) FROM (
        SELECT 物料编码, 仓库编码, 批号, 净数量 = 数量 FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y'
        UNION ALL
        SELECT 物料编码, 仓库编码, 批号, 净数量 = -数量 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
    ) x GROUP BY 物料编码, 仓库编码, 批号
),
k AS (SELECT wzdm, ckdm, lot_no, yl FROM kucun)
SELECT 口径 = '流水有结存无', 键数 = COUNT(*) FROM f WHERE NOT EXISTS (SELECT 1 FROM k k WHERE k.wzdm=f.物料编码 AND k.ckdm=f.仓库编码 AND ISNULL(k.lot_no,'')=ISNULL(f.批号,''))
UNION ALL
SELECT '结存有流水无', COUNT(*) FROM k WHERE NOT EXISTS (SELECT 1 FROM f WHERE k.wzdm=f.物料编码 AND k.ckdm=f.仓库编码 AND ISNULL(k.lot_no,'')=ISNULL(f.批号,''))
UNION ALL
SELECT '两边都有但金额不等(yl <> 净额)', COUNT(*) FROM f JOIN k ON k.wzdm=f.物料编码 AND k.ckdm=f.仓库编码 AND ISNULL(k.lot_no,'')=ISNULL(f.批号,'') WHERE ABS(k.yl - f.净额) > 0.0001
UNION ALL
SELECT '结存-流水 差额合计', CAST(ISNULL(SUM(k.yl),0) - ISNULL((SELECT SUM(净数量) FROM (SELECT 数量 AS 净数量 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') z),0) AS decimal(18,4)) FROM k;

PRINT '===== 3. 流水按 src 汇总 =====';
SELECT 方向='入', src, 行数=COUNT(*), 数量=SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY src
UNION ALL
SELECT 方向='出', src, COUNT(*), SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY src
ORDER BY 1, 2;

PRINT '===== 4. 批号口径分布(负结存里 PC0000 占比) =====';
SELECT 批号口径 = CASE WHEN lot_no IS NULL THEN '(NULL)' WHEN LTRIM(RTRIM(lot_no))='' THEN '(空串)' WHEN lot_no='PC0000' THEN 'PC0000' ELSE '真实批号' END,
       行数 = COUNT(*), 负行数 = SUM(CASE WHEN yl<0 THEN 1 ELSE 0 END), 余量 = SUM(yl)
FROM kucun GROUP BY CASE WHEN lot_no IS NULL THEN '(NULL)' WHEN LTRIM(RTRIM(lot_no))='' THEN '(空串)' WHEN lot_no='PC0000' THEN 'PC0000' ELSE '真实批号' END
ORDER BY 行数 DESC;
