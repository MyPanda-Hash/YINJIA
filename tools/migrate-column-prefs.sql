/* 表格列自定义:yj_field 增加 alias(栏名别名) 和 visible(是否显示) */
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO
IF COL_LENGTH('yj_field', 'alias') IS NULL
    ALTER TABLE yj_field ADD alias nvarchar(60) NULL;   -- 栏名别名(显示名)
GO
IF COL_LENGTH('yj_field', 'visible') IS NULL
    ALTER TABLE yj_field ADD visible bit NOT NULL CONSTRAINT df_yjf_vis DEFAULT (1);
GO
UPDATE yj_field SET visible = 1 WHERE visible IS NULL;
GO
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE, DELETE ON yj_field TO yinjia;
GO
PRINT N'列自定义迁移完成(alias + visible)';
GO
