/* ============================================================================
 * migrate-supplier-account-phone-20261025.sql —— 供应商账号加「联系电话」
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-25):
 *   「供应商权限配置的新增应该弹窗关联供应商,然后选择后账号默认供应商编码(可修改)。可以有联系电话」
 *
 * 本脚本只做一件事:`yj_supplier_account` 增加 `[phone] nvarchar(50) NULL`(联系电话),
 * 并写列级中文注明(《数据库注明与全量部署规范》)。两账套均需执行,幂等。
 *
 * 为什么放本表而不是 yj_user:电话是**供应商侧业务联系方式**(采购部联系这个供应商的谁),
 * 属于供应商账号档案;yj_user 是全公司账号表,不该囤业务联系信息。
 * 「账号默认 = 供应商编码(可修改)」是**前端交互**(选供应商后预填账号),不涉及表结构。
 *
 * 历史行为:老账号该列为 NULL ⇒ 列表显示「—」,不影响登录与查询。
 *
 * 同批代码(同提交):
 *   · SupplierPortalService:accounts() 返回 phone / saveAccount() 读写 phone
 *   · SupplierAccount.vue:弹窗加「联系电话」,并把「账号」移到供应商选择之后
 *     (选供应商 → 账号自动预填该供应商编码,仍可手改)
 *   · 表清单 docs/development/数据库表清单.md:yj_supplier_account 列数 10→11
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 加列 ---------- */
IF COL_LENGTH(N'dbo.yj_supplier_account', N'phone') IS NULL
BEGIN
    ALTER TABLE dbo.yj_supplier_account ADD [phone] nvarchar(50) NULL;
    PRINT N'① 已为 yj_supplier_account 增加列 [phone] nvarchar(50) NULL';
END
ELSE
    PRINT N'① yj_supplier_account.[phone] 已存在,跳过';
GO

/* ---------- ② 中文注明 ---------- */
DECLARE @txt nvarchar(600) =
    N'联系电话(2026-10-25 用户口径「可以有联系电话」):采购部联系该供应商账号负责人的电话;'
  + N'仅作档案信息展示与联系用,不参与登录鉴权;空 = 未登记。';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(N'dbo.yj_supplier_account')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_supplier_account'), N'phone', 'ColumnId')
             AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account', N'COLUMN', N'phone';
ELSE
    EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', N'yj_supplier_account', N'COLUMN', N'phone';
PRINT N'② yj_supplier_account.[phone] 列注明已写入';
GO

/* ---------- ③ 自检 ---------- */
IF COL_LENGTH(N'dbo.yj_supplier_account', N'phone') IS NULL
    RAISERROR(N'自检失败:yj_supplier_account.[phone] 未建', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.columns c
               WHERE c.object_id = OBJECT_ID(N'dbo.yj_supplier_account') AND c.name = N'phone'
                 AND TYPE_NAME(c.user_type_id) = 'nvarchar' AND c.is_nullable = 1)
    RAISERROR(N'自检失败:yj_supplier_account.[phone] 类型应为 nvarchar NULL', 16, 1);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.yj_supplier_account')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_supplier_account'), N'phone', 'ColumnId')
                 AND ep.name = N'MS_Description')
    RAISERROR(N'自检失败:yj_supplier_account.[phone] 缺列级中文注明', 16, 1);

SELECT N'自检' AS k, c.name AS 列, TYPE_NAME(c.user_type_id) AS 类型, c.max_length AS 字节, c.is_nullable AS 可空
  FROM sys.columns c
 WHERE c.object_id = OBJECT_ID(N'dbo.yj_supplier_account') AND c.name = N'phone';
GO
PRINT N'✅ 供应商账号联系电话列就绪(yj_supplier_account.[phone] nvarchar(50) NULL)';
GO
