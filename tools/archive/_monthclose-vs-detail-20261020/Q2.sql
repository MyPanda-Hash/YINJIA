SET NOCOUNT ON;
DECLARE @prev nvarchar(7) = LEFT(CONVERT(nvarchar(7), DATEADD(month,-1,GETDATE()), 120), 7);
DECLARE @cur  nvarchar(7) = LEFT(CONVERT(nvarchar(7), GETDATE(), 120), 7);

PRINT N'=== A 结转行少的键,按原因分类 ===';
;WITH k AS (   -- 上月月结算出来的全部键(bl_stock_close)里,没有对应结转行的
  SELECT 物料编码 w, 仓库编码 c, ISNULL(RTRIM(批号),N'') l, 期初数量, 入库数量, 出库数量, 结存数量
  FROM bl_stock_close b WHERE 期间 = @prev
    AND NOT EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=N'JZ-'+REPLACE(@prev,'-','')
       AND ISNULL(RTRIM(i.物料编码),N'')=b.物料编码 AND ISNULL(RTRIM(i.仓库编码),N'')=b.仓库编码
       AND ISNULL(RTRIM(i.批号),N'')=ISNULL(RTRIM(b.批号),N''))
), j AS (
  SELECT k.*,
    (SELECT COUNT(*) FROM inh i WHERE ISNULL(RTRIM(i.物料编码),N'')=k.w AND ISNULL(RTRIM(i.仓库编码),N'')=k.c
       AND ISNULL(RTRIM(i.批号),N'')=k.l AND ISNULL(i.asp_cancel,'N')<>'Y' AND ISNULL(i.单据类型,'')<>N'月结结转') 入库行数,
    (SELECT COUNT(*) FROM outh o WHERE ISNULL(RTRIM(o.物料编码),N'')=k.w AND ISNULL(RTRIM(o.仓库编码),N'')=k.c
       AND ISNULL(RTRIM(o.批号),N'')=k.l AND ISNULL(o.asp_cancel,'N')<>'Y') 出库行数,
    (SELECT COUNT(*) FROM kucun q WHERE q.wzdm=k.w AND ISNULL(RTRIM(q.ckdm),N'')=k.c AND ISNULL(RTRIM(q.lot_no),N'')=k.l) 库存明细行数
  FROM k
)
SELECT CASE WHEN 结存数量 = 0 THEN N'① 结存=0(口径:0 不写结转行)'
            WHEN 入库行数 = 0 AND 出库行数 = 0 THEN N'② 结存≠0 但流水里已无该键(流水被改批号/删除的残影)'
            ELSE N'③ 其它(流水还在,却未生成结转行)' END AS 原因,
       COUNT(*) 键数, SUM(CASE WHEN 结存数量=0 THEN 0 ELSE 结存数量 END) 非零结存合计, SUM(库存明细行数) 对应明细行
FROM j GROUP BY CASE WHEN 结存数量 = 0 THEN N'① 结存=0(口径:0 不写结转行)'
            WHEN 入库行数 = 0 AND 出库行数 = 0 THEN N'② 结存≠0 但流水里已无该键(流水被改批号/删除的残影)'
            ELSE N'③ 其它(流水还在,却未生成结转行)' END;

PRINT N'=== B ③ 的样本(20 条) ===';
;WITH k AS (
  SELECT 物料编码 w, 仓库编码 c, ISNULL(RTRIM(批号),N'') l, 期初数量, 入库数量, 出库数量, 结存数量
  FROM bl_stock_close b WHERE 期间 = @prev
    AND NOT EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=N'JZ-'+REPLACE(@prev,'-','')
       AND ISNULL(RTRIM(i.物料编码),N'')=b.物料编码 AND ISNULL(RTRIM(i.仓库编码),N'')=b.仓库编码
       AND ISNULL(RTRIM(i.批号),N'')=ISNULL(RTRIM(b.批号),N''))
)
SELECT TOP 20 k.*,
  (SELECT COUNT(*) FROM inh i WHERE ISNULL(RTRIM(i.物料编码),N'')=k.w AND ISNULL(RTRIM(i.仓库编码),N'')=k.c
     AND ISNULL(RTRIM(i.批号),N'')=k.l AND ISNULL(i.asp_cancel,'N')<>'Y' AND ISNULL(i.单据类型,'')<>N'月结结转') 入库行数,
  (SELECT COUNT(*) FROM outh o WHERE ISNULL(RTRIM(o.物料编码),N'')=k.w AND ISNULL(RTRIM(o.仓库编码),N'')=k.c
     AND ISNULL(RTRIM(o.批号),N'')=k.l AND ISNULL(o.asp_cancel,'N')<>'Y') 出库行数
FROM k WHERE k.结存数量 <> 0 ORDER BY ABS(k.结存数量) DESC;
