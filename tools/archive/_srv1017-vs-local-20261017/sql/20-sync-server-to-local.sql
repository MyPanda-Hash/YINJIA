/* ============================================================================
   20-sync-server-to-local.sql —— 把「服务器快照库」相对本地的差异,按「服务器为准」
   落到当前库(默认在 HSDZ_MES 上执行;两个账套都要跑)。

   为什么要它(2026-10-17 用户口径):
     服务器库里有别的开发人员做的修改(约束 / 账号手机绑定 / 手机端权限 / 角色面板 /
     生产实绩 / 检验方案…),本地库没同步这些修改,导致手机端(参考库 PDA 直连数据库
     写字)对不上账 —— 需要把服务器侧修改在本地"实现"出来。

   用法(幂等;⚠ 需 sysadmin 或 db_owner):
     docker exec mssql2019 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P *** \
        -C -d HSDZ_MES      -i /var/opt/mssql/data/20-sync-server-to-local.sql
     docker exec mssql2019 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P *** \
        -C -d HSDZ_MES_TEST -i /var/opt/mssql/data/20-sync-server-to-local.sql

   设计口径:
     · 源库 = [HSDZ_MES_SRV1017](由 deploy/HSDZ_MES-manual-20261017-091742.bak 还原);
       换快照时全局替换这个库名即可。
     · **只增不删**为主:补服务器有、本地没有的行(保持原 id;id 已被占用的极少数行
       退回自增 id 插入);属性漂移按「服务器为准」UPDATE(明确列名,不用 SELECT * 覆盖)。
     · 唯一「以服务器为准删除」的是角色 1025 的面板授权(服务器 29 行 / 本地 55 行)。
     · 有意不动(保留本地):yj_panel.config 的 inspGate(本地未部署的新功能)、
       yj_schema_log、金蝶同步快照字段(bd_/bl_ 的外部指纹与金额快照 —— 本地跑一次
       金蝶同步即可追上)、研发区 rd_*、附件本体(文件不在 .bak 里)、日志类
       (yj_usage_log / dm_langue / yj_message)、inv_cost_ledger.重算时间。
     · 兼容性:两库均为 SQL Server 兼容级别 100 ⇒ 不用 STRING_AGG,列清单用 FOR XML PATH;
       涉及筛选索引的 UPDATE 必须 QUOTED_IDENTIFIER ON(sqlcmd 默认 OFF 会报 1934)。
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;   /* ⚠ bs_inv 等表上有筛选索引,缺这条 UPDATE 会报 1934 */
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

IF DB_ID(N'HSDZ_MES_SRV1017') IS NULL
BEGIN
    RAISERROR(N'[FATAL] 源库 HSDZ_MES_SRV1017 不存在(请先把服务器快照还原成对照库)', 16, 1);
    SET NOEXEC ON;
END
ELSE
BEGIN
    PRINT N'==============================================================';
    PRINT N'服务器快照 → 本地库同步:  源 = HSDZ_MES_SRV1017   目标 = ' + DB_NAME();
    PRINT N'==============================================================';
END
GO

