-- ============================================================================
-- 测试账套 E2E 垃圾清理(一次性,2026-11-04)
--
-- 背景:tools/_asm-bom-maintainable-verify-20261104/_ApiVerify.mjs 在**测试账套**
--   HSDZ_MES_TEST 上跑了「表头改了能存住 / 连加两行行序 / 新增一张 BOM」的真实 API 验证,
--   会产生:
--     · T387_V0001 上的 E2E 标记(备注=E2E-HEADER-*/版本号=E2E-V2 → 已由 API 还原版本号;
--       **备注原值为空,而 headWins 保存链不支持把表头清空**(空值不覆盖),故只能 SQL 兜底清掉);
--     · T387_V0001 上已作废(asp_cancel='Y')的两行 E2E-ROW-*;
--     · 新单 BOM-2026-11-0001(已软删:bs_asm_bom 行 asp_cancel='Y' + yj_doc_status.canceled='Y')
--       —— 单据本身已看不见,但行还留在表里,按「测试账套不留垃圾」清干净。
--
-- 安全:硬闸门 = 只允许在 HSDZ_MES_TEST 执行;在其他库执行直接 RAISERROR 16 失败。
--   全部条件都带 E2E 唯一标记/测试单号,重跑影响 0 行。
-- ============================================================================
SET NOCOUNT ON;
GO

IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'本清理脚本只允许在测试账套 HSDZ_MES_TEST 执行(防止误清正式库)', 16, 1);
END
ELSE
BEGIN
    PRINT N'== 清理前:残留 E2E 标记行 ==';
    SELECT 单据编号, 行序, asp_cancel, 备注, 行备注
      FROM dbo.bs_asm_bom
     WHERE 备注 LIKE N'E2E-%' OR 行备注 LIKE N'E2E-%' OR (单据编号 LIKE N'BOM-2026-11-%' AND 备注 = N'E2E-NEW-DOC')
     ORDER BY 单据编号, 行序;

    DECLARE @n1 int, @n2 int, @n3 int, @n4 int;

    -- 1. 清掉既有单被 E2E 探针改过的表头备注(原值为空;headWins 不支持清空表头格)
    UPDATE dbo.bs_asm_bom
       SET 备注 = NULL
     WHERE 单据编号 = N'T387_V0001'
       AND 备注 LIKE N'E2E-%';
    SET @n1 = @@ROWCOUNT;

    -- 2. 清掉既有单已作废的 E2E 行
    DELETE FROM dbo.bs_asm_bom
     WHERE 单据编号 = N'T387_V0001'
       AND ISNULL(asp_cancel, N'N') = N'Y'
       AND 行备注 LIKE N'E2E-ROW-%';
    SET @n2 = @@ROWCOUNT;

    -- 3. 清掉探针新建的测试单(BOM-2026-11-0001)的物理行 + 单据状态行
    DELETE FROM dbo.bs_asm_bom WHERE 单据编号 LIKE N'BOM-2026-11-%';
    SET @n3 = @@ROWCOUNT;
    DELETE FROM dbo.yj_doc_status WHERE panel_code = N'ASM_BOM' AND doc_no LIKE N'BOM-2026-11-%';
    SET @n4 = @@ROWCOUNT;

    PRINT N'== 清理结果:表头备注=' + CAST(@n1 AS nvarchar(10))
        + N' / 已作废E2E行=' + CAST(@n2 AS nvarchar(10))
        + N' / 测试单行=' + CAST(@n3 AS nvarchar(10))
        + N' / 测试单状态行=' + CAST(@n4 AS nvarchar(10)) + N' ==';

    -- 4. 复核:0 残留
    DECLARE @left int = (SELECT COUNT(*) FROM dbo.bs_asm_bom
                          WHERE 备注 LIKE N'E2E-%' OR 行备注 LIKE N'E2E-%' OR (单据编号 LIKE N'BOM-2026-11-%' AND 备注 = N'E2E-NEW-DOC'));
    DECLARE @leftStatus int = (SELECT COUNT(*) FROM dbo.yj_doc_status
                                WHERE panel_code = N'ASM_BOM' AND doc_no LIKE N'BOM-2026-11-%');
    IF @left <> 0 OR @leftStatus <> 0
        RAISERROR(N'E2E 垃圾未清干净:行=%d 状态行=%d', 16, 1, @left, @leftStatus);
    ELSE
        PRINT N'[PASS] 测试账套 E2E 垃圾已清零(行 0 / 状态行 0)';
END
GO


