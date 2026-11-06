-- migrate-approval-customer-ref-fix-20261106.sql
-- 修正：立项申请表「客户名」的 data_type 必须是「参照」才会走参照控件 —— 2026-11-06
--
-- 【上一版漏了什么（本脚本修的就是它）】
--   migrate-approval-customer-ref-20261106.sql 只改了 ref_panel / ref_field / display_field，
--   **没改 data_type**。而 PanelRegistry.FieldDef.isRef() 的判据是 "参照".equals(dataType)：
--       public boolean isRef() { return "参照".equals(dataType); }
--   data_type 仍是「文本」⇒ isRef() 恒 false ⇒ 后端**根本不下发 refPanel**
--   ⇒ 前端 isRefKey() 拿不到参照源 ⇒ 界面仍是普通输入框、也弹不出客户候选。
--   （用户报障：「立项申请的客户下拉没做，那编号自动生成肯定也没做」—— 同一根因连带。）
--
-- 【数据安全】只 UPDATE 这一行字段元数据（配置，不是业务数据），无 DELETE，带行数守卫与自检。
-- 两账套都要跑，已登记 tools/db-migrations.txt。幂等（WHERE data_type <> '参照'）。
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

UPDATE yj_field
   SET data_type = N'参照'
 WHERE panel_code = 'RD_APPROVAL'
   AND label = N'客户名'
   AND data_type <> N'参照';
IF @@ROWCOUNT > 3 RAISERROR(N'fix: 客户名 data_type UPDATE 命中行数异常，疑 WHERE 被截断', 16, 1);

/* 自检：三件套必须齐全（参照类型 + 参照面板 + 参照字段） */
IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = 'RD_APPROVAL' AND label = N'客户名'
                  AND data_type = N'参照' AND ref_panel = 'KHDA' AND ref_field = 'mc')
    RAISERROR(N'fix: 自检失败 —— 客户名 不是「参照」类型或参照源不完整', 16, 1);
GO

COMMIT TRAN;
GO
