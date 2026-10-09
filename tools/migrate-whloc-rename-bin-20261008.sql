-- migrate-whloc-rename-bin-20261008.sql — 库位 → 仓位 术语统一（对齐金蝶仓位三件套 sp_id / sp_name / sp_number）
--
-- 【背景】库位档案 2026-09-28 落地时用了「库位」这一套词，而全系统（金蝶接口血统）此前一直是「仓位」：
--   bd_purchase_in.仓位/仓位编码、bl_*.仓位id/仓位名称/仓位编码、bs_inv.默认仓位、bs_wh.启用仓位管理 …
--   同一个概念两套词，导致参照挂不上、字段对不齐。本脚本把「库位」统一改成「仓位」。
--
-- 【范围】库位相关的**全部**出现点（2026-10-08 全量取证：tools/archive/_whloc-req/q-07/q-08/q-09）：
--   物理列 3 · yj_panel 1 · yj_field 3 · yj_translation 36 · MS_Description 3
--   视图/存储过程 0 · db/HSDZ_MES.sql 与 tools/deploy-all.sql 0（旧快照不含此对象）
--
-- 【不动】用户口径「已经为仓位的不需要修改」⇒ bd_purchase_in / bl_purchase_in / bl_sale_out /
--   bl_material_out / bl_pu_order / bl_so_order / bs_inv / bs_wh.启用仓位管理 的既有「仓位*」字段**一个字都不碰**。
--   另外两类刻意不改：
--     · yj_archive_change_log.doc_no(9 行) 与 yj_usage_log.doc_no/panel_name(9+9 行)
--       —— 历史事实快照（archive 面板虚拟单据编号=面板名），改了就是篡改审计；
--     · tools/migrate-whloc.sql / migrate-whloc-whcode.sql / migrate-wh-location.sql
--       —— AGENTS.md：改任何 tools/*.sql 的字节会让 DbSync 按内容哈希判定「需重跑」，历史脚本重跑撞 schema 演进。故另起本脚本。
--
-- 【改名的两个硬约束（为什么这么写）】
--   1. yj_translation 有唯一键 uq_translation(scope, ref_key, locale)，且 field/仓位编码(en=Sp Number,
--      ja=ロケーションコード) 与 field/仓位(en=Bill Sp Name) **已存在** ⇒ 不能无脑 UPDATE ref_key，
--      必须先删掉「目标已存在」的那些旧行（保留既有仓位译名），再改其余。见 §4。
--   2. yj_field.col_name 就是物理列名（QueryService.selectCols 拼 t.[col_name] AS [label]，
--      前端数据键取的是 label）⇒ 改 col_name 必须同步 sp_rename 物理列，二者顺序不能颠倒太多，
--      本脚本 §1/§2 紧邻执行。面板在 §1 与 §2 之间会短暂失效（同一脚本内完成）。
--
-- 【幂等】§1 判 COL_LENGTH 双条件；§2~§5 全部带「旧名存在且新名不存在/不冲突」条件；可重复执行。
--   已改名后再跑 = 全部 no-op，验证段仍输出一致结果。
--
-- 【执行】两个账套都要跑（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST）。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 物理列改名（sp_rename；扩展属性按 column_id 绑定会自动跟随，无需重建） ══════════
IF COL_LENGTH('dbo.bs_wh_loc', N'库位编码') IS NOT NULL AND COL_LENGTH('dbo.bs_wh_loc', N'仓位编码') IS NULL
BEGIN
  EXEC sp_rename N'dbo.bs_wh_loc.库位编码', N'仓位编码', N'COLUMN';
  PRINT N'  ✓ bs_wh_loc.库位编码 → 仓位编码';
END
IF COL_LENGTH('dbo.bs_wh_loc', N'库位地址') IS NOT NULL AND COL_LENGTH('dbo.bs_wh_loc', N'仓位地址') IS NULL
BEGIN
  EXEC sp_rename N'dbo.bs_wh_loc.库位地址', N'仓位地址', N'COLUMN';
  PRINT N'  ✓ bs_wh_loc.库位地址 → 仓位地址';
END
IF COL_LENGTH('dbo.bs_wh', N'库位') IS NOT NULL AND COL_LENGTH('dbo.bs_wh', N'仓位') IS NULL
BEGIN
  EXEC sp_rename N'dbo.bs_wh.库位', N'仓位', N'COLUMN';
  PRINT N'  ✓ bs_wh.库位 → 仓位';
END
GO

-- ══════════ 2. 面板字段元数据（col_name 必须与物理列同名，label 决定前端数据键） ══════════
-- ⚠ 行数必须先落变量：@@ROWCOUNT 会被后续语句（含 PRINT）重置，直接写在 PRINT 里会得到 0。
DECLARE @n1 int, @n2 int, @n3 int;

UPDATE yj_field SET col_name = N'仓位编码', label = N'仓位编码'
WHERE panel_code = 'WHLOC' AND col_name = N'库位编码' AND label = N'库位编码';
SET @n1 = @@ROWCOUNT;

UPDATE yj_field SET col_name = N'仓位地址', label = N'仓位地址'
WHERE panel_code = 'WHLOC' AND col_name = N'库位地址' AND label = N'库位地址';
SET @n2 = @@ROWCOUNT;

UPDATE yj_field SET col_name = N'仓位', label = N'仓位'
WHERE panel_code = 'WH' AND col_name = N'库位' AND label = N'库位';
SET @n3 = @@ROWCOUNT;

PRINT N'  ✓ yj_field WHLOC.库位编码 → 仓位编码 (' + CAST(@n1 AS nvarchar(10)) + N' 行)';
PRINT N'  ✓ yj_field WHLOC.库位地址 → 仓位地址 (' + CAST(@n2 AS nvarchar(10)) + N' 行)';
PRINT N'  ✓ yj_field WH.库位 → 仓位 (' + CAST(@n3 AS nvarchar(10)) + N' 行)';
GO

-- ══════════ 3. 面板名（WHLOC 面板码不变；菜单/权限/URL 全按 panel_code 走，不受影响） ══════════
DECLARE @np int;
UPDATE yj_panel SET panel_name = N'仓位'
WHERE panel_code = 'WHLOC' AND panel_name = N'库位';
SET @np = @@ROWCOUNT;
PRINT N'  ✓ yj_panel WHLOC.panel_name 库位 → 仓位 (' + CAST(@np AS nvarchar(10)) + N' 行)';
GO

-- ══════════ 4. 译名（冲突感知：目标 (scope,ref_key,locale) 已存在则删旧行，保留既有仓位译名） ══════════
DECLARE @d int, @u int;

-- 4.1 panel/库位 ×9 → panel/仓位（无既有 panel/仓位，预期 9 行直接改名、0 行删除）
DELETE o FROM yj_translation o
 WHERE o.scope = 'panel' AND o.ref_key = N'库位'
   AND EXISTS (SELECT 1 FROM yj_translation n WHERE n.scope = 'panel' AND n.ref_key = N'仓位' AND n.locale = o.locale);
SET @d = @@ROWCOUNT;
UPDATE yj_translation SET ref_key = N'仓位' WHERE scope = 'panel' AND ref_key = N'库位';
SET @u = @@ROWCOUNT;
PRINT N'  ✓ panel/库位 → panel/仓位 (改名 ' + CAST(@u AS nvarchar(10)) + N' 行, 冲突删 ' + CAST(@d AS nvarchar(10)) + N' 行)';

-- 4.2 field/库位 ×9 → field/仓位（⚠ en 冲突：已存在 field/仓位/en=Bill Sp Name，旧行删除保留既有）
DELETE o FROM yj_translation o
 WHERE o.scope = 'field' AND o.ref_key = N'库位'
   AND EXISTS (SELECT 1 FROM yj_translation n WHERE n.scope = 'field' AND n.ref_key = N'仓位' AND n.locale = o.locale);
SET @d = @@ROWCOUNT;
UPDATE yj_translation SET ref_key = N'仓位' WHERE scope = 'field' AND ref_key = N'库位';
SET @u = @@ROWCOUNT;
PRINT N'  ✓ field/库位 → field/仓位 (改名 ' + CAST(@u AS nvarchar(10)) + N' 行, 冲突删 ' + CAST(@d AS nvarchar(10)) + N' 行;沿用既有 Bill Sp Name)';

-- 4.3 field/库位编码 ×9 → field/仓位编码（⚠ en/ja 冲突：已存在 Sp Number / ロケーションコード）
DELETE o FROM yj_translation o
 WHERE o.scope = 'field' AND o.ref_key = N'库位编码'
   AND EXISTS (SELECT 1 FROM yj_translation n WHERE n.scope = 'field' AND n.ref_key = N'仓位编码' AND n.locale = o.locale);
SET @d = @@ROWCOUNT;
UPDATE yj_translation SET ref_key = N'仓位编码' WHERE scope = 'field' AND ref_key = N'库位编码';
SET @u = @@ROWCOUNT;
PRINT N'  ✓ field/库位编码 → field/仓位编码 (改名 ' + CAST(@u AS nvarchar(10)) + N' 行, 冲突删 ' + CAST(@d AS nvarchar(10)) + N' 行;沿用金蝶 Sp Number)';

-- 4.4 field/库位地址 ×9 → field/仓位地址（无既有 field/仓位地址，预期 9 行直接改名）
DELETE o FROM yj_translation o
 WHERE o.scope = 'field' AND o.ref_key = N'库位地址'
   AND EXISTS (SELECT 1 FROM yj_translation n WHERE n.scope = 'field' AND n.ref_key = N'仓位地址' AND n.locale = o.locale);
SET @d = @@ROWCOUNT;
UPDATE yj_translation SET ref_key = N'仓位地址' WHERE scope = 'field' AND ref_key = N'库位地址';
SET @u = @@ROWCOUNT;
PRINT N'  ✓ field/库位地址 → field/仓位地址 (改名 ' + CAST(@u AS nvarchar(10)) + N' 行, 冲突删 ' + CAST(@d AS nvarchar(10)) + N' 行)';
GO

-- ══════════ 5. 中文注明（改列名后按 column_id 仍在，只需更新文案；缺失的补上） ══════════
-- 5.1 bs_wh.仓位 列注明（改名后按 column_id 复用旧 property，更新文案）
IF COL_LENGTH('dbo.bs_wh', N'仓位') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.bs_wh')
             AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_wh'), N'仓位', 'ColumnId')
             AND ep.class = 1 AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
      N'仓位(仓库内货位编号,手工录入文本;2026-09-28 仓库档案新增,2026-10-08 由「库位」正名为「仓位」对齐金蝶)',
      N'SCHEMA', N'dbo', N'TABLE', N'bs_wh', N'COLUMN', N'仓位';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description',
      N'仓位(仓库内货位编号,手工录入文本;2026-09-28 仓库档案新增,2026-10-08 由「库位」正名为「仓位」对齐金蝶)',
      N'SCHEMA', N'dbo', N'TABLE', N'bs_wh', N'COLUMN', N'仓位';
END

-- 5.2 bs_wh_loc 表注明（整段重写：库位→仓位）
IF OBJECT_ID('dbo.bs_wh_loc') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_wh_loc')
             AND minor_id = 0 AND class = 1 AND name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
      N'仓位档案(仓库内货位主数据:仓库/仓库编码/仓位编码/仓位地址;一仓多仓位、一仓位一仓;仓库列存仓库名称参照 bs_wh;仓位二维码标签内容=仓库编码@仓位地址@仓位编码。2026-10-08 由「库位档案」正名为「仓位档案」对齐金蝶 sp_number/sp_name)',
      N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description',
      N'仓位档案(仓库内货位主数据:仓库/仓库编码/仓位编码/仓位地址;一仓多仓位、一仓位一仓;仓库列存仓库名称参照 bs_wh;仓位二维码标签内容=仓库编码@仓位地址@仓位编码。2026-10-08 由「库位档案」正名为「仓位档案」对齐金蝶 sp_number/sp_name)',
      N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc';
END

-- 5.3 bs_wh_loc.仓位编码 / 仓位地址 列注明（原先缺注,本次补上——AGENTS.md:改结构时鼓励补注）
IF COL_LENGTH('dbo.bs_wh_loc', N'仓位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.class = 1 AND ep.name = 'MS_Description' AND c.name = N'仓位编码')
  EXEC sp_addextendedproperty N'MS_Description',
    N'仓位编码(仓位的业务标识;对齐金蝶 sp_number;二维码第三段;原「库位编码」2026-10-08 正名)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'仓位编码';

IF COL_LENGTH('dbo.bs_wh_loc', N'仓位地址') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.class = 1 AND ep.name = 'MS_Description' AND c.name = N'仓位地址')
  EXEC sp_addextendedproperty N'MS_Description',
    N'仓位地址(货位在库内的位置描述;二维码第二段;原「库位地址」2026-10-08 正名)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'仓位地址';

-- 5.4 bs_wh_loc.仓库编码 列注明（文案含「库位二维码首段」→ 改「仓位二维码首段」）
IF COL_LENGTH('dbo.bs_wh_loc', N'仓库编码') IS NOT NULL AND EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.class = 1 AND ep.name = 'MS_Description' AND c.name = N'仓库编码')
  EXEC sp_updateextendedproperty N'MS_Description',
    N'仓库编码(所属仓库的业务编码,选择仓库时参照带回自 bs_wh.仓库编码;仓位二维码首段;2026-09-28 仓位档案新增,2026-10-08 文案正名)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'仓库编码';
GO

-- ══════════ 6. 验证（改名后应全为 0 / 预期值） ══════════
-- 注:字节数 = 字符数×2(nvarchar)。仓位编码 nvarchar(100)=200、仓位地址 nvarchar(200)=400、bs_wh.仓位 nvarchar(200)=400。
-- 注:「MS_Description 含库位」刻意排除本脚本自己写的正名说明(「由「库位」正名为「仓位」」/「原「库位编码」」)
--     —— 那是有意留下的沿革记录,不是残留。
SELECT N'物理列 库位编码 残留(应 NULL)' AS 检查项, CAST(COL_LENGTH('dbo.bs_wh_loc', N'库位编码') AS nvarchar(10)) AS 值
UNION ALL SELECT N'物理列 库位地址 残留(应 NULL)', CAST(COL_LENGTH('dbo.bs_wh_loc', N'库位地址') AS nvarchar(10))
UNION ALL SELECT N'物理列 bs_wh.库位 残留(应 NULL)', CAST(COL_LENGTH('dbo.bs_wh', N'库位') AS nvarchar(10))
UNION ALL SELECT N'物理列 仓位编码 存在(应 200)', CAST(COL_LENGTH('dbo.bs_wh_loc', N'仓位编码') AS nvarchar(10))
UNION ALL SELECT N'物理列 仓位地址 存在(应 400)', CAST(COL_LENGTH('dbo.bs_wh_loc', N'仓位地址') AS nvarchar(10))
UNION ALL SELECT N'物理列 bs_wh.仓位 存在(应 400)', CAST(COL_LENGTH('dbo.bs_wh', N'仓位') AS nvarchar(10))
UNION ALL SELECT N'yj_panel 名为库位(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_panel WHERE panel_name LIKE N'%库位%'
UNION ALL SELECT N'yj_field 含库位(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE col_name LIKE N'%库位%' OR label LIKE N'%库位%'
UNION ALL SELECT N'yj_translation 含库位(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation WHERE ref_key LIKE N'%库位%' OR text LIKE N'%库位%'
UNION ALL SELECT N'MS_Description 含库位(排除正名说明,应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.extended_properties
  WHERE class = 1 AND name = 'MS_Description' AND CAST(value AS nvarchar(400)) LIKE N'%库位%'
    AND CAST(value AS nvarchar(400)) NOT LIKE N'%正名%'
UNION ALL SELECT N'WHLOC 面板字段数(应 6)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code = 'WHLOC'
UNION ALL SELECT N'仓位编码 译名语言数(应 9)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation WHERE scope = 'field' AND ref_key = N'仓位编码'
UNION ALL SELECT N'仓位地址 译名语言数(应 9)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation WHERE scope = 'field' AND ref_key = N'仓位地址'
UNION ALL SELECT N'panel/仓位 译名语言数(应 9)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'仓位'
UNION ALL SELECT N'bs_wh_loc 行数(应 5,数据无损)', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.bs_wh_loc;
GO
PRINT N'migrate-whloc-rename-bin-20261008 完成';
GO
