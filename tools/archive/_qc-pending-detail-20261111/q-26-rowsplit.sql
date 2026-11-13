SET NOCOUNT ON;
PRINT N'=== 四个行号分布(测试库视图) ===';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(来料检验单行号,N'')<>N'' THEN 1 ELSE 0 END) AS 有检验单行号,
       SUM(CASE WHEN ISNULL(送料暂收单行号,N'')<>N'' THEN 1 ELSE 0 END) AS 有暂收行号,
       SUM(CASE WHEN ISNULL(采购订单行号,N'')<>N'' THEN 1 ELSE 0 END) AS 有订单行号,
       SUM(CASE WHEN ISNULL(采购入库单行号,N'')<>N'' THEN 1 ELSE 0 END) AS 有入库行号,
       SUM(CASE WHEN ISNULL(来料检验单行号,N'')<>N'' AND ISNULL(送料暂收单行号,N'')<>N'' AND 来料检验单行号<>送料暂收单行号 THEN 1 ELSE 0 END) AS 检验与暂收行号不同
  FROM v_qc_insp_rec_detail;

PRINT N'=== 行号不一致的样本(各带各自的单号) ===';
SELECT TOP 10 检验数据记录单号, 来料检验单号, 来料检验单行号, 送料暂收单号, 送料暂收单行号,
       采购订单号, 采购订单行号, 采购入库单号, 采购入库单行号, 检验状态
  FROM v_qc_insp_rec_detail
 WHERE ISNULL(来料检验单行号,N'')<>N'' AND ISNULL(送料暂收单行号,N'')<>N'' AND 来料检验单行号<>送料暂收单行号
 ORDER BY id;

PRINT N'=== 没有检验单行号的行(免检/孤儿):看暂收/订单行号是否照常有值 ===';
SELECT TOP 10 检验数据记录单号, ISNULL(来料检验单号,N'(空)') AS 检验单号, ISNULL(来料检验单行号,N'(空)') AS 检验行号,
       ISNULL(送料暂收单号,N'(空)') AS 暂收单号, ISNULL(送料暂收单行号,N'(空)') AS 暂收行号,
       ISNULL(采购订单号,N'(空)') AS 订单号, ISNULL(采购订单行号,N'(空)') AS 订单行号
  FROM v_qc_insp_rec_detail WHERE ISNULL(来料检验单行号,N'')=N'' ORDER BY id;
