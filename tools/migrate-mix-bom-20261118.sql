-- ============================================================================
-- 混料物料清单(bs_mix_bom)+ 面板元数据 MIX_BOM(2026-11-18)
--
-- 用户口径(2026-11-18,原话):
--   「烧结工艺也要实现一个混料物料清单能被这里两种烧结工艺清单中的bom表填入进去。」
--   「就按照当前烧结工艺清单中bom的字段获取就行,然后需要增加一个字段来区分两种烧结,
--     从那个烧结单中获取就是那个烧结的产品」
--   「只要已归档状态的内容即可。参照产品信息表和物料清单的实现模式。」
--
-- 实现方向(经用户澄清):**烧结单 → 基础数据**,不是基础数据 → 烧结单。
--   与「产品信息表(RD_PROD_INFO)归档 ⇒ BOM 明细同步进物料清单(WLBOM/mate)」同一套模式
--   (见 ButtonService.markArchived → syncProdBomToMaterialList):
--     · 烧结工艺清单(RD_MOLD_PROC)归档       ⇒ 其「配方表」行写入本表,烧结类型=烧结工艺清单
--     · X烧结工艺清单(RD_X_SINTER)归档        ⇒ 其「配方表」行写入本表,烧结类型=X烧结工艺清单
--     · 只有**已归档**的单据才写(保存/审批中不写)—— 归档入口唯一,见 ProcBomArchiveSyncService
--   字段 = 两张烧结单配方表的并集 + 「烧结类型」区分来源 + 产品编号/产品名称/来源单号溯源。
--   组装侧同批改造:组装工艺清单(RD_ASM_PROC)归档 ⇒ 写入组装物料清单(ASM_BOM/bs_asm_bom),
--   不在本脚本(那是已有表,零 DDL)。
--
-- 设计口径(对齐 bs_asm_bom 的先例):
--   · 单表 doc 模式:一行 = 某个产品的某条混料物料;面板按「单据编号」分组,
--     一张单 = 一个产品 × 一种烧结类型(同一产品可同时有烧结/X烧结两张,靠 烧结类型 区分);
--   · 定位键 = 产品编号 + 烧结类型(重复归档时覆盖同一张,不增生单据);
--   · 物理列名全部中文,数据键 = yj_field.label(ADR-0001:数据键永远中文)。
--
-- 幂等:建表/索引/注明/面板/字段/译名/授权全部 IF NOT EXISTS,可重跑。
-- 两账套:HSDZ_MES(正式)先、HSDZ_MES_TEST(测试)后,均用 DbSync run 本脚本。
--   cd tools && java -cp lib/mssql-jdbc.jar DbSync.java run migrate-mix-bom-20261118.sql
--   YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar DbSync.java run migrate-mix-bom-20261118.sql
--
-- ⚠ 本脚本注释里不写「斜杠 + 星号」相邻组合(T-SQL 块注释可嵌套,会被当成嵌套注释起始)。
-- ============================================================================
SET NOCOUNT ON;
GO

-- ══════════ 1. 建表 ══════════
IF OBJECT_ID('dbo.bs_mix_bom') IS NULL
CREATE TABLE dbo.bs_mix_bom (
  id              bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bs_mix_bom PRIMARY KEY,
  单据编号        nvarchar(50)  NOT NULL,
  产品编号        nvarchar(100) NULL,
  产品名称        nvarchar(200) NULL,
  烧结类型        nvarchar(40)  NULL,
  来源单号        nvarchar(60)  NULL,
  版本号          nvarchar(60)  NULL,
  状态            nvarchar(20)  NULL,
  行序            int           NOT NULL CONSTRAINT df_bs_mix_bom_line DEFAULT(0),
  物料种类        nvarchar(60)  NULL,
  物料编号        nvarchar(100) NULL,
  物料名称        nvarchar(200) NULL,
  添加比例        nvarchar(50)  NULL,
  单支含量g       nvarchar(50)  NULL,
  设计添加量      nvarchar(50)  NULL,
  行备注          nvarchar(500) NULL,
  asp_user1       nvarchar(50)  NULL,
  asp_time1       datetime2     NULL,
  asp_user2       nvarchar(50)  NULL,
  asp_time2       datetime2     NULL,
  asp_cancel      nvarchar(1)   NOT NULL CONSTRAINT df_bs_mix_bom_cancel DEFAULT(N'N'),
  备用1 nvarchar(500) NULL, 备用2 nvarchar(500) NULL, 备用3 nvarchar(500) NULL, 备用4 nvarchar(500) NULL,
  备用5 nvarchar(500) NULL, 备用6 nvarchar(500) NULL, 备用7 nvarchar(500) NULL, 备用8 nvarchar(500) NULL,
  备用9 nvarchar(500) NULL, 备用10 nvarchar(500) NULL, 备用11 nvarchar(500) NULL, 备用12 nvarchar(500) NULL,
  备用13 nvarchar(500) NULL, 备用14 nvarchar(500) NULL, 备用15 nvarchar(500) NULL, 备用16 nvarchar(500) NULL,
  备用17 nvarchar(500) NULL, 备用18 nvarchar(500) NULL, 备用19 nvarchar(500) NULL, 备用20 nvarchar(500) NULL,
  备注            nvarchar(500) NULL
);
GO

