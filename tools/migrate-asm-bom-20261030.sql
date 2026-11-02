-- ============================================================================
-- 组装物料清单(bs_asm_bom)+ 面板元数据 ASM_BOM(2026-10-30)
--
-- 用户口径(2026-10-30):「成型/切炭/装箱先不管,当前先处理的只有组装;组装物料清单
--   需要单独分出来放在数据建模中生产部分;BOM 还是需要新建表;工序用页面选择;
--   这个先实现在库表中即可;本次导入范围可以先导入当前存在的 236 个。」
--
-- 本脚本只做「结构 + 元数据 + 菜单登记」;数据由配套的
--   tools/migrate-asm-bom-data-20261030.sql 导入(来源=金蝶BOM引出列表_20261019174847)。
--
-- 设计口径:
--   · 单表 doc 模式(对齐 ROUTE/bs_route 的既有先例):一行 = 某产品某工序的一个子件;
--     面板按「单据编号」分组,一单一产品一版 BOM(单据编号 = 金蝶 BOM 编码,如 A-32-01_V0009),
--     header 字段与 detail 字段都落在同一张表 —— 不新造 head/detail 对(基础档案 bs_ 单表先例)。
--   · 工序 是 BOM 的维度(本期只有「组装」;成型/切炭后续同表追加,不需再改结构),
--     扫码领料端将来按 产品编码+工序 取清单,页面选择工序。
--   · 用量口径保留金蝶原始「分子/分母」两列 + ROUND(分子/分母,4) 的标准用量,
--     避免包装料(1/124 这类)只存 4 位小数后与原始单据对不上。
--
-- 幂等:建表/索引/注明/面板/字段/译名/授权全部 IF NOT EXISTS,可重跑。
-- 两账套:HSDZ_MES(正式)先、HSDZ_MES_TEST(测试)后,均用 DbSync run 本脚本。
-- ============================================================================
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 建表 ══════════
IF OBJECT_ID('dbo.bs_asm_bom') IS NULL
CREATE TABLE dbo.bs_asm_bom (
  id              bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bs_asm_bom PRIMARY KEY,
  单据编号        nvarchar(50)  NOT NULL,
  产品编码        nvarchar(100) NOT NULL,
  产品名称        nvarchar(200) NULL,
  规格型号        nvarchar(200) NULL,
  工序            nvarchar(20)  NOT NULL,
  版本号          nvarchar(20)  NULL,
  默认BOM         nvarchar(10)  NULL,
  工艺路线名称    nvarchar(100) NULL,
  来源            nvarchar(100) NULL,
  状态            nvarchar(20)  NULL,
  行序            int           NOT NULL CONSTRAINT df_bs_asm_bom_line DEFAULT(0),
  子件编码        nvarchar(100) NOT NULL,
  子件名称        nvarchar(200) NULL,
  子件规格        nvarchar(200) NULL,
  计量单位        nvarchar(20)  NULL,
  标准用量        decimal(18,4) NOT NULL CONSTRAINT df_bs_asm_bom_std DEFAULT(0),
  用量分子        decimal(18,4) NOT NULL CONSTRAINT df_bs_asm_bom_num DEFAULT(1),
  用量分母        decimal(18,4) NOT NULL CONSTRAINT df_bs_asm_bom_den DEFAULT(1),
  损耗量          decimal(18,4) NOT NULL CONSTRAINT df_bs_asm_bom_loss DEFAULT(0),
  行备注          nvarchar(500) NULL,
  asp_user1       nvarchar(50)  NULL,
  asp_time1       datetime2     NULL,
  asp_user2       nvarchar(50)  NULL,
  asp_time2       datetime2     NULL,
  asp_cancel      nvarchar(1)   NOT NULL CONSTRAINT df_bs_asm_bom_cancel DEFAULT(N'N'),
  备用1 nvarchar(500) NULL, 备用2 nvarchar(500) NULL, 备用3 nvarchar(500) NULL, 备用4 nvarchar(500) NULL,
  备用5 nvarchar(500) NULL, 备用6 nvarchar(500) NULL, 备用7 nvarchar(500) NULL, 备用8 nvarchar(500) NULL,
  备用9 nvarchar(500) NULL, 备用10 nvarchar(500) NULL, 备用11 nvarchar(500) NULL, 备用12 nvarchar(500) NULL,
  备用13 nvarchar(500) NULL, 备用14 nvarchar(500) NULL, 备用15 nvarchar(500) NULL, 备用16 nvarchar(500) NULL,
  备用17 nvarchar(500) NULL, 备用18 nvarchar(500) NULL, 备用19 nvarchar(500) NULL, 备用20 nvarchar(500) NULL
);
GO