/* ---------------------------------------------------------------------------
   ① 结构:补服务器侧手工新增的 2 个默认约束(inh / outh 的 asp_cancel)
      ⚠ 服务器那份被写成中文引号 (N'‘N’'),这里落成正确值 (N'N')
   --------------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
IF OBJECT_ID('dbo.inh') IS NOT NULL AND COL_LENGTH('dbo.inh','asp_cancel') IS NOT NULL
BEGIN
    DECLARE @d nvarchar(200);
    IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name='DF_inh_asp_cancel')
    BEGIN
        ALTER TABLE dbo.inh ADD CONSTRAINT DF_inh_asp_cancel DEFAULT (N'N') FOR asp_cancel;
        PRINT N'[OK] 新增默认约束 DF_inh_asp_cancel = (N''N'')';
    END
    ELSE
    BEGIN
        SET @d = (SELECT definition FROM sys.default_constraints WHERE name='DF_inh_asp_cancel');
        IF @d LIKE N'%‘N’%'
        BEGIN
            EXEC(N'ALTER TABLE dbo.inh DROP CONSTRAINT DF_inh_asp_cancel');
            ALTER TABLE dbo.inh ADD CONSTRAINT DF_inh_asp_cancel DEFAULT (N'N') FOR asp_cancel;
            PRINT N'[FIX] DF_inh_asp_cancel 原来是 ' + @d + N' → 改为 (N''N'')';
        END
        ELSE PRINT N'[SKIP] DF_inh_asp_cancel 已存在且取值正确';
    END
END
ELSE PRINT N'[SKIP] 本库没有 dbo.inh';

IF OBJECT_ID('dbo.outh') IS NOT NULL AND COL_LENGTH('dbo.outh','asp_cancel') IS NOT NULL
BEGIN
    DECLARE @d2 nvarchar(200);
    IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name='DF_outh_asp_cancel')
    BEGIN
        ALTER TABLE dbo.outh ADD CONSTRAINT DF_outh_asp_cancel DEFAULT (N'N') FOR asp_cancel;
        PRINT N'[OK] 新增默认约束 DF_outh_asp_cancel = (N''N'')';
    END
    ELSE
    BEGIN
        SET @d2 = (SELECT definition FROM sys.default_constraints WHERE name='DF_outh_asp_cancel');
        IF @d2 LIKE N'%‘N’%'
        BEGIN
            EXEC(N'ALTER TABLE dbo.outh DROP CONSTRAINT DF_outh_asp_cancel');
            ALTER TABLE dbo.outh ADD CONSTRAINT DF_outh_asp_cancel DEFAULT (N'N') FOR asp_cancel;
            PRINT N'[FIX] DF_outh_asp_cancel 原来是 ' + @d2 + N' → 改为 (N''N'')';
        END
        ELSE PRINT N'[SKIP] DF_outh_asp_cancel 已存在且取值正确';
    END
END
ELSE PRINT N'[SKIP] 本库没有 dbo.outh';
GO

/* ---------------------------------------------------------------------------
   ② 账号与手机端权限(手机端登录/权限直接读这三张表)
   --------------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
DECLARE @n int;

IF OBJECT_ID('dbo.yj_user') IS NOT NULL
BEGIN
    UPDATE u SET MobId = s.MobId, dlxz = s.dlxz, phoneNo = s.phoneNo
    FROM dbo.yj_user u JOIN [HSDZ_MES_SRV1017].dbo.yj_user s ON s.username = u.username
    WHERE ISNULL(u.MobId,'')   <> ISNULL(s.MobId,'')
       OR ISNULL(u.dlxz,'')    <> ISNULL(s.dlxz,'')
       OR ISNULL(u.phoneNo,'') <> ISNULL(s.phoneNo,'');
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] yj_user 手机绑定字段更新 ' + CAST(@n AS nvarchar(10)) + N' 行';
END

IF OBJECT_ID('dbo.permission') IS NOT NULL
BEGIN
    UPDATE p SET USERID = s.USERID, MODULE1 = s.MODULE1, MODULE_NA = s.MODULE_NA,
                 RW = s.RW, GROP = s.GROP, REMARK = s.REMARK
    FROM dbo.permission p JOIN [HSDZ_MES_SRV1017].dbo.permission s ON s.ID = p.ID
    WHERE ISNULL(p.USERID,'') <> ISNULL(s.USERID,'')
       OR ISNULL(p.RW,'')     <> ISNULL(s.RW,'')
       OR ISNULL(p.GROP,'')   <> ISNULL(s.GROP,'');
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] permission 更新 ' + CAST(@n AS nvarchar(10)) + N' 行';

    BEGIN TRY
        SET IDENTITY_INSERT dbo.permission ON;
        INSERT INTO dbo.permission (COMM, ID, USERID, MODULE1, RW, MODULE_NA, GROP, REMARK,
                                    asp_user1, asp_time1, asp_user2, asp_time2, asp_user3, asp_time3,
                                    asp_cancel, asp_user4, asp_time4, asp_print)
        SELECT COMM, ID, USERID, MODULE1, RW, MODULE_NA, GROP, REMARK,
               asp_user1, asp_time1, asp_user2, asp_time2, asp_user3, asp_time3,
               asp_cancel, asp_user4, asp_time4, asp_print
        FROM [HSDZ_MES_SRV1017].dbo.permission s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.permission l WHERE l.ID = s.ID);
        SET @n = @@ROWCOUNT;
        SET IDENTITY_INSERT dbo.permission OFF;
        PRINT N'[OK] permission 补行 ' + CAST(@n AS nvarchar(10)) + N' 行';
    END TRY
    BEGIN CATCH
        SET IDENTITY_INSERT dbo.permission OFF;
        PRINT N'[ERROR] permission: ' + ERROR_MESSAGE();
    END CATCH
END

IF OBJECT_ID('dbo.yj_role_panel') IS NOT NULL
BEGIN
    DELETE p FROM dbo.yj_role_panel p
    WHERE p.role_id = 1025
      AND NOT EXISTS (SELECT 1 FROM [HSDZ_MES_SRV1017].dbo.yj_role_panel s
                      WHERE s.role_id = 1025 AND s.panel_code = p.panel_code);
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] yj_role_panel(1025) 删除服务器已取消的授权 ' + CAST(@n AS nvarchar(10)) + N' 行';

    UPDATE p SET can_approve = s.can_approve, perms = s.perms
    FROM dbo.yj_role_panel p
    JOIN [HSDZ_MES_SRV1017].dbo.yj_role_panel s ON s.role_id = p.role_id AND s.panel_code = p.panel_code
    WHERE p.role_id = 1025
      AND (ISNULL(p.perms,'') <> ISNULL(s.perms,'') OR ISNULL(p.can_approve,'') <> ISNULL(s.can_approve,''));
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] yj_role_panel(1025) 更新 ' + CAST(@n AS nvarchar(10)) + N' 行';

    BEGIN TRY
        SET IDENTITY_INSERT dbo.yj_role_panel ON;
        INSERT INTO dbo.yj_role_panel (id, role_id, panel_code, can_approve, perms)
        SELECT s.id, s.role_id, s.panel_code, s.can_approve, s.perms
        FROM [HSDZ_MES_SRV1017].dbo.yj_role_panel s
        WHERE s.role_id = 1025
          AND NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel l WHERE l.role_id = s.role_id AND l.panel_code = s.panel_code)
          AND NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel l2 WHERE l2.id = s.id);
        SET @n = @@ROWCOUNT;
        SET IDENTITY_INSERT dbo.yj_role_panel OFF;
        PRINT N'[OK] yj_role_panel(1025) 补行 ' + CAST(@n AS nvarchar(10)) + N' 行';
    END TRY
    BEGIN CATCH
        SET IDENTITY_INSERT dbo.yj_role_panel OFF;
        PRINT N'[ERROR] yj_role_panel: ' + ERROR_MESSAGE();
    END CATCH
END
GO

/* ---------------------------------------------------------------------------
   ③ 单据状态登记 / 审批留痕 / 退回-特采关联
   --------------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
DECLARE @n int;

-- 3.1 yj_doc_status:先补 id 空闲的,再补 id 被占的(退回自增)
IF OBJECT_ID('dbo.yj_doc_status') IS NOT NULL
BEGIN
    BEGIN TRY
        SET IDENTITY_INSERT dbo.yj_doc_status ON;
        INSERT INTO dbo.yj_doc_status (id, panel_code, doc_no, shr, shsj, canceled, cancel_by, cancel_at,
            pending, pending_by, pending_at, update_at, stopped, stop_by, stop_at, saved, archived,
            deleting, delete_req_by, delete_req_at, modify_state, modify_req_by, modify_req_at,
            modify_appr_by, modify_appr_at, archived_at, erp_close_state, approve_node, l2_approver,
            effective, modify_reason)
        SELECT s.id, s.panel_code, s.doc_no, s.shr, s.shsj, s.canceled, s.cancel_by, s.cancel_at,
            s.pending, s.pending_by, s.pending_at, s.update_at, s.stopped, s.stop_by, s.stop_at, s.saved, s.archived,
            s.deleting, s.delete_req_by, s.delete_req_at, s.modify_state, s.modify_req_by, s.modify_req_at,
            s.modify_appr_by, s.modify_appr_at, s.archived_at, s.erp_close_state, s.approve_node, s.l2_approver,
            s.effective, s.modify_reason
        FROM [HSDZ_MES_SRV1017].dbo.yj_doc_status s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status l WHERE l.panel_code = s.panel_code AND l.doc_no = s.doc_no)
          AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status l2 WHERE l2.id = s.id);
        SET @n = @@ROWCOUNT;
        SET IDENTITY_INSERT dbo.yj_doc_status OFF;
        PRINT N'[OK] yj_doc_status 补登记(保 id)' + CAST(@n AS nvarchar(10)) + N' 条';

        INSERT INTO dbo.yj_doc_status (panel_code, doc_no, shr, shsj, canceled, cancel_by, cancel_at,
            pending, pending_by, pending_at, update_at, stopped, stop_by, stop_at, saved, archived,
            deleting, delete_req_by, delete_req_at, modify_state, modify_req_by, modify_req_at,
            modify_appr_by, modify_appr_at, archived_at, erp_close_state, approve_node, l2_approver,
            effective, modify_reason)
        SELECT s.panel_code, s.doc_no, s.shr, s.shsj, s.canceled, s.cancel_by, s.cancel_at,
            s.pending, s.pending_by, s.pending_at, s.update_at, s.stopped, s.stop_by, s.stop_at, s.saved, s.archived,
            s.deleting, s.delete_req_by, s.delete_req_at, s.modify_state, s.modify_req_by, s.modify_req_at,
            s.modify_appr_by, s.modify_appr_at, s.archived_at, s.erp_close_state, s.approve_node, s.l2_approver,
            s.effective, s.modify_reason
        FROM [HSDZ_MES_SRV1017].dbo.yj_doc_status s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status l WHERE l.panel_code = s.panel_code AND l.doc_no = s.doc_no);
        SET @n = @@ROWCOUNT;
        PRINT N'[OK] yj_doc_status 补登记(id 冲突走自增)' + CAST(@n AS nvarchar(10)) + N' 条';
    END TRY
    BEGIN CATCH
        SET IDENTITY_INSERT dbo.yj_doc_status OFF;
        PRINT N'[ERROR] yj_doc_status: ' + ERROR_MESSAGE();
    END CATCH

    UPDATE d SET shr = s.shr, shsj = s.shsj, erp_close_state = s.erp_close_state, update_at = s.update_at
    FROM dbo.yj_doc_status d
    JOIN [HSDZ_MES_SRV1017].dbo.yj_doc_status s ON s.panel_code = d.panel_code AND s.doc_no = d.doc_no
    WHERE ISNULL(d.shr,'') <> ISNULL(s.shr,'')
       OR ISNULL(CONVERT(nvarchar(30), d.shsj), '') <> ISNULL(CONVERT(nvarchar(30), s.shsj), '')
       OR ISNULL(d.erp_close_state,'') <> ISNULL(s.erp_close_state,'');
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] yj_doc_status 审核/关闭状态更新 ' + CAST(@n AS nvarchar(10)) + N' 条';
END

-- 3.2 yj_form_approval
IF OBJECT_ID('dbo.yj_form_approval') IS NOT NULL
BEGIN
    BEGIN TRY
        SET IDENTITY_INSERT dbo.yj_form_approval ON;
        INSERT INTO dbo.yj_form_approval (id, panel_code, form_no, action, result, node_no, operator, opinion, create_time)
        SELECT s.id, s.panel_code, s.form_no, s.action, s.result, s.node_no, s.operator, s.opinion, s.create_time
        FROM [HSDZ_MES_SRV1017].dbo.yj_form_approval s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_form_approval l WHERE l.id = s.id);
        SET @n = @@ROWCOUNT;
        SET IDENTITY_INSERT dbo.yj_form_approval OFF;
        PRINT N'[OK] yj_form_approval 补留痕 ' + CAST(@n AS nvarchar(10)) + N' 条';
    END TRY
    BEGIN CATCH
        SET IDENTITY_INSERT dbo.yj_form_approval OFF;
        PRINT N'[ERROR] yj_form_approval: ' + ERROR_MESSAGE();
    END CATCH
END

-- 3.3 form_flow_link
IF OBJECT_ID('dbo.form_flow_link') IS NOT NULL
BEGIN
    BEGIN TRY
        SET IDENTITY_INSERT dbo.form_flow_link ON;
        INSERT INTO dbo.form_flow_link (id, source_panel_code, source_form_no, source_detail_key, source_line_key,
            target_panel_code, target_form_no, target_detail_key, target_line_key, inventory_code,
            source_quantity, linked_quantity, link_status, create_by, create_time, release_time, batch_no, batch_id,
            备用1, 备用2, 备用3, 备用4, 备用5, 备用6, 备用7, 备用8, 备用9, 备用10,
            备用11, 备用12, 备用13, 备用14, 备用15, 备用16, 备用17, 备用18, 备用19, 备用20)
        SELECT s.id, s.source_panel_code, s.source_form_no, s.source_detail_key, s.source_line_key,
            s.target_panel_code, s.target_form_no, s.target_detail_key, s.target_line_key, s.inventory_code,
            s.source_quantity, s.linked_quantity, s.link_status, s.create_by, s.create_time, s.release_time, s.batch_no, s.batch_id,
            s.备用1, s.备用2, s.备用3, s.备用4, s.备用5, s.备用6, s.备用7, s.备用8, s.备用9, s.备用10,
            s.备用11, s.备用12, s.备用13, s.备用14, s.备用15, s.备用16, s.备用17, s.备用18, s.备用19, s.备用20
        FROM [HSDZ_MES_SRV1017].dbo.form_flow_link s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.form_flow_link l WHERE l.id = s.id);
        SET @n = @@ROWCOUNT;
        SET IDENTITY_INSERT dbo.form_flow_link OFF;
        PRINT N'[OK] form_flow_link 补行 ' + CAST(@n AS nvarchar(10)) + N' 条';
    END TRY
    BEGIN CATCH
        SET IDENTITY_INSERT dbo.form_flow_link OFF;
        PRINT N'[ERROR] form_flow_link: ' + ERROR_MESSAGE();
    END CATCH
END
GO

/* ---------------------------------------------------------------------------
   ④+⑤ 业务单据与生产实绩(列清单用 FOR XML PATH 动态生成,兼容级别 100 可用)
   --------------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
IF OBJECT_ID('tempdb..#cols') IS NOT NULL DROP TABLE #cols;
CREATE TABLE #cols (tbl sysname, cols nvarchar(max));
INSERT INTO #cols
SELECT t.name,
       STUFF((SELECT ',' + QUOTENAME(c.name) FROM sys.columns c
              WHERE c.object_id = t.object_id ORDER BY c.column_id
              FOR XML PATH(''), TYPE).value('.','nvarchar(max)'), 1, 1, '')
FROM sys.tables t
WHERE t.name IN ('bd_so_order','bl_so_order','bs_qc_plan','bs_qc_item','qc_tc_in',
                 'scjl','wo_process_line','wo_transfer_log','plang_pc');

DECLARE @tbl sysname, @cols nvarchar(max), @sql nvarchar(max), @c int, @where nvarchar(1000);

DECLARE @plan TABLE (seq int, t sysname, k nvarchar(400));
INSERT INTO @plan VALUES
 (1, N'bd_so_order',     N'NOT EXISTS (SELECT 1 FROM dbo.bd_so_order l WHERE l.单据编号 = s.单据编号) AND NOT EXISTS (SELECT 1 FROM dbo.bd_so_order l2 WHERE l2.id = s.id)'),
 (2, N'bl_so_order',     N'NOT EXISTS (SELECT 1 FROM dbo.bl_so_order l WHERE l.id = s.id) AND NOT EXISTS (SELECT 1 FROM dbo.bl_so_order l2 WHERE l2.单据编号 = s.单据编号 AND l2.存货编码 = s.存货编码 AND l2.数量 = s.数量)'),
 (3, N'bs_qc_plan',      N'NOT EXISTS (SELECT 1 FROM dbo.bs_qc_plan l WHERE l.方案编码 = s.方案编码)'),
 (4, N'bs_qc_item',      N'NOT EXISTS (SELECT 1 FROM dbo.bs_qc_item l WHERE l.项目编码 = s.项目编码 AND l.方案编码 = s.方案编码)'),
 (5, N'qc_tc_in',        N'NOT EXISTS (SELECT 1 FROM dbo.qc_tc_in l WHERE l.单据编号 = s.单据编号) AND NOT EXISTS (SELECT 1 FROM dbo.qc_tc_in l2 WHERE l2.id = s.id)'),
 (6, N'scjl',            N'NOT EXISTS (SELECT 1 FROM dbo.scjl l WHERE l.comm = s.comm AND l.id = s.id) AND NOT EXISTS (SELECT 1 FROM dbo.scjl l2 WHERE l2.id = s.id)'),
 (7, N'wo_process_line', N'NOT EXISTS (SELECT 1 FROM dbo.wo_process_line l WHERE l.id = s.id)'),
 (8, N'wo_transfer_log', N'NOT EXISTS (SELECT 1 FROM dbo.wo_transfer_log l WHERE l.id = s.id)'),
 (9, N'plang_pc',        N'NOT EXISTS (SELECT 1 FROM dbo.plang_pc l WHERE l.id = s.id)');

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT t, k FROM @plan ORDER BY seq;
OPEN cur; FETCH NEXT FROM cur INTO @tbl, @cols;   /* 第二列先取 k,循环里再取列清单 */
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @where = @cols;
    SET @cols = (SELECT cols FROM #cols WHERE tbl = @tbl);
    IF OBJECT_ID('dbo.' + @tbl) IS NULL
        PRINT N'[SKIP] 本库没有 dbo.' + @tbl;
    ELSE IF @cols IS NULL
        PRINT N'[SKIP] 取不到列清单: dbo.' + @tbl;
    ELSE
    BEGIN
        SET @sql = N'SET IDENTITY_INSERT dbo.' + QUOTENAME(@tbl) + N' ON;
          INSERT INTO dbo.' + QUOTENAME(@tbl) + N' (' + @cols + N') SELECT ' + @cols + N'
          FROM [HSDZ_MES_SRV1017].dbo.' + QUOTENAME(@tbl) + N' s
          WHERE ' + @where + N';
          SET @cc = @@ROWCOUNT;
          SET IDENTITY_INSERT dbo.' + QUOTENAME(@tbl) + N' OFF;
          PRINT N''[OK] ' + @tbl + N' 补行 '' + CAST(@cc AS nvarchar(10)) + N'' 行'';';
        BEGIN TRY
            EXEC sp_executesql @sql, N'@cc int OUTPUT', @c OUTPUT;
        END TRY
        BEGIN CATCH
            DECLARE @off nvarchar(300);
            SET @off = N'SET IDENTITY_INSERT dbo.' + QUOTENAME(@tbl) + N' OFF';
            EXEC(@off);
            PRINT N'[ERROR] ' + @tbl + N': ' + ERROR_MESSAGE();
        END CATCH
    END
    FETCH NEXT FROM cur INTO @tbl, @cols;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------------------------------------------------------------------------
   ⑥ 号码池 s_allno:补服务器已发号码(否则本地会在这些号上重号)
   --------------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
DECLARE @n int;
IF OBJECT_ID('dbo.s_allno') IS NOT NULL
BEGIN
    BEGIN TRY
        SET IDENTITY_INSERT dbo.s_allno ON;
        INSERT INTO dbo.s_allno (comm, ID, dh, lb, ny, bz,
            asp_user1, asp_time1, asp_user2, asp_time2, asp_user3, asp_time3,
            asp_cancel, asp_user4, asp_time4, asp_print,
            备用1, 备用2, 备用3, 备用4, 备用5, 备用6, 备用7, 备用8, 备用9, 备用10,
            备用11, 备用12, 备用13, 备用14, 备用15, 备用16, 备用17, 备用18, 备用19, 备用20)
        SELECT comm, ID, dh, lb, ny, bz,
            asp_user1, asp_time1, asp_user2, asp_time2, asp_user3, asp_time3,
            asp_cancel, asp_user4, asp_time4, asp_print,
            备用1, 备用2, 备用3, 备用4, 备用5, 备用6, 备用7, 备用8, 备用9, 备用10,
            备用11, 备用12, 备用13, 备用14, 备用15, 备用16, 备用17, 备用18, 备用19, 备用20
        FROM [HSDZ_MES_SRV1017].dbo.s_allno s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.s_allno l WHERE l.comm = s.comm AND l.ID = s.ID);
        SET @n = @@ROWCOUNT;
        SET IDENTITY_INSERT dbo.s_allno OFF;
        PRINT N'[OK] s_allno 补号码 ' + CAST(@n AS nvarchar(10)) + N' 个';
    END TRY
    BEGIN CATCH
        SET IDENTITY_INSERT dbo.s_allno OFF;
        PRINT N'[ERROR] s_allno: ' + ERROR_MESSAGE();
    END CATCH
