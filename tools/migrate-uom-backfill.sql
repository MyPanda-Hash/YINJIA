-- migrate-uom-backfill.sql — 计量单位存量数据回填(采购链单位断流修复的数据部分)
-- 背景:qc_insp_detail/sl_recv_detail 的"计量单位"列 2026-09-17 才建,存量行为空;
--       审核自动生单(inspAutoPurchaseIn/inspAutoReturn)此前硬编码清单无单位列,
--       已生成的采购入库单/暂收退料单行单位为空。本脚本:
--  ① 暂收/检验明细空单位行 ← 商品档案(bs_inv.计量单位,按物料编码=存货编码)
--  ② 已生成的入库/退料行空单位 ← 检验明细行(form_flow_link 行键关联,单号#行id)
-- 幂等:只填空值,可重跑。
SET NOCOUNT ON;
GO
-- ① 暂收/检验明细 ← 商品档案
UPDATE d SET d.计量单位 = i.计量单位
FROM sl_recv_detail d
JOIN bs_inv i ON i.存货编码 = d.物料编码 AND ISNULL(i.asp_cancel, 'N') <> 'Y'
WHERE ISNULL(d.asp_cancel, 'N') <> 'Y' AND (d.计量单位 IS NULL OR d.计量单位 = '');

UPDATE d SET d.计量单位 = i.计量单位
FROM qc_insp_detail d
JOIN bs_inv i ON i.存货编码 = d.物料编码 AND ISNULL(i.asp_cancel, 'N') <> 'Y'
WHERE ISNULL(d.asp_cancel, 'N') <> 'Y' AND (d.计量单位 IS NULL OR d.计量单位 = '');

-- ② 已生成下游单 ← 检验明细(form_flow_link 行键 = 单号#行表id)
UPDATE t SET t.计量单位 = s.计量单位, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
FROM bl_purchase_in t
JOIN form_flow_link fl ON fl.source_panel_code = 'QC_INSP' AND fl.target_panel_code = 'PURCHASE_IN'
    AND fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
JOIN qc_insp_detail s ON fl.source_line_key = fl.source_form_no + '#' + CAST(s.id AS varchar(30))
WHERE ISNULL(t.asp_cancel, 'N') <> 'Y' AND (t.计量单位 IS NULL OR t.计量单位 = '');

UPDATE t SET t.计量单位 = s.计量单位, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
FROM qc_return_detail t
JOIN form_flow_link fl ON fl.source_panel_code = 'QC_INSP' AND fl.target_panel_code = 'QC_RETURN'
    AND fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
JOIN qc_insp_detail s ON fl.source_line_key = fl.source_form_no + '#' + CAST(s.id AS varchar(30))
WHERE ISNULL(t.asp_cancel, 'N') <> 'Y' AND (t.计量单位 IS NULL OR t.计量单位 = '');
GO
-- 自检:四表单位空行计数(执行后应大幅下降/归零)
SELECT 'sl_recv_detail' AS tbl, COUNT(*) AS rows_total, SUM(CASE WHEN 计量单位 IS NULL OR 计量单位='' THEN 1 ELSE 0 END) AS uom_empty FROM sl_recv_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'qc_insp_detail', COUNT(*), SUM(CASE WHEN 计量单位 IS NULL OR 计量单位='' THEN 1 ELSE 0 END) FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'bl_purchase_in', COUNT(*), SUM(CASE WHEN 计量单位 IS NULL OR 计量单位='' THEN 1 ELSE 0 END) FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'qc_return_detail', COUNT(*), SUM(CASE WHEN 计量单位 IS NULL OR 计量单位='' THEN 1 ELSE 0 END) FROM qc_return_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
PRINT N'migrate-uom-backfill 完成';
GO
