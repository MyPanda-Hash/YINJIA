-- _q-e2e-inputs.sql — E2E 造数前置:候选物料(来料检验 是/否)、供应商、仓库、各面板必填字段
SET NOCOUNT ON;
PRINT N'==== 库: ' + DB_NAME() + N' ====';

PRINT N'-- 1. 商品档案「来料检验」取值分布';
SELECT ISNULL(NULLIF(LTRIM(RTRIM(来料检验)), N''), N'(空)') AS 来料检验, COUNT(*) AS 条数
  FROM bs_inv GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(来料检验)), N''), N'(空)');

PRINT N'-- 2. 候选物料:来料检验=是(走检验链)';
SELECT TOP 5 LTRIM(RTRIM(存货编码)) AS 存货编码, LTRIM(RTRIM(存货名称)) AS 存货名称,
       LTRIM(RTRIM(ISNULL(规格型号, N''))) AS 规格型号, LTRIM(RTRIM(ISNULL(来料检验, N''))) AS 来料检验
  FROM bs_inv WHERE LTRIM(RTRIM(ISNULL(来料检验, N''))) = N'是' ORDER BY 存货编码;

PRINT N'-- 3. 候选物料:非「是」(免检直达)';
SELECT TOP 5 LTRIM(RTRIM(存货编码)) AS 存货编码, LTRIM(RTRIM(存货名称)) AS 存货名称,
       LTRIM(RTRIM(ISNULL(规格型号, N''))) AS 规格型号, LTRIM(RTRIM(ISNULL(来料检验, N''))) AS 来料检验
  FROM bs_inv WHERE LTRIM(RTRIM(ISNULL(来料检验, N''))) <> N'是' ORDER BY 存货编码;

PRINT N'-- 4. 供应商档案前 5(dm_gf)';
SELECT TOP 5 LTRIM(RTRIM(dm)) AS 代码, LTRIM(RTRIM(mc)) AS 名称 FROM dm_gf ORDER BY dm;

PRINT N'-- 5. 仓库前 5(bs_wh)';
SELECT TOP 5 LTRIM(RTRIM(仓库编码)) AS 仓库编码, LTRIM(RTRIM(仓库名称)) AS 仓库名称 FROM bs_wh ORDER BY 仓库编码;

PRINT N'-- 6. 各面板表头必填字段';
SELECT panel_code, col_name, label, data_type, required, place, seq
  FROM yj_field
 WHERE panel_code IN (N'PU_ORDER', N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'QC_TC_IN', N'PURCHASE_IN')
   AND required = 1 AND place LIKE N'%header%'
 ORDER BY panel_code, seq;

PRINT N'-- 7. 各面板明细必填字段';
SELECT panel_code, col_name, label, data_type, required, seq
  FROM yj_field
 WHERE panel_code IN (N'PU_ORDER', N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'QC_TC_IN', N'PURCHASE_IN')
   AND required = 1 AND place LIKE N'%detail%'
 ORDER BY panel_code, seq;

PRINT N'-- 8. QC_TC_IN 字段全量(特采单表头)';
SELECT col_name, label, data_type, place, seq, editable, required, hidden, visible
  FROM yj_field WHERE panel_code = N'QC_TC_IN' ORDER BY place, seq, id;
