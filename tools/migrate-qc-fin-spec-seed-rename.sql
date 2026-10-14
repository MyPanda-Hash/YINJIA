-- ════════════════════════════════════════════════════════════════════════════════════════
-- migrate-qc-fin-spec-seed-rename.sql — 修「成品检验规范」播种示例与自动生成单的**编号冲突**
--   2026-10-09 实测发现:播种示例用了正式号池里的 CPJY-2026-10-0001,而自动编号(生单)不知道
--   示例的存在,组装报工审核生成的第一张规范**也取到 CPJY-2026-10-0001** ⇒ 两张单同号。
--   后果不是"看着别扭":明细行按 **单据编号** 关联,同号会让生成单显示出示例的检验项目/处理方式行
--   (实测:生成单明细里多出示例的 3 条检验项目 + 2 条处理方式),编辑一张会影响另一张的取数。
--
--   修法:**把播种示例移出正式号池** → 改名为 CPJY-DEMO-0001(只动 asp_user1='migration' 的播种行,
--   真实生成的单据一律不碰);此后自动编号从 0002 继续,不再撞号。
--   幂等:已改名则 0 行;两账套均执行。
-- ════════════════════════════════════════════════════════════════════════════════════════

DECLARE @moved int = 0;
IF OBJECT_ID('dbo.qc_fin_spec_head', 'U') IS NOT NULL
BEGIN
  UPDATE dbo.qc_fin_spec_detail
     SET 单据编号 = N'CPJY-DEMO-0001'
   WHERE 单据编号 = N'CPJY-2026-10-0001'
     AND EXISTS (SELECT 1 FROM dbo.qc_fin_spec_head h
                  WHERE h.单据编号 = N'CPJY-2026-10-0001' AND ISNULL(h.asp_user1, N'') = N'migration')
     AND ISNULL(asp_user1, N'') = N'migration';
  SET @moved = @@ROWCOUNT;
  UPDATE dbo.qc_fin_spec_head
     SET 单据编号 = N'CPJY-DEMO-0001'
   WHERE 单据编号 = N'CPJY-2026-10-0001' AND ISNULL(asp_user1, N'') = N'migration';
  PRINT N'播种示例改名行数(明细) = ' + CAST(@moved AS nvarchar(10));
END
GO

/* 自检:示例已在 DEMO 号段;若正式号段里只剩"非播种"单据,说明改名没误伤 */
IF OBJECT_ID('dbo.qc_fin_spec_head', 'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.qc_fin_spec_head WHERE 单据编号 = N'CPJY-2026-10-0001' AND ISNULL(asp_user1, N'') = N'migration')
    RAISERROR(N'播种示例仍在正式号池(改名未生效)', 16, 1);
  ELSE PRINT N'成品检验规范:播种示例已移出正式号池(CPJY-DEMO-0001),自动生成单不再与它撞号';
END
