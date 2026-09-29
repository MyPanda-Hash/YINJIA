-- migrate-panel-page-size-archive.sql — 宽表档案面板单页减半(2026-09-28,P1 渲染量)
--
-- 为什么单独一条:前一版 migrate-panel-page-size.sql 只改了 doc/flat 面板的 pageSize,
-- 并把 archive 面板的 `page_size` 对齐成 50 —— 当时结论是"档案面板的 page_size 是死元数据"
-- (成立:`QueryService.queryArchive` 忽略 pageSize 全量返回;前端显示分页用 archPageSize 硬编码 50)。
-- 现在配合前端改动(PanelxList 让 archPageSize 读面板配置)把这个旋钮**真正打开**,
-- 于是可以按面板把宽表的单页行数调小,直接减半渲染量。
--
-- 选择依据(空闲起点实测 render 相位,生产构建):
--   INV 991ms(+33678 DOM,55 列×50 行=2800 单元格)/ KHDA 482ms(+7074)/ ZDGL 397ms(+5800)
--   / WC 389ms / RD_SINTER_TOL 315ms  → 一律 50 → 25
--   对照:WH 117ms、INV_PRICE 204ms 保持 50(不值当牺牲翻页体验)
--
-- 幂等:只更新目标值不同的行;可重跑。两账套执行。
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO
DECLARE @t TABLE (panel varchar(50) PRIMARY KEY, new_size int);
INSERT INTO @t VALUES ('INV', 25), ('KHDA', 25), ('ZDGL', 25), ('RD_SINTER_TOL', 25), ('WC', 25);

UPDATE p SET page_size = t.new_size
FROM yj_panel p JOIN @t t ON RTRIM(p.panel_code) = t.panel
WHERE p.mode = 'archive' AND ISNULL(p.page_size, 0) <> t.new_size;

SELECT RTRIM(p.panel_code) AS 面板, p.page_size AS 单页行数 FROM yj_panel p
WHERE RTRIM(p.panel_code) IN ('INV','KHDA','ZDGL','RD_SINTER_TOL','WC','WH','INV_PRICE') ORDER BY 面板;
GO
