/* ============================================================================
 * migrate-supplier-portal-20261024.sql —— 供应商采购打印门户(供应商账号 + 供应商端打印范围)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-24):
 *   「采购管理里面多增加俩个面版,一个是供应商采购打印面版,一个是供应商权限配置。
 *     供应商可以通过登录供应商配置的账号登录进来,只能看到供应商采购打印面版
 *     (和对应供应商编码的数据)。然后供应商可以通过这个面版来查看和打印数据。
 *     没有别的权限。」
 *   第二轮拍板:① 打印范围**只做采购订单**(PU_ORDER);② 两个入口都放在
 *   「智能供应链 > 采购管理」下面,供应商权限配置**管理员专属**。
 *
 * 落库设计(两处,都是纯增量、幂等):
 *   A. 新表 `yj_supplier_account` —— 供应商门户账号(账套内的账号档案)。
 *      为什么单独建表、而不直接往 yj_user 里塞一个供应商账号:
 *        · 系统管理平台 → 组织架构 的账号列表会把 yj_user 全量列出来,供应商账号混进去
 *          既会被误改、也会暴露给任何有组织架构权限的人;
 *        · 供应商账号**没有角色/部门/车间**,只有「供应商编码 + 一个采购打印面板的读权」;
 *        · 登录时仍**以 yj_user 为唯一凭据源**(口令哈希复用 PasswordEncoder,不另造一套认证),
 *          本表通过 username 一对一定位「这个账号属于哪个供应商」——登录成功那一刻按 username 查这张表,
 *          命中即**整体降权为供应商会话**(见 SupplierPortalService / JwtAuthFilter 头注)。
 *   B. `yj_user.[供应商编码]` 列 —— 与 `yj_user.[生产车间]`(migrate-yjuser-workshop.sql)同一先例:
 *      账号上的业务归属标签。本脚本建列 + 注明后**回填**已有供应商账号(按 A 表对齐);
 *      新建账号走 SupplierPortalService(本表 + yj_user 同事务写入,两处始终一致)。
 *
 * 面板元数据:两个入口都是**页面级虚拟面板**(不插 yj_panel 行 —— 它们不是单据面板,
 *   数据源是 bd_pu_order / bl_pu_order / 本表),编码登记在
 *   `com.yinjia.mes.service.PagePanelRegistry`:
 *     · SUPPLIER_PRINT  供应商采购打印(只读:view/query/print)
 *     · SUPPLIER_ACCOUNT 供应商权限配置(管理员专属,矩阵里登记 name 便于分组展示;
 *                        写操作一律 requireAdmin,不靠权限词)
 *   菜单与路由:frontend/src/business/menus.js(采购管理 → 单据组末尾)+ router/index.js。
 *
 * 回退(整段撤销,不影响采购订单本身的数据):
 *   DELETE FROM dbo.yj_role_panel WHERE panel_code IN (N'SUPPLIER_PRINT', N'SUPPLIER_ACCOUNT');
 *   DELETE FROM dbo.yj_user WHERE username IN (SELECT username FROM dbo.yj_supplier_account);
 *   DROP TABLE dbo.yj_supplier_account;
 *   ALTER TABLE dbo.yj_user DROP COLUMN [供应商编码];
 *   (代码侧:PagePanelRegistry 两条登记 + SupplierPortal* 两个类 + 前端两页与路由)
 *
 * 两账套(HSDZ_MES 正式 / HSDZ_MES_TEST 测试)均需执行:本脚本幂等,DbSync 直接跑即可。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- A. 供应商门户账号表 ---------- */
IF OBJECT_ID(N'dbo.yj_supplier_account', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.yj_supplier_account (
        id            int IDENTITY(1,1) NOT NULL CONSTRAINT pk_yj_supplier_account PRIMARY KEY,
        username      nvarchar(40)  NOT NULL CONSTRAINT uq_yj_supplier_account UNIQUE,  -- 登录账号 = yj_user.username
        supplier_code nvarchar(100) NOT NULL,   -- 该账号绑定的供应商编码(= bd_pu_order.[供应商编码],如 YJ-KBL)
        enabled       char(1)       NOT NULL CONSTRAINT df_yjsa_enabled DEFAULT ('1'), -- 1=启用 0=停用
        remark        nvarchar(200) NULL,
        create_by     nvarchar(40)  NULL,
        create_at     datetime2(3)  NULL CONSTRAINT df_yjsa_create DEFAULT (SYSDATETIME()),
        update_by     nvarchar(40)  NULL,
        update_at     datetime2(3)  NULL,
        asp_user1     nvarchar(40)  NULL, asp_time1 datetime2(3) NULL,
        asp_user2     nvarchar(40)  NULL, asp_time2 datetime2(3) NULL
    );
    PRINT N'A. 已建表 yj_supplier_account(user,绑定供应商编码,启停,备注)';
END
ELSE
    PRINT N'A. yj_supplier_account 已存在,跳过';
GO

/* 查询索引:供应商端每次取数都按 supplier_code 过滤;登录/鉴权按 username 定位(唯一约束已覆盖) */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_yj_supplier_account_code'
               AND object_id = OBJECT_ID(N'dbo.yj_supplier_account'))
BEGIN
    CREATE INDEX ix_yj_supplier_account_code ON dbo.yj_supplier_account (supplier_code);
    PRINT N'A2. 已建索引 ix_yj_supplier_account_code';
END
GO

