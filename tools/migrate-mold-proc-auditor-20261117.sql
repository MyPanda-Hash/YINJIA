/* ============================================================================
 * migrate-mold-proc-auditor-20261117.sql
 * 炭棒工艺管控清单（RD_MOLD_PROC）新增「审核人」一格
 * ----------------------------------------------------------------------------
 * 用户口径（《产品开发系统问题汇总11.17.xlsx》「具体问题点」行10，2026-11-17 核验时发现遗漏）：
 *   「炭棒工艺管控起单及组装控制清单：右上角加多一行审核人，审核完成后自动生成」。
 *   —— 组装工艺那张（RD_ASM_PROC）当天已加；**烧结/炭棒这张漏了**（实测 yj_field 无 审核人）。
 *
 * 落库列：`rd_mold_proc_head` 的备用列池当前**一个都没被占用**（实测），取 `备用3`
 *   与组装工艺（RD_ASM_PROC）同一口径，便于两处对照维护。
 * 写值时机：只在**审批通过**时由服务端回填 = 审批人姓名（ButtonService）；
 *   前端 yj_field.editable=0 ⇒ 纸面只读，不能手填。
 * 历史已审批单：按 yj_doc_status.shr 补（账号 → yj_user.real_name，取不到退回账号）。
 *
 * 幂等：IF NOT EXISTS / 只补空值。两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_MOLD_PROC')
    RAISERROR(N'[mold-auditor] 面板 RD_MOLD_PROC 不存在', 16, 1);
IF COL_LENGTH('rd_mold_proc_head', N'备用3') IS NULL
    RAISERROR(N'[mold-auditor] rd_mold_proc_head 缺 备用3 列', 16, 1);
GO

/* ---------- ① 登记字段 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_MOLD_PROC' AND label = N'审核人')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (N'RD_MOLD_PROC', N'备用3', N'审核人', N'文本', NULL, NULL, NULL,
            NULL, N'header', 35, 110, 0, 0, 0, 1);
    PRINT N'[mold-auditor] 已登记 yj_field：审核人 → 备用3（seq 35，editable=0）';
END
ELSE PRINT N'[mold-auditor] yj_field 已有「审核人」，跳过';
GO

/* ---------- ② 译名 ---------- */
IF OBJECT_ID('yj_translation') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'审核人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', N'审核人', 'en', N'Reviewer', N'manual');
GO

/* ---------- ③ 历史已审批单补审核人（账号 → 姓名） ---------- */
IF COL_LENGTH('rd_mold_proc_head', N'备用3') IS NOT NULL
BEGIN
    DECLARE @sql nvarchar(max) = N'
        UPDATE h SET h.[备用3] = ISNULL(NULLIF(LTRIM(RTRIM(u.real_name)), N''''), s.shr)
          FROM rd_mold_proc_head h
          JOIN yj_doc_status s ON s.panel_code = N''RD_MOLD_PROC'' AND s.doc_no = h.[单据编号]
          LEFT JOIN yj_user u ON u.username = s.shr
         WHERE ISNULL(s.shr, N'''') <> N''''
           AND ISNULL(h.[备用3], N'''') = N''''
           AND ISNULL(h.asp_cancel, ''N'') <> ''Y'';';
    EXEC sp_executesql @sql;
    PRINT N'[mold-auditor] 历史审核人补齐 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
END
GO

/* ---------- ④ 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_MOLD_PROC' AND label = N'审核人'
               AND col_name = N'备用3' AND editable = 0)
    RAISERROR(N'[mold-auditor] 自检失败：审核人 未按 备用3/editable=0 登记', 16, 1);
PRINT N'[mold-auditor] 自检通过。';
GO
