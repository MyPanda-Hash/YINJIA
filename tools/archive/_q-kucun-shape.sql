SET NOCOUNT ON;
PRINT '--- kucun 行分类 ---';
SELECT CASE WHEN ISNULL(rkl,0)=0 AND ISNULL(ckl,0)=0 THEN N'期初/无流水(仅余量)'
            WHEN ISNULL(rkl,0)>0 AND ISNULL(ckl,0)=0 THEN N'只有入库'
            WHEN ISNULL(ckl,0)>0 AND ISNULL(rkl,0)=0 THEN N'只有出库'
            ELSE N'收+发' END AS 类型,
       COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 余量合计
FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY CASE WHEN ISNULL(rkl,0)=0 AND ISNULL(ckl,0)=0 THEN N'期初/无流水(仅余量)'
            WHEN ISNULL(rkl,0)>0 AND ISNULL(ckl,0)=0 THEN N'只有入库'
            WHEN ISNULL(ckl,0)>0 AND ISNULL(rkl,0)=0 THEN N'只有出库'
            ELSE N'收+发' END;
PRINT '--- 期初(仅余量)明细 ---';
SELECT wzdm, ckdm, lot_no, yl, price, CONVERT(varchar(19),asp_time1,120) AS 建行时间 FROM kucun WHERE ISNULL(rkl,0)=0 AND ISNULL(ckl,0)=0 AND ISNULL(yl,0)<>0 AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY yl DESC;
PRINT '--- 金蝶同步单(TCGRK/TXSCK 等)是否進 kucun ---';
SELECT COUNT(*) AS kucun中TL批号行 FROM kucun WHERE lot_no LIKE 'TL%';
