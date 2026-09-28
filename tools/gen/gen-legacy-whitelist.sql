-- gen-legacy-whitelist.sql — 生成「数据库规范冻结/豁免登记」的数据行(供 db-legacy-whitelist.txt)
-- 用法(仓库根目录):
--   sqlcmd -S localhost -E -d HSDZ_MES -I -f 65001 -i tools\gen\gen-legacy-whitelist.sql -h -1 -W -u -o %TEMP%\_wl.txt
--   再按 docs/development/数据库规范.md §5 的格式加头部注释(仅一次成型,之后人工维护)
-- 说明:每行以 | 收尾(保护尾空格列名,如 bd_sale_out.[ivc_status ]);消费方去掉末尾 |
SET NOCOUNT ON;
GO
SELECT CONCAT(kind, ':', name, '|') AS line FROM (
  -- 冻结表:一切非规范前缀、非备份/临时的表
  SELECT 'table' AS kind, name FROM sys.tables
  WHERE name NOT LIKE 'yj[_]%' AND name NOT LIKE 'bs[_]%' AND name NOT LIKE 'bd[_]%' AND name NOT LIKE 'bl[_]%'
    AND name NOT LIKE 'rd[_]%' AND name NOT LIKE 'qc[_]%' AND name NOT LIKE 'wo[_]%'
    AND name NOT LIKE '%bak%' AND name NOT LIKE 'RENAME%' AND name NOT LIKE 'tmp%' AND name NOT LIKE 't[0-9]'
  UNION ALL
  -- 已下线面板(实体表已不存在,行保留以免前端配置/回滚断链)
  SELECT 'panel', RTRIM(panel_code) FROM yj_panel WHERE RTRIM(panel_code) IN ('RD_ASM_BOM', 'RD_MOLD_FORMULA')
  UNION ALL
  -- 特殊字符列名冻结(存量;新列禁止同类命名)
  SELECT DISTINCT 'col', CONCAT(t.name, '.', c.name)
  FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
  WHERE (c.name LIKE '%[.%/]%' OR c.name LIKE '%[(]%' OR c.name LIKE '%[)]%'
      OR c.name LIKE '%[（]%' OR c.name LIKE '%[）]%' OR c.name LIKE '%[ ]%')
    AND t.name NOT LIKE '%bak%' AND t.name NOT LIKE 'RENAME%' AND t.name NOT LIKE 'tmp%' AND t.name NOT LIKE 't[0-9]'
  UNION ALL
  -- 同一物理列挂多个中文标签(数据键不唯一)⇒ 待收敛登记,告警不阻断
  SELECT DISTINCT 'dupkey', CONCAT(RTRIM(f.panel_code), '.', f.col_name)
  FROM yj_field f
  WHERE EXISTS (SELECT 1 FROM yj_field k
                WHERE RTRIM(k.panel_code) = RTRIM(f.panel_code) AND k.col_name = f.col_name AND k.id <> f.id
                  AND RTRIM(k.place) <> RTRIM(f.place))
) x
ORDER BY kind, name;
GO
