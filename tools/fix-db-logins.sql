/* ============================================================
   fix-db-logins.sql — 修复"跨服务器还原"导致的孤儿数据库用户
   ------------------------------------------------------------
   把别的机器上的 .bak 还原到本机后,库里的用户带着【原来的 SID】,
   与本机的服务器级登录 SID 对不上 -> 连接报"用户 'xxx' 登录失败"。
   本脚本把库用户重新绑回同名登录,并打印一份对照表。

   在目标库上下文里执行:
     sqlcmd -S localhost -d HSDZ_MES -E -b -f i:65001,o:65001 -i fix-db-logins.sql
   ============================================================ */
SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'yinjia')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'yinjia')
    BEGIN
        CREATE USER [yinjia] FOR LOGIN [yinjia];
        PRINT N'--- created db user [yinjia] for existing login ---';
    END
    ELSE PRINT N'[WARN] 本机没有 yinjia 登录,请先在 master 里建登录';
END
ELSE
BEGIN
    ALTER USER [yinjia] WITH LOGIN = [yinjia];
    PRINT N'--- re-linked db user [yinjia] -> login [yinjia] ---';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_role_members drm
                JOIN sys.database_principals r ON r.principal_id = drm.role_principal_id
                JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id
               WHERE r.name = N'db_owner' AND m.name = N'yinjia')
BEGIN
    ALTER ROLE [db_owner] ADD MEMBER [yinjia];
    PRINT N'--- granted db_owner to [yinjia] ---';
END
GO

SELECT dp.name AS db_user,
       ISNULL(sp.name, N'(无同名登录)') AS server_login,
       CASE WHEN sp.name IS NULL THEN N'NO-LOGIN'
            WHEN dp.sid = sp.sid THEN N'linked'
            ELSE N'ORPHANED' END AS status
  FROM sys.database_principals dp
  LEFT JOIN sys.server_principals sp ON sp.name = dp.name
 WHERE dp.type IN ('S', 'U')
   AND dp.name NOT IN (N'dbo', N'guest', N'INFORMATION_SCHEMA', N'sys')
 ORDER BY status DESC, dp.name;
GO

PRINT N'===== LOGIN-FIX-END =====';
GO
