SET NOCOUNT ON;

PRINT N'== 1. kucun 辅助单位字段 yl2/rkl2/ckl2 是否有值 ==';
SELECT SUM(CASE WHEN ISNULL(yl2,0)<>0 THEN 1 ELSE 0 END) AS yl2非零行,
       SUM(CASE WHEN ISNULL(rkl2,0)<>0 THEN 1 ELSE 0 END) AS rkl2非零行,
       SUM(CASE WHEN ISNULL(ckl2,0)<>0 THEN 1 ELSE 0 END) AS ckl2非零行,
       CAST(ISNULL(SUM(yl2),0) AS decimal(18,4)) AS yl2合计,
       CAST(ISNULL(MIN(yl2),0) AS decimal(18,4)) AS yl2最小
FROM dbo.kucun;

PRINT N'== 2. kucun.预警数量 分布 ==';
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(预警数量,0)>0 THEN 1 ELSE 0 END) AS 已设预警行,
       SUM(CASE WHEN ISNULL(预警数量,0)<0 THEN 1 ELSE 0 END) AS 负预警行,
       CAST(MAX(预警数量) AS decimal(18,4)) AS 最大预警
FROM dbo.kucun;

PRINT N'== 3. 出/入库流水表 inh/outh 数量为负或 0 ==';
SELECT 'inh' AS 表, COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(数量,0)<0 THEN 1 ELSE 0 END) AS 负数量行,
       SUM(CASE WHEN ABS(ISNULL(数量,0))<=0.0001 THEN 1 ELSE 0 END) AS 零数量行
FROM dbo.inh
UNION ALL
SELECT 'outh', COUNT(*),
       SUM(CASE WHEN ISNULL(数量,0)<0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN ABS(ISNULL(数量,0))<=0.0001 THEN 1 ELSE 0 END)
FROM dbo.outh;

PRINT N'== 4. 单据行「数量」为负/零 统计(出库/入库单) ==';
DECLARE @sql nvarchar(max)=N'';
SELECT @sql = @sql + N'
SELECT ''' + o.name + N''' AS 表, ''' + c.name + N''' AS 列, COUNT(*) AS 行数,
       SUM(CASE WHEN ' + c.name + N' < -0.0001 THEN 1 ELSE 0 END) AS 负行,
       SUM(CASE WHEN ABS(ISNULL(' + c.name + N',0))<=0.0001 THEN 1 ELSE 0 END) AS 零行,
       CAST(MIN(' + c.name + N') AS decimal(18,4)) AS 最小
FROM dbo.' + o.name + N' UNION ALL'
FROM sys.columns c JOIN sys.objects o ON c.object_id=o.object_id
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE o.type='U' AND t.name='decimal' AND o.name IN ('bl_purchase_in','bl_sale_out','bl_material_out','bl_finish_in','bl_transfer','bl_stocktake','bl_purchase_in','bl_other_in','bl_other_out','bl_outsource_in')
  AND c.name IN (N'数量',N'实收数量',N'调拨数量',N'账面数量',N'实盘数量',N'辅数量')
  AND o.name NOT LIKE N'_bak%';
IF LEN(@sql)>0 BEGIN SET @sql=LEFT(@sql,LEN(@sql)-10)+N' ORDER BY 表, 列;'; EXEC(@sql); END

PRINT N'== 5. 采购入库 实收数量 vs 实收数量2 与 换算率 一致性 ==';
IF COL_LENGTH('dbo.bl_purchase_in','实收数量2') IS NOT NULL
SELECT COUNT(*) AS 有辅单位的行,
       SUM(CASE WHEN ISNULL(换算率,0)>0 AND ABS(ISNULL(实收数量,0) - ISNULL(实收数量2,0)*换算率) > 0.01 THEN 1 ELSE 0 END) AS 数量与换算不符行
FROM dbo.bl_purchase_in WHERE ISNULL(实收数量2,0)<>0;
