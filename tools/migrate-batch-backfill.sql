-- migrate-batch-backfill.sql — 存量数据回填:批次号 + 批次台账(P0)
-- 方案:docs/方案-采购订单分批送料与批次号.md
--   现网存量:PU_ORDER→SL_RECV 已有 ACTIVE 占用(每张暂收单把来源行整行量记成占用),但没有批次标识。
--   回填口径(用户决策):**一张暂收单 = 一个批次**;序号按该订单下暂收单的创建时间排序(1,2,3…),
--   批次号 = 采购订单号 + '-' + 3位序号;再沿链路把批次号下传到 来料检验单 / 采购入库单 / 暂收退回单
--   (头 + 行 + form_flow_link.batch_no 三处都写,保证按批次可反查四单)。
--   存量 linked_quantity 保持原值(本来就是整行占用),不伪造历史数量。
-- 幂等:台账 NOT EXISTS + 只回填"批次号为空"的目标行。可重复执行。
SET NOCOUNT ON;

-- ══════════ 1. 采购订单 → 送料暂收单:映射(每张暂收单一个批次) ══════════
IF OBJECT_ID('tempdb..#bm') IS NOT NULL DROP TABLE #bm;
SELECT l.source_panel_code, l.source_form_no, l.target_panel_code, l.target_form_no,
       ROW_NUMBER() OVER (PARTITION BY l.source_form_no ORDER BY MIN(l.create_time), l.target_form_no) AS seq,
       SUM(COALESCE(l.linked_quantity, 0)) AS qty
INTO #bm
FROM form_flow_link l
WHERE l.link_status = 'ACTIVE' AND l.source_panel_code = 'PU_ORDER' AND l.target_panel_code = 'SL_RECV'
GROUP BY l.source_panel_code, l.source_form_no, l.target_panel_code, l.target_form_no;

ALTER TABLE #bm ADD batch_no nvarchar(50) NULL;
UPDATE #bm SET batch_no = LEFT(source_form_no, 40) + '-' + RIGHT('000' + CAST(seq AS varchar(3)), 3);
GO

-- ══════════ 2. 批次台账 ══════════
INSERT INTO yj_doc_batch (source_panel_code, source_form_no, batch_seq, batch_no, batch_qty, status,
                          target_panel_code, target_form_no, create_by, create_time, remark)
SELECT m.source_panel_code, m.source_form_no, m.seq, m.batch_no, m.qty, N'ACTIVE',
       m.target_panel_code, m.target_form_no, N'system-migrate', SYSDATETIME(), N'存量回填:一张暂收单=一个批次'
FROM #bm m
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_batch b
                  WHERE b.source_panel_code = m.source_panel_code AND b.source_form_no = m.source_form_no AND b.batch_seq = m.seq);
GO

-- ══════════ 3. 暂收单(头+行)+ link 写批次号 ══════════
UPDATE s SET s.批次号 = m.batch_no
FROM sl_recv s JOIN #bm m ON m.target_form_no = s.单据编号
WHERE ISNULL(s.批次号, '') = '';
GO
UPDATE d SET d.批次号 = m.batch_no
FROM sl_recv_detail d JOIN #bm m ON m.target_form_no = d.单据编号
WHERE ISNULL(d.批次号, '') = '';
GO
UPDATE l SET l.batch_no = m.batch_no
FROM form_flow_link l JOIN #bm m ON m.target_form_no = l.target_form_no
WHERE l.link_status='ACTIVE' AND l.source_panel_code='PU_ORDER' AND l.target_panel_code='SL_RECV'
  AND ISNULL(l.batch_no,'') = '';
GO

-- ══════════ 4. 暂收单 → 来料检验单 ══════════
-- 检验单批次号 = 其来源暂收单的批次号(link SL_RECV→QC_INSP,source_form_no=暂收单号)
UPDATE i SET i.批次号 = s.批次号
FROM qc_insp i
JOIN form_flow_link l ON l.link_status='ACTIVE' AND l.source_panel_code='SL_RECV' AND l.target_panel_code='QC_INSP' AND l.target_form_no = i.单据编号
JOIN sl_recv s ON s.单据编号 = l.source_form_no
WHERE ISNULL(i.批次号,'') = '' AND ISNULL(s.批次号,'') <> '';
GO
UPDATE d SET d.批次号 = i.批次号
FROM qc_insp_detail d JOIN qc_insp i ON i.单据编号 = d.单据编号
WHERE ISNULL(d.批次号,'') = '' AND ISNULL(i.批次号,'') <> '';
GO
UPDATE l SET l.batch_no = s.批次号
FROM form_flow_link l JOIN sl_recv s ON s.单据编号 = l.source_form_no
WHERE l.link_status='ACTIVE' AND l.source_panel_code='SL_RECV' AND l.target_panel_code='QC_INSP'
  AND ISNULL(l.batch_no,'') = '' AND ISNULL(s.批次号,'') <> '';
