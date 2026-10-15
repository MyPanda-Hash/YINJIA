-- migrate-bs-inv-inspection-align-20261015.sql
-- 目标:把商品档案 bs_inv 的「来料检验」口径**完整对齐服务器**,让「送料暂收单 → 生成检验或入库单」
--   按钮在本地两账套不再 500。
--
-- 背景(2026-10-15 实测,三库对比):
--   · 代码 QcRecvGenerateHandler.java:177 按 `bs_inv.来料检验` 逐行分流(是 → 来料检验单,其余 → 采购入库单),
--     这是 2026-10-05 用户口径「生单不再人工二选一,按商品档案的来料检验字段判定」。
--   · 服务器备份库(YJMES2_SRV_1015,源 = yjmes2.bak)有真实列 `来料检验` nvarchar(10) NULL,
--     **且是活数据**:否 3918 行 / 是 9 行。
--   · 本地 HSDZ_MES / HSDZ_MES_TEST 没有这一列,只有**上一代的计算列**
--       [是否来料检验] AS CASE WHEN RTRIM(ISNULL(检验方式,''))='1' THEN N'是' ELSE N'否' END
--     (建列见 migrate-po-inbound-fields.sql:20)⇒ 代码一查就 Invalid column name '来料检验'。
--   · 该列本该由 migrate-material-inspection-field.sql(2026-09-20)建,但那条脚本**登记为已执行、
--     效果却不在库**(2026-09-28 09:59 那批疑似 baseline 只登记未执行)—— 同类残留见同日
--     `qc_insp_detail.单位`(已用 DbSync run migrate-sl-chain-fixes.sql 补回)。
--
-- 口径(用户 2026-10-15 拍板「A 完整对齐服务器」):以服务器现状为准,不自行发明第三种形态:
--   ① 物理列:建真实列 `来料检验` nvarchar(10) NULL,值从旧计算列 `是否来料检验` 回填(行为不变),
--      然后**删掉旧计算列**(服务器没有它)⇒ bs_inv 列数 148 不变(+1 −1);
--   ② 面板字段(逐项对齐服务器 sys 实测,见下)——
--        INV·是否来料检验(文本, header, seq 45) ⇒ **INV·来料检验**(文本, detail, seq 44, 只读)
--        INV·检验方式(下拉框, detail, seq 900)    ⇒ **INV·商品类型**(文本, detail, seq 900, 无字典)
--      (服务器 INV 面板就是这两个名字;QC_PLAN/FINISH_IN 的「检验方式」是**别的表自己的列**,不动)
--   ③ 译名:来料检验 = Incoming Inspection / 商品类型 = Item Type(已有则跳过,多语言强制规范)
--   ④ 列注明:补 `来料检验` 的中文注明
--
-- 安全性核查(2026-10-15,HSDZ_MES 实测):`bs_inv.是否来料检验 / 来料检验` **不被任何视图、存储过程、
--   索引或约束引用**(sys.sql_modules + sys.sql_expression_dependencies + sys.index_columns 三查皆空),
--   故 DROP 无连带;Java 侧 `是否来料检验` 的引用全部落在 bl_purchase_in(**采购入库行**,另一张表)。
-- 幂等:逐段判存在,重跑全 no-op。两账套都执行(先正式后测试)。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ═══ ① 物理列:建真实列 来料检验 ═══ */
IF COL_LENGTH('dbo.bs_inv', N'来料检验') IS NULL
BEGIN
  ALTER TABLE dbo.bs_inv ADD [来料检验] nvarchar(10) NULL;
  PRINT N'[OK] bs_inv.来料检验 已添加 nvarchar(10) NULL';
END
ELSE PRINT N'[SKIP] bs_inv.来料检验 已存在';
GO

/* ═══ ② 回填(必须动态 SQL:本列稍后会被 DROP,而批内编译期就解析列名 —— 同批再写一次
       `UPDATE … = [是否来料检验]` 会在**重跑时**报「列名 '是否来料检验' 无效」把整批连坐拒执行,
       2026-10-15 DbSync 重跑实测踩到。sp_executesql 只在真要执行时才编译 ⇒ 幂等) ═══ */
IF COL_LENGTH('dbo.bs_inv', N'是否来料检验') IS NOT NULL
BEGIN
  EXEC sp_executesql N'UPDATE dbo.bs_inv SET [来料检验] = [是否来料检验]
                        WHERE [来料检验] IS NULL AND [是否来料检验] IS NOT NULL;';
  PRINT N'[回填] bs_inv.来料检验 ← 是否来料检验(旧计算列)';
END
ELSE PRINT N'[SKIP] 旧计算列 是否来料检验 已不在,无需回填';
GO

/* ═══ ③ 面板字段:INV 是否来料检验 → 来料检验(place/seq/可见性对齐服务器) ═══ */
UPDATE yj_field SET col_name = N'来料检验', label = N'来料检验',
       data_type = N'文本', place = N'detail', seq = 44, editable = 0, visible = 1, hidden = 1
 WHERE panel_code = 'INV' AND col_name = N'是否来料检验';
