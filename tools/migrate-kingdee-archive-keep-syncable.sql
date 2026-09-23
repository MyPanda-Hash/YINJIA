-- migrate-kingdee-archive-keep-syncable.sql — 档案面板只保留「金蝶接口可同步」的字段
-- 口径(用户确认 2026-09-15):面板列 = sync-core.mapArchive 实际能写出、且金蝶接口(列表∪详情)真有该键的字段;
--   其余一律删除(敏感密文字段当前策略不落库→删;金蝶接口无此键→删;纯 id 无名称孪生→不建)。
--   物理列保留(不 DROP),只删 yj_field 面板字段,可随时按需恢复。
-- 生成器:tools/archive/_gen-keep-syncable.mjs(与映射同源,防手工漂移)
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ══ SETTLE(BD_SETTLE):保留 3 删 0 ══
-- (无需删除)
GO

-- ══ CUSGRP(BD_CUSGRP):保留 7 删 0 ══
-- (无需删除)
GO

-- ══ SUPGRP(BD_SUPGRP):保留 6 删 0 ══
-- (无需删除)
GO

-- ══ MATGRP(BD_MATGRP):保留 8 删 0 ══
-- (无需删除)
GO

-- ══ CUR(BD_CUR):保留 12 删 0 ══
-- (无需删除)
GO

-- ══ UOM(BD_UOM):保留 11 删 0 ══
-- (无需删除)
GO

-- ══ DEPT(BD_DEPT):保留 10 删 0 ══
-- (无需删除)
GO

-- ══ EMP(BD_EMP):保留 13 删 0 ══
-- (无需删除)
GO

-- ══ WH(BD_STORE):保留 15 删 0 ══
-- (无需删除)
GO

-- ══ INV(BD_MATERIAL):保留 75 删 0 ══
-- (无需删除)
GO

-- ══ KHDA(BD_CUSTOMER):保留 50 删 0 ══
-- (无需删除)
GO

-- ══ GFDA(BD_SUPPLIER):保留 21 删 0 ══
-- (无需删除)
GO

-- ══ 自检:各面板剩余字段数 ══
SELECT panel_code, COUNT(*) AS 可同步字段数 FROM yj_field WHERE panel_code IN ('KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR') GROUP BY panel_code ORDER BY panel_code;
PRINT N'migrate-kingdee-archive-keep-syncable 完成(仅保留可同步字段)';
GO