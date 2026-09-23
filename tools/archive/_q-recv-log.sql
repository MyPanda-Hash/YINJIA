SET NOCOUNT ON;
SELECT script_name, LEFT(content_hash,8) AS hash8, applied_at
  FROM yj_schema_log
 WHERE script_name IN (N'migrate-sl-recv.sql', N'migrate-insp-rename.sql', N'migrate-qc-recv-drop.sql',
                        N'migrate-qc-3docs-rebuild.sql', N'migrate-qc-3docs.sql', N'migrate-qc-recv-fields.sql',
                        N'migrate-qc-recv-pool-clean.sql')
 ORDER BY applied_at;
GO
