-- migrate-spare-columns-biz.sql — 备用列池补全(在用业务表)(2026-09-29)
--
-- 背景:2026-09-28 的 migrate-spare-columns.sql 只覆盖「前缀 bs_/bd_/bl_/rd_/qc_/wo_ 且被 yj_panel 引用」
--   的 139 张表;按四源审计确定的「在用业务表」清单,还有 45 张在用表没有备用列池——
--   面板上加自定义字段(动态字段绑定)时会无列可用。本脚本按显式清单补齐 备用1..备用20。
--
-- 范围 = 在用业务表(在用 206 张 − yj_* 引擎元数据表 25 张 − 已有备用列 136 张)= 45 张;
--   含 MES 自有未接入备用列的表(day_report/equip_check/feed_confirm/gran_record/maint_plan/
--   mix_record/pack_confirm/rod_return/sample_req/sl_recv/wh_record/erp_imp_log/inv_cost_ledger/
--   form_flow_link/qr_batch_registry/report_column_settings/rd_dev_task/rd_spec_assign/s_allno/wo_report…)
--   与仍被面板/服务在用的经典遗留表(dm_ck/dm_gf/dm_kh/gxgs/inh/kucun/mate/order_bt/order_bs/outh/
--   Porder/plang/plang_pc/scjl/s_log)。
-- 不加 yj_* 引擎元数据表:其结构由代码与迁移脚本固定,加 20 个空列没有自定义字段的语义(用户 2026-09-29 拍板)。
-- 口径:备用列 nvarchar(500) NULL;建列即写 MS_Description='预留扩展字段(未绑定)',
--   绑定/退绑时由 PanelConfigService 改写为「<标签>(动态字段,绑定<备用N>)」——见设计 docs/design/动态字段扩展-备用列池-V1.0.md。
-- 幂等:列存在跳过、已有 MS_Description 不覆盖(绑定后的业务注明不受影响);新库场景可重跑。
--
-- 生成:tools/archive/_gen-spare-sql.cjs(清单来自 tools/archive/_table-audit/spare-targets.txt)

SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @t TABLE (name sysname PRIMARY KEY);
INSERT INTO @t (name) VALUES
  (N'Porder'),(N'day_report'),(N'day_report_detail'),(N'dm_ck'),(N'dm_gf'),(N'dm_kh'),(N'equip_check'),
  (N'equip_check_detail'),(N'erp_imp_log'),(N'feed_confirm'),(N'feed_confirm_detail'),(N'form_flow_link'),
  (N'gran_record'),(N'gran_record_detail'),(N'gxgs'),(N'inh'),(N'inv_cost_ledger'),(N'kucun'),(N'maint_plan'),
  (N'maint_plan_detail'),(N'mate'),(N'mix_record'),(N'mix_record_detail'),(N'order_bs'),(N'order_bt'),(N'outh'),
  (N'pack_confirm'),(N'pack_confirm_detail'),(N'plang'),(N'plang_pc'),(N'qr_batch_registry'),(N'rd_dev_task'),
  (N'rd_spec_assign'),(N'report_column_settings'),(N'rod_return'),(N'rod_return_detail'),(N's_allno'),(N's_log'),
  (N'sample_req'),(N'sample_req_detail'),(N'scjl'),(N'sl_recv'),(N'sl_recv_detail'),(N'wh_record'),(N'wh_record_detail');

DECLARE @tb sysname, @spare nvarchar(20), @sql nvarchar(500), @added int = 0, @noted int = 0, @tables int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT t.name FROM @t t WHERE OBJECT_ID(t.name, N'U') IS NOT NULL ORDER BY t.name;
OPEN cur;
FETCH NEXT FROM cur INTO @tb;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @tables += 1;
  DECLARE @i int = 1;
  WHILE @i <= 20
  BEGIN
    SET @spare = N'备用' + CAST(@i AS nvarchar(10));
    IF COL_LENGTH(@tb, @spare) IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE ' + QUOTENAME(@tb) + N' ADD ' + QUOTENAME(@spare) + N' nvarchar(500) NULL';
      EXEC sp_executesql @sql;
      SET @added += 1;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   JOIN sys.columns col ON col.object_id = ep.major_id AND col.column_id = ep.minor_id
                   WHERE ep.major_id = OBJECT_ID(@tb) AND ep.name = N'MS_Description' AND col.name = @spare)
    BEGIN
      EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', @tb, N'COLUMN', @spare;
      SET @noted += 1;
    END
    SET @i += 1;
  END
  FETCH NEXT FROM cur INTO @tb;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'备用列池补全: 覆盖表 ' + CAST(@tables AS nvarchar(10)) + N' 张, 新增列 ' + CAST(@added AS nvarchar(10))
    + N' , 补注明 ' + CAST(@noted AS nvarchar(10));
GO

-- 核对:在用业务表是否都齐 20 个备用列(预期 0)
SELECT N'在用业务表缺备用列的表数(预期 0)' AS 检查项, COUNT(*) AS 值
FROM (VALUES
  (N'Porder'),(N'day_report'),(N'day_report_detail'),(N'dm_ck'),(N'dm_gf'),(N'dm_kh'),(N'equip_check'),
  (N'equip_check_detail'),(N'erp_imp_log'),(N'feed_confirm'),(N'feed_confirm_detail'),(N'form_flow_link'),
  (N'gran_record'),(N'gran_record_detail'),(N'gxgs'),(N'inh'),(N'inv_cost_ledger'),(N'kucun'),(N'maint_plan'),
  (N'maint_plan_detail'),(N'mate'),(N'mix_record'),(N'mix_record_detail'),(N'order_bs'),(N'order_bt'),(N'outh'),
  (N'pack_confirm'),(N'pack_confirm_detail'),(N'plang'),(N'plang_pc'),(N'qr_batch_registry'),(N'rd_dev_task'),
  (N'rd_spec_assign'),(N'report_column_settings'),(N'rod_return'),(N'rod_return_detail'),(N's_allno'),(N's_log'),
  (N'sample_req'),(N'sample_req_detail'),(N'scjl'),(N'sl_recv'),(N'sl_recv_detail'),(N'wh_record'),(N'wh_record_detail')
) v(name)
WHERE OBJECT_ID(v.name, N'U') IS NOT NULL
  AND (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = OBJECT_ID(v.name) AND c.name LIKE N'备用[0-9]%') < 20;
GO
