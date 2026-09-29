-- migrate-whloc-whcode.sql — 库位档案增加「仓库编码」字段(2026-09-28)
-- 需求:库位二维码首段由仓库名称改为仓库编码(扫码定位走编码口径);
--       库位表增加 仓库编码 列,选择仓库时经参照带回自动带入(WH.仓库编码 同名映射,
--       PanelConfigService.buildRefMap 同名自动映射,editable=1 才参与带回——勿设 0)。
-- 内容:bs_wh_loc 加列+中文注明 + 存量行按仓库名称对齐 bs_wh 回填 + yj_field 注册(seq 15 紧跟仓库)。
-- 译名:「仓库编码」九语言译名已全局存在(yj_translation field/仓库编码),无需重复插入。
-- 幂等:加列/注明/字段均 IF NOT EXISTS,回填只补空值,可重跑。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 物理列 ══════════
IF COL_LENGTH('dbo.bs_wh_loc', N'仓库编码') IS NULL
  ALTER TABLE dbo.bs_wh_loc ADD [仓库编码] nvarchar(100) NULL;

-- ══════════ 2. 中文注明 ══════════
IF COL_LENGTH('dbo.bs_wh_loc', N'仓库编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = N'仓库编码')
  EXEC sp_addextendedproperty N'MS_Description',
    N'仓库编码(所属仓库的业务编码,选择仓库时参照带回自 bs_wh.仓库编码;库位二维码首段;2026-09-28 库位档案新增)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'仓库编码';
GO

-- ══════════ 3. 存量回填(仓库列存仓库名称,按名称对齐 bs_wh.仓库编码;只补空值,幂等) ══════════
UPDATE l
   SET l.仓库编码 = w.仓库编码
  FROM dbo.bs_wh_loc l
  JOIN dbo.bs_wh w ON w.仓库名称 = l.仓库
 WHERE (l.仓库编码 IS NULL OR LTRIM(RTRIM(l.仓库编码)) = N'')
   AND w.仓库编码 IS NOT NULL AND LTRIM(RTRIM(w.仓库编码)) <> N'';
GO

-- ══════════ 4. 面板字段注册(detail 位,seq 15 紧跟仓库;editable=1=参与参照带回) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WHLOC' AND col_name = N'仓库编码')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 15, 120, 1, 0, 0, 1);
GO

-- ══════════ 验证 ══════════
SELECT N'列' AS what, CAST(COL_LENGTH('dbo.bs_wh_loc', N'仓库编码') AS varchar(10)) AS v
UNION ALL SELECT N'列注明', CAST(COUNT(*) AS varchar(10)) FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = N'仓库编码'
UNION ALL SELECT N'字段', CAST(COUNT(*) AS varchar(10)) FROM yj_field WHERE panel_code = 'WHLOC' AND col_name = N'仓库编码'
UNION ALL SELECT N'已回填行/总行', CAST(SUM(CASE WHEN LTRIM(RTRIM(仓库编码)) <> N'' THEN 1 ELSE 0 END) AS varchar(10)) + N'/' + CAST(COUNT(*) AS varchar(10)) FROM bs_wh_loc;
GO
PRINT N'migrate-whloc-whcode 完成';
GO
