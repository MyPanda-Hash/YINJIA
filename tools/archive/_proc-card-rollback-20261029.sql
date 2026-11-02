/* ============================================================
   _proc-card-rollback-20261029.sql — 工序流程追踪卡 回滚(**链外手工执行,勿登记 db-migrations.txt**)

   回滚对象(见 tools/migrate-wo-proc-card-20261029.sql):
     ① yj_role_panel 的 PROC_FLOW_CARD 授权行;
     ② yj_translation 的面板名 + 动作词译名;
     ③ wo_proc_card_detail / wo_proc_card_head 两表(含索引/注明,随表删除);
     ④ yj_attachment 中 panel_code='PROC_FLOW_CARD' 的照片登记行(磁盘文件不自动删)。

   执行:cd tools && java -cp lib/mssql-jdbc.jar SqlRunner.java \
          "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia "Yinjia@2026" \
          archive/_proc-card-rollback-20261029.sql
   注意:删表前先备份库;本脚本不可逆。前端菜单/路由/后端新类需同步注释或删除才能彻底下线。
   ============================================================ */
SET NOCOUNT ON;

/* 删除照片登记行(磁盘文件在 uploads/attachments 下,留档不删) */
IF OBJECT_ID(N'dbo.yj_attachment', N'U') IS NOT NULL
    DELETE FROM dbo.yj_attachment WHERE panel_code = N'PROC_FLOW_CARD';
GO

/* 删除卡表(先子后父) */
IF OBJECT_ID(N'dbo.wo_proc_card_detail', N'U') IS NOT NULL DROP TABLE dbo.wo_proc_card_detail;
GO
IF OBJECT_ID(N'dbo.wo_proc_card_head', N'U') IS NOT NULL DROP TABLE dbo.wo_proc_card_head;
GO

/* 删除角色授权 */
IF OBJECT_ID(N'dbo.yj_role_panel', N'U') IS NOT NULL
    DELETE FROM dbo.yj_role_panel WHERE panel_code = N'PROC_FLOW_CARD';
GO

/* 删除译名(只删本功能独有的键;共享动作词/字段标签不动) */
IF OBJECT_ID(N'dbo.yj_translation', N'U') IS NOT NULL
    DELETE FROM dbo.yj_translation
     WHERE (scope = N'panel' AND ref_key = N'工序流程追踪卡')
        OR (scope = N'field' AND ref_key IN (N'录入照片', N'确认完成', N'小批次号', N'大批次号', N'卡号'));
GO

PRINT N'PROC_FLOW_CARD 已回滚(2 表 + 授权 + 译名 + 照片登记行已删;磁盘照片与代码需另行处理)';
GO