-- 2026-10-30 补列:表头「备注」(首次执行时漏建,面板 header 字段 备注 指向它 ⇒ 体检 05 项元数据漂移)
IF OBJECT_ID('dbo.bs_asm_bom') IS NOT NULL AND COL_LENGTH('dbo.bs_asm_bom', '备注') IS NULL
  ALTER TABLE dbo.bs_asm_bom ADD 备注 nvarchar(500) NULL;
GO

-- 索引:同单内行序唯一(过滤软删)+ 扫码取数(产品编码,工序)等值查找
IF OBJECT_ID('dbo.bs_asm_bom') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_asm_bom') AND name = 'uq_bs_asm_bom_doc_line')
  CREATE UNIQUE INDEX uq_bs_asm_bom_doc_line ON dbo.bs_asm_bom (单据编号, 行序) WHERE asp_cancel <> 'Y';
IF OBJECT_ID('dbo.bs_asm_bom') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_asm_bom') AND name = 'ix_bs_asm_bom_prod_process')
  CREATE INDEX ix_bs_asm_bom_prod_process ON dbo.bs_asm_bom (产品编码, 工序) INCLUDE (子件编码, 标准用量, 用量分子, 用量分母);
GO

-- ══════════ 2. 中文注明(表 + 列;已有不覆盖) ══════════
IF OBJECT_ID('dbo.bs_asm_bom') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
  WHERE major_id = OBJECT_ID('dbo.bs_asm_bom') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'组装物料清单(工序BOM子件行;单表 doc 模式按 单据编号 分组,一行=一个产品某工序的一个子件;工序列本期=组装,成型/切炭后续同表追加;来源=金蝶BOM引出列表_20261019174847)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom';

