/* migrate-qc-proc-insp-audit-trail-20261017.sql(2026-10-17)
 *
 * 目的:给**直接「审核」**补上审批留痕 —— 与提交/通过/驳回/弃审写同一张表 `yj_form_approval`,
 *   让「审批情况(审核记录)」查得到"谁审的、什么时候、意见是什么"。
 *
 * 背景(用户口径):「审核还有审核记录之类的功能实现在当前研发管理模块内的实现很多,全部都可以查看尝试进行修改」
 *   —— 研发管理那套动作(提交/通过/驳回/会签/中止/弃审…)在 ButtonService 里**每一个都 recordApproval(...)**,
 *   唯独直接 `audit()` 只写 yj_doc_status(shr/shsj) 不写留痕 ⇒ 制程检验单只有直审这一条路,
 *   审完在「审批情况」里什么都看不到。
 *   同批修的代码:ButtonService.audit() 在竞态守卫之后补 `recordApproval(...,"AUDIT","APPROVED", auditOpinionOf(formData))`
 *   (新增 auditOpinionOf:前端直审弹窗填的是「审核意见」,而 opinionOf 只认「审批意见」,直接复用会丢意见)。
 *
 * 本脚本只做**历史补录**:本迁移之前已直审过的单据,按其 yj_doc_status(shr/shsj)补一行 AUDIT/APPROVED;
 *   意见写「（历史补录：直接审核）」以示来源,不冒充当时的真实意见。
 *   ⚠ 只针对 QC_PROC_INSP —— 它是目前唯一走直审的面板(DIRECT_AUDIT_PANELS);
 *     其它面板的审核都经由 提交审批→审批通过,本来就有 APPROVE 留痕,补录会重复。
 *
 * 幂等:NOT EXISTS 守卫,重复执行不产生重复行;两账套均执行。
 * 自检:执行后「已审核但无 AUDIT 留痕」的 QC_PROC_INSP 单据数必须为 0。
 */

INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time)
SELECT N'QC_PROC_INSP', s.doc_no, N'AUDIT', N'APPROVED', 1, s.shr, N'（历史补录：直接审核）',
       ISNULL(s.shsj, ISNULL(s.update_at, SYSDATETIME()))
FROM yj_doc_status s
WHERE s.panel_code = N'QC_PROC_INSP'
  AND ISNULL(s.shr, N'') <> N''
  AND ISNULL(s.canceled, N'N') <> N'Y'
  AND NOT EXISTS (SELECT 1 FROM yj_form_approval a
                  WHERE a.panel_code = N'QC_PROC_INSP' AND a.form_no = s.doc_no AND a.action = N'AUDIT');
GO

DECLARE @bad int = 0;
SELECT @bad = COUNT(*) FROM yj_doc_status s
WHERE s.panel_code = N'QC_PROC_INSP' AND ISNULL(s.shr, N'') <> N'' AND ISNULL(s.canceled, N'N') <> N'Y'
  AND NOT EXISTS (SELECT 1 FROM yj_form_approval a
                  WHERE a.panel_code = N'QC_PROC_INSP' AND a.form_no = s.doc_no AND a.action = N'AUDIT');
IF @bad > 0 RAISERROR(N'制程检验单审核留痕补录自检失败:仍有已审核单据没有 AUDIT 记录', 16, 1);
ELSE PRINT N'制程检验单审核留痕补录完成(已审核单据均有 AUDIT 记录)';
GO