/* ---------- B. yj_user 增加 供应商编码(账号业务归属标签) ---------- */
IF COL_LENGTH(N'dbo.yj_user', N'供应商编码') IS NULL
BEGIN
    ALTER TABLE dbo.yj_user ADD [供应商编码] nvarchar(100) NULL;
    PRINT N'B. 已为 yj_user 增加列 [供应商编码] nvarchar(100) NULL';
END
ELSE
    PRINT N'B. yj_user.[供应商编码] 已存在,跳过';
GO

/* ---------- C. 中文注明(表级 + 关键列级,幂等 upsert) ---------- */
DECLARE @tbl nvarchar(600) = N'☆供应商门户账号(2026-10-24 用户口径「供应商可以通过登录供应商配置的账号登录进来,'
  + N'只能看到供应商采购打印面版(和对应供应商编码的数据)」):一行 = 一个供应商登录账号的供应商归属;'
  + N'登录凭据仍在 yj_user(口令同 PasswordEncoder 口径),本表按 username 一对一给出「这个账号属于哪个供应商」;'
  + N'登录命中本表即整体降权为供应商会话(只剩 供应商采购打印 一个页面、一份数据)。'
  + N'维护入口:采购管理 → 供应商权限配置(管理员专属)。';
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.yj_supplier_account')
           AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @tbl, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', @tbl, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account';

DECLARE @cols TABLE (col sysname, txt nvarchar(900));
INSERT INTO @cols (col, txt) VALUES
 (N'username',      N'登录账号(= yj_user.username,全局唯一);账号的新增/停用/改密在「供应商权限配置」页维护'),
 (N'supplier_code', N'绑定的供应商编码(与 bd_pu_order.[供应商编码] 同口径,如 YJ-KBL);供应商端只能看到该编码名下的采购订单'),
 (N'enabled',       N'是否启用:1=可登录,0=停用(停用时 yj_user.enabled 同步置 0,登录直接被拒)'),
 (N'remark',        N'备注(新建时自动带出的供应商名称等说明信息)'),
 (N'create_by',     N'创建人(操作账号)'),
 (N'create_at',     N'创建时间'),
 (N'update_by',     N'最后修改人(操作账号)'),
 (N'update_at',     N'最后修改时间');
DECLARE @c sysname, @x nvarchar(900);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, txt FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @x;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.yj_supplier_account')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_supplier_account'), @c, 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', @x, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account', N'COLUMN', @c;
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', @x, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account', N'COLUMN', @c;
    FETCH NEXT FROM cur INTO @c, @x;
END
CLOSE cur;
DEALLOCATE cur;

DECLARE @utxt nvarchar(600) = N'供应商编码(2026-10-24):该账号绑定的供应商(仅供应商门户账号有值,内部账号为 NULL);'
  + N'与 yj_supplier_account.supplier_code 保持一致;空 = 非供应商账号,享有正常内部账号权限';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'dbo.yj_user')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_user'), N'供应商编码', 'ColumnId')
             AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @utxt, N'SCHEMA', N'dbo', N'TABLE', N'yj_user', N'COLUMN', N'供应商编码';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', @utxt, N'SCHEMA', N'dbo', N'TABLE', N'yj_user', N'COLUMN', N'供应商编码';
PRINT N'C. 表/列中文注明已写入';
GO

/* ---------- D. 回填:已有供应商账号(按 A 表对齐 yj_user.供应商编码) ---------- */
UPDATE u SET u.[供应商编码] = a.supplier_code
  FROM dbo.yj_user u
  JOIN dbo.yj_supplier_account a ON a.username = u.username
 WHERE ISNULL(u.[供应商编码], N'') <> a.supplier_code;
PRINT N'D. 已按供应商账号表回填 yj_user.[供应商编码]';
GO

/* ---------- E. 自检 ---------- */
IF OBJECT_ID(N'dbo.yj_supplier_account', N'U') IS NULL
    RAISERROR(N'自检失败:yj_supplier_account 未建', 16, 1);

IF COL_LENGTH(N'dbo.yj_user', N'供应商编码') IS NULL
    RAISERROR(N'自检失败:yj_user.[供应商编码] 未建', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.yj_supplier_account')
               AND minor_id = 0 AND name = N'MS_Description')
    RAISERROR(N'自检失败:yj_supplier_account 缺表级中文注明', 16, 1);

IF (SELECT COUNT(*) FROM sys.extended_properties ep
    WHERE ep.major_id = OBJECT_ID(N'dbo.yj_supplier_account') AND ep.name = N'MS_Description'
      AND ep.minor_id > 0) < 8
    RAISERROR(N'自检失败:yj_supplier_account 关键列注明不足 8 条(数据库规范 03:拼音/英文列名必须注明)', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.yj_user')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_user'), N'供应商编码', 'ColumnId')
                 AND ep.name = N'MS_Description')
    RAISERROR(N'自检失败:yj_user.[供应商编码] 缺列级中文注明', 16, 1);

SELECT N'自检' AS k, (SELECT COUNT(*) FROM dbo.yj_supplier_account) AS 供应商账号数,
       (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.yj_supplier_account')
          AND name = N'MS_Description') AS 注明条数,
       COL_LENGTH(N'dbo.yj_user', N'供应商编码') AS yjuser_列字节;
GO
PRINT N'✅ 供应商门户表与账号归属列就绪(yj_supplier_account + yj_user.[供应商编码])';
GO
