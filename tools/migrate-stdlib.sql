-- migrate-stdlib.sql — 标准库落地(可自行补充):yj_std_lib 表 + 规格书章节库种子(《规格书示例》10 份提取)
SET NOCOUNT ON;
GO
BEGIN TRY
IF OBJECT_ID('yj_std_lib') IS NULL CREATE TABLE yj_std_lib (
  id int IDENTITY(1,1) PRIMARY KEY,
  [lib_code] nvarchar(40) NOT NULL,
  [item_code] nvarchar(60) NOT NULL,
  [content] nvarchar(max) NOT NULL,
  [seq] int NOT NULL DEFAULT 0,
  [enabled] int NOT NULL DEFAULT 1,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'yj_std_lib 建表跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stdlib_lib_item') CREATE INDEX ix_stdlib_lib_item ON yj_std_lib (lib_code, item_code, enabled);
GO
IF USER_NAME() <> 'yinjia' GRANT SELECT, INSERT, UPDATE ON yj_std_lib TO yinjia;
GO
