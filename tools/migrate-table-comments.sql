-- migrate-table-comments.sql — HSDZ_MES 全库表级中文注释(MS_Description 扩展属性)
-- 范围:YINJIA-MES 体系表(yj_*元数据/bd_bl_单据/bs_档案/qc_wo_rd_业务/生产新表/PR系列)+遗留缺注表+备份标记
-- 幂等:已有注释的表不覆盖;表不存在自动跳过;备份/改名残留统一标记
SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#tabdesc') IS NOT NULL DROP TABLE #tabdesc;
CREATE TABLE #tabdesc (tbl sysname PRIMARY KEY, descr nvarchar(400));
INSERT INTO #tabdesc (tbl, descr) VALUES
-- ── yj_* 面板引擎元数据 ──
(N'yj_panel',        N'面板注册表(元数据核心:面板编码/模式doc|flat|archive/头行表/前缀/日期列/模块分组)'),
(N'yj_field',        N'面板字段注册表(列名/中文标签/类型/字典SQL/参照面板/位置query|header|detail/必填)'),
(N'yj_translation',  N'多语言翻译表(scope=panel|field,ref_key=中文键,source=mt机翻|manual人工)'),
(N'yj_locale',       N'语言表(启用语言清单,插行即出现语言切换器)'),
(N'yj_user',         N'用户表(登录名/口令哈希/姓名/部门dept_id/角色role_id/管理员标志is_admin)'),
(N'yj_role',         N'角色表(角色编码/名称/is_admin)'),
(N'yj_role_panel',   N'角色-面板授权表(perms动作词表含view等,can_approve=审批权)'),
(N'yj_dept',         N'部门表(多级,parentId)'),
(N'yj_doc_status',   N'单据状态表(shr审核/canceled作废/stopped中止/pending审批中/archived归档/modify_state修改态)'),
(N'yj_doc_modify_log', N'归档单修改记录(修改前后差异快照与审批链)'),
(N'yj_form_approval', N'审批流记录(提交/通过/驳回留痕)'),
(N'yj_usage_log',    N'使用日志(登录与面板操作留痕,使用权限查看页面数据源)'),
(N'yj_lot_seq',      N'批号流水表(批号=yyyymmdd+3位流水,材料/产品批号统一取号)'),
(N'yj_message',      N'站内消息表(收件人/消息码/关联面板与单据/已读)'),
(N'yj_attachment',   N'单据附件表(panel_code+doc_no+field_key定位,文件名/存储名/大小/类型)'),
(N'yj_plan_term',    N'计划条款表(阶段中止/恢复申请:stage/reason/state)'),
(N'yj_std_lib',      N'标准库(lib_code+item_code 内容片段,供文书面板引用)'),
(N'yj_schema_log',   N'数据库结构脚本执行日志(script_name+content_hash 幂等记录)'),
-- ── 业务支撑 ──
(N'form_flow_link',        N'单据流链接表(上游生单→下游单据占用,link_status=ACTIVE|RELEASED)'),
(N'report_column_settings', N'报表列设置(用户自定义列布局,按panel_code存JSON)'),
(N'qr_batch_registry',     N'二维码批号登记表(批号=日期+流水取号留痕)'),
(N'erp_imp_log',           N'ERP导入日志(金蝶星辰数据导入批次)'),
(N'erp_imp_row',           N'ERP导入行明细(逐行导入结果)'),
-- ── 基础档案 bs_* ──
(N'bs_inv',        N'存货档案(物料/产品主数据,含是否检验标志)'),
(N'bs_bom',        N'物料清单BOM(父件-子件-定额数量,默认BOM标志)'),
(N'bs_wh',         N'仓库档案(仓库编码/名称,库存台账仓库真源)'),
(N'bs_uom',        N'计量单位档案'),
(N'bs_inv_price',  N'存货价格本'),
(N'bs_dept',       N'部门档案(遗留,组织架构用yj_dept)'),
(N'bs_emp',        N'员工档案(遗留,组织架构用yj_user)'),
(N'bs_dict',       N'数据字典'),
(N'bs_equip',      N'设备档案(设备点检/保养计划参照源)'),
(N'bs_op',         N'工序档案(五道工序:混料/成型/切炭/组装/装箱)'),
(N'bs_partner',    N'往来单位档案'),
(N'bs_proj',       N'项目档案'),
(N'bs_region',     N'地区档案'),
(N'bs_qc_item',    N'检验项目档案(检验内容/标准/判定规则)'),
(N'bs_qc_plan',    N'检验方案(适用存货/检验方式/抽检比例)'),
(N'bs_reject',     N'不合格原因档案'),
(N'bs_route',      N'工艺路线(工序顺序/加工方式)'),
(N'bs_team',       N'班组档案'),
(N'bs_wc',         N'工作中心档案'),
-- ── 采购/销售/库存单据(bd_=头表,bl_=行表) ──
(N'bd_pu_req',   N'请购单头表'),
(N'bl_pu_req',   N'请购单行表'),
(N'bd_pu_order', N'采购订单头表'),
(N'bl_pu_order', N'采购订单行表'),
(N'bd_purchase_in', N'采购入库单头表(审核过账kucun入库)'),
(N'bl_purchase_in', N'采购入库单行表(批号三键入库)'),
(N'bd_sale_out', N'销售出库单头表(审核过账kucun出库)'),
(N'bl_sale_out', N'销售出库单行表(批号三键出库)'),
(N'bd_material_out', N'材料出库单(领料)头表'),
(N'bl_material_out', N'材料出库单(领料)行表(BOM展开生成)'),
(N'bd_finish_in', N'产成品入库单头表(切炭双出口直销自动生成并审核)'),
(N'bl_finish_in', N'产成品入库单行表(负数量=红字冲回)'),
(N'bd_other_in', N'其他入库单头表'),
(N'bl_other_in', N'其他入库单行表'),
(N'bd_other_out', N'其他出库单头表'),
(N'bl_other_out', N'其他出库单行表'),
(N'bd_outsource_in', N'委外入库单头表'),
(N'bl_outsource_in', N'委外入库单行表'),
(N'bd_outsource_issue', N'委外发料单头表'),
(N'bl_outsource_issue', N'委外发料单行表'),
(N'bd_outsource_order', N'委外加工单头表'),
(N'bl_outsource_order', N'委外加工单行表'),
(N'bd_manu_order', N'生产加工单头表(经典遗留面板)'),
(N'bl_manu_order', N'生产加工单行表(经典遗留面板)'),
(N'bd_dispatch', N'工序派工单头表(经典遗留面板)'),
(N'bl_dispatch', N'工序派工单行表(经典遗留面板)'),
(N'bd_so_order', N'销售订单头表(星辰ERP同步)'),
(N'bl_so_order', N'销售订单行表(星辰ERP同步)'),
(N'bd_account', N'会计科目档案'),
(N'bd_expense_type', N'费用类别档案'),
(N'bd_tax_type', N'税别档案'),
-- ── 品质 ──
(N'qc_recv',         N'送料暂收单头表(收货自动生成批号)'),
(N'qc_recv_detail',  N'送料暂收单行表'),
(N'qc_insp',         N'来料检验单头表(合格/不合格拆行处置)'),
(N'qc_insp_detail',  N'来料检验单行表(处置方式:入库/退货)'),
(N'qc_return',       N'暂收退回单头表'),
(N'qc_return_detail', N'暂收退回单行表'),
(N'qc_op',           N'工序质检单头表(制程检验,首件/巡检语义)'),
(N'qc_op_detail',    N'工序质检单行表(检验项目/标准/实测值)'),
(N'qc_disposal',     N'不良品处理单(转隔离仓/报废,审核即移仓过账)'),
(N'qc_record',       N'检验记录单头表(八类合一:首件/烧结制程/脱模/来料/材料进厂/黑水/巡线/管控点)'),
(N'qc_record_detail', N'检验记录单行表(检验项目/标准要求/结果/品序号)'),
-- ── 生产 ──
(N'wo_order',      N'生产工单(五工序计划预填,产品批号取号)'),
(N'wo_progress',   N'工单工序进度(报工审核按工序累计完成数量)'),
(N'wo_report',     N'工序报工单(切炭行支持直销数量双出口)'),
(N'wo_stage_report', N'工序报工记录(PR系列,已下架)'),
(N'wo_line_stock', N'线边库存(PR系列,已下架)'),
(N'wo_material_pick', N'工序领料记录(PR系列,已下架)'),
(N'day_report',         N'生产日报表头表(自制物料/成型/切炭/组装四车间合一)'),
(N'day_report_detail',  N'生产日报表行表(姓名/时间/产品/数量/报废等)'),
(N'feed_confirm',       N'投料确认单头表(阶段:溶解/合成/A液/B液/浆体)'),
(N'feed_confirm_detail', N'投料确认单行表(投料成分/理论/实际)'),
(N'mix_record',         N'物料混合记录头表(四次混合行式化)'),
(N'mix_record_detail',  N'物料混合记录行表(混合次序/物料批次/重量)'),
(N'gran_record',        N'造粒记录头表(温湿度/PE/纯水/捏合吹扫/水分)'),
(N'gran_record_detail', N'造粒记录占位行表(恒空,doc模式要求)'),
(N'wh_record',          N'无黑处理登记头表(加湿前后重量/无黑时间)'),
(N'wh_record_detail',   N'无黑处理登记占位行表(恒空,doc模式要求)'),
(N'pack_confirm',       N'封箱确认头表(装箱人/确认人/主管签名)'),
(N'pack_confirm_detail', N'封箱确认占位行表(恒空,doc模式要求)'),
(N'equip_check',        N'设备点检记录头表'),
(N'equip_check_detail', N'设备点检记录行表(检查内容/方法/标准/结果/解决措施)'),
(N'maint_plan',         N'保养计划头表'),
(N'maint_plan_detail',  N'保养计划行表(设备/保养项目/周期/情况)'),
(N'sample_req',         N'样品申请单头表(录入/审核/执行三级)'),
(N'sample_req_detail',  N'样品申请单行表(样品种类/规格/打样背景/交期)'),
(N'rod_return',         N'炭棒不良退货登记头表'),
(N'rod_return_detail',  N'炭棒不良退货登记占位行表(恒空,doc模式要求)'),
-- ── PR系列(按工序拆分面板,已下架,数据保留) ──
(N'pr_mix_confirm', N'投料确认表(PR系列,已下架)'),
(N'pr_mix_process', N'阻垢工序控制(PR系列,已下架)'),
(N'pr_mix_feed',    N'阻垢投料单(PR系列,已下架)'),
(N'pr_mix_granule', N'造粒过程控制(PR系列,已下架)'),
(N'pr_mix_blend',   N'物料混合记录(PR系列,已下架)'),
(N'pr_mix_check',   N'设备点检表(PR系列,已下架)'),
(N'pr_mix_daily',   N'混料日报表(PR系列,已下架)'),
(N'pr_form_first',  N'成型首件记录(PR系列,已下架)'),
(N'pr_form_daily',  N'成型日报表(PR系列,已下架)'),
(N'pr_cut_daily',   N'切炭日报表(PR系列,已下架)'),
(N'pr_sinter_qc',   N'烧结制程检验(PR系列,已下架)'),
(N'pr_demold_qc',   N'脱模检验记录(PR系列,已下架)'),
(N'pr_efficiency',  N'人均效率表(PR系列,已下架)'),
(N'pr_asm_incoming', N'组装来料检查(PR系列,已下架)'),
(N'pr_asm_return',  N'不良退货记录(PR系列,已下架)'),
(N'pr_asm_daily',   N'组装日报表(PR系列,已下架)'),
(N'pr_mat_inspect', N'材料进厂检查(PR系列,已下架)'),
(N'pr_no_black',    N'无黑处理登记(PR系列,已下架)'),
(N'pr_black_test',  N'黑水测试记录(PR系列,已下架)'),
(N'pr_patrol_qc',   N'巡线抽检记录(PR系列,已下架)'),
(N'pr_pack_confirm', N'封箱数量确认(PR系列,已下架)'),
(N'pr_maintenance', N'预防性保养计划(PR系列,已下架)'),
(N'pr_flow_card',   N'产品流动标识卡(PR系列,已下架)'),
(N'pr_scrap',       N'物料产品报废单(PR系列,已下架)'),
(N'pr_qc_control',  N'品质管控点要求(PR系列,已下架)'),
-- ── 研发 rd_* ──
(N'rd_approval',        N'立项申请表(文件类,管理员保存即归档)'),
(N'rd_approval_detail', N'立项申请表占位行表(恒空,doc模式要求)'),
(N'rd_plan',            N'项目实施计划(10阶段×五字段:计划内容/计划开始/计划完成/实际完成/责任人,项目定级必填下拉)'),
(N'rd_plan_detail',     N'项目实施计划占位行表(恒空,doc模式要求)'),
(N'rd_progress',        N'项目进度查询头表'),
(N'rd_progress_detail', N'项目进度查询行表(实施计划阶段完成自动同步状态/里程完成/项目负责)'),
(N'rd_prod_info_head',  N'产品信息表头表(归档后产品开发下发5个下游文件)'),
(N'rd_prod_info_detail', N'产品信息表行表'),
(N'rd_product_info',    N'产品信息(旧单表,已被rd_prod_info_head/detail取代)'),
(N'rd_spec_doc_head',   N'规格书头表(按规格书种类页签)'),
(N'rd_spec_doc_detail', N'规格书行表'),
(N'rd_spec_assign',     N'规格书分派(产品编号+种类→责任人)'),
(N'rd_dev_task',        N'研发任务下发记录(产品开发按钮分发留痕)'),
(N'rd_insp_plan_head',  N'出货检验计划表头表'),
(N'rd_insp_plan_detail', N'出货检验计划表行表'),
(N'rd_mold_formula',    N'成型配方(旧单表)'),
(N'rd_mold_formula_head', N'成型配方头表'),
(N'rd_mold_formula_detail', N'成型配方行表'),
(N'rd_mold_proc_head',  N'成型工艺清单头表'),
(N'rd_mold_proc_detail', N'成型工艺清单行表'),
(N'rd_asm_bom',         N'组装BOM表(旧单表)'),
(N'rd_asm_bom_head',    N'组装BOM表头表'),
(N'rd_asm_bom_detail',  N'组装BOM表行表'),
(N'rd_asm_proc_head',   N'组装工艺清单头表'),
(N'rd_asm_proc_detail', N'组装工艺清单行表'),
(N'rd_dom_test_head',   N'内部委托测试申请单头表'),
(N'rd_dom_test_detail', N'内部委托测试申请单行表'),
(N'rd_equip_use_head',  N'设备使用登记表头表'),
(N'rd_equip_use_detail', N'设备使用登记表行表'),
(N'rd_instr_use_head',  N'仪器使用记录表头表'),
(N'rd_instr_use_detail', N'仪器使用记录表行表'),
(N'rd_spike_water_head', N'加标水配置记录表头表'),
(N'rd_spike_water_detail', N'加标水配置记录表行表'),
(N'rd_filter_eff',      N'功能性滤效(旧单表)'),
(N'rd_filter_eff_head', N'功能性滤效头表'),
(N'rd_filter_eff_detail', N'功能性滤效行表'),
(N'rd_alkaline',        N'碱性测试(旧单表)'),
(N'rd_alkaline_head',   N'碱性测试头表'),
(N'rd_alkaline_detail', N'碱性测试行表'),
(N'rd_antibact',        N'抑菌测试(旧单表)'),
(N'rd_antibact_head',   N'抑菌测试头表'),
(N'rd_antibact_detail', N'抑菌测试行表'),
(N'rd_mineral',         N'矿化测试(旧单表)'),
(N'rd_mineral_head',    N'矿化测试头表'),
(N'rd_mineral_detail',  N'矿化测试行表'),
(N'rd_scale',           N'阻垢性能测试(旧单表)'),
(N'rd_scale_head',      N'阻垢性能测试头表'),
(N'rd_scale_detail',    N'阻垢性能测试行表'),
(N'rd_ro_protect',      N'RO保护测试(旧单表)'),
(N'rd_ro_protect_head', N'RO保护测试头表'),
(N'rd_ro_protect_detail', N'RO保护测试行表'),
(N'rd_soak',            N'浸泡安全测试(旧单表)'),
(N'rd_soak_head',       N'浸泡安全测试头表'),
(N'rd_soak_detail',     N'浸泡安全测试行表'),
(N'rd_drop_prec',       N'压降精度测试(旧单表)'),
(N'rd_drop_prec_head',  N'压降精度测试头表'),
(N'rd_drop_prec_detail', N'压降精度测试行表'),
(N'rd_asm_proc',        N'组装工艺清单(旧单表)'),
(N'rd_dom_test',        N'内部委托测试申请单(旧单表)'),
(N'rd_equip_use',       N'设备使用登记表(旧单表)'),
(N'rd_insp_plan',       N'出货检验计划表(旧单表)'),
(N'rd_instr_use',       N'仪器使用记录表(旧单表)'),
(N'rd_mold_proc',       N'成型工艺清单(旧单表)'),
(N'rd_spec_doc',        N'规格书(旧单表)'),
(N'rd_spike_water',     N'加标水配置记录表(旧单表)'),
(N'ysfk',               N'收付款(遗留)'),
-- ── 遗留缺注表(谨慎通用描述) ──
(N'dm_wzsx',    N'物料属性(遗留)'),
(N'dm_py',      N'拼音码(遗留)'),
(N'xsdh',       N'销售订货(遗留)'),
(N'users',      N'用户(遗留,已被yj_user取代)'),
(N's_SelWhere', N'查询条件设置(遗留)'),
(N't1',         N'临时表(可清理)'),
(N't2',         N'临时表(可清理)');

