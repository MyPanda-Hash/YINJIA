/* ============================================================
   migrate-wo-report-list-product-cols-20261108.sql — 2026-11-08
   报工记录(WO_REPORT_LIST)增列/增查询条件:产品编码 · 产品规格 · 客户编码

   用户口径(2026-11-08,第 3、4 条)原文:
     「3 报工记录,需要显示产品编码、产品规格。
      4 报工记录,要能根据产品编码/客户编码/产品规格查询报工记录,这个原来的查询功能就能实现,
       也就是说当前的报工记录需要增加这些内容。」
   ⇒ 落地口径:产品编码、产品规格 = 显示列 + 查询条件;客户编码 = **只查询、不显示列**。

   依据与口径:
   ① 报工记录 = 面板 WO_REPORT_LIST(yj_panel.mode='flat',line_table='scjl',page_size=50),
      自 2026-09-27「scjl 单表化」起 scjl 就是报工记录的**唯一事实载体**;
      本次要用的镜像列**物理上早已存在且有数据** ⇒ 不改表结构、不改后端代码,只补元数据 + 译名:
        scjl.wzdm = 物料编码(本面板显示为「产品编码」)
        scjl.gg   = 规格型号(本面板显示为「产品规格」)
        scjl.khdm = 客户代码(dm_kh 客户档案编码,本面板查询条件为「客户编码」)
      写入侧 WoReportService 审核/保存已回填(wzdm/gg/khdm/mc),无需另行搬数。
      正式库 2026-11-08 实测:有效行 1163 行,wzdm/khdm 100% 有值、gg 1124 行有值;
      scjl.wzdm 1163/1163 可对上 bs_inv.存货编码,scjl.khdm 1163/1163 可对上 dm_kh.dm
      ⇒ 参照面板 INV / KHDA 与数据源同源,不会出现「点击下拉全是空/选不中」。
   ② 产品编码 → 参照 INV(存货编码;display_field=存货名称),与同族面板 WO_COMPLETION_LIST
      (同为 scjl 上的 flat 报表)的「产品编码」配置同款。
      查询走 QueryService.appendDirectFilters 的「参照字段等值匹配」⇒ RTRIM(wzdm)=选中的存货编码,精确过滤。
   ③ 产品规格 → 文本;查询走 LIKE '%值%'(规格串形如 60*45*231,适合包含式检索)。
   ④ 客户编码 → 参照 KHDA(客户档案;ref_field=dm 即客户编码,display_field=mc 客户名称;先例 SO_ORDER.客户编码)。
      「只查询、不显示列」= place 只写 query **且 visible=0** —— ⚠ flat 报表的表格列是
      PanelConfigService.buildDocConfig 的 `flat ? def.fields() : fieldsAt("detail")` 再经
      buildGridColumns(**只按 visible 过滤,place 不参与列过滤**)生成的,所以只写 place='query' 仍会
      在表格里多出一列;先例:MATERIAL_OUT_DETAIL / MATERIAL_OUT_STATS 的「材料」查询字段就是
      place='query' + visible=0。查询条件区取 fieldsAt("query")(不看 visible)⇒ 仍会出现在查询栏。
   ⑤ 顺序:紧随「工单行号」(seq 36)、排在「工序」(seq 40)之前 ⇒ seq 37/38/39。
   ⑥ yj_panel 不动(数据源 scjl / page_size=50 / 分类 / 菜单均保持原样);不动任何物理表列。

   幂等:
     · yj_field 按 (panel_code,label) 不存在才插(**不覆盖**既有行;万一已存在但配置不符,末尾自检会 fail 而不是静默);
     · 客户编码「只查不显示列」用窄条件 UPDATE(panel_code+label 精确 + 只动 visible=1 的行)收敛 visible=0,重跑命中 0 行;
     · yj_translation 按唯一键 (scope,ref_key,locale) 不存在才插;
     · 「产品规格」en 现值是**未翻译的中文**「产品规格」⇒ 用窄条件 UPDATE 修正为 Product Specification
       (仅改 text 恰为该中文的行;重跑命中 0 行,不会反复覆盖人工译名)。
   自检:末尾 RAISERROR(severity 16) 逐项校验,任何一项不符 ⇒ 本次迁移**失败**且 DbSync 不记账;
         severity 10 的 RAISERROR 用来打印结论/现役配置(PRINT 在 DbSync 里不显示,见 migrate-rd-progress-singledoc.sql 头注)。
   两账套:先正式库 HSDZ_MES、后测试库 HSDZ_MES_TEST,**两个都要执行**(脚本幂等)。
   ⚠ 测试库是正式库的旧快照:2026-11-08 实测两库 scjl 均已有 wzdm/gg/khdm 列,本脚本可直接跑;
     若某库缺这些物理列,脚本第 0 批会 fail fast —— 那是表结构问题(需重建测试库),**不要**在本脚本里代偿加列。
   ============================================================ */
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ── 0. 前置守卫:面板在册 + 数据源物理列齐(缺则 fail fast,绝不只加面板字段把列表查询打成 500) ──
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = N'WO_REPORT_LIST')
    RAISERROR(N'[FAIL] 面板 WO_REPORT_LIST 在 yj_panel 不存在,先确认库结构', 16, 1) WITH NOWAIT;
