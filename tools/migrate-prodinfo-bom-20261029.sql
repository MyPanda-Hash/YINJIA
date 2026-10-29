-- migrate-prodinfo-bom-20261029.sql
-- 产品信息表(RD_PROD_INFO)按 2026-10-29 新版设计改版:补 4 个头字段 + 新增「产品BOM表」明细列。
--
-- 用户口径(2026-10-29 两张设计图 + 四项确认):
--   「产品信息表和产品规格书的面板有一些需要调整,格式变了,按上面说的来改」
--   确认项:① BOM 表真做(明细表 + 可录入 + 从物料清单导入);② 新增 4 个真字段;
--          ③ 规格书封面删「客户名称」;④ 规格书版本改「V+年月日」。
--
-- 新版设计《产品信息表》纸面结构:
--   ㈠ 表头:公司名 | 单据编号;  产品名称(大标题) | 编辑人 / 日期
--   ㈡ 一、产品基本信息:项目编号|项目名称、产品编号|客户名称、客户料号|产品管控等级、
--                       产品功能类别|产品形态、应用场景(整行)
--   ㈢ 二、规格与尺寸:产品整体尺寸 / 炭棒尺寸(外径·内径·长度)
--   ㈣ 三、产品BOM表:物料编号|物料名称|尺寸规格|数量   ← 本节本次**新增**(原设计没有)
--   ㈤ 四、特殊性能描述 / 五、文件与签署
--
-- 本脚本只做**结构 + 元数据**;纸面版式在 frontend/src/core/views/recordSheetConfigs.js。
-- 幂等:所有加列/加字段都先判存在;两个账套(HSDZ_MES / HSDZ_MES_TEST)都要跑。
SET NOCOUNT ON;

-- ═══════════════════ 一、头表新增 4 列 ═══════════════════
-- 为什么是"真列"而不是复用:
--   · 项目编号 —— 与现有「立项文档编号」语义同源但**不是同一个格子**(设计一行两格:项目编号|项目名称),
--     且「立项文档编号」是下游「项目进度查询」配对用的物理列,改名会断参照 ⇒ 新增、旧列保留不上纸面;
--   · 项目名称 —— 现有头表完全没有(立项申请只有 文档编号/项目等级,没有项目名称);
--   · 客户名称 —— 现有只有「客户项目名称」(项目维度),而设计这一格是客户维度;
--     规格书封面那一格叫「客户名称」但物理列是 `客户名`(RD_SPEC_DOC 自己的列),两边不同表不冲突;
--   · 应用场景 —— 现有头表完全没有(规格书里那一列是 rd_spec_doc_head.应用场景)。
IF COL_LENGTH('rd_prod_info_head', '项目编号') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_head ADD 项目编号 nvarchar(200) NULL;
    PRINT N'[OK] rd_prod_info_head + 项目编号';
END
ELSE PRINT N'[SKIP] rd_prod_info_head.项目编号 已存在';

IF COL_LENGTH('rd_prod_info_head', '项目名称') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_head ADD 项目名称 nvarchar(200) NULL;
    PRINT N'[OK] rd_prod_info_head + 项目名称';
END
ELSE PRINT N'[SKIP] rd_prod_info_head.项目名称 已存在';

IF COL_LENGTH('rd_prod_info_head', '客户名称') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_head ADD 客户名称 nvarchar(200) NULL;
    PRINT N'[OK] rd_prod_info_head + 客户名称';
END
ELSE PRINT N'[SKIP] rd_prod_info_head.客户名称 已存在';

IF COL_LENGTH('rd_prod_info_head', '应用场景') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_head ADD 应用场景 nvarchar(1000) NULL;
    PRINT N'[OK] rd_prod_info_head + 应用场景';
END
ELSE PRINT N'[SKIP] rd_prod_info_head.应用场景 已存在';

-- ═══════════════════ 二、明细表新增 BOM 5 列 ═══════════════════
-- rd_prod_info_detail 此前**一张真列都没有**(只有 单据编号 + 备用1..20 占位列、0 行数据),
-- 所以这里按单据明细规范补齐:分区列(表区)一律不加 —— 本面板只有一张明细表,不需要分区
-- (分区列是"多张逻辑表共用一张物理行表"时的补丁,见 CONTEXT「表区是物理列」)。
IF COL_LENGTH('rd_prod_info_detail', '序号') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_detail ADD 序号 nvarchar(20) NULL;
    PRINT N'[OK] rd_prod_info_detail + 序号';
END
ELSE PRINT N'[SKIP] rd_prod_info_detail.序号 已存在';

IF COL_LENGTH('rd_prod_info_detail', '物料编号') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_detail ADD 物料编号 nvarchar(120) NULL;
    PRINT N'[OK] rd_prod_info_detail + 物料编号';
END
ELSE PRINT N'[SKIP] rd_prod_info_detail.物料编号 已存在';

IF COL_LENGTH('rd_prod_info_detail', '物料名称') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_detail ADD 物料名称 nvarchar(200) NULL;
    PRINT N'[OK] rd_prod_info_detail + 物料名称';
END
ELSE PRINT N'[SKIP] rd_prod_info_detail.物料名称 已存在';

IF COL_LENGTH('rd_prod_info_detail', '尺寸规格') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_detail ADD 尺寸规格 nvarchar(500) NULL;
    PRINT N'[OK] rd_prod_info_detail + 尺寸规格';
END
ELSE PRINT N'[SKIP] rd_prod_info_detail.尺寸规格 已存在';