-- 索引:同单内行序唯一(过滤软删)+ 归档同步定位(产品编号,烧结类型)等值查找
IF OBJECT_ID('dbo.bs_mix_bom') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_mix_bom') AND name = 'uq_bs_mix_bom_doc_line')
  CREATE UNIQUE INDEX uq_bs_mix_bom_doc_line ON dbo.bs_mix_bom (单据编号, 行序) WHERE asp_cancel <> 'Y';
IF OBJECT_ID('dbo.bs_mix_bom') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_mix_bom') AND name = 'ix_bs_mix_bom_prod_type')
  CREATE INDEX ix_bs_mix_bom_prod_type ON dbo.bs_mix_bom (产品编号, 烧结类型) INCLUDE (物料编号, 添加比例, 单支含量g, 设计添加量);
GO

-- ══════════ 2. 中文注明(表 + 关键列;已有不覆盖) ══════════
IF OBJECT_ID('dbo.bs_mix_bom') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
  WHERE major_id = OBJECT_ID('dbo.bs_mix_bom') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'混料物料清单(烧结侧基础数据;单表 doc 模式按 单据编号 分组,一行=某产品某条混料物料;由「烧结工艺清单 RD_MOLD_PROC / X烧结工艺清单 RD_X_SINTER」归档时从各自配方表同步进来,烧结类型 区分来源;migrate-mix-bom-20261118.sql 新建)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom';

