SET NOCOUNT ON;
-- 本轮验证(2026-09-21)造出的测试数据盘点 —— 供部署前 migrate-golive-cleanup 使用
-- 注意:SQL Server 不允许 SUM(CASE WHEN ... EXISTS(子查询) ...) —— 作废态先在派生表里 LEFT JOIN 出来再聚合

-- 1) 今日台账行汇总(批次键/批次号按口径不回收,台账行留证)
SELECT N'1-今日台账行汇总' AS 段, COUNT(*) AS 今日台账行,
       SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS 待编号,
       SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS 已编号,
       SUM(CASE WHEN status = 'RELEASED' THEN 1 ELSE 0 END) AS 已释放,
       MIN(id) AS 最小批次键, MAX(id) AS 最大批次键
FROM yj_doc_batch WHERE create_time >= CONVERT(date, GETDATE());

-- 2) 本次收尾会话(17:48 起,批次键 >= 73)造的单/被作废的单 —— 唯一归属明确的一批
SELECT N'2-本次会话台账行' AS 段, id AS 批次键, source_form_no AS 采购订单, batch_no AS 批次号,
       status, target_panel_code AS 去向面板, target_form_no AS 去向单号,
       CONVERT(varchar(19), create_time, 120) AS 送料时间
FROM yj_doc_batch WHERE id >= 73 ORDER BY id;

-- 3) 今日各环节单据(测试造单:绝大多数已作废/删除留痕)
SELECT N'3-今日单据' AS 段, t.面板, COUNT(*) AS 今日新建,
       SUM(CASE WHEN t.canceled = 'Y' THEN 1 ELSE 0 END) AS 今日已作废,
       SUM(CASE WHEN t.canceled <> 'Y' THEN 1 ELSE 0 END) AS 今日未作废
FROM (
  SELECT N'QC_RECV(送料暂收单)' AS 面板, ISNULL(s.canceled, 'N') AS canceled
  FROM sl_recv r LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_RECV' AND s.doc_no = r.单据编号
  WHERE CONVERT(date, r.asp_time1) = CONVERT(date, GETDATE())
  UNION ALL
  SELECT N'QC_INSP(来料检验单)', ISNULL(s.canceled, 'N')
  FROM qc_insp r LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_INSP' AND s.doc_no = r.单据编号
  WHERE CONVERT(date, r.asp_time1) = CONVERT(date, GETDATE())
  UNION ALL
  SELECT N'PURCHASE_IN(采购入库单)', ISNULL(s.canceled, 'N')
  FROM bd_purchase_in r LEFT JOIN yj_doc_status s ON s.panel_code = 'PURCHASE_IN' AND s.doc_no = r.单据编号
  WHERE CONVERT(date, r.asp_time1) = CONVERT(date, GETDATE())
  UNION ALL
  SELECT N'QC_RETURN(暂收退回单)', ISNULL(s.canceled, 'N')
  FROM qc_return r LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_RETURN' AND s.doc_no = r.单据编号
  WHERE CONVERT(date, r.asp_time1) = CONVERT(date, GETDATE())
) t
GROUP BY t.面板 ORDER BY t.面板;
