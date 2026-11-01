/* ============================================================================
   migrate-prodinfo-head-extra-20261030.sql
   产品信息表表头补登记 4 个字段(2026-10-30)

   【怎么发现的】
     用户报「产品信息表写了 BOM 保存后全是 /」并要求「排查一下研发管理类似问题」。
     三方比对(前端 recordSheetConfigs 的 key ↔ yj_field.label ↔ 物理列)后,第三处:

       frontend/src/core/views/recordSheetConfigs.js:1234-1250
         { label: '项目编号', key: '项目编号', type: 'text' }   ← 行1 左
         { label: '项目名称', key: '项目名称', type: 'text' }   ← 行1 右
         { label: '客户名称', key: '客户名称', type: 'text' }   ← 行2 右
         { label: '应用场景', key: '应用场景', type: 'text' }   ← 行5 整行

     同段注释写明这几格是「2026-10-29 新版设计**新增**」(行1/行5 都标了 ← 新增)。
     **物理列早就有了**(rd_prod_info_head 的 项目编号/项目名称/客户名称/应用场景 四列都在),
     **10 种语言译名也都有**(yj_translation 已覆盖 en/ja/ko/de/es/fr/ru/th/vi/zh-TW),
     **唯独 yj_field 没有登记** ⇒ 后端保存时按元数据认列认不到这 4 个键,用户在纸面填的内容被丢弃。

   【本脚本做什么】
     1. rd_prod_info_head 补 4 个物理列(nvarchar,长度照本机已有定义:
        项目编号/项目名称/客户名称 nvarchar(200)、应用场景 nvarchar(1000));
     2. 补 4 条 yj_field(place='header');
     3. 译名不动 —— yj_translation 10 种语言已全覆盖。
     ⚠ 2026-10-30 首次在服务器执行时报「字段 4/4、物理列 0/4」并回滚:
       **本机这 4 列早就有了,服务器一直没有**(本机开发库比服务器超前一步)
       ⇒ 只补元数据不够,列也得一并补。此后脚本按「列 → 字段」两步走并自检两头。
     seq 按纸面顺序插:项目编号 31 / 项目名称 32 / 客户名称 35 / 应用场景 81
     (均落在现有 30→36、80→90 的空档里,不打乱既有字段次序)。
     · IF NOT EXISTS / COL_LENGTH 守卫,幂等可复跑。

   ⚠ 两账套都要跑(先 HSDZ_MES 后 HSDZ_MES_TEST),已登记 tools/db-migrations.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();

/* ── 1) 物理列 ── */
IF COL_LENGTH('rd_prod_info_head', N'项目编号') IS NULL
    ALTER TABLE rd_prod_info_head ADD [项目编号] nvarchar(200) NULL;
IF COL_LENGTH('rd_prod_info_head', N'项目名称') IS NULL
    ALTER TABLE rd_prod_info_head ADD [项目名称] nvarchar(200) NULL;
IF COL_LENGTH('rd_prod_info_head', N'客户名称') IS NULL
    ALTER TABLE rd_prod_info_head ADD [客户名称] nvarchar(200) NULL;
IF COL_LENGTH('rd_prod_info_head', N'应用场景') IS NULL
    ALTER TABLE rd_prod_info_head ADD [应用场景] nvarchar(1000) NULL;

/* ── 2) 元数据字段 ── */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND col_name=N'项目编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'项目编号', N'项目编号', N'文本', 'header', 31, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND col_name=N'项目名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'项目名称', N'项目名称', N'文本', 'header', 32, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND col_name=N'客户名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'客户名称', N'客户名称', N'文本', 'header', 35, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROD_INFO' AND col_name=N'应用场景')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'应用场景', N'应用场景', N'文本', 'header', 81, 1, 0, 0, 1);

/* ── 自检:4 个字段 + 4 个物理列 + 译名都必须齐 ── */
DECLARE @fld int = (SELECT COUNT(*) FROM yj_field
                     WHERE panel_code='RD_PROD_INFO'
                       AND col_name IN (N'项目编号',N'项目名称',N'客户名称',N'应用场景'));
DECLARE @col int = (SELECT COUNT(*) FROM sys.columns
                     WHERE object_id=OBJECT_ID('rd_prod_info_head')
                       AND name IN (N'项目编号',N'项目名称',N'客户名称',N'应用场景'));
DECLARE @tr int = (SELECT COUNT(*) FROM yj_translation
                    WHERE scope='field' AND locale='en'
                      AND ref_key IN (N'项目编号',N'项目名称',N'客户名称',N'应用场景'));

PRINT N'[DB] ' + @db;
PRINT N'[OK] 字段 ' + CAST(@fld AS nvarchar(5)) + N'/4,物理列 ' + CAST(@col AS nvarchar(5))
    + N'/4,en 译名 ' + CAST(@tr AS nvarchar(5)) + N'/4';

IF @fld <> 4 OR @col <> 4 OR @tr <> 4
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:字段 %d/4、列 %d/4、译名 %d/4,未齐备,已回滚', 16, 1, @db, @fld, @col, @tr);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] 产品信息表表头 4 字段登记齐备';