IF COL_LENGTH('dbo.bs_mix_bom','单据编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='单据编号')
  EXEC sp_addextendedproperty N'MS_Description', N'清单单据编号(面板按它分组,一单一产品×一种烧结类型)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'单据编号';
IF COL_LENGTH('dbo.bs_mix_bom','产品编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='产品编号')
  EXEC sp_addextendedproperty N'MS_Description', N'产品编号(取自烧结单表头「产品编号」;与 烧结类型 一起作为本表的定位键)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'产品编号';
IF COL_LENGTH('dbo.bs_mix_bom','产品名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='产品名称')
  EXEC sp_addextendedproperty N'MS_Description', N'产品名称(取自烧结单表头)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'产品名称';
IF COL_LENGTH('dbo.bs_mix_bom','烧结类型') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='烧结类型')
  EXEC sp_addextendedproperty N'MS_Description', N'烧结类型(烧结工艺清单 = 来自 RD_MOLD_PROC;X烧结工艺清单 = 来自 RD_X_SINTER;同一产品可各有一张)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'烧结类型';
IF COL_LENGTH('dbo.bs_mix_bom','来源单号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='来源单号')
  EXEC sp_addextendedproperty N'MS_Description', N'来源单号(产生本张清单的烧结工艺清单/X烧结工艺清单单据号;重复归档时被覆盖)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'来源单号';
IF COL_LENGTH('dbo.bs_mix_bom','版本号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='版本号')
  EXEC sp_addextendedproperty N'MS_Description', N'版本号(取自烧结单表头「版本号」)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'版本号';
IF COL_LENGTH('dbo.bs_mix_bom','状态') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='状态')
  EXEC sp_addextendedproperty N'MS_Description', N'使用状态(同步写入=启用;面板可改 启用/停用)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'状态';
IF COL_LENGTH('dbo.bs_mix_bom','行序') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='行序')
  EXEC sp_addextendedproperty N'MS_Description', N'物料行序(同单内 1..n,与烧结单配方表顺序一致)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'行序';
IF COL_LENGTH('dbo.bs_mix_bom','物料种类') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='物料种类')
  EXEC sp_addextendedproperty N'MS_Description', N'物料种类(粉料/胶粉/颗粒料等,取自烧结单配方表)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'物料种类';
IF COL_LENGTH('dbo.bs_mix_bom','物料编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='物料编号')
  EXEC sp_addextendedproperty N'MS_Description', N'物料编号(=bs_inv.存货编码)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'物料编号';
IF COL_LENGTH('dbo.bs_mix_bom','物料名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='物料名称')
  EXEC sp_addextendedproperty N'MS_Description', N'物料名称', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'物料名称';
IF COL_LENGTH('dbo.bs_mix_bom','添加比例') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='添加比例')
  EXEC sp_addextendedproperty N'MS_Description', N'添加比例%(烧结工艺清单取「实际添加比例」;X烧结工艺清单取「添加比例」;文本原样保留,含 % 与位数)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'添加比例';
IF COL_LENGTH('dbo.bs_mix_bom','单支含量g') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='单支含量g')
  EXEC sp_addextendedproperty N'MS_Description', N'单支含量g(烧结工艺清单取「单支物料含量」;X烧结工艺清单取「单支含量g」)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'单支含量g';
IF COL_LENGTH('dbo.bs_mix_bom','设计添加量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='设计添加量')
  EXEC sp_addextendedproperty N'MS_Description', N'设计添加量(取自烧结单配方表同名列;粉料/胶粉为 %,颗粒料为 g/支,混单位,合计只加 %)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'设计添加量';
IF COL_LENGTH('dbo.bs_mix_bom','行备注') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='行备注')
  EXEC sp_addextendedproperty N'MS_Description', N'物料行备注', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'行备注';
IF COL_LENGTH('dbo.bs_mix_bom','备注') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_mix_bom') AND ep.name='MS_Description' AND c.name='备注')
  EXEC sp_addextendedproperty N'MS_Description', N'整单备注(行级备注见 行备注)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', N'备注';
-- 备用列池注明
IF OBJECT_ID('dbo.bs_mix_bom') IS NOT NULL
BEGIN
  DECLARE @spi int = 1, @spn sysname;
  WHILE @spi <= 20
  BEGIN
    SET @spn = N'备用' + CAST(@spi AS nvarchar(10));
    IF COL_LENGTH('dbo.bs_mix_bom', @spn) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
      JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
      WHERE ep.major_id = OBJECT_ID('dbo.bs_mix_bom') AND ep.name = 'MS_Description' AND c.name = @spn)
      EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bs_mix_bom', N'COLUMN', @spn;
    SET @spi += 1;
  END
END
GO

-- ══════════ 3. 面板注册(数据建模 → 物料及价格;单表 doc 模式,对齐 ASM_BOM) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'MIX_BOM')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, panel_name_en)
  VALUES ('MIX_BOM', N'混料物料清单', N'基础档案', 'doc', 'bs_mix_bom', NULL, N'单据编号', 'id', N'单据编号', 'MIX', NULL, 100, 'items', N'数据建模', N'{"headDefaults":{"状态":"启用"}}', N'Mixing BOM');
ELSE
  UPDATE yj_panel SET panel_name = N'混料物料清单', panel_name_en = N'Mixing BOM', category = N'基础档案', mode = 'doc',
    line_table = 'bs_mix_bom', head_table = NULL, group_col = N'单据编号', pk_col = 'id', code_col = N'单据编号',
    prefix = 'MIX', page_size = 100, detail_key = 'items', module_group = N'数据建模'
  WHERE panel_code = 'MIX_BOM';
GO

