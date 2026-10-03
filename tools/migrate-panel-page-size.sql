-- migrate-panel-page-size.sql — 面板每页行数收敛(2026-09-28,P1 渲染量减半)
--
-- 背景(实测:生产构建切换耗时与首屏单元格数正相关)
--   首屏单元格数 = 每页行数 × 列表可见列数,而 50 行×56 列(INV)实测切换 ~0.8~1.2s、DOM 1.7 万节点。
--   实测最重的几个:MANU_SCHEDULE 100 行×50 列 = 5000 单元格、RD_PROD_DOCLIST 500×9 = 4500、
--   DISPATCH_DETAIL 100×35 = 3500、RD_SAMPLE_NO 200×17 = 3400。
--
-- 两条改法(口径不同,别混):
--   ① **doc / flat 面板** —— pageSize 真正生效(`QueryService` 用它做 `OFFSET/FETCH`,
--      前端 `PanelxList` 用它做显示分页)⇒ 按"单元格阶梯"收敛:
--         可见列数 ≤ 30 → 50 行;31~60 → 25 行;> 60 → 20 行
--      即每页最多约 1500 个单元格(原来最多 5000)。代价:每页行数变少、翻页变多(纯元数据,可随时调回)。
--   ② **archive 档案面板** —— `QueryService.queryArchive` **完全忽略 pageSize**(全量返回,
--      上限 ARCH_LOAD_CAP=50000),前端显示分页用的是**前端硬编码**的 archPageSize(默认 50)
--      ⇒ DB 里给它们写的 100/200 是**死元数据**(与实际显示不符,误导后来人)⇒ 一律对齐为 50。
--
-- 幂等:只更新与目标值不同的行;可重跑。
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

DECLARE @plan TABLE (panel varchar(50) PRIMARY KEY, mode varchar(20), cols int, old_size int, new_size int, why nvarchar(60));

-- ① doc / flat 面板:按可见列数阶梯
INSERT INTO @plan (panel, mode, cols, old_size, new_size, why)
SELECT RTRIM(p.panel_code), p.mode, c.cols, p.page_size,
       CASE WHEN c.cols > 60 THEN 20 WHEN c.cols > 30 THEN 25 ELSE 50 END,
       N'doc/flat:单元格阶梯'
FROM yj_panel p
CROSS APPLY (
  SELECT COUNT(*) AS cols FROM yj_field f
  WHERE RTRIM(f.panel_code) = RTRIM(p.panel_code) AND f.visible = 1 AND f.place LIKE '%detail%'
) c
WHERE p.mode <> 'archive' AND p.page_size >= 100 AND c.cols > 0;

-- ② archive 面板:死元数据对齐为 50(与实际显示一致)
INSERT INTO @plan (panel, mode, cols, old_size, new_size, why)
SELECT RTRIM(p.panel_code), p.mode, v.cols, p.page_size, 50, N'archive:死元数据对齐显示值'
FROM yj_panel p
CROSS APPLY (SELECT COUNT(*) AS cols FROM yj_field f WHERE RTRIM(f.panel_code) = RTRIM(p.panel_code)) v
WHERE p.mode = 'archive' AND p.page_size >= 100;

UPDATE p SET page_size = pl.new_size
FROM yj_panel p JOIN @plan pl ON RTRIM(p.panel_code) = pl.panel
WHERE p.page_size <> pl.new_size;

PRINT N'=== 本次调整(前 40 行)===';
SELECT TOP 40 panel AS 面板, mode AS 模式, cols AS 可见列数, old_size AS 原行数, new_size AS 新行数, why AS 依据 FROM @plan ORDER BY why, new_size, old_size DESC;
SELECT COUNT(*) AS 计划调整数, SUM(CASE WHEN old_size = new_size THEN 1 ELSE 0 END) AS 已达标 FROM @plan;
GO

-- 验证:改动后现场(page_size >= 100 且非 archive 应为 0)
SELECT COUNT(*) AS 仍为100以上的docflat面板 FROM yj_panel WHERE mode <> 'archive' AND page_size >= 100;
SELECT COUNT(*) AS 仍为100以上的archive面板 FROM yj_panel WHERE mode = 'archive' AND page_size >= 100;
select ISNULL(page_size,0) AS page_size, COUNT(*) AS 面板数 from yj_panel group by ISNULL(page_size,0) order by 1;
GO
