SET NOCOUNT ON;
GO
SELECT N'=== A. 所有含"级"的字段(yj_field: 定级/等级/层级) ===' AS hdr;
GO
SELECT panel_code, col_name, label, data_type, place, seq, editable, required, hidden, visible,
       REPLACE(REPLACE(dict_sql, CHAR(13), N' '), CHAR(10), N' ') AS dict_sql_1line
FROM yj_field
WHERE col_name LIKE N'%级%' OR label LIKE N'%级%' OR col_name LIKE N'%level%' OR col_name LIKE N'%grade%'
ORDER BY panel_code, seq;
GO
SELECT N'=== B. dict_sql 里出现"四级"的字段 ===' AS hdr;
GO
SELECT panel_code, col_name, label, REPLACE(REPLACE(dict_sql, CHAR(13), N' '), CHAR(10), N' ') AS dict_sql_1line
FROM yj_field WHERE dict_sql LIKE N'%四级%' ORDER BY panel_code, seq;
GO
SELECT N'=== C. dict_sql 里出现"三级"但不含"四级"的字段(3选 vs 4选) ===' AS hdr;
GO
SELECT panel_code, col_name, label, REPLACE(REPLACE(dict_sql, CHAR(13), N' '), CHAR(10), N' ') AS dict_sql_1line
FROM yj_field WHERE dict_sql LIKE N'%三级%' AND dict_sql NOT LIKE N'%四级%' ORDER BY panel_code, seq;
GO
SELECT N'=== D. dict_sql 里出现"一级"的字段 ===' AS hdr;
GO
SELECT panel_code, col_name, label, REPLACE(REPLACE(dict_sql, CHAR(13), N' '), CHAR(10), N' ') AS dict_sql_1line
FROM yj_field WHERE dict_sql LIKE N'%一级%' ORDER BY panel_code, seq;
GO
SELECT N'=== E. RD_PLAN / RD_PROGRESS / RD_APPROVAL 全部字段 ===' AS hdr;
GO
SELECT panel_code, seq, col_name, label, data_type, editable, required, hidden, visible, place
FROM yj_field WHERE panel_code IN ('RD_PLAN','RD_PROGRESS','RD_APPROVAL') ORDER BY panel_code, seq;
GO
SELECT N'=== F. 翻译覆盖:四级/三级/二级/项目定级/项目层级 ===' AS hdr;
GO
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key IN (N'四级', N'三级', N'二级', N'项目定级', N'项目层级', N'项目等级', N'产品开发二三四级项目控制列表')
ORDER BY ref_key, locale;
GO
SELECT N'=== F2. 翻译覆盖:测试记录相关词条 ===' AS hdr;
GO
SELECT scope, ref_key, locale, text FROM yj_translation
WHERE ref_key LIKE N'%监控%' OR ref_key LIKE N'%测试记录%' OR ref_key IN (N'数据记录表', N'实验室使用记录表', N'功能性滤效', N'碱性', N'矿化', N'抑菌')
ORDER BY ref_key, locale;
GO
SELECT N'=== G. bs_dict 表结构 ===' AS hdr;
GO
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_dict' ORDER BY ORDINAL_POSITION;
GO
SELECT N'=== G2. bs_dict 全部内容(<=50) ===' AS hdr;
GO
SELECT TOP 50 * FROM bs_dict;
GO
SELECT N'=== H. yj_user 用户清单(找冯总/管理员) ===' AS hdr;
GO
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_user' ORDER BY ORDINAL_POSITION;
GO
SELECT N'=== H2. yj_user 全部行 ===' AS hdr;
GO
SELECT * FROM yj_user;
GO
