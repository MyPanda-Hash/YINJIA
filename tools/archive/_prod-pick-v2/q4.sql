SELECT c.name, t.name typ, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('rd_mold_proc_head') ORDER BY c.column_id;
GO
SELECT c.name, t.name typ, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('rd_mold_proc_detail') ORDER BY c.column_id;
GO
SELECT c.name, t.name typ, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('rd_asm_proc_head') ORDER BY c.column_id;
GO
SELECT c.name, t.name typ, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('rd_asm_proc_detail') ORDER BY c.column_id;
