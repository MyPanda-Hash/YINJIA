SET NOCOUNT ON;
PRINT '=== 3) 索引名称:按「表|索引名」双向比(含自动生成的 PK/UQ 索引名) ===';
IF OBJECT_ID('tempdb..#is') IS NOT NULL DROP TABLE #is;
IF OBJECT_ID('tempdb..#il') IS NOT NULL DROP TABLE #il;
CREATE TABLE #is (k nvarchar(600)); CREATE TABLE #il (k nvarchar(600));
INSERT INTO #is SELECT CONCAT(t.name,'|',i.name) FROM HSDZ_MES_SRV1017.sys.indexes i
  JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=i.object_id AND t.is_ms_shipped=0 WHERE i.type_desc<>'HEAP';
INSERT INTO #il SELECT CONCAT(t.name,'|',i.name) FROM HSDZ_MES.sys.indexes i
  JOIN HSDZ_MES.sys.tables t ON t.object_id=i.object_id AND t.is_ms_shipped=0 WHERE i.type_desc<>'HEAP';
SELECT '索引名 服务器独有' AS 项, COUNT(*) AS 条数 FROM (SELECT k FROM #is EXCEPT SELECT k FROM #il) x
UNION ALL SELECT '索引名 本地独有', COUNT(*) FROM (SELECT k FROM #il EXCEPT SELECT k FROM #is) y;
SELECT '服务器独有' AS 归属, k AS 索引 FROM #is a WHERE NOT EXISTS (SELECT 1 FROM #il b WHERE b.k=a.k)
UNION ALL
SELECT '本地独有', k FROM #il a WHERE NOT EXISTS (SELECT 1 FROM #is b WHERE b.k=a.k);

PRINT '=== 4) 扩展属性 MS_Description 双向比 ===';
SELECT '表级 MS_Description' AS 项,
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.extended_properties WHERE minor_id=0 AND name='MS_Description') AS 服务器,
  (SELECT COUNT(*) FROM HSDZ_MES.sys.extended_properties WHERE minor_id=0 AND name='MS_Description') AS 本地
UNION ALL SELECT '列级 MS_Description',
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.extended_properties WHERE minor_id>0 AND name='MS_Description'),
  (SELECT COUNT(*) FROM HSDZ_MES.sys.extended_properties WHERE minor_id>0 AND name='MS_Description');
IF OBJECT_ID('tempdb..#es') IS NOT NULL DROP TABLE #es;
IF OBJECT_ID('tempdb..#el') IS NOT NULL DROP TABLE #el;
CREATE TABLE #es (k nvarchar(1000)); CREATE TABLE #el (k nvarchar(1000));
INSERT INTO #es SELECT CONCAT(OBJECT_SCHEMA_NAME(ep.major_id),'.',OBJECT_NAME(ep.major_id),'.',ISNULL(COL_NAME(ep.major_id,ep.minor_id),''),'=',CONVERT(nvarchar(400),ep.value))
  FROM HSDZ_MES_SRV1017.sys.extended_properties ep WHERE ep.name='MS_Description';
INSERT INTO #el SELECT CONCAT(OBJECT_SCHEMA_NAME(ep.major_id),'.',OBJECT_NAME(ep.major_id),'.',ISNULL(COL_NAME(ep.major_id,ep.minor_id),''),'=',CONVERT(nvarchar(400),ep.value))
  FROM HSDZ_MES.sys.extended_properties ep WHERE ep.name='MS_Description';
SELECT '扩展属性 服务器独有' AS 项, COUNT(*) AS 条数 FROM (SELECT k FROM #es EXCEPT SELECT k FROM #el) x
UNION ALL SELECT '扩展属性 本地独有', COUNT(*) FROM (SELECT k FROM #el EXCEPT SELECT k FROM #es) y;
SELECT TOP 20 '服务器独有' AS 归属, k AS 属性 FROM #es a WHERE NOT EXISTS (SELECT 1 FROM #el b WHERE b.k=a.k)
UNION ALL
SELECT TOP 20 '本地独有', k FROM #el a WHERE NOT EXISTS (SELECT 1 FROM #es b WHERE b.k=a.k);

PRINT '=== 5) 近期迁移脚本里点名的约束/索引,两库是否都在(逐条点名) ===';
IF OBJECT_ID('tempdb..#chk') IS NOT NULL DROP TABLE #chk;
CREATE TABLE #chk (对象名 sysname, 类型 varchar(10));
INSERT INTO #chk VALUES
 ('ux_bs_op_code','索引'),('df_bs_op_asp_cancel','默认约束'),('UX_inh_src_rid','索引'),('UX_outh_src_rid','索引'),
 ('ix_s_allno_lb_ny','索引'),('ux_bs_inv_ext_id','索引'),('ux_bd_so_order_ext_id','索引'),('ux_bd_pu_order_ext_id','索引'),
 ('ux_bs_settle_type_ext_id','索引'),('ux_bs_customer_group_ext_id','索引'),('ux_dm_kh_ext_id','索引'),('ux_dm_gf_ext_id','索引'),
 ('IX_yj_doc_annotation_doc','索引'),('ix_yja_doc','索引'),('ix_yjfa_doc','索引'),('ux_yj_doc_batch_no_active','索引'),
 ('UX_yj_doc_batch_active','索引'),('ux_yj_change_dept','索引'),('ux_bs_line_open','索引'),('ux_prod_abn_no','索引'),
 ('ux_bs_prod_line','索引'),('ux_bs_line_capacity_line','索引'),('ux_rd_dev_task_prod_panel','索引'),('ux_rd_spec_assign_doc','索引'),
 ('ux_sf_no','索引'),('ux_bs_op_code2','索引'),('PK_dm_langue','主键'),('PK_permission','主键'),('PK_s_sys','主键'),
 ('PK_s_xtcs','主键'),('PK_gscs','主键'),('PK_s_commdata','主键'),('DF_yjd_pending','默认约束'),('DF_yj_doc_batch_st','默认约束');
SELECT c.对象名, c.类型,
  CASE WHEN EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.sys.objects o WHERE o.name=c.对象名)
         OR EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.sys.indexes i WHERE i.name=c.对象名) THEN '有' ELSE '无' END AS 服务器,
  CASE WHEN EXISTS (SELECT 1 FROM HSDZ_MES.sys.objects o WHERE o.name=c.对象名)
         OR EXISTS (SELECT 1 FROM HSDZ_MES.sys.indexes i WHERE i.name=c.对象名) THEN '有' ELSE '无' END AS 本地
FROM #chk c ORDER BY c.对象名;
