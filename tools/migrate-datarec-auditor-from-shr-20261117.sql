/* ============================================================================
 * migrate-datarec-auditor-from-shr-20261117.sql
 * 数据记录表：把「表单审核人」纠正为**真实审批人姓名**
 * ----------------------------------------------------------------------------
 * 用户口径（2026-11-17）：「所有的数据记录表的审核人都是在审批之后填入对应的审批人名字」。
 *
 * 代码侧已实现「审批通过时写审批通过人姓名、弃审时清空」
 * （ButtonService.DATA_REC_AUDITOR_PANELS + writeDataRecAuditor）。
 * 但**改代码不动历史数据**，而历史数据有两种错法：
 *   ① 从没写过：已审批但 备用1 仍为空；
 *   ② 写的是**预填值**：早期 docDefaults 建单即填「秀丽」，与真实审批人无关
 *      （生产实测 rd_alkaline PH-2026-11-0002：shr=admin/系统管理员，备用1='秀丽'）。
 * 本脚本对**已审批**的单统一按 yj_doc_status.shr（→ yj_user.real_name，取不到退回账号）
 * 纠正；未审批的单一律清空（审核人只在审批后存在）。
 *
 * 覆盖 8 张数据记录表，物理列都是「备用1」（实测 yj_field：label 表单审核人 → col 备用1）。
 * 幂等：只在"与目标值不一致"时更新。
 * 两账套都执行。
 * ========================================================================== */

SET NOCOUNT ON;

IF OBJECT_ID('yj_std_lib') IS NULL RAISERROR(N'[datarec-auditor] 元数据异常', 16, 1);
GO

DECLARE @t TABLE (panel sysname PRIMARY KEY, tbl sysname NOT NULL);
INSERT INTO @t (panel, tbl) VALUES
 (N'RD_ALKALINE',   N'rd_alkaline_head'),
 (N'RD_MINERAL',    N'rd_mineral_head'),
 (N'RD_ANTIBACT',   N'rd_antibact_head'),
 (N'RD_SCALE',      N'rd_scale_head'),
 (N'RD_RO_PROTECT', N'rd_ro_protect_head'),
 (N'RD_SOAK',       N'rd_soak_head'),
 (N'RD_DROP_PREC',  N'rd_drop_prec_head'),
 (N'RD_FILTER_EFF', N'rd_filter_eff_head');

DECLARE @panel sysname, @tbl sysname, @sql nvarchar(max), @n int, @fixed int = 0, @cleared int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT panel, tbl FROM @t;
OPEN cur;
FETCH NEXT FROM cur INTO @panel, @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
    -- ① 已审批 → 纠正成审批人姓名
    SET @sql = N'UPDATE h SET h.[备用1] = ISNULL(NULLIF(LTRIM(RTRIM(u.real_name)), N''''), s.shr)
                  FROM ' + QUOTENAME(@tbl) + N' h
                  JOIN yj_doc_status s ON s.panel_code = @p AND s.doc_no = h.[单据编号]
                  LEFT JOIN yj_user u ON u.username = s.shr
                 WHERE ISNULL(s.shr, N'''') <> N''''
                   AND ISNULL(h.asp_cancel, ''N'') <> ''Y''
                   AND ISNULL(h.[备用1], N'''') <> ISNULL(NULLIF(LTRIM(RTRIM(u.real_name)), N''''), s.shr);';
    EXEC sp_executesql @sql, N'@p sysname', @p = @panel;
    SET @n = @@ROWCOUNT; SET @fixed = @fixed + @n;
    IF @n > 0 PRINT N'[datarec-auditor] ' + @panel + N' 纠正审核人 = ' + CAST(@n AS nvarchar(10));

    -- ② 未审批 → 清空（审核人只在审批后存在；顺带清掉早期的预填「秀丽」）
    SET @sql = N'UPDATE h SET h.[备用1] = NULL
                  FROM ' + QUOTENAME(@tbl) + N' h
                 WHERE ISNULL(h.[备用1], N'''') <> N''''
                   AND ISNULL(h.asp_cancel, ''N'') <> ''Y''
                   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                                    WHERE s.panel_code = @p AND s.doc_no = h.[单据编号]
                                      AND ISNULL(s.shr, N'''') <> N'''');';
    EXEC sp_executesql @sql, N'@p sysname', @p = @panel;
    SET @n = @@ROWCOUNT; SET @cleared = @cleared + @n;
    IF @n > 0 PRINT N'[datarec-auditor] ' + @panel + N' 清空未审批审核人 = ' + CAST(@n AS nvarchar(10));

    FETCH NEXT FROM cur INTO @panel, @tbl;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[datarec-auditor] 合计：纠正 = ' + CAST(@fixed AS nvarchar(10)) + N'，清空 = ' + CAST(@cleared AS nvarchar(10));
GO

/* ---------- 自检：不该再有"未审批却有审核人"或"已审批但审核人与 shr 不符" ---------- */
DECLARE @bad int = 0;
SELECT @bad = @bad + COUNT(*)
  FROM rd_alkaline_head h JOIN yj_doc_status s ON s.panel_code = N'RD_ALKALINE' AND s.doc_no = h.[单据编号]
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(s.shr,N'') <> N''
   AND ISNULL(h.[备用1],N'') NOT IN (SELECT ISNULL(NULLIF(LTRIM(RTRIM(u2.real_name)),N''), s2.shr)
                                        FROM yj_user u2, yj_doc_status s2
                                       WHERE u2.username = s.shr AND s2.doc_no = h.[单据编号]);
IF @bad > 0 RAISERROR(N'[datarec-auditor] 自检失败：仍有审核人与审批人不一致的行', 16, 1);
PRINT N'[datarec-auditor] 自检通过。';
GO
