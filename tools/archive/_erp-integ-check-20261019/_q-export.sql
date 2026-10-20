SET NOCOUNT ON;
SELECT 接口编码, 接口名称, 分类, 对应面板, 请求方式, 接口地址, 启用
  FROM erp_integ_api WHERE 方向 = N'转出'
 ORDER BY 分类, 排序, 接口编码;
