-- 全面修复:报表面板字段与视图实际列对齐
-- 问题:yj_field 自动注册时用了旧列名(含点/已改名),视图重建后列名已变,yj_field 未同步
USE HSDZ_MES;
SET NOCOUNT ON;

-- 1. 删除所有报表面板(DETAIL/STATS)的旧字段
DELETE FROM yj_field WHERE panel_code LIKE '%_DETAIL' OR panel_code LIKE '%_STATS';
PRINT '报表字段已清空';

-- 2. 从视图实际列重新注册(排除 id/asp_cancel)
DECLARE @panels TABLE (code varchar(50), vw sysname);
INSERT INTO @panels
SELECT p.panel_code, p.line_table FROM yj_panel p
WHERE p.mode = 'flat' AND p.line_table LIKE 'v[_]%'
UNION
SELECT p.panel_code, p.line_table FROM yj_panel p
WHERE (p.panel_code LIKE '%_DETAIL' OR p.panel_code LIKE '%_STATS') AND p.line_table LIKE 'v[_]%';

DECLARE @code varchar(50), @vw sysname, @n sysname, @i int;
DECLARE pc CURSOR FOR SELECT DISTINCT code, vw FROM @panels;
OPEN pc; FETCH NEXT FROM pc INTO @code, @vw;
WHILE @@FETCH_STATUS = 0 BEGIN
  IF OBJECT_ID(@vw) IS NOT NULL BEGIN
    SET @i = 0;
    DECLARE fc CURSOR FOR SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(@vw) AND c.name NOT IN ('id','asp_cancel') ORDER BY c.column_id;
    OPEN fc; FETCH NEXT FROM fc INTO @n;
    WHILE @@FETCH_STATUS = 0 BEGIN
      SET @i += 10;
      INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
      VALUES (@code, @n, @n, N'文本', NULL, NULL, NULL, NULL, N'detail', @i, 130, 1, 0, 0, 1);
      FETCH NEXT FROM fc INTO @n;
    END
    CLOSE fc; DEALLOCATE fc;
    PRINT @code + ': ' + CAST(@i/10 AS varchar) + ' 字段注册';
  END
  FETCH NEXT FROM pc INTO @code, @vw;
END
CLOSE pc; DEALLOCATE pc;
GO

-- 3. 修复含特殊字符的 yj_field col_name(统一去点)
UPDATE yj_field SET col_name = N'生产车间', label = N'生产车间' WHERE col_name = N'明细.生产车间';
UPDATE yj_field SET col_name = N'部门负责人', label = N'部门负责人' WHERE col_name = N'部门.负责人';
GO

-- 4. 验证:yj_field 不再引用含点列
SELECT '含点列名' AS issue, COUNT(*) AS cnt FROM yj_field WHERE col_name LIKE '%.%' AND panel_code NOT IN ('KHDA','GFDA','YWYDA','CKDA','ZDGL');
-- 5. 验证:报表面板字段数
SELECT panel_code, COUNT(*) AS fields FROM yj_field WHERE panel_code LIKE '%_DETAIL' OR panel_code LIKE '%_STATS' GROUP BY panel_code ORDER BY panel_code;
GO
