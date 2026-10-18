/* migrate-first-insp-audit-trail-20261018.sql(2026-10-18)
 *
 * 目的:首件检验单(QC_FIRST_INSP)开放**直接「审核」**的同时,把本改动之前已审核过的单据
 *   补一行审批留痕 —— 与提交/通过/驳回/弃审写同一张表 `yj_form_approval`,
 *   让侧栏「审批情况(审核记录)」查得到"谁审的、什么时候"。
 *
 * 背景(用户口径 2026-10-18):「为当前的首件检验单增加审核功能,审核功能实现参照当前的制程检验单」
 *   —— 制程检验单那批(2026-10-17,见 migrate-qc-proc-insp-audit-trail-20261017.sql)做的是同一件事:
 *   ① 前端 PanelxList 的 DIRECT_AUDIT_PANELS 名单加面板码(侧栏出「审核 / 弃审 / 审批情况」);
 *   ② 后端 ButtonService.audit() 在竞态守卫之后 recordApproval(...,'AUDIT','APPROVED', 审核意见)
 *      —— **这一步是面板无关的,2026-10-17 已上线**,故本轮首件检验单的**新审核**自动有留痕;
 *   ③ 存量单据(当年可能经表单页/旧入口审过、或跨环境搬进来时 shr 有值)的 AUDIT 行只能靠本脚本补。
 *
 * 本脚本只做**历史补录**:按 yj_doc_status(shr/shsj)给已审核(shr 非空)且未作废的首件检验单
 *   补一行 AUDIT/APPROVED;意见写「（历史补录：直接审核）」以标明来源,不冒充当时的真实意见。
 *   ⚠ 只针对 QC_FIRST_INSP —— 与制程那支脚本同一口径(其它面板走 提交审批→审批通过,本就有 APPROVE 行,
 *     补录会重复)。首件检验单既不属两级审批的 8 张质量单据,也没有审批流 ⇒ 直审是它唯一的出口。
 *
 * 幂等:NOT EXISTS 守卫(同面板 + 同单号 + 已有 AUDIT 行则跳过),重复执行不产生重复行;两账套均执行。
 * 自检:执行后「已审核但无 AUDIT 留痕」的 QC_FIRST_INSP 单据数必须为 0。
 *
 * 取证(2026-10-18 执行前):HSDZ_MES = 6 张单据状态行全为草稿、无 shr;HSDZ_MES_TEST = 127 行全为草稿
 *   ⇒ 本脚本在两个账套都**补录 0 行**(属预期:首件检验单此前根本没有审核入口);
 *     留着它是为服务器/其它账套兜底,与制程那支对称(见 tools/archive/_first-insp-audit-20261018/)。
 */

INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time)
SELECT N'QC_FIRST_INSP', s.doc_no, N'AUDIT', N'APPROVED', 1, s.shr, N'（历史补录：直接审核）',
       ISNULL(s.shsj, ISNULL(s.update_at, SYSDATETIME()))
FROM yj_doc_status s
WHERE s.panel_code = N'QC_FIRST_INSP'
  AND ISNULL(s.shr, N'') <> N''
  AND ISNULL(s.canceled, N'N') <> N'Y'
  AND NOT EXISTS (SELECT 1 FROM yj_form_approval a
                  WHERE a.panel_code = N'QC_FIRST_INSP' AND a.form_no = s.doc_no AND a.action = N'AUDIT');
GO

DECLARE @bad int = 0;
SELECT @bad = COUNT(*) FROM yj_doc_status s
WHERE s.panel_code = N'QC_FIRST_INSP' AND ISNULL(s.shr, N'') <> N'' AND ISNULL(s.canceled, N'N') <> N'Y'
  AND NOT EXISTS (SELECT 1 FROM yj_form_approval a
                  WHERE a.panel_code = N'QC_FIRST_INSP' AND a.form_no = s.doc_no AND a.action = N'AUDIT');
IF @bad > 0 RAISERROR(N'首件检验单审核留痕补录自检失败:仍有已审核单据没有 AUDIT 记录', 16, 1);
ELSE PRINT N'首件检验单审核留痕补录完成(已审核单据均有 AUDIT 记录)';
GO
