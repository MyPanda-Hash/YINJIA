/* ============================================================================
   verify-prod-pick-outh.sql —— 生产领料（PROD_PICK_LIST）装完后的**只读**体检
   不改任何数据；逐项 PASS/FAIL，末行 RESULT: VERIFY-PASS / VERIFY-FAIL。
   用法（tools 目录）：
     java -cp lib\mssql-jdbc.jar SqlRunner.java ^
       "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia <密码> ^
       verify\verify-prod-pick-outh.sql
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @panel sysname = N'PROD_PICK_LIST';
DECLARE @view  sysname = N'v_prod_pick_list';
DECLARE @checks TABLE (seq int IDENTITY, 检查项 nvarchar(200), 结果 varchar(10), 说明 nvarchar(400));

/* 1. 源表 outh */
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'01 源表 dbo.outh 存在（库存出库流水）',
       CASE WHEN OBJECT_ID(N'dbo.outh', N'U') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
       CASE WHEN OBJECT_ID(N'dbo.outh', N'U') IS NOT NULL THEN N'found' ELSE N'未找到 —— 面板无法工作' END;

/* 2. 包装视图 */
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'02 包装视图 dbo.v_prod_pick_list 存在',
       CASE WHEN OBJECT_ID(N'dbo.v_prod_pick_list', N'V') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
       CASE WHEN OBJECT_ID(N'dbo.v_prod_pick_list', N'V') IS NOT NULL THEN N'found' ELSE N'未创建' END;

/* 3. 视图口径 = 只有 src=6（材料出库）且未删除 */
DECLARE @badSeg int = NULL;
IF OBJECT_ID(N'dbo.v_prod_pick_list', N'V') IS NOT NULL
    EXEC sp_executesql N'SELECT @n = COUNT(*) FROM dbo.v_prod_pick_list WHERE 单据类型 <> N''材料出库单'';',
         N'@n int OUTPUT', @n = @badSeg OUTPUT;
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'03 视图只含材料出库段（src=6，未删除）', CASE WHEN ISNULL(@badSeg, 1) = 0 THEN 'PASS' ELSE 'FAIL' END,
       N'非材料出库行 ' + CAST(ISNULL(@badSeg, -1) AS nvarchar(20));

/* 4. 面板行 */
DECLARE @line sysname = NULL, @mode varchar(20) = NULL, @cat nvarchar(40) = NULL,
        @grp nvarchar(80) = NULL, @dateCol sysname = NULL, @name nvarchar(120) = NULL;
SELECT @line = line_table, @mode = mode, @cat = category, @grp = module_group,
       @dateCol = date_col, @name = panel_name
  FROM dbo.yj_panel WHERE panel_code = @panel;
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'04 面板 yj_panel 已登记且名为「生产领料」',
       CASE WHEN @line IS NOT NULL AND @name = N'生产领料' THEN 'PASS' ELSE 'FAIL' END,
       ISNULL(@name, N'(无行)') + N' / ' + ISNULL(@line, N'-');

/* 5. 形态 + 数据源 + 归属 */
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'05 形态 = flat + 报表，数据源 = 包装视图，模块组 = WMS管理系统',
       CASE WHEN @mode = 'flat' AND @cat = N'报表' AND @line = @view AND @grp = N'WMS管理系统'
            THEN 'PASS' ELSE 'FAIL' END,
       ISNULL(@mode, '-') + N' / ' + ISNULL(@cat, '-') + N' / ' + ISNULL(@line, '-') + N' / ' + ISNULL(@grp, '-');

/* 6. 字段数与只读 */
DECLARE @nField int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = @panel);
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'06 字段已登记（18 列）', CASE WHEN @nField = 18 THEN 'PASS' ELSE 'FAIL' END, CAST(@nField AS nvarchar(10)) + N' 个';

-- 只读口径：不可写/不必填/不靠 hidden 藏列（hidden 对平表列表不生效，列显隐走 visible）。
-- 「列设置」里的 visible 开关属用户操作，不当作 FAIL —— 第 07b 项只报数。
DECLARE @badWrite int = (SELECT COUNT(*) FROM dbo.yj_field
                          WHERE panel_code = @panel AND (editable = 1 OR required = 1 OR hidden = 1));
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'07 只读：无可写/必填/hidden 字段', CASE WHEN @badWrite = 0 THEN 'PASS' ELSE 'FAIL' END,
       CAST(@badWrite AS nvarchar(10)) + N' 个不合规字段';

DECLARE @nShown int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = @panel AND visible = 1);
DECLARE @nOff   int = @nField - @nShown;
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'07b 列表展示列数（信息项，默认关 5 列空列）', 'INFO',
       N'展示 ' + CAST(@nShown AS nvarchar(10)) + N' 列 / 关 ' + CAST(@nOff AS nvarchar(10)) + N' 列';

/* 8. 字段全部落在视图上 */
DECLARE @badCol int = 0;
IF OBJECT_ID(N'dbo.v_prod_pick_list', N'V') IS NOT NULL
    SELECT @badCol = COUNT(*) FROM dbo.yj_field f
     WHERE f.panel_code = @panel
       AND NOT EXISTS (SELECT 1 FROM sys.columns c
                       WHERE c.object_id = OBJECT_ID(N'dbo.v_prod_pick_list') AND c.name = f.col_name);
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'08 字段全部落在视图上', CASE WHEN @badCol = 0 THEN 'PASS' ELSE 'FAIL' END,
       CAST(@badCol AS nvarchar(10)) + N' 个字段找不到列';

