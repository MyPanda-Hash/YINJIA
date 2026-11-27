-- 本轮验证用的清单(每次重跑前归零;只动测试账套里这一张记录/一张检验单衍生的产物)
DECLARE @ng nvarchar(50) = N'TCI-2026-11-0005';
DECLARE @rec nvarchar(50) = N'JYSJ-2026-11-0021';
DECLARE @insp nvarchar(50) = N'IJ-2026-11-0007';

DELETE FROM form_flow_link WHERE target_form_no = @ng OR (source_panel_code = N'QC_INSP_REC' AND source_form_no = @rec)
   OR (source_panel_code = N'QC_INSP' AND source_form_no = @insp);
DELETE FROM qc_tc_in WHERE 单据编号 = @ng;
DELETE FROM yj_doc_status WHERE (panel_code = N'QC_TC_IN' AND doc_no = @ng)
   OR (panel_code = N'QC_INSP_REC' AND doc_no = @rec)
   OR (panel_code = N'QC_INSP' AND doc_no = @insp);
DELETE FROM yj_form_approval WHERE (panel_code = N'QC_INSP_REC' AND form_no = @rec)
   OR (panel_code = N'QC_TC_IN' AND form_no = @ng)
   OR (panel_code = N'QC_INSP' AND form_no = @insp);
DELETE FROM yj_message WHERE 单据编号 IN (@ng, @rec, @insp);
UPDATE qc_insp_rec SET 不合格品处理单号 = NULL, asp_user2 = NULL, asp_time2 = NULL WHERE 单据编号 = @rec;
UPDATE qc_insp_detail SET 特采 = 0, 入库单号 = NULL WHERE 单据编号 = @insp;
-- 检验单/记录回草稿(审批留痕已清,状态表已清 ⇒ 派生状态自然是草稿)
SELECT r.单据编号, r.检验结论, ISNULL(r.不合格品处理单号, N'') AS ngNo FROM qc_insp_rec r WHERE r.单据编号 = @rec;
SELECT COUNT(*) AS ngDocs FROM qc_tc_in WHERE 单据编号 = @ng;
