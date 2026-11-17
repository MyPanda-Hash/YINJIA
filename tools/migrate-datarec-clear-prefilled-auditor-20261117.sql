/* ============================================================================
 * migrate-datarec-clear-prefilled-auditor-20261117.sql
 * 清掉数据记录表「历史草稿」上被自动预填的审核人
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-17，1117问题 #5）：
 *   「审核人需审核后生成，不能自动填充」。
 *
 * 背景：前端 docDefaults 原来给实验室 8 张数据记录表硬编码 `['表单审核人','秀丽']`，
 *   **建单即带签名** —— 草稿态纸面上就已经"签过名"。
 *   代码侧已改（前端不再预填；后端改为审批通过时回填、弃审时清空），
 *   但**改代码不会动已存在的数据**：之前建的草稿仍带着预填的「秀丽」。
 *   本脚本把这些残留清掉。
 *
 * 【只清「还没审核」的单】
 *   判据 = yj_doc_status 里既没有 shr（未审核）也没有 archived='Y'（未归档）。
 *   已审核/已归档的单**不动** —— 那里的签名是审批动作写下的真实留痕。
 *
 * 【物理列名】label「表单审核人」→ 物理列 **备用1**
 *   （见 migrate-rd-datarec-reviewer-2026-09-30.sql 把审核人落进备用列池；
 *    2026-11-17 实测 yj_field: panel=RD_ALKALINE label=表单审核人 col_name=备用1）。
 *   ⚠ 直接按 label 拼列名会「列名无效」。
 *
 * 幂等：WHERE 带 `= N'秀丽'` 精确匹配 + 只清未审核单，重复执行 0 行。
 * 两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;

/* ---------- 自检：8 张表都必须有「备用1」列 ---------- */
IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME = N'备用1'
      AND TABLE_NAME IN ('rd_alkaline_head','rd_mineral_head','rd_antibact_head','rd_scale_head',
                         'rd_ro_protect_head','rd_soak_head','rd_drop_prec_head','rd_filter_eff_head')) < 8
    RAISERROR(N'[datarec-auditor] 有表缺「备用1」列，先确认这 8 张数据记录表结构', 16, 1);
GO

/* ---------- 逐表清理：只清未审核/未归档的单 ---------- */
DECLARE @t TABLE (name sysname PRIMARY KEY, panel sysname);
INSERT INTO @t (name, panel) VALUES
 (N'rd_alkaline_head',   N'RD_ALKALINE'),
 (N'rd_mineral_head',    N'RD_MINERAL'),
 (N'rd_antibact_head',   N'RD_ANTIBACT'),
 (N'rd_scale_head',      N'RD_SCALE'),
 (N'rd_ro_protect_head', N'RD_RO_PROTECT'),
 (N'rd_soak_head',       N'RD_SOAK'),
 (N'rd_drop_prec_head',  N'RD_DROP_PREC'),
 (N'rd_filter_eff_head', N'RD_FILTER_EFF');

DECLARE @name sysname, @panel sysname, @sql nvarchar(max), @n int, @total int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT name, panel FROM @t;
OPEN cur;
FETCH NEXT FROM cur INTO @name, @panel;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'UPDATE h SET h.[备用1] = NULL FROM ' + QUOTENAME(@name) + N' h
                  WHERE ISNULL(h.[备用1], N'''') <> N''''
                    AND ISNULL(h.asp_cancel, ''N'') <> ''Y''
                    AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                                     WHERE s.panel_code = @p AND s.doc_no = h.[单据编号]
                                       AND (ISNULL(s.shr, N'''') <> N'''' OR ISNULL(s.archived, ''N'') = ''Y''))';
    EXEC sp_executesql @sql, N'@p sysname', @p = @panel;
    SET @n = @@ROWCOUNT; SET @total = @total + @n;
    IF @n > 0 PRINT N'[datarec-auditor] ' + @name + N' 清掉未审核单的预填审核人 = ' + CAST(@n AS nvarchar(10));
    FETCH NEXT FROM cur INTO @name, @panel;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[datarec-auditor] 合计清理 = ' + CAST(@total AS nvarchar(10));
GO

/* ---------- 自检：不该再有「未审核却有审核人」的行 ---------- */
DECLARE @left INT = 0;
SELECT @left = @left + (SELECT COUNT(*) FROM rd_alkaline_head h WHERE ISNULL(h.[备用1],N'')<>N''
        AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=N'RD_ALKALINE' AND s.doc_no=h.[单据编号]
                        AND (ISNULL(s.shr,N'')<>N'' OR ISNULL(s.archived,'N')='Y')));
PRINT N'[datarec-auditor] 剩余未审核带审核人（RD_ALKALINE 抽样）= ' + CAST(@left AS nvarchar(10));
GO