/* 9. 面板 en 译名（多语言强制规范） */
DECLARE @trPanel int = (SELECT COUNT(*) FROM dbo.yj_translation
                         WHERE scope = 'panel' AND ref_key = N'生产领料' AND locale = 'en' AND LEN(text) > 0);
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'09 面板 en 译名（多语言强制规范）', CASE WHEN @trPanel > 0 THEN 'PASS' ELSE 'FAIL' END, N'Production Picking';

/* 10. 每个字段都有 en 译名 */
DECLARE @trField int = (SELECT COUNT(*) FROM dbo.yj_field f
                         WHERE f.panel_code = @panel
                           AND EXISTS (SELECT 1 FROM dbo.yj_translation t
                                        WHERE t.scope = 'field' AND t.ref_key = f.label
                                          AND t.locale = 'en' AND LEN(t.text) > 0));
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'10 字段 en 译名齐全', CASE WHEN @trField = @nField THEN 'PASS' ELSE 'FAIL' END,
       CAST(@trField AS nvarchar(10)) + N'/' + CAST(@nField AS nvarchar(10)) + N' 条';

/* 11. 授权只读 */
DECLARE @badPerm int = (SELECT COUNT(*) FROM dbo.yj_role_panel
                         WHERE panel_code = @panel
                           AND (perms NOT IN ('view,query', 'view,query,export') OR perms IS NULL
                                OR ISNULL(can_approve, 'N') <> 'N'));
DECLARE @nPerm int = (SELECT COUNT(*) FROM dbo.yj_role_panel WHERE panel_code = @panel);
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'11 授权只读（view/query[/export]）', CASE WHEN @badPerm = 0 AND @nPerm > 0 THEN 'PASS' ELSE 'FAIL' END,
       CAST(@nPerm AS nvarchar(10)) + N' 个角色,' + CAST(@badPerm AS nvarchar(10)) + N' 个越权';

/* 12. 后端 queryFlat 的同款 SQL 能跑通（id/列名/日期排序） */
DECLARE @smokeOk bit = 0, @smokeMsg nvarchar(400) = N'';
IF @line IS NOT NULL AND @nField > 0
BEGIN
    DECLARE @cols nvarchar(max) = STUFF((SELECT N', t.[' + col_name + N'] AS [' + label + N']'
        FROM dbo.yj_field WHERE panel_code = @panel ORDER BY seq, id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    DECLARE @order nvarchar(200) = CASE WHEN @dateCol IS NOT NULL AND @dateCol <> ''
        THEN N' ORDER BY t.[' + @dateCol + N'] DESC, t.id DESC' ELSE N' ORDER BY t.id DESC' END;
    -- 与 QueryService.cancelFilter 同一条判定：视图上**有** asp_cancel 才加软删过滤。
    -- 本视图的口径过滤写在视图里（src=6 且未删除），故这里照实按「有没有这一列」走，
    -- 否则会拼出「列名 'asp_cancel' 无效」的假 FAIL。
    DECLARE @hasCancel bit = CASE WHEN EXISTS (SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.' + @line) AND name = N'asp_cancel') THEN 1 ELSE 0 END;
    DECLARE @sql nvarchar(max) =
        N'SELECT TOP 3 t.id AS __id, ' + @cols + N' FROM dbo.' + QUOTENAME(@line) + N' t'
        + CASE WHEN @hasCancel = 1 THEN N' WHERE ISNULL(t.asp_cancel, N''N'') <> N''Y''' ELSE N'' END
        + @order;
    BEGIN TRY
        EXEC sp_executesql @sql;
        SET @smokeOk = 1;
    END TRY
    BEGIN CATCH
        SET @smokeMsg = ERROR_MESSAGE();
    END CATCH
END
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'12 列表查询 SQL 可执行（同 queryFlat）', CASE WHEN @smokeOk = 1 THEN 'PASS' ELSE 'FAIL' END, ISNULL(@smokeMsg, N'');

/* 13. 行数（信息项） */
DECLARE @rows int = NULL, @docs int = NULL;
IF OBJECT_ID(N'dbo.v_prod_pick_list', N'V') IS NOT NULL
BEGIN
    BEGIN TRY
        EXEC sp_executesql N'SELECT @n = COUNT(*), @d = COUNT(DISTINCT 单据编号) FROM dbo.v_prod_pick_list;',
             N'@n int OUTPUT, @d int OUTPUT', @n = @rows OUTPUT, @d = @docs OUTPUT;
    END TRY
    BEGIN CATCH SET @rows = NULL; SET @docs = NULL; END CATCH
END
INSERT INTO @checks (检查项, 结果, 说明)
SELECT N'13 领料行数 / 单据数（信息项）', 'INFO',
       ISNULL(CAST(@rows AS nvarchar(20)), N'读取失败') + N' 行 / ' + ISNULL(CAST(@docs AS nvarchar(20)), N'-') + N' 张';

SELECT 检查项, 结果, 说明 FROM @checks ORDER BY seq;
SELECT CASE WHEN EXISTS (SELECT 1 FROM @checks WHERE 结果 = 'FAIL')
            THEN N'RESULT: VERIFY-FAIL'
            ELSE N'RESULT: VERIFY-PASS' END AS 结果;
