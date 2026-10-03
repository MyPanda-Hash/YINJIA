SET NOCOUNT ON;
-- 诊断:历史单据(采购入库/销售出库)净额 vs kucun 余量
-- 目的:判断期初(src=0,取 kucun 现值)是否**已经包含**这些历史单据 —— 若是,补历史流水就会双计
;WITH hist AS (
  SELECT 仓库编码, 存货编码, SUM(入) AS 入, SUM(出) AS 出
  FROM (
    SELECT CAST(l.仓库编码 AS nvarchar(200)) AS 仓库编码, CAST(l.存货编码 AS nvarchar(200)) AS 存货编码,
           CAST(l.实收数量 AS decimal(18,4)) AS 入, CAST(0 AS decimal(18,4)) AS 出
      FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
     WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
       AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
            OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='PURCHASE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
    UNION ALL
    SELECT CAST(l.仓库编码 AS nvarchar(200)), CAST(l.存货编码 AS nvarchar(200)),
           CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4))
      FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
     WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
       AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
            OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='SALE_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
  ) x
  GROUP BY 仓库编码, 存货编码
)
SELECT (SELECT COUNT(*) FROM hist) AS 历史键数,
       (SELECT CAST(SUM(入) AS decimal(18,4)) FROM hist) AS 历史入合计,
       (SELECT CAST(SUM(出) AS decimal(18,4)) FROM hist) AS 历史出合计,
       (SELECT CAST(SUM(入-出) AS decimal(18,4)) FROM hist) AS 历史净额,
       (SELECT CAST(SUM(yl) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun余量合计;
GO
-- 逐键对比:历史净额 vs kucun.yl(按 仓库编码+存货编码)
;WITH hist AS (
  SELECT 仓库编码, 存货编码, SUM(入) AS 入, SUM(出) AS 出
  FROM (
    SELECT CAST(l.仓库编码 AS nvarchar(200)) AS 仓库编码, CAST(l.存货编码 AS nvarchar(200)) AS 存货编码,
           CAST(l.实收数量 AS decimal(18,4)) AS 入, CAST(0 AS decimal(18,4)) AS 出
      FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
     WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
       AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
            OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='PURCHASE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
    UNION ALL
    SELECT CAST(l.仓库编码 AS nvarchar(200)), CAST(l.存货编码 AS nvarchar(200)),
           CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4))
      FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
     WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
       AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
            OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='SALE_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
  ) x
  GROUP BY 仓库编码, 存货编码
),
kc AS (
  SELECT CAST(ckdm AS nvarchar(200)) AS 仓库编码, CAST(wzdm AS nvarchar(200)) AS 存货编码,
         CAST(SUM(yl) AS decimal(18,4)) AS 余量
    FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ckdm, wzdm
)
SELECT '历史有/kucun有' AS 情形, COUNT(*) AS 键数 FROM hist h JOIN kc ON kc.仓库编码=h.仓库编码 AND kc.存货编码=h.存货编码
UNION ALL
SELECT '仅历史有(kucun无该键)', COUNT(*) FROM hist h WHERE NOT EXISTS (SELECT 1 FROM kc WHERE kc.仓库编码=h.仓库编码 AND kc.存货编码=h.存货编码)
UNION ALL
SELECT '仅kucun有(历史无该键)', COUNT(*) FROM kc WHERE NOT EXISTS (SELECT 1 FROM hist h WHERE h.仓库编码=kc.仓库编码 AND h.存货编码=kc.存货编码);
GO
-- 历史明细取样(前 12 行,看键是否与 kucun 同口径)
SELECT TOP 12 l.单据编号, l.仓库编码, l.仓库, l.存货编码, l.存货名称, CAST(l.实收数量 AS decimal(18,4)) AS 实收数量, h.单据日期, h.单据状态
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
 ORDER BY h.单据日期 DESC;
GO
SELECT TOP 12 l.单据编号, l.仓库编码, l.仓库, l.存货编码, l.存货名称, CAST(l.数量 AS decimal(18,4)) AS 数量, h.单据日期, h.单据状态
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
 ORDER BY h.单据日期 DESC;
GO
