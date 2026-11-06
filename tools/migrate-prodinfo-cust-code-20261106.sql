-- migrate-prodinfo-cust-code-20261106.sql — 产品信息表加「客户编码」+ 客户编码/客户名称互为下拉（参照客户档案 KHDA）
--
-- 用户口径(2026-11-06)原文：
--   「产品信息表的客户名称下边加上一个客户编码字段，然后可以通过客户编码下拉或者客户名称下拉，
--     客户里面的信息带入这两个字段的数据就不需要手动填写，后面那些规格书等单据如果有客户编码的
--     也同步关联上，产品编码引用的时候也带过去，没有就不用管」
--
-- 落地（三件）：
--   ① 产品信息表 RD_PROD_INFO：
--        · 客户名称：由「文本」改「参照 KHDA(客户档案 dm_kh)」，ref_field=mc → 下拉选客户名称；
--        · 新增 客户编码：参照 KHDA，ref_field=dm（存客户编码）→ 下拉选客户编码。
--      两格互为参照 ⇒ 后端 PanelConfigService.buildRefMap 的**同名带回**会把另一个一起带上
--      （选编码 → 客户名称自动填；选名称 → 客户编码自动填），前端不需要另写联动。
--   ② 规格书 RD_SPEC_DOC：新增 客户编码（参照 KHDA.dm）。它已有「客户名」(label=客户名称)，
--      选「产品编号」(参照 RD_PROD_INFO)时，同名带回会同时把 客户名称 + 客户编码 带过来
--      —— 即用户说的「产品编码引用的时候也带过去」。
--   ③ 其它面板：目前除规格书外**没有**客户编码字段（QC_FIRST_INSP 的「客户代码」不在这条链上），
--      按用户「没有就不用管」不动。
--
-- 幂等：列 IF COL_LENGTH IS NULL；字段行 IF NOT EXISTS(panel_code+label)；UPDATE 带窄条件 + 行数守卫；
--       末尾自检（字段/列/参照配置不符就 RAISERROR 12 当场失败）。
-- 适用：本地/生产通用（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST）。

IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ── 1. 物理列（两个头表各加一列，只加不改） ─────────────────────────────────
IF COL_LENGTH(N'rd_prod_info_head', N'客户编码') IS NULL
  ALTER TABLE rd_prod_info_head ADD [客户编码] NVARCHAR(100) NULL;
GO
IF COL_LENGTH(N'rd_spec_doc_head', N'客户编码') IS NULL
  ALTER TABLE rd_spec_doc_head ADD [客户编码] NVARCHAR(100) NULL;
GO

-- 列中文注明（AGENTS.md：改表必须带 MS_Description）
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
               ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
               WHERE ep.name = N'MS_Description' AND c.object_id = OBJECT_ID(N'rd_prod_info_head') AND c.name = N'客户编码')
  EXEC sp_addextendedproperty N'MS_Description', N'客户编码：客户档案(KHDA/dm_kh)的客户编码；与「客户名称」互为参照，选一个另一个自动带入',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_info_head', N'COLUMN', N'客户编码';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c
               ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
               WHERE ep.name = N'MS_Description' AND c.object_id = OBJECT_ID(N'rd_spec_doc_head') AND c.name = N'客户编码')
  EXEC sp_addextendedproperty N'MS_Description', N'客户编码：由产品信息表(RD_PROD_INFO)随「产品编号」引用带回；对应客户档案(KHDA/dm_kh)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_spec_doc_head', N'COLUMN', N'客户编码';
GO

-- ── 2. 产品信息表：客户名称 改参照 + 新增客户编码（紧跟客户名称之后） ─────────
DECLARE @n1 INT;
UPDATE yj_field SET data_type = N'参照', ref_panel = N'KHDA', ref_field = N'mc', display_field = N'mc'
WHERE panel_code = N'RD_PROD_INFO' AND label = N'客户名称';
SET @n1 = @@ROWCOUNT;
IF @n1 <> 1 RAISERROR(N'[FAIL] RD_PROD_INFO.客户名称 改参照命中 %d 行(期望 1)', 12, 1, @n1) WITH NOWAIT;
GO

