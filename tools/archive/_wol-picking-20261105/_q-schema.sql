SET NOCOUNT ON;
SELECT DB_NAME() AS db, c.name, t.name AS typ, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id = OBJECT_ID('yj_role_panel');
SELECT DB_NAME() AS db, cmt.value AS perms_comment
  FROM sys.extended_properties cmt
 WHERE cmt.major_id=OBJECT_ID('yj_role_panel') AND cmt.minor_id=COLUMNPROPERTY(OBJECT_ID('yj_role_panel'),'perms','ColumnId') AND cmt.name='MS_Description';