IF COL_LENGTH('dbo.bs_asm_bom','id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='id')
  EXEC sp_addextendedproperty N'MS_Description', N'自增主键', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'id';
IF COL_LENGTH('dbo.bs_asm_bom','单据编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='单据编号')
  EXEC sp_addextendedproperty N'MS_Description', N'BOM 单据编号(=金蝶 BOM 编码,如 A-32-01_V0009;面板按它分组,一单一版)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'单据编号';
IF COL_LENGTH('dbo.bs_asm_bom','产品编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='产品编码')
  EXEC sp_addextendedproperty N'MS_Description', N'父件产品编码(=bs_inv.存货编码;工单 plang.dm 同口径)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'产品编码';
IF COL_LENGTH('dbo.bs_asm_bom','产品名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='产品名称')
  EXEC sp_addextendedproperty N'MS_Description', N'父件产品名称', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'产品名称';
IF COL_LENGTH('dbo.bs_asm_bom','规格型号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='规格型号')
  EXEC sp_addextendedproperty N'MS_Description', N'父件规格型号', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'规格型号';
IF COL_LENGTH('dbo.bs_asm_bom','工序') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='工序')
  EXEC sp_addextendedproperty N'MS_Description', N'工序(本期=组装;成型/切炭后续同表追加;扫码领料按 产品编码+工序 取清单)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'工序';
IF COL_LENGTH('dbo.bs_asm_bom','版本号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='版本号')
  EXEC sp_addextendedproperty N'MS_Description', N'BOM 版本号(取自单据编号的 _V 后缀,如 V0009)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'版本号';
IF COL_LENGTH('dbo.bs_asm_bom','默认BOM') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='默认BOM')
  EXEC sp_addextendedproperty N'MS_Description', N'是否默认 BOM(金蝶「默认BOM」列:是/空)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'默认BOM';
IF COL_LENGTH('dbo.bs_asm_bom','工艺路线名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='工艺路线名称')
  EXEC sp_addextendedproperty N'MS_Description', N'金蝶工艺路线名称(如「烧结炭棒1切1组装装箱」;仅来源留痕,MES 侧路线仍以 bs_route/plang.[工艺路线] 为准)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'工艺路线名称';
IF COL_LENGTH('dbo.bs_asm_bom','来源') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='来源')
  EXEC sp_addextendedproperty N'MS_Description', N'数据来源(本次=金蝶BOM引出列表_20261019174847;导入脚本按此值幂等重灌)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'来源';
IF COL_LENGTH('dbo.bs_asm_bom','状态') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='状态')
  EXEC sp_addextendedproperty N'MS_Description', N'BOM 使用状态(金蝶「使用状态」列,本期全部=启用)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'状态';
IF COL_LENGTH('dbo.bs_asm_bom','行序') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='行序')
  EXEC sp_addextendedproperty N'MS_Description', N'子件行序(同单内 1..n,保持 Excel 原顺序)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'行序';
IF COL_LENGTH('dbo.bs_asm_bom','子件编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='子件编码')
  EXEC sp_addextendedproperty N'MS_Description', N'子件物料编码(=bs_inv.存货编码;含 **TB 半成品本体行)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'子件编码';
IF COL_LENGTH('dbo.bs_asm_bom','子件名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='子件名称')
  EXEC sp_addextendedproperty N'MS_Description', N'子件物料名称', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'子件名称';
IF COL_LENGTH('dbo.bs_asm_bom','子件规格') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='子件规格')
  EXEC sp_addextendedproperty N'MS_Description', N'子件规格型号', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'子件规格';
IF COL_LENGTH('dbo.bs_asm_bom','计量单位') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='计量单位')
  EXEC sp_addextendedproperty N'MS_Description', N'子件计量单位(导入后从 bs_inv.计量单位 带出)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'计量单位';
IF COL_LENGTH('dbo.bs_asm_bom','标准用量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='标准用量')
  EXEC sp_addextendedproperty N'MS_Description', N'标准用量(=ROUND(用量分子/用量分母,4);生产 1 个单位成品的子件用量)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'标准用量';
IF COL_LENGTH('dbo.bs_asm_bom','用量分子') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='用量分子')
  EXEC sp_addextendedproperty N'MS_Description', N'金蝶用量分子(原值;如包装料 1/124 的 1)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'用量分子';
IF COL_LENGTH('dbo.bs_asm_bom','用量分母') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='用量分母')
  EXEC sp_addextendedproperty N'MS_Description', N'金蝶用量分母(原值;如包装料 1/124 的 124;空按 1)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'用量分母';
IF COL_LENGTH('dbo.bs_asm_bom','损耗量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='损耗量')
  EXEC sp_addextendedproperty N'MS_Description', N'损耗量(金蝶引出表无此列,本期=0)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'损耗量';
IF COL_LENGTH('dbo.bs_asm_bom','行备注') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='行备注')
  EXEC sp_addextendedproperty N'MS_Description', N'子件行备注(金蝶「行备注」原样)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'行备注';
IF COL_LENGTH('dbo.bs_asm_bom','备注') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='备注')
  EXEC sp_addextendedproperty N'MS_Description', N'整单备注(BOM 级;行级备注见 行备注)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'备注';
