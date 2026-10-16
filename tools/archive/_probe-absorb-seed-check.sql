/* _probe-absorb-seed-check.sql — 只读：吸收验证前，先看测试库可用的产线/路线/台账结构 */
SET NOCOUNT ON;
SELECT DB_NAME() AS 当前库;

SELECT '== bs_route(GY-CB-STD) ==' AS section;
SELECT 工序名称 + ' 序=' + CAST(ISNULL(加工顺序,0) AS varchar(10)) + ' 率=' + CAST(ISNULL(换算率,1) AS varchar(20)) AS v
FROM bs_route WHERE 工艺路线编码='GY-CB-STD' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY ISNULL(加工顺序,999);

SELECT '== bs_prod_line(前 6 条启用) ==' AS section;
SELECT TOP 6 生产线 + ' | 车间=' + ISNULL(生产车间,'-') AS v FROM bs_prod_line
WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 生产线;

SELECT '== wo_process_line 列 ==' AS section;
SELECT STUFF((SELECT ', ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.wo_process_line') FOR XML PATH(''), TYPE).value('.','nvarchar(max)'),1,2,'') AS v;

SELECT '== 测试库里 plang 行数 / 最大 id ==' AS section;
SELECT 'plang=' + CAST(COUNT(*) AS varchar(10)) + ' maxid=' + CAST(ISNULL(MAX(id),0) AS varchar(10)) AS v FROM plang;

SELECT '== 测试库里 scjl 行数 / 最大 id ==' AS section;
SELECT 'scjl=' + CAST(COUNT(*) AS varchar(10)) + ' maxid=' + CAST(ISNULL(MAX(id),0) AS varchar(10)) AS v FROM scjl;

SELECT '== 测试库里是否已有本次验证用行(幂等检查) ==' AS section;
SELECT 'plang=' + CAST((SELECT COUNT(*) FROM plang WHERE pl_no='GD-TEST-ABSORB-01') AS varchar(10))
     + ' scjl=' + CAST((SELECT COUNT(*) FROM scjl WHERE gldh='GD-TEST-ABSORB-01') AS varchar(10)) AS v;
