SET NOCOUNT ON;
-- ④-a 已审核行没有流水的明细画像(按单据日期/单号前缀/审批留痕)
;WITH miss AS (
  SELECT rid = l.id, 单号 = l.单据编号, 单据日期 = h.单据日期, 物料 = l.产品编码, 数量 = l.实收数量
  FROM bl_finish_in l JOIN bd_finish_in h ON h.单据编号 = l.单据编号
  WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND h.单据状态 = N'已审核'
    AND NOT EXISTS (SELECT 1 FROM inh f WHERE f.src = 2 AND f.rid = l.id AND ISNULL(f.asp_cancel,'N') <> 'Y'))
SELECT TOP 15 * FROM miss ORDER BY 单据日期 DESC;

SELECT 产成品入库 = '缺流水的已审核行', 行数 = COUNT(*), 单数 = COUNT(DISTINCT 单号), 数量合计 = SUM(数量),
       最早 = MIN(单据日期), 最晚 = MAX(单据日期)
FROM (SELECT l.id, l.单据编号 AS 单号, h.单据日期, l.实收数量 AS 数量
      FROM bl_finish_in l JOIN bd_finish_in h ON h.单据编号 = l.单据编号
      WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND h.单据状态 = N'已审核'
        AND NOT EXISTS (SELECT 1 FROM inh f WHERE f.src = 2 AND f.rid = l.id AND ISNULL(f.asp_cancel,'N') <> 'Y')) x;

-- ④-b 材料出库同口径
SELECT 材料出库 = '缺流水的已审核行', 行数 = COUNT(*), 单数 = COUNT(DISTINCT 单号), 数量合计 = SUM(数量),
       最早 = MIN(单据日期), 最晚 = MAX(单据日期)
FROM (SELECT l.id, l.单据编号 AS 单号, h.单据日期, l.数量
      FROM bl_material_out l JOIN bd_material_out h ON h.单据编号 = l.单据编号
      WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND h.单据状态 = N'已审核'
        AND NOT EXISTS (SELECT 1 FROM outh f WHERE f.src = 6 AND f.rid = l.id AND ISNULL(f.asp_cancel,'N') <> 'Y')) x;

SELECT TOP 10 单号 = x.单号, 单据日期 = x.单据日期, 行数 = x.n
FROM (SELECT l.单据编号 AS 单号, h.单据日期, COUNT(*) AS n
      FROM bl_material_out l JOIN bd_material_out h ON h.单据编号 = l.单据编号
      WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND h.单据状态 = N'已审核'
        AND NOT EXISTS (SELECT 1 FROM outh f WHERE f.src = 6 AND f.rid = l.id AND ISNULL(f.asp_cancel,'N') <> 'Y')
      GROUP BY l.单据编号, h.单据日期) x ORDER BY x.单据日期 DESC;

-- ④-c 这些单单头是不是真审过(审批留痕)
SELECT 材料出库缺流水单 = COUNT(*), 有shr留痕 = SUM(CASE WHEN st.shr IS NOT NULL THEN 1 ELSE 0 END)
FROM (SELECT DISTINCT l.单据编号 FROM bl_material_out l JOIN bd_material_out h ON h.单据编号 = l.单据编号
      WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND h.单据状态 = N'已审核'
        AND NOT EXISTS (SELECT 1 FROM outh f WHERE f.src = 6 AND f.rid = l.id AND ISNULL(f.asp_cancel,'N') <> 'Y')) d
LEFT JOIN yj_doc_status st ON st.panel_code = 'MATERIAL_OUT' AND st.doc_no = d.单据编号;
