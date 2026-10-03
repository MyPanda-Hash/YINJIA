-- migrate-align-qc-col-fix-20260924.sql — 检验/退料明细缺列补齐(2026-09-24 三连坑收口)
-- 根因:远程库对 qc_insp_detail/qc_return_detail 库上直改补列未入链(spec-unify/不合格数量 依赖),本地旧表无列 → 代码 500。
-- 本支:补 规格型号/不合格数量/处置方式 三列并从同义列搬值;幂等可重跑。
-- ⚠ 2026-10-03 本机两账套实测两处不可执行,已就地修正(见下方两条 ⚠ 注释):型号 列不保证存在、不良数量 是计算列。
SET NOCOUNT ON;
IF COL_LENGTH('qc_insp_detail', N'规格型号') IS NULL ALTER TABLE qc_insp_detail ADD [规格型号] nvarchar(200) NULL;
GO
IF COL_LENGTH('qc_insp_detail', N'不合格数量') IS NULL ALTER TABLE qc_insp_detail ADD [不合格数量] decimal(18,4) NULL;
GO
IF COL_LENGTH('qc_insp_detail', N'处置方式') IS NULL ALTER TABLE qc_insp_detail ADD [处置方式] nvarchar(20) NULL;
GO
IF COL_LENGTH('qc_return_detail', N'规格型号') IS NULL ALTER TABLE qc_return_detail ADD [规格型号] nvarchar(200) NULL;
GO
-- 搬值(独立批次)
-- ⚠ 2026-10-03 修:qc_return_detail 的规格列在本机两账套**只有 规格型号、没有 型号**
--   (qc_insp_detail 两列都有)。直接写 [型号] 会让**整批编译失败**——SQL Server 对「已存在的表
--   缺列」是在编译期就报「列名 '型号' 无效」,同一批里本来合法的语句会被连带一起不执行。
--   故两处 [型号] 取值改**动态 SQL + COL_LENGTH 守卫**:有该列才搬,没有就跳过(搬值本就是补空,不影响 规格型号 列的存在性)。
IF COL_LENGTH('qc_insp_detail', N'型号') IS NOT NULL
    EXEC(N'UPDATE qc_insp_detail SET [规格型号]=[型号] WHERE ISNULL([规格型号],N'''')=N'''' AND ISNULL([型号],N'''')<>N''''');
IF COL_LENGTH('qc_return_detail', N'型号') IS NOT NULL
    EXEC(N'UPDATE qc_return_detail SET [规格型号]=[型号] WHERE ISNULL([规格型号],N'''')=N'''' AND ISNULL([型号],N'''')<>N''''');
-- ⚠ 2026-10-03 修(第二处):qc_insp_detail.[不良数量] 是**计算列** = ([不合格数量])
--   (本机两账套 sys.computed_columns 实测一致)⇒
--     ① 「不良数量 ← 不合格数量」写入必报「不能修改列 '不良数量',因为它是计算列」;
--     ② 反向「不合格数量 ← 不良数量」在 不合格数量 为 NULL 时 不良数量 同样为 NULL,
--        WHERE 永不命中,是死语句(两账套实测 0 行)。
--   故本批**不再搬这两列** —— 两者恒等由计算列定义自带,列的存在性由上面的 ALTER 保证。
GO
-- 面板字段统一:QC_INSP/QC_RETURN 的 型号 → 规格型号
UPDATE yj_field SET col_name=N'规格型号', label=N'规格型号' WHERE panel_code IN ('QC_INSP','QC_RETURN') AND col_name=N'型号';
GO
PRINT N'migrate-align-qc-col-fix-20260924 完成';
GO
