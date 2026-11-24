SET NOCOUNT ON;
SELECT d.id, d.单据编号, d.物料编码, d.数量, f.id AS linkId, f.linked_quantity, f.source_form_no, f.batch_id
  FROM form_flow_link f
  JOIN sl_recv_detail d ON d.id = TRY_CAST(RIGHT(f.target_line_key, CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)
 WHERE f.target_panel_code='QC_RECV' AND f.link_status='ACTIVE' AND f.target_form_no='SL-2026-11-0002';
SELECT 单据编号, 单据日期, 供应商, 批次号 FROM sl_recv WHERE 单据编号='SL-2026-11-0002';
