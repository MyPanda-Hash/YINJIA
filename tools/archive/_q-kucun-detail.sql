SET NOCOUNT ON;
SELECT '--- kucun 全部行 ---' AS x;
SELECT id, ckdm AS 仓库编码, wzdm AS 物料编码, lot_no AS 批号, CAST(yl AS decimal(18,4)) AS 余量,
       CAST(price AS decimal(18,6)) AS 单价, asp_cancel
  FROM kucun ORDER BY ckdm, wzdm;
GO
SELECT '--- 期初流水(src=0)全部行 ---' AS x;
SELECT id, src, rid, 单据编号, 单据日期, 仓库编码, 仓库, 存货编码, 存货, 批号,
       CAST(数量 AS decimal(18,4)) AS 数量
  FROM inh WHERE src = 0 ORDER BY id;
GO
SELECT '--- 已审核的采购入库(全部) ---' AS x;
SELECT l.单据编号, l.仓库编码, l.仓库, l.存货编码, l.存货名称, CAST(l.实收数量 AS decimal(18,4)) AS 实收数量, h.单据日期, h.单据状态
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
   AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
        OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='PURCHASE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
 ORDER BY h.单据日期;
GO
SELECT '--- 销售出库按 仓库/存货 汇总 ---' AS x;
SELECT l.仓库编码, l.存货编码, COUNT(*) AS 行数, CAST(SUM(l.数量) AS decimal(18,4)) AS 数量合计
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
   AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C'
        OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='SALE_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))
 GROUP BY l.仓库编码, l.存货编码 ORDER BY 数量合计 DESC;
GO
