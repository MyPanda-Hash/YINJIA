SET NOCOUNT ON;
PRINT '== A. 现存 表区 取值 ==';
SELECT 表区, COUNT(*) AS 行数 FROM dbo.qc_proc_insp_detail GROUP BY 表区 ORDER BY 表区;

PRINT '== B. ZC-2026-10-0001/0002 明细(全列关键项) ==';
SELECT 单据编号, 行号, '[' + ISNULL(表区, '') + ']' AS 表区, 检验项目, 检验要求, 检验方法, 检查频率,
       ISNULL(CAST(格数 AS nvarchar(10)), '-') AS 格数, ISNULL(CAST(格数上限 AS nvarchar(10)), '-') AS 格数上限,
       ISNULL(实测数值, '') AS 实测数值,
       ISNULL(CAST(测量值1 AS nvarchar(20)), '') AS 测量值1, ISNULL(CAST(测量值2 AS nvarchar(20)), '') AS 测量值2,
       ISNULL(CAST(测量值5 AS nvarchar(20)), '') AS 测量值5
FROM dbo.qc_proc_insp_detail WHERE 单据编号 IN ('ZC-2026-10-0001', 'ZC-2026-10-0002')
ORDER BY 单据编号, 行号, id;

PRINT '== C. 检验项/检验项目 词条(bs_qc_item) ==';
SELECT TOP 30 方案编码, 项目名称, 检验内容, 检验数量 FROM dbo.bs_qc_item ORDER BY 方案编码, 序号;

PRINT '== D. yj_field 里是否已有「列数」标签(避免撞键) ==';
SELECT panel_code, label, col_name, place, visible, hidden FROM dbo.yj_field WHERE label LIKE N'%列数%';
