/* ============================================================================
   共享文件库(RD_SHARE_FILE / yj_share_file)补「备用列池」—— 备用1..备用20

   背景(2026-10-16 用户口径「检测一遍研发管理里面的面板的字段编辑功能是否完善可用」):
   审计 26 张研发管理面板的「字段管理」,查出 3 张不可用,其中**唯一在菜单里点得到的**是
   共享文件库:它的承载表 yj_share_file 只有 17 列、**从来没有预置 备用1..20**,
   而后端对备用列池是"逐列 `SELECT COUNT(*) FROM [表] WHERE [备用N] IS NOT NULL`" ——
   第 1 列就抛 `列名 '备用1' 无效`,整个 GET /api/px/extFields 500,
   用户在界面上只看到「Request failed with status code 500」且对话框自动关闭。

   两件事一起做(缺一不可):
     ① 后端容错(同批判本仓代码):表里没有备用列时**不再 500**,改为下发空池 + poolAvailable=false,
        界面给明确提示(见 PanelConfigService.extPoolOf / FieldManagerDialog);
     ② 本脚本:给 yj_share_file 真正补上 20 个备用列,让共享文件库**真能加自定义字段**
        (不做这一步,容错修完也只是"能打开对话框但加不了字段")。

   口径与其它面板一致:备用1..20 各 nvarchar(200) NULL(见 migrate-ext-fields.sql 的既有做法),
   在册台账/表清单同步登记。本脚本幂等:列已存在则跳过,末尾自检备用列数=20。
   ============================================================================ */

SET NOCOUNT ON;
PRINT '=== 共享文件库 yj_share_file 补备用列池(备用1..20) ===';

IF OBJECT_ID(N'dbo.yj_share_file', N'U') IS NULL
BEGIN
    RAISERROR(N'yj_share_file 不存在,跳过(该表是共享文件库的承载表,应先建表)', 16, 1);
    RETURN;
END

DECLARE @added int = 0, @i int = 1, @col sysname, @sql nvarchar(400);
WHILE @i <= 20
BEGIN
    SET @col = N'备用' + CAST(@i AS nvarchar(10));
    IF COL_LENGTH(N'dbo.yj_share_file', @col) IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.[yj_share_file] ADD [' + @col + N'] nvarchar(200) NULL;';
        EXEC sp_executesql @sql;
        -- 中文注明(AGENTS.md 数据库注明规范:关键列必须带 MS_Description)
        SET @sql = N'EXEC sp_addextendedproperty @name=N''MS_Description'', @value=N''动态字段扩展位(字段管理自定义列,备用列池)'','
                 + N' @level0type=N''SCHEMA'', @level0name=N''dbo'', @level1type=N''TABLE'', @level1name=N''yj_share_file'','
                 + N' @level2type=N''COLUMN'', @level2name=N''' + @col + N''';';
        BEGIN TRY EXEC sp_executesql @sql; END TRY BEGIN CATCH END CATCH
        SET @added = @added + 1;
    END
    SET @i = @i + 1;
END
PRINT '本次新增备用列: ' + CAST(@added AS nvarchar(10)) + ' 个';

-- ── 自检:备用列必须齐 20(少一列 = 该面板的扩展池从此少一位,界面上看不出来)──
DECLARE @cnt int = (SELECT COUNT(*) FROM sys.columns c
                    WHERE c.object_id = OBJECT_ID(N'dbo.yj_share_file') AND c.name LIKE N'备用%');
IF @cnt <> 20
BEGIN
    RAISERROR(N'自检失败:yj_share_file 备用列数 <> 20', 16, 1);
    RETURN;
END
PRINT '自检通过:yj_share_file 备用列 = ' + CAST(@cnt AS nvarchar(10)) + ' 个';
PRINT '=== 完成:共享文件库现在可以在「字段管理」里新增自定义字段 ===';
