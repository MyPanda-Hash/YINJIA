SET NOCOUNT ON;
/* s_sys 文本列里到底有没有跟 inh/outh 或 工单项次 相关的行(逐列 OR 展开,不用动态 SQL) */
SELECT DB_NAME() AS 库, ID, MC, CHS, control, LB_VALUE
FROM dbo.s_sys
WHERE ISNULL(control, N'') LIKE N'%pl_xc%' OR ISNULL(control, N'') LIKE N'%inh%' OR ISNULL(control, N'') LIKE N'%outh%'
   OR ISNULL(CHS, N'') LIKE N'%工单项次%' OR ISNULL(LB_VALUE, N'') LIKE N'%工单项次%'
   OR ISNULL(CHT, N'') LIKE N'%工单项次%' OR ISNULL(REMARK, N'') LIKE N'%工单项次%';
