/* ============================================================================
 * migrate-supplier-account-standalone-20261025.sql
 *   —— 供应商账号脱离 yj_user,只在 yj_supplier_account 一张表里自给自足
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-25):
 *   「供应商配置的账号不属于用户账号,单独一个表吧」
 *
 * 背景(旧实现):一个供应商账号写**两处** —— `yj_supplier_account`(归属/启停/电话)
 *   + `yj_user`(登录凭据 password_hash、real_name、enabled、[供应商编码])。
 *   后果:供应商账号会出现在组织架构/用户管理里,像一个内部员工;口令、改名、停用
 *   都得同步两张表,任一处漏写就"账号在、登不进"或"能登录、不知道是谁"。
 *
 * 本脚本改成**单表**:`yj_supplier_account` 自己持有登录所需的一切。
 *   ① 加列 `password_hash nvarchar(200) NULL`(登录口令,与 yj_user 同格式:BCrypt/sha256)、
 *      `real_name nvarchar(60) NULL`(联系人姓名,不再借 yj_user.real_name);
 *   ② 用 `yj_user` 的现有值**回填**这两列,保证存量账号口令不丢、仍能登录;
 *   ③ 回填成功后**删除 `yj_user` 里对应的镜像行**(仅当该行不是管理员、且用户名确实在
 *      供应商账号表里)—— 从此供应商账号不再算"用户账号";
 *   ④ 保留 `yj_user.[供应商编码]` 列**不删**:历史数据可能仍有值,且删列有风险;
 *      代码侧已不再读它(仅本脚本回填时读一次)。
 *
 * 幂等:加列/回填/删除都带存在性与NULL守卫,可重复执行。
 * 两账套均需执行(先正式后测试)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 加列 ---------- */
IF COL_LENGTH(N'dbo.yj_supplier_account', N'password_hash') IS NULL
BEGIN
    ALTER TABLE dbo.yj_supplier_account ADD [password_hash] nvarchar(200) NULL;
    PRINT N'① 已加列 yj_supplier_account.[password_hash]';
END
ELSE PRINT N'① yj_supplier_account.[password_hash] 已存在,跳过';
GO

IF COL_LENGTH(N'dbo.yj_supplier_account', N'real_name') IS NULL
BEGIN
    ALTER TABLE dbo.yj_supplier_account ADD [real_name] nvarchar(60) NULL;
    PRINT N'① 已加列 yj_supplier_account.[real_name]';
END
ELSE PRINT N'① yj_supplier_account.[real_name] 已存在,跳过';
GO

/* ---------- ② 回填(从 yj_user 搬口令与姓名) ---------- */
UPDATE a
   SET a.password_hash = NULLIF(u.password_hash, N''),
       a.real_name     = COALESCE(NULLIF(a.real_name, N''), u.real_name)
  FROM dbo.yj_supplier_account a
  JOIN dbo.yj_user u ON u.username = a.username
 WHERE a.password_hash IS NULL OR a.password_hash = N'';
PRINT N'② 已从 yj_user 回填 password_hash / real_name';
GO

/* ---------- ③ 删除 yj_user 里的供应商镜像行 ---------- */
DECLARE @del TABLE (username nvarchar(100) PRIMARY KEY);
INSERT INTO @del (username)
SELECT a.username
  FROM dbo.yj_supplier_account a
  JOIN dbo.yj_user u ON u.username = a.username
 WHERE ISNULL(u.is_admin, 'N') <> 'Y';       -- 管理员行绝不删(防误伤同名内部管理员)
 
DELETE u
  FROM dbo.yj_user u
  JOIN @del d ON d.username = u.username;
PRINT N'③ 已删除 yj_user 中的供应商镜像行:' + CAST(@@ROWCOUNT AS varchar) + N' 行';
GO

/* ---------- ④ 中文注明 ---------- */
DECLARE @h nvarchar(600) =
    N'登录口令哈希(2026-10-25 起供应商账号**不再写入 yj_user**,凭据放本表):'
  + N'与 yj_user.password_hash 同格式(YjPasswordEncoder:BCrypt 或 sha256);'
  + N'停用时置空 ⇒ 重新启用必须重设密码。';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'dbo.yj_supplier_account')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_supplier_account'), N'password_hash', 'ColumnId')
             AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @h, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account', N'COLUMN', N'password_hash';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', @h, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account', N'COLUMN', N'password_hash';

DECLARE @rn nvarchar(600) =
    N'联系人姓名(2026-10-25 起由本表保存,不再借 yj_user.real_name):'
  + N'新建时留空 = 取供应商档案名称;仅作展示与联系用,不参与鉴权。';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'dbo.yj_supplier_account')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_supplier_account'), N'real_name', 'ColumnId')
             AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @rn, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account', N'COLUMN', N'real_name';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', @rn, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account', N'COLUMN', N'real_name';
PRINT N'④ 两列中文注明已写入';
GO

/* ---------- ⑤ 自检 ---------- */
IF COL_LENGTH(N'dbo.yj_supplier_account', N'password_hash') IS NULL
    RAISERROR(N'自检失败:yj_supplier_account.[password_hash] 未建', 16, 1);
IF COL_LENGTH(N'dbo.yj_supplier_account', N'real_name') IS NULL
    RAISERROR(N'自检失败:yj_supplier_account.[real_name] 未建', 16, 1);

-- ⑤-1 不得再有「供应商账号同时是 yj_user 用户」
IF EXISTS (SELECT 1 FROM dbo.yj_supplier_account a JOIN dbo.yj_user u ON u.username = a.username)
    RAISERROR(N'自检失败:yj_user 里仍有供应商账号的镜像行(见下方查询)', 16, 1);

-- ⑤-2 启用中的账号必须有口令(否则登不进)
IF EXISTS (SELECT 1 FROM dbo.yj_supplier_account
            WHERE enabled = '1' AND (password_hash IS NULL OR password_hash = N''))
    RAISERROR(N'自检失败:有用启用中的供应商账号缺 password_hash(无法登录)', 16, 1);

SELECT N'自检' AS k,
       (SELECT COUNT(*) FROM dbo.yj_supplier_account) AS 供应商账号数,
       (SELECT COUNT(*) FROM dbo.yj_supplier_account WHERE password_hash IS NOT NULL AND password_hash <> N'') AS 已有口令,
       (SELECT COUNT(*) FROM dbo.yj_supplier_account a JOIN dbo.yj_user u ON u.username = a.username) AS yj_user镜像行;
GO
PRINT N'✅ 供应商账号已独立成表(yj_supplier_account 自带口令与姓名)';
GO
