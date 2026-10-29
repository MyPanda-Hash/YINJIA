/* ============================================================================
   verify-wo-mixing-list.sql —— 混料记录（WO_MIXING_LIST）装完后的**只读**体检
   不改任何数据；逐项 PASS/FAIL，末行 RESULT: VERIFY-PASS / VERIFY-FAIL。
   用法：java -cp lib\mssql-jdbc.jar SqlRunner.java <jdbc:...HSDZ_MES...> yinjia <密码> verify-wo-mixing-list.sql
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @panel sysname = N'WO_MIXING_LIST';
DECLARE @checks TABLE (seq int IDENTITY, 检查项 nvarchar(200), 结果 varchar(10), 说明 nvarchar(400));

/* 1. 源对象 */
DECLARE @src sysname = CASE
    WHEN OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NOT NULL THEN N'wo_mixing_list'
    WHEN OBJECT_ID(N'dbo.wo_mixing_list', N'V') IS NOT NULL THEN N'wo_mixing_list'
    ELSE NULL END;
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'01 源对象 dbo.wo_mixing_list 存在', CASE WHEN @src IS NULL THEN 'FAIL' ELSE 'PASS' END,
       ISNULL(@src, N'未找到表或视图 —— 面板无法工作');

/* 2. 面板行 */
DECLARE @line sysname = NULL, @mode varchar(20) = NULL, @cat nvarchar(40) = NULL, @grp nvarchar(80) = NULL;
SELECT @line = line_table, @mode = mode, @cat = category, @grp = module_group
  FROM dbo.yj_panel WHERE panel_code = @panel;
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'02 面板 yj_panel 已登记', CASE WHEN @line IS NULL THEN 'FAIL' ELSE 'PASS' END, ISNULL(@line, N'(无行)');
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'03 呈现形态 = flat + 报表（同报工记录）',
       CASE WHEN @mode = 'flat' AND @cat = N'报表' THEN 'PASS' ELSE 'FAIL' END,
       ISNULL(@mode + N' / ' + @cat, N'(无)');
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'04 模块组 = 生产过程', CASE WHEN @grp = N'生产过程' THEN 'PASS' ELSE 'FAIL' END, ISNULL(@grp, N'(无)');

/* 5. 字段 */
DECLARE @nField int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = @panel);
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'05 字段已登记', CASE WHEN @nField > 0 THEN 'PASS' ELSE 'FAIL' END, CAST(@nField AS nvarchar(10)) + N' 个';

DECLARE @badCol int = 0, @badWrite int = 0;
IF @line IS NOT NULL
BEGIN
    SELECT @badCol = COUNT(*) FROM dbo.yj_field f
     WHERE f.panel_code = @panel
       AND NOT EXISTS (SELECT 1 FROM sys.columns c
                       WHERE c.object_id = OBJECT_ID(N'dbo.' + @line) AND c.name = f.col_name);
END
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'06 字段全部落在源对象上', CASE WHEN @badCol = 0 THEN 'PASS' ELSE 'FAIL' END, CAST(@badCol AS nvarchar(10)) + N' 个字段找不到列';

SELECT @badWrite = COUNT(*) FROM dbo.yj_field
 WHERE panel_code = @panel AND (editable = 1 OR required = 1 OR hidden = 1 OR visible = 0);
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'07 只读：无可写/必填/隐藏字段', CASE WHEN @badWrite = 0 THEN 'PASS' ELSE 'FAIL' END, CAST(@badWrite AS nvarchar(10)) + N' 个不合规字段';

/* 8. 译名 */
DECLARE @trPanel int = (SELECT COUNT(*) FROM dbo.yj_translation
                         WHERE scope = 'panel' AND ref_key = N'混料记录' AND locale = 'en' AND LEN(text) > 0);
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'08 面板 en 译名（多语言强制规范）', CASE WHEN @trPanel > 0 THEN 'PASS' ELSE 'FAIL' END, N'Mixing Records';
DECLARE @trField int = (SELECT COUNT(*) FROM dbo.yj_translation t
                         WHERE t.scope = 'field' AND t.locale = 'en'
                           AND EXISTS (SELECT 1 FROM dbo.yj_field f WHERE f.panel_code = @panel AND f.label = t.ref_key));
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'09 字段 en 译名', CASE WHEN @trField > 0 THEN 'PASS' ELSE 'FAIL' END, CAST(@trField AS nvarchar(10)) + N' 条';

/* 10. 授权只读 */
DECLARE @badPerm int = (SELECT COUNT(*) FROM dbo.yj_role_panel
                         WHERE panel_code = @panel
                           AND (perms NOT IN ('view,query', 'view,query,export') OR perms IS NULL
                                OR ISNULL(can_approve, 'N') <> 'N'));
DECLARE @nPerm int = (SELECT COUNT(*) FROM dbo.yj_role_panel WHERE panel_code = @panel);
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'10 授权只读（view/query[/export]）', CASE WHEN @badPerm = 0 AND @nPerm > 0 THEN 'PASS' ELSE 'FAIL' END,
       CAST(@nPerm AS nvarchar(10)) + N' 个角色,' + CAST(@badPerm AS nvarchar(10)) + N' 个越权';

/* 11. 后端 queryFlat 的同款 SQL 能跑通（id/列名/排序） */
DECLARE @smokeOk bit = 0, @smokeMsg nvarchar(400) = N'';
IF @line IS NOT NULL AND @nField > 0
BEGIN
    DECLARE @cols nvarchar(max) = STUFF((SELECT N', t.[' + col_name + N'] AS [' + label + N']'
        FROM dbo.yj_field WHERE panel_code = @panel ORDER BY seq, id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    DECLARE @hasCancel bit = CASE WHEN EXISTS (SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.' + @line) AND name = N'asp_cancel') THEN 1 ELSE 0 END;
    DECLARE @sql nvarchar(max) =
        N'SELECT TOP 1 t.id AS __id, ' + @cols + N' FROM dbo.' + QUOTENAME(@line) + N' t WHERE '
        + CASE WHEN @hasCancel = 1 THEN N'ISNULL(t.asp_cancel, N''N'') <> N''Y''' ELSE N'1=1' END
        + N' ORDER BY t.id DESC';
    BEGIN TRY
        EXEC sp_executesql @sql;
        SET @smokeOk = 1;
    END TRY
    BEGIN CATCH
        SET @smokeMsg = ERROR_MESSAGE();
    END CATCH
END
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'11 列表查询 SQL 可执行', CASE WHEN @smokeOk = 1 THEN 'PASS' ELSE 'FAIL' END, ISNULL(@smokeMsg, N'');

/* 12. 行数（信息项，0 行也算通） */
DECLARE @rows int = NULL;
IF @line IS NOT NULL
BEGIN
    DECLARE @cnt nvarchar(max) = N'SELECT @n = COUNT(*) FROM dbo.' + QUOTENAME(@line) + N';';
    BEGIN TRY EXEC sp_executesql @cnt, N'@n int OUTPUT', @n = @rows OUTPUT; END TRY BEGIN CATCH SET @rows = NULL; END CATCH
END
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'12 源对象行数（信息项）', 'INFO', ISNULL(CAST(@rows AS nvarchar(20)), N'读取失败') + N' 行';

SELECT 检查项, 结果, 说明 FROM @checks ORDER BY seq;
SELECT CASE WHEN EXISTS (SELECT 1 FROM @checks WHERE 结果 = 'FAIL')
            THEN N'RESULT: VERIFY-FAIL'
            ELSE N'RESULT: VERIFY-PASS' END AS 结果;
