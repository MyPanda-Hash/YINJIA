SET NOCOUNT ON;
UPDATE s SET s.pending='N', s.approve_node=NULL, s.shr=NULL, s.shsj=NULL
FROM yj_doc_status s WHERE s.panel_code='QC_TC_IN'
  AND s.doc_no IN (SELECT 单据编号 FROM qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y' AND 审批人 IS NULL AND 审核人 IS NOT NULL);
UPDATE qc_tc_in SET asp_cancel='Y' WHERE ISNULL(asp_cancel,'N')<>'Y' AND 产品名称 LIKE N'%探针%';
UPDATE qc_tc_in SET asp_cancel='Y' WHERE ISNULL(asp_cancel,'N')<>'Y' AND 产品名称 LIKE N'%两级审批界面走查%';
SELECT N'1-LEFT' AS seg, 单据编号, 编制人, 审核人, 审批人, ISNULL(asp_cancel,'') AS cancel FROM qc_tc_in WHERE 单据编号 LIKE 'TCI-2026-10-%';
