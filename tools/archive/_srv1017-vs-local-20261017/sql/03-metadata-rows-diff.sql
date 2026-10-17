SET NOCOUNT ON;
PRINT '===== yj_panel 服务器独有 =====';
SELECT * FROM (SELECT * FROM HSDZ_MES_SRV1017.dbo.yj_panel EXCEPT SELECT * FROM HSDZ_MES.dbo.yj_panel) x;
PRINT '===== yj_panel 本地独有 =====';
SELECT * FROM (SELECT * FROM HSDZ_MES.dbo.yj_panel EXCEPT SELECT * FROM HSDZ_MES_SRV1017.dbo.yj_panel) x;

PRINT '===== yj_schema_log 服务器独有(本地缺) =====';
SELECT * FROM (SELECT * FROM HSDZ_MES_SRV1017.dbo.yj_schema_log EXCEPT SELECT * FROM HSDZ_MES.dbo.yj_schema_log) x;
PRINT '===== yj_schema_log 本地独有(服务器缺) =====';
SELECT * FROM (SELECT * FROM HSDZ_MES.dbo.yj_schema_log EXCEPT SELECT * FROM HSDZ_MES_SRV1017.dbo.yj_schema_log) x;

PRINT '===== yj_role_panel 服务器独有 =====';
SELECT * FROM (SELECT * FROM HSDZ_MES_SRV1017.dbo.yj_role_panel EXCEPT SELECT * FROM HSDZ_MES.dbo.yj_role_panel) x ORDER BY role_id, panel_code;
PRINT '===== yj_role_panel 本地独有 =====';
SELECT * FROM (SELECT * FROM HSDZ_MES.dbo.yj_role_panel EXCEPT SELECT * FROM HSDZ_MES_SRV1017.dbo.yj_role_panel) x ORDER BY role_id, panel_code;

PRINT '===== yj_user 服务器独有 =====';
SELECT id, username, real_name, is_admin, role_id, enabled, dept_id FROM (SELECT * FROM HSDZ_MES_SRV1017.dbo.yj_user EXCEPT SELECT * FROM HSDZ_MES.dbo.yj_user) x;
PRINT '===== yj_user 本地独有 =====';
SELECT id, username, real_name, is_admin, role_id, enabled, dept_id FROM (SELECT * FROM HSDZ_MES.dbo.yj_user EXCEPT SELECT * FROM HSDZ_MES_SRV1017.dbo.yj_user) x;

PRINT '===== dm_langue 服务器独有 =====';
SELECT id, frm, chs, eng FROM (SELECT * FROM HSDZ_MES_SRV1017.dbo.dm_langue EXCEPT SELECT * FROM HSDZ_MES.dbo.dm_langue) x;
PRINT '===== dm_langue 本地独有 =====';
SELECT id, frm, chs, eng FROM (SELECT * FROM HSDZ_MES.dbo.dm_langue EXCEPT SELECT * FROM HSDZ_MES_SRV1017.dbo.dm_langue) x;

PRINT '===== permission 服务器独有 =====';
SELECT ID, USERID, MODULE1, MODULE_NA, RW, GROP FROM (SELECT * FROM HSDZ_MES_SRV1017.dbo.permission EXCEPT SELECT * FROM HSDZ_MES.dbo.permission) x;
PRINT '===== permission 本地独有 =====';
SELECT ID, USERID, MODULE1, MODULE_NA, RW, GROP FROM (SELECT * FROM HSDZ_MES.dbo.permission EXCEPT SELECT * FROM HSDZ_MES_SRV1017.dbo.permission) x;

PRINT '===== form_flow_link 服务器独有 =====';
SELECT id, source_panel_code, source_form_no, target_panel_code, target_form_no, inventory_code, source_quantity, linked_quantity, link_status, create_time
FROM (SELECT * FROM HSDZ_MES_SRV1017.dbo.form_flow_link EXCEPT SELECT * FROM HSDZ_MES.dbo.form_flow_link) x;

PRINT '===== plang_pc (ntext comm 转 nvarchar 后比) 服务器独有 =====';
SELECT * FROM (SELECT id, pl_no, mc, gg, pl_sl, CAST(comm AS nvarchar(max)) comm FROM HSDZ_MES_SRV1017.dbo.plang_pc
              EXCEPT SELECT id, pl_no, mc, gg, pl_sl, CAST(comm AS nvarchar(max)) FROM HSDZ_MES.dbo.plang_pc) x;
PRINT '===== plang_pc 本地独有 =====';
SELECT * FROM (SELECT id, pl_no, mc, gg, pl_sl, CAST(comm AS nvarchar(max)) comm FROM HSDZ_MES.dbo.plang_pc
              EXCEPT SELECT id, pl_no, mc, gg, pl_sl, CAST(comm AS nvarchar(max)) FROM HSDZ_MES_SRV1017.dbo.plang_pc) x;
