SELECT 单据编号, 产品编码, 产品名称, 规格型号, 工序, 版本号, ISNULL(默认BOM,N'') AS 默认BOM,
       ISNULL(工艺路线名称,N'') AS 工艺路线名称, ISNULL(来源,N'') AS 来源, ISNULL(状态,N'') AS 状态,
       行序, 子件编码, ISNULL(子件名称,N'') AS 子件名称, ISNULL(子件规格,N'') AS 子件规格,
       ISNULL(计量单位,N'') AS 计量单位, 标准用量, 用量分子, 用量分母, 损耗量,
       ISNULL(行备注,N'') AS 行备注, ISNULL(备注,N'') AS 备注,
       ISNULL(asp_user1,N'') AS asp_user1, ISNULL(asp_cancel,N'') AS asp_cancel
  FROM dbo.bs_asm_bom
 ORDER BY 单据编号, 行序, id
