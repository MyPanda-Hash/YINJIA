-- migrate-qc-unit-merge.sql — 撤「数量/单位拆列」,恢复三面板数量+单位拼合口径(2026-09-24)
-- ═════════════════════════════════════════════════════════════════════════════
-- 用户口径:检验目录/检验数据记录/特采单 的数量与计量单位**合在一起**(数量列即 '200支'/'1kg' 文本),
-- 不要拆成两列显示。上一轮(migrate-qc-unit-flow)拆列+剥离存量,本轮恢复:
--   ①目录.数量 / 记录单.来料数量:把 计量单位 拼回数量文本(无单位行不拼);
--   ②特采单.总数量 decimal→nvarchar(50),存量按 计量单位 拼成文本;
--   ③三面板 计量单位 字段行 hidden=1(列与数据保留做链路流转——生成入库单仍取得到单位,界面不显示)。
-- 配套代码(同提交):QcCatalogService 数量写回 qtyWithUnit 拼文本(计量单位列照写);
--   inspAutoSpecialAccept 总数量写 trimZero(tot)+单位;tcInApprovedGenerate 解析总数量剥单位后缀。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO
-- ① 目录/记录单:拼回
UPDATE qc_catalog_detail SET 数量 = 数量 + 计量单位
 WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 数量+N'#') = LEN(数量)+1;  -- 仅纯数值行拼
UPDATE qc_insp_rec SET 来料数量 = 来料数量 + 计量单位
 WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 来料数量+N'#') = LEN(来料数量)+1;
GO
-- ② 特采单:总数量 转文本并拼单位(分批执行:同批编译期 DDL 后的引用列不存在,必须 GO 断开;
--   幂等守卫:总数量已是 nvarchar 文本型则下述各步自然全部 no-op,防重复执行造成 '200支支' 双拼)
--   ⚠ 2026-09-24 修复:原稿用 `IF ... ELSE BEGIN ... GO ... END GO` 跨批包裹,GO 切批后
--     BEGIN 无配对的 END ⇒ DbSync/sqlcmd 报「'GO' 附近有语法错误」,脚本从未登记入链。
--     改为「每步各自独立批次 + 各自守卫」,无跨批 BEGIN/END。
IF TYPEPROPERTY(COLUMNPROPERTY(OBJECT_ID('dbo.qc_tc_in'), N'总数量', 'xusertype'), 'precision') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.qc_tc_in') AND c.name = N'总数量'
                AND TYPE_NAME(c.system_type_id) LIKE 'nvarchar%')
   PRINT N'[qc-unit-merge] 特采总数量已是文本型,§② 无需转换(幂等)';
GO
IF COL_LENGTH('dbo.qc_tc_in', N'总数量文本') IS NOT NULL ALTER TABLE qc_tc_in DROP COLUMN [总数量文本];
GO
IF COL_LENGTH('dbo.qc_tc_in', N'总数量') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.qc_tc_in') AND c.name = N'总数量' AND TYPE_NAME(c.system_type_id) LIKE 'nvarchar%')
EXEC sp_rename N'dbo.qc_tc_in.总数量', N'总数量文本', 'COLUMN';
GO
IF COL_LENGTH('dbo.qc_tc_in', N'总数量') IS NULL
ALTER TABLE qc_tc_in ADD [总数量] nvarchar(50) NULL;
GO
-- 引用临时列的语句必须走动态 SQL:否则整批编译期即报「列名 '总数量文本' 无效」(即使 IF 为假)
IF COL_LENGTH('dbo.qc_tc_in', N'总数量文本') IS NOT NULL
EXEC sp_executesql N'UPDATE qc_tc_in SET 总数量 = CAST(总数量文本 AS nvarchar(30))
  + CASE WHEN ISNULL(计量单位,N'''' ) <> N'''' THEN 计量单位 ELSE N'''' END';
GO
IF COL_LENGTH('dbo.qc_tc_in', N'总数量文本') IS NOT NULL
EXEC sp_executesql N'ALTER TABLE qc_tc_in DROP COLUMN [总数量文本]';
GO
-- ③ 三面板 计量单位 字段隐藏(链路列保留,界面不显示)
UPDATE yj_field SET hidden = 1, visible = 0
 WHERE col_name = N'计量单位' AND panel_code IN ('QC_CATALOG','QC_INSP_REC','QC_TC_IN');
GO
-- 自检
DECLARE @s int = (SELECT COUNT(*) FROM qc_catalog_detail WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 数量+N'#') = LEN(数量)+1);
DECLARE @r int = (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 来料数量+N'#') = LEN(来料数量)+1);
DECLARE @t int = (SELECT COUNT(*) FROM qc_tc_in WHERE ISNULL(计量单位,N'')<>N'' AND PATINDEX(N'%[^0-9.]%', 总数量+N'#') = LEN(总数量)+1);
DECLARE @h int = (SELECT COUNT(*) FROM yj_field WHERE col_name=N'计量单位' AND panel_code IN ('QC_CATALOG','QC_INSP_REC','QC_TC_IN') AND hidden=1);
PRINT N'[qc-unit-merge] 自检:未拼回残留 目录/记录/特采 = ' + CAST(@s AS nvarchar(10)) + N'/' + CAST(@r AS nvarchar(10)) + N'/' + CAST(@t AS nvarchar(10)) + N';隐藏 ' + CAST(@h AS nvarchar(10)) + N'/3';
IF @h <> 3 RAISERROR(N'[qc-unit-merge] 自检失败:隐藏 %d/3', 16, 1, @h);
GO
