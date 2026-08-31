/* 表格列自定义:yj_field 增加 alias(栏名别名) 和 visible(是否显示) */
USE HSDZ_MES;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_field TO yinjia;
GO
PRINT N'列自定义迁移完成(alias + visible)';
GO
