SET NOCOUNT ON;
DECLARE @c TABLE(id int, pl_no nvarchar(56));
INSERT @c SELECT p.id,p.pl_no FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
SELECT COUNT(*) 九月行, SUM(CASE WHEN pl_no LIKE N'GD-2026-10-%' THEN 1 ELSE 0 END) 十月号形态,
       SUM(CASE WHEN pl_no NOT LIKE N'GD-2026-10-%' THEN 1 ELSE 0 END) 其它形态
FROM @c;
SELECT TOP 5 pl_no FROM @c WHERE pl_no NOT LIKE N'GD-2026-10-%';
SELECT COUNT(*) AS 新号已存在于号池 FROM dbo.s_allno a WHERE a.dh IN (
  SELECT N'GD-2026-09-' + RIGHT(pl_no,4) FROM @c WHERE pl_no LIKE N'GD-2026-10-%');
SELECT COUNT(*) AS 材料出库头301中两列都等于旧号
FROM dbo.bd_material_out d JOIN dbo.plang p ON p.pl_no=d.[加工单号]
WHERE ISNULL(d.[加工单号],N'')=ISNULL(d.[来源单号],N'') AND ISNULL(p.asp_cancel,'N')<>'Y'
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
GO