PRINT N'[字段] INV·是否来料检验 → 来料检验: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ═══ ④ 面板字段:INV 检验方式 → 商品类型(服务器口径:文本、无字典;只动 INV,别的面板有自己的同名列) ═══ */
UPDATE yj_field SET col_name = N'商品类型', label = N'商品类型', data_type = N'文本', dict_sql = NULL
 WHERE panel_code = 'INV' AND col_name = N'检验方式';
PRINT N'[字段] INV·检验方式 → 商品类型: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ═══ ⑤ 删旧计算列(服务器没有它;已核查无视图/过程/索引引用) ═══ */
IF COL_LENGTH('dbo.bs_inv', N'是否来料检验') IS NOT NULL
BEGIN
  ALTER TABLE dbo.bs_inv DROP COLUMN [是否来料检验];
  PRINT N'[OK] bs_inv.是否来料检验(旧计算列)已删除';
END
ELSE PRINT N'[SKIP] bs_inv.是否来料检验 不存在';
GO

/* ═══ ⑥ 译名(多语言强制规范;已有则跳过) ═══ */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'来料检验', v.loc, v.txt, 'manual'
FROM (VALUES ('en',N'Incoming Inspection'),('ja',N'受入検査'),('ko',N'수입 검사'),('zh-TW',N'來料檢驗'),
             ('es',N'Inspección de entrada'),('fr',N'Contrôle réception'),('de',N'Eingangsprüfung'),
             ('ru',N'Входной контроль'),('vi',N'Kiểm tra đầu vào'),('th',N'ตรวจรับวัตถุดิบ')) AS v(loc, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope='field' AND t.ref_key=N'来料检验' AND t.locale=v.loc);
PRINT N'[译名] 来料检验 已补';
GO
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'商品类型', v.loc, v.txt, 'manual'
FROM (VALUES ('en',N'Item Type'),('ja',N'商品タイプ'),('ko',N'상품 유형'),('zh-TW',N'商品類型'),
             ('es',N'Tipo de artículo'),('fr',N'Type d''article'),('de',N'Artikeltyp'),
             ('ru',N'Тип товара'),('vi',N'Loại hàng'),('th',N'ประเภทสินค้า')) AS v(loc, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope='field' AND t.ref_key=N'商品类型' AND t.locale=v.loc);
PRINT N'[译名] 商品类型 已补';
GO

/* ═══ ⑦ 列注明(ep.class = 1 必须带,否则 index_id 会撞上列的 minor_id 静默漏写) ═══ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bs_inv')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_inv'), N'来料检验', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'来料检验(金蝶商品自定义字段同步,值 是/否;金蝶界面维护,MES只读)。送料暂收单「生成检验或入库单」按它逐行分流:是→来料检验单,其余→采购入库单',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_inv', N'COLUMN', N'来料检验';
ELSE
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料检验(金蝶商品自定义字段同步,值 是/否;金蝶界面维护,MES只读)。送料暂收单「生成检验或入库单」按它逐行分流:是→来料检验单,其余→采购入库单',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_inv', N'COLUMN', N'来料检验';
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0;
-- ① 物理列就位、旧列已走
IF COL_LENGTH('dbo.bs_inv', N'来料检验') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH('dbo.bs_inv', N'是否来料检验') IS NOT NULL SET @bad = @bad + 1;
-- ② 列定义 = 服务器实测 nvarchar(10) NULL
IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
               WHERE c.object_id = OBJECT_ID(N'dbo.bs_inv') AND c.name = N'来料检验'
                 AND t.name = N'nvarchar' AND c.max_length / 2 = 10 AND c.is_nullable = 1) SET @bad = @bad + 1;
-- ③ 面板字段与服务器一致
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'来料检验'
                 AND label=N'来料检验' AND place=N'detail' AND seq=44 AND editable=0 AND hidden=1) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name=N'商品类型'
                 AND data_type=N'文本' AND place=N'detail' AND seq=900) SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code='INV' AND col_name IN (N'是否来料检验', N'检验方式')) SET @bad = @bad + 1;
-- ④ 译名各 ≥10 语言
IF (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'来料检验') < 10 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key=N'商品类型') < 10 SET @bad = @bad + 1;
-- ⑤ 列注明非空
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bs_inv')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_inv'), N'来料检验', 'ColumnId')
                 AND ep.name = N'MS_Description' AND LEN(LTRIM(RTRIM(CAST(ep.value AS nvarchar(400))))) > 0) SET @bad = @bad + 1;
-- ⑥ 列数仍是 148(+1 −1)
DECLARE @n int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bs_inv'));
IF @n <> 148 SET @bad = @bad + 1;

DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:bs_inv %d 列(应 148);来料检验 就位/定义/字段/译名/注明 不符项 %d 条', 10, 1, @dbn, @n, @bad);
IF @bad = 0
  RAISERROR(N'[OK] bs_inv 来料检验口径已完整对齐服务器(真实列+回填+INV 字段改名+译名+注明)', 10, 1);
ELSE
  RAISERROR(N'[FAIL] bs_inv 对齐自检未过(见上一行数字)', 16, 1);
GO
