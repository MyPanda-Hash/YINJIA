SET NOCOUNT ON;
PRINT '=== 3. kucun 是否有重复行(同物料+仓库+批号出现多行) ===';
SELECT COUNT(*) 重复键数 FROM (
  SELECT wzdm, ISNULL(RTRIM(ckdm),N'') c, ISNULL(RTRIM(lot_no),N'') l FROM kucun
  GROUP BY wzdm, ISNULL(RTRIM(ckdm),N''), ISNULL(RTRIM(lot_no),N'') HAVING COUNT(*) > 1
) t;
PRINT '=== 4. 流水是否有重复行(同单据+物料+批号+仓库出现多次) ===';
SELECT 'inh' t, COUNT(*) 重复组 FROM (
  SELECT 单据编号, 物料编码, ISNULL(RTRIM(批号),N'') l, 仓库编码 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
  GROUP BY 单据编号,物料编码,ISNULL(RTRIM(批号),N''),仓库编码 HAVING COUNT(*)>1) x
UNION ALL
SELECT 'outh', COUNT(*) FROM (
  SELECT 单据编号, 物料编码, ISNULL(RTRIM(批号),N'') l, 仓库编码 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
  GROUP BY 单据编号,物料编码,ISNULL(RTRIM(批号),N''),仓库编码 HAVING COUNT(*)>1) y;
PRINT '=== 5. 金蝶调拨单单据数 vs 流水腿数(应 1:2) ===';
SELECT (SELECT COUNT(*) FROM bd_transfer WHERE 单据编号 LIKE 'YCD%') 单据,
       (SELECT COUNT(DISTINCT 单据编号) FROM inh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') inh单数,
       (SELECT COUNT(DISTINCT 单据编号) FROM outh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') outh单数;
