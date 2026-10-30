/* ============================================================================
   migrate-prodinfo-bom-detail-20261030.sql
   产品信息表「三、产品BOM表」补物理列与元数据字段(2026-10-30)

   【用户报障·原话】
     「我在服务器上填写产品信息表写了bom表，保存就这样子了，什么原因？修复这个问题」
     现象:单据 PI-2026-10-0058 的 BOM 表显示 3 行,每行 4 列全是 `/`(空值占位)。

   【根因】
     2026-10-29 新版设计给产品信息表加了「三、产品BOM表」一节
     (frontend/src/core/views/recordSheetConfigs.js 的 RD_PROD_INFO.dataTables,
      5 列 = 序号(hiddenCol) | 物料编号 | 物料名称 | 尺寸规格 | 数量),
     **但数据库和元数据从来没跟上**:
       · rd_prod_info_detail 只有 id / 单据编号 / asp_* / 备用1..20,没有任何业务列;
       · yj_field 里 RD_PROD_INFO 只有 header(27) + query(2),**一条 detail 字段都没有**。
     保存时后端按 yj_field 认列名 ⇒ 5 列全被丢弃,只按行数插了 3 条空明细
     (rd_prod_info_detail id 7/8/9,除单据编号外全 NULL)⇒ 纸面渲染成 3 行 `/`。

   【本脚本做什么】
     1. 给 rd_prod_info_detail 补 5 个业务列(序号 / 物料编号 / 物料名称 / 尺寸规格 / 数量);
     2. 给 yj_field 补 5 条 RD_PROD_INFO 的 detail 字段 —— 后端保存链靠它认列;
     3. 表列中文注释(MS_Description)。
     · 全部 IF NOT EXISTS 守卫,幂等可复跑;
     · 不动任何既有数据(历史那 3 条空明细保留,用户重填保存时会被覆盖)。

   【为什么这些类型】
     · 序号 int          —— 物理列,纸面用 hiddenCol 藏,仅供排序/追溯;
     · 物料编号 nvarchar(50) / 物料名称 nvarchar(100) / 尺寸规格 nvarchar(200) —— 文本;
     · 数量 nvarchar(50) —— 纸面表单,可能带单位("2支"),不做求和计算;
       将来若要参与计算再单独出脚本改类型。
   · 5 个词的英文译名(yj_translation scope='field', locale='en')**已存在**
     (序号/物料编号/物料名称/数量/尺寸规格),无需重复插入。

   ⚠ 两账套都要跑(先 HSDZ_MES 后 HSDZ_MES_TEST),已登记 tools/db-migrations.txt。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @db sysname = DB_NAME();

/* ── 1) 物理列 ── */
IF COL_LENGTH('rd_prod_info_detail', N'序号') IS NULL
    ALTER TABLE rd_prod_info_detail ADD [序号] int NULL;
IF COL_LENGTH('rd_prod_info_detail', N'物料编号') IS NULL
    ALTER TABLE rd_prod_info_detail ADD [物料编号] nvarchar(50) NULL;
IF COL_LENGTH('rd_prod_info_detail', N'物料名称') IS NULL
    ALTER TABLE rd_prod_info_detail ADD [物料名称] nvarchar(100) NULL;
IF COL_LENGTH('rd_prod_info_detail', N'尺寸规格') IS NULL
    ALTER TABLE rd_prod_info_detail ADD [尺寸规格] nvarchar(200) NULL;
IF COL_LENGTH('rd_prod_info_detail', N'数量') IS NULL
    ALTER TABLE rd_prod_info_detail ADD [数量] nvarchar(50) NULL;

/* ── 2) 元数据字段(label = col_name = 中文数据键,ADR-0001)── */
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code='RD_PROD_INFO' AND col_name=N'序号' AND place='detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'序号', N'序号', N'整数', 'detail', 10, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code='RD_PROD_INFO' AND col_name=N'物料编号' AND place='detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'物料编号', N'物料编号', N'文本', 'detail', 20, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code='RD_PROD_INFO' AND col_name=N'物料名称' AND place='detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'物料名称', N'物料名称', N'文本', 'detail', 30, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code='RD_PROD_INFO' AND col_name=N'尺寸规格' AND place='detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'尺寸规格', N'尺寸规格', N'多行文本', 'detail', 40, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code='RD_PROD_INFO' AND col_name=N'数量' AND place='detail')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq,
                          editable, required, hidden, visible)
    VALUES ('RD_PROD_INFO', N'数量', N'数量', N'文本', 'detail', 50, 1, 0, 0, 1);

/* ── 3) 列中文注释(AGENTS.md:改表结构鼓励补注)── */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_prod_info_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_prod_info_detail'),N'序号','ColumnId')
                  AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品BOM行序号(纸面隐藏,供排序/追溯)',
        'SCHEMA','dbo','TABLE','rd_prod_info_detail','COLUMN',N'序号';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_prod_info_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_prod_info_detail'),N'物料编号','ColumnId')
                  AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品BOM:物料编号(商品档案存货编码)',
        'SCHEMA','dbo','TABLE','rd_prod_info_detail','COLUMN',N'物料编号';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_prod_info_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_prod_info_detail'),N'物料名称','ColumnId')
                  AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品BOM:物料名称',
        'SCHEMA','dbo','TABLE','rd_prod_info_detail','COLUMN',N'物料名称';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_prod_info_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_prod_info_detail'),N'尺寸规格','ColumnId')
                  AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品BOM:尺寸规格',
        'SCHEMA','dbo','TABLE','rd_prod_info_detail','COLUMN',N'尺寸规格';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id=OBJECT_ID('rd_prod_info_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('rd_prod_info_detail'),N'数量','ColumnId')
                  AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品BOM:数量(可带单位,不参与计算)',
        'SCHEMA','dbo','TABLE','rd_prod_info_detail','COLUMN',N'数量';

/* ── 4) 自检:5 列 + 5 字段都必须到位 ── */
DECLARE @cols int = (SELECT COUNT(*) FROM sys.columns
                      WHERE object_id=OBJECT_ID('rd_prod_info_detail')
                        AND name IN (N'序号',N'物料编号',N'物料名称',N'尺寸规格',N'数量'));
DECLARE @flds int = (SELECT COUNT(*) FROM yj_field
                      WHERE panel_code='RD_PROD_INFO' AND place='detail'
                        AND col_name IN (N'序号',N'物料编号',N'物料名称',N'尺寸规格',N'数量'));

PRINT N'[DB] ' + @db;
PRINT N'[OK] rd_prod_info_detail 业务列 ' + CAST(@cols AS nvarchar(10)) + N'/5,'
    + N' yj_field detail 字段 ' + CAST(@flds AS nvarchar(10)) + N'/5';

IF @cols <> 5 OR @flds <> 5
BEGIN
    ROLLBACK TRAN;
    RAISERROR(N'[FAIL] %s:列 %d/5、字段 %d/5,未全部到位,已回滚', 16, 1, @db, @cols, @flds);
    RETURN;
END

COMMIT TRAN;
PRINT N'[SELF-CHECK OK] 产品BOM表列与字段齐备';