-- ══════════ 4. 字段注册(header/detail 同表;烧结类型 = 区分两种烧结的来源) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'单据编号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 150, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'产品编号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'产品编号', N'产品编号', N'参照', NULL, N'RD_PROD_INFO', N'产品编号', N'产品名称', N'query,header', 20, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'产品名称')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 25, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'烧结类型')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'烧结类型', N'烧结类型', N'下拉框', N'SELECT N''烧结工艺清单'' AS v UNION ALL SELECT N''X烧结工艺清单''', NULL, NULL, NULL, N'query,header', 30, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'来源单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'来源单号', N'来源单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 40, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'版本号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'版本号', N'版本号', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'状态')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'状态', N'状态', N'下拉框', N'SELECT N''启用'' AS v UNION ALL SELECT N''停用''', NULL, NULL, NULL, N'query,header', 60, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'备注')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'行序')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'行序', N'行序', N'整数', NULL, NULL, NULL, NULL, N'detail', 110, 60, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'物料种类')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'物料种类', N'物料种类', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'物料编号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'物料编号', N'物料编号', N'参照', NULL, N'INV', N'存货编码', N'存货名称', N'query,detail', 130, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'物料名称')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 140, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'添加比例')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'添加比例', N'添加比例', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'单支含量g')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'单支含量g', N'单支含量g', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'设计添加量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'设计添加量', N'设计添加量', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MIX_BOM' AND col_name = N'行备注')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('MIX_BOM', N'行备注', N'行备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 200, 1, 0, 0, 1);
GO

-- ══════════ 5. 译名(面板名 + 新字段标签;九语言;已存在即跳过) ══════════
DECLARE @tr TABLE (scope nvarchar(20), ref_key nvarchar(200), locale nvarchar(10), text nvarchar(500));
INSERT INTO @tr (scope, ref_key, locale, text) VALUES
 ('panel', N'混料物料清单', 'en', N'Mixing BOM'),
 ('panel', N'混料物料清单', 'ja', N'混練BOM'),
 ('panel', N'混料物料清单', 'ko', N'혼합 BOM'),
 ('panel', N'混料物料清单', 'es', N'BOM de mezcla'),
 ('panel', N'混料物料清单', 'fr', N'Nomenclature de mélange'),
 ('panel', N'混料物料清单', 'de', N'Misch-BOM'),
 ('panel', N'混料物料清单', 'ru', N'Спецификация смеси'),
 ('panel', N'混料物料清单', 'vi', N'BOM trộn liệu'),
 ('panel', N'混料物料清单', 'th', N'BOM การผสม'),
 -- 新字段标签(库里没有的词):九语言
 ('field', N'烧结类型', 'en', N'Sintering Type'),
 ('field', N'烧结类型', 'ja', N'焼結種類'),
 ('field', N'烧结类型', 'ko', N'소결 유형'),
 ('field', N'烧结类型', 'es', N'Tipo de sinterización'),
 ('field', N'烧结类型', 'fr', N'Type de frittage'),
 ('field', N'烧结类型', 'de', N'Sintertyp'),
 ('field', N'烧结类型', 'ru', N'Тип спекания'),
 ('field', N'烧结类型', 'vi', N'Loại thiêu kết'),
 ('field', N'烧结类型', 'th', N'ประเภทการเผาผนึก'),
 ('field', N'来源单号', 'en', N'Source Doc No.'),
 ('field', N'来源单号', 'ja', N'元伝票番号'),
 ('field', N'来源单号', 'ko', N'원본 전표번호'),
 ('field', N'来源单号', 'es', N'N.º de documento origen'),
 ('field', N'来源单号', 'fr', N'N° de document source'),
 ('field', N'来源单号', 'de', N'Quellbelegnr.'),
 ('field', N'来源单号', 'ru', N'№ исходного документа'),
 ('field', N'来源单号', 'vi', N'Số chứng từ nguồn'),
 ('field', N'来源单号', 'th', N'เลขที่เอกสารต้นทาง'),
 ('field', N'添加比例', 'en', N'Addition Ratio'),
 ('field', N'添加比例', 'ja', N'添加比率'),
 ('field', N'添加比例', 'ko', N'첨가 비율'),
 ('field', N'添加比例', 'es', N'Proporción de adición'),
 ('field', N'添加比例', 'fr', N'Ratio d''ajout'),
 ('field', N'添加比例', 'de', N'Zugabeverhältnis'),
 ('field', N'添加比例', 'ru', N'Доля добавления'),
 ('field', N'添加比例', 'vi', N'Tỷ lệ thêm'),
 ('field', N'添加比例', 'th', N'อัตราการเติม'),
 ('field', N'单支含量g', 'en', N'Content per Piece (g)'),
 ('field', N'单支含量g', 'ja', N'1本あたり含有量g'),
 ('field', N'单支含量g', 'ko', N'개당 함량g'),
 ('field', N'单支含量g', 'es', N'Contenido por pieza (g)'),
 ('field', N'单支含量g', 'fr', N'Contenu par pièce (g)'),
 ('field', N'单支含量g', 'de', N'Gehalt pro Stück (g)'),
 ('field', N'单支含量g', 'ru', N'Содержание на шт. (г)'),
 ('field', N'单支含量g', 'vi', N'Hàm lượng mỗi chiếc (g)'),
 ('field', N'单支含量g', 'th', N'ปริมาณต่อชิ้น (ก.)'),
 ('field', N'设计添加量', 'en', N'Design Addition'),
 ('field', N'设计添加量', 'ja', N'設計添加量'),
 ('field', N'设计添加量', 'ko', N'설계 첨가량'),
 ('field', N'设计添加量', 'es', N'Adición de diseño'),
 ('field', N'设计添加量', 'fr', N'Ajout de conception'),
 ('field', N'设计添加量', 'de', N'Konstruktionszugabe'),
 ('field', N'设计添加量', 'ru', N'Проектная добавка'),
 ('field', N'设计添加量', 'vi', N'Lượng thêm thiết kế'),
 ('field', N'设计添加量', 'th', N'ปริมาณเติมตามแบบ'),
 -- 其余标签 en 兜底(已有译名则跳过;保证体检 09 项 en 覆盖)
 ('field', N'单据编号', 'en', N'Document No.'),
 ('field', N'产品编号', 'en', N'Product Code'),
 ('field', N'产品名称', 'en', N'Product Name'),
 ('field', N'版本号', 'en', N'Version'),
 ('field', N'状态', 'en', N'Status'),
 ('field', N'备注', 'en', N'Remark'),
 ('field', N'行序', 'en', N'Line No.'),
 ('field', N'物料种类', 'en', N'Material Kind'),
 ('field', N'物料编号', 'en', N'Material Code'),
 ('field', N'物料名称', 'en', N'Material Name'),
 ('field', N'行备注', 'en', N'Line Remark');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual' FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation y WHERE y.scope = t.scope AND y.ref_key = t.ref_key AND y.locale = t.locale);
GO

-- ══════════ 6. 全角色默认可查(基础档案全员可见;增删改按角色授权,管理员恒全量) ══════════
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, 'MIX_BOM', 'view,query', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = 'MIX_BOM');
GO

-- ══════════ 7. 自检(不满足即 RAISERROR 16 失败) ══════════
DECLARE @cols int, @commented int, @panels int, @fields int, @trs int, @perm int, @pk int, @uq int;
SELECT @cols = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_mix_bom');
SELECT @commented = COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.bs_mix_bom') AND name = 'MS_Description';
SELECT @panels = COUNT(*) FROM yj_panel WHERE panel_code = 'MIX_BOM';
SELECT @fields = COUNT(*) FROM yj_field WHERE panel_code = 'MIX_BOM';
SELECT @trs = COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'混料物料清单';
SELECT @perm = COUNT(*) FROM yj_role_panel WHERE panel_code = 'MIX_BOM';
SELECT @pk = COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_mix_bom') AND is_primary_key = 1;
SELECT @uq = COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_mix_bom') AND name = 'uq_bs_mix_bom_doc_line';
PRINT N'自检: 列数=' + CAST(@cols AS nvarchar(10)) + N' 表+列注明=' + CAST(@commented AS nvarchar(10))
    + N' 面板=' + CAST(@panels AS nvarchar(10)) + N' 字段=' + CAST(@fields AS nvarchar(10))
    + N' 面板译名=' + CAST(@trs AS nvarchar(10)) + N' 授权=' + CAST(@perm AS nvarchar(10))
    + N' 主键=' + CAST(@pk AS nvarchar(10)) + N' 唯一索引=' + CAST(@uq AS nvarchar(10));
IF @cols < 36 OR @commented < 26 OR @panels <> 1 OR @fields <> 16 OR @trs < 9 OR @perm < 1 OR @pk <> 1 OR @uq <> 1
  RAISERROR(N'混料物料清单自检失败:表/面板/字段/译名/授权不完整', 16, 1);
ELSE
  PRINT N'[PASS] 混料物料清单(bs_mix_bom / MIX_BOM)结构与元数据就绪';
GO