IF COL_LENGTH('dbo.bs_asm_bom','asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='asp_user1')
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'asp_user1';
IF COL_LENGTH('dbo.bs_asm_bom','asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='asp_time1')
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'asp_time1';
IF COL_LENGTH('dbo.bs_asm_bom','asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='asp_user2')
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'asp_user2';
IF COL_LENGTH('dbo.bs_asm_bom','asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='asp_time2')
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'asp_time2';
IF COL_LENGTH('dbo.bs_asm_bom','asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id=ep.major_id AND c.column_id=ep.minor_id WHERE ep.major_id=OBJECT_ID('dbo.bs_asm_bom') AND ep.name='MS_Description' AND c.name='asp_cancel')
  EXEC sp_addextendedproperty N'MS_Description', N'软删标志(Y=已删除,与旧 ASPMIS 约定一致)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', N'asp_cancel';
-- 备用列池注明(与 migrate-spare-columns.sql 同文案)
IF OBJECT_ID('dbo.bs_asm_bom') IS NOT NULL
BEGIN
  DECLARE @spi int = 1, @spn sysname;
  WHILE @spi <= 20
  BEGIN
    SET @spn = N'备用' + CAST(@spi AS nvarchar(10));
    IF COL_LENGTH('dbo.bs_asm_bom', @spn) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
      JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
      WHERE ep.major_id = OBJECT_ID('dbo.bs_asm_bom') AND ep.name = 'MS_Description' AND c.name = @spn)
      EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bs_asm_bom', N'COLUMN', @spn;
    SET @spi += 1;
  END
END
GO

-- ══════════ 3. 面板注册(数据建模 → 生产;单表 doc 模式,对齐 ROUTE) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'ASM_BOM')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES ('ASM_BOM', N'组装物料清单', N'基础档案', 'doc', 'bs_asm_bom', NULL, N'单据编号', 'id', N'单据编号', 'BOM', NULL, 100, 'items', N'数据建模', N'Assembly BOM');
ELSE
  UPDATE yj_panel SET panel_name = N'组装物料清单', panel_name_en = N'Assembly BOM', category = N'基础档案', mode = 'doc',
    line_table = 'bs_asm_bom', head_table = NULL, group_col = N'单据编号', pk_col = 'id', code_col = N'单据编号',
    prefix = 'BOM', page_size = 100, detail_key = 'items', module_group = N'数据建模'
  WHERE panel_code = 'ASM_BOM';
GO

-- ══════════ 4. 字段注册(header/detail 同表;工序=query 维度) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'单据编号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 150, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'产品编码')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'产品编码', N'产品编码', N'文本', NULL, NULL, NULL, NULL, N'query,header', 20, 130, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'产品名称')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'规格型号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'工序')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'工序', N'工序', N'下拉框', N'SELECT N''组装'' AS v UNION ALL SELECT N''成型'' UNION ALL SELECT N''切炭''', NULL, NULL, NULL, N'query,header', 50, 90, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'版本号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'版本号', N'版本号', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 80, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'默认BOM')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'默认BOM', N'默认BOM', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 80, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'工艺路线名称')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'工艺路线名称', N'工艺路线名称', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 180, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'来源')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'来源', N'来源', N'文本', NULL, NULL, NULL, NULL, N'header', 85, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'状态')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'状态', N'状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 90, 80, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'备注')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 200, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'行序')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'行序', N'行序', N'整数', NULL, NULL, NULL, NULL, N'detail', 110, 60, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'子件编码')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'子件编码', N'子件编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 120, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'子件名称')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'子件名称', N'子件名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'子件规格')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'子件规格', N'子件规格', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'计量单位')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'计量单位', N'计量单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'标准用量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'标准用量', N'标准用量', N'小数', NULL, NULL, NULL, NULL, N'detail', 160, 90, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'损耗量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'损耗量', N'损耗量', N'小数', NULL, NULL, NULL, NULL, N'detail', 170, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'ASM_BOM' AND col_name = N'行备注')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('ASM_BOM', N'行备注', N'行备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 200, 1, 0, 0, 1);
GO

