/* migrate-qc-insp-detail-missing-cols-20261020.sql — 补回 qc_insp_detail 漏加的 4 列
 *
 * 【为什么需要这个脚本】(2026-10-20 启动时实测)
 *   远端提交 `migrate-qc-insp-realize-20261018.sql` 在写 90 张演示检验单明细时报
 *     `[SQL失败] 列名 '品质复核人' 无效`
 *   ⇒ 链在该脚本处中止,其后脚本全部未执行。
 *
 *   根因不在那个脚本,而在更早的 `migrate-qc-3docs-rebuild.sql` 第 211 行:
 *     IF COL_LENGTH('dbo.qc_insp_detail', N'箱数') IS NULL
 *         ALTER TABLE qc_insp_detail ADD [型号]…,[抽样方案],[品质复核人],[品质复核时间],…,[业务员];
 *   —— **一批 13 列共用一个探针列 `箱数`**。本库 `箱数` 早已存在(历史重建落到过),
 *   探针为假 ⇒ 整批 ADD 被跳过 ⇒ 其中 4 列永远没有:
 *     [抽样方案] [品质复核人] [品质复核时间] [业务员]
 *   (实测两账套 qc_insp_detail 均 59 列,上述 4 列都不在。)
 *
 * 【为什么另起一个脚本,而不是改 migrate-qc-3docs-rebuild.sql】
 *   DbSync 按**内容哈希**判定脚本是否已执行 ⇒ 改动任何历史 .sql 的字节都会让它下次被"重跑";
 *   而那条脚本含 DROP/CREATE TABLE 级别的动作,重放风险远大于收益。
 *   ⇒ 按仓库惯例另起一个**逐列幂等**的修复脚本,并登记在 `migrate-qc-insp-realize-20261018.sql`
 *     **之前**(否则新库/全量部署时仍会先在 realize 处炸)。
 *
 * 【口径】
 *   · 列类型与 migrate-qc-3docs-rebuild.sql 保持一致:
 *       [抽样方案] nvarchar(100) / [品质复核人] nvarchar(50) / [品质复核时间] nvarchar(30) / [业务员] nvarchar(50)
 *   · 逐列 `IF COL_LENGTH(...) IS NULL` 守卫 ⇒ 缺哪列补哪列,重复执行 0 行
 *   · 新列补 MS_Description 中文注明(AGENTS.md 强制)
 *   · 不动数据、不动 yj_field、不改其它表
 *
 * 自检:4 列必须全部存在;否则 RAISERROR(16)。
 * 幂等;两账套均执行。
 */
SET NOCOUNT ON;

/* ═══ 1. 逐列补齐(缺哪补哪) ═══ */
DECLARE @added int = 0;

IF COL_LENGTH('dbo.qc_insp_detail', N'抽样方案') IS NULL
BEGIN
    ALTER TABLE qc_insp_detail ADD [抽样方案] nvarchar(100) NULL;
    SET @added = @added + 1;
END

IF COL_LENGTH('dbo.qc_insp_detail', N'品质复核人') IS NULL
BEGIN
    ALTER TABLE qc_insp_detail ADD [品质复核人] nvarchar(50) NULL;
    SET @added = @added + 1;
END

IF COL_LENGTH('dbo.qc_insp_detail', N'品质复核时间') IS NULL
BEGIN
    ALTER TABLE qc_insp_detail ADD [品质复核时间] nvarchar(30) NULL;
    SET @added = @added + 1;
END

IF COL_LENGTH('dbo.qc_insp_detail', N'业务员') IS NULL
BEGIN
    ALTER TABLE qc_insp_detail ADD [业务员] nvarchar(50) NULL;
    SET @added = @added + 1;
END

-- ⚠ RAISERROR 的参数只能是常量或**变量**:写 DB_NAME() 会报
--   「'DB_NAME' 附近有语法错误」(2026-10-20 实测)。必须先赋给变量再传。
DECLARE @dbn1 sysname = DB_NAME();
RAISERROR(N'[OK] %s:qc_insp_detail 补列 %d 个', 10, 1, @dbn1, @added);
GO

/* ═══ 2. 中文注明(AGENTS.md:新增列必须注明) ═══ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_insp_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'), '抽样方案', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'抽样方案(来料检验抽检规则,如 GB/T 2828.1 一般检验水平 II)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'抽样方案';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_insp_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'), '品质复核人', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'品质复核人(参照职员档案 EMP,检验完成后复核签字的责任人)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'品质复核人';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_insp_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'), '品质复核时间', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'品质复核时间(本地墙钟,与品质复核人成对)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'品质复核时间';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.qc_insp_detail')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'), '业务员', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务员(供应商侧对接的业务人员,参照职员档案 EMP)',
        N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'业务员';
GO

/* ═══ 3. 自检:4 列必须齐备 ═══ */
DECLARE @bad int = 0;

IF COL_LENGTH('dbo.qc_insp_detail', N'抽样方案')   IS NULL SET @bad = @bad + 1;
IF COL_LENGTH('dbo.qc_insp_detail', N'品质复核人') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH('dbo.qc_insp_detail', N'品质复核时间') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH('dbo.qc_insp_detail', N'业务员')     IS NULL SET @bad = @bad + 1;

DECLARE @total int = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'qc_insp_detail');
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:qc_insp_detail 共 %d 列;缺列项 %d 条(应 0)', 10, 1, @dbn, @total, @bad);

IF @bad = 0
    RAISERROR(N'[OK] qc_insp_detail 漏加的 4 列已补回(抽样方案/品质复核人/品质复核时间/业务员)', 10, 1);
ELSE
    RAISERROR(N'[FAIL] qc_insp_detail 仍缺列(见上一行)', 16, 1);
GO
