/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-server-converge-20260928.sql — 服务器结构收敛(本地→服务器方向,补"同名对象不同源"欠账)
   来源:2026-09-28 23:20 服务器最新 bak 分身对比第三轮发现的"本地独有"风险列——
   服务器这些表由金蝶还原血统带入(早于链脚本存在),链上守卫(IF OBJECT_ID/COL_LENGTH)
   在服务器执行时因表已存在/不存在而跳过,导致本地链建形态的服务器缺列:
     · rd_progress_detail 5 列(测试情况/立项日期/项目发起人/项目负责人/预计完成日期)
       —— ButtonService UPDATE 直接写 [预计完成日期],缺列必报"列名无效";其余 4 列走
          RD_PROGRESS 面板元数据 SELECT,缺列即面板 500;
     · rd_asm_bom_detail 7 列(表区/序号/更改内容/更改原因/更改时间/责任人/备注)
       —— 研发 BOM 变更链字段(yj_field 已登记),元数据查询缺列即 500;
     · erp_imp_row 审计五件套(asp_cancel/asp_user1/asp_time1/asp_user2)
       —— ERP 导入通道行表审计列,缺列时导入写账失败。
   其余本地独有列(bd_purchase_in/bd_sale_out 英文蛇形遗留列、spare-columns 备用池等)
   为无害形状分歧,不入本脚本(详见对账报告)。
   幂等:全部守卫式;本地两账套执行=no-op 仅登记;服务器执行=补齐三表 17 列。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
GO
-- ══ rd_progress_detail(项目进度,ButtonService 直写) ══
IF OBJECT_ID('dbo.rd_progress_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_progress_detail', N'测试情况') IS NULL ALTER TABLE dbo.rd_progress_detail ADD [测试情况] nvarchar(200) NULL;
IF OBJECT_ID('dbo.rd_progress_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_progress_detail', N'立项日期') IS NULL ALTER TABLE dbo.rd_progress_detail ADD [立项日期] nvarchar(30) NULL;
IF OBJECT_ID('dbo.rd_progress_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_progress_detail', N'项目发起人') IS NULL ALTER TABLE dbo.rd_progress_detail ADD [项目发起人] nvarchar(50) NULL;
IF OBJECT_ID('dbo.rd_progress_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_progress_detail', N'项目负责人') IS NULL ALTER TABLE dbo.rd_progress_detail ADD [项目负责人] nvarchar(50) NULL;
IF OBJECT_ID('dbo.rd_progress_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_progress_detail', N'预计完成日期') IS NULL ALTER TABLE dbo.rd_progress_detail ADD [预计完成日期] nvarchar(30) NULL;
GO
-- ══ rd_asm_bom_detail(研发 BOM 变更链) ══
IF OBJECT_ID('dbo.rd_asm_bom_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_asm_bom_detail', N'表区') IS NULL ALTER TABLE dbo.rd_asm_bom_detail ADD [表区] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_asm_bom_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_asm_bom_detail', N'序号') IS NULL ALTER TABLE dbo.rd_asm_bom_detail ADD [序号] nvarchar(20) NULL;
IF OBJECT_ID('dbo.rd_asm_bom_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_asm_bom_detail', N'更改内容') IS NULL ALTER TABLE dbo.rd_asm_bom_detail ADD [更改内容] nvarchar(500) NULL;
IF OBJECT_ID('dbo.rd_asm_bom_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_asm_bom_detail', N'更改原因') IS NULL ALTER TABLE dbo.rd_asm_bom_detail ADD [更改原因] nvarchar(200) NULL;
IF OBJECT_ID('dbo.rd_asm_bom_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_asm_bom_detail', N'更改时间') IS NULL ALTER TABLE dbo.rd_asm_bom_detail ADD [更改时间] nvarchar(50) NULL;
IF OBJECT_ID('dbo.rd_asm_bom_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_asm_bom_detail', N'责任人') IS NULL ALTER TABLE dbo.rd_asm_bom_detail ADD [责任人] nvarchar(50) NULL;
IF OBJECT_ID('dbo.rd_asm_bom_detail') IS NOT NULL AND COL_LENGTH('dbo.rd_asm_bom_detail', N'备注') IS NULL ALTER TABLE dbo.rd_asm_bom_detail ADD [备注] nvarchar(200) NULL;
GO
-- ══ erp_imp_row(ERP 导入通道审计五件套) ══
IF OBJECT_ID('dbo.erp_imp_row') IS NOT NULL AND COL_LENGTH('dbo.erp_imp_row', 'asp_cancel') IS NULL ALTER TABLE dbo.erp_imp_row ADD [asp_cancel] char(1) NULL;
IF OBJECT_ID('dbo.erp_imp_row') IS NOT NULL AND COL_LENGTH('dbo.erp_imp_row', 'asp_user1') IS NULL ALTER TABLE dbo.erp_imp_row ADD [asp_user1] nvarchar(100) NULL;
IF OBJECT_ID('dbo.erp_imp_row') IS NOT NULL AND COL_LENGTH('dbo.erp_imp_row', 'asp_time1') IS NULL ALTER TABLE dbo.erp_imp_row ADD [asp_time1] datetime2 NULL;
IF OBJECT_ID('dbo.erp_imp_row') IS NOT NULL AND COL_LENGTH('dbo.erp_imp_row', 'asp_user2') IS NULL ALTER TABLE dbo.erp_imp_row ADD [asp_user2] nvarchar(100) NULL;
IF OBJECT_ID('dbo.erp_imp_row') IS NOT NULL AND COL_LENGTH('dbo.erp_imp_row', 'asp_time2') IS NULL ALTER TABLE dbo.erp_imp_row ADD [asp_time2] datetime2 NULL;
GO
PRINT N'migrate-server-converge-20260928 完成(三表 17 列守卫式补齐;本地=no-op,服务器=补齐)';
GO
