/*
 * migrate-prodinfo-approver-no-default-20261120.sql
 *
 * 目的：产品信息表（RD_PROD_INFO）的「审核人（一级审批人）/（二级审批人）」改为**审批之后才有名字**。
 *
 * 用户口径（2026-11-20 截图三处问题之二）：
 *   「审核人（一级审核）格仍显示陈秀丽（老单据/草稿也显示），审批之后才有对应审批人的名字」。
 *   历史口径（2026-11-19）：「审批人没有默认显示名字，在审批之后才填进去」。
 *
 * 根因（两个默认值来源 + 一条存量回填，缺一不可）：
 *   ① 前端 core/panel/docDefaults.js 的 RD_PROD_INFO 两格已清空（2026-11-19 改）；
 *   ② 但后端 buildMeta 下发的 yj_panel.config.headDefaults 里仍有
 *      {"审核人（一级审批人）":"陈秀丽"}（2026-11-11 approver-cells 迁移写过一级；二级已被删）——
 *      PanelxList 在草稿态 applyDocDefaults 会把空格补成它，所以新建/老草稿仍显示陈秀丽；
 *   ③ 2026-11-11 migrate-prodinfo-l1-approver-backfill 把**所有存活单据**（含未审批草稿）的
 *      审核人一级统一回填成陈秀丽 ⇒ 纸面直接读到存量值。
 *
 * 本脚本做三件事（幂等；正式/测试两账套都要执行）：
 *   A. 删掉 headDefaults 里两级审批人的键（只改 JSON 属性，不整段覆盖 config）；
 *   B. 清空**未审批**单据的两级审批人签名：已审核(shr 非空)/已归档(archived='Y')不动；
 *   C. 改前/改后行数 + 自检（未审批泄漏 = 0、headDefaults 键 = 0）。
 *
 * ⚠ 审批之后的名字由代码写：ButtonService.approveApproval 一级通过 →
 *   writeBackL1Approver（审核人一级）；一级选人 → writeBackL2Approver（审核人二级）；
 *   驳回/弃审 → clearProdInfoApprovers。前端纸面另有 signoffVisibility 状态门禁。
 * ⚠ 部署时正停在「待二级审批」的单：本脚本会连一级签名一起清；二级通过时
 *   ButtonService.approveSecond 按审批留痕 APPROVE_L1 的 operator 补写一级审批人，不会永久空白。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ── A. headDefaults 里两级审批人的键删掉（JSON_MODIFY ... NULL = 删属性） ───────── */
DECLARE @cfgBefore INT = (
    SELECT COUNT(*)
      FROM yj_panel
     WHERE panel_code = N'RD_PROD_INFO'
       AND config IS NOT NULL
       AND JSON_QUERY(config, '$.headDefaults') IS NOT NULL
       AND (JSON_VALUE(config, '$.headDefaults."审核人（一级审批人）"') IS NOT NULL
            OR JSON_VALUE(config, '$.headDefaults."审核人（二级审批人）"') IS NOT NULL)
);
PRINT '[prodinfo-approver] headDefaults 待清理属性行数 = ' + CAST(@cfgBefore AS nvarchar(10));

UPDATE yj_panel
   SET config = JSON_MODIFY(config, '$.headDefaults."审核人（一级审批人）"', NULL)
 WHERE panel_code = N'RD_PROD_INFO'
   AND config IS NOT NULL
   AND JSON_QUERY(config, '$.headDefaults') IS NOT NULL;
PRINT '[prodinfo-approver] headDefaults 一级键已移除';

UPDATE yj_panel
   SET config = JSON_MODIFY(config, '$.headDefaults."审核人（二级审批人）"', NULL)
 WHERE panel_code = N'RD_PROD_INFO'
   AND config IS NOT NULL
   AND JSON_QUERY(config, '$.headDefaults') IS NOT NULL;
PRINT '[prodinfo-approver] headDefaults 二级键已移除';

/* ── B. 未审批单据的两级签名清空 ────────────────────────────────────────────────
   已审批的判据 = yj_doc_status.shr 非空（已审核）或 archived='Y'（已归档）；
   没有状态行 / pending=Y / 退回草稿 都算未审批。修改中(shr 非空)属已审批，不清。
   ⚠ 只动这两列，不动 责任人/编辑人，也不碰 yj_doc_status。 */
DECLARE @before INT = (
    SELECT COUNT(*)
      FROM rd_prod_info_head h
      LEFT JOIN yj_doc_status s
        ON s.panel_code = N'RD_PROD_INFO' AND s.doc_no = h.单据编号
     WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
       AND (s.doc_no IS NULL
            OR (ISNULL(s.shr, N'') = N'' AND ISNULL(s.archived, N'') <> N'Y'))
       AND (ISNULL(h.审核人一级, N'') <> N'' OR ISNULL(h.审核人二级, N'') <> N'')
);
PRINT '[prodinfo-approver] 未审批且仍有签名、待清理单据行数 = ' + CAST(@before AS nvarchar(10));

UPDATE h
   SET h.审核人一级 = NULL,
       h.审核人二级 = NULL
  FROM rd_prod_info_head h
  LEFT JOIN yj_doc_status s
    ON s.panel_code = N'RD_PROD_INFO' AND s.doc_no = h.单据编号
 WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
   AND (s.doc_no IS NULL
        OR (ISNULL(s.shr, N'') = N'' AND ISNULL(s.archived, N'') <> N'Y'))
   AND (ISNULL(h.审核人一级, N'') <> N'' OR ISNULL(h.审核人二级, N'') <> N'');
PRINT '[prodinfo-approver] 已清理单据行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ── C. 自检 ─────────────────────────────────────────────────────────────── */
DECLARE @after INT = (
    SELECT COUNT(*)
      FROM rd_prod_info_head h
      LEFT JOIN yj_doc_status s
        ON s.panel_code = N'RD_PROD_INFO' AND s.doc_no = h.单据编号
     WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
       AND (s.doc_no IS NULL
            OR (ISNULL(s.shr, N'') = N'' AND ISNULL(s.archived, N'') <> N'Y'))
       AND (ISNULL(h.审核人一级, N'') <> N'' OR ISNULL(h.审核人二级, N'') <> N'')
);
IF @after > 0
BEGIN
    RAISERROR(N'[prodinfo-approver] 自检失败：仍有 %d 张未审批单据带审批人签名', 16, 1, @after);
    RETURN;
END

DECLARE @cfgLeak INT = (
    SELECT COUNT(*)
      FROM yj_panel
     WHERE panel_code = N'RD_PROD_INFO'
       AND config IS NOT NULL
       AND JSON_QUERY(config, '$.headDefaults') IS NOT NULL
       AND (JSON_VALUE(config, '$.headDefaults."审核人（一级审批人）"') IS NOT NULL
            OR JSON_VALUE(config, '$.headDefaults."审核人（二级审批人）"') IS NOT NULL)
);
IF @cfgLeak > 0
BEGIN
    RAISERROR(N'[prodinfo-approver] 自检失败：headDefaults 里仍有 %d 个审批人默认值键', 16, 1, @cfgLeak);
    RETURN;
END

PRINT '[prodinfo-approver] 自检通过：审批人默认值键已清、未审批单据签名已清（审批后由审批动作写入）。';
