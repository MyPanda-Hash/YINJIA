-- 只读:待并单体检(今天因旧规则拆出来的工单)
WITH g AS (
  SELECT p.od_no AS 销售订单, p.pl_no, MIN(p.id) AS 首行id, COUNT(*) AS 行数,
         SUM(ISNULL(p.pl_sl,0)) AS 转单量, SUM(ISNULL(p.rk_sl,0)) AS 入库量,
         SUM(CASE WHEN ISNULL(p.ja,'N')='Y' THEN 1 ELSE 0 END) AS 已结案行,
         SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' THEN 1 ELSE 0 END) AS 已排产行,
         SUM(CASE WHEN ISNULL(p.ll_no2,N'')<>N'' THEN 1 ELSE 0 END) AS 有领料行,
         (SELECT COUNT(*) FROM dbo.plang_pc pc JOIN dbo.plang x ON x.id=pc.plang_id WHERE x.pl_no=p.pl_no) AS 排产记录,
         (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=p.pl_no) AS 报工记录,
         STUFF((SELECT N',' + CAST(x.pl_xc AS nvarchar(10)) FROM dbo.plang x WHERE x.pl_no=p.pl_no AND ISNULL(x.asp_cancel,'N')<>'Y' ORDER BY x.pl_xc FOR XML PATH('')),1,1,N'') AS 行号
  FROM dbo.plang p
  WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.od_no,N'')<>N'' AND ISNULL(p.[是否切单],'N')<>'Y'
    AND p.asp_time1 >= CONVERT(datetime,'2026-11-11',120)
  GROUP BY p.od_no, p.pl_no
)
SELECT 销售订单, pl_no AS 工单号, 首行id, 行数, 行号, 转单量, 已排产行, 排产记录, 报工记录, 入库量, 有领料行, 已结案行,
       CASE WHEN 已排产行=0 AND 排产记录=0 AND 报工记录=0 AND 入库量=0 AND 有领料行=0 AND 已结案行=0
            THEN N'可安全并入' ELSE N'有下游,需人工确认' END AS 体检
FROM g
WHERE 销售订单 IN (SELECT 销售订单 FROM g GROUP BY 销售订单 HAVING COUNT(*)>1)
ORDER BY 销售订单, 首行id;
GO