GO

-- ══════════ 5. 来料检验单 → 采购入库单 / 暂收退回单 ══════════
UPDATE p SET p.批次号 = i.批次号
FROM bd_purchase_in p
JOIN form_flow_link l ON l.link_status='ACTIVE' AND l.source_panel_code='QC_INSP' AND l.target_panel_code='PURCHASE_IN' AND l.target_form_no = p.单据编号
JOIN qc_insp i ON i.单据编号 = l.source_form_no
WHERE ISNULL(p.批次号,'') = '' AND ISNULL(i.批次号,'') <> '';
GO
UPDATE d SET d.批次号 = p.批次号
FROM bl_purchase_in d JOIN bd_purchase_in p ON p.单据编号 = d.单据编号
WHERE ISNULL(d.批次号,'') = '' AND ISNULL(p.批次号,'') <> '';
GO
UPDATE l SET l.batch_no = i.批次号
FROM form_flow_link l JOIN qc_insp i ON i.单据编号 = l.source_form_no
WHERE l.link_status='ACTIVE' AND l.source_panel_code='QC_INSP' AND l.target_panel_code='PURCHASE_IN'
  AND ISNULL(l.batch_no,'') = '' AND ISNULL(i.批次号,'') <> '';
GO
UPDATE r SET r.批次号 = i.批次号
FROM qc_return r
JOIN form_flow_link l ON l.link_status='ACTIVE' AND l.source_panel_code='QC_INSP' AND l.target_panel_code='QC_RETURN' AND l.target_form_no = r.单据编号
JOIN qc_insp i ON i.单据编号 = l.source_form_no
WHERE ISNULL(r.批次号,'') = '' AND ISNULL(i.批次号,'') <> '';
GO
UPDATE d SET d.批次号 = r.批次号
FROM qc_return_detail d JOIN qc_return r ON r.单据编号 = d.单据编号
WHERE ISNULL(d.批次号,'') = '' AND ISNULL(r.批次号,'') <> '';
GO
UPDATE l SET l.batch_no = i.批次号
FROM form_flow_link l JOIN qc_insp i ON i.单据编号 = l.source_form_no
WHERE l.link_status='ACTIVE' AND l.source_panel_code='QC_INSP' AND l.target_panel_code='QC_RETURN'
  AND ISNULL(l.batch_no,'') = '' AND ISNULL(i.批次号,'') <> '';
GO

-- ══════════ 6. 自检:回填覆盖情况 ══════════
SELECT
  (SELECT COUNT(*) FROM yj_doc_batch) AS 批次台账行数,
  (SELECT COUNT(*) FROM sl_recv WHERE ISNULL(批次号,'')<>'') AS 暂收单有批次,
  (SELECT COUNT(*) FROM qc_insp WHERE ISNULL(批次号,'')<>'') AS 检验单有批次,
  (SELECT COUNT(*) FROM bd_purchase_in WHERE ISNULL(批次号,'')<>'') AS 入库单有批次,
  (SELECT COUNT(*) FROM qc_return WHERE ISNULL(批次号,'')<>'') AS 退回单有批次,
  (SELECT COUNT(*) FROM form_flow_link WHERE link_status='ACTIVE' AND ISNULL(batch_no,'')<>'') AS link有批次;
GO

-- ══════════ 7. 自检:批次量 vs 订单量(超出清单 = 存量脏数据/手工单,需人工核对) ══════════
SELECT b.source_form_no AS 采购订单号,
       SUM(b.batch_qty) AS 批次送料合计,
       (SELECT SUM(CAST(o.数量 AS decimal(18,4))) FROM bl_pu_order o WHERE o.单据编号 = b.source_form_no AND ISNULL(o.asp_cancel,'N')<>'Y') AS 订单数量合计,
       COUNT(*) AS 批次数
FROM yj_doc_batch b
GROUP BY b.source_form_no
HAVING SUM(b.batch_qty) > ISNULL((SELECT SUM(CAST(o.数量 AS decimal(18,4))) FROM bl_pu_order o WHERE o.单据编号 = b.source_form_no AND ISNULL(o.asp_cancel,'N')<>'Y'), 0) + 0.0001;
GO
PRINT N'migrate-batch-backfill 完成:存量按「一张暂收单=一个批次」回填批次号,并沿链路下传检验/入库/退回';
GO