IF COL_LENGTH(N'dbo.scjl', N'wzdm') IS NULL
   OR COL_LENGTH(N'dbo.scjl', N'gg') IS NULL
   OR COL_LENGTH(N'dbo.scjl', N'khdm') IS NULL
    RAISERROR(N'[FAIL] 数据源 scjl 缺 wzdm/gg/khdm 列,不能只加面板字段(表结构问题,另行处置)', 16, 1) WITH NOWAIT;
GO

-- ── 1. yj_field 追加 3 行(仅当 (panel_code,label) 不存在时插) ────────────────────────────
-- 产品编码:显示列 + 查询条件(参照 INV,存存货编码;与 WO_COMPLETION_LIST 同款)
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'WO_REPORT_LIST' AND label = N'产品编码')
    INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                              place, seq, width, editable, required, hidden, visible)
    VALUES (N'WO_REPORT_LIST', N'wzdm', N'产品编码', N'参照', N'INV', N'存货编码', N'存货名称',
            N'query,detail', 37, 140, 0, 0, 0, 1);
GO

-- 产品规格:显示列 + 查询条件(文本,LIKE 模糊)
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'WO_REPORT_LIST' AND label = N'产品规格')
    INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                              place, seq, width, editable, required, hidden, visible)
    VALUES (N'WO_REPORT_LIST', N'gg', N'产品规格', N'文本', NULL, NULL, NULL,
            N'query,detail', 38, 150, 0, 0, 0, 1);
GO

-- 客户编码:只查询(place 仅 query + visible=0 ⇒ 不进列表列、只进查询栏;参照 KHDA 存 dm 客户编码)
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'WO_REPORT_LIST' AND label = N'客户编码')
    INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field,
                              place, seq, width, editable, required, hidden, visible)
    VALUES (N'WO_REPORT_LIST', N'khdm', N'客户编码', N'参照', N'KHDA', N'dm', N'mc',
            N'query', 39, 140, 0, 0, 0, 0);
GO

-- 收敛「只查询不显示列」:若该行已存在且 visible=1(例如首版脚本只写了 place='query'),改回 visible=0。
-- 窄条件(panel_code+label 精确命中,且只动 visible=1 的行)+ 行数守卫,重跑命中 0 行。
UPDATE dbo.yj_field SET visible = 0
 WHERE panel_code = N'WO_REPORT_LIST' AND label = N'客户编码' AND visible = 1;
IF @@ROWCOUNT > 1 RAISERROR(N'[FAIL] 收敛 客户编码.visible 命中多行,请人工核对 yj_field', 16, 1);
GO

-- ── 2. 译名(scope='field';标签全局共享,按 (scope,ref_key,locale) 幂等) ────────────────
-- 产品规格:en 现值是未翻译的中文「产品规格」(历史遗留),这里补 9 语种(含 en 正确值);
-- 客户编码:产品编码/规格书等面板已有 9 语种,此处按同款补齐 —— 已有语种不会重复插。
;WITH tr(ref_key, locale, text) AS (
    SELECT * FROM (VALUES
        (N'产品规格', N'en', N'Product Specification'),
        (N'产品规格', N'ja', N'製品仕様'),
        (N'产品规格', N'ko', N'제품 사양'),
        (N'产品规格', N'es', N'Especificación del producto'),
        (N'产品规格', N'fr', N'Spécification du produit'),
        (N'产品规格', N'de', N'Produktspezifikation'),
        (N'产品规格', N'ru', N'Спецификация продукта'),
        (N'产品规格', N'vi', N'Quy cách sản phẩm'),
        (N'产品规格', N'th', N'ข้อกำหนดผลิตภัณฑ์'),
        (N'客户编码', N'en', N'Customer Code'),
        (N'客户编码', N'ja', N'顧客コード'),
        (N'客户编码', N'ko', N'고객 코드'),
        (N'客户编码', N'es', N'Código del cliente'),
        (N'客户编码', N'fr', N'Code client'),
        (N'客户编码', N'de', N'Kundennummer'),
        (N'客户编码', N'ru', N'Код клиента'),
        (N'客户编码', N'vi', N'Mã khách hàng'),
        (N'客户编码', N'th', N'รหัสลูกค้า')
    ) v(a, b, c)
)
INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', t.ref_key, t.locale, t.text, N'manual'
FROM tr t
WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                   WHERE x.scope = N'field' AND x.ref_key = t.ref_key AND x.locale = t.locale);
GO

