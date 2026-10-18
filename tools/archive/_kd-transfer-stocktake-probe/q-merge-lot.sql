SET NOCOUNT ON;
BEGIN TRAN;
DECLARE @before int = (SELECT COUNT(*) FROM kucun);
DECLARE @beforeQty float = (SELECT SUM(yl) FROM kucun);
DECLARE @pc int = (SELECT COUNT(*) FROM kucun WHERE lot_no='PC0000');

-- ① 无冲突的 PC0000 行:直接改批号为 NULL
UPDATE k SET lot_no = NULL
FROM kucun k
WHERE k.lot_no='PC0000'
  AND NOT EXISTS (SELECT 1 FROM kucun n WHERE n.wzdm=k.wzdm AND n.ckdm=k.ckdm AND n.lot_no IS NULL AND n.id<>k.id);

-- ② 有冲突的:把 PC0000 行的量累加到 NULL 行
UPDATE n SET n.yl = ISNULL(n.yl,0)+ISNULL(p.yl,0), n.rkl = ISNULL(n.rkl,0)+ISNULL(p.rkl,0), n.ckl = ISNULL(n.ckl,0)+ISNULL(p.ckl,0)
FROM kucun n
JOIN (SELECT wzdm, ckdm, SUM(yl) yl, SUM(rkl) rkl, SUM(ckl) ckl FROM kucun WHERE lot_no='PC0000' GROUP BY wzdm, ckdm) p
  ON p.wzdm=n.wzdm AND p.ckdm=n.ckdm
WHERE n.lot_no IS NULL;

-- ③ 删掉已被合并的 PC0000 行
DELETE FROM kucun WHERE lot_no='PC0000';

SELECT @before 前行数, (SELECT COUNT(*) FROM kucun) 后行数, @beforeQty 前合计, (SELECT SUM(yl) FROM kucun) 后合计, @pc PC0000行数;
COMMIT;