IF COL_LENGTH('rd_prod_info_detail', '数量') IS NULL
BEGIN
    ALTER TABLE rd_prod_info_detail ADD 数量 nvarchar(50) NULL;
    PRINT N'[OK] rd_prod_info_detail + 数量';
END
ELSE PRINT N'[SKIP] rd_prod_info_detail.数量 已存在';

-- ═══════════════════ 三、中文注明(MS_Description,规范强制) ═══════════════════
DECLARE @tbl sysname, @col sysname, @desc nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT * FROM (VALUES
        ('rd_prod_info_head', '项目编号',   N'项目编号(本产品属于哪一次立项;与「立项文档编号」同源但独立一格)'),
        ('rd_prod_info_head', '项目名称',   N'项目名称'),
        ('rd_prod_info_head', '客户名称',   N'客户名称(客户维度;「客户项目名称」是项目维度,两者并存)'),
        ('rd_prod_info_head', '应用场景',   N'应用场景'),
        ('rd_prod_info_detail', '序号',     N'序号'),
        ('rd_prod_info_detail', '物料编号', N'BOM 物料编号(可从物料清单引用)'),
        ('rd_prod_info_detail', '物料名称', N'BOM 物料名称'),
        ('rd_prod_info_detail', '尺寸规格', N'BOM 尺寸规格(含尺寸公差)'),
        ('rd_prod_info_detail', '数量',     N'BOM 用量')
    ) v(t, c, d);
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @desc;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.extended_properties ep
        JOIN sys.objects o ON ep.major_id = o.object_id
        JOIN sys.columns c2 ON c2.object_id = o.object_id AND c2.column_id = ep.minor_id
        WHERE o.name = @tbl AND c2.name = @col AND ep.name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @desc, N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    FETCH NEXT FROM cur INTO @tbl, @col, @desc;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] 中文注明已补';

-- ═══════════════════ 四、yj_field 元数据 ═══════════════════
-- 头字段 4 条(place='header';纸面顺序由 recordSheetConfigs 决定,seq 只影响编辑面板/列表)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'项目编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'项目编号', N'项目编号', N'文本', 'header', 34, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'项目名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'项目名称', N'项目名称', N'文本', 'header', 35, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'客户名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'客户名称', N'客户名称', N'文本', 'header', 41, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'应用场景')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'应用场景', N'应用场景', N'文本', 'header', 48, 200, 1, 0, 0, 1);

-- 明细字段 5 条(place='detail';宽度合计 70+150+220+500+100 = 1040 = 本面板纸面网格 130+260+130+260)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'序号', N'序号', N'文本', 'detail', 5, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'物料编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'物料编号', N'物料编号', N'文本', 'detail', 10, 150, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'物料名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'物料名称', N'物料名称', N'文本', 'detail', 20, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'尺寸规格')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'尺寸规格', N'尺寸规格', N'文本', 'detail', 30, 500, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND label=N'数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'数量', N'数量', N'文本', 'detail', 40, 100, 1, 0, 0, 1);
PRINT N'[OK] yj_field 元数据已补';

-- 明细列宽与纸面配置对齐(纸面 150/180/330/120,合计 780 = 本面板纸面网格 130+260+130+260)。
-- 只影响「编辑面板/列表页明细表」的列宽观感,不影响纸面(纸面宽度在 recordSheetConfigs.js)。
UPDATE yj_field SET width = 70  WHERE panel_code='RD_PROD_INFO' AND label=N'序号'     AND ISNULL(width,0) <> 70;
UPDATE yj_field SET width = 150 WHERE panel_code='RD_PROD_INFO' AND label=N'物料编号' AND ISNULL(width,0) <> 150;
UPDATE yj_field SET width = 180 WHERE panel_code='RD_PROD_INFO' AND label=N'物料名称' AND ISNULL(width,0) <> 180;
UPDATE yj_field SET width = 330 WHERE panel_code='RD_PROD_INFO' AND label=N'尺寸规格' AND ISNULL(width,0) <> 330;
UPDATE yj_field SET width = 120 WHERE panel_code='RD_PROD_INFO' AND label=N'数量'     AND ISNULL(width,0) <> 120;

-- ═══════════════════ 五、英译(多语言强制规范) ═══════════════════
-- 其余 9 个键在库里已有 en 词条,只补缺的「尺寸规格」。
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'尺寸规格' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'尺寸规格', 'en', N'Dimension Spec', 'manual');

-- ═══════════════════ 自检 ═══════════════════
SELECT '新列' AS 检查项,
       (CASE WHEN COL_LENGTH('rd_prod_info_head','项目编号') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH('rd_prod_info_head','项目名称') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH('rd_prod_info_head','客户名称') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH('rd_prod_info_head','应用场景') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH('rd_prod_info_detail','序号') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH('rd_prod_info_detail','物料编号') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH('rd_prod_info_detail','物料名称') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH('rd_prod_info_detail','尺寸规格') IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN COL_LENGTH('rd_prod_info_detail','数量') IS NOT NULL THEN 1 ELSE 0 END) AS 应有9;
SELECT 'yj_field' AS 检查项, COUNT(*) AS 应有9
FROM yj_field WHERE panel_code='RD_PROD_INFO'
  AND label IN (N'项目编号',N'项目名称',N'客户名称',N'应用场景',N'序号',N'物料编号',N'物料名称',N'尺寸规格',N'数量');
SELECT place, seq, col_name, label, width FROM yj_field
WHERE panel_code='RD_PROD_INFO' AND place='detail' ORDER BY seq;