-- ══════════ 5. 译名(面板名九语言 + 字段标签 en 兜底/新标签九语言;已存在即跳过) ══════════
DECLARE @tr TABLE (scope nvarchar(20), ref_key nvarchar(200), locale nvarchar(10), text nvarchar(500));
INSERT INTO @tr (scope, ref_key, locale, text) VALUES
 ('panel', N'组装物料清单', 'en', N'Assembly BOM'),
 ('panel', N'组装物料清单', 'ja', N'組立BOM'),
 ('panel', N'组装物料清单', 'ko', N'조립 BOM'),
 ('panel', N'组装物料清单', 'es', N'BOM de ensamblaje'),
 ('panel', N'组装物料清单', 'fr', N'Nomenclature d''assemblage'),
 ('panel', N'组装物料清单', 'de', N'Montage-BOM'),
 ('panel', N'组装物料清单', 'ru', N'Спецификация сборки'),
 ('panel', N'组装物料清单', 'vi', N'BOM lắp ráp'),
 ('panel', N'组装物料清单', 'th', N'BOM การประกอบ'),
 -- 新字段标签(库里可能没有的词):九语言
 ('field', N'子件规格', 'en', N'Component Specification'),
 ('field', N'子件规格', 'ja', N'部品仕様'),
 ('field', N'子件规格', 'ko', N'구성품 규격'),
 ('field', N'子件规格', 'es', N'Especificación del componente'),
 ('field', N'子件规格', 'fr', N'Spécification du composant'),
 ('field', N'子件规格', 'de', N'Komponentenspezifikation'),
 ('field', N'子件规格', 'ru', N'Спецификация компонента'),
 ('field', N'子件规格', 'vi', N'Quy cách linh kiện'),
 ('field', N'子件规格', 'th', N'ข้อมูลจำเพาะชิ้นส่วน'),
 ('field', N'行备注', 'en', N'Line Remark'),
 ('field', N'行备注', 'ja', N'行備考'),
 ('field', N'行备注', 'ko', N'행 비고'),
 ('field', N'行备注', 'es', N'Observación de línea'),
 ('field', N'行备注', 'fr', N'Remarque de ligne'),
 ('field', N'行备注', 'de', N'Zeilenbemerkung'),
 ('field', N'行备注', 'ru', N'Примечание строки'),
 ('field', N'行备注', 'vi', N'Ghi chú dòng'),
 ('field', N'行备注', 'th', N'หมายเหตุรายการ'),
 ('field', N'版本号', 'en', N'Version'),
 ('field', N'默认BOM', 'en', N'Default BOM'),
 ('field', N'工艺路线名称', 'en', N'Routing Name'),
 ('field', N'来源', 'en', N'Source'),
 -- 其余标签 en 兜底(已有译名则跳过;保证体检 09 项 en 覆盖)
 ('field', N'单据编号', 'en', N'Document No.'),
 ('field', N'产品编码', 'en', N'Product Code'),
 ('field', N'产品名称', 'en', N'Product Name'),
 ('field', N'规格型号', 'en', N'Specification'),
 ('field', N'工序', 'en', N'Process'),
 ('field', N'状态', 'en', N'Status'),
 ('field', N'备注', 'en', N'Remark'),
 ('field', N'行序', 'en', N'Line No.'),
 ('field', N'子件编码', 'en', N'Component Code'),
 ('field', N'子件名称', 'en', N'Component Name'),
 ('field', N'计量单位', 'en', N'Unit'),
 ('field', N'标准用量', 'en', N'Standard Quantity'),
 ('field', N'损耗量', 'en', N'Loss Quantity');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual' FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation y WHERE y.scope = t.scope AND y.ref_key = t.ref_key AND y.locale = t.locale);
GO

-- ══════════ 6. 全角色默认可查(基础档案全员可见;增删改按角色授权,管理员恒全量) ══════════
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, 'ASM_BOM', 'view,query', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = 'ASM_BOM');
GO

-- ══════════ 7. 自检 ══════════
SELECT N'表列数' AS what, CAST(COUNT(*) AS varchar(10)) AS cnt FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom')
UNION ALL SELECT N'表注明', CAST(COUNT(*) AS varchar(10)) FROM sys.extended_properties
  WHERE major_id = OBJECT_ID('dbo.bs_asm_bom') AND minor_id = 0 AND name = 'MS_Description'
UNION ALL SELECT N'缺注列', CAST(COUNT(*) AS varchar(10)) FROM sys.columns c
  WHERE c.object_id = OBJECT_ID('dbo.bs_asm_bom')
    AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
      WHERE ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description')
UNION ALL SELECT N'面板行', CAST(COUNT(*) AS varchar(10)) FROM yj_panel WHERE panel_code = 'ASM_BOM'
UNION ALL SELECT N'字段行', CAST(COUNT(*) AS varchar(10)) FROM yj_field WHERE panel_code = 'ASM_BOM'
UNION ALL SELECT N'面板译名', CAST(COUNT(*) AS varchar(10)) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'组装物料清单'
UNION ALL SELECT N'字段缺en', CAST(COUNT(*) AS varchar(10)) FROM (
    SELECT DISTINCT label FROM yj_field f WHERE f.panel_code = 'ASM_BOM'
      AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = f.label AND t.locale = 'en')
  ) x
UNION ALL SELECT N'授权行', CAST(COUNT(*) AS varchar(10)) FROM yj_role_panel WHERE panel_code = 'ASM_BOM'
UNION ALL SELECT N'主键', CAST(COUNT(*) AS varchar(10)) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_asm_bom') AND is_primary_key = 1
UNION ALL SELECT N'唯一索引', CAST(COUNT(*) AS varchar(10)) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_asm_bom') AND name = 'uq_bs_asm_bom_doc_line';
GO
