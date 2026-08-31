/* yj_user 补自增主键(重建表;OrgAdmin 契约需要 row.id) */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('yj_user') AND name = 'id') RETURN;
GO
CREATE TABLE yj_user_new (
    id            int IDENTITY(1,1) PRIMARY KEY,
    username      nvarchar(40)  NOT NULL UNIQUE,
    password_hash nvarchar(200) NOT NULL,
    real_name     nvarchar(60)  NULL,
    is_admin      char(1)       NOT NULL CONSTRAINT df_yju2_admin DEFAULT ('N'),
    dept_id       int           NULL,
    role_id       int           NULL,
    enabled       char(1)       NOT NULL CONSTRAINT df_yju2_en DEFAULT ('1')
);
INSERT INTO yj_user_new (username, password_hash, real_name, is_admin, dept_id, role_id, enabled)
SELECT username, password_hash, real_name, is_admin, dept_id, role_id,
       CASE WHEN COL_LENGTH('yj_user','enabled') IS NULL THEN '1' ELSE enabled END
FROM yj_user;
DROP TABLE yj_user;
EXEC sp_rename 'yj_user_new', 'yj_user';
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_user TO yinjia;
GO
DECLARE @c int = (SELECT COUNT(*) FROM yj_user);
PRINT N'yj_user 重建完成(含自增 id): ' + CAST(@c AS nvarchar(10)) + N' 个账号';
GO
