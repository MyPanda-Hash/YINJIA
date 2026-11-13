/* ============================================================================
 * migrate-qc-insp-rec-approval-notify-20261111.sql
 * 检验数据记录(QC_INSP_REC):待审批通知**只发给 fm(冯敏)**
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):
 *   「还要审批权的角色有哪些,并且如果我只想这个数据记录通知 fm 要怎么才能做到」
 *
 * 背景:「提交审批」的收件人 = 该面板 can_approve 角色的账号 + 管理员。QC_INSP_REC 上
 * 有 5 个角色勾了审批权(生产 / 质量审核 / 总经理 / 品质审核 / 扫码报工领料)+ 2 个管理员,
 * 于是一次提交会落到 10 个账号。用户只想让 冯敏(fm) 一个人收到提醒。
 *
 * 做法:在 yj_panel.config 里加一个键 **approvalNotify**(账号数组):
 *     {"approvalNotify":["fm"]}
 *   · 配了它 ⇒ 该面板的「提交审批」消息**只发给这些人**(管理员也不再自动带);
 *   · 不配 / 空数组 ⇒ 维持原口径(全部审批人 + 管理员)。
 *   · **审批权不变**:谁能点「审批通过/驳回」仍由 yj_role_panel.can_approve 决定 ——
 *     「谁收提醒」与「谁能审批」刻意分开,避免为了少打扰而削掉别人的审批权。
 *
 * 代码落点:MessageService.sendToApprovers → approvalNotifyTargets(读本配置)。
 * 幂等:用 JSON_MODIFY 合并进现有 config(不覆盖别的键),重复执行结果不变。两账套均执行。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---- ① 面板必须在 ---- */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_INSP_REC')
BEGIN
    RAISERROR(N'找不到面板 QC_INSP_REC,拒绝执行', 16, 1);
    RETURN;
END
GO

/* ---- ② 把 approvalNotify 合并进 config(config 为空/非法 JSON 时先兜成 {}) ---- */
UPDATE yj_panel
   SET config = JSON_MODIFY(
           CASE WHEN ISJSON(ISNULL(NULLIF(config, N''), N'{}')) = 1 THEN ISNULL(NULLIF(config, N''), N'{}')
                ELSE N'{}' END,
           '$.approvalNotify',
           JSON_QUERY(N'["fm"]'))
 WHERE panel_code = N'QC_INSP_REC';
PRINT N'[配置] QC_INSP_REC.config.approvalNotify = ["fm"]';
GO

/* ---- ③ 自检 ---- */
IF ISJSON((SELECT config FROM yj_panel WHERE panel_code = N'QC_INSP_REC')) <> 1
    RAISERROR(N'QC_INSP_REC.config 写入后不是合法 JSON', 16, 1);
IF (SELECT config FROM yj_panel WHERE panel_code = N'QC_INSP_REC') NOT LIKE N'%approvalNotify%'
    RAISERROR(N'QC_INSP_REC.config 未写入 approvalNotify', 16, 1);

SELECT N'面板' AS 项, panel_code AS 值
  FROM yj_panel WHERE panel_code = N'QC_INSP_REC'
UNION ALL
SELECT N'config', config FROM yj_panel WHERE panel_code = N'QC_INSP_REC';

/* 现状:仍保留审批权的角色(只是不再收到提交通知) */
SELECT r.role_name AS 审批角色, rp.can_approve AS 有审批权
  FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
 WHERE rp.panel_code = N'QC_INSP_REC' AND rp.can_approve = 'Y'
 ORDER BY rp.role_id;

PRINT N'✅ 检验数据记录的待审批通知已收口到 fm(冯敏);要改人/取消,改 yj_panel.config.approvalNotify 即可';
GO
