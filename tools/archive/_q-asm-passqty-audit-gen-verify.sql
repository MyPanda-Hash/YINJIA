-- 只读验证(测试账套):组装成品检验单「审核完成 ⇒ 按表头合格数量自动生成产成品入库单」的落库取证
-- 配套:tools/archive/_api-asm-passqty-audit-gen-20261017.mjs(接口侧 13/13)
SET NOCOUNT ON;

/* ① 检验单头:状态 + 正名后的列 + 回执 */
SELECT s.doc_no, CASE WHEN s.canceled='Y' THEN N'已作废' WHEN s.shr IS NOT NULL THEN N'已审核'
                      WHEN s.pending='Y' THEN N'审批中' ELSE N'草稿' END AS 状态,
       ISNULL(s.shr,N'') AS 审核人, ISNULL(CONVERT(nvarchar(32), h.[合格数量]), N'(空)') AS 合格数量,
       ISNULL(h.处理方式,N'') AS 回执
FROM yj_doc_status s LEFT JOIN qc_asm_insp_head h ON h.单据编号 = s.doc_no AND ISNULL(h.asp_cancel,'N')<>'Y'
WHERE s.panel_code = N'QC_ASM_INSP' AND s.doc_no = N'ZJ-2026-10-0085';
GO

/* ② 占用链:检验单 → 产成品入库单 */
SELECT source_form_no, target_form_no, link_status, ISNULL(create_by,N'') AS 建单人, create_time
FROM form_flow_link WHERE source_panel_code = N'QC_ASM_INSP' AND source_form_no = N'ZJ-2026-10-0085'
ORDER BY id DESC;
GO

/* ③ 产成品入库单头 */
SELECT 单据编号, 单据日期, 加工单号, 工单行号, 批次号, 业务类型, 仓库, 经手人, ISNULL(备注,N'') AS 备注, ISNULL(asp_cancel,'N') AS 作废
FROM bd_finish_in WHERE 单据编号 = N'FI-2026-10-0012';
GO

/* ④ 产成品入库单行:实收数量必须 = 检验单表头合格数量(3071) */
SELECT d.单据编号, d.产品编码, d.产品名称, d.规格型号, d.实收数量, d.计量单位, d.仓库, d.批号,
       h.[合格数量] AS 检验单合格数量,
       CASE WHEN d.实收数量 = h.[合格数量] THEN N'OK' ELSE N'MISMATCH' END AS 数量一致
FROM bl_finish_in d
JOIN qc_asm_insp_head h ON h.单据编号 = N'ZJ-2026-10-0085'
WHERE d.单据编号 = N'FI-2026-10-0012' AND ISNULL(d.asp_cancel,'N') <> 'Y';
GO

/* ⑤ 全库自检:已审核的组装成品检验单,若表头合格数量>0 却没有 ACTIVE 的产成品入库单 ⇒ 计数(期望 0) */
SELECT COUNT(*) AS 已审核但无入库单
FROM qc_asm_insp_head h
JOIN yj_doc_status s ON s.panel_code = N'QC_ASM_INSP' AND s.doc_no = h.单据编号
WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND s.canceled <> 'Y' AND s.shr IS NOT NULL
  AND ISNULL(h.[合格数量],0) > 0
  AND NOT EXISTS (SELECT 1 FROM form_flow_link l WHERE l.source_panel_code = N'QC_ASM_INSP'
                    AND l.source_form_no = h.单据编号 AND l.target_panel_code = N'FINISH_IN' AND l.link_status = 'ACTIVE');
GO

/* ⑥ 改名自检:旧列/旧字段登记/旧译名必须绝迹 */
SELECT (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.qc_asm_insp_head') AND name = N'合格数量（入库）') AS 旧物理列,
       (SELECT COUNT(*) FROM yj_field WHERE col_name = N'合格数量（入库）' OR label = N'合格数量（入库）') AS 旧字段登记,
       (SELECT COUNT(*) FROM yj_translation WHERE ref_key = N'合格数量（入库）') AS 旧译名,
       (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'合格数量') AS 新译名语言数;
GO