-- 客户项目名称 从 42 挪到 43，给客户编码腾出 42（只在仍是旧值时动，重跑不会一路加）
DECLARE @n2 INT;
UPDATE yj_field SET seq = 43
WHERE panel_code = N'RD_PROD_INFO' AND label = N'客户项目名称' AND seq = 42;
SET @n2 = @@ROWCOUNT;
GO

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO' AND label = N'客户编码')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                        place, seq, width, editable, required, hidden, visible)
  VALUES (N'RD_PROD_INFO', N'客户编码', N'客户编码', N'参照', N'KHDA', N'dm', N'dm',
          N'header', 42, 130, 1, 0, 0, 1);
GO

-- ── 3. 规格书：新增客户编码（客户名之后，客户料号之前） ─────────────────────
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_SPEC_DOC' AND label = N'客户编码')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                        place, seq, width, editable, required, hidden, visible)
  VALUES (N'RD_SPEC_DOC', N'客户编码', N'客户编码', N'参照', N'KHDA', N'dm', N'dm',
          N'header', 65, 130, 1, 0, 0, 1);
GO

-- ── 4. 译名（AGENTS.md：新增字段必须同时交付译名，至少 en） ────────────────
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'客户编码' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES
    (N'field', N'客户编码', 'en', N'Customer Code', N'manual'),
    (N'field', N'客户编码', 'zh-TW', N'客戶編碼', N'manual'),
    (N'field', N'客户编码', 'ja', N'顧客コード', N'manual'),
    (N'field', N'客户编码', 'ko', N'고객 코드', N'manual'),
    (N'field', N'客户编码', 'es', N'Código de cliente', N'manual'),
    (N'field', N'客户编码', 'fr', N'Code client', N'manual'),
    (N'field', N'客户编码', 'de', N'Kundennummer', N'manual'),
    (N'field', N'客户编码', 'ru', N'Код клиента', N'manual'),
    (N'field', N'客户编码', 'vi', N'Mã khách hàng', N'manual'),
    (N'field', N'客户编码', 'th', N'รหัสลูกค้า', N'manual');
GO

-- ── 5. 自检 ────────────────────────────────────────────────────────────────
IF COL_LENGTH(N'rd_prod_info_head', N'客户编码') IS NULL OR COL_LENGTH(N'rd_spec_doc_head', N'客户编码') IS NULL
  RAISERROR(N'[FAIL] 客户编码物理列缺失', 12, 1) WITH NOWAIT;
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_PROD_INFO' AND label = N'客户名称'
               AND data_type = N'参照' AND ref_panel = N'KHDA' AND ref_field = N'mc')
  RAISERROR(N'[FAIL] RD_PROD_INFO.客户名称 未改成参照 KHDA.mc', 12, 1) WITH NOWAIT;
GO
IF (SELECT COUNT(*) FROM yj_field WHERE label = N'客户编码' AND panel_code IN (N'RD_PROD_INFO', N'RD_SPEC_DOC')) <> 2
  RAISERROR(N'[FAIL] 客户编码字段行不足 2 条(RD_PROD_INFO/RD_SPEC_DOC)', 12, 1) WITH NOWAIT;
GO

SELECT panel_code, label, data_type, ref_panel, ref_field, display_field, place, seq
FROM yj_field WHERE label IN (N'客户名称', N'客户编码', N'客户项目名称')
  AND panel_code IN (N'RD_PROD_INFO', N'RD_SPEC_DOC') ORDER BY panel_code, seq;
GO
RAISERROR(N'[PASS] 产品信息表/规格书 客户编码字段就位（参照 KHDA，编码↔名称互为带回）', 10, 1) WITH NOWAIT;
GO
