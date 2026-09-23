SET NOCOUNT ON;
PRINT N'===== 1. bs_op 工序库:工序类型/检验要求 填充率 =====';
SELECT COUNT(*) AS 总行数,
       SUM(CASE WHEN 工序类型 IS NOT NULL AND LTRIM(RTRIM(工序类型))<>N'' THEN 1 ELSE 0 END) AS 有工序类型,
       SUM(CASE WHEN 检验要求 IS NOT NULL AND LTRIM(RTRIM(检验要求))<>N'' THEN 1 ELSE 0 END) AS 有检验要求
FROM bs_op;
GO
SET NOCOUNT ON;
PRINT N'-- bs_op 业务工序(非 migration 种子) --';
SELECT id, 工序编码, 工序名称, 默认车间, 工序类型, 状态, asp_user1 FROM bs_op WHERE asp_user1 IS NULL OR asp_user1 <> N'migration';
GO

SET NOCOUNT ON;
PRINT N'===== 2. 工序相关字典原文(OP_TYPE / GXLX / WLFZ / WH_TYPE) =====';
SELECT 字典类别, 代码, 名称 FROM bs_dict WHERE 字典类别 IN ('OP_TYPE','GXLX','WLFZ','WH_TYPE') ORDER BY 字典类别, 代码;
GO

SET NOCOUNT ON;
PRINT N'===== 3. 恰好 4 个取值的字典(找"4类"候选) =====';
SELECT 字典类别, COUNT(*) n, STRING_AGG(名称, N'|') AS 取值 FROM bs_dict GROUP BY 字典类别 HAVING COUNT(*) = 4 ORDER BY 字典类别;
GO

SET NOCOUNT ON;
PRINT N'===== 4. RD_ASM_PROC 明细实际数据(工序/表区) =====';
SELECT COUNT(*) AS 行数 FROM rd_asm_proc_detail;
GO
SET NOCOUNT ON;
SELECT TOP 30 单据编号, 表区, 序号, 工序, 工序控制内容 FROM rd_asm_proc_detail ORDER BY id;
GO

SET NOCOUNT ON;
PRINT N'===== 5. rd_prod_info_head 是否真有数据(下发的先决条件) =====';
SELECT COUNT(*) AS 产品信息表行数 FROM rd_prod_info_head;
GO
SET NOCOUNT ON;
SELECT TOP 20 单据编号, 产品编号, 产品名称, 产品类型, 责任人, 审核人 FROM rd_prod_info_head ORDER BY id DESC;
GO
