-- migrate-golive-cleanup.sql — 全量部署前清理(2026-09-14 定:下次部署=全量恢复备份,本地库必须为干净账)
-- 保留:基础档案(bs_*)、yj_* 元数据/用户/角色、ERP 同步销售订单(bd/bl_so_order)、期初库存(kucun 中 migration 建的行)
-- 清除:全部业务测试单据 + 单据状态 + 日志 + 号池(归零) + 批号流水 + 二维码登记
-- ⚠ 破坏性脚本:执行前必须已做保险备份(HSDZ_MES_pre_golive_*.bak);服务器库勿直接执行本脚本
SET NOCOUNT ON;

-- ── 1. 行表先清(细节) ──
DELETE FROM bl_pu_req;            DELETE FROM bd_pu_req;
DELETE FROM bl_pu_order;          DELETE FROM bd_pu_order;
DELETE FROM bl_purchase_in;       DELETE FROM bd_purchase_in;
DELETE FROM bl_sale_out;          DELETE FROM bd_sale_out;
DELETE FROM bl_material_out;      DELETE FROM bd_material_out;
DELETE FROM bl_finish_in;         DELETE FROM bd_finish_in;
DELETE FROM bl_other_in;          DELETE FROM bd_other_in;
DELETE FROM bl_other_out;         DELETE FROM bd_other_out;
DELETE FROM bl_outsource_in;      DELETE FROM bd_outsource_in;
DELETE FROM bl_outsource_issue;   DELETE FROM bd_outsource_issue;
DELETE FROM bl_outsource_order;   DELETE FROM bd_outsource_order;
DELETE FROM bl_manu_order;        DELETE FROM bd_manu_order;
DELETE FROM bl_dispatch;          DELETE FROM bd_dispatch;
-- 注意:bd_so_order/bl_so_order(星辰同步的真实销售订单)保留不清

-- 品质
DELETE FROM qc_recv_detail;  DELETE FROM qc_recv;
DELETE FROM qc_insp_detail;  DELETE FROM qc_insp;
DELETE FROM qc_return_detail; DELETE FROM qc_return;
DELETE FROM qc_op_detail;    DELETE FROM qc_op;
DELETE FROM qc_record_detail; DELETE FROM qc_record;
DELETE FROM qc_disposal;

-- 生产
DELETE FROM wo_progress;
DELETE FROM wo_report;
DELETE FROM wo_stage_report;   -- PR系列(已下架)
DELETE FROM wo_line_stock;     -- PR系列(已下架)
DELETE FROM wo_material_pick;  -- PR系列(已下架)
DELETE FROM wo_order;
DELETE FROM day_report_detail;    DELETE FROM day_report;
DELETE FROM feed_confirm_detail;  DELETE FROM feed_confirm;
DELETE FROM mix_record_detail;    DELETE FROM mix_record;
DELETE FROM gran_record_detail;   DELETE FROM gran_record;
DELETE FROM wh_record_detail;     DELETE FROM wh_record;
DELETE FROM pack_confirm_detail;  DELETE FROM pack_confirm;
DELETE FROM equip_check_detail;   DELETE FROM equip_check;
DELETE FROM maint_plan_detail;    DELETE FROM maint_plan;
DELETE FROM sample_req_detail;    DELETE FROM sample_req;
DELETE FROM rod_return_detail;    DELETE FROM rod_return;

-- 研发(单据与测试数据;基础档案与元数据不在清列)
DELETE FROM rd_approval_detail;  DELETE FROM rd_approval;
DELETE FROM rd_plan_detail;      DELETE FROM rd_plan;
DELETE FROM rd_progress_detail;  DELETE FROM rd_progress;
DELETE FROM rd_prod_info_detail; DELETE FROM rd_prod_info_head;
DELETE FROM rd_spec_doc_detail;  DELETE FROM rd_spec_doc_head;
DELETE FROM rd_spec_assign;
DELETE FROM rd_dev_task;
DELETE FROM rd_insp_plan_detail; DELETE FROM rd_insp_plan_head;
DELETE FROM rd_mold_formula_detail; DELETE FROM rd_mold_formula_head;  DELETE FROM rd_mold_formula;
DELETE FROM rd_mold_proc_detail;    DELETE FROM rd_mold_proc_head;     DELETE FROM rd_mold_proc;
DELETE FROM rd_asm_bom_detail;      DELETE FROM rd_asm_bom_head;       DELETE FROM rd_asm_bom;
DELETE FROM rd_asm_proc_detail;     DELETE FROM rd_asm_proc_head;      DELETE FROM rd_asm_proc;
DELETE FROM rd_dom_test_detail;     DELETE FROM rd_dom_test_head;      DELETE FROM rd_dom_test;
DELETE FROM rd_equip_use_detail;    DELETE FROM rd_equip_use_head;     DELETE FROM rd_equip_use;
DELETE FROM rd_instr_use_detail;    DELETE FROM rd_instr_use_head;     DELETE FROM rd_instr_use;
DELETE FROM rd_spike_water_detail;  DELETE FROM rd_spike_water_head;   DELETE FROM rd_spike_water;
DELETE FROM rd_filter_eff_detail;   DELETE FROM rd_filter_eff_head;    DELETE FROM rd_filter_eff;
DELETE FROM rd_alkaline_detail;     DELETE FROM rd_alkaline_head;      DELETE FROM rd_alkaline;
DELETE FROM rd_antibact_detail;     DELETE FROM rd_antibact_head;      DELETE FROM rd_antibact;
DELETE FROM rd_mineral_detail;      DELETE FROM rd_mineral_head;       DELETE FROM rd_mineral;
DELETE FROM rd_scale_detail;        DELETE FROM rd_scale_head;         DELETE FROM rd_scale;
DELETE FROM rd_ro_protect_detail;   DELETE FROM rd_ro_protect_head;    DELETE FROM rd_ro_protect;
DELETE FROM rd_soak_detail;         DELETE FROM rd_soak_head;          DELETE FROM rd_soak;
DELETE FROM rd_drop_prec_detail;    DELETE FROM rd_drop_prec_head;     DELETE FROM rd_drop_prec;
DELETE FROM rd_product_info;   -- 旧表残留

-- 生产记录类新表(单表/头行)
DELETE FROM qr_batch_registry;   -- 二维码批号登记(测试批号)
DELETE FROM yj_plan_term;        -- 阶段中止/恢复申请

-- ── 2. 库存台账:仅保留迁移期初行(migration),测试动态行清除 ──
DELETE FROM kucun WHERE asp_user1 LIKE N'stock:%' OR asp_user1 LIKE N'qc:%';

-- ── 3. 状态机/日志/附件登记 ──
DELETE FROM yj_doc_status;
DELETE FROM yj_doc_modify_log;
DELETE FROM yj_form_approval;
DELETE FROM yj_usage_log;
DELETE FROM yj_message;
DELETE FROM yj_attachment;
DELETE FROM form_flow_link;
DELETE FROM report_column_settings;

-- ── 4. 号池归零 + 批号流水归零(正式使用从 001 起) ──
DELETE FROM s_allno;
DELETE FROM yj_lot_seq;
GO
PRINT N'migrate-golive-cleanup 完成:业务测试数据已清,基础档案/元数据/ERP销售订单/期初库存保留';
GO
