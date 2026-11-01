SET NOCOUNT ON;
SELECT 'DUMP' AS tag,
  ISNULL(产品编码,'') + CHAR(9) + ISNULL(单据编号,'') + CHAR(9) + ISNULL(版本号,'') + CHAR(9) + ISNULL(默认BOM,'') + CHAR(9) +
  CAST(行序 AS varchar(10)) + CHAR(9) + ISNULL(子件编码,'') + CHAR(9) + ISNULL(子件名称,'') + CHAR(9) + ISNULL(子件规格,'') + CHAR(9) +
  ISNULL(计量单位,'') + CHAR(9) + CAST(标准用量 AS varchar(30)) + CHAR(9) + CAST(用量分子 AS varchar(30)) + CHAR(9) + CAST(用量分母 AS varchar(30)) + CHAR(9) +
  CAST(损耗量 AS varchar(30)) + CHAR(9) + REPLACE(REPLACE(ISNULL(行备注,''), CHAR(9), ' '), CHAR(10), ' ') AS line
FROM bs_asm_bom ORDER BY 产品编码, 行序 OFFSET 0 ROWS FETCH NEXT 400 ROWS ONLY;
GO
SELECT 'DUMP' AS tag,
  ISNULL(产品编码,'') + CHAR(9) + ISNULL(单据编号,'') + CHAR(9) + ISNULL(版本号,'') + CHAR(9) + ISNULL(默认BOM,'') + CHAR(9) +
  CAST(行序 AS varchar(10)) + CHAR(9) + ISNULL(子件编码,'') + CHAR(9) + ISNULL(子件名称,'') + CHAR(9) + ISNULL(子件规格,'') + CHAR(9) +
  ISNULL(计量单位,'') + CHAR(9) + CAST(标准用量 AS varchar(30)) + CHAR(9) + CAST(用量分子 AS varchar(30)) + CHAR(9) + CAST(用量分母 AS varchar(30)) + CHAR(9) +
  CAST(损耗量 AS varchar(30)) + CHAR(9) + REPLACE(REPLACE(ISNULL(行备注,''), CHAR(9), ' '), CHAR(10), ' ') AS line
FROM bs_asm_bom ORDER BY 产品编码, 行序 OFFSET 400 ROWS FETCH NEXT 400 ROWS ONLY;
GO
SELECT 'DUMP' AS tag,
  ISNULL(产品编码,'') + CHAR(9) + ISNULL(单据编号,'') + CHAR(9) + ISNULL(版本号,'') + CHAR(9) + ISNULL(默认BOM,'') + CHAR(9) +
  CAST(行序 AS varchar(10)) + CHAR(9) + ISNULL(子件编码,'') + CHAR(9) + ISNULL(子件名称,'') + CHAR(9) + ISNULL(子件规格,'') + CHAR(9) +
  ISNULL(计量单位,'') + CHAR(9) + CAST(标准用量 AS varchar(30)) + CHAR(9) + CAST(用量分子 AS varchar(30)) + CHAR(9) + CAST(用量分母 AS varchar(30)) + CHAR(9) +
  CAST(损耗量 AS varchar(30)) + CHAR(9) + REPLACE(REPLACE(ISNULL(行备注,''), CHAR(9), ' '), CHAR(10), ' ') AS line
FROM bs_asm_bom ORDER BY 产品编码, 行序 OFFSET 800 ROWS FETCH NEXT 400 ROWS ONLY;
GO
SELECT 'DUMP-COUNT' AS tag, CAST(COUNT(*) AS varchar(10)) AS cnt FROM bs_asm_bom;
GO
