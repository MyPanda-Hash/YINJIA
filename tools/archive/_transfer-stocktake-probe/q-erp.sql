SET NOCOUNT ON;
IF OBJECT_ID('dbo.erp_integ_api') IS NOT NULL
  SELECT 方向, 分类, 接口编码, 接口名称, 接口地址, 对应面板 FROM erp_integ_api ORDER BY 方向, 分类, 接口编码;
ELSE PRINT 'erp_integ_api 不存在';
