SET NOCOUNT ON;
/* 经典 HSDZ 元数据(s_sys)里,还绑着 inh/outh 的界面元素吗?—— 用来判断「服务器上经典客户端」是否受影响。
   s_sys 是字段级元数据(MC/LB_VALUE/control=表.列),MES 运行期不读它(走 yj_panel/yj_field)。 */
IF OBJECT_ID(N'dbo.s_sys') IS NOT NULL
BEGIN
  SELECT DB_NAME() AS 库, N'__总行数' AS 项目, COUNT(*) AS 值 FROM dbo.s_sys;
  SELECT TOP 40 DB_NAME() AS 库, ID, MC, LB_VALUE, control
  FROM dbo.s_sys
  WHERE control LIKE N'%.inh' OR control LIKE N'%inh.%' OR control LIKE N'%outh.%'
     OR LB_VALUE LIKE N'%工单项次%' OR LB_VALUE LIKE N'%工单ID%'
  ORDER BY ID;
END
ELSE SELECT DB_NAME() AS 库, N's_sys 不存在' AS 项目, 0 AS 值;
