-- migrate-sl-supplier-ref.sql — 暂收单/检验单供应商参照源改指供应商档案(GFDA)
-- 2026-09-17 用户反馈:暂收单表格与表头的供应商选择弹出的数据来自"往来单位"(PARTNER),
--   供应商字段应从"供应商"档案(GFDA)选择。涉及 5 处字段:
--   SL_RECV 头 供应商/供应商代码 + 明细 供应商;QC_INSP 头 供应商/供应商代码。
--   口径:名称列 ref=mc(存名称,同列内既有数据与金蝶同步);编码列 ref=dm、display=mc(同 RKD/CGD 厂商代码)。
--   编码↔名称联动带回由 REF_SYNONYMS 词条(供应商编码→供应商代码/供应商名称→供应商)支持(代码已同步)。
-- ⚠️ 2026-09-24 事故与修复(2026-10-03):
--   上一版把「2026-09-24 补 QC_RECV」这句话**写在 WHERE 同一行的后半段**,
--   行内注释(--)把该行后面原有的 `AND label = N'供应商' AND place LIKE '%header%'` 整段吞掉,
--   实际只剩 `WHERE panel_code IN ('SL_RECV','QC_INSP','QC_RECV') AND ISNULL(ref_panel,'')<>'GFDA'`
--   ⇒ 这两个面板的**每一行字段**都被刷成 ref_panel='GFDA'/ref_field='mc'。
--   又因迁移链按内容哈希判定重跑,该文件字节一变即被重放,污染因此生效并扩散。
--   修复:①注释另起一行,筛选条件还原;②每条 UPDATE 后加行数守卫(改超 10 行即报错回滚),
--        把这类"WHERE 被吞"的事故从静默写坏变成当场失败。
--        污染数据由 migrate-qc-ref-repair.sql 回正。
-- 幂等可重跑。
SET NOCOUNT ON;
GO
-- SL_RECV / QC_INSP / QC_RECV 头"供应商"(名称):改指 GFDA.mc
-- 2026-09-24 补 QC_RECV(面板 09-20 由 SL_RECV 改名,旧编码重放 0 行命中致参照回退 PARTNER)
UPDATE yj_field SET ref_panel = 'GFDA', ref_field = 'mc', display_field = 'mc'
WHERE panel_code IN ('SL_RECV', 'QC_INSP', 'QC_RECV')
  AND label = N'供应商' AND place LIKE '%header%'
  AND ISNULL(ref_panel, '') <> 'GFDA';
IF @@ROWCOUNT > 10 RAISERROR(N'migrate-sl-supplier-ref 守卫:供应商(名称) UPDATE 命中行数异常,疑 WHERE 条件被截断', 16, 1);

-- SL_RECV / QC_INSP / QC_RECV 头"供应商代码"(编码):改指 GFDA.dm,显示名称
UPDATE yj_field SET ref_panel = 'GFDA', ref_field = 'dm', display_field = 'mc'
WHERE panel_code IN ('SL_RECV', 'QC_INSP', 'QC_RECV')
  AND label = N'供应商代码' AND place LIKE '%header%'
  AND ISNULL(ref_panel, '') <> 'GFDA';
IF @@ROWCOUNT > 10 RAISERROR(N'migrate-sl-supplier-ref 守卫:供应商代码 UPDATE 命中行数异常,疑 WHERE 条件被截断', 16, 1);

-- SL_RECV 明细"供应商"(名称):改指 GFDA.mc
UPDATE yj_field SET ref_panel = 'GFDA', ref_field = 'mc', display_field = 'mc'
WHERE panel_code IN ('SL_RECV', 'QC_RECV')
  AND label = N'供应商' AND place LIKE '%detail%'
  AND ISNULL(ref_panel, '') <> 'GFDA';
IF @@ROWCOUNT > 10 RAISERROR(N'migrate-sl-supplier-ref 守卫:明细供应商 UPDATE 命中行数异常,疑 WHERE 条件被截断', 16, 1);
GO
-- 自检:供应商系列应全部 ref_panel=GFDA,且**不得**波及非供应商字段
SELECT N'供应商系列(应 6 行左右)' AS 检查, panel_code, place, label, ref_panel, ref_field, display_field
FROM yj_field
WHERE panel_code IN ('SL_RECV', 'QC_INSP', 'QC_RECV') AND label IN (N'供应商', N'供应商代码')
ORDER BY panel_code, place;
GO
SELECT N'越界污染(应为 0)' AS 检查, COUNT(*) AS n
FROM yj_field
WHERE panel_code IN ('SL_RECV', 'QC_INSP', 'QC_RECV')
  AND ref_panel = 'GFDA' AND label NOT LIKE N'%供应商%';
GO
PRINT N'migrate-sl-supplier-ref 完成';
GO
