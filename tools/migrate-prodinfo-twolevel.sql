/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-prodinfo-twolevel.sql — 产品信息表两级审批 + 分发责任人(2026-09-20)

   用户口径(本轮 grill 六问全定):
     ① 两级审批:一级 = admin(冯总,按现有审批权口径);一级通过时**选取**二级审核人
        (候选=全部启用账号),写入纸面「审核人(二级审批人)」,单据转「待二级审批」;
     ② 二级通过 → **直接归档**(不新增中间态);
     ③ 归档后二级审核人做「分发责任人」:四个下游文件**各自**指定责任人(可不同人),
        落 rd_dev_task.负责人(每产品×每面板一行,表早就有这一列),分发后可随时改;
     ④ 四文件服务端硬门禁:未分发禁编,分发后只放该文件责任人 ∪ 管理员,四文件并行无串行依赖;
     ⑤ 二级驳回 → 回到草稿并通知制单人;
     ⑥ 新增账号 cp(陈秀丽),普通用户角色,初始密码与现有演示账号一致(123456),
        二级审批权靠"被一级选中即授权",不依赖角色 can_approve。

   本脚本负责**数据层**:
     §1 新增 cp 账号(幂等;密码哈希直接取 admin 的,等价于同一个初始口令)
     §2 yj_doc_status 补两列:approve_node(当前待审批节点 1=一级/2=二级)、l2_approver(二级审核人账号)
     §3 两列的 MS_Description 中文注明
   审批状态机与门禁在 ButtonService / QueryService / 前端 PanelxList。

   幂等:账号按 username NOT EXISTS;列走 IF COL_LENGTH IS NULL;注释按 extended_properties 判重。
   用法:java -cp lib\mssql-jdbc.jar SqlRunner.java <jdbcUrl> yinjia env tools\migrate-prodinfo-twolevel.sql
   ═══════════════════════════════════════════════════════════════════════════════ */
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. cp 账号(陈秀丽):普通用户角色;密码哈希沿用现有演示账号 ⇒ 初始口令 123456
-- ═══════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM yj_user WHERE username = N'cp')
BEGIN
    INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled)
    SELECT N'cp',
           (SELECT TOP 1 password_hash FROM yj_user WHERE username = N'admin'),
           N'陈秀丽',
           'N',
           (SELECT TOP 1 id FROM yj_dept WHERE dept_name LIKE N'%产品%'),
           (SELECT TOP 1 id FROM yj_role WHERE role_code = N'user'),
           '1';
    PRINT N'已新增账号 cp(陈秀丽)';
END
ELSE PRINT N'账号 cp 已存在,跳过';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. yj_doc_status 补两级审批所需两列(全局表,默认 NULL ⇒ 其余面板行为逐字不变)
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('yj_doc_status', N'approve_node')  IS NULL ALTER TABLE yj_doc_status ADD [approve_node] tinyint NULL;
IF COL_LENGTH('yj_doc_status', N'l2_approver')   IS NULL ALTER TABLE yj_doc_status ADD [l2_approver] nvarchar(50) NULL;
END TRY BEGIN CATCH PRINT N'yj_doc_status 加列跳过'; END CATCH;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. 列注释(MS_Description;已有不覆盖)
-- ═══════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('yj_doc_status') AND name = 'MS_Description'
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('yj_doc_status'), N'approve_node', 'ColumnId'))
    EXEC sp_addextendedproperty N'MS_Description', N'两级审批:当前待审批节点(1=待一级审批/2=待二级审批;NULL=未在审批或单节点面板)',
        N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_status', N'COLUMN', N'approve_node';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('yj_doc_status') AND name = 'MS_Description'
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('yj_doc_status'), N'l2_approver', 'ColumnId'))
    EXEC sp_addextendedproperty N'MS_Description', N'两级审批:一级通过时选定的二级审核人账号(被选中即获二级审批权;NULL=未选)',
        N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_status', N'COLUMN', N'l2_approver';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 4. 校验输出
-- ═══════════════════════════════════════════════════════════════════
SELECT N'yj_user.cp' AS 检查项,
       CASE WHEN EXISTS (SELECT 1 FROM yj_user WHERE username = N'cp' AND ISNULL(enabled,'1') = '1')
            THEN N'OK(' + ISNULL((SELECT TOP 1 real_name FROM yj_user WHERE username = N'cp'), N'') + N')' ELSE N'MISSING' END AS 结果
UNION ALL SELECT N'yj_doc_status.approve_node', CASE WHEN COL_LENGTH('yj_doc_status', N'approve_node') IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'yj_doc_status.l2_approver',  CASE WHEN COL_LENGTH('yj_doc_status', N'l2_approver')  IS NULL THEN N'MISSING' ELSE N'OK' END;
GO
PRINT N'migrate-prodinfo-twolevel.sql 完成:cp 账号 + 两级审批状态列';
GO