DECLARE @t sysname, @d nvarchar(400), @exists int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, descr FROM #tabdesc;
OPEN cur; FETCH NEXT FROM cur INTO @t, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@t) IS NOT NULL
  BEGIN
    SELECT @exists = COUNT(*) FROM sys.extended_properties
      WHERE major_id = OBJECT_ID(@t) AND minor_id = 0 AND name = 'MS_Description';
    IF @exists = 0
      EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t;
    -- 已有注释的表不覆盖(保护既有描述)
  END
  FETCH NEXT FROM cur INTO @t, @d;
END
CLOSE cur; DEALLOCATE cur;
GO
-- 备份/改名残留统一标记(仅对无注释的生效)
DECLARE @t sysname;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT name FROM sys.tables
  WHERE (name LIKE '%[_]bak[_]20260911%' OR name LIKE 'RENAME[_]20260911%')
    AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    WHERE ep.major_id = sys.tables.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description');
OPEN cur; FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  EXEC sp_addextendedproperty N'MS_Description', N'备份/改名残留(20260911 面板结构调整前备份,可清理)', N'SCHEMA', N'dbo', N'TABLE', @t;
  FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;
GO
-- 验证:注释覆盖统计
SELECT
  (SELECT COUNT(*) FROM sys.tables) AS 总表数,
  (SELECT COUNT(*) FROM sys.tables t JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description') AS 已注释表数;
GO
PRINT N'migrate-table-comments 完成';
GO
