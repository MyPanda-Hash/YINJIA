SET NOCOUNT ON;
SELECT id, pl_no, pl_xc, CONVERT(varchar(19),pl_date,120) 单据日期, CONVERT(varchar(19),asp_time1,120) 转单时间,
       ISNULL([批次号],N'') 批次号, CONVERT(varchar(8),DATEADD(day,3,CAST(pl_date AS date)),112) 应得批次
FROM dbo.plang WHERE id IN (403,404) ORDER BY id;
GO
SELECT COUNT(*) AS 已结案集合内_旧批号仍存在 FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN ('T','Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND ISNULL(p.[批次号],N'')='20261014'
  AND ISNULL(p.[批次号],N'') <> CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112);
GO