END
GO

/* ---------------------------------------------------------------------------
   ⑦ 存货 / 出库审核 / 退回单 三处属性漂移(服务器为准)
   --------------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
DECLARE @n int;

IF OBJECT_ID('dbo.bs_inv') IS NOT NULL
BEGIN
    UPDATE i SET 外部指纹 = s.外部指纹, 存货名称 = s.存货名称, 助记码 = s.助记码,
                 ERP更新时间 = s.ERP更新时间, 图片链接 = s.图片链接,
                 最近销售价 = s.最近销售价, 最近含税销售价 = s.最近含税销售价,
                 商品图片 = s.商品图片, 附件地址 = s.附件地址
    FROM dbo.bs_inv i JOIN [HSDZ_MES_SRV1017].dbo.bs_inv s ON s.id = i.id
    WHERE ISNULL(i.外部指纹,'')       <> ISNULL(s.外部指纹,'')
       OR ISNULL(i.存货名称,'')       <> ISNULL(s.存货名称,'')
       OR ISNULL(i.助记码,'')         <> ISNULL(s.助记码,'')
       OR ISNULL(CONVERT(nvarchar(30), i.ERP更新时间),'') <> ISNULL(CONVERT(nvarchar(30), s.ERP更新时间),'')
       OR ISNULL(i.图片链接,'')       <> ISNULL(s.图片链接,'')
       OR ISNULL(CONVERT(nvarchar(40), i.最近销售价),'')     <> ISNULL(CONVERT(nvarchar(40), s.最近销售价),'')
       OR ISNULL(CONVERT(nvarchar(40), i.最近含税销售价),'') <> ISNULL(CONVERT(nvarchar(40), s.最近含税销售价),'')
       OR ISNULL(i.商品图片,'')       <> ISNULL(s.商品图片,'')
       OR ISNULL(i.附件地址,'')       <> ISNULL(s.附件地址,'');
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] bs_inv 属性同步 ' + CAST(@n AS nvarchar(10)) + N' 行';
END

IF OBJECT_ID('dbo.outh') IS NOT NULL
BEGIN
    UPDATE o SET 审核 = s.审核, asp_user3 = s.asp_user3, asp_time3 = s.asp_time3,
                 asp_user4 = s.asp_user4, asp_time4 = s.asp_time4,
                 asp_cancel = s.asp_cancel
    FROM dbo.outh o JOIN [HSDZ_MES_SRV1017].dbo.outh s ON s.id = o.id
    WHERE ISNULL(o.审核,'') <> ISNULL(s.审核,'')
       OR ISNULL(o.asp_user3,'') <> ISNULL(s.asp_user3,'')
       OR ISNULL(CONVERT(nvarchar(30), o.asp_time3),'') <> ISNULL(CONVERT(nvarchar(30), s.asp_time3),'')
       OR ISNULL(o.asp_user4,'') <> ISNULL(s.asp_user4,'')
       OR ISNULL(o.asp_cancel,'') <> ISNULL(s.asp_cancel,'');
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] outh 审核/作废字段同步 ' + CAST(@n AS nvarchar(10)) + N' 行';
END

IF OBJECT_ID('dbo.qc_return') IS NOT NULL
BEGIN
    UPDATE r SET asp_time2 = s.asp_time2
    FROM dbo.qc_return r JOIN [HSDZ_MES_SRV1017].dbo.qc_return s ON s.id = r.id
    WHERE ISNULL(CONVERT(nvarchar(30), r.asp_time2),'') <> ISNULL(CONVERT(nvarchar(30), s.asp_time2),'');
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] qc_return 同步 ' + CAST(@n AS nvarchar(10)) + N' 行';
END

IF OBJECT_ID('dbo.qc_return_detail') IS NOT NULL
BEGIN
    UPDATE d SET 批次号 = s.批次号, 特采 = s.特采, asp_time2 = s.asp_time2
    FROM dbo.qc_return_detail d JOIN [HSDZ_MES_SRV1017].dbo.qc_return_detail s ON s.id = d.id
    WHERE ISNULL(d.批次号,'') <> ISNULL(s.批次号,'')
       OR ISNULL(d.特采,'')   <> ISNULL(s.特采,'')
       OR ISNULL(CONVERT(nvarchar(30), d.asp_time2),'') <> ISNULL(CONVERT(nvarchar(30), s.asp_time2),'');
    SET @n = @@ROWCOUNT;
    PRINT N'[OK] qc_return_detail 同步 ' + CAST(@n AS nvarchar(10)) + N' 行';
END
GO

/* ---------------------------------------------------------------------------
   ⑧ 自检:本脚本负责的范围逐项对账(应全部 PASS)
   --------------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
DECLARE @bad int = 0, @v int;

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.yj_role_panel s WHERE s.role_id=1025
             AND NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel l WHERE l.role_id=1025 AND l.panel_code=s.panel_code));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] yj_role_panel(1025) 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 行'; END ELSE PRINT N'[PASS] yj_role_panel(1025) 与服务器一致';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.yj_doc_status s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status l WHERE l.panel_code=s.panel_code AND l.doc_no=s.doc_no));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] yj_doc_status 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 条'; END ELSE PRINT N'[PASS] yj_doc_status 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.bd_so_order s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.bd_so_order l WHERE l.单据编号=s.单据编号));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] bd_so_order 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 张'; END ELSE PRINT N'[PASS] bd_so_order 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.bs_qc_plan s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.bs_qc_plan l WHERE l.方案编码=s.方案编码));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] bs_qc_plan 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 套'; END ELSE PRINT N'[PASS] bs_qc_plan 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.bs_qc_item s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.bs_qc_item l WHERE l.项目编码=s.项目编码 AND l.方案编码=s.方案编码));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] bs_qc_item 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 条'; END ELSE PRINT N'[PASS] bs_qc_item 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.s_allno s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.s_allno l WHERE l.comm=s.comm AND l.ID=s.ID));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] s_allno 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 个号码'; END ELSE PRINT N'[PASS] s_allno 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.scjl s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.scjl l WHERE l.id=s.id AND l.comm=s.comm));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] scjl 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 行'; END ELSE PRINT N'[PASS] scjl 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.wo_process_line s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.wo_process_line l WHERE l.id=s.id));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] wo_process_line 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 行'; END ELSE PRINT N'[PASS] wo_process_line 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.wo_transfer_log s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.wo_transfer_log l WHERE l.id=s.id));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] wo_transfer_log 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 行'; END ELSE PRINT N'[PASS] wo_transfer_log 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.plang_pc s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.plang_pc l WHERE l.id=s.id));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] plang_pc 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 行'; END ELSE PRINT N'[PASS] plang_pc 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.permission s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.permission l WHERE l.ID=s.ID));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] permission 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 行'; END ELSE PRINT N'[PASS] permission 无缺失';

SELECT @v = (SELECT COUNT(*) FROM [HSDZ_MES_SRV1017].dbo.yj_form_approval s
             WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_form_approval l WHERE l.id=s.id));
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] yj_form_approval 仍缺 ' + CAST(@v AS nvarchar(10)) + N' 条'; END ELSE PRINT N'[PASS] yj_form_approval 无缺失';

SELECT @v = (SELECT COUNT(*) FROM sys.default_constraints WHERE name IN ('DF_inh_asp_cancel','DF_outh_asp_cancel')
             AND definition LIKE N'%‘N’%');
IF @v > 0 BEGIN SET @bad += 1; PRINT N'[FAIL] asp_cancel 默认约束取值仍是中文引号 ' + CAST(@v AS nvarchar(10)) + N' 个'; END ELSE PRINT N'[PASS] asp_cancel 默认约束取值正确';

SELECT @v = (SELECT COUNT(*) FROM sys.default_constraints WHERE name IN ('DF_inh_asp_cancel','DF_outh_asp_cancel'));
IF @v < 2 BEGIN SET @bad += 1; PRINT N'[FAIL] 只找到 ' + CAST(@v AS nvarchar(10)) + N' 个 asp_cancel 默认约束(应 2 个)'; END

PRINT N'--------------------------------------------------------------';
IF @bad = 0 PRINT N'RESULT: SYNC-OK  (本脚本范围内的服务器侧修改已全部落到 ' + DB_NAME() + N')';
ELSE        PRINT N'RESULT: SYNC-FAIL-' + CAST(@bad AS nvarchar(10)) + N'  (见上方 [FAIL],可重复执行)';
PRINT N'--------------------------------------------------------------';
GO
