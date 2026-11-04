SET NOCOUNT ON;
SELECT 单据编号, 产品编码, 产品名称, 规格型号, 工序, 版本号, 默认BOM, 工艺路线名称, 来源, 状态, 行序,
       子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 用量分子, 用量分母, 损耗量, 行备注, 备注,
       asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel
  FROM dbo.bs_asm_bom
 WHERE 来源 = N'金蝶BOM引出列表_20261019174847'
 ORDER BY 单据编号, 行序;
GO
