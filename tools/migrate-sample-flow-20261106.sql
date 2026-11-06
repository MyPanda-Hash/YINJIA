/* ============================================================================
   migrate-sample-flow-20261106.sql
   研发管理 · 样品（外部/内部开发样品申请单）—— **流程可跑通** 的元数据补丁

   【需求来源·用户原话】
     「样品申请单这些使用《新系统-样品流程和相关表格式.xlsx》里面的模版要像素级复刻，
       里面的对应流程已经给出了，把这个流程也跑通」

   设计文件 sheet1 结尾的流程口径（原文）：
     · 外部单：申请人录完之后提交 → 审核人（刘磊）→ 确认人（冯总）确认信息并进行补充
              → 执行制备 → 入样品仓库；收费样品需涉及财务流程
     · 内部单：点《内部-开发样品》→ 自己的列表 → 新增填写 → 保存提交确认 → 确认后进入制备
     · 权限：不同用户只能看到自己的申请单；单据管理人/审核人可以看到全部
     · 打印：提供打印服务

   【本脚本做什么】
     1) 内部单补「申请人」列（模板 A2 表头第一格就有它，而建表时漏了 ⇒ 纸面那格恒空）。
     2) 两张单补**角色授权**（yj_role_panel）：此前两面板 0 行授权 ⇒ 非管理员连页面都打不开，
        流程根本走不到第二步。按模板的角色分工授权：
          普通用户(user)      = 申请人：view,query,add,modify
          研发审核(rd_review) = 审核人(刘磊)：view,query,add,modify,audit + can_approve
          文件负责人(rd_file_owner) = 单据管理人：view,query,add,modify,audit + can_approve
          管理员(admin)       = 全量（含 del/export/print）
     3) 申请人/审核/确认 三格（内部单另有 确认人）保持 editable=0 —— 由审批动作回写（见
        ButtonService.writeSampleSign），不允许手填，否则纸面留痕会与审批记录打架。

   【为什么内部单是单级、外部单是两级】
     模板：内部单只写「确认人（权限在刘磊账号）」= 提交 → 刘磊确认 → 制备；
           外部单写「审核人(刘磊) → 确认人(冯总)」= 提交 → 一级审核 → 二级确认。
     ⇒ ButtonService.twoLevelPanels() 只加 RD_SAMPLE_EXT；RD_SAMPLE_INT 走单节点路径，
        通过时回写「确认人」。

   ⚠ 幂等：ALTER 用 COL_LENGTH 守卫、字段用 NOT EXISTS、授权用 NOT EXISTS。
   ⚠ 两账套纪律：正式库 HSDZ_MES 与测试库 HSDZ_MES_TEST 各跑一遍（本机只有前者）。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;

/* ══════════════════════════════════════════════════════════════════════
   1) 内部单补「申请人」列（模板 A2 = 申请人，B3「根据登录用户填充」）
   ══════════════════════════════════════════════════════════════════════ */
IF COL_LENGTH('rd_sample_int_head', N'申请人') IS NULL
    ALTER TABLE rd_sample_int_head ADD [申请人] nvarchar(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('rd_sample_int_head') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'内部开发样品申请单-头（研发管理·样品）。项目名/炭棒尺寸/配方工艺要求/样品状态；申请人=登录用户自动带出，确认人=审批通过回写。',
        'SCHEMA','dbo','TABLE','rd_sample_int_head';

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('rd_sample_int_head') AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_sample_int_head'), N'申请人', 'ColumnId') AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'申请人：新增时按登录用户自动带出（只读，不随语言变化）',
        'SCHEMA','dbo','TABLE','rd_sample_int_head','COLUMN',N'申请人';
GO

/* 字段登记：place=header（表头区第 2 列，排在单据日期之后）、只读 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SAMPLE_INT' AND label = N'申请人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, editable, required, hidden, visible)
    VALUES ('RD_SAMPLE_INT', N'申请人', N'申请人', N'文本', 'header', 25, 0, 0, 0, 1);
GO

/* ══════════════════════════════════════════════════════════════════════
   2) 译名（多语言强制规范：新增字段至少 en）
   ══════════════════════════════════════════════════════════════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'申请人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'申请人', 'en', N'Applicant', 'manual');
GO

/* ══════════════════════════════════════════════════════════════════════
   3) 角色授权（两张单此前 0 行）
   ══════════════════════════════════════════════════════════════════════ */
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, p.panel_code, g.perms, g.can_approve
FROM yj_role r
CROSS JOIN (VALUES ('RD_SAMPLE_EXT'), ('RD_SAMPLE_INT')) AS p(panel_code)
JOIN (VALUES
        ('admin',         'view,query,add,modify,del,export,print,audit', 'Y'),
        ('user',          'view,query,add,modify',                        'N'),
        ('rd_review',     'view,query,add,modify,audit',                   'Y'),
        ('rd_file_owner', 'view,query,add,modify,audit',                   'Y')
     ) AS g(role_code, perms, can_approve) ON g.role_code = r.role_code
WHERE NOT EXISTS (
        SELECT 1 FROM yj_role_panel rp
         WHERE rp.role_id = r.id AND rp.panel_code = p.panel_code);
GO

/* ══════════════════════════════════════════════════════════════════════
   4) 自检
   ══════════════════════════════════════════════════════════════════════ */
IF COL_LENGTH('rd_sample_int_head', N'申请人') IS NULL
    RAISERROR(N'migrate-sample-flow: 自检失败 —— rd_sample_int_head.申请人 未创建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SAMPLE_INT' AND label = N'申请人')
    RAISERROR(N'migrate-sample-flow: 自检失败 —— RD_SAMPLE_INT 申请人 字段未登记', 16, 1);
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code IN ('RD_SAMPLE_EXT', 'RD_SAMPLE_INT')) < 8
    RAISERROR(N'migrate-sample-flow: 自检失败 —— 两张样品单的角色授权不足 8 行', 16, 1);
GO

COMMIT TRAN;
GO
