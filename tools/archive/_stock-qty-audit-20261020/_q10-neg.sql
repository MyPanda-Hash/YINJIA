SET NOCOUNT ON;

PRINT N'== 1. inh 负数量行 按 src/单据类型 归因 ==';
SELECT src, 单据类型, COUNT(*) AS 负行数, CAST(SUM(数量) AS decimal(18,4)) AS 合计数量
FROM dbo.inh WHERE ISNULL(数量,0) < -0.0001
GROUP BY src, 单据类型 ORDER BY SUM(数量);

PRINT N'== 2. inh 各 src 的行数与数量合计 ==';
SELECT src, COUNT(*) AS 行数, CAST(SUM(ISNULL(数量,0)) AS decimal(18,4)) AS 数量合计
FROM dbo.inh GROUP BY src ORDER BY src;

PRINT N'== 3. v_stock_balance 负现存量 TOP 20 ==';
SELECT TOP 20 仓库编码, 仓库, 存货编码, 存货, CAST(现存量 AS decimal(18,4)) AS 现存量,
       CAST(结存金额 AS decimal(18,4)) AS 结存金额
FROM dbo.v_stock_balance WHERE 现存量 < -0.0001 ORDER BY 现存量;

PRINT N'== 4. v_stock_balance 零现存量行(库存状况表里显示 0 的行) ==';
SELECT COUNT(*) AS 零行数 FROM dbo.v_stock_balance WHERE ABS(现存量) <= 0.0001;

PRINT N'== 5. 库存状况表面板字段 ==';
SELECT col_name, label, data_type, place, seq, visible, hidden, ref_panel, ref_field
FROM yj_field WHERE panel_code='STOCK_BALANCE' ORDER BY seq;
