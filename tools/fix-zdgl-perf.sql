-- 数据字典性能修复:迁到新表 + 静态选项 + 分页
USE HSDZ_MES;
SET NOCOUNT ON;
-- 1. 建新表(轻量,只有需要的列)
IF OBJECT_ID('bs_dict') IS NULL CREATE TABLE bs_dict (
  id int IDENTITY(1,1) PRIMARY KEY,
  [字典类别] nvarchar(50) NOT NULL,
  [代码] nvarchar(50) NOT NULL,
  [名称] nvarchar(200) NOT NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
-- 2. 迁移数据(排除已作废)
INSERT INTO bs_dict ([字典类别], [代码], [名称], [备注], asp_user1, asp_time1)
SELECT lb, dm, mc, bz, N'migration', SYSDATETIME()
FROM dm_gx WHERE ISNULL(asp_cancel, 'N') <> 'Y';
-- 3. 更新面板指向新表 + 限页
UPDATE yj_panel SET line_table = 'bs_dict', page_size = 20 WHERE panel_code = 'ZDGL';
-- 4. 更新字段:col_name 改中文键(与新表列名一致),dict_sql 改静态 VALUES
UPDATE yj_field SET col_name = N'字典类别', dict_sql = N'SELECT v FROM (VALUES (N''JYRY''),(N''JYJG''),(N''WLFZ''),(N''DYJ''),(N''JLDW''),(N''PCXZ''),(N''KHLY''),(N''LHXZ''),(N''XSJGLX''),(N''YSFS''),(N''JSFS''),(N''SCX''),(N''YWYQ''),(N''QY''),(N''QZ''),(N''DZ''),(N''HPCZ''),(N''CPH''),(N''BB''),(N''BFYY''),(N''DCLYY''),(N''DW''),(N''JHFS''),(N''JMBDX''),(N''KHFZ''),(N''REM''),(N''SKTJ''),(N''TLYY''),(N''A供'')) AS t(v)' WHERE panel_code='ZDGL' AND col_name='lb';
UPDATE yj_field SET col_name = N'代码' WHERE panel_code='ZDGL' AND col_name='dm';
UPDATE yj_field SET col_name = N'名称' WHERE panel_code='ZDGL' AND col_name='mc';
UPDATE yj_field SET col_name = N'备注' WHERE panel_code='ZDGL' AND col_name='bz';
-- 5. 翻译(字典类别/代码/名称/备注 已有词条)
SELECT 'bs_dict 行' AS k, COUNT(*) AS v FROM bs_dict;
SELECT 'page_size' AS k, page_size AS v FROM yj_panel WHERE panel_code='ZDGL';
SELECT col_name, LEFT(dict_sql, 60) AS dict FROM yj_field WHERE panel_code='ZDGL' ORDER BY seq;
GO
