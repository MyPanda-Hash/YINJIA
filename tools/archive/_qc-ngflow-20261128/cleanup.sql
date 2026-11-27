-- 验证收尾:清掉本轮在测试账套造出来的单与链路,并把被借用的检验行数量还原成"未填"
-- (IJ-2026-11-0007 的 送检/合格/不合格 本来就是演示数据里的空值,本轮为了跑通流程临时填了 100/60/40)
DECLARE @ng nvarchar(50) = N'TCI-2026-11-0007';
DECLARE @rec nvarchar(50) = N'JYSJ-2026-11-0021';
DECLARE @insp nvarchar(50) = N'IJ-2026-11-0007';
DECLARE @pi1 nvarchar(50) = N'PI-2026-11-0023';   -- 合格数量 60 的入库单
DECLARE @pi2 nvarchar(50) = N'PI-2026-11-0024';   -- 让步接收 40 的入库单

-- ① 链路占用
DELETE FROM form_flow_link WHERE target_form_no IN (@ng, @pi1, @pi2)
   OR (source_panel_code = N'QC_INSP_REC' AND source_form_no = @rec)
   OR (source_panel_code = N'QC_INSP' AND source_form_no = @insp);

-- ② 采购入库单(头 + 行 + 状态 + 审批留痕)
DELETE FROM bl_purchase_in WHERE 单据编号 IN (@pi1, @pi2);
DELETE FROM bd_purchase_in WHERE 单据编号 IN (@pi1, @pi2);
DELETE FROM yj_doc_status WHERE panel_code = N'PURCHASE_IN' AND doc_no IN (@pi1, @pi2);
DELETE FROM yj_form_approval WHERE panel_code = N'PURCHASE_IN' AND form_no IN (@pi1, @pi2);

-- ③ 不合格品处理单(头 + 状态 + 留痕)
DELETE FROM qc_tc_in_detail WHERE 单据编号 = @ng;
DELETE FROM qc_tc_in WHERE 单据编号 = @ng;
DELETE FROM yj_doc_status WHERE panel_code = N'QC_TC_IN' AND doc_no = @ng;
DELETE FROM yj_form_approval WHERE panel_code = N'QC_TC_IN' AND form_no = @ng;

-- ④ 检验单/检验数据记录 回草稿
DELETE FROM yj_doc_status WHERE (panel_code = N'QC_INSP' AND doc_no = @insp)
   OR (panel_code = N'QC_INSP_REC' AND doc_no = @rec);
DELETE FROM yj_form_approval WHERE (panel_code = N'QC_INSP' AND form_no = @insp)
   OR (panel_code = N'QC_INSP_REC' AND form_no = @rec);

-- ⑤ 字段回填/数量还原
UPDATE qc_insp_rec SET 不合格品处理单号 = NULL, asp_user2 = NULL, asp_time2 = NULL WHERE 单据编号 = @rec;
UPDATE qc_insp_detail SET 特采 = 0, 入库单号 = NULL, 送检数量 = NULL, 合格数量 = NULL, 不合格数量 = NULL
 WHERE 单据编号 = @insp;

-- ⑥ 消息
DELETE FROM yj_message WHERE 单据编号 IN (@ng, @rec, @insp, @pi1, @pi2);
GO

-- 清理结果自检(应全 0)
SELECT (SELECT COUNT(*) FROM qc_tc_in WHERE 单据编号 = N'TCI-2026-11-0007') AS ng_left,
       (SELECT COUNT(*) FROM bd_purchase_in WHERE 单据编号 IN (N'PI-2026-11-0023', N'PI-2026-11-0024')) AS pi_left,
       (SELECT COUNT(*) FROM form_flow_link WHERE target_form_no IN (N'TCI-2026-11-0007', N'PI-2026-11-0023', N'PI-2026-11-0024')) AS link_left,
       (SELECT COUNT(*) FROM yj_doc_status WHERE doc_no IN (N'TCI-2026-11-0007', N'JYSJ-2026-11-0021', N'IJ-2026-11-0007', N'PI-2026-11-0023', N'PI-2026-11-0024')) AS status_left,
       (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号 = N'IJ-2026-11-0007' AND ISNULL(特采,0) = 1) AS tc_left,
       (SELECT COUNT(*) FROM qc_insp_rec WHERE 单据编号 = N'JYSJ-2026-11-0021' AND ISNULL(不合格品处理单号,N'') <> N'') AS backfill_left;
