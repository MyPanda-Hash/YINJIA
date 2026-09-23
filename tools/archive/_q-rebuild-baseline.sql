/* migrate-qc-3docs-rebuild.sql 本库跳过登记:
   该脚本(09-14 生产三单重建)在本库的后续演化路径不同 —— 本地由 migrate-qc-3docs(09-15)
   + 09-20~09-23 采购链/质检链十余份脚本演化出更完整的字段集;重跑会 清空三面板 yj_field 重注册
   并重建已下线的 qc_recv(野表面板)。效果已存在且更全 → 按当前文件哈希登记跳过。
   脚本本身已补动态 SQL 守卫(2026-09-23),全新库按链重建时可直接执行。 */
SET NOCOUNT ON;
DECLARE @h char(64) = '__HASH__';
IF NOT EXISTS (SELECT 1 FROM yj_schema_log WHERE script_name = N'migrate-qc-3docs-rebuild.sql')
  INSERT INTO yj_schema_log (script_name, content_hash) VALUES (N'migrate-qc-3docs-rebuild.sql', @h);
SELECT script_name, LEFT(content_hash,12) AS hash12, applied_at FROM yj_schema_log
 WHERE script_name = N'migrate-qc-3docs-rebuild.sql';
GO
