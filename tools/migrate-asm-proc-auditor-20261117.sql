/* ============================================================================
 * migrate-asm-proc-auditor-20261117.sql
 * 组装工艺管控清单（RD_ASM_PROC）新增「审核人」一格
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-17，1117问题 #6）：
 *   「表单管理人：柴善银 / **增加一个审核人：产品负责人审核后自动填充**」
 *
 * 【落哪一列】rd_asm_proc_head 的备用列池里，`备用1`=是否受控、`备用2`=受控日期
 *   已被占用（实测 yj_field: 是否受控→备用1 / 受控日期→备用2），
 *   故审核人落 **`备用3`**（该列当前无任何 yj_field 映射）。
 *
 * 【写值时机】只在**审批通过**时由服务端回填（ButtonService 的 RD_ASM_PROC 分支），
 *   前端 yj_field.editable=0 ⇒ 纸面只读，不能手填（用户要的是"审核后自动填充"）。
 *
 * 幂等：IF NOT EXISTS 双向守卫；重复执行 0 行。
 * 两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;

/* ---------- 自检：面板与表必须在册 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_ASM_PROC')
    RAISERROR(N'[asm-auditor] 面板 RD_ASM_PROC 不存在', 16, 1);
IF COL_LENGTH('rd_asm_proc_head', N'备用3') IS NULL
    RAISERROR(N'[asm-auditor] rd_asm_proc_head 缺少 备用3 列', 16, 1);
GO

/* ---------- ① yj_field 登记「审核人」→ 备用3 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_ASM_PROC' AND label = N'审核人')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (N'RD_ASM_PROC', N'备用3', N'审核人', N'文本', NULL, NULL, NULL,
            NULL, N'header', 93, 110, 0, 0, 0, 1);
    PRINT N'[asm-auditor] 已登记 yj_field：审核人 → 备用3（seq 93，editable=0）';
END
ELSE PRINT N'[asm-auditor] yj_field 已有「审核人」，跳过';
GO

/* ---------- ② 多语言：新增字段至少补 en（AGENTS.md 强制） ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'审核人' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', N'审核人', 'en', N'Reviewer', N'manual');
PRINT N'[asm-auditor] 译名已补';
GO

/* ---------- ③ 自检：字段已登记且只读 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_ASM_PROC' AND label = N'审核人'
               AND col_name = N'备用3' AND editable = 0)
    RAISERROR(N'[asm-auditor] 自检失败：审核人 未按 备用3/editable=0 登记', 16, 1);
PRINT N'[asm-auditor] 自检通过。';
GO
