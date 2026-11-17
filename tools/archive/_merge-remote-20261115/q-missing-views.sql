/* 正式库有、测试库没有的视图(以及两边定义不同的视图)—— 用于测试库视图修复 */
SELECT 'MISSING_IN_TEST' AS kind, name FROM HSDZ_MES.sys.views v
WHERE v.is_ms_shipped = 0 AND NOT EXISTS (SELECT 1 FROM HSDZ_MES_TEST.sys.views t WHERE t.name = v.name)
ORDER BY name;