-- 修正历史占位:产品规格 en 曾被写成中文(等值窄条件,重跑命中 0 行;人工已改成英文则不动)
UPDATE dbo.yj_translation
   SET text = N'Product Specification', source = N'manual'
 WHERE scope = N'field' AND ref_key = N'产品规格' AND locale = N'en' AND text = N'产品规格';
GO

-- ── 3. 自检:字段配置 + 译名(severity 16 ⇒ 迁移失败,DBSync 不写 yj_schema_log) ──────────
DECLARE @bad int = 0;

-- ① 3 行字段都在,且关键配置与口径逐项相符(顺序/宽度/可见性/参照源)
IF (SELECT COUNT(*) FROM dbo.yj_field
     WHERE panel_code = N'WO_REPORT_LIST' AND label IN (N'产品编码', N'产品规格', N'客户编码')) <> 3
    SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field
                WHERE panel_code = N'WO_REPORT_LIST' AND label = N'产品编码' AND col_name = N'wzdm'
                  AND data_type = N'参照' AND ref_panel = N'INV' AND ref_field = N'存货编码'
                  AND display_field = N'存货名称' AND place = N'query,detail'
                  AND seq = 37 AND width = 140 AND visible = 1 AND hidden = 0)
    SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field
                WHERE panel_code = N'WO_REPORT_LIST' AND label = N'产品规格' AND col_name = N'gg'
                  AND data_type = N'文本' AND ref_panel IS NULL AND place = N'query,detail'
                  AND seq = 38 AND width = 150 AND visible = 1 AND hidden = 0)
    SET @bad = @bad + 1;
-- 客户编码 = 只查询:place 必须恰为 query(不含 detail)**且 visible=0**(flat 面板的列只按 visible 过滤,
-- 否则会多出一列)—— 防止以后误把「只查不显示」改成出列
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field
                WHERE panel_code = N'WO_REPORT_LIST' AND label = N'客户编码' AND col_name = N'khdm'
                  AND data_type = N'参照' AND ref_panel = N'KHDA' AND ref_field = N'dm'
                  AND display_field = N'mc' AND place = N'query'
                  AND seq = 39 AND width = 140 AND visible = 0 AND hidden = 0)
    SET @bad = @bad + 1;

-- ② 译名:产品规格 / 客户编码 各 9 个启用语种齐全;产品规格 en 必须已是英文
IF (SELECT COUNT(DISTINCT locale) FROM dbo.yj_translation
     WHERE scope = N'field' AND ref_key = N'产品规格'
       AND locale IN ('en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th')) <> 9
    SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM dbo.yj_translation
            WHERE scope = N'field' AND ref_key = N'产品规格' AND locale = N'en' AND text = N'产品规格')
    SET @bad = @bad + 1;
IF (SELECT COUNT(DISTINCT locale) FROM dbo.yj_translation
     WHERE scope = N'field' AND ref_key = N'客户编码'
       AND locale IN ('en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th')) <> 9
    SET @bad = @bad + 1;

IF @bad > 0
    RAISERROR(N'[FAIL] 报工记录增列自检失败:%d 项不符(字段配置/译名),详见脚本 §3 口径', 16, 1, @bad) WITH NOWAIT;
ELSE
BEGIN
    DECLARE @info nvarchar(1200) = N'';
    SELECT @info = @info + N' | ' + label + N'(' + col_name + N'):' + data_type
                 + N' ' + place + N' seq=' + CAST(seq AS nvarchar(10))
                 + N' w=' + CAST(ISNULL(width, 0) AS nvarchar(10))
      FROM dbo.yj_field
     WHERE panel_code = N'WO_REPORT_LIST' AND label IN (N'产品编码', N'产品规格', N'客户编码')
     ORDER BY seq;
    RAISERROR(N'[PASS] 报工记录 WO_REPORT_LIST:产品编码(wzdm)/产品规格(gg) 已可显示+查询,客户编码(khdm) 已仅查询;产品规格/客户编码 译名各 9 语种齐', 10, 1) WITH NOWAIT;
    RAISERROR(N'[当前配置]%s', 10, 1, @info) WITH NOWAIT;
END
GO
