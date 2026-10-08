SET NOCOUNT ON;
PRINT N'=== 1. bs_wh 现存 vs 库存链路引用(仓库编码) ===';
SELECT N'bs_wh 现存' AS 来源, 仓库编码, COUNT(*) AS 行数 FROM dbo.bs_wh GROUP BY 仓库编码
UNION ALL
SELECT N'kucun.ckdm', ckdm, COUNT(*) FROM dbo.kucun GROUP BY ckdm
UNION ALL
SELECT N'inh.仓库编码', 仓库编码, COUNT(*) FROM dbo.inh GROUP BY 仓库编码
UNION ALL
SELECT N'outh.仓库编码', 仓库编码, COUNT(*) FROM dbo.outh GROUP BY 仓库编码
ORDER BY 来源, 仓库编码;
GO
PRINT N'=== 2. WH 面板的档案修改留痕(谁删的) ===';
SELECT TOP 20 id, panel_code, doc_no, user_name, CONVERT(varchar(19), saved_at, 120) AS 时间,
       LEFT(CAST(change_meta AS nvarchar(400)), 300) AS 摘要
FROM yj_archive_change_log WHERE panel_code IN ('WH','WHLOC') ORDER BY id DESC;
GO
PRINT N'=== 3. 使用日志(WH 面板近 20 条) ===';
SELECT TOP 20 * FROM yj_usage_log WHERE panel_name IN (N'仓库', N'仓位') ORDER BY id DESC;
GO
PRINT N'=== 4. bs_wh 行 id 分布(87-91 是否确已不存在) ===';
SELECT id, 仓库编码, 仓库名称 FROM dbo.bs_wh WHERE id BETWEEN 80 AND 115 ORDER BY id;
SELECT N'id=87..91 存在行数' AS 检查, COUNT(*) AS 值 FROM dbo.bs_wh WHERE id BETWEEN 87 AND 91;
GO
PRINT N'=== 5. bs_wh_loc 现状(仓库列引用的名称是否还存在于 bs_wh) ===';
SELECT l.id, l.仓库, l.仓库编码, l.仓位编码,
       CASE WHEN EXISTS (SELECT 1 FROM dbo.bs_wh w WHERE w.仓库编码 = l.仓库编码) THEN N'在' ELSE N'★已不在 bs_wh' END AS 仓库档案
FROM dbo.bs_wh_loc l ORDER BY l.id;
GO
PRINT N'=== 6. 今日迁移链执行记录(看有没有清理类脚本刚跑过) ===';
SELECT TOP 15 script_name, CONVERT(varchar(19), applied_at, 120) AS 执行时间, status
FROM yj_schema_log ORDER BY id DESC;
GO
