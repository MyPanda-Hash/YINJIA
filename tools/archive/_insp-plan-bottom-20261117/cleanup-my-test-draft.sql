/* ============================================================
   cleanup-my-test-draft-20261117.sql  —— 只在 HSDZ_MES_TEST 用
   2026-11-17 ego 浏览器验证「不合格应对措施合并格 / 检查频率下拉」时,用 ?new=1 反复新建出来的
   空草稿(标题/产品编号都为空、检验项目 0 行),验证完成后清掉,避免在测试账套的业务列表里留一堆假单。

   两步都带窄条件:
     ① 带验证标记的那张(明细里有「合并格验证」字样);
     ② 今天(2026-11-17)新建、标题与产品编号都为空、检验项目 0 行的空草稿。
   正式库没有这些单(脚本开头有库名硬闸门,只在 HSDZ_MES_TEST 执行)。
   ============================================================ */
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
    RAISERROR(N'本脚本只允许在 HSDZ_MES_TEST 执行', 16, 1);
    RETURN;
END
GO
/* ① 验证用的那张(明细里有标记) */
DECLARE @no nvarchar(50);
SELECT TOP 1 @no = d.[单据编号] FROM rd_insp_plan_detail d WHERE d.[不合格应对措施] LIKE N'%合并格验证%';
PRINT N'① 待清理单据=' + ISNULL(@no, N'(none)');
IF @no IS NOT NULL
BEGIN
    DELETE FROM rd_insp_plan_detail WHERE [单据编号] = @no;
    PRINT N'[OK] ① 明细删除:' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 行';
    DELETE FROM rd_insp_plan_head WHERE [单据编号] = @no;
    PRINT N'[OK] ① 表头删除:' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 行';
END
GO
/* ② 今天新建的空草稿(标题/产品编号都空 + 检验项目 0 行) */
DECLARE @empty TABLE (no nvarchar(50));
INSERT INTO @empty (no)
SELECT h.[单据编号] FROM rd_insp_plan_head h
WHERE h.[单据日期] = '2026-11-17'
  AND NULLIF(LTRIM(RTRIM(ISNULL(h.[标题], N''))), N'') IS NULL
  AND NULLIF(LTRIM(RTRIM(ISNULL(h.[产品编号], N''))), N'') IS NULL
  AND NOT EXISTS (SELECT 1 FROM rd_insp_plan_detail d
                  WHERE d.[单据编号] = h.[单据编号]
                    AND ISNULL(d.[表区], N'') <> N'修订记录'
                    AND (NULLIF(LTRIM(RTRIM(ISNULL(d.[控制项目], N''))), N'') IS NOT NULL
                         OR NULLIF(LTRIM(RTRIM(ISNULL(d.[不合格应对措施], N''))), N'') IS NOT NULL));
DECLARE @n2 int;
SELECT @n2 = COUNT(*) FROM @empty;
PRINT N'② 待清理空草稿:' + CAST(@n2 AS nvarchar(6)) + N' 张';
IF @n2 = 0 PRINT N'(无需清理)';
DELETE d FROM rd_insp_plan_detail d JOIN @empty e ON e.no = d.[单据编号];
PRINT N'[OK] ② 明细删除:' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 行';
DELETE h FROM rd_insp_plan_head h JOIN @empty e ON e.no = h.[单据编号];
PRINT N'[OK] ② 表头删除:' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 行';
GO
/* 收尾:看清剩余单据(应回到验证前的 9 张) */
SELECT COUNT(*) AS left_ip_heads FROM rd_insp_plan_head WHERE [单据编号] LIKE N'IP-%';
SELECT COUNT(*) AS left_today_heads FROM rd_insp_plan_head WHERE [单据日期] = '2026-11-17';
GO
