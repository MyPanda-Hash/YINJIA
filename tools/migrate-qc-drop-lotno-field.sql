-- migrate-qc-drop-lotno-field.sql — 来料检验单/暂收退回单 下线「批号」字段行(2026-09-21)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 用户口径(2026-09-21):「**只用批次号**」——送料暂收/来料检验/暂收退回 三单里,批次标识统一用「批次号」,
--   不再显示「批号」。实测:QC_RECV 已合规(只有批次号),QC_INSP 与 QC_RETURN 各残留一条「批号」字段行
--   (来自 migrate-qc-3docs-rebuild.sql / migrate-qc-insp-sync-cols.sql 时代的登记)。
--
-- 处理:**只删字段登记行(不再显示),不删物理列**——
--   · 表列 qc_insp_detail.批号 / qc_return_detail.批号 保留(参照库的「批号」= 供应商批号,
--     与「批次号」不是一回事;若将来要启用只需重插字段行,历史不丢);
--   · 「批次号」字段行(各单头+行各 1)保持不动;
--   · 其它面板(PR_*/WO_ORDER/MANU_ORDER 等)的「批号」不受影响。
--
-- 幂等:按 (panel_code, col_name) 精确删除,重复执行无副作用。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ══════════════ 1. 下线 QC_INSP / QC_RETURN 的「批号」字段行 ══════════════
DECLARE @before int = (SELECT COUNT(*) FROM yj_field
    WHERE panel_code IN ('QC_INSP','QC_RETURN') AND col_name=N'批号');
DELETE FROM yj_field WHERE panel_code IN ('QC_INSP','QC_RETURN') AND col_name=N'批号';
PRINT N'[qc-lotno] 「批号」字段行删除数 = ' + CAST(@before AS nvarchar(10)) + N'(期望首次 2,复跑 0)';
GO

-- ══════════════ 2. 自检 ══════════════
-- ① 两个面板不得再有「批号」字段行;② 「批次号」字段行必须还在(各 2 条:头 + 行)
DECLARE @left int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('QC_INSP','QC_RETURN') AND col_name=N'批号');
DECLARE @batch int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('QC_INSP','QC_RETURN') AND col_name=N'批次号');
IF @left > 0
    RAISERROR(N'[qc-lotno] 自检失败:仍有 %d 条「批号」字段行', 16, 1, @left);
IF @batch <> 4
    RAISERROR(N'[qc-lotno] 自检失败:「批次号」字段行 %d 条(应 4 = 检验单 2 + 退回单 2)', 16, 1, @batch);
IF @left = 0 AND @batch = 4
    PRINT N'[qc-lotno] 自检通过:批号字段行已下线(物理列保留),批次号 4 条仍在(只用批次号)';
GO
