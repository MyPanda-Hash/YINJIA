SET NOCOUNT ON;
-- 稽核:PU_ORDER→QC_RECV 的 ACTIVE 占用 vs 暂收单行实际数量
WITH l AS (
  SELECT f.id, f.source_form_no, f.target_form_no, f.target_line_key, f.linked_quantity,
         TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int) AS rid
    FROM form_flow_link f
   WHERE f.target_panel_code = 'QC_RECV' AND f.link_status = 'ACTIVE'
)
SELECT COUNT(*) AS 占用行数,
       SUM(CASE WHEN d.id IS NULL THEN 1 ELSE 0 END) AS 找不到行,
       SUM(CASE WHEN d.id IS NOT NULL AND ABS(ISNULL(l.linked_quantity,0) - ISNULL(d.数量,0)) > 0.00005 THEN 1 ELSE 0 END) AS 数量不一致,
       SUM(CASE WHEN d.id IS NOT NULL AND ABS(ISNULL(l.linked_quantity,0) - ISNULL(d.数量,0)) > 0.00005
                THEN ISNULL(l.linked_quantity,0) - ISNULL(d.数量,0) ELSE 0 END) AS 差额合计
  FROM l LEFT JOIN sl_recv_detail d ON d.id = l.rid;
-- 前十笔不一致(带单据)
WITH l AS (
  SELECT f.id, f.source_form_no, f.target_form_no, f.target_line_key, f.linked_quantity,
         TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int) AS rid
    FROM form_flow_link f WHERE f.target_panel_code = 'QC_RECV' AND f.link_status = 'ACTIVE'
)
SELECT TOP 10 l.target_form_no AS 暂收单, l.source_form_no AS 订单, d.物料编码, d.数量 AS 实际数量,
       l.linked_quantity AS 占用数量, l.linked_quantity - d.数量 AS 差额
  FROM l JOIN sl_recv_detail d ON d.id = l.rid
 WHERE ABS(ISNULL(l.linked_quantity,0) - ISNULL(d.数量,0)) > 0.00005
 ORDER BY ABS(l.linked_quantity - d.数量) DESC;
