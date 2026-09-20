-- migrate-uom-backfill-v2.sql — 计量单位存量回填第二批(沿 form_flow_link 占用链逐级下带)
-- 背景:v1 按 bs_inv 档案回填,但业务行物料(YJ-*)是金蝶侧商品、不在 39 行手工档内;
--       采购订单行(bl_pu_order.单位)由金蝶同步全量有值——正确回填源是单据链本身:
--       采购订单行(单位) → 暂收行 → 检验行 → 入库行/退料行,沿 form_flow_link 行键(单号#行id)。
-- 幂等:只填空值,可重跑;与 v1 互补(v1 已按档案填掉的行不再动)。
SET NOCOUNT ON;
GO
-- 暂收行 ← 采购订单行(单位)
UPDATE t SET t.计量单位 = s.单位, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
FROM sl_recv_detail t
JOIN form_flow_link fl ON fl.source_panel_code = 'PU_ORDER' AND fl.target_panel_code = 'SL_RECV'
    AND fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
JOIN bl_pu_order s ON fl.source_line_key = fl.source_form_no + '#' + CAST(s.id AS varchar(30))
WHERE ISNULL(t.asp_cancel, 'N') <> 'Y' AND (t.计量单位 IS NULL OR t.计量单位 = '');

-- 检验行 ← 暂收行
UPDATE t SET t.计量单位 = s.计量单位, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
FROM qc_insp_detail t
JOIN form_flow_link fl ON fl.source_panel_code = 'SL_RECV' AND fl.target_panel_code = 'QC_INSP'
    AND fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
JOIN sl_recv_detail s ON fl.source_line_key = fl.source_form_no + '#' + CAST(s.id AS varchar(30))
WHERE ISNULL(t.asp_cancel, 'N') <> 'Y' AND (t.计量单位 IS NULL OR t.计量单位 = '');

-- 入库行 ← 检验行
UPDATE t SET t.计量单位 = s.计量单位, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
FROM bl_purchase_in t
JOIN form_flow_link fl ON fl.source_panel_code = 'QC_INSP' AND fl.target_panel_code = 'PURCHASE_IN'
    AND fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
JOIN qc_insp_detail s ON fl.source_line_key = fl.source_form_no + '#' + CAST(s.id AS varchar(30))
WHERE ISNULL(t.asp_cancel, 'N') <> 'Y' AND (t.计量单位 IS NULL OR t.计量单位 = '');

-- 退料行 ← 检验行
UPDATE t SET t.计量单位 = s.计量单位, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
FROM qc_return_detail t
JOIN form_flow_link fl ON fl.source_panel_code = 'QC_INSP' AND fl.target_panel_code = 'QC_RETURN'
    AND fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
JOIN qc_insp_detail s ON fl.source_line_key = fl.source_form_no + '#' + CAST(s.id AS varchar(30))
WHERE ISNULL(t.asp_cancel, 'N') <> 'Y' AND (t.计量单位 IS NULL OR t.计量单位 = '');

-- ③ 链路孤儿行借值:上游采购订单行已删(YJ-20260916-03#4458/4459 物理不存在)导致无源,
--    按同物料在采购订单中最近有单位的行借值(如 YJ-HDN-001←同单据其它行 kg)
UPDATE d SET d.计量单位 = i.单位, d.asp_user2 = N'migration', d.asp_time2 = GETDATE()
FROM sl_recv_detail d
CROSS APPLY (SELECT TOP 1 单位 FROM bl_pu_order p
             WHERE p.物料编码 = d.物料编码 AND ISNULL(p.单位, '') <> ''
             ORDER BY p.id DESC) i
WHERE ISNULL(d.asp_cancel, 'N') <> 'Y' AND (d.计量单位 IS NULL OR d.计量单位 = '');

UPDATE d SET d.计量单位 = i.单位, d.asp_user2 = N'migration', d.asp_time2 = GETDATE()
FROM qc_insp_detail d
CROSS APPLY (SELECT TOP 1 单位 FROM bl_pu_order p
             WHERE p.物料编码 = d.物料编码 AND ISNULL(p.单位, '') <> ''
             ORDER BY p.id DESC) i
WHERE ISNULL(d.asp_cancel, 'N') <> 'Y' AND (d.计量单位 IS NULL OR d.计量单位 = '');

-- ④ 错位行纠正:检验生成的入库/退料行,单位以检验行为准(此前值非链路来源,如"件/升"与检验"个/次/米"不符)
UPDATE t SET t.计量单位 = s.计量单位, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
FROM bl_purchase_in t
JOIN form_flow_link fl ON fl.source_panel_code = 'QC_INSP' AND fl.target_panel_code = 'PURCHASE_IN'
    AND fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
JOIN qc_insp_detail s ON fl.source_line_key = fl.source_form_no + '#' + CAST(s.id AS varchar(30))
WHERE ISNULL(t.asp_cancel, 'N') <> 'Y' AND ISNULL(s.计量单位, '') <> '' AND ISNULL(t.计量单位, '') <> s.计量单位;

UPDATE t SET t.计量单位 = s.计量单位, t.asp_user2 = N'migration', t.asp_time2 = GETDATE()
FROM qc_return_detail t
JOIN form_flow_link fl ON fl.source_panel_code = 'QC_INSP' AND fl.target_panel_code = 'QC_RETURN'
    AND fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
JOIN qc_insp_detail s ON fl.source_line_key = fl.source_form_no + '#' + CAST(s.id AS varchar(30))
WHERE ISNULL(t.asp_cancel, 'N') <> 'Y' AND ISNULL(s.计量单位, '') <> '' AND ISNULL(t.计量单位, '') <> s.计量单位;

-- ⑤ 测试残留清理:IJ-2026-09-0004(已删测试单)的 TEST-1 行未随单软删
UPDATE qc_insp_detail SET asp_cancel = 'Y', asp_user2 = N'migration', asp_time2 = GETDATE()
WHERE 物料编码 = 'TEST-1' AND ISNULL(asp_cancel, 'N') <> 'Y';
GO
-- 自检:四表空单位计数(应归零或仅剩无链路可溯的手工行)
SELECT 'sl_recv_detail' AS tbl, COUNT(*) AS rows_total, SUM(CASE WHEN 计量单位 IS NULL OR 计量单位='' THEN 1 ELSE 0 END) AS uom_empty FROM sl_recv_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'qc_insp_detail', COUNT(*), SUM(CASE WHEN 计量单位 IS NULL OR 计量单位='' THEN 1 ELSE 0 END) FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'bl_purchase_in', COUNT(*), SUM(CASE WHEN 计量单位 IS NULL OR 计量单位='' THEN 1 ELSE 0 END) FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'qc_return_detail', COUNT(*), SUM(CASE WHEN 计量单位 IS NULL OR 计量单位='' THEN 1 ELSE 0 END) FROM qc_return_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
-- 抽样:检验→入库 全链单位可见
SELECT TOP 5 s.单据编号 AS 检验单, s.物料编码, s.计量单位 AS 检验单位, fl.target_form_no AS 入库单, t.计量单位 AS 入库单位
FROM qc_insp_detail s
JOIN form_flow_link fl ON fl.source_panel_code='QC_INSP' AND fl.target_panel_code='PURCHASE_IN'
    AND fl.source_line_key = s.单据编号 + '#' + CAST(s.id AS varchar(30))
JOIN bl_purchase_in t ON fl.target_line_key = t.单据编号 + '#' + CAST(t.id AS varchar(30))
WHERE ISNULL(s.asp_cancel,'N')<>'Y';
GO
PRINT N'migrate-uom-backfill-v2 完成';
GO
