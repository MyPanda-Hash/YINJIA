SET NOCOUNT ON;
SELECT DB_NAME() AS db,
       (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code=N'WORK_ORDER_LIST' AND ','+ISNULL(perms,'')+',' LIKE '%,picking,%') AS residual_picking,
       (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code=N'WORK_ORDER_LIST') AS wol_rows,
       (SELECT COUNT(*) FROM yj_schema_log WHERE script_name=N'migrate-drop-wol-picking-perm-20261105.sql') AS script_logged;
SELECT id, perms FROM yj_role_panel WHERE panel_code=N'WORK_ORDER_LIST' ORDER BY id;
SELECT cmt.value AS perms_comment FROM sys.extended_properties cmt
 WHERE cmt.major_id=OBJECT_ID('yj_role_panel') AND cmt.minor_id=COLUMNPROPERTY(OBJECT_ID('yj_role_panel'),'perms','ColumnId') AND cmt.name='MS_Description';
