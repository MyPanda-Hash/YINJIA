-- 临时探针(仅测试库):验证新插入、未带「来料检验」列的商品行是否自动落「否」——事务内插入后回滚,不留数据
SET NOCOUNT ON;

SELECT N'NOT NULL 列' AS 项, c.name AS 列名 FROM sys.columns c
WHERE c.object_id = OBJECT_ID('dbo.bs_inv') AND c.is_nullable = 0 ORDER BY c.column_id;

SELECT N'默认约束' AS 项, d.name AS 名称, CAST(d.definition AS nvarchar(50)) AS 定义
FROM sys.default_constraints d WHERE d.parent_object_id = OBJECT_ID('dbo.bs_inv') AND d.name = N'DF_bs_inv_来料检验';

BEGIN TRAN;
-- 刻意**不带** 来料检验 列(模拟 MES 侧新增商品行的插入路径)
INSERT INTO dbo.bs_inv (所属类别, 存货编码, 存货名称, 状态, 是否检验, 数据来源)
VALUES (N'默认值测试', N'__ZZ_CF_DEFAULT_TEST__', N'来料检验默认值测试行', N'启用', 0, N'手工');
SELECT N'插入后取值(期望 否)' AS 项, 来料检验 AS 值 FROM dbo.bs_inv WHERE 存货编码 = N'__ZZ_CF_DEFAULT_TEST__';
ROLLBACK;
SELECT N'回滚后残留(期望 0)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM dbo.bs_inv WHERE 存货编码 = N'__ZZ_CF_DEFAULT_TEST__';
