-- 修复:生产加工单(MANU_ORDER)新增空白草稿报 207 Invalid column name '单据日期'
-- 根因:yj_panel.date_col=N'单据日期',但 bd_manu_order 建表缺该列(其余单据头表均有
--       [单据日期] date 列);ButtonService.saveDoc directAdd 会按 date_col 无条件写列,
--       INSERT 命中不存在的列 -> SQL 207。
-- 方案:补列与其它单据头表对齐;存量行以创建时间(asp_time1)回登;保持可空——
--       销售订单生成生产加工单(SO_ORDER→MANU_ORDER 生单链路)写头表时不带该列,
--       若 NOT NULL 无默认值会挡生单。
USE HSDZ_MES;
SET NOCOUNT ON;

IF COL_LENGTH('dbo.bd_manu_order', N'单据日期') IS NULL
BEGIN
  ALTER TABLE dbo.bd_manu_order ADD [单据日期] date NULL;
  PRINT 'bd_manu_order: 单据日期 已补';
END
GO

-- 回登须在新批执行:同批内 UPDATE 引用刚 ADD 的列会在编译期报 207;
-- 幂等:仅补 NULL 行,重跑无副作用
UPDATE dbo.bd_manu_order SET [单据日期] = CONVERT(date, asp_time1) WHERE [单据日期] IS NULL;
GO

-- 验证:返回 0 行 = 所有面板 date_col 与物理列一致
SELECT p.panel_code, p.date_col, COALESCE(p.head_table, p.line_table) AS tbl
FROM yj_panel p
WHERE p.date_col IS NOT NULL
  AND COL_LENGTH(COALESCE(p.head_table, p.line_table), p.date_col) IS NULL;
GO
