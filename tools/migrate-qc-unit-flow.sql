-- migrate-qc-unit-flow.sql — 检验目录/检验数据记录/特采单 补「计量单位」列与流转(2026-09-24)
-- ═════════════════════════════════════════════════════════════════════════════
-- 用户口径:三面板也要流转计量单位——单位一般与数量一起保存。现状:qc_catalog_detail.数量 与
-- qc_insp_rec.来料数量 由 QcCatalogService#qtyWithUnit 拼成文本('1kg'/'200'),单位无独立列;
-- qc_tc_in 只有 总数量,生成(inspAutoSpecialAccept)不拷单位。
-- 处置:①三表补 计量单位 列(注明);②yj_field 注册(目录 detail 紧随数量/记录单·特采单 header 紧随数量列);
--      ③存量回填:目录按 检验单号+物料编码 取检验行单位;记录单经目录行桥接(检验数据记录单号);
--        特采单按 检验单号;已拼文本的数量列拆分(尾部单位剥离,数值归数量列);
--      ④配套代码(同提交):QcCatalogService 数量/单位分列写入,createInspRecord 带 单位;
--        ButtonService.inspAutoSpecialAccept SELECT+head 拷 计量单位。
-- 幂等:COL_LENGTH/NOT EXISTS/只填空。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO
-- ① 三表补列(注明)
IF COL_LENGTH('dbo.qc_catalog_detail', N'计量单位') IS NULL ALTER TABLE qc_catalog_detail ADD [计量单位] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_insp_rec', N'计量单位') IS NULL ALTER TABLE qc_insp_rec ADD [计量单位] nvarchar(50) NULL;
IF COL_LENGTH('dbo.qc_tc_in', N'计量单位') IS NULL ALTER TABLE qc_tc_in ADD [计量单位] nvarchar(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_catalog_detail') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_catalog_detail'),N'计量单位','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位(2026-09-24 补:与数量分列,生单从检验行计量单位带入)', N'SCHEMA',N'dbo',N'TABLE',N'qc_catalog_detail',N'COLUMN',N'计量单位';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_insp_rec') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_rec'),N'计量单位','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位(2026-09-24 补:来料数量的单位,生单从检验行带入)', N'SCHEMA',N'dbo',N'TABLE',N'qc_insp_rec',N'COLUMN',N'计量单位';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.qc_tc_in') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.qc_tc_in'),N'计量单位','ColumnId') AND name='MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位(2026-09-24 补:总数量的单位,特采生成时从检验行带入)', N'SCHEMA',N'dbo',N'TABLE',N'qc_tc_in',N'COLUMN',N'计量单位';
GO
-- ② 字段注册(目录明细紧随数量;记录单/特采单表头)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'计量单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT 'QC_CATALOG', N'计量单位', N'计量单位', N'文本', N'detail',
       ISNULL((SELECT MAX(seq)+5 FROM yj_field WHERE panel_code='QC_CATALOG' AND place LIKE '%detail%' AND col_name=N'数量'), 60), 80, 0, 0, 0, 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'计量单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT 'QC_INSP_REC', N'计量单位', N'计量单位', N'文本', N'header',
       ISNULL((SELECT MAX(seq)+5 FROM yj_field WHERE panel_code='QC_INSP_REC' AND place LIKE '%header%' AND col_name=N'来料数量'), 80), 80, 1, 0, 0, 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'计量单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT 'QC_TC_IN', N'计量单位', N'计量单位', N'文本', N'header',
       ISNULL((SELECT MAX(seq)+5 FROM yj_field WHERE panel_code='QC_TC_IN' AND place LIKE '%header%' AND col_name=N'总数量'), 80), 80, 0, 0, 0, 1;
GO
-- ③ 存量回填
-- 目录:按 检验单号+物料编码 取检验行单位;顺带拆已拼的数量文本(尾部非数字剥离)
UPDATE c SET c.计量单位 = d.计量单位
  FROM qc_catalog_detail c JOIN qc_insp_detail d ON d.单据编号 = c.检验单号 AND d.物料编码 = c.物料编码
 WHERE ISNULL(c.计量单位, N'') = N'' AND ISNULL(d.计量单位, N'') <> N'';
UPDATE qc_catalog_detail SET 数量 = LEFT(数量, PATINDEX(N'%[^0-9.]%', 数量 + N'#') - 1)
 WHERE PATINDEX(N'%[^0-9.]%', 数量 + N'#') > 1 AND ISNULL(计量单位,N'') <> N'';
-- 记录单:经目录行桥接(检验数据记录单号 → 检验单号+物料编码 → 检验行单位);来料数量同拆
UPDATE r SET r.计量单位 = d.计量单位
  FROM qc_insp_rec r JOIN qc_catalog_detail c ON c.检验数据记录单号 = r.单据编号 AND ISNULL(c.asp_cancel,'N')<>'Y'
  JOIN qc_insp_detail d ON d.单据编号 = c.检验单号 AND d.物料编码 = c.物料编码
 WHERE ISNULL(r.计量单位, N'') = N'' AND ISNULL(d.计量单位, N'') <> N'';
UPDATE qc_insp_rec SET 来料数量 = LEFT(来料数量, PATINDEX(N'%[^0-9.]%', 来料数量 + N'#') - 1)
 WHERE PATINDEX(N'%[^0-9.]%', 来料数量 + N'#') > 1 AND ISNULL(计量单位,N'') <> N'';
-- 特采单:按 检验单号 取检验行单位(一特采行一单,物料在备注;同单多行取首个非空单位)
UPDATE t SET t.计量单位 = u.u
  FROM qc_tc_in t JOIN (SELECT 单据编号, MAX(计量单位) AS u FROM qc_insp_detail WHERE ISNULL(计量单位,'')<>'' GROUP BY 单据编号) u
    ON u.单据编号 = t.检验单号
 WHERE ISNULL(t.计量单位, N'') = N'' AND ISNULL(u.u, N'') <> N'';
GO
-- ④ 自检
DECLARE @cc int = (SELECT COUNT(*) FROM qc_catalog_detail WHERE ISNULL(计量单位,N'')<>N'');
DECLARE @cr int = (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(计量单位,N'')<>N'');
DECLARE @ct int = (SELECT COUNT(*) FROM qc_tc_in WHERE ISNULL(计量单位,N'')<>N'');
DECLARE @f int = (SELECT COUNT(*) FROM yj_field WHERE col_name=N'计量单位' AND panel_code IN ('QC_CATALOG','QC_INSP_REC','QC_TC_IN'));
PRINT N'[qc-unit-flow] 自检:字段注册 ' + CAST(@f AS nvarchar(10)) + N'/3;回填 目录/记录/特采 = ' + CAST(@cc AS nvarchar(10)) + N'/' + CAST(@cr AS nvarchar(10)) + N'/' + CAST(@ct AS nvarchar(10)) + N' 行';
IF @f <> 3 RAISERROR(N'[qc-unit-flow] 自检失败:字段注册 %d/3', 16, 1, @f);
GO
