SET NOCOUNT ON;
PRINT N'=== 1. bs_dict 字典类别清单 ===';
SELECT 字典类别, COUNT(*) AS cnt FROM bs_dict GROUP BY 字典类别 ORDER BY 字典类别;
GO
PRINT N'=== 2. OP_TYPE 工序类型取值 ===';
SELECT * FROM bs_dict WHERE 字典类别='OP_TYPE' ORDER BY 代码;
GO
PRINT N'=== 3. bs_op 全部行(工序基础库) ===';
SELECT 工序编码, 工序名称, 工序类型, 默认车间, 关键工序, 是否停用 FROM bs_op ORDER BY 工序编码;
GO
PRINT N'=== 4. bs_route 全部行(工艺路线基础库) ===';
SELECT TOP 30 工艺路线编码, 工艺路线名称, 加工顺序, 工序编码, 工序名称, 停用 FROM bs_route ORDER BY 工艺路线编码, 加工顺序;
GO
PRINT N'=== 5. bs_qc_item / bs_qc_plan 行数(检验基础库是否空) ===';
SELECT (SELECT COUNT(*) FROM bs_qc_item) AS qc_item_rows, (SELECT COUNT(*) FROM bs_qc_plan) AS qc_plan_rows;
GO
PRINT N'=== 6. bs_bom 行样本(材料库) ===';
SELECT TOP 10 物料清单编码, 父件编码, 子件编码, 子件名称 FROM bs_bom;
GO
