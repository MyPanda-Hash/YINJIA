package com.yinjia.mes.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 按钮服务:对齐 light-mes PxService.callButton 的中文按钮分发与状态机。
 * - 保存/提交(空编号=新建单据,与 light-mes directAdd 语义一致)
 * - 审核/弃审(yj_doc_status 记录,不动旧表)
 * - 删除:单据=yj_doc_status.canceled='Y';档案行=旧行 asp_cancel='Y'(对齐旧系统软删)
 * 留痕约定:asp_user1/asp_time1=创建,asp_user2/asp_time2=最后修改(与旧数据一致)
 */
@Service
public class ButtonService {

    private static final Logger log = LoggerFactory.getLogger(ButtonService.class);

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final FormNoService formNoService;
    private final JdbcTemplate jdbc;
    private final DevTaskService devTaskService;
    private final MessageService messageService;
    private final LotSeqService lotSeqService;
    private final StockLedgerService stockLedger;
    private final WoReportService woReport;
    private final QcDisposalService qcDisposal;
    private final KingdeePushService kingdeePush;
    private final BatchService batchService;
    private final InvCostService invCost;
    /** 检验目录联动(生单建行/完成/修改/守卫);本服务只单向依赖它,避免循环依赖 */
    private final QcCatalogService qcCatalog;

    public ButtonService(PanelRegistry registry, QueryService queryService,
                         FormNoService formNoService, JdbcTemplate jdbc,
                         DevTaskService devTaskService, MessageService messageService,
                         LotSeqService lotSeqService, StockLedgerService stockLedger,
                         WoReportService woReport, QcDisposalService qcDisposal,
                         KingdeePushService kingdeePush, BatchService batchService,
                         InvCostService invCost, QcCatalogService qcCatalog) {
        this.registry = registry;
        this.queryService = queryService;
        this.formNoService = formNoService;
        this.jdbc = jdbc;
        this.devTaskService = devTaskService;
        this.messageService = messageService;
        this.lotSeqService = lotSeqService;
        this.stockLedger = stockLedger;
        this.woReport = woReport;
        this.qcDisposal = qcDisposal;
        this.kingdeePush = kingdeePush;
        this.batchService = batchService;
        this.invCost = invCost;
        this.qcCatalog = qcCatalog;
    }

    /** 发送业务事件消息(失败不影响业务操作) */
    private void notify(java.util.function.Supplier<Integer> action) {
        try {
            action.get();
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(ButtonService.class)
                    .warn("business message send failed: {}", e.getMessage());
        }
    }

    @Transactional
    public Map<String, Object> callButton(String panelCode, String buttonName,
                                          Map<String, Object> formData, Map<String, Object> buttonParam) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        return switch (buttonName == null ? "" : buttonName) {
            case "刷新" -> new HashMap<>();
            case "保存", "提交", "保存新增" -> save(def, formData == null ? new HashMap<>() : formData, true);
            case "保存为草稿" -> save(def, formData == null ? new HashMap<>() : formData, false);
            case "新增流程", "新增" -> save(def, formData == null ? new HashMap<>() : formData, false);
            case "审核" -> audit(def, formData);
            case "弃审" -> unaudit(def, formData);
            // 审批流(照搬 light-mes:草稿→提交审批→审批中→通过/驳回;弃审全留痕)
            case "提交审批" -> submitApproval(def, formData);
            case "审批通过" -> approveApproval(def, formData);
            case "审批驳回" -> rejectApproval(def, formData);
            case "审批情况" -> approvalHistory(def, formData);
            // 整单中止/中止执行(前端 engine.callButton 已归一为「中止」)、草稿(归一为「取消中止」)
            case "中止" -> stop(def, formData);
            case "取消中止" -> unstop(def, formData);
            case "删除", "删除单据" -> DOC_ARCHIVE_PANELS.contains(def.code()) ? deleteDocFile(def, formData) : delete(def, formData);
            // 文件类面板:归档单据删除申请的管理员审批
            case "删除审批通过" -> approveDelete(def, formData);
            case "删除审批驳回" -> rejectDelete(def, formData);
            // 文件类面板:归档后申请修改(管理员审批进入修改态,再审批归档+修改记录全量留痕)
            case "申请修改" -> modifyRequest(def, formData);
            // 产品变更申请单:会签子流程(发起人勾「需会签」+选会签人 → 全部通过才进审核,2026-09-21)
            case "提交会签" -> submitSignoff(def, formData);
            case "会签通过" -> signoffApprove(def, formData);
            case "会签驳回" -> signoffReject(def, formData);
            case "撤回会签" -> signoffWithdraw(def, formData);
            // 立项申请:审核通过(已审核/已归档)后由审核人给项目定级(2026-09-21 用户口径)——
            // 等级是后续立项(实施计划)与进度流程的属性,按参照自动带给下游 项目定级
            case "项目定级" -> gradeProject(def, formData);
            // 产品信息表:归档后由二级审核人把四个下游文件的**责任人**分发下去(2026-09-20;
            // 原名「产品开发」= 只写任务行不带分工,保留兼容)
            case "产品开发", "分发责任人" -> dispatchDev(def, formData);
            // 产品信息表:总负责人把规格书按种类分发责任人并建草稿单(2026-09-12 两级分发)
            case "规格书分发" -> specAssign(def, formData);
            case "修改审批通过" -> modifyApprove(def, formData);
            case "修改审批驳回" -> modifyReject(def, formData);
            // 修改记录:文书面板=归档后申请修改/审批/再归档的闭环留痕;档案式面板(如 QC_INSP_REQ
            // 来料检验要求)没有该闭环,取存档留痕表(每次保存一条:行增删改摘要 + 字段级变化)
            case "修改记录" -> def.isDoc() ? modifyHistory(def, formData) : archiveChangeHistory(def);
            // 卡死单据出口(2026-09-11):删除/修改申请提交后无人审批,发起人或审批人可撤回
            case "撤回删除申请" -> withdrawDeleteRequest(def, formData);
            case "撤回修改申请" -> withdrawModifyRequest(def, formData);
            // 库存状况:新增库存(存货/仓库按编码校验基础档案,期初现存量+预警数量)
            case "新增库存" -> addStock(def, formData);
            // 库存状况:修改预警数量(行内编辑,空值回退全局阈值100)
            case "更新预警数量" -> updateStockWarn(def, formData);
            // 转ERP:已审核+未转过的采购入库/销售出库 → 推送金蝶星辰(账套由 kingdee.push.* 凭证决定),回写ERP单号
            case "转ERP" -> pushToErp(def, formData);
            // 批量转ERP:查询所有已审核+未转的单据列表(前端弹窗勾选后逐张调 转ERP)
            case "查询可转ERP" -> listPushableErp(def);
            // 报表弹窗联动选项(台账/库存状况):仓库/存货互相约束(选项=对应视图真实组合)
            case "台账联动选项" -> ledgerRefOptions(def, formData);
            // 库存报表「重算成本」:全量重算移动加权成本物化表(审核钩子之外的兜底,如同步/导入旁路写入)
            case "重算成本" -> recalcInvCost(def);
            // 生产工单:成型后生成产品批号(打印产品二维码的数据源,一次生成终身复用)
            case "生成产品批号" -> genProductLot(def, formData);
            // 项目实施计划:阶段完成按钮(填写实际完成时间)
            case "阶段完成" -> completeStage(def, formData);
            // 项目实施计划:申请终止(阶段处)二级审批——立项人 → 管理员 → 落实终止(2026-09-11)
            case "申请终止" -> termRequest(def, formData);
            case "终止审批通过" -> termApprove(def, formData);
            case "终止审批驳回" -> termReject(def, formData);
            case "撤回终止申请" -> termWithdraw(def, formData);
            // 项目进度查询:把全部实施计划实时导入唯一那张进度单(幂等,手动触发用)
            case "同步进度" -> syncAllPlansToProgress();
            // ── 检验目录(QC_CATALOG,2026-09-22 用户口径)─────────────────────────────
            // 完成:校验关联的检验单与检验数据记录都已审批 → 置「已完成检验」并给出是否合格
            case "完成" -> completeCatalogRow(def, formData, buttonParam);
            // 修改:把「已完成检验」回弹为「正在检验中」并写修改记录(之后才可反审核挂靠单据)
            case "修改" -> reopenCatalogRow(def, formData);
            // 删除记录(行级):挂靠的检验单/检验数据记录还在时拒绝,提示先删除它们
            case "删除记录" -> deleteCatalogRow(def, formData);
            default -> throw new IllegalStateException("未定义按钮规则：" + buttonName + "（可在 ButtonService 扩展）");
        };
    }

    // ============ 检验目录联动(QC_CATALOG,2026-09-22 用户口径) ============

    /** 目录行 id:纸面行按钮放在 formData.id,也兼容 buttonParam.id */
    private Long catalogRowId(Map<String, Object> formData, Map<String, Object> buttonParam) {
        Object v = formData == null ? null : formData.get("id");
        if (v == null && buttonParam != null) v = buttonParam.get("id");
        if (v == null) throw new IllegalArgumentException("缺少检验目录行 id");
        return v instanceof Number n ? n.longValue() : Long.valueOf(String.valueOf(v));
    }

    private String docNoOf(Map<String, Object> formData) {
        if (formData == null) return "";
        Object v = formData.get("编号") != null ? formData.get("编号") : formData.get("单据编号");
        return v == null ? "" : String.valueOf(v);
    }

    /**
     * 目录行「完成」:校验关联检验单已审核 + 检验数据记录已归档/已审核 → 置「已完成检验」并给出是否合格。
     * 挂靠单据状态用与生单/审核同一状态机推导(docStatusOf),服务层不另立口径。
     */
    private Map<String, Object> completeCatalogRow(PanelRegistry.PanelDef def, Map<String, Object> formData,
                                                   Map<String, Object> buttonParam) {
        if (!QcCatalogService.CATALOG_PANEL.equals(def.code())) throw new IllegalStateException("该按钮仅检验目录可用");
        Long id = catalogRowId(formData, buttonParam);
        Map<String, Object> row = jdbc.queryForMap("SELECT 检验单号, 检验数据记录单号 FROM qc_catalog_detail WHERE id=?", id);
        String inspNo = row.get("检验单号") == null ? "" : String.valueOf(row.get("检验单号"));
        String recNo = row.get("检验数据记录单号") == null ? "" : String.valueOf(row.get("检验数据记录单号"));
        String inspStatus = inspNo.isBlank() ? "无关联检验单" : String.valueOf(docStatusOf(QcCatalogService.INSP_PANEL, inspNo).get("status"));
        String recStatus = recNo.isBlank() ? "无关联检验数据记录" : String.valueOf(docStatusOf(QcCatalogService.REC_PANEL, recNo).get("status"));
        String qualified = formData == null || formData.get("是否合格") == null ? "" : String.valueOf(formData.get("是否合格"));
        return qcCatalog.completeRow(id, inspStatus, recStatus, qualified, currentUserName());
    }

    /** 目录行「修改」:已完成 → 正在检验中(回弹)+ 写修改记录 */
    private Map<String, Object> reopenCatalogRow(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!QcCatalogService.CATALOG_PANEL.equals(def.code())) throw new IllegalStateException("该按钮仅检验目录可用");
        return qcCatalog.reopenRow(docNoOf(formData), catalogRowId(formData, null), currentUserName());
    }

    /** 目录行「删除记录」:挂靠单据还在时拒绝(提示先删除),否则软删该行 */
    private Map<String, Object> deleteCatalogRow(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!QcCatalogService.CATALOG_PANEL.equals(def.code())) throw new IllegalStateException("该按钮仅检验目录可用");
        Long id = catalogRowId(formData, null);
        int n = qcCatalog.deleteRow(id, currentUserName());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("删除行数", n);
        return out;
    }

    // ============ 保存 ============

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> save(PanelRegistry.PanelDef def, Map<String, Object> formData, boolean markSaved) {
        String user = currentUserName();
        Map<String, Object> body = new LinkedHashMap<>(formData == null ? Map.of() : formData);
        Object detailObj = body.remove("detail");
        Object noObj = body.remove("编号");
        body.remove("单据状态");
        body.remove("创建时间");
        body.remove("更新时间");
        body.remove("审核人");
        body.remove("审核时间");
        Map<String, Object> detail = detailObj instanceof Map<?, ?> m ? new LinkedHashMap<>((Map<String, Object>) m) : new HashMap<>();
        // 明细键 = 面板 detail.tabs[].key(基础档案为业务键,单据为 items);兜底取首个数组值
        List<Map<String, Object>> items = detail.get(def.tabKey()) instanceof List<?> tabRows
                ? new ArrayList<>((List<Map<String, Object>>) tabRows)
                : detail.get("items") instanceof List<?> l
                ? new ArrayList<>((List<Map<String, Object>>) l) : new ArrayList<>();
        if (items.isEmpty() && detail.values().stream().findFirst().map(v -> v instanceof List).orElse(false)) {
            items = new ArrayList<>((List<Map<String, Object>>) detail.values().iterator().next());
        }

        // 计划层:生产工单无工序行时预填全部启用工序(bs_op 顺序),计划数量=订单数量
        // (五道工序共用一张工单;成型计划数量可在头上按"1切几"折算另填)
        if ("WO_ORDER".equals(def.code()) && !items.isEmpty()) {
            boolean hasOp = items.stream().anyMatch(it -> it.get("工序") != null && !String.valueOf(it.get("工序")).isBlank());
            if (!hasOp) {
                Object orderQty = body.get("订单数量");
                double plan = orderQty == null ? 0 : Double.parseDouble(String.valueOf(orderQty));
                List<String> ops = jdbc.queryForList(
                        "SELECT 工序名称 FROM bs_op WHERE ISNULL([状态], N'启用') = N'启用' AND ISNULL(是否停用, 0) = 0 ORDER BY id", String.class);
                items.clear();
                for (String op : ops) {
                    Map<String, Object> row = new java.util.LinkedHashMap<>();
                    row.put("工序", op);
                    row.put("计划数量", plan);
                    row.put("完成数量", 0);
                    items.add(row);
                }
            }
        }

        String no = noObj == null || String.valueOf(noObj).isBlank() ? null : String.valueOf(noObj);
        if (def.isDoc()) {
            return saveDoc(def, body, items, no, user, markSaved);
        }
        return saveArchive(def, items, user);
    }

    /** 单据保存:头字段并入每行(单表式)或分别写头表/行表(头行式);无编号=新建 */
    private Map<String, Object> saveDoc(PanelRegistry.PanelDef def, Map<String, Object> head,
                                        List<Map<String, Object>> items, String no, String user, boolean markSaved) {
        boolean split = def.hasHeadTable();
        if (no == null) {
            if (items.isEmpty()) {
                // directAdd 语义:空表单 -> 建一张空白草稿单(头行式写头表,单表式写一行占位行)
                no = formNoService.next(def.prefix(), user);
                String table = split ? def.headTable() : def.lineTable();
                Map<String, Object> cols = new LinkedHashMap<>();
                cols.put(def.groupCol(), no);
                if (def.dateCol() != null && tableCols(table).contains(def.dateCol())) cols.put(def.dateCol(), LocalDate.now());
                if (!split && def.codeCol() != null) cols.put(def.codeCol(), no);
                // 空草稿也写入随表单提交的头字段(如 规格书种类):
                // 规格书按类型页签过滤列表,不带分类的新单会从当前页签列表消失,导致"新增后无法填写"
                for (Map.Entry<String, Object> e : labelsToCols(def.fieldsAt("header"), head).entrySet()) {
                    if (!e.getKey().equals(def.groupCol())) cols.put(e.getKey(), e.getValue());
                }
                // 空白草稿同口径:存在"创建时间"列即填入(新建时刻)
                if (tableCols(table).contains("创建时间")) cols.put("创建时间", LocalDateTime.now().format(TS_FMT));
                clearStaleDocStatus(def, no);
                insertRow(table, cols, user);
                // 产品变更申请单:建单即铺部门评审行(照 YJ-QR-130 纸面 7 个部门)
                if (CHANGE_PANEL.equals(def.code())) ensureChangeDeptRows(def, no, user);
                // 四个受控文件的编辑门禁在**空草稿分支也要过**(2026-09-21 全流程走查发现的门禁洞):
                // 该分支原来直接 return,于是"带产品编号 + 不带明细"的一次调用就能给**别人负责的已分发
                // 产品**建出一张空白草稿(实测品质部账号建成 MP-xxxx)。UI 的「新增」不带产品编号,
                // 正常建单不受影响;带产品编号建单=替别人开单,本就该拦。
                if (DevTaskService.devPanelCodes().contains(def.code())) ensureDevFileEditable(def, no, head, user);
                // directAdd 占位草稿:未保存过 -> saved='N'(前端 isFreshAddedDoc 依赖本标记界定"本次新增"窗口)
                markDocSaved(def.code(), no, markSaved);
                return result(no, "草稿");
            }
            no = formNoService.next(def.prefix(), user);
            clearStaleDocStatus(def, no);
            // 存在"创建时间"字段的单据新建时自动填入当前时间(金蝶同步单据字段,nvarchar 字符串口径;
            // save() 已剥离前端传入值,此处是唯一填入点;修改已有单不覆盖)
            if (def.byLabel("创建时间") != null && head.get("创建时间") == null) {
                head.put("创建时间", LocalDateTime.now().format(TS_FMT));
            }
        }
        // 规格书两级分发封锁(2026-09-12):①防绕过——载荷编号命中的是已下发产品(而非已有单据)
        // 时要求总负责人/admin(手动以产品码建单的唯一向量);②分配单仅 责任人∪总负责人∪管理员 可保存。
        // 空白 directAdd 草稿在上方分支已 return,不经此处。
        if ("RD_SPEC_DOC".equals(def.code())) {
            ensureSpecCreateAllowed(def, no, user);
            ensureSpecAssignEditable(def, no, user);
        }
        // 四个下游文件的编辑门禁(2026-09-20):未分发禁编 / 分发后只放该文件责任人 ∪ 管理员。
        // 产品编号为空的历史单在门禁里豁免(否则既有单据被锁死);head 传进来是为了拦住
        // "本次保存才第一次填上产品编号"这一档(库里此时还是 NULL)。
        if (DevTaskService.devPanelCodes().contains(def.code())) ensureDevFileEditable(def, no, head, user);
        // 已审核/审批中/已中止单据不允许保存(照搬 light-mes:仅草稿可改);终止审批中/已终止同样锁定
        Map<String, Object> st = docStatusOf(def.code(), no);
        String stStatus = String.valueOf(st.get("status"));
        if ("已审核".equals(stStatus)) throw new IllegalStateException("已审核单据不可保存，请先弃审");
        if ("审批中".equals(stStatus)) throw new IllegalStateException("审批中单据不可保存，请等待审批完成或驳回");
        if ("待二级审批".equals(stStatus)) throw new IllegalStateException("待二级审批单据不可保存，请等待二级审批完成或驳回");
        if ("已中止".equals(stStatus)) throw new IllegalStateException("已中止单据不可保存，请先恢复");
        if ("已终止".equals(stStatus)) throw new IllegalStateException("已终止单据不可保存");
        // 产品变更申请单(2026-09-21):已生效=终态(要改只能再开一张变更单);会签中锁编辑(免得签的和改的不是一版)
        if ("已生效".equals(stStatus)) throw new IllegalStateException("已生效单据不可保存，如需再次变更请另开一张变更申请单");
        if ("会签中".equals(stStatus)) throw new IllegalStateException("会签中单据不可保存，请等会签完成或由发起人撤回会签");
        if (stStatus.startsWith("终止审批中")) throw new IllegalStateException("终止审批中单据不可保存，请等待审批完成或撤回");
        // 在途申请期间锁定(2026-09-12):删除/修改申请待审批时单据不可保存——此前只拦审批中,
        // 申请期间仍可改数据:改动落在修改快照之后 diff 失真,极端时序还会造出无人能解的死状态
        // (修改申请中保存写入 pending='Y' → 批修改后 pending 残留 → 状态显示审批中,
        //  提交审批/审批通过双双被拒,撤回/弃审也够不着)
        if ("删除申请中".equals(stStatus)) throw new IllegalStateException("删除申请审批期间不可保存，请等待审批完成或撤回申请");
        if ("修改申请中".equals(stStatus)) throw new IllegalStateException("修改申请审批期间不可保存，请等待审批完成或撤回申请");
        // 来料检验单数量守恒:每行 合格数量+不良数量 ≤ 数量(送检数量),超限拒绝保存
        if ("QC_INSP".equals(def.code())) validateInspQty(items);
        // 样品编号表:样品编号 = 客户项目代号 + 项目编号(确定性拼接),同面板内不允许重复
        if ("RD_SAMPLE_NO".equals(def.code())) ensureSampleNoUnique(no, items);
        // 必填校验(2026-09-20):仅「保存/提交」路径(markSaved=true)执行;
        // 「保存为草稿」「新增」放行 —— 用户口径:草稿不做必填限制,提交审批才做。
        // 补这层的理由:此前必填**只在前端校验**,直连 /px/callButton 就能把缺必填的单提交/归档
        // (实测:文档编号/测试主题为空仍可保存并归档)。前端仍保留校验(即时提示+定位字段),两层各司其职。
        if (markSaved) {
            ensureRequiredFilled(def, head, no);
            // 明细行必填(2026-09-20):表头之外还有明细级必填(如 RD_SAMPLE_NO 的
            // 客户项目代号/样品编号/项目编号全在明细),只查表头等于这些面板没校验。
            ensureDetailRequiredFilled(def, items);
        }

        Map<String, String> l2c = def.labelToCol();
        // 规格书修改态:落库前留「4.产品性能检验项目及检验标准」页旧值快照(表区=检验要求),
        // 保存后比对——变了就通知关联出货检验计划表核对(编号=产品编号,2026-09-11 用户口径)
        List<String> specTestOld = "RD_SPEC_DOC".equals(def.code()) && no != null
                && "Y".equals(modifyStateOf(def.code(), no)) ? specTestRowsSnapshot(no) : null;
        // 产品变更申请单:先保 7 个部门行在册,再按"部门↔账号"过一遍按格门禁(非本部门一律还原)
        if (CHANGE_PANEL.equals(def.code())) {
            ensureChangeDeptRows(def, no, user);
            gateChangeDetail(def, items, no, user);
        }
        if (split) {
            upsertHeadRow(def, head, no, user);
            upsertLineRows(def, items, no, l2c, user);
        } else {
            // 单表式:头字段并入每行
            for (Map<String, Object> item : items) {
                Map<String, Object> merged = new LinkedHashMap<>(head);
                merged.putAll(item);
                item.putAll(merged);
            }
            upsertLineRows(def, items, no, l2c, user);
        }
        // 主保存路径落库成功才写 saved:markSaved=true「保存/提交/保存新增」,false「保存为草稿/新增」。
        // saved='Y' 只表示"这张单存过一次"(不表示已审核),前端 isFreshAddedDoc() 用 'N' 界定"本次新增"窗口。
        markDocSaved(def.code(), no, markSaved);
        // 文件类面板:管理员「保存」即归档;普通用户「保存」即提交审批(管理员审批通过后归档);
        // 「保存为草稿/新增」不触发(markSaved=false,2026-09-12 修复:此前草稿路径同样被自动归档/送审,
        // 文书面板实际没有"存一半不送审"的能力);修改态保存不归档走再审批
        if (markSaved && DOC_ARCHIVE_PANELS.contains(def.code()) && !"Y".equals(modifyStateOf(def.code(), no))) {
            if (isAdminUser(user)) {
                finalizeOpenModify(def, no, user); // 有未收尾修改留痕(修改闭环/弃审后再编辑)先收尾再归档
                markArchived(def.code(), no, user);
                // 保存即归档 = 自审自批,显式留痕(2026-09-12:归档路径审核人不再空白,审批历史可查)
                recordApproval(def.code(), no, "SUBMIT", "PENDING", "");
                recordApproval(def.code(), no, "APPROVE", "APPROVED", "保存即归档（管理员保存）");
                // 保存即归档也要同步进度查询(用户报的"保存归档后没导进来"就是漏了这条路径)
                if ("RD_PLAN".equals(def.code())) syncAllPlansToProgress();
            } else {
                // 普通用户:保存→自动提交审批(pending='Y'),管理员审批通过后再归档
                jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                                + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                                + "WHEN MATCHED THEN UPDATE SET pending = 'Y', pending_by = ?, pending_at = GETDATE(), update_at = GETDATE() "
                                + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, pending, pending_by, pending_at, update_at) "
                                + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), GETDATE());",
                        def.code(), no, user, user);
                recordApproval(def.code(), no, "SUBMIT", "PENDING", "");
            }
        }
        // 文件类面板保存:实时刷新未收尾修改记录的 diff(修改中/弃审后再编辑,修改记录随时可见已改内容)
        if (DOC_ARCHIVE_PANELS.contains(def.code())) refreshModifyDiff(def, no);
        // 规格书修改态保存且检验项目及标准页发生变化 → 通知关联出货检验计划表(仅变更提醒,不做内容比对)
        if (specTestOld != null) notifyInspPlansOnSpecTestChange(no, specTestOld, user);
        // 送料暂收单(面板编码 QC_RECV,2026-09-20 由 SL_RECV 改):保存(含修改)后同步修改
        // 由它生成的来料检验单(共享字段镜像,见 syncInspFromSlRecv)
        if ("QC_RECV".equals(def.code())) syncInspFromSlRecv(no, user);

        // 文档编号唯一性(实施计划单号等):不允许与其他单据重复
        // 文档编号唯一性(实施计划单号等):不允许与其他单据重复。
        // 「保存为草稿」不校验(2026-09-20 用户口径):草稿=允许存一半,唯一性属于提交口径;
        // 两条草稿可以先占用同一个文档编号,谁先提交谁占住,后提交的那张在提交时被拒。
        if (markSaved && DOC_NO_PANELS.contains(def.code())) ensureDocNoUnique(def, head, no);
        return result(no, String.valueOf(docStatusOf(def.code(), no).get("status")));
    }

    /** 文档编号不允许重复:同面板其它单据占用即拒绝(空值跳过)。
     *  已作废单据不算占用(2026-09-11 口径):作废单仍留在业务表里(头行式单据作废只写
     *  yj_doc_status.canceled='Y',不软删业务行),不排除的话"作废掉再新建同号"永远撞唯一性。
     *  两侧都排:业务表软删标记 asp_cancel='Y'(表若无该列则跳过,故先查 sys.columns)+
     *  状态表 yj_doc_status.canceled='Y'。 */
    /**
     * 必填校验(2026-09-20):仅「保存/提交」路径调用;「保存为草稿」「新增」不调用。
     *
     * 用户口径:保存为草稿不做必填限制(允许存一半);保存/提交审批才做。
     * 为什么要在后端也做:此前必填**只在前端**(PanelxList.validateInlineDraft),
     * 直连 /px/controller callButton 就能把缺必填的单保存并归档(实测:文档编号/测试主题为空仍归档成功)。
     * 前端校验仍保留(即时提示 + 自动翻页定位字段),两层各司其职;此处是"绕过界面也拦得住"的兜底。
     *
     * 口径与前端保持一致:
     *   · 只看 place=header 的必填字段;
     *   · 跳过系统自动填写的字段(单据编号=autoCode、单据日期=当天默认、创建时间/编辑人/编辑日期);
     *   · 表单里**没带**该字段(前端局部提交)时回退查-库存值,避免误报"未填";
     *   · 字段有值但为空串也算未填。
     */
    private void ensureRequiredFilled(PanelRegistry.PanelDef def, Map<String, Object> head, String no) {
        List<PanelRegistry.FieldDef> required = def.fieldsAt("header").stream()
                .filter(PanelRegistry.FieldDef::required)
                .filter(f -> !REQUIRED_SYS_FIELDS.contains(f.col()))
                .filter(f -> !REQUIRED_SYS_FIELDS.contains(f.label()))
                // 隐藏字段不校验:前端 headerFields = dataSchema.fields.filter(f => !f.hidden)
                // (PanelxList.vue:2436 起,validateInlineDraft 只遍历它) —— 后端若强校验,
                // 会出现"要求的字段界面上根本没渲染",用户无路可走。现存:RDDOM_TEST.文档编号、
                // RD_PROD_INFO.产品类型(hidden=1/visible=1)。
                .filter(f -> !f.hidden())
                .toList();
        if (required.isEmpty()) return;
        // ⚠ labelsToCols 会把**空串归一化成 null 并跳过**,所以这里取不到"提交了空值"这件事;
        //   取不到时回退查库中已存值(见下),两者都空才算未填。
        Map<String, Object> submitted = labelsToCols(def.fieldsAt("header"), head);
        List<String> missing = new ArrayList<>();
        for (PanelRegistry.FieldDef f : required) {
            Object v = submitted.get(f.col());
            boolean blank = (v == null || String.valueOf(v).isBlank());
            if (blank && no != null && def.hasHeadTable()) {
                // 表单没带该字段(空串被丢弃,或本就未提交)⇒ 用库中已存值判定,避免把"没改"误判成"没填"
                blank = isStoredBlank(def.headTable(), f.col(), def.groupCol(), no);
            }
            if (blank) missing.add(f.displayName());
        }
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException(String.join("、", missing) + "不能为空");
        }
    }

    /**
     * 不参与用户必填校验的字段(与前端 validateInlineDraft 的跳过口径逐条对齐):
     *   · 系统自动填写:单据日期=当天默认、单据编号=后端发号、创建时间/编辑人/编辑日期;
     *   · 规格书种类:页签分类,新单与旧草稿都可能是空的(PanelxList.vue:4055 显式跳过);
     *   · 编号:save() 把载荷里的「编号」当**单据标识**取走(body.remove("编号")),
     *     同名列的字段永远无法随保存落库(实测 rd_spec_doc_head.编号 3 张单全为 NULL)
     *     ⇒ 拿它做必填 = 永远填不进去的死结。
     * 命中 col_name 或 label 任一即跳过。
     */
    private static final java.util.Set<String> REQUIRED_SYS_FIELDS =
            java.util.Set.of("单据编号", "单据日期", "创建时间", "更新时间", "编辑人", "编辑日期", "规格书种类", "编号");

    /**
     * 明细行必填校验(2026-09-20 补):与前端 validateInlineDraft 的**逐行**口径一致
     * (PanelxList.vue「明细第 N 行X不能为空」),只取第一条违规,便于前端定位。
     *
     * 只校验**载荷里明确带了该键**的字段:
     *   · 前端 newDetailRow() 会把每个字段都物化成 ''(空串),所以"用户清空了必填项"
     *     必然是"键在、值为空"——这一档拦得住;
     *   · 键缺失则视为"局部提交/选单生成"(SelectVoucherDialog/NewVoucherDialog 按来源单据
     *     逐字段映射,目标面板多出的必填列本来就不在载荷里),不误报;
     *   · items 为空(未带明细页签)时整体跳过——与表头"取不到就回退查库、不误报"同口径。
     * 刻意**不做**页签级"至少添加一行"(前端 tab.isRequired 那条):后端拿不到"明细页签是空的"
     * 与"这次根本没提交明细"的区别(singleDoc/局部提交路径都只发页签子集),由前端把关。
     * 内部调用方(送料暂收单同步来料检验单、WoPickingHandler、PushGenerateHandler)走的都是
     * markSaved=false,不经此处。
     */
    private void ensureDetailRequiredFilled(PanelRegistry.PanelDef def, List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) return;
        List<PanelRegistry.FieldDef> required = def.fieldsAt("detail").stream()
                .filter(PanelRegistry.FieldDef::required)
                .filter(f -> !REQUIRED_SYS_FIELDS.contains(f.col()))
                .toList();
        if (required.isEmpty()) return;
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> row = items.get(i);
            if (row == null) continue;
            for (PanelRegistry.FieldDef f : required) {
                if (!row.containsKey(f.label())) continue; // 未提交该键 ⇒ 不误报(见方法注释)
                Object v = row.get(f.label());
                if (v != null && !String.valueOf(v).isBlank()) continue;
                throw new IllegalArgumentException("明细第 " + (i + 1) + " 行" + f.displayName() + "不能为空");
            }
        }
    }

    /** 库中该列是否为空(列不存在 / 取不到时按"空"处理,不因缺列或异常而报错) */
    private boolean isStoredBlank(String table, String col, String groupCol, String no) {
        if (table == null || table.isBlank() || groupCol == null || groupCol.isBlank()) return true;
        if (!tableCols(table).contains(col)) return true;
        // ⚠ 三个坑(都踩过,靠跨面板探针才发现):
        //   ① 用 queryForList(...).stream().findFirst() 取到的是 **Map** 而不是值,空值被误判为"已填";
        //   ② queryForObject(String.class) 在该单**有多行**时抛
        //      "Incorrect result size: expected 1, actual 2"(RD_FILTER_EFF/RD_MOLD_PROC 都命中);
        //   ③ 头表可能根本没有该列(如单据编号列在头行错位),直接查会报"列名无效"。
        //   ⇒ 取 TOP 1 + 捕获一切异常并回退为"空"(宁可误报必填,也不要 500)。
        try {
            String v = jdbc.queryForObject(
                    "SELECT TOP 1 t.[" + col + "] FROM " + table + " t WHERE t.[" + groupCol + "] = ?",
                    String.class, no);
            return v == null || v.isBlank();
        } catch (Exception e) {
            log.debug("必填校验回退:取库中值失败(视为空) table={} col={} no={} : {}", table, col, no, e.getMessage());
            return true;
        }
    }

    private void ensureDocNoUnique(PanelRegistry.PanelDef def, Map<String, Object> head, String no) {
        Object v = head.get("文档编号");
        if (v == null || String.valueOf(v).isBlank()) return;
        String docNo = String.valueOf(v);
        String table = def.headTable();
        String groupCol = def.groupCol();
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM " + table + " t WHERE t.[文档编号] = ?");
        List<Object> args = new ArrayList<>(List.of(docNo));
        // 业务表软删行不计占用(头表无 asp_cancel 列时不加该条件,避免"列名无效")
        if (tableCols(table).contains("asp_cancel")) sql.append(" AND ISNULL(t.asp_cancel,'N') <> 'Y'");
        // 已作废(状态表 canceled='Y')不计占用
        if (groupCol != null && !groupCol.isBlank()) {
            sql.append(" AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ? AND s.doc_no = t.[")
                    .append(groupCol).append("] AND s.canceled = 'Y')");
            args.add(def.code());
        }
        if (no != null && !no.isBlank()) {
            sql.append(" AND t.[").append(groupCol).append("] <> ?");
            args.add(no);
        }
        Integer dup = jdbc.queryForObject(sql.toString(), Integer.class, args.toArray());
        if (dup != null && dup > 0) throw new IllegalArgumentException("文档编号不允许重复：" + docNo);
    }

    /** 样品编号不允许重复(RD_SAMPLE_NO,2026-09-18)。
     *  口径:样品编号 = 客户项目代号 + 项目编号(确定性拼接,无计数器 —— 见
     *  docs/design/研发管理-新面板设计与改动方案.md §14),所以重复必然意味着
     *  同一 (代号, 项目编号) 被录了两次。此处按明细列查重(与 ensureDocNoUnique 判头表不同,
     *  它是**明细行**唯一),作废单据不计占用(两侧都排,口径同 ensureDocNoUnique)。 */
    private void ensureSampleNoUnique(String docNo, List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) return;
        java.util.Set<String> seen = new java.util.LinkedHashSet<>();
        for (Map<String, Object> it : items) {
            Object v = it.get("样品编号");
            if (v == null) continue;
            String sampleNo = String.valueOf(v).trim();
            if (sampleNo.isEmpty()) continue;
            // 同一次提交内部先查重(数据库里还没有这些行)
            if (!seen.add(sampleNo)) throw new IllegalArgumentException("样品编号不允许重复：" + sampleNo);
            Integer dup = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM rd_sample_no_detail d "
                            + "JOIN rd_sample_no_head h ON h.[单据编号] = d.[单据编号] "
                            + "WHERE d.[样品编号] = ? AND d.[单据编号] <> ? "
                            + "AND ISNULL(h.asp_cancel,'N') <> 'Y' "
                            + "AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'RD_SAMPLE_NO' "
                            + "                AND s.doc_no = h.[单据编号] AND s.canceled = 'Y')",
                    Integer.class, sampleNo, docNo == null ? "" : docNo);
            if (dup != null && dup > 0) throw new IllegalArgumentException("样品编号不允许重复：" + sampleNo);
        }
    }

    // ==================== 规格书检验项目变更 → 出货检验计划表核对提醒(2026-09-11) ====================

    /** 规格书「4.产品性能检验项目及检验标准」页明细快照(表区=检验要求;[检验项目] 内含 组·子项)。
     *  行签名=检验项目◇要求◇方法◇依据,顺序按 id——增/删/改/调序任一变化都会使快照不同。 */
    private List<String> specTestRowsSnapshot(String no) {
        try {
            return jdbc.queryForList("SELECT CONVERT(nvarchar(max), ISNULL([检验项目], N'')) + N'◇' + ISNULL([检验要求], N'') "
                            + "+ N'◇' + ISNULL([检验方法], N'') + N'◇' + ISNULL([检验依据], N'') "
                            + "FROM rd_spec_doc_detail WHERE [单据编号] = ? AND [表区] = N'检验要求' ORDER BY id",
                    String.class, no);
        } catch (Exception e) {
            return List.of();
        }
    }

    /** 规格书修改态保存后:检验项目及标准页发生变化(快照 vs 落库后)→ 按「规格书编号 = 计划表产品编号」
     *  找关联出货检验计划表,向其经办人+管理员发核对提醒(仅变更提醒,不做两侧内容比对——名称体系不同,
     *  机械比对易误报;差异由经办人按新规格书人工核对)。
     *  注:规格书的「编号」在行模型里就是单据编号(查询服务注入,物理头表无独立编号列),故直接以 specNo 关联。 */
    private void notifyInspPlansOnSpecTestChange(String specNo, List<String> oldRows, String actor) {
        try {
            List<String> newRows = specTestRowsSnapshot(specNo);
            if (newRows.equals(oldRows)) return; // 该页没变,不打扰
            final String name = specNameOf(specNo);
            List<String> plans = jdbc.queryForList(
                    "SELECT [单据编号] FROM rd_insp_plan_head WHERE [产品编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y'",
                    String.class, specNo);
            for (String planNo : plans) {
                List<String> targets = new ArrayList<>(messageService.admins());
                String author = messageService.authorOf("rd_insp_plan_head", planNo);
                if (!author.isBlank()) targets.add(author);
                notify(() -> messageService.send(targets, MessageService.SPEC_ITEMS_CHANGED, "RD_INSP_PLAN", planNo,
                        Map.of("specNo", specNo, "specName", name, "specCode", specNo), actor));
            }
        } catch (Exception e) {
            log.warn("spec-test-change notify failed: spec={} err={}", specNo, e.getMessage());
        }
    }

    /** 规格书名称(通知文案用;取不到返回空串不影响发送) */
    private String specNameOf(String specNo) {
        try {
            return String.valueOf(jdbc.queryForObject(
                    "SELECT ISNULL(MAX([名称]), N'') FROM rd_spec_doc_head WHERE [单据编号] = ?", String.class, specNo));
        } catch (Exception e) {
            return "";
        }
    }

    // ==================== 送料暂收单 → 来料检验单 同步修改(2026-09-15) ====================

    /**
     * 送料暂收单(QC_RECV,原名 SL_RECV,2026-09-20 改面板编码)弃审联动(2026-09-17):
     * 由它生成的来料检验单若已审核则一并弃审——
     * 递归复用 unaudit(QC_INSP) 的全部联动(其下游入库/退料草稿作废释放,已审核则拒绝并提示先弃审)。
     * 检验单为草稿则不动(暂收保存时 syncInspFromSlRecv 会镜像同步)。
     * 链路口径:暂收→IJ 占用在检验单作废时才 RELEASED,审核不变更,联动弃审后链保持 ACTIVE,同步可寻址。
     */
    private void slUnauditCascade(String panelCode, String no, String user) {
        if (!"QC_RECV".equals(panelCode)) return;
        List<String> targets = jdbc.queryForList(
                "SELECT DISTINCT target_form_no FROM form_flow_link"
                        + " WHERE source_panel_code = 'QC_RECV' AND source_form_no = ?"
                        + " AND target_panel_code = 'QC_INSP'", String.class, no);
        for (String tno : targets) {
            String st = String.valueOf(docStatusOf("QC_INSP", tno).get("status"));
            if (!"已审核".equals(st)) continue;
            Map<String, Object> fd = new HashMap<>();
            fd.put("编号", tno);
            unaudit(registry.panel("QC_INSP"), fd);
        }
    }

    /**
     * 来料检验单行数量校验(2026-09-17):合格数量+不合格数量不得超过送检数量,空值按 0。
     * 超限抛错并定位到行,前端以服务异常消息提示。
     * 2026-09-20 修正取值口径:检验行数量字段在面板上叫「送检数量」(旧名 数量),不良侧叫「不合格数量」
     * (库列另有遗留 不良数量)。原实现只读「数量」「不良数量」两个非面板键 → 数量恒 0,
     * 一旦 送检数量 由链路带入,合格数量>0 即被判超限而存不下来(检验→入库链断在这里)。
     * 取值改为按别名优先级兼容:数量口径 送检数量→数量→暂收数量;不良口径 不合格数量→不良数量。
     */
    private void validateInspQty(List<Map<String, Object>> items) {
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> it = items.get(i);
            double qty = firstNum(it, "送检数量", "数量", "暂收数量");
            double ok = numOf(it.get("合格数量"));
            double bad = firstNum(it, "不合格数量", "不良数量");
            if (ok + bad > qty + 1e-9) {
                throw new IllegalStateException("第" + (i + 1) + "行 合格数量(" + trimZero(ok) + ")+不合格数量("
                        + trimZero(bad) + ") 超过送检数量(" + trimZero(qty) + ")，请核对");
            }
        }
    }

    /** 按别名优先级取行内数值(首个非空键;全空按 0)——面板字段改名后防取值断流 */
    private double firstNum(Map<String, Object> row, String... labels) {
        for (String l : labels) {
            Object v = row.get(l);
            if (v != null && !String.valueOf(v).isBlank()) return numOf(v);
        }
        return 0;
    }

    /** 行值转数值(空/非数值按 0) */
    private double numOf(Object v) {
        if (v == null || String.valueOf(v).isBlank()) return 0;
        try {
            return Double.parseDouble(String.valueOf(v));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** 数值显示去尾零(50.0 -> 50) */
    private static String trimZero(double d) {
        return d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
    }


    /**
     * 送料暂收单(QC_RECV,原名 SL_RECV,2026-09-20 改面板编码)保存后,同步修改由它生成的来料检验单(QC_INSP):
     * - 关联 = form_flow_link(QC_RECV→QC_INSP,ACTIVE,生单时写入;行键=单号#行表id,行 id 跨保存稳定);
     * - 仅当检验单仍可编辑(草稿/修改中)时同步——已审核/审批中/已作废等不越权改动;
     * - 表头镜像 业务员/供应商代码/供应商/部门/部门名称/数量(单据日期不镜像——
     *   检验单保持自己的创建日期,2026-09-17 口径:被生单据日期=创建当日);
     * - 明细按行键对行镜像共享列;暂收行已删(软删)时对应检验行一并软删
     *   (检验单为草稿才同步,未生过下游单,删除安全);
     * - 检验单自有字段(合格数量/不良数量/抽样方案等)与附件不动:附件实体锚定
     *   panelCode+单号+field,镜像文件名会造成检验单侧下载失锚。
     */
    private void syncInspFromSlRecv(String no, String user) {
        List<String> targets = jdbc.queryForList(
                "SELECT DISTINCT target_form_no FROM form_flow_link"
                        + " WHERE source_panel_code = 'QC_RECV' AND source_form_no = ?"
                        + " AND target_panel_code = 'QC_INSP' AND link_status = 'ACTIVE'", String.class, no);
        for (String tno : targets) {
            String st = String.valueOf(docStatusOf("QC_INSP", tno).get("status"));
            if (!"草稿".equals(st) && !"修改中".equals(st)) continue;
            // JOIN 锚定源暂收单号(单号两式 SL-xxx/IJ-xxx 不同,2026-09-17 修复:
            // 原写 s.单据编号 = t.单据编号 恒不匹配,表头镜像从未生效)
            jdbc.update("UPDATE t SET t.业务员 = s.业务员, t.供应商代码 = s.供应商代码,"
                            + " t.供应商 = s.供应商, t.部门 = s.部门, t.部门名称 = s.部门名称, t.数量 = s.数量,"
                            + " t.暂收单号 = s.单据编号,"
                            + " t.asp_user2 = ?, t.asp_time2 = GETDATE()"
                            + " FROM qc_insp t JOIN sl_recv s ON s.单据编号 = ?"
                            + " WHERE t.单据编号 = ? AND ISNULL(t.asp_cancel, 'N') <> 'Y' AND ISNULL(s.asp_cancel, 'N') <> 'Y'",
                    user, no, tno);
            List<Map<String, Object>> links = jdbc.queryForList(
                    "SELECT source_line_key, target_line_key FROM form_flow_link"
                            + " WHERE source_panel_code = 'QC_RECV' AND source_form_no = ?"
                            + " AND target_panel_code = 'QC_INSP' AND target_form_no = ? AND link_status = 'ACTIVE'",
                    no, tno);
            for (Map<String, Object> lk : links) {
                Integer srcId = lineKeyIdOf(lk.get("source_line_key"));
                Integer tgtId = lineKeyIdOf(lk.get("target_line_key"));
                if (srcId == null || tgtId == null) continue;
                Boolean srcAlive = jdbc.queryForObject(
                        "SELECT CASE WHEN ISNULL(asp_cancel, 'N') <> 'Y' THEN 1 ELSE 0 END"
                                + " FROM sl_recv_detail WHERE id = ?", Boolean.class, srcId);
                if (srcAlive == null) continue;
                if (srcAlive) {
                    jdbc.update("UPDATE d SET d.物料编码 = s.物料编码, d.物料名称 = s.物料名称, d.规格型号 = s.规格型号,"
                                    + " d.物料描述 = s.物料描述, d.数量 = s.数量, d.箱数 = s.箱数, d.日期 = s.日期,"
                                    + " d.计量单位 = s.计量单位, d.单价 = s.单价, d.采购订单行号 = s.采购订单行号,"
                                    + " d.备注 = s.备注, d.结案 = s.结案, d.部门 = s.部门, d.部门名称 = s.部门名称,"
                                    + " d.asp_user2 = ?, d.asp_time2 = GETDATE()"
                                    + " FROM qc_insp_detail d JOIN sl_recv_detail s ON s.id = ?"
                                    + " WHERE d.id = ? AND d.单据编号 = ? AND ISNULL(d.asp_cancel, 'N') <> 'Y'",
                            user, srcId, tgtId, tno);
                } else {
                    jdbc.update("UPDATE qc_insp_detail SET asp_cancel = 'Y', asp_user2 = ?, asp_time2 = GETDATE()"
                            + " WHERE id = ? AND 单据编号 = ? AND ISNULL(asp_cancel, 'N') <> 'Y'", user, tgtId, tno);
                }
            }
        }
    }

    /** form_flow_link 行键(单号#行表id)解析行表 id;格式不符返回 null */
    private Integer lineKeyIdOf(Object lineKey) {
        if (lineKey == null) return null;
        String s = String.valueOf(lineKey);
        int at = s.indexOf('#');
        if (at < 0 || at == s.length() - 1) return null;
        try {
            return Integer.valueOf(s.substring(at + 1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 归档标记:yj_doc_status.archived='Y'(已归档优先级:已作废>已中止>已审核>审批中>已归档>草稿);
     *  archived_at 仅首次归档写入(CASE 保首次),修改后再归档不覆盖——查询单据的时间区间口径。
     *  2026-09-12 口径反转:归档同时写审核人 shr(首次,CASE 保首审)——此前归档不写 shr,
     *  管理员保存归档的单据纸面「审核人」栏空白、列表无「已审批」角标,文控审计上说不通;
     *  再归档保留首审人,历次再归档经手人看 yj_doc_modify_log.rearchive_by。 */
    private void markArchived(String panelCode, String no, String user) {
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                + "WHEN MATCHED THEN UPDATE SET archived = 'Y', pending = 'N', canceled = 'N', "
                + "shr = CASE WHEN t.shr IS NULL THEN ? ELSE t.shr END, "
                + "shsj = CASE WHEN t.shsj IS NULL THEN GETDATE() ELSE t.shsj END, "
                + "archived_at = CASE WHEN t.archived_at IS NULL THEN GETDATE() ELSE t.archived_at END, update_at = GETDATE() "
                + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, archived, pending, canceled, shr, shsj, archived_at, update_at) "
                + "VALUES (s.panel_code, s.doc_no, 'Y', 'N', 'N', ?, GETDATE(), GETDATE(), GETDATE());",
                panelCode, no, user, user);
    }

    /** 行表 upsert:有 id 更新,无 id 插入(回填自增 id),缺席行软删(asp_cancel='Y') */
    private void upsertLineRows(PanelRegistry.PanelDef def, List<Map<String, Object>> items,
                                String no, Map<String, String> l2c, String user) {
        Set<Object> liveIds = new HashSet<>();
        for (Map<String, Object> item : items) {
            Object id = item.get("id");
            Map<String, Object> cols = labelsToCols(def.fields(), item);
            // 行表没有的列不参与行 upsert:参照带回按同名标签回填(如表头 place 的 数据来源 被
            // INV 存货行带入明细),拼进 INSERT/UPDATE 即 207;单表式列全在行表,此处为空操作
            cols.keySet().retainAll(tableCols(def.lineTable()));
            cols.put(def.groupCol(), no);
            if (id != null && !String.valueOf(id).isBlank()) {
                liveIds.add(id);
                updateRow(def.lineTable(), def.pkCol(), id, cols, user);
            } else {
                Object newId = insertRow(def.lineTable(), cols, user);
                if (newId != null) liveIds.add(newId);
            }
        }
        // 缺席行软删:本单中不在 liveIds 的存活行 -> asp_cancel='Y'
        softDeleteMissing(def.lineTable(), def.groupCol(), no, def.pkCol(), liveIds, user);
    }

    /** 把 group 下不在 keepIds 的存活行软删 */
    private void softDeleteMissing(String table, String groupCol, String groupVal, String pk,
                                   Set<Object> keepIds, String user) {
        StringBuilder sql = new StringBuilder("UPDATE " + table + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                + " WHERE " + groupCol + " = ? AND ISNULL(asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>(List.of(user, groupVal));
        if (!keepIds.isEmpty()) {
            sql.append(" AND ").append(pk).append(" NOT IN (")
                    .append(String.join(",", keepIds.stream().map(x -> "?").toList())).append(")");
            args.addAll(keepIds);
        }
        jdbc.update(sql.toString(), args.toArray());
    }

    /** 头表 upsert(头行式):按 group_col 定位 */
    private void upsertHeadRow(PanelRegistry.PanelDef def, Map<String, Object> head, String no, String user) {
        List<PanelRegistry.FieldDef> fields = def.fieldsAt("header");
        Map<String, Object> cols = labelsToCols(fields, head);
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.headTable() + " WHERE " + def.groupCol() + " = ?",
                Integer.class, no);
        if (existing != null && existing > 0) {
            updateRow(def.headTable(), "id", null, cols, user, def.groupCol(), no);
        } else {
            cols.put(def.groupCol(), no);
            insertRow(def.headTable(), cols, user);
        }
    }

    /** 档案保存:整份明细 upsert(插入回填自增 id),缺席行软删 */
    private Map<String, Object> saveArchive(PanelRegistry.PanelDef def, List<Map<String, Object>> items, String user) {
        // 数据量护栏(2026-09-16):档案保存=全量 upsert(缺席行=已删除);库里存活行数一旦超出
        // 全量加载上限,前端看到的就是截断数据,此时放行保存会把未加载的行全部误删——直接拒绝
        Integer live = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.lineTable() + " WHERE ISNULL(asp_cancel,'N')<>'Y'", Integer.class);
        if (live != null && live > QueryService.ARCH_LOAD_CAP) {
            throw new IllegalStateException("该档案存活行数 " + live + " 已超出全量加载上限 " + QueryService.ARCH_LOAD_CAP
                    + ",保存已阻止:未加载的行会被当作删除处理,请联系开发提高上限或先清理/归档数据");
        }
        // 存档留痕(2026-09-22):先快照存活行,保存后比对出「修改记录」(用户要求与立项申请同义的留痕)
        Map<Object, Map<String, String>> before = archiveRowSnapshot(def);
        Set<Object> liveIds = new HashSet<>();
        for (Map<String, Object> item : items) {
            Object id = item.get("id");
            Map<String, Object> cols = labelsToCols(def.fields(), item);
            if (id != null && !String.valueOf(id).isBlank()) {
                liveIds.add(id);
                updateRow(def.lineTable(), def.pkCol(), id, cols, user);
            } else {
                Object newId = insertRow(def.lineTable(), cols, user);
                if (newId != null) liveIds.add(newId);
            }
        }
        // 档案缺席行 = 已删除 -> 全表软删不在 keepIds 的存活行(全部缺席时不清理,防止误清整档)
        if (!liveIds.isEmpty()) {
            StringBuilder sql = new StringBuilder("UPDATE " + def.lineTable()
                    + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE() WHERE ISNULL(asp_cancel,'N')<>'Y'");
            List<Object> args = new ArrayList<>(List.of(user));
            sql.append(" AND ").append(def.pkCol()).append(" NOT IN (")
                    .append(String.join(",", liveIds.stream().map(x -> "?").toList())).append(")");
            args.addAll(liveIds);
            jdbc.update(sql.toString(), args.toArray());
        }
        recordArchiveChange(def, before, items, liveIds, user);
        return result(def.name(), "启用");
    }

    /** 标签键 -> 列名键(仅取字段定义内的列,忽略 id/__no 等保留键)。
     *  归一化后为 null(空串)的值同样跳过——否则 NOT NULL 列(如 币种)会被显式插 NULL 报错,
     *  交由 fillRequiredDefaults 补默认值。 */
    private Map<String, Object> labelsToCols(List<PanelRegistry.FieldDef> fields, Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (PanelRegistry.FieldDef f : fields) {
            Object v = row.get(f.label());
            if (v != null) {
                Object normalized = normalizeByType(f, v);
                if (normalized != null) out.put(f.col(), normalized);
            }
        }
        return out;
    }

    private static final java.util.regex.Pattern ISO_DATETIME =
            java.util.regex.Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})(?:[T ](\\d{2}:\\d{2})(?::(\\d{2}))?)?");

    /**
     * 写入值规范化:
     * - 空串 -> null
     * - 日期/日期时间字段:界面回传的 Jackson ISO-8601(2026-08-26T00:00:00.000+08:00)
     *   转为 SQL Server 可解析的 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss
     */
    private Object normalizeByType(PanelRegistry.FieldDef f, Object v) {
        if (!(v instanceof String s)) return v;
        if (s.isBlank()) return null;
        String type = f.dataType() == null ? "" : f.dataType();
        if (type.contains("日期")) {
            java.util.regex.Matcher m = ISO_DATETIME.matcher(s);
            if (m.find()) {
                if (type.contains("时间") && m.group(2) != null) {
                    return m.group(1) + " " + m.group(2) + (m.group(3) != null ? ":" + m.group(3) : ":00");
                }
                return m.group(1);
            }
        }
        return s;
    }

    /** 插入并返回自增主键(无主键时返回 null) */
    private Object insertRow(String table, Map<String, Object> cols, String user) {
        if (cols.isEmpty()) return null;
        fillRequiredDefaults(table, cols);
        cols.put("asp_user1", user);
        cols.put("asp_time1", LocalDateTime.now());
        // 列名含特殊字符(%、.等)必须方括号包裹
        String names = String.join(",", cols.keySet().stream().map(c -> "[" + c + "]").toList());
        String marks = String.join(",", cols.values().stream().map(x -> "?").toList());
        String sql = "INSERT INTO " + table + " (" + names + ") VALUES (" + marks + ")";
        Object[] args = cols.values().toArray();
        org.springframework.jdbc.support.GeneratedKeyHolder kh = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(con -> {
            java.sql.PreparedStatement ps = con.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            return ps;
        }, kh);
        if (!kh.getKeyList().isEmpty() && kh.getKeyList().get(0) != null) {
            for (Object v : kh.getKeyList().get(0).values()) {
                if (v instanceof Number) return v;
            }
        }
        return null;
    }

    private final Map<String, List<String[]>> requiredColsCache = new java.util.concurrent.ConcurrentHashMap<>();

    private final Map<String, Set<String>> tableColsCache = new java.util.concurrent.ConcurrentHashMap<>();

    /** 表物理列集合(缺表/异常返回空集):元数据引用了物理表没有的列时跳过该列,避免 INSERT/UPDATE 报 207 */
    private Set<String> tableCols(String table) {
        return tableColsCache.computeIfAbsent(table, t -> {
            try {
                Set<String> s = new HashSet<>();
                jdbc.query("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(?)",
                        rs -> { s.add(rs.getString(1)); }, t);
                return s;
            } catch (Exception e) {
                return Set.of();
            }
        });
    }

    /** 补齐无默认值的 NOT NULL 列(排除 IDENTITY):comm->'0',字符->'',数值->0 —— 与旧系统写入习惯一致 */
    private void fillRequiredDefaults(String table, Map<String, Object> cols) {
        List<String[]> required = requiredColsCache.computeIfAbsent(table, t -> {
            try {
                return jdbc.query(
                        "SELECT c.name, ty.name FROM sys.columns c JOIN sys.types ty ON c.user_type_id = ty.user_type_id"
                                + " WHERE c.object_id = OBJECT_ID(?) AND c.is_nullable = 0 AND c.is_identity = 0"
                                + " AND NOT EXISTS (SELECT 1 FROM sys.default_constraints dc"
                                + " WHERE dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id)",
                        (rs, i) -> new String[]{rs.getString(1), rs.getString(2)}, table);
            } catch (Exception e) {
                return List.of();
            }
        });
        for (String[] col : required) {
            if (cols.containsKey(col[0])) continue;
            String type = col[1] == null ? "" : col[1];
            Object dv = "comm".equals(col[0]) ? "0"
                    : type.contains("char") ? ""
                    : (type.contains("int") || type.contains("decimal") || type.contains("numeric")
                    || type.contains("float") || type.contains("money") || type.contains("bit")) ? 0
                    : null;
            if (dv != null) cols.put(col[0], dv);
        }
    }

    private void updateRow(String table, String pk, Object id, Map<String, Object> cols, String user) {
        updateRow(table, pk, id, cols, user, null, null);
    }

    private void updateRow(String table, String pk, Object id, Map<String, Object> cols, String user,
                           String groupCol, String groupVal) {
        if (cols.isEmpty()) return;
        dropNullsOnNotNull(table, cols);
        if (cols.isEmpty()) return;
        cols.put("asp_user2", user);
        cols.put("asp_time2", LocalDateTime.now());
        StringBuilder set = new StringBuilder();
        List<Object> args = new ArrayList<>();
        for (Map.Entry<String, Object> e : cols.entrySet()) {
            if (set.length() > 0) set.append(", ");
            set.append("[").append(e.getKey()).append("] = ?");
            args.add(e.getValue());
        }
        StringBuilder where = new StringBuilder();
        if (id != null) {
            where.append("[").append(pk).append("] = ?");
            args.add(id);
        } else if (groupCol != null) {
            where.append("[").append(groupCol).append("] = ?");
            args.add(groupVal);
        }
        jdbc.update("UPDATE " + table + " SET " + set + " WHERE " + where, args.toArray());
    }

    private final Map<String, java.util.Set<String>> notNullColsCache = new java.util.concurrent.ConcurrentHashMap<>();

    /** UPDATE 清洗:NOT NULL 列收到 null 值时剔除该列(保留库中原值),避免"列不允许有 Null 值"更新失败。
     *  可空列的 null 是合法的"清空"语义,不受影响。对全部单据/档案面板的更新路径统一生效。 */
    private void dropNullsOnNotNull(String table, Map<String, Object> cols) {
        java.util.Set<String> notNull = notNullColsCache.computeIfAbsent(table, t -> {
            try {
                java.util.Set<String> s = new java.util.HashSet<>();
                jdbc.query("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(?) AND is_nullable = 0",
                        rs -> { s.add(rs.getString(1)); }, t);
                return s;
            } catch (Exception e) {
                return java.util.Set.of();
            }
        });
        if (notNull.isEmpty()) return;
        cols.keySet().removeIf(k -> cols.get(k) == null && notNull.contains(k));
    }

    /**
     * 清理"孤儿状态行"。真实成因(2026-09-11 更正,原文写"单号释放后可重发"是错的):
     * `FormNoService.next()` 按 s_allno 单调递增,`s_allno` 从不回收,单号**不会**被重发。
     * 孤儿状态行的来源是**历史清理脚本把业务表头行物理删掉**(或单据从未真正落库),
     * 而 `yj_doc_status` 里的状态行留了下来;此后若该号被复用(手工建号/直接改库/跨环境搬数据),
     * 新单就会**继承**旧的 archived/canceled/pending —— 表现是"新增一张单据,它一出生就是
     * 已归档/已作废",根本填不了数据。
     * 新建时若单据表里查不到这个号,说明状态行是陈旧的,直接清掉。
     * 2026-09-10 实测:RD_APPROVAL 10 条 + RD_PLAN 5 条孤儿状态行导致该故障。
     */
    private void clearStaleDocStatus(PanelRegistry.PanelDef def, String no) {
        if (no == null || no.isBlank()) return;
        String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
        String col = def.groupCol() != null ? def.groupCol() : def.codeCol();
        if (table == null || col == null) return;
        Integer live = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE [" + col + "] = ?", Integer.class, no);
        if (live != null && live > 0) return;   // 在册单据,状态行有效,不动
        int n = jdbc.update("DELETE FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?", def.code(), no);
        if (n > 0) {
            org.slf4j.LoggerFactory.getLogger(ButtonService.class)
                    .warn("[新建] 单号 {} 存在陈旧状态行({} 条),已清除,避免新单继承旧的归档/作废标记", no, n);
        }
    }
    /** 标记草稿的保存阶段:saved='Y' 已保存(未审核) / 'N' 临时草稿(新增未保存/保存为草稿) */
    private void markDocSaved(String panelCode, String no, boolean saved) {
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET saved = ?, update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, saved, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, ?, GETDATE());",
                panelCode, no, saved ? "Y" : "N", saved ? "Y" : "N");
    }

    // ============ 状态机(照搬 light-mes:草稿⇄已审核 + 审批流) ============

    private Map<String, Object> audit(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        // 直审收权(2026-09-22):直接「审核」仅管理员——此前与审批通过/驳回同口径(管理员 ∪ can_approve),
        // 有审批权的角色现在走 提交审批→审批通过(同效已审核,钩子同口径);前端审批下拉对非管理员同步隐藏
        String auditor = currentUserName();
        if (!isAdminUser(auditor))
            throw new org.springframework.security.access.AccessDeniedException("仅管理员可直接审核，其他角色请走提交审批");
        if (!def.isDoc()) throw new IllegalStateException("档案面板无审核动作");
        String no = requireNo(formData);
        ensureDocExists(def, no);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if ("已作废".equals(st.get("status"))) throw new IllegalStateException("已作废单据不可审核");
        if ("已中止".equals(st.get("status"))) throw new IllegalStateException("已中止单据不可审核，请先恢复");
        if ("已审核".equals(st.get("status"))) throw new IllegalStateException("单据已是已审核状态");
        // 两级审批(远端 2026-09-20):「待二级审批」同样不可直审,与「审批中」同口径拦截
        if ("审批中".equals(st.get("status")) || "待二级审批".equals(st.get("status"))) throw new IllegalStateException("审批中单据不可直接审核，请走审批流");
        // 编制审核分离(2026-09-12):审核人不得是制单人本人——此前有审批权的用户可自审自己制的单;
        // 管理员豁免(管理员保存即归档本就是等价权力,堵死反而制造死路)
        if (!isAdminUser(auditor) && auditor.equals(authorOfDoc(def, no)))
            throw new org.springframework.security.access.AccessDeniedException("审核人不能与制单人相同（编制与审批分离）");
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET shr = ?, shsj = GETDATE(), canceled = 'N', pending = 'N', saved = 'Y', update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, pending, saved, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, ?, GETDATE(), 'N', 'N', 'Y', GETDATE());",
                def.code(), no, auditor, auditor);
        // 竞态守卫(2026-09-12):并发双审时后来者回查 shr 已非本人 → 抛错整笔回滚,不再重复留痕
        Object rowAfter = docStatusOf(def.code(), no).get("row");
        Object shrAfter = rowAfter instanceof Map<?, ?> rm ? rm.get("shr") : null;
        if (!auditor.equals(shrAfter == null ? "" : String.valueOf(shrAfter))) {
            throw new IllegalStateException("单据已被他人审核，请刷新后查看");
        }
        // 分批送料批次号(2026-09-21 取号时机迁移):**采购入库单审核时**确认批次号并回填全链 ——
        // 送料暂收单/来料检验单/采购入库单(头+行)、批次台账、form_flow_link.batch_no。
        // 顺序(2026-09-22 调整):**先**确认批次号再库存过账 —— 否则 kucun.lot_no 落的是确认前的
        // 空值(台账批号口径=批次号优先,见 StockLedgerService.loadRows)。整体同一事务,任一步失败一并回滚。
        // 之后转ERP(转ERP 是独立按钮,天然在其之后,故不需要"补推批号")。幂等(台账行已有号则沿用)。
        assignBatchNoOnInbound(def.code(), no, auditor);
        // 库存记账(材料入库链):采购入库单审核 → kucun 入账(失败抛错整笔回滚)
        stockLedger.postIn(def.code(), no, currentUserName());
        // 库存成本重算(移动加权):本单已进入 v_stock_movement(仅已审核单据进视图),成本物化表随之作废。
        // 全量重算而非按分区:单据可能改动了仓库/存货编码,旧分区行不会被范围 DELETE 清掉。
        recalcInvCostIfStockDoc(def.code());
        // 工序报工记账(生产过程层):报工单审核 → wo_progress.完成数量 累计
        woReport.post(def.code(), no, currentUserName());
        // 切炭双出口(已确认):报工审核后,直销数量自动生成成品入库单并审核入账(成品仓)
        dualOutFinishIn(def.code(), no, currentUserName());
        // 不良品处理记账(品质层):处理单审核 → 原仓扣减+目标仓(隔离/不良品)移仓或报废
        qcDisposal.post(def.code(), no, currentUserName());
        // 来料检验单审核 → 自动生单(2026-09-16 双出口口径):合格数量>0 的行生成采购入库单草稿,
        // 不良数量>0 的行生成暂收退回单草稿(此前暂收退回单为手工按钮,现改为审核自动创建)
        inspAutoPurchaseIn(def.code(), no, currentUserName());
        inspAutoReturn(def.code(), no, currentUserName());
        // 特采行(2026-09-22):检验审核不生成入库/退料,改为每个特采行生成一张特采单(QC_TC_IN)
        inspAutoSpecialAccept(def.code(), no, currentUserName());
        // 特采单审核=审批通过 → 自动生成采购入库单(全部数量,不走退料)
        tcInApprovedGenerate(def.code(), no, currentUserName());
        // 项目实施计划归档 → 自动同步项目进度查询(研发管理)
        if ("RD_PLAN".equals(def.code())) syncAllPlansToProgress();
        // 文件类面板:经审核收尾(修改闭环/弃审留痕) → 计算修改记录并再归档
        if (DOC_ARCHIVE_PANELS.contains(def.code()) && finalizeOpenModify(def, no, auditor)) {
            return result(no, "已归档");
        }
        return result(no, "已审核");
    }

    private Map<String, Object> unaudit(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        // 审批权校验:与 审核 同口径,防"自审自弃"绕过审批权
        requireApprover(def.code());
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status) && !"已归档".equals(status)) throw new IllegalStateException("仅已审核或已归档状态可弃审");
        // 检验目录守卫(2026-09-22 用户口径):挂靠单据在检验目录中已「已完成检验」时不许反审核 ——
        // 需先在检验目录点「修改」把状态回弹为「正在检验中」,再回来反审核修改
        qcCatalog.assertLinkedRowNotCompleted(def.code(), no);
        // 库存冲回(材料入库链):先冲账再弃审,余额不足或台账缺失则拒绝,整笔回滚
        stockLedger.unpostIn(def.code(), no, currentUserName());
        // 库存成本重算:单据退出 v_stock_movement 后,成本物化表同样需重算(与审核对称)
        recalcInvCostIfStockDoc(def.code());
        // 报工冲回(生产过程层):完成数量对称扣减,为负则拒绝
        woReport.unpost(def.code(), no, currentUserName());
        // 切炭双出口冲回:弃审报工 → 自动生成红字(负数量)成品入库单冲回台账
        dualOutRedReverse(def.code(), no, currentUserName());
        // 不良品处理冲回(品质层):移仓/报废对称冲回,目标仓被消耗则拒绝
        qcDisposal.unpost(def.code(), no, currentUserName());
        // 来料检验单弃审联动:自动生成的采购入库单为草稿则作废+释放占用+清入库单号回填;
        // 已审核(可能已记台账)则拒绝,提示先弃审入库单——防止"检验弃审了、库存已入账"的错位
        inspUnauditCascade(def.code(), no, currentUserName());
        // 特采单弃审联动(2026-09-22 特采闸门):由它生成的采购入库单草稿作废+释放;
        // 已审核(可能已记台账)则拒绝 —— 先弃审那张入库单
        tcInUnauditCascade(def.code(), no, currentUserName());
        // 送料暂收单弃审联动:由它生成且已审核的来料检验单一并弃审(递归走检验单自身联动,
        // 其下游入库/退料已审核会被拒绝并提示)——否则暂收改完保存时检验单仍"已审核"
        // 被镜像同步跳过,出现"暂收改了检验没改"的错位(2026-09-17 用户报同步失效的根因)
        slUnauditCascade(def.code(), no, currentUserName());
        // 弃审留痕(2026-09-12 修复):文件类面板弃审回到草稿后可直接改,此前的改动不走申请修改闭环,
        // 修改记录完全丢失。弃审时先落一份快照(弃审前的数据),此后再编辑保存/审核/审批通过时
        // 由 finalizeOpenModify 收尾 diff 并盖章再归档——弃审路径与申请修改路径留痕同构。
        if (DOC_ARCHIVE_PANELS.contains(def.code())) snapshotOnUnaudit(def, no, currentUserName());
        // 弃审同时清归档标记(文件面板审批后=已归档,弃审应回到草稿)
        jdbc.update("UPDATE yj_doc_status SET shr = NULL, shsj = NULL, archived = NULL, update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", def.code(), no);
        // 转ERP联动:弃审清 是否已转ERP/ERP单号/转ERP操作人/转ERP时间(重新审核后可再转)
        if (List.of("PURCHASE_IN", "SALE_OUT", "PU_ORDER").contains(def.code())) {
            String tbl = "PURCHASE_IN".equals(def.code()) ? "bd_purchase_in"
                    : "PU_ORDER".equals(def.code()) ? "bd_pu_order" : "bd_sale_out";
            jdbc.update("UPDATE " + tbl + " SET 是否已转ERP = N'否', ERP单号 = NULL, 转ERP操作人 = NULL, 转ERP时间 = NULL WHERE 单据编号 = ?", no);
        }
        recordApproval(def.code(), no, "UNAUDIT", "PENDING", opinionOf(formData));
        return result(no, "草稿");
    }

    // ---- 中止(对齐 PANDA/T+ 整单中止、生产加工单中止执行):仅已审核可中止,恢复保留原审核留痕 ----

    /** 中止:已审核 → 已中止(留痕 stop_by/stop_at;shr 保留,取消中止后回到已审核) */
    private Map<String, Object> stop(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        ensureDocExists(def, no);
        Map<String, Object> st = docStatusOf(def.code(), no);
        String status = String.valueOf(st.get("status"));
        if ("已作废".equals(status)) throw new IllegalStateException("已作废单据不可中止");
        if ("已中止".equals(status)) throw new IllegalStateException("单据已是已中止状态");
        if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核状态可中止");
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET stopped = 'Y', stop_by = ?, stop_at = GETDATE(), update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, stopped, stop_by, stop_at, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), GETDATE());",
                def.code(), no, currentUserName(), currentUserName());
        recordApproval(def.code(), no, "STOP", "STOPPED", opinionOf(formData));
        return result(no, "已中止");
    }

    /** 取消中止(生产加工单「草稿」按钮):已中止 → 恢复(shr 保留则已审核,否则草稿) */
    private Map<String, Object> unstop(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"已中止".equals(st.get("status"))) throw new IllegalStateException("仅已中止状态可恢复");
        jdbc.update("UPDATE yj_doc_status SET stopped = 'N', stop_by = NULL, stop_at = NULL, update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ?", def.code(), no);
        recordApproval(def.code(), no, "UNSTOP", "UNSTOPPED", opinionOf(formData));
        Map<String, Object> after = docStatusOf(def.code(), no);
        return result(no, String.valueOf(after.get("status")));
    }

    // ---- 审批流(照搬 light-mes PxService):提交/通过/驳回全留痕,防伪校验 ----

    /** 提交审批(对外动作:仅草稿/修改中 → 审批中;变更单另有发起人身份与会签前置校验) */
    private Map<String, Object> submitApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String operator = currentUserName();
        // 产品变更申请单(2026-09-21):提交审批 = 发起人(∪管理员)的动作;勾了「需会签=是」的单
        // 必须先会签全部通过才能送审(用户口径:会签通过才进审核)
        if (CHANGE_PANEL.equals(def.code())) {
            requireChangeInitiator(no, operator);
            if ("是".equals(changeHead(no, "需会签")) && !signoffAllApproved(no))
                throw new IllegalStateException("本单勾选了「需会签」，请先提交会签并等全部会签通过后再提交审批");
        }
        return doSubmitApproval(def, no, opinionOf(formData));
    }

    /**
     * 提交审批内核(会签全部通过后由系统自动调用,故**不校验发起人身份**:最后一位会签人不是发起人)。
     * 其余逐字同原路径:仅草稿/修改中可提交,写 pending='Y' + SUBMIT 留痕 + 通知审批人。
     */
    private Map<String, Object> doSubmitApproval(PanelRegistry.PanelDef def, String no, String opinion) {
        Map<String, Object> st = docStatusOf(def.code(), no);
        // 修改态(文件类:申请修改经管理员审批通过)同样可提交审批,通过后 finalizeModify 再归档
        if (!"草稿".equals(st.get("status")) && !"修改中".equals(st.get("status")))
            throw new IllegalStateException("仅草稿或修改中状态可提交审批");
        String operator = currentUserName();
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET pending = 'Y', pending_by = ?, pending_at = GETDATE(), shr = NULL, shsj = NULL, canceled = 'N', approve_node = 1, l2_approver = NULL, update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, pending, pending_by, pending_at, canceled, approve_node, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), 'N', 1, GETDATE());",
                def.code(), no, operator, operator);
        recordApproval(def.code(), no, "SUBMIT", "PENDING", opinion);
        // 消息:提交审批 → 该面板审批人
        notify(() -> messageService.sendToApprovers(def.code(), MessageService.APPROVAL_SUBMITTED, no,
                Map.of("docNo", no, "actor", operator), operator));
        return result(no, "审批中");
    }

    /**
     * 审批通过(2026-09-20 起支持两级:见 TWO_LEVEL_PANELS)。
     *
     * 一级(节点 1):现有审批权口径(管理员 ∪ 角色 can_approve)通过 → **必须选取二级审核人**
     *   (载荷 key「二级审批人」= 账号,候选=全部启用账号;被选中即授权,不要求角色审批权),
     *   写回纸面「审核人（二级审批人）」,单据转「待二级审批」(pending 仍为 'Y',approve_node=2),
     *   **不归档**;被选人收 APPROVAL_L2_ASSIGNED 消息。
     * 二级(节点 2):**被选定的二级审核人本人 ∪ 管理员**通过 → 归档(归档面板)/已审核。
     *   二级节点不再要求 requireApprover:选取本身就是授权(cp 这类普通账号也因此能签核)。
     * 非两级面板(其余全部面板)走原单节点路径,逐字不变。
     */
    private Map<String, Object> approveApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        String operator = currentUserName();
        int node = pendingNodeOf(def.code(), no);
        if (node == 2) return approveSecond(def, no, operator, formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"审批中".equals(st.get("status"))) throw new IllegalStateException("仅审批中状态可审批通过");
        requirePendingSubmission(def.code(), no);
        requireApprover(def.code());
        // 编制审批分离(2026-09-12):审批人不得是提交人本人——此前有审批权的用户可批自己提交的单;
        // 管理员豁免(保存即归档本就是等价权力,且管理员提交后无他人可批会造死路)
        Object row = st.get("row");
        Object pendingBy = row instanceof Map<?, ?> mp ? ((Map<?, ?>) mp).get("pending_by") : null;
        String submitter = pendingBy == null ? "" : String.valueOf(pendingBy);
        if (!isAdminUser(operator) && operator.equals(submitter))
            throw new org.springframework.security.access.AccessDeniedException("审批人不能与提交人相同（编制与审批分离）");
        String opinion = opinionOf(formData);
        // ── 两级面板:一级通过 = 选二级审核人 + 转「待二级审批」,不归档 ──
        if (TWO_LEVEL_PANELS.contains(def.code())) {
            String l2 = pickOf(formData, "二级审批人");
            if (l2.isEmpty()) throw new IllegalStateException("一级审批通过前必须选取二级审核人");
            if (!isEnabledUser(l2)) throw new IllegalStateException("二级审核人账号不存在或已停用：" + l2);
            if (!isAdminUser(operator) && l2.equals(submitter))
                throw new IllegalStateException("二级审核人不能是提交人本人（编制与审批分离）");
            // 竞态守卫:WHERE 带 pending='Y' 且节点=1,双击/并发只有一次生效
            int n = jdbc.update("UPDATE yj_doc_status SET approve_node = 2, l2_approver = ?, update_at = GETDATE()"
                            + " WHERE panel_code = ? AND doc_no = ? AND pending = 'Y' AND ISNULL(approve_node,1) = 1",
                    l2, def.code(), no);
            if (n == 0) throw new IllegalStateException("单据已被审批或驳回，请刷新后查看");
            writeBackL2Approver(def.code(), no, l2);
            recordApproval(def.code(), no, "APPROVE_L1", "L1_PASSED", opinion, 1);
            final String l2f = l2;
            notify(() -> messageService.send(List.of(l2f), MessageService.APPROVAL_L2_ASSIGNED, def.code(), no,
                    Map.of("docNo", no, "actor", operator, "opinion", opinion == null ? "" : opinion), operator));
            return result(no, "待二级审批");
        }
        // 竞态守卫(2026-09-12):WHERE 带 pending='Y',双击/两审批人并发只有一次生效,不再重复留痕
        int n = jdbc.update("UPDATE yj_doc_status SET pending = 'N', shr = ?, shsj = GETDATE(), update_at = GETDATE()"
                        + " WHERE panel_code = ? AND doc_no = ? AND pending = 'Y'", operator, def.code(), no);
        if (n == 0) throw new IllegalStateException("单据已被审批或驳回，请刷新后查看");
        recordApproval(def.code(), no, "APPROVE", "APPROVED", opinion);
        // 产品变更申请单:审批通过即**生效**(2026-09-21 用户口径第⑤条)——状态转「已生效」,
        // 并按勾选的受控文件建下一版草稿(带来源单号)+ 通知各文件责任人重走受控审核
        if (CHANGE_PANEL.equals(def.code())) {
            jdbc.update("UPDATE yj_doc_status SET effective = 'Y', update_at = GETDATE() WHERE panel_code = ? AND doc_no = ?",
                    def.code(), no);
            String made = applyChangeEffect(no, operator);
            recordApproval(def.code(), no, "EFFECT", "APPLIED", "已生成下一版草稿：" + made);
            final String madeF = made;
            notify(() -> messageService.sendToAuthor(def.headTable(), def.code(), no, MessageService.APPROVAL_APPROVED,
                    Map.of("docNo", no, "actor", operator, "opinion", opinion == null ? "" : opinion, "effect", madeF), operator));
            return result(no, "已生效");
        }
        // 来料检验单审批通过(与「审核」同效为已审核) → 同样触发自动生单(2026-09-16 修复:
        // 此前钩子只挂在审核路径,走 提交审批→审批通过 的检验单不生成采购入库单/暂收退回单,
        // 用户只好点手工生单按钮,而手工路径实收数量映射错误且退回单被死过滤器挡住)
        inspAutoPurchaseIn(def.code(), no, operator);
        inspAutoReturn(def.code(), no, operator);
        // 特采行(2026-09-22):与「审核」同口径 —— 审批通过同样生成特采单;特采单审批通过则生成入库单
        inspAutoSpecialAccept(def.code(), no, operator);
        tcInApprovedGenerate(def.code(), no, operator);
        // 采购入库单走审批通过的同样取号回填(与「审核」钩子同口径,防走审批流时批次号取不到)
        assignBatchNoOnInbound(def.code(), no, operator);
        // 库存记账(2026-09-22 补):「审批通过」与「审核」同效为已审核,但此前只在审核路径过账 ——
        // 走 提交审批→审批通过 的库存单据(采购入库/产成品入库/材料出库等)漏记台账。
        // 与 audit() 同序:先确认批次号再过账;非记账面板 postIn 内部直接跳过。
        stockLedger.postIn(def.code(), no, operator);
        // 消息:审批通过 → 制单人
        notify(() -> messageService.sendToAuthor(def.hasHeadTable() ? def.headTable() : def.lineTable(),
                def.code(), no, MessageService.APPROVAL_APPROVED,
                Map.of("docNo", no, "actor", operator, "opinion", opinion == null ? "" : opinion), operator));
        // 文件类面板:审批通过后归档(修改闭环/弃审留痕走 finalizeOpenModify 收尾;随后统一归档)
        if (DOC_ARCHIVE_PANELS.contains(def.code())) {
            finalizeOpenModify(def, no, operator);
            markArchived(def.code(), no, operator);
            return result(no, "已归档");
        }
        return result(no, "已审核");
    }

    /** 二级审批通过:被选定的二级审核人 ∪ 管理员 → 归档(归档面板)/已审核 */
    private Map<String, Object> approveSecond(PanelRegistry.PanelDef def, String no, String operator, Map<String, Object> formData) {
        String l2 = l2ApproverOf(def.code(), no);
        if (!isAdminUser(operator) && (l2 == null || !l2.equals(operator)))
            throw new org.springframework.security.access.AccessDeniedException("仅被选定的二级审核人（或管理员）可完成二级审批");
        String opinion = opinionOf(formData);
        int n = jdbc.update("UPDATE yj_doc_status SET pending = 'N', shr = ?, shsj = GETDATE(), approve_node = NULL, update_at = GETDATE()"
                        + " WHERE panel_code = ? AND doc_no = ? AND pending = 'Y' AND approve_node = 2", operator, def.code(), no);
        if (n == 0) throw new IllegalStateException("单据已被审批或驳回，请刷新后查看");
        recordApproval(def.code(), no, "APPROVE", "APPROVED", opinion, 2);
        inspAutoPurchaseIn(def.code(), no, operator);
        inspAutoReturn(def.code(), no, operator);
        notify(() -> messageService.sendToAuthor(def.hasHeadTable() ? def.headTable() : def.lineTable(),
                def.code(), no, MessageService.APPROVAL_APPROVED,
                Map.of("docNo", no, "actor", operator, "opinion", opinion == null ? "" : opinion), operator));
        if (DOC_ARCHIVE_PANELS.contains(def.code())) {
            finalizeOpenModify(def, no, operator);
            markArchived(def.code(), no, operator);
            return result(no, "已归档");
        }
        return result(no, "已审核");
    }

    /** 审批驳回:仅审批中/待二级审批 → 草稿(意见必填,驳回后修改可重新提交)
     *  2026-09-20:两级面板任一级驳回都直接回草稿并通知制单人(口径:不退回上一级),节点标记一并清空。 */
    private Map<String, Object> rejectApproval(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        int node = pendingNodeOf(def.code(), no);
        if (node == 2) {
            // 二级节点:被选定的二级审核人 ∪ 管理员(不要求角色审批权,选取即授权)
            String l2 = l2ApproverOf(def.code(), no);
            String who = currentUserName();
            if (!isAdminUser(who) && (l2 == null || !l2.equals(who)))
                throw new org.springframework.security.access.AccessDeniedException("仅被选定的二级审核人（或管理员）可驳回二级审批");
        } else {
            requirePendingSubmission(def.code(), no);
            requireApprover(def.code());
        }
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"审批中".equals(st.get("status")) && !"待二级审批".equals(st.get("status")))
            throw new IllegalStateException("仅审批中或待二级审批状态可审批驳回");
        String opinion = opinionOf(formData);
        if (opinion.isEmpty()) throw new IllegalStateException("审批驳回必须填写审批意见");
        // 竞态守卫(2026-09-12):WHERE 带 pending='Y',并发驳回/通过只有一次生效
        int n = jdbc.update("UPDATE yj_doc_status SET pending = 'N', approve_node = NULL, update_at = GETDATE()"
                + " WHERE panel_code = ? AND doc_no = ? AND pending = 'Y'", def.code(), no);
        if (n == 0) throw new IllegalStateException("单据已被审批或驳回，请刷新后查看");
        recordApproval(def.code(), no, "REJECT", "REJECTED", opinion, node);
        // 消息:审批驳回 → 制单人(驳回意见随消息带上)
        String rejectBy = currentUserName();
        notify(() -> messageService.sendToAuthor(def.hasHeadTable() ? def.headTable() : def.lineTable(),
                def.code(), no, MessageService.APPROVAL_REJECTED,
                Map.of("docNo", no, "actor", rejectBy, "opinion", opinion), rejectBy));
        // 产品变更申请单:驳回还要通知**已填写的部门**(部门行的签字人 → 账号),他们会知道要重填(口径 E)
        if (CHANGE_PANEL.equals(def.code())) notifyChangeRejected(def, no, rejectBy, opinion);
        return result(no, "草稿");
    }

    /** 审批情况:返回该单据全部审批记录(时间升序) */
    private Map<String, Object> approvalHistory(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        Map<String, Object> out = new HashMap<>();
        out.put("编号", no);
        out.put("list", queryApprovalHistory(def.code(), no));
        return out;
    }

    /** 审批通过/驳回必须紧跟一次有效提交,防止仅改状态后伪造审批结果(light-mes requirePendingSubmission) */
    private void requirePendingSubmission(String panelCode, String formNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 action, result FROM yj_form_approval WHERE panel_code = ? AND form_no = ? ORDER BY id DESC",
                panelCode, formNo);
        if (rows.isEmpty() || !"SUBMIT".equals(rows.get(0).get("action"))
                || !"PENDING".equals(rows.get(0).get("result"))) {
            throw new IllegalStateException("单据尚未提交审批，不能审批通过或驳回");
        }
    }

    /** 审批权限:管理员,或角色对该面板勾了审批(yj_role_panel.can_approve='Y') */
    private void requireApprover(String panelCode) {
        if (!canApprove(currentUserName(), panelCode))
            throw new org.springframework.security.access.AccessDeniedException("当前用户无审批权限");
    }

    /** 审批判定:管理员恒可;普通用户按角色面板审批权(can_approve) */
    private boolean canApprove(String user, String panelCode) {
        if (isAdminUser(user)) return true;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                        + " WHERE u.username = ? AND rp.panel_code = ? AND rp.can_approve = 'Y'",
                Integer.class, user, panelCode);
        return n != null && n > 0;
    }

    private void recordApproval(String panelCode, String formNo, String action, String result, String opinion) {
        recordApproval(panelCode, formNo, action, result, opinion, 1);
    }

    /** 审批留痕(带节点号):node=1 一级 / node=2 二级(两级面板用) */
    private void recordApproval(String panelCode, String formNo, String action, String result, String opinion, int node) {
        jdbc.update("INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time) "
                        + "VALUES (?,?,?,?,?,?,?,SYSDATETIME())",
                panelCode, formNo, action, result, node, currentUserName(),
                opinion == null || opinion.isEmpty() ? null : opinion);
    }

    // ---- 两级审批公共件(2026-09-20)----

    /** 走两级审批的面板(当前试点只有产品信息表;其余面板单节点路径逐字不变) */
    private static final java.util.Set<String> TWO_LEVEL_PANELS = java.util.Set.of("RD_PROD_INFO");

    /** 当前待审批节点:1=待一级(缺省)/2=待二级;不在审批中返回 1 */
    private int pendingNodeOf(String panelCode, String no) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT approve_node, pending FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?", panelCode, no);
        if (rows.isEmpty()) return 1;
        Map<String, Object> r = rows.get(0);
        if (!"Y".equals(r.get("pending"))) return 1;
        return nodeOf(r);
    }

    /** approve_node 归一(空/0 都当 1) */
    private static int nodeOf(Map<String, Object> row) {
        Object v = row == null ? null : row.get("approve_node");
        if (v == null) return 1;
        int n = Integer.parseInt(String.valueOf(v));
        return n == 2 ? 2 : 1;
    }

    /** 该单据一级通过时选定的二级审核人账号(无则空串) */
    private String l2ApproverOf(String panelCode, String no) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 l2_approver FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?", panelCode, no);
        if (rows.isEmpty() || rows.get(0).get("l2_approver") == null) return "";
        return String.valueOf(rows.get(0).get("l2_approver")).trim();
    }

    /** 从载荷取一个字符串参数(去空白);键不存在返回空串 */
    private static String pickOf(Map<String, Object> formData, String key) {
        Object v = formData == null ? null : formData.get(key);
        return v == null ? "" : String.valueOf(v).trim();
    }

    /** 账号是否存在且启用 */
    private boolean isEnabledUser(String username) {
        if (username == null || username.isBlank()) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_user WHERE username = ? AND ISNULL(enabled,'1') = '1'", Integer.class, username);
        return n != null && n > 0;
    }

    /** 一级通过:把选定的二级审核人姓名写回纸面「审核人（二级审批人）」格 */
    private void writeBackL2Approver(String panelCode, String no, String l2Account) {
        if (!"RD_PROD_INFO".equals(panelCode)) return;
        List<String> names = jdbc.queryForList("SELECT real_name FROM yj_user WHERE username = ?", String.class, l2Account);
        String name = names.isEmpty() || names.get(0) == null ? l2Account : names.get(0);
        try {
            jdbc.update("UPDATE rd_prod_info_head SET 审核人二级 = ? WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    name, no);
        } catch (Exception e) {
            log.warn("[两级审批] 写回审核人二级失败 panel={} no={}: {}", panelCode, no, e.getMessage());
        }
    }

    private String opinionOf(Map<String, Object> formData) {
        Object v = formData == null ? null : formData.get("审批意见");
        return v == null ? "" : String.valueOf(v).trim();
    }

    public List<Map<String, Object>> queryApprovalHistory(String panelCode, String formNo) {
        return jdbc.query("SELECT action, result, node_no, operator, opinion, create_time FROM yj_form_approval"
                        + " WHERE panel_code = ? AND form_no = ? ORDER BY id ASC",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("action", rs.getString("action"));
                    m.put("result", rs.getString("result"));
                    m.put("operator", rs.getString("operator"));
                    m.put("opinion", rs.getString("opinion"));
                    m.put("nodeNo", rs.getInt("node_no"));
                    m.put("createTime", rs.getTimestamp("create_time") == null ? ""
                            : rs.getTimestamp("create_time").toLocalDateTime()
                            .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                    return m;
                }, panelCode, formNo);
    }

    /** 删除:单据=作废(仅草稿可删,对齐 light-mes);档案=当前行软删 */
    private Map<String, Object> delete(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (def.isDoc()) {
            String no = requireNo(formData);
            Map<String, Object> st = docStatusOf(def.code(), no);
            if (!"草稿".equals(st.get("status"))) throw new IllegalStateException("仅草稿状态可删除（已审核请先弃审）");
            return voidDoc(def, no, user);
        }
        Object no = formData.get("编号");
        if (no != null && !String.valueOf(no).isBlank()) {
            jdbc.update("UPDATE " + def.lineTable() + " SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()"
                    + " WHERE " + def.codeCol() + " = ?", user, no);
        }
        return result(String.valueOf(no), "已作废");
    }

    /** 单据作废(软删):yj_doc_status.canceled='Y' + 选单占用释放(文件类面板无流转,语义一致) */
    private Map<String, Object> voidDoc(PanelRegistry.PanelDef def, String no, String user) {
        // 参照守卫(2026-09-12):立项申请仍被实施计划/数据记录表引用时不可作废——
        // 此前作废只看自身状态,下游单据全部悬空,进度同步与数据记录关联失联。
        // 引用键=文档编号(下游单据存的是它),先把本单的编号解析成文档编号
        if ("RD_APPROVAL".equals(def.code())) {
            String refDocNo = approvalDocNoOf(no);
            if (refDocNo != null) ensureApprovalNotReferenced(refDocNo);
        }
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                + "WHEN MATCHED THEN UPDATE SET canceled = 'Y', cancel_by = ?, cancel_at = GETDATE(), update_at = GETDATE() "
                + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, cancel_by, cancel_at, update_at) "
                + "VALUES (s.panel_code, s.doc_no, 'Y', ?, GETDATE(), GETDATE());",
                def.code(), no, user, user);
        jdbc.update("UPDATE form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()"
                + " WHERE target_panel_code = ? AND target_form_no = ? AND link_status = 'ACTIVE'", def.code(), no);
        // 分批送料:作废**不回收**批次号与台账号(2026-09-21 口径 —— 批次号在采购入库单审核时已定,
        // 回收会让已编号批次重号;弃审/作废只作废单据,台账号原样保留,见 BatchService.RECYCLE_ON_RELEASE)
        batchService.releaseByTarget(def.code(), no);
        return result(no, "已作废");
    }

    /** 立项申请的文档编号(单据编号 → 文档编号;无/为空返回 null 不启用守卫) */
    private String approvalDocNoOf(String no) {
        try {
            List<String> rows = jdbc.queryForList(
                    "SELECT TOP 1 RTRIM([文档编号]) FROM rd_approval WHERE [单据编号] = ?", String.class, no);
            return rows.isEmpty() || rows.get(0) == null || rows.get(0).isBlank() ? null : rows.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    /** 立项作废参照守卫:该文档编号仍被非作废的实施计划/数据记录表单据引用时拒绝作废。
     *  引用口径与 progressDataSheets 一致:业务行存活(asp_cancel)且单据未作废(yj_doc_status.canceled)。 */
    private void ensureApprovalNotReferenced(String docNo) {
        List<String> refs = new ArrayList<>();
        Integer plans = jdbc.queryForObject(
                "SELECT COUNT(*) FROM rd_plan t WHERE t.[文档编号] = ? AND ISNULL(t.asp_cancel,'N') <> 'Y'"
                        + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'RD_PLAN'"
                        + " AND s.doc_no = t.[单据编号] AND ISNULL(s.canceled,'N') = 'Y')", Integer.class, docNo);
        if (plans != null && plans > 0) refs.add("项目实施计划 " + plans + " 张");
        for (String pc : DATARECORD_PANELS) {
            PanelRegistry.PanelDef d;
            try { d = registry.panel(pc); } catch (Exception e) { continue; }
            String table = d.hasHeadTable() ? d.headTable() : d.lineTable();
            Integer cnt = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM " + table + " t WHERE t.[文档编号] = ? AND ISNULL(t.asp_cancel,'N') <> 'Y'"
                            + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = '" + pc + "'"
                            + " AND s.doc_no = t.[" + d.groupCol() + "] AND ISNULL(s.canceled,'N') = 'Y')",
                    Integer.class, docNo);
            if (cnt != null && cnt > 0) refs.add(d.name() + " " + cnt + " 张");
        }
        if (!refs.isEmpty()) throw new IllegalStateException("该立项申请仍被引用，不可作废：" + String.join("，", refs)
                + "；请先作废或删除引用单据");
    }

    public void deleteForms(String panelCode, List<String> rowCodes) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        for (String code : rowCodes) {
            Map<String, Object> fd = new HashMap<>();
            fd.put("编号", code);
            delete(def, fd);
        }
    }

    /** 文件类面板删除:草稿直接作废;已归档单据需删除申请(待管理员审批),管理员可直接作废 */
    private Map<String, Object> deleteDocFile(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!def.isDoc()) return delete(def, formData);
        String no = requireNo(formData);
        ensureSpecAssignEditable(def, no, user); // 已分配规格书:删除/删除申请同样仅 责任人∪总负责人∪管理员
        if (DevTaskService.devPanelCodes().contains(def.code())) ensureDevFileEditable(def, no, null, user); // 四文件门禁同口径
        String st = String.valueOf(docStatusOf(def.code(), no).get("status"));
        if ("删除申请中".equals(st)) throw new IllegalStateException("删除申请已提交，待管理员审核");
        if ("草稿".equals(st)) return delete(def, formData);
        if (isAdminUser(user)) return voidDoc(def, no, user);
        int n = jdbc.update("UPDATE yj_doc_status SET deleting='Y', delete_req_by=?, delete_req_at=GETDATE(), update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=?", user, def.code(), no);
        if (n == 0) throw new IllegalStateException("单据不存在或状态已变更");
        // 消息:申请删除 → 管理员
        notify(() -> messageService.sendToAdmins(def.code(), no, MessageService.DELETE_REQUESTED,
                Map.of("docNo", no, "actor", user), user));
        return result(no, "删除申请中");
    }

    /** 删除申请审批通过(仅管理员):单据作废 */
    private Map<String, Object> approveDelete(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!canApprove(user, def.code())) throw new IllegalStateException("当前角色无该面板的删除审批权限");
        String no = requireNo(formData);
        // 发起人先取(作废后回查不便),意见随留痕与通知带上(2026-09-12:此前留痕/通知双双缺位)
        String reqBy = requestByOf(def.code(), no, "delete_req_by");
        String opinion = opinionOf(formData);
        int n = jdbc.update("UPDATE yj_doc_status SET canceled='Y', cancel_by=?, cancel_at=GETDATE(), deleting='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND deleting='Y'", user, def.code(), no);
        if (n == 0) throw new IllegalStateException("无待审批的删除申请");
        recordApproval(def.code(), no, "DELETE_APPROVE", "APPROVED", opinion);
        // 作废同步释放选单占用(与草稿作废 voidDoc 同口径,2026-09-12:此前审批作废不释放,来源行永久占死)
        jdbc.update("UPDATE form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()"
                + " WHERE target_panel_code = ? AND target_form_no = ? AND link_status = 'ACTIVE'", def.code(), no);
        batchService.releaseByTarget(def.code(), no); // 分批送料:同 voidDoc,不回收批次号/台账号(2026-09-21 口径)
        // 消息:审批结果 → 删除申请人
        if (!reqBy.isBlank()) notify(() -> messageService.send(List.of(reqBy), MessageService.DELETE_APPROVED, def.code(), no,
                Map.of("docNo", no, "actor", user, "opinion", opinion), user));
        return result(no, "已作废");
    }

    /** 删除申请驳回(仅管理员):恢复归档状态(返回回查的真实状态,不硬编码) */
    private Map<String, Object> rejectDelete(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!canApprove(user, def.code())) throw new IllegalStateException("当前角色无该面板的删除审批权限");
        String no = requireNo(formData);
        String reqBy = requestByOf(def.code(), no, "delete_req_by");
        String opinion = opinionOf(formData);
        int n = jdbc.update("UPDATE yj_doc_status SET deleting='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND deleting='Y'", def.code(), no);
        if (n == 0) throw new IllegalStateException("无待审批的删除申请");
        recordApproval(def.code(), no, "DELETE_REJECT", "REJECTED", opinion);
        if (!reqBy.isBlank()) notify(() -> messageService.send(List.of(reqBy), MessageService.DELETE_REJECTED, def.code(), no,
                Map.of("docNo", no, "actor", user, "opinion", opinion), user));
        return result(no, String.valueOf(docStatusOf(def.code(), no).get("status")));
    }

    // ---- 卡死单据出口(2026-09-11):删除/修改申请提交后无人审批时,发起人或审批人可撤回 ----

    /** 撤回删除申请:删除申请中 → 回到真实状态(发起人本人或审批人;清 deleting 并留痕) */
    private Map<String, Object> withdrawDeleteRequest(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"删除申请中".equals(st.get("status"))) throw new IllegalStateException("仅删除申请中状态可撤回删除申请");
        requireRequesterOrApprover(def.code(), no, "delete_req_by", user);
        int n = jdbc.update("UPDATE yj_doc_status SET deleting='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND deleting='Y'", def.code(), no);
        if (n == 0) throw new IllegalStateException("无待撤回的删除申请");
        recordApproval(def.code(), no, "DELETE_WITHDRAW", "WITHDRAWN", "撤回人：" + user);
        return result(no, String.valueOf(docStatusOf(def.code(), no).get("status")));
    }

    /** 撤回修改申请:修改申请中 → 回到真实状态(发起人本人或审批人;清 modify_state 并留痕) */
    private Map<String, Object> withdrawModifyRequest(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"修改申请中".equals(st.get("status"))) throw new IllegalStateException("仅修改申请中状态可撤回修改申请");
        requireRequesterOrApprover(def.code(), no, "modify_req_by", user);
        int n = jdbc.update("UPDATE yj_doc_status SET modify_state=NULL, update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND modify_state='R'", def.code(), no);
        if (n == 0) throw new IllegalStateException("无待撤回的修改申请");
        recordApproval(def.code(), no, "MODIFY_WITHDRAW", "WITHDRAWN", "撤回人：" + user);
        return result(no, String.valueOf(docStatusOf(def.code(), no).get("status")));
    }

    /** 撤回权限:该申请的发起人本人(reqByCol),或该面板审批人(管理员恒可) */
    private void requireRequesterOrApprover(String panelCode, String no, String reqByCol, String user) {
        if (user.equals(requestByOf(panelCode, no, reqByCol))) return;
        if (!canApprove(user, panelCode))
            throw new org.springframework.security.access.AccessDeniedException("仅申请人本人或审批人可撤回该申请");
    }

    /** 申请发起人(delete_req_by / modify_req_by):撤回权限判定用;列名由本类常量传入,非外部输入 */
    private String requestByOf(String panelCode, String no, String col) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT " + col + " FROM yj_doc_status WHERE panel_code=? AND doc_no=?", panelCode, no);
        return rows.isEmpty() || rows.get(0).get(col) == null ? "" : String.valueOf(rows.get(0).get(col));
    }

    // ============ 文件类面板:归档后申请修改 + 修改记录(全量留痕,展示取最近3条) ============

    /** 新增库存(库存状况):向 kucun 插一行记录;存货编码/仓库编码按基础档案校验(绑定编码,改名不影响) */
    private Map<String, Object> addStock(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"STOCK_STATUS".equals(def.code())) throw new IllegalStateException("仅库存状况面板支持新增库存");
        String user = currentUserName();
        String wzdm = requiredText(formData, "存货编码");
        String ckdm = requiredText(formData, "仓库");
        String ylRaw = requiredText(formData, "现存量");
        double yl;
        try {
            yl = Double.parseDouble(ylRaw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("现存量必须是数字");
        }
        String lot = optionalText(formData, "批号");
        String inDate = optionalText(formData, "入库日期");
        String warnRaw = optionalText(formData, "预警数量");
        Double warn = null;
        if (!warnRaw.isBlank()) {
            try {
                warn = Double.parseDouble(warnRaw);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("预警数量必须是数字");
            }
        }
        Integer inv = jdbc.queryForObject(
                "SELECT COUNT(*) FROM bs_inv WHERE [存货编码] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, wzdm);
        if (inv == null || inv == 0) throw new IllegalArgumentException("存货档案中不存在：" + wzdm);
        Integer wh = jdbc.queryForObject(
                "SELECT COUNT(*) FROM bs_wh WHERE [仓库编码] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, ckdm);
        if (wh == null || wh == 0) throw new IllegalArgumentException("仓库档案中不存在：" + ckdm);
        jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, [预警数量], asp_user1, asp_time1, asp_cancel)"
                        + " VALUES (?,?,?,?,?,?,0,?,?,GETDATE(),'N')",
                wzdm, ckdm, lot.isBlank() ? null : lot, inDate.isBlank() ? LocalDate.now().toString() : inDate,
                yl, yl, warn, user);
        return result(wzdm + "@" + ckdm, "已新增");
    }

    /**
     * 生成产品批号(生产工单):成型后打印产品二维码的数据源。
     * 批号=入库日期+3位流水(与材料批号同一号池);一次生成终身复用,重复调用返回已有批号。
     */
    private Map<String, Object> genProductLot(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"WO_ORDER".equals(def.code())) throw new IllegalStateException("仅生产工单支持生成产品批号");
        String no = requireNo(formData);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT [产品批号] FROM wo_order WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (rows.isEmpty()) throw new IllegalStateException("工单不存在:" + no);
        Object cur = rows.get(0).get("产品批号");
        String lot = cur == null || String.valueOf(cur).isBlank() ? null : String.valueOf(cur).trim();
        if (lot == null) {
            lot = lotSeqService.next();
            jdbc.update("UPDATE wo_order SET [产品批号] = ? WHERE [单据编号] = ?", lot, no);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", no);
        out.put("产品批号", lot);
        return out;
    }

    /**
     * 切炭双出口(流程图已确认:合格品一部分直销入成品仓,其余继续组装):
     * 切炭报工单审核后,若[直销数量]>0 → 自动生成成品入库单(成品仓,带产品批号)并审核入账;
     * 完成数量仍全额累计切炭进度(直销+组装都在切炭完成量内)。
     * 幂等:经 form_flow_link 占用,同一报工单重审不重复生成;弃审报工不自动冲回入库单(需单独弃审入库单)。
     */
    private void dualOutFinishIn(String panelCode, String no, String user) {
        if (!"WO_REPORT".equals(panelCode)) return;
        List<Map<String, Object>> reps = jdbc.queryForList(
                "SELECT [工单号], [工序], [报工数量], [直销数量] FROM wo_report WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (reps.isEmpty()) return;
        Map<String, Object> rep = reps.get(0);
        if (!"切炭".equals(String.valueOf(rep.get("工序")))) return;
        double dual = numOr(rep.get("直销数量"));
        if (dual <= 0) return;
        double done = numOr(rep.get("报工数量"));
        if (dual > done + 0.0001) throw new IllegalStateException("直销数量(" + dual + ")不能大于报工数量(" + done + ")");
        Integer linked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code = 'WO_REPORT' AND source_form_no = ?"
                        + " AND target_panel_code = 'FINISH_IN' AND link_status = 'ACTIVE'", Integer.class, no);
        if (linked != null && linked > 0) return; // 已生成过直销入库(重审幂等)
        String wo = String.valueOf(rep.get("工单号"));
        List<Map<String, Object>> ws = jdbc.queryForList(
                "SELECT [产品编码], [产品名称], [单位], [产品批号] FROM wo_order WHERE [单据编号] = ?", wo);
        if (ws.isEmpty()) throw new IllegalStateException("工单不存在:" + wo);
        Map<String, Object> w = ws.get(0);
        Object lotObj = w.get("产品批号");
        String lot = lotObj == null || String.valueOf(lotObj).isBlank() ? null : String.valueOf(lotObj).trim();
        if (lot == null) {
            lot = lotSeqService.next();
            jdbc.update("UPDATE wo_order SET [产品批号] = ? WHERE [单据编号] = ?", lot, wo);
        }
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("产品编码", w.get("产品编码"));
        line.put("产品名称", w.get("产品名称"));
        line.put("实收数量", dual);
        line.put("计量单位", w.get("单位"));
        line.put("批号", lot);
        line.put("仓库", "成品仓");
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString());
        head.put("仓库", "成品仓");
        head.put("生产车间", "切炭车间");
        head.put("加工单号", wo);
        head.put("经手人", user);
        head.put("detail", Map.of("items", List.of(line)));
        Map<String, Object> saved = save(registry.panel("FINISH_IN"), head, false);
        String fiNo = String.valueOf(saved.get("编号"));
        audit(registry.panel("FINISH_IN"), Map.of("编号", (Object) fiNo));
        jdbc.update("INSERT INTO form_flow_link (source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, link_status, create_by, create_time)"
                        + " VALUES ('WO_REPORT', ?, '', 'FINISH_IN', ?, 'ACTIVE', ?, GETDATE())", no, fiNo, user);
    }

    private static double numOr(Object o) {
        if (o == null || String.valueOf(o).isBlank()) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }

    // ==================== 来料检验单审核 → 自动生成采购入库单(2026-09-15) ====================

    // ============ 分批送料批次号:入库审核取号回填(2026-09-21 取号时机迁移) ============

    /**
     * 采购入库单审核(或审批通过)时:顺「批次键」找到批次台账行 → 取号并回填全链。
     *
     * 口径(用户定稿):批次号 = yyyyMMdd + 两位序号(日期取**送料当天**);唯一性范围 =
     * 采购订单号 + 批次号;取号 = 同订单同送料日「已用最大序号 + 1」;弃审/作废**不回收**。
     * 审核之前链路上所有单据的批次号留空 —— 空值由本钩子一次性补齐,不是"漏填"。
     * 无「批次键」的入库单(历史单/手工单)直接跳过,不动其批次号(历史 YJ- 格式号原样保留)。
     */
    private void assignBatchNoOnInbound(String panelCode, String no, String user) {
        if (!"PURCHASE_IN".equals(panelCode)) return;
        int batchId = batchService.findPendingBatchId(panelCode, no);
        if (batchId <= 0) return;
        batchService.assignNoAndBackfill(batchId, user);
        // 批次号回填全链后,把检验目录里挂靠该检验单的空批次号补齐(2026-09-22 用户口径:批次号靠回填得到)
        try {
            qcCatalog.refreshBatchNosFromInsp();
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(ButtonService.class)
                    .warn("[QC目录] 批次号回填目录失败(不影响入库审核): {}", e.getMessage());
        }
    }

    /**
     * 来料检验单(QC_INSP)审核后,把 合格数量>0 的明细行自动生成采购入库单(PURCHASE_IN)草稿:
     * 实收数量=合格数量;存货编码/存货名称/规格型号 ← 物料编码/物料名称/型号;行仓库 ← 仓库代码;
     * 计量单位/单价随行带入(2026-09-17 补单价——此前清单漏列致入库单单价断流);
     * 头带入 供应商/供应商编码(供应商代码),外部单据号与来源单号=检验单号;单据日期=创建当日不继承。
     * 2026-09-20:随链带入 头 采购订单号 + 行 采购订单行号(检验单上由送料暂收单带下来的同一对字段),
     * 使采购入库单具备金蝶源单关联(转ERP 时 src_bill_no/src_seq)——此前该对字段只走选单路径会丢。
     * 行级占用写 form_flow_link(source_quantity=数量,linked_quantity=合格数量,余量=不良部分,
     * 供后续暂收退回链使用)并回填检验行 入库单号。幂等:已有 ACTIVE 占用(重审)跳过;
     * 无合格数量的行不生成(全不良/未检完的检验单审核不产生空入库单)。
     * 生成的入库单留草稿由仓库确认审核(不自动记账,对齐 编制/审核分离)。
     */
    private void inspAutoPurchaseIn(String panelCode, String no, String user) {
        if (!"QC_INSP".equals(panelCode)) return;
        Integer linked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=?"
                        + " AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'", Integer.class, no);
        if (linked != null && linked > 0) return; // 已自动生单(重审幂等;下游作废释放后可再生成)
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, 物料编码, 物料名称, ISNULL(NULLIF(规格型号, N''), 型号) AS 规格型号, 数量, 合格数量, 仓库代码, 计量单位, 单价, 采购订单行号,"
                        + " 送检数量, 部门名称, 生产日期, 备注, CAST(ISNULL(特采,0) AS int) AS 特采"
                        + " FROM qc_insp_detail"
                        // 特采行(2026-09-22 口径)不直接生成入库单 —— 走特采单闸门(inspAutoSpecialAccept),
                        // 特采单审核通过后由 tcInApprovedGenerate 整行(合格+不合格)生成入库单
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(特采,0) = 0 ORDER BY id", no);
        List<Map<String, Object>> pass = rows.stream()
                .filter(r -> numOr(r.get("合格数量")) > 0).toList();
        if (pass.isEmpty()) return;
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT 供应商代码, 供应商, 采购订单号, 批次号, 批次键"
                        + " FROM qc_insp"
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (heads.isEmpty()) throw new IllegalStateException("检验单头不存在:" + no);
        Map<String, Object> h = heads.get(0);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : pass) {
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("存货编码", r.get("物料编码"));
            line.put("存货名称", r.get("物料名称"));
            line.put("规格型号", r.get("规格型号"));
            line.put("实收数量", r.get("合格数量"));
            line.put("计量单位", r.get("计量单位"));
            if (r.get("单位") != null) line.put("单位", r.get("单位")); // 退回行另有「单位」列(2026-09-21 补齐,原先只写计量单位 → 单位全空)
            line.put("单价", r.get("单价"));
            // 是否来料检验:本单由**来料检验单**审核自动生成 → 该批物料走过检验 = 是
            // (免检直达的入库单由采购订单生单,写「否」,见 PushGenerateHandler.applySourceFlags)
            line.put("是否来料检验", "是");
            // 特采(2026-09-23 用户口径):与检验行「特采」同源 —— 本路径只收**未勾特采**的行
            // (上面 WHERE 已排除 ISNULL(特采,0)=1),故恒为「否」;勾了特采的行走特采单闸门
            // (inspAutoSpecialAccept → 特采单审核 → tcInApprovedGenerate),由那条路径写「是」
            line.put("特采", numOr(r.get("特采")) != 0 ? "是" : "否");
            // 采购入库单补齐(2026-09-21 用户口径「保证采购入库单完整」):送检数量/部门名称/生产日期/行备注随链带入
            line.put("送检数量", r.get("送检数量"));
            if (r.get("部门名称") != null) line.put("部门名称", r.get("部门名称"));
            if (r.get("生产日期") != null) line.put("生产日期", r.get("生产日期"));
            if (r.get("备注") != null) line.put("备注", r.get("备注"));
            // 采购订单行号 → 采购入库行(列 源单行号,标签 采购订单行号):转ERP 时推 src_seq
            if (r.get("采购订单行号") != null) line.put("采购订单行号", r.get("采购订单行号"));
            // 批次号随链带入采购入库行(2026-09-20 分批送料:同一批次可反查四单)
            if (h.get("批次号") != null && !String.valueOf(h.get("批次号")).isBlank()) line.put("批次号", h.get("批次号"));
            // 行仓库(2026-09-23 正名):检验行「仓库代码」的值(名称形)落入库行「仓库」——
            // 单据选仓库字段已全局统一叫「仓库」(migrate-wh-field-rename),参照/必填/推送兜底同列
            Object wh = r.get("仓库代码");
            if (wh != null && !String.valueOf(wh).isBlank()) line.put("仓库", wh);
            items.add(line);
        }
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString()); // 创建当日,不继承检验单日期(2026-09-17 口径)
        head.put("供应商", h.get("供应商"));
        head.put("供应商编码", h.get("供应商代码"));
        // 采购订单号随链带入(送料暂收 → 来料检验 → 采购入库),空则不带(选单免检路径由映射带入)
        if (h.get("采购订单号") != null && !String.valueOf(h.get("采购订单号")).isBlank()) {
            head.put("采购订单号", h.get("采购订单号"));
        }
        if (h.get("批次号") != null && !String.valueOf(h.get("批次号")).isBlank()) head.put("批次号", h.get("批次号"));
        // 批次键随链带入(2026-09-21 取号时机迁移):入库审核时凭它取号并回填全链。
        // 批次号此时**一律留空**(检验单审核时还没取号),故上面那行对新单不写值、只兼容历史单。
        if (h.get("批次键") != null) head.put("批次键", h.get("批次键"));
        head.put("外部单据号", no);
        head.put("来源单据", "来料检验单");
        head.put("来源单号", no);
        head.put("detail", Map.of("items", items));
        Map<String, Object> saved = save(registry.panel("PURCHASE_IN"), head, false);
        String piNo = String.valueOf(saved.get("编号"));
        // 行级占用 + 入库单号回填(目标行按保存顺序取 id,与 pass 一一对应)
        List<Integer> tgtIds = jdbc.queryForList(
                "SELECT id FROM bl_purchase_in WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id",
                Integer.class, piNo);
        for (int i = 0; i < pass.size() && i < tgtIds.size(); i++) {
            Map<String, Object> r = pass.get(i);
            jdbc.update("INSERT INTO form_flow_link (source_panel_code, source_form_no, source_line_key,"
                            + " target_panel_code, target_form_no, target_line_key, inventory_code,"
                            + " source_quantity, linked_quantity, batch_no, batch_id, link_status, create_by)"
                            + " VALUES ('QC_INSP', ?, ?, 'PURCHASE_IN', ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)",
                    no, no + "#" + r.get("id"), piNo, piNo + "#" + tgtIds.get(i), r.get("物料编码"),
                    r.get("数量"), r.get("合格数量"), h.get("批次号"), h.get("批次键"), user);
            jdbc.update("UPDATE qc_insp_detail SET 入库单号 = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                    piNo, user, r.get("id"));
        }
    }

    /**
     * 来料检验单(QC_INSP)审核后,把 不良数量>0 的明细行自动生成暂收退回单(QC_RETURN)草稿(2026-09-16):
     * 退货数量=不良数量;物料编码/物料名称/规格型号/计量单位/单价/备注 ← 检验行;
     * 头带入 业务员/供应商代码/供应商/部门/部门名称 + **采购订单号**(2026-09-20 随链下传,便于退回单追溯到原订单);
     * 行带入 **采购订单行号**;单据日期=创建当日不继承(2026-09-17 口径)。
     * 行级占用写 form_flow_link(QC_INSP→QC_RETURN,source_quantity=数量,linked_quantity=不良数量,
     * 与采购入库单的 合格 占用并行,余量=待检部分)。幂等:已有 ACTIVE 占用(重审)跳过;
     * 无不良数量的行不生成(不产生空退回单)。检验明细无「退回单号」列,不做回填(入库侧回填见 inspAutoPurchaseIn)。
     * 生成的退回单留草稿由业务确认审核。
     *
     * 2026-09-20 修正三处「写了但落不了」的字段(标签与目标面板不一致/目标列缺失,保存时被静默忽略):
     *   ① 数量 → **退货数量**(QC_RETURN 行的数量字段叫退货数量,原先写「数量」→ 退货数量恒空);
     *   ② 型号 → **规格型号**(退回行字段叫规格型号);
     *   ③ 计量单位/单价:退回行原先**没有这两列**(本迁移已补),否则与 ② 同样丢弃。
     */
    private void inspAutoReturn(String panelCode, String no, String user) {
        if (!"QC_INSP".equals(panelCode)) return;
        Integer linked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=?"
                        + " AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'", Integer.class, no);
        if (linked != null && linked > 0) return; // 已自动生单(重审幂等;下游作废释放后可再生成)
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, 物料编码, 物料名称, ISNULL(NULLIF(规格型号, N''), 型号) AS 规格型号, 数量, 不良数量, 备注, 单位, 计量单位, 单价, 采购订单行号"
                        + " FROM qc_insp_detail"
                        // 特采行(2026-09-22 口径)不生成退料单 —— 特采=让步接收,全部数量经特采单进采购入库单
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(特采,0) = 0 ORDER BY id", no);
        List<Map<String, Object>> defect = rows.stream()
                .filter(r -> numOr(r.get("不良数量")) > 0).toList();
        if (defect.isEmpty()) return;
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT 业务员, 供应商代码, 供应商, 部门, 部门名称, 采购订单号, 批次号, 批次键 FROM qc_insp"
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (heads.isEmpty()) throw new IllegalStateException("检验单头不存在:" + no);
        Map<String, Object> h = heads.get(0);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : defect) {
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("物料编码", r.get("物料编码"));
            line.put("物料名称", r.get("物料名称"));
            line.put("规格型号", r.get("规格型号"));   // 退回行字段=规格型号(原写「型号」落不下)
            line.put("退货数量", r.get("不良数量")); // 退回行数量字段=退货数量(原写「数量」落不下)
            line.put("计量单位", r.get("计量单位"));
            if (r.get("单位") != null) line.put("单位", r.get("单位")); // 退回行另有「单位」列(2026-09-21 补齐,原先只写计量单位 → 单位全空)
            line.put("单价", r.get("单价"));
            if (r.get("采购订单行号") != null) line.put("采购订单行号", r.get("采购订单行号"));
            // 批次号随链带入退回行(2026-09-20 分批送料:退回不回冲送货量,但批次号要能追到同一批)
            if (h.get("批次号") != null && !String.valueOf(h.get("批次号")).isBlank()) line.put("批次号", h.get("批次号"));
            Object m = r.get("备注");
            if (m != null && !String.valueOf(m).isBlank()) line.put("备注", String.valueOf(m));
            items.add(line);
        }
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString()); // 创建当日,不继承检验单日期(2026-09-17 口径)
        head.put("业务员", h.get("业务员"));
        head.put("供应商代码", h.get("供应商代码"));
        head.put("供应商", h.get("供应商"));
        head.put("部门", h.get("部门"));
        head.put("部门名称", h.get("部门名称"));
        // 采购订单号随链带入(采购订单→送料暂收→来料检验→暂收退回),空则不带
        if (h.get("采购订单号") != null && !String.valueOf(h.get("采购订单号")).isBlank()) {
            head.put("采购订单号", h.get("采购订单号"));
        }
        if (h.get("批次号") != null && !String.valueOf(h.get("批次号")).isBlank()) head.put("批次号", h.get("批次号"));
        head.put("检验单号", no); // 头「检验单号」=来源检验单(参照字段存单号)
        head.put("detail", Map.of("items", items));
        Map<String, Object> saved = save(registry.panel("QC_RETURN"), head, false);
        String thNo = String.valueOf(saved.get("编号"));
        // 行级占用(目标行按保存顺序取 id,与 defect 一一对应)
        List<Integer> tgtIds = jdbc.queryForList(
                "SELECT id FROM qc_return_detail WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id",
                Integer.class, thNo);
        for (int i = 0; i < defect.size() && i < tgtIds.size(); i++) {
            Map<String, Object> r = defect.get(i);
            jdbc.update("INSERT INTO form_flow_link (source_panel_code, source_form_no, source_line_key,"
                            + " target_panel_code, target_form_no, target_line_key, inventory_code,"
                            + " source_quantity, linked_quantity, batch_no, batch_id, link_status, create_by)"
                            + " VALUES ('QC_INSP', ?, ?, 'QC_RETURN', ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)",
                    no, no + "#" + r.get("id"), thNo, thNo + "#" + tgtIds.get(i), r.get("物料编码"),
                    r.get("数量"), r.get("不良数量"), h.get("批次号"), h.get("批次键"), user);
        }
    }

    /** 来料检验单弃审联动:自动生成的采购入库单/暂收退回单草稿 → 作废留痕+释放占用+清 入库单号 回填;
     *  已审核则拒绝弃审(先弃审该下游单),防止库存已入账/退货已确认而检验单被弃审的错位。 */
    private void inspUnauditCascade(String panelCode, String no, String user) {
        if (!"QC_INSP".equals(panelCode)) return;
        List<String> piNos = jdbc.queryForList(
                "SELECT DISTINCT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=?"
                        + " AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'", String.class, no);
        for (String piNo : piNos) {
            String st = String.valueOf(docStatusOf("PURCHASE_IN", piNo).get("status"));
            if ("草稿".equals(st) || "修改中".equals(st)) {
                voidDoc(registry.panel("PURCHASE_IN"), piNo, user);
            } else {
                throw new IllegalStateException("自动生成的采购入库单 " + piNo + " 已审核,请先弃审该入库单再弃审检验单");
            }
            jdbc.update("UPDATE qc_insp_detail SET 入库单号 = NULL, asp_user2 = ?, asp_time2 = GETDATE()"
                    + " WHERE 单据编号 = ? AND 入库单号 = ?", user, no, piNo);
        }
        // 暂收退回单(2026-09-16 自动生单):同口径联动——草稿作废释放,已审核则挡弃审;
        // 检验明细无「退回单号」列,无回填可清
        List<String> thNos = jdbc.queryForList(
                "SELECT DISTINCT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=?"
                        + " AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'", String.class, no);
        for (String thNo : thNos) {
            String st = String.valueOf(docStatusOf("QC_RETURN", thNo).get("status"));
            if ("草稿".equals(st) || "修改中".equals(st)) {
                voidDoc(registry.panel("QC_RETURN"), thNo, user);
            } else {
                throw new IllegalStateException("自动生成的暂收退回单 " + thNo + " 已审核,请先弃审该退回单再弃审检验单");
            }
        }
        // 特采单(2026-09-22 特采闸门):草稿作废释放;已审核(已生成入库单)则挡弃审 —— 先弃审那张入库单
        List<String> tcNos = jdbc.queryForList(
                "SELECT DISTINCT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=?"
                        + " AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'", String.class, no);
        for (String tcNo : tcNos) {
            String st = String.valueOf(docStatusOf("QC_TC_IN", tcNo).get("status"));
            if ("草稿".equals(st) || "修改中".equals(st)) {
                voidDoc(registry.panel("QC_TC_IN"), tcNo, user);
            } else {
                throw new IllegalStateException("特采单 " + tcNo + " 已审核(已生成采购入库单),请先弃审该入库单再弃审检验单");
            }
        }
    }

    // ==================== 特采闸门:检验行 → 特采单 → 采购入库单(2026-09-22) ====================

    /**
     * 来料检验单审核/审批通过后,把**勾了特采**的明细行逐行生成特采单(QC_TC_IN)草稿(一物料一单):
     * - 这些行不生成采购入库单/暂收退回单(见 inspAutoPurchaseIn / inspAutoReturn 的特采排除);
     * - 头带出:供应商 / 采购单号(=采购订单号) / 产品名称(=物料名称) / 总数量(=合格+不合格,全部走特采)
     *   / 不合格品数量(=不合格数量) / 不合格品比例(自动算) / 检验单号 / 批次键(链路隐藏列);
     *   物料编码与规格型号写进「备注」供编制人参考(特采单纸面 YJ-QR-60 无物料编码栏);
     * - 行级占用写 form_flow_link(QC_INSP→QC_TC_IN,linked_quantity=合格+不合格):剩余量被吃掉,
     *   选单/推式路径因此天然看不到该行 —— 与「特采行不得直接进入库/退料」的闸门口径一致;
     * - 生成的特采单留草稿,业务补 特采理由/各部门意见 后**审核=审批通过**(tcInApprovedGenerate)。
     * 幂等:该检验行已有 ACTIVE 特采单占用(重审)跳过。
     */
    private void inspAutoSpecialAccept(String panelCode, String no, String user) {
        if (!"QC_INSP".equals(panelCode)) return;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, 物料编码, 物料名称, ISNULL(NULLIF(规格型号, N''), 型号) AS 规格型号, 送检数量,"
                        + " 合格数量, ISNULL(NULLIF(不合格数量, 0), 不良数量) AS 不合格数量, 计量单位"
                        + " FROM qc_insp_detail"
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(特采,0) = 1 ORDER BY id", no);
        if (rows.isEmpty()) return;
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT 供应商, 采购订单号, 批次键 FROM qc_insp"
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (heads.isEmpty()) throw new IllegalStateException("检验单头不存在:" + no);
        Map<String, Object> h = heads.get(0);
        for (Map<String, Object> r : rows) {
            double ok = numOr(r.get("合格数量"));
            double bad = numOr(r.get("不合格数量"));
            double tot = ok + bad;
            if (tot <= 0.000001) continue;                          // 该行没有数量可特采
            Integer linked = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_line_key=?"
                            + " AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'",
                    Integer.class, no + "#" + r.get("id"));
            if (linked != null && linked > 0) continue;             // 重审幂等:该行已有特采单
            Map<String, Object> head = new LinkedHashMap<>();
            head.put("单据日期", LocalDate.now().toString());
            head.put("供应商", h.get("供应商"));
            if (h.get("采购订单号") != null && !String.valueOf(h.get("采购订单号")).isBlank()) {
                head.put("采购单号", h.get("采购订单号"));
            }
            head.put("产品名称", r.get("物料名称"));
            head.put("不合格品数量", bad);
            head.put("不合格品比例", trimZero(Math.round(bad / tot * 1000.0) / 10.0) + "%");
            // 总数量 = 数值+单位拼合(2026-09-24 用户口径:三面板数量与单位合在一起,不拆列;
            // 列已改 nvarchar。计量单位列保留隐藏做链路)。生成入库时按前缀数字解析(见 tcInApprovedGenerate)
            String tcUnit = r.get("计量单位") != null ? String.valueOf(r.get("计量单位")) : "";
            head.put("总数量", trimZero(tot) + tcUnit);
            head.put("检验单号", no);                                // 隐藏链路列
            if (h.get("批次键") != null) head.put("批次键", h.get("批次键"));
            head.put("备注", "特采行:物料编码=" + r.get("物料编码") + ",规格型号=" + r.get("规格型号")
                    + ";合格 " + trimZero(ok) + " / 不合格 " + trimZero(bad));
            Map<String, Object> saved = save(registry.panel("QC_TC_IN"), head, false);
            String tcNo = String.valueOf(saved.get("编号"));
            jdbc.update("INSERT INTO form_flow_link (source_panel_code, source_form_no, source_line_key,"
                            + " target_panel_code, target_form_no, target_line_key, inventory_code,"
                            + " source_quantity, linked_quantity, batch_id, link_status, create_by)"
                            + " VALUES ('QC_INSP', ?, ?, 'QC_TC_IN', ?, NULL, ?, ?, ?, ?, 'ACTIVE', ?)",
                    no, no + "#" + r.get("id"), tcNo, r.get("物料编码"),
                    r.get("送检数量"), tot, h.get("批次键"), user);
        }
    }

    /**
     * 特采单(QC_TC_IN)审核=审批通过 → 自动生成**一张采购入库单**(2026-09-22 用户口径:
     * 特采=让步接收,**全部数量入库、不走退料**):
     * - 仅对「由检验行生成」的特采单生效(链路上有 QC_INSP→QC_TC_IN 的 ACTIVE 占用);
     *   纯手工新建的特采单不自动生成(无检验行/采购订单上下文,避免凭空入库);
     * - 数量 = 特采单「总数量」(审批人可在特采单上改数后批准,按批准值入库);
     * - 头/行对齐 inspAutoPurchaseIn(供应商/供应商编码/采购订单号/批次键/外部单据号=检验单号),
     *   行上 是否来料检验=是,特采=是(2026-09-23:按来源检验行「特采」开关带下,与来料检验字段同源);
     * - 行级占用写 form_flow_link(QC_TC_IN→PURCHASE_IN)并回填检验行「入库单号」;
     * - 入库单留草稿由仓库确认审核;审核时凭批次键回填批次号,回填范围含特采单头
     *   (BatchService.KEY_PANELS)。幂等:该特采单已有 ACTIVE 入库单占用(重审)跳过。
     */
    private void tcInApprovedGenerate(String panelCode, String no, String user) {
        if (!"QC_TC_IN".equals(panelCode)) return;
        Integer linked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no=?"
                        + " AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'", Integer.class, no);
        if (linked != null && linked > 0) return;                   // 重审幂等:已生成过入库单
        // 来源检验行(决定是否自动生成 + 行物料/单价等取数)
        List<Map<String, Object>> src = jdbc.queryForList(
                "SELECT source_form_no AS inspNo, source_line_key AS lineKey FROM form_flow_link"
                        + " WHERE source_panel_code='QC_INSP' AND target_panel_code='QC_TC_IN' AND target_form_no=?"
                        + " AND link_status='ACTIVE'", no);
        if (src.isEmpty()) return;                                  // 手工特采单:不自动生成
        String inspNo = String.valueOf(src.get(0).get("inspNo"));
        String lineKey = String.valueOf(src.get(0).get("lineKey"));
        List<Map<String, Object>> tcs = jdbc.queryForList(
                "SELECT 总数量, 采购单号 FROM qc_tc_in WHERE 单据编号=? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (tcs.isEmpty()) throw new IllegalStateException("特采单不存在:" + no);
        Map<String, Object> tc = tcs.get(0);
        List<Map<String, Object>> iheads = jdbc.queryForList(
                "SELECT 业务员, 供应商代码, 供应商, 部门, 部门名称, 采购订单号, 批次键 FROM qc_insp"
                        + " WHERE 单据编号=? AND ISNULL(asp_cancel,'N') <> 'Y'", inspNo);
        if (iheads.isEmpty()) throw new IllegalStateException("来源检验单不存在:" + inspNo);
        Map<String, Object> ih = iheads.get(0);
        Integer rowId = null;
        try { rowId = Integer.valueOf(lineKey.substring(lineKey.indexOf('#') + 1)); } catch (Exception ignore) { /* 行键异常时按单据+物料兜底 */ }
        List<Map<String, Object>> drows = rowId != null
                ? jdbc.queryForList("SELECT id, 物料编码, 物料名称, ISNULL(NULLIF(规格型号, N''), 型号) AS 规格型号, 数量, 合格数量,"
                        + " ISNULL(NULLIF(不合格数量,0), 不良数量) AS 不合格数量, 仓库代码, 计量单位, 单位, 单价, 采购订单行号,"
                        + " 送检数量, 部门名称, 生产日期, 备注, CAST(ISNULL(特采,0) AS int) AS 特采 FROM qc_insp_detail WHERE id = ? AND ISNULL(asp_cancel,'N') <> 'Y'", rowId)
                : jdbc.queryForList("SELECT TOP 1 id, 物料编码, 物料名称, ISNULL(NULLIF(规格型号, N''), 型号) AS 规格型号, 数量, 合格数量,"
                        + " ISNULL(NULLIF(不合格数量,0), 不良数量) AS 不合格数量, 仓库代码, 计量单位, 单位, 单价, 采购订单行号,"
                        + " 送检数量, 部门名称, 生产日期, 备注, CAST(ISNULL(特采,0) AS int) AS 特采 FROM qc_insp_detail WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", inspNo);
        if (drows.isEmpty()) throw new IllegalStateException("来源检验行不存在:" + lineKey);
        Map<String, Object> r = drows.get(0);
        // 特采单总数量是 数值+单位 拼合文本('200支';2026-09-24 用户口径)→ 取前缀数字,解析失败退检验行数量
        double totQty;
        try {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("^-?\\d+(\\.\\d+)?").matcher(str(tc.get("总数量")));
            totQty = m.find() ? Double.parseDouble(m.group()) : 0;
        } catch (Exception e) { totQty = 0; }
        double qty = totQty > 0.000001 ? totQty
                : numOr(r.get("合格数量")) + numOr(r.get("不合格数量"));
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("存货编码", r.get("物料编码"));
        line.put("存货名称", r.get("物料名称"));
        line.put("规格型号", r.get("规格型号"));
        line.put("实收数量", qty);                                  // 特采=全部数量入库(合格+不合格)
        line.put("计量单位", r.get("计量单位") != null ? r.get("计量单位") : r.get("单位"));
        line.put("单价", r.get("单价"));
        // 是否来料检验:该批物料走过检验 = 是(与 inspAutoPurchaseIn 同口径)
        line.put("是否来料检验", "是");
        // 特采(2026-09-23 用户口径「这个字段和来料检验的字段一样,是从来料检验来的」):
        // 按**来源检验行**的「特采」开关带下 —— 本单由特采单审批通过生成,而特采单又由勾了特采的
        // 检验行触发,故恒为「是」;仍取来源值而非硬写,保证与检验行口径永远一致
        line.put("特采", numOr(r.get("特采")) != 0 ? "是" : "否");
        if (r.get("送检数量") != null) line.put("送检数量", r.get("送检数量"));
        if (r.get("部门名称") != null) line.put("部门名称", r.get("部门名称"));
        if (r.get("生产日期") != null) line.put("生产日期", r.get("生产日期"));
        if (r.get("备注") != null && !String.valueOf(r.get("备注")).isBlank()) line.put("备注", r.get("备注"));
        if (r.get("采购订单行号") != null) line.put("采购订单行号", r.get("采购订单行号"));
        // 行仓库(2026-09-23 正名):同 inspAutoPurchaseIn —— 落「仓库」(字段已全局正名)
        Object wh = r.get("仓库代码");
        if (wh != null && !String.valueOf(wh).isBlank()) line.put("仓库", wh);
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString());
        head.put("供应商", ih.get("供应商"));
        head.put("供应商编码", ih.get("供应商代码"));
        String poNo = tc.get("采购单号") != null && !String.valueOf(tc.get("采购单号")).isBlank()
                ? String.valueOf(tc.get("采购单号")) : String.valueOf(ih.get("采购订单号") == null ? "" : ih.get("采购订单号"));
        if (!poNo.isBlank()) head.put("采购订单号", poNo);
        if (ih.get("批次键") != null) head.put("批次键", ih.get("批次键"));
        // 注:不写 外部单据号/来源单据/来源单号 —— 采购入库单已按 2026-09-21 用户口径
        // 「入库单用采购订单号就够了」下线这三列;追溯走 form_flow_link 与检验行「入库单号」
        head.put("detail", Map.of("items", List.of(line)));
        Map<String, Object> saved = save(registry.panel("PURCHASE_IN"), head, false);
        String piNo = String.valueOf(saved.get("编号"));
        List<Integer> tgtIds = jdbc.queryForList(
                "SELECT id FROM bl_purchase_in WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id",
                Integer.class, piNo);
        if (!tgtIds.isEmpty()) {
            jdbc.update("INSERT INTO form_flow_link (source_panel_code, source_form_no, source_line_key,"
                            + " target_panel_code, target_form_no, target_line_key, inventory_code,"
                            + " source_quantity, linked_quantity, batch_id, link_status, create_by)"
                            + " VALUES ('QC_TC_IN', ?, ?, 'PURCHASE_IN', ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)",
                    no, no, piNo, piNo + "#" + tgtIds.get(0), r.get("物料编码"),
                    r.get("数量"), qty, ih.get("批次键"), user);
        }
        // 检验行回填入库单号(与 inspAutoPurchaseIn 同口径,便于追溯)
        jdbc.update("UPDATE qc_insp_detail SET 入库单号 = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                piNo, user, r.get("id"));
    }

    /** 特采单弃审联动:自动生成的采购入库单草稿作废+释放;已审核(可能已记台账)则挡弃审,提示先弃审入库单。 */
    private void tcInUnauditCascade(String panelCode, String no, String user) {
        if (!"QC_TC_IN".equals(panelCode)) return;
        List<String> piNos = jdbc.queryForList(
                "SELECT DISTINCT target_form_no FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no=?"
                        + " AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'", String.class, no);
        for (String piNo : piNos) {
            String st = String.valueOf(docStatusOf("PURCHASE_IN", piNo).get("status"));
            if ("草稿".equals(st) || "修改中".equals(st)) {
                voidDoc(registry.panel("PURCHASE_IN"), piNo, user);
            } else {
                throw new IllegalStateException("特采单生成的采购入库单 " + piNo + " 已审核,请先弃审该入库单再弃审特采单");
            }
        }
    }

    /**
     * 切炭双出口红字冲回:弃审切炭报工单时,若已自动生成直销入库单(ACTIVE link),
     * 则自动生成一张红字(负数量)成品入库单并审核 → 台账 rkl/yl 对称扣减,库中留痕。
     * 原入库单保留(审计线索),红字单独立存在;link 释放后重审可再生成新入库单。
     * 幂等:无 ACTIVE link(未生成过或已冲回)则跳过。
     */
    private void dualOutRedReverse(String panelCode, String no, String user) {
        if (!"WO_REPORT".equals(panelCode)) return;
        // 查报工单是否为切炭且有直销
        List<Map<String, Object>> reps = jdbc.queryForList(
                "SELECT [工单号], [工序], [直销数量] FROM wo_report WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (reps.isEmpty() || !"切炭".equals(String.valueOf(reps.get(0).get("工序")))) return;
        if (numOr(reps.get(0).get("直销数量")) <= 0) return;
        // 查 ACTIVE link → 原入库单号
        List<String> fiNos = jdbc.queryForList(
                "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='WO_REPORT' AND source_form_no=?"
                        + " AND target_panel_code='FINISH_IN' AND link_status='ACTIVE'", String.class, no);
        if (fiNos.isEmpty()) return; // 未生成过或已冲回
        String srcFi = fiNos.get(0);
        // 读原入库单明细行(取第一行——双出口只生成单行)
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT [产品编码], [产品名称], [实收数量], [计量单位], [批号], [仓库] FROM bl_finish_in"
                        + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'", srcFi);
        if (lines.isEmpty()) throw new IllegalStateException("红字冲回失败:原入库单 " + srcFi + " 无有效行");
        Map<String, Object> src = lines.get(0);
        double srcQty = numOr(src.get("实收数量"));
        if (srcQty <= 0) return; // 原行已非正数,无需冲回
        String wo = String.valueOf(reps.get(0).get("工单号"));
        // 生成红字入库单(负数量)
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("产品编码", src.get("产品编码"));
        line.put("产品名称", src.get("产品名称"));
        line.put("实收数量", -srcQty);
        line.put("计量单位", src.get("计量单位"));
        line.put("批号", src.get("批号"));
        line.put("仓库", src.get("仓库"));
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString());
        head.put("仓库", src.get("仓库"));
        head.put("生产车间", "切炭车间");
        head.put("加工单号", wo);
        head.put("经手人", user);
        head.put("备注", "红字冲回:弃审报工 " + no + " 对应直销入库 " + srcFi);
        head.put("detail", Map.of("items", List.of(line)));
        Map<String, Object> saved = save(registry.panel("FINISH_IN"), head, false);
        String redNo = String.valueOf(saved.get("编号"));
        audit(registry.panel("FINISH_IN"), Map.of("编号", (Object) redNo));
        // 释放原 link → 重审可再生成新入库单
        jdbc.update("UPDATE form_flow_link SET link_status='RELEASED', release_time=GETDATE()"
                + " WHERE source_panel_code='WO_REPORT' AND source_form_no=? AND target_form_no=? AND link_status='ACTIVE'",
                no, srcFi);
    }

    /** 修改预警数量(库存状况行内编辑):空值=清空行级阈值,回退全局阈值100 */

    /**
     * 阶段完成(项目实施计划):填写指定阶段的实际完成时间(默认当天),标记该阶段完成。
     * formData: { 编号: 单据编号, 阶段序号: "1"~"10" }
     * 仅已审核/已归档单据可操作;重复调用覆盖(允许补填/修改)。
     */
    private Map<String, Object> completeStage(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"RD_PLAN".equals(def.code())) throw new IllegalStateException("仅项目实施计划支持阶段完成");
        String no = requireNo(formData);
        String stageStr = String.valueOf(formData.getOrDefault("阶段序号", ""));
        int stage;
        try { stage = Integer.parseInt(stageStr); } catch (NumberFormatException e) { throw new IllegalArgumentException("阶段序号无效:" + stageStr); }
        if (stage < 1 || stage > 10) throw new IllegalArgumentException("阶段序号须在 1~10 之间");
        String col = "阶段" + stage + "_实际完成";
        // 单据必须已审核(有 shr)
        Map<String, Object> st = docStatusOf(def.code(), no);
        String status = String.valueOf(st.get("status"));
        if ("草稿".equals(status)) throw new IllegalStateException("草稿单据不能标记阶段完成,请先审核");
        if ("已作废".equals(status)) throw new IllegalStateException("已作废单据不能操作");
        if ("已终止".equals(status)) throw new IllegalStateException("已终止单据不能标记阶段完成");
        if (status.startsWith("终止审批中")) throw new IllegalStateException("终止审批中单据不能标记阶段完成,请等待审批完成或撤回");
        // 检查列存在
        if (COL_LENGTH("rd_plan", col) == 0) throw new IllegalStateException("阶段列不存在:" + col);
        String today = LocalDate.now().toString();
        jdbc.update("UPDATE rd_plan SET [" + col + "] = ? WHERE [单据编号] = ?", today, no);
        // 联动:阶段完成 → 刷新项目进度查询
        syncPlanToProgress(no);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", no);
        out.put("阶段", stage);
        out.put("实际完成", today);
        return out;
    }

    // ==================== 项目实施计划:申请终止(阶段处)二级审批(2026-09-11) ====================
    // 流程:申请终止(阶段N) → P1 待立项人审批 →(立项人同意)→ P2 待管理员审批 →(管理员同意)→ T 已终止(锁定单据)。
    // 驳回/撤回删行,可重新申请;留痕走 yj_form_approval(TERM_*)。状态表 yj_plan_term(一单一行)。
    // 立项人 = 本计划「文档编号」所引立项申请(rd_approval)的制单人 asp_user1(登录账号,2026-09-12 锚定);
    // 历史数据无制单人时回退「申请立项人」姓名匹配 yj_user.real_name(立项人改名/同名他人时姓名匹配会判错人)。
    // 严格口径:无账号则一级审批挂起(申请人可撤回重走),管理员不代审。

    /** 申请终止:{编号, 阶段序号, 终止原因(选填)}——仅已审核/已归档且无在途/已落实终止的单据 */
    private Map<String, Object> termRequest(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"RD_PLAN".equals(def.code())) throw new IllegalStateException("仅项目实施计划支持申请终止");
        String user = currentUserName();
        String no = requireNo(formData);
        ensureDocExists(def, no);
        int stage = parseStage(formData.get("阶段序号"));
        String reason = String.valueOf(formData.getOrDefault("终止原因", "") == null ? "" : formData.get("终止原因"));
        Map<String, Object> st = docStatusOf(def.code(), no);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status) && !"已归档".equals(status))
            throw new IllegalStateException("仅已审核或已归档的实施计划可申请终止(当前:" + status + ")");
        if (termStateOf(no) != null) throw new IllegalStateException("该计划已有终止申请或已终止,不可重复申请");
        jdbc.update("DELETE FROM yj_plan_term WHERE panel_code='RD_PLAN' AND doc_no=?", no); // 清历史残留行(如驳回未净)
        jdbc.update("INSERT INTO yj_plan_term (panel_code, doc_no, stage, reason, state, req_by, req_at, asp_user1, asp_time1) "
                        + "VALUES ('RD_PLAN', ?, ?, ?, 'P1', ?, SYSDATETIME(), ?, SYSDATETIME())",
                no, stage, reason, user, user);
        recordApproval(def.code(), no, "TERM_REQUEST", "PENDING", reason);
        List<String> initiators = initiatorUsersOf(no);
        notify(() -> messageService.send(initiators, MessageService.TERM_REQUESTED, def.code(), no,
                Map.of("stage", String.valueOf(stage), "reason", reason), user));
        Map<String, Object> out = result(no, "终止审批中（立项人）");
        out.put("阶段", stage);
        return out;
    }

    /** 终止审批通过:P1(仅立项人)→ 递交管理员;P2(仅管理员)→ 落实终止(锁定单据) */
    private Map<String, Object> termApprove(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        String no = requireNo(formData);
        Map<String, Object> t = termRowOf(no);
        String state = t == null ? null : String.valueOf(t.get("state")).trim();
        if (!"P1".equals(state) && !"P2".equals(state)) throw new IllegalStateException("无待审批的终止申请");
        String stage = String.valueOf(t.get("stage"));
        if ("P1".equals(state)) {
            requireInitiator(no, user);
            // 竞态守卫(2026-09-12):WHERE 带 state='P1',并发操作(两级同时批/批与撤回撞)只有一次生效
            int n = jdbc.update("UPDATE yj_plan_term SET state='P2', p1_by=?, p1_at=SYSDATETIME(), asp_user2=?, asp_time2=SYSDATETIME() "
                    + "WHERE panel_code='RD_PLAN' AND doc_no=? AND state='P1'", user, user, no);
            if (n == 0) throw new IllegalStateException("终止申请状态已变更，请刷新后重试");
            recordApproval(def.code(), no, "TERM_L1_APPROVE", "APPROVED", opinionOf(formData));
            notify(() -> messageService.sendToAdmins(def.code(), no, MessageService.TERM_TO_ADMIN,
                    Map.of("stage", stage), user));
            return result(no, "终止审批中（管理员）");
        }
        if (!isAdminUser(user)) throw new IllegalStateException("二级审批仅管理员可同意");
        int n2 = jdbc.update("UPDATE yj_plan_term SET state='T', p2_by=?, p2_at=SYSDATETIME(), asp_user2=?, asp_time2=SYSDATETIME() "
                + "WHERE panel_code='RD_PLAN' AND doc_no=? AND state='P2'", user, user, no);
        if (n2 == 0) throw new IllegalStateException("终止申请状态已变更，请刷新后重试");
        recordApproval(def.code(), no, "TERM_L2_APPROVE", "APPROVED", opinionOf(formData));
        String reqBy = String.valueOf(t.get("req_by") == null ? "" : t.get("req_by"));
        List<String> to = new ArrayList<>(initiatorUsersOf(no));
        if (!reqBy.isBlank()) to.add(reqBy);
        notify(() -> messageService.send(to, MessageService.TERM_APPROVED, def.code(), no,
                Map.of("stage", stage), user));
        return result(no, "已终止");
    }

    /** 终止审批驳回:P1=立项人驳回,P2=管理员驳回;驳回后删行可重新申请 */
    private Map<String, Object> termReject(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        String no = requireNo(formData);
        Map<String, Object> t = termRowOf(no);
        String state = t == null ? null : String.valueOf(t.get("state")).trim();
        if (!"P1".equals(state) && !"P2".equals(state)) throw new IllegalStateException("无待审批的终止申请");
        if ("P1".equals(state)) requireInitiator(no, user);
        else if (!isAdminUser(user)) throw new IllegalStateException("二级审批仅管理员可驳回");
        String stage = String.valueOf(t.get("stage"));
        String reqBy = String.valueOf(t.get("req_by") == null ? "" : t.get("req_by"));
        // 竞态守卫(2026-09-12):仅删在途行;批/撤回并发时后到者无行可删即抛错,不再静默重复留痕
        int n = jdbc.update("DELETE FROM yj_plan_term WHERE panel_code='RD_PLAN' AND doc_no=? AND state IN ('P1','P2')", no);
        if (n == 0) throw new IllegalStateException("终止申请状态已变更，请刷新后重试");
        recordApproval(def.code(), no, "P1".equals(state) ? "TERM_L1_REJECT" : "TERM_L2_REJECT", "REJECTED", opinionOf(formData));
        if (!reqBy.isBlank()) notify(() -> messageService.send(List.of(reqBy), MessageService.TERM_REJECTED, def.code(), no,
                Map.of("stage", stage, "opinion", opinionOf(formData)), user));
        return result(no, "已归档");
    }

    /** 撤回终止申请:发起人本人或管理员,仅在途(P1/P2)可撤 */
    private Map<String, Object> termWithdraw(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        String no = requireNo(formData);
        Map<String, Object> t = termRowOf(no);
        String state = t == null ? null : String.valueOf(t.get("state")).trim();
        if (!"P1".equals(state) && !"P2".equals(state)) throw new IllegalStateException("无在途的终止申请");
        String reqBy = String.valueOf(t.get("req_by") == null ? "" : t.get("req_by"));
        if (!user.equals(reqBy) && !isAdminUser(user)) throw new IllegalStateException("仅发起人或管理员可撤回终止申请");
        int n = jdbc.update("DELETE FROM yj_plan_term WHERE panel_code='RD_PLAN' AND doc_no=? AND state IN ('P1','P2')", no);
        if (n == 0) throw new IllegalStateException("终止申请状态已变更，请刷新后重试");
        recordApproval(def.code(), no, "TERM_WITHDRAW", "WITHDRAWN", opinionOf(formData));
        return result(no, "已归档");
    }

    /** 终止状态查询(P1/P2/T;无=null)——docStatusOf 与前端 /px/planTerm 共用。char(2) 右补空,一律 trim */
    public String termStateOf(String no) {
        List<String> rows = jdbc.queryForList(
                "SELECT state FROM yj_plan_term WHERE panel_code='RD_PLAN' AND doc_no=?", String.class, no);
        return rows.isEmpty() || rows.get(0) == null ? null : rows.get(0).trim();
    }

    // ==================== 项目进度查询 → 该项目的数据记录表单据(2026-09-11) ====================
    // 项目编号(进度明细「说明」列)= 计划文档编号 = 立项申请文档编号;数据记录表 8 面板的单据
    // 按同号「文档编号」关联 → 进度列表点项目编号即可查该项目全部数据记录表(测试/功能性等可多张)。
    private static final List<String> DATARECORD_PANELS = List.of(
            "RD_FILTER_EFF", "RD_ALKALINE", "RD_MINERAL", "RD_ANTIBACT",
            "RD_SCALE", "RD_RO_PROTECT", "RD_SOAK", "RD_DROP_PREC");

    /** 按项目编号(=立项申请文档编号)取该项目在 8 张数据记录表面板的全部单据(含状态;作废不计) */
    public List<Map<String, Object>> progressDataSheets(String code) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (code == null || code.isBlank()) return out;
        for (String pc : DATARECORD_PANELS) {
            PanelRegistry.PanelDef def;
            try { def = registry.panel(pc); } catch (Exception e) { continue; }
            String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT t.[" + def.groupCol() + "] AS no, t.[" + (def.dateCol() == null ? def.groupCol() : def.dateCol()) + "] AS d "
                            + "FROM " + table + " t WHERE t.[文档编号] = ? AND ISNULL(t.asp_cancel,'N') <> 'Y' "
                            + "AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ? AND s.doc_no = t.["
                            + def.groupCol() + "] AND ISNULL(s.canceled,'N') = 'Y') ORDER BY t.id",
                    code, pc);
            for (Map<String, Object> r : rows) {
                String no = String.valueOf(r.get("no"));
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("panelCode", pc);
                m.put("panelName", def.name());
                m.put("docNo", no);
                m.put("docDate", r.get("d") == null ? "" : String.valueOf(r.get("d")));
                m.put("status", docStatusOf(pc, no).get("status"));
                out.add(m);
            }
        }
        return out;
    }

    /** 终止单完整行(前端展示用;无=null;含立项人姓名供一级审批按钮显隐判定) */
    public Map<String, Object> termRowOf(String no) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT t.id, t.doc_no, t.stage, t.reason, RTRIM(t.state) AS state, t.req_by, CONVERT(varchar(19), t.req_at, 120) AS req_at, "
                        + "t.p1_by, CONVERT(varchar(19), t.p1_at, 120) AS p1_at, t.p2_by, CONVERT(varchar(19), t.p2_at, 120) AS p2_at, "
                        + "ISNULL(a.[申请立项人], N'') AS initiator "
                        + "FROM yj_plan_term t LEFT JOIN rd_plan p ON p.[单据编号] = t.doc_no "
                        + "LEFT JOIN rd_approval a ON a.[文档编号] = p.[文档编号] "
                        + "WHERE t.panel_code='RD_PLAN' AND t.doc_no=?", no);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 立项人登录账号(2026-09-12 锚定):优先取立项申请制单人 asp_user1(存在且启用的账号);
     *  无制单人时回退「申请立项人」姓名匹配 real_name。可能零个——严格口径:零个则一级审批挂起。 */
    private List<String> initiatorUsersOf(String planNo) {
        try {
            // 1) 账号锚定:asp_user1 本就是登录账号,与 yj_user 直连校验启用——不经姓名中转
            List<String> anchored = jdbc.queryForList(
                    "SELECT RTRIM(a.asp_user1) FROM rd_plan p JOIN rd_approval a ON a.[文档编号] = p.[文档编号] "
                            + "JOIN yj_user u ON u.username = RTRIM(a.asp_user1) "
                            + "WHERE p.[单据编号] = ? AND ISNULL(u.enabled, '1') = '1'", String.class, planNo);
            if (!anchored.isEmpty()) return anchored;
            // 2) 回退:历史数据 asp_user1 为空 → 姓名匹配
            List<String> names = jdbc.queryForList(
                    "SELECT a.[申请立项人] FROM rd_plan p JOIN rd_approval a ON a.[文档编号] = p.[文档编号] "
                            + "WHERE p.[单据编号] = ?", String.class, planNo);
            if (names.isEmpty() || names.get(0) == null || names.get(0).isBlank()) return List.of();
            return jdbc.queryForList(
                    "SELECT username FROM yj_user WHERE real_name = ? AND ISNULL(enabled, '1') = '1'", String.class, names.get(0));
        } catch (Exception e) {
            return List.of();
        }
    }

    /** 一级审批权限:当前用户必须是立项人账号(严格口径,管理员不代审) */
    private void requireInitiator(String planNo, String user) {
        if (!initiatorUsersOf(planNo).contains(user))
            throw new IllegalStateException("一级审批仅立项人（申请立项人）本人可操作");
    }

    private int parseStage(Object raw) {
        int stage;
        try { stage = Integer.parseInt(String.valueOf(raw)); } catch (NumberFormatException e) {
            throw new IllegalArgumentException("阶段序号无效:" + raw);
        }
        if (stage < 1 || stage > 10) throw new IllegalArgumentException("阶段序号须在 1~10 之间");
        return stage;
    }

    /**
     * 项目实施计划 → 项目进度查询 自动同步:
     * 读取 rd_plan 的阶段数据(计划内容/实际完成),计算进度摘要,
     * 更新 rd_progress_detail 中同名项目的「状态」「预计完成日期」字段。
     * 找不到同名行则静默跳过(需先在进度查询中添加该项目)。
     */
    private static final int RES_SKIPPED = 0, RES_INSERTED = 1, RES_UPDATED = 2;

    /**
     * 全量实时导入:把全部(非作废)项目实施计划同步进「项目进度查询」那唯一一张单据。
     * 幂等,可反复调用;每次实施计划保存/审核/阶段完成都由它兜底,保证"归档了就一定在进度查询里"。
     */
    public Map<String, Object> syncAllPlansToProgress() {
        List<String> planNos = jdbc.queryForList(
                "SELECT p.[单据编号] FROM rd_plan p WHERE ISNULL(p.asp_cancel,'N') <> 'Y'"
                        + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'RD_PLAN'"
                        + " AND s.doc_no = p.[单据编号] AND ISNULL(s.canceled,'N') = 'Y')"
                        + " ORDER BY p.[单据编号]", String.class);
        int inserted = 0, updated = 0, skipped = 0;
        for (String no : planNos) {
            int r = syncPlanToProgress(no);
            if (r == RES_INSERTED) inserted++;
            else if (r == RES_UPDATED) updated++;
            else skipped++;
        }
        org.slf4j.LoggerFactory.getLogger(ButtonService.class)
                .info("[RD_PLAN→RD_PROGRESS] 全量同步: 实施计划 {} 张, 新增 {} 行, 更新 {} 行, 跳过 {}",
                        planNos.size(), inserted, updated, skipped);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("实施计划数", planNos.size());
        out.put("新增行", inserted);
        out.put("更新行", updated);
        out.put("跳过", skipped);
        return out;
    }

    /**
     * 把一张项目实施计划导入/刷新到「项目进度查询」里的对应子项目行。
     *
     * 归并规则(2026-09-10 与用户确认):
     *   · 以实施计划的「项目名称」归到同一个项目下(界面上同名列会合并单元格)
     *   · 同一项目名称下的**每一张实施计划 = 一个子项目**,用「项目编号」区分
     *   · 「项目编号」取实施计划的**文档编号**(与立项申请一一对应)
     *   · 「子项目/尺寸」取对应立项申请的**滤芯/炭棒规格或结构**(经 文档编号 关联)
     *   · 「状态」= 该实施计划的阶段完成情况(界面点它弹窗看各阶段)
     *   · 「里程完成」= 有实际完成取最晚实际完成,否则取最后一个有内容阶段的计划完成
     *
     * 只写"系统列"(项目层级/子项目、尺寸/说明/项目负责/里程完成/状态),
     * **人工列(内容/项目级/实施进度/测试员/谁来批准/谁来检验/未批准原因)一律不碰。**
     *
     * @return RES_SKIPPED / RES_INSERTED / RES_UPDATED
     */
    private int syncPlanToProgress(String planNo) {
        // 一次取全:头字段 + 10 个阶段的三个字段(避免 10 次查询)
        StringBuilder sel = new StringBuilder("SELECT [项目名称],[项目定级],[负责人],[文档编号]");
        for (int i = 1; i <= 10; i++) {
            sel.append(",[阶段").append(i).append("_计划内容]");
            sel.append(",[阶段").append(i).append("_实际完成]");
            sel.append(",[阶段").append(i).append("_计划完成]");
        }
        sel.append(" FROM rd_plan p WHERE p.[单据编号] = ? AND ISNULL(p.asp_cancel,'N') <> 'Y'");
        sel.append(" AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'RD_PLAN'"
                + " AND s.doc_no = p.[单据编号] AND ISNULL(s.canceled,'N') = 'Y')");
        List<Map<String, Object>> rows = jdbc.queryForList(sel.toString(), planNo);
        if (rows.isEmpty()) return RES_SKIPPED;
        Map<String, Object> plan = rows.get(0);
        String projectName = str(plan.get("项目名称"));
        if (projectName == null || projectName.isBlank()) return RES_SKIPPED;

        int totalStages = 0, doneStages = 0, lastDoneStage = 0;
        String latestDone = null, lastPlanDue = null;
        for (int i = 1; i <= 10; i++) {
            String content = str(plan.get("阶段" + i + "_计划内容"));
            if (content == null) continue;                 // 空阶段框不计入
            totalStages++;
            String planDue = str(plan.get("阶段" + i + "_计划完成"));
            if (planDue != null) lastPlanDue = planDue;    // 阶段号递增:最后取到的即最晚计划完成
            String done = str(plan.get("阶段" + i + "_实际完成"));
            if (done != null) {
                doneStages++;
                lastDoneStage = i;
                if (latestDone == null || done.compareTo(latestDone) > 0) latestDone = done;
            }
        }
        String status;
        if (totalStages == 0) status = "已立项";
        else if (doneStages == 0) status = "阶段已规划(" + totalStages + "个)";
        else if (doneStages >= totalStages) status = "全部完成(" + doneStages + "/" + totalStages + ")";
        else status = "进行中(完成" + doneStages + "/" + totalStages + ",至阶段" + lastDoneStage + ")";

        // 项目进度查询是"单单据面板":永远只往那一张单据里导
        List<Map<String, Object>> targets = jdbc.queryForList(
                "SELECT TOP 1 [单据编号] FROM rd_progress WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY [单据编号] DESC");
        if (targets.isEmpty()) {
            org.slf4j.LoggerFactory.getLogger(ButtonService.class)
                    .warn("[RD_PLAN→RD_PROGRESS] 没有可用的项目进度查询单据,跳过导入 项目={}", projectName);
            return RES_SKIPPED;
        }
        String progressNo = str(targets.get(0).get("单据编号"));

        String planDocNo = str(plan.get("文档编号"));            // ← 项目编号(每张计划不同)
        String level = str(plan.get("项目定级"));
        String owner = str(plan.get("负责人"));
        String due = latestDone != null ? latestDone : lastPlanDue;
        String spec = specFromApproval(planDocNo);               // ← 子项目/尺寸
        if (spec == null) spec = planDocNo != null ? planDocNo : projectName;
        final String projNo = planDocNo != null ? planDocNo : "";

        // 2026-09-18(Phase 2 · RD_PROGRESS 18 列重构)写入口径:
        //   · 数据键一律用**旧物理列**:[项目层级](=设计「项目定级」)/[项目负责](=设计「项目负责人」)/
        //     [里程完成](=设计「预计完成日期」)/[说明](=设计「项目编号」的匹配键)
        //     —— 前端 progressColumns.js 的 key、Excel 导入导出、ProgressControlSheet 的
        //     `K[label]` 全部指向这些旧列名(2026-09-18 决策:col_name 永不改,改则历史单据数据键全丢)。
        //   · [说明] 必须与 [项目编号] 写同值,否则 UPDATE 的 `ISNULL([说明],N'')=?` 匹配不上
        //     → 每轮都会重复 INSERT 新行(踩过)。
        //   · [实施进度] 不写:它改由手填承载「立项日期」。
        //   ⚠ 2026-09-22 更正:此前本方法的 SQL **同时**写 [项目负责人]/[预计完成日期](与上一行注释
        //     宣称的"只写新列"不符),同一事实两个物理列各存一份,COALESCE 参数为 NULL 时必然分叉;
        //     现改为只写旧列,那批无人读的新列由 migrate-rd-progress-drop-orphan-cols.sql 删除。
        int n = jdbc.update("UPDATE rd_progress_detail SET [项目层级] = COALESCE(?, [项目层级]),"
                        + " [子项目/尺寸] = ?, [项目负责] = COALESCE(?, [项目负责]),"
                        + " [里程完成] = COALESCE(?, [里程完成]), [状态] = ?"
                        + " WHERE [单据编号] = ? AND [项目名称] = ? AND ISNULL([说明], N'') = ?"
                        + " AND ISNULL(asp_cancel,'N') <> 'Y'",
                level, spec, owner, due, status, progressNo, projectName, projNo);
        if (n > 0) {
            org.slf4j.LoggerFactory.getLogger(ButtonService.class)
                    .info("[RD_PLAN→RD_PROGRESS] 更新 {} 行, 项目={}, 子项目={}, 状态={}", n, projectName, spec, status);
            return RES_UPDATED;
        }
        jdbc.update("INSERT INTO rd_progress_detail ([单据编号], [项目名称], [项目层级], [子项目/尺寸], [说明], [项目编号],"
                        + " [项目负责], [里程完成], [状态], asp_user1, asp_time1)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())",
                progressNo, projectName, level, spec, projNo, projNo, owner, due, status, currentUserName());
        org.slf4j.LoggerFactory.getLogger(ButtonService.class)
                .info("[RD_PLAN→RD_PROGRESS] 新增 1 行, 进度单={}, 项目={}, 子项目={}, 状态={}", progressNo, projectName, spec, status);
        return RES_INSERTED;
    }

    /** 立项申请表的「滤芯/炭棒规格或结构」:作为进度查询里子项目的区分标识 */
    private String specFromApproval(String approvalDocNo) {
        if (approvalDocNo == null || approvalDocNo.isBlank()) return null;
        List<String> v = jdbc.queryForList(
                "SELECT [滤芯炭棒规格或结构] FROM rd_approval WHERE [文档编号] = ?", String.class, approvalDocNo);
        return v.isEmpty() ? null : str(v.get(0));
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private int COL_LENGTH(String table, String col) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name = ?",
                Integer.class, table, col);
        return n == null ? 0 : n;
    }

    // ══════════ 库存移动加权成本 ══════════

    /** 库存三报表(都读 inv_cost_ledger 的成本),支持手工全量重算。 */
    private static final List<String> INV_COST_PANELS = List.of("STOCK_LEDGER", "STOCK_SUMMARY", "STOCK_BALANCE");

    /**
     * 出入库单据审核/弃审后重算成本。
     * 面板集合与 {@link StockLedgerService#postsStock} 同源(那 8 类正是 v_stock_movement 的来源),
     * 非库存单据不触发。全量重算而非按分区:单据可能改动了仓库/存货编码,
     * 旧分区行不会被范围 DELETE 清掉(见 InvCostService#recalc 注释)。
     */
    private void recalcInvCostIfStockDoc(String panelCode) {
        if (StockLedgerService.postsStock(panelCode)) invCost.recalcAll();
    }

    /** 「重算成本」按钮:全量重算移动加权成本物化表(审核钩子之外的兜底:金蝶同步等旁路写入不走审核动作)。 */
    private Map<String, Object> recalcInvCost(PanelRegistry.PanelDef def) {
        if (!INV_COST_PANELS.contains(def.code())) throw new IllegalStateException("该面板不支持重算成本");
        int rows = invCost.recalcAll();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("重算行数", rows);
        return out;
    }
    /** 报表弹窗联动选项(台账/库存状况):仓库/存货互相约束——选项=对应视图真实存在的组合,
     *  选了存货→仓库只列该存货有流水的仓;选了仓库→存货只列该仓有流水的存货。
     *  2026-09-21:「选项以基础资料为准」——两个列表再与 仓库档案(bs_wh)/存货档案(bs_inv)
     *  按名称取交集,即 档案 ∩ 有流水。未建档的值(台账里 CK01原料仓 等)不再出现在选项里,
     *  查询弹窗据此把「当前存货在档案仓里没有流水」的仓置灰,并自动清掉换仓后无流水的存货。 */
    private Map<String, Object> ledgerRefOptions(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String view = switch (def.code()) {
            case "STOCK_LEDGER" -> "v_stock_ledger";
            case "STOCK_BALANCE" -> "v_stock_balance";
            default -> null;
        };
        if (view == null) throw new IllegalStateException("仅库存台账/库存状况表支持联动选项");
        String wh = optionalText(formData, "仓库");
        String item = optionalText(formData, "存货");
        // RTRIM:源列可能带尾随空格(nchar/手工导入),选项须干净值回传才能精确匹配。
        // 口径:选项只来自 仓库非空 的行——无仓库的行不在任何可查组合内,不进选项
        // (台账必填仓库+存货;状况表快照本就按仓库聚合,天然非空)。
        // 排除 '(未填仓库)':v_stock_movement 把空仓库写成该标签以便分组(不再是 NULL/空串),
        // 若不排除会冒出一个可选的伪仓库。
        List<String> whs = jdbc.queryForList(
                "SELECT DISTINCT RTRIM(仓库) AS 仓库 FROM " + view + " WHERE 仓库 IS NOT NULL AND RTRIM(仓库) <> ''"
                + " AND 仓库 NOT LIKE N'(未填%'"
                + (item.isBlank() ? "" : " AND RTRIM(存货) = N'" + item.replace("'", "''") + "'")
                + " AND EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(" + view + ".仓库)"
                + "               AND ISNULL(w.asp_cancel,'N') <> 'Y')"
                + " ORDER BY 1", String.class);
        List<String> items = jdbc.queryForList(
                "SELECT DISTINCT RTRIM(存货) AS 存货 FROM " + view + " WHERE 存货 IS NOT NULL AND RTRIM(存货) <> ''"
                + " AND 仓库 IS NOT NULL AND RTRIM(仓库) <> ''"
                + " AND 仓库 NOT LIKE N'(未填%'"
                + (wh.isBlank() ? "" : " AND RTRIM(仓库) = N'" + wh.replace("'", "''") + "'")
                + " AND EXISTS (SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货名称) = RTRIM(" + view + ".存货)"
                + "               AND ISNULL(i.asp_cancel,'N') <> 'Y')"
                + " ORDER BY 1", String.class);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("仓库列表", whs);
        out.put("存货列表", items);
        return out;
    }

    private Map<String, Object> listPushableErp(PanelRegistry.PanelDef def) {
        if (!List.of("PURCHASE_IN", "SALE_OUT", "PU_ORDER").contains(def.code()))
            throw new IllegalStateException("仅采购订单/采购入库/销售出库支持转ERP");
        String tbl = "PURCHASE_IN".equals(def.code()) ? "bd_purchase_in"
                : "PU_ORDER".equals(def.code()) ? "bd_pu_order" : "bd_sale_out";
        String partnerCol = "SALE_OUT".equals(def.code()) ? "客户" : "供应商";
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT h.单据编号, h.单据日期, h." + partnerCol + " AS 往来单位, h." + partnerCol + " AS partner" +
                " FROM " + tbl + " h" +
                " INNER JOIN yj_doc_status s ON s.panel_code = ? AND s.doc_no = h.单据编号 AND s.shr IS NOT NULL" +
                " WHERE ISNULL(h.asp_cancel,'N') <> 'Y'" +
                " AND ISNULL(h.是否已转ERP, N'否') <> N'是'" +
                " ORDER BY h.单据编号 DESC", def.code());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", rows);
        out.put("count", rows.size());
        return out;
    }

    /** 转ERP:已审核+未转过的采购入库/销售出库 → 推金蝶,回写ERP单号 */
    private Map<String, Object> pushToErp(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!List.of("PURCHASE_IN", "SALE_OUT", "PU_ORDER").contains(def.code()))
            throw new IllegalStateException("仅采购订单/采购入库/销售出库支持转ERP");
        String docNo = String.valueOf(formData.getOrDefault("编号", formData.getOrDefault("单据编号", "")));
        if (docNo.isBlank()) throw new IllegalArgumentException("缺少单据编号");
        String operator = currentUserName();
        try {
            return kingdeePush.pushDocument(def.code(), docNo, operator);
        } catch (Exception e) {
            throw new RuntimeException("转ERP失败: " + e.getMessage(), e);
        }
    }

    /** 修改预警数量(库存状况行内编辑):空值=清空行级阈值,回退全局阈值100 */
    private Map<String, Object> updateStockWarn(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"STOCK_STATUS".equals(def.code())) throw new IllegalStateException("仅库存状况面板支持修改预警数量");
        String idRaw = requiredText(formData, "id");
        int id;
        try {
            id = Integer.parseInt(idRaw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("库存行标识无效");
        }
        String v = optionalText(formData, "预警数量");
        Double warn = null;
        if (!v.isBlank()) {
            try {
                warn = Double.parseDouble(v);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("预警数量必须是数字");
            }
        }
        int n = jdbc.update("UPDATE kucun SET [预警数量] = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                warn, currentUserName(), id);
        if (n == 0) throw new IllegalStateException("库存行不存在");
        return result(String.valueOf(id), "已更新");
    }

    private String requiredText(Map<String, Object> formData, String key) {        Object v = formData == null ? null : formData.get(key);
        if (v == null || String.valueOf(v).isBlank()) throw new IllegalArgumentException("请填写" + key);
        return String.valueOf(v).trim();
    }

    private String optionalText(Map<String, Object> formData, String key) {
        Object v = formData == null ? null : formData.get(key);
        return v == null ? "" : String.valueOf(v).trim();
    }

    /** 当前登录用户是否就是该单据一级选定的二级审核人(前端据此显示「审批通过/驳回」) */
    public boolean isL2Approver(String no) {
        String acc = l2ApproverOf("RD_PROD_INFO", no);
        return !acc.isEmpty() && acc.equals(currentUserName());
    }

    /** 该单据一级通过时选定的二级审核人**姓名**(前端回显;无则空串) */
    public String l2ApproverName(String no) {
        String acc = l2ApproverOf("RD_PROD_INFO", no);
        if (acc.isEmpty()) return "";
        List<String> names = jdbc.queryForList("SELECT real_name FROM yj_user WHERE username = ?", String.class, acc);
        return names.isEmpty() || names.get(0) == null ? acc : names.get(0);
    }

    /**
     * 「分发责任人」按钮可用性(前端侧边栏显隐/置灰用):已归档 且 (二级审核人 ∪ 管理员)。
     * 历史单没选过二级审核人的(2026-09-20 之前的归档单)退回旧口径:有本面板编辑权即可 —— 否则存量单据无人能分发。
     */
    public boolean canAssignDev(String no) {
        try {
            String user = currentUserName();
            if (!"已归档".equals(String.valueOf(docStatusOf("RD_PROD_INFO", no).get("status")))) return false;
            if (!canEdit(user, "RD_PROD_INFO")) return false;
            String l2 = l2ApproverOf("RD_PROD_INFO", no);
            if (l2.isEmpty()) return true;
            return isAdminUser(user) || l2.equals(user);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 项目定级(2026-09-21 用户口径):立项申请表**审核通过之后**,由审核人在系统里给项目定级。
     *
     * 口径(grill 两问):
     *   · 可点人 = 管理员 ∪ 该面板审批人(`yj_role_panel.can_approve`,即含刚通过的那位审核人);
     *   · 时机 = 单据已审核 / 已归档(没通过审核就定级无意义);
     *   · 载荷「项目等级」∈ 一级/二级/三级/四级(与下游 RD_PLAN.项目定级 同字典);
     *   · 写 `rd_approval.项目等级` + 一条审批留痕(action=GRADE,result=GRADED,意见里带新旧等级);
     *     已定级的可再改,每次留痕(不覆盖历史)。
     * 下游:实施计划按「文档编号」参照立项申请时,项目等级 → 项目定级 由 REF_SYNONYMS 自动带回;
     *   进度查询继续由 syncPlanToProgress 从计划同步(既有链路)。
     */
    private Map<String, Object> gradeProject(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"RD_APPROVAL".equals(def.code())) throw new IllegalStateException("仅立项申请表可项目定级");
        requireApprover(def.code());
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String status = String.valueOf(docStatusOf(def.code(), no).get("status"));
        if (!"已审核".equals(status) && !"已归档".equals(status))
            throw new IllegalStateException("仅已审核或已归档的立项申请可项目定级(当前:" + status + ")");
        String level = pickOf(formData, "项目等级");
        if (!PROJECT_LEVELS.contains(level))
            throw new IllegalStateException("项目等级取值不合法(应为 一级/二级/三级/四级):" + level);
        String old = "";
        List<String> cur = jdbc.queryForList(
                "SELECT TOP 1 项目等级 FROM rd_approval WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", String.class, no);
        if (!cur.isEmpty() && cur.get(0) != null) old = cur.get(0).trim();
        int n = jdbc.update("UPDATE rd_approval SET 项目等级 = ?, asp_user2 = ?, asp_time2 = SYSDATETIME()"
                + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", level, currentUserName(), no);
        if (n == 0) throw new IllegalStateException("立项申请不存在或已作废:" + no);
        String opinion = old.isEmpty() ? "项目定级：" + level : "项目定级：" + old + " → " + level;
        recordApproval(def.code(), no, "GRADE", "GRADED", opinion);
        return result(no, status.isEmpty() ? "已审核" : status);
    }

    /** 项目等级取值(与下游 RD_PLAN.项目定级 / RD_PROGRESS.项目定级 同字典;2026-09-21 四级统一) */
    private static final java.util.Set<String> PROJECT_LEVELS =
            java.util.Set.of("一级", "二级", "三级", "四级");

    // ══════════ 产品变更申请单(RD_CHANGE):部门评审行 + 按部门按格编辑门禁 ══════════
    // 用户口径(2026-09-21 第③条):各部门按各自账号分工填本部门栏目,每人只能改自己填写的内容,
    //   「变更后内容」是可编辑区。部门行 = 纸面 YJ-QR-130「部门评审意见」的 7 行(开发部/成型工艺科/
    //   组装车间/销售部/品质部/计划组/仓管部);账号能填哪一行 = yj_user.dept_id → yj_change_dept
    //   (纸面部门 ↔ 系统部门映射,因为纸面部门名在 yj_dept 里并不存在,见 migrate-change-dept-map.sql)。
    // 门禁是**按格**的:本部门行只放行「变更后内容/备注」(表区/部门/签字/日期一律按库内现值还原),
    //   别的部门行整体还原;载荷省略某行不会把它软删(省略即删除=抹掉别人已填内容);
    //   新增行只允许预置部门名。管理员豁免(可代填任何行)。签字/日期由服务端盖章(防伪造签名)。

    /** 变更申请单面板编码 */
    private static final String CHANGE_PANEL = "RD_CHANGE";
    /** 部门评审行的表区值(与前端纸张配置同名) */
    private static final String CHANGE_DEPT_SECTION = "部门评审意见";
    /** 部门行里可由填写人改的列(其余列一律以库内现值为准) */
    private static final java.util.Set<String> CHANGE_EDITABLE_COLS =
            java.util.Set.of("变更后内容", "备注");

    /** 纸面部门行清单(去重,按 sort;映射表为空=不铺行,只留管理员可用) */
    private List<String> changeDeptRows() {
        return jdbc.queryForList("SELECT 部门 FROM yj_change_dept GROUP BY 部门, sort ORDER BY MIN(sort), 部门", String.class);
    }

    /** 当前账号可填的纸面部门行(按 yj_user.dept_id 命中 yj_change_dept;管理员另行豁免,不在此列) */
    private java.util.Set<String> changeDeptsOf(String user) {
        return new java.util.HashSet<>(jdbc.queryForList(
                "SELECT DISTINCT c.部门 FROM yj_change_dept c JOIN yj_user u ON u.dept_id = c.dept_id WHERE u.username = ?",
                String.class, user));
    }

    /** 操作人姓名(签字盖章用;取不到回退账号) */
    private String realNameOf(String user) {
        List<String> names = jdbc.queryForList("SELECT real_name FROM yj_user WHERE username = ?", String.class, user);
        return names.isEmpty() || names.get(0) == null || names.get(0).isBlank() ? user : names.get(0);
    }

    /** 空值安全的字符串(去空白;null/空 → 空串) */
    private static String blankSafe(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    /**
     * 确保 7 个预置部门行存在(幂等,建单/每次保存都调):
     * ① 有存活行 → 不动;② 有被软删的行 → 复活它(保住 id,行号/引用不乱);③ 都没有 → 插一行空白行。
     */
    private void ensureChangeDeptRows(PanelRegistry.PanelDef def, String no, String user) {
        for (String dept : changeDeptRows()) {
            List<Object> dead = jdbc.queryForList("SELECT TOP 1 id FROM " + def.lineTable()
                            + " WHERE " + def.groupCol() + " = ? AND 部门 = ? AND ISNULL(asp_cancel,'N') = 'Y' ORDER BY id",
                    Object.class, no, dept);
            if (!dead.isEmpty()) {
                jdbc.update("UPDATE " + def.lineTable() + " SET asp_cancel = 'N', 表区 = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                        CHANGE_DEPT_SECTION, user, dead.get(0));
                continue;
            }
            Integer alive = jdbc.queryForObject("SELECT COUNT(*) FROM " + def.lineTable()
                            + " WHERE " + def.groupCol() + " = ? AND 部门 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    Integer.class, no, dept);
            if (alive != null && alive > 0) continue;
            Map<String, Object> cols = new LinkedHashMap<>();
            cols.put(def.groupCol(), no);
            cols.put("表区", CHANGE_DEPT_SECTION);
            cols.put("部门", dept);
            cols.put("变更后内容", "");
            insertRow(def.lineTable(), cols, user);
        }
    }

    /**
     * 按格门禁:就地改写 items(调用方随后照常 upsert)。
     * 还原口径 —— 非本部门行(或本部门的非可编辑列)= 库内现值;缺席的部门行 = 原值补回(不软删)。
     */
    private void gateChangeDetail(PanelRegistry.PanelDef def, List<Map<String, Object>> items, String no, String user) {
        boolean admin = isAdminUser(user);
        java.util.Set<String> mine = admin ? java.util.Set.of() : changeDeptsOf(user);
        List<String> canonical = changeDeptRows();
        List<Map<String, Object>> db = jdbc.queryForList("SELECT id, 部门, 表区, 变更后内容, 签字, 日期, 备注 FROM "
                + def.lineTable() + " WHERE " + def.groupCol() + " = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", no);
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        Map<String, Map<String, Object>> byDept = new LinkedHashMap<>();
        for (Map<String, Object> r : db) {
            byId.put(String.valueOf(r.get("id")), r);
            byDept.putIfAbsent(blankSafe(r.get("部门")), r);
        }
        String operator = realNameOf(user);
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (Map<String, Object> it : items) {
            Object id = it.get("id");
            Map<String, Object> cur = id == null || String.valueOf(id).isBlank() ? null : byId.get(String.valueOf(id));
            if (cur == null) {
                // 新增行:只认预置部门名(否则等于自己造一行"自己的部门"绕过映射表)
                String dept = blankSafe(it.get("部门"));
                if (!canonical.contains(dept))
                    throw new IllegalStateException("部门评审只能填预置部门行（" + String.join("、", canonical)
                            + "），不能新增「" + dept + "」行");
                if (!admin && !mine.contains(dept))
                    throw new org.springframework.security.access.AccessDeniedException(
                            "只能填写本部门（" + String.join("、", mine) + "）的栏目");
                Map<String, Object> exist = byDept.get(dept);
                if (exist != null) {   // 该部门已有行(如并发插入过):按那一行改写,不另插一行
                    seen.add(String.valueOf(exist.get("id")));
                    restoreRow(exist, it, true);
                    stampSignature(it, exist, operator);
                } else {
                    it.put("表区", CHANGE_DEPT_SECTION);
                    stampSignature(it, null, operator);
                }
                continue;
            }
            seen.add(String.valueOf(cur.get("id")));
            boolean own = admin || mine.contains(blankSafe(cur.get("部门")));
            restoreRow(cur, it, own);
            if (own) stampSignature(it, cur, operator);
        }
        // 缺席行补回:部门行不因载荷省略而被软删(软删 = 抹掉别的部门已填的内容)
        for (Map.Entry<String, Map<String, Object>> e : byId.entrySet()) {
            if (seen.contains(e.getKey())) continue;
            items.add(new LinkedHashMap<>(e.getValue()));
        }
    }

    /** 还原:可编辑列保留载荷值,其余列(含 部门/表区/签字/日期/单据编号)一律写回库内现值 */
    private void restoreRow(Map<String, Object> cur, Map<String, Object> it, boolean editable) {
        for (Map.Entry<String, Object> e : cur.entrySet()) {
            String k = e.getKey();
            if ("id".equals(k)) continue;
            if (editable && CHANGE_EDITABLE_COLS.contains(k)) continue;
            it.put(k, e.getValue());
        }
        it.put("id", cur.get("id"));
    }

    /**
     * 服务端盖章:只有「变更后内容」真的变成了非空文本才动签字/日期 ——
     * 签字 = 操作人姓名、日期 = 今天;空值/没变 → 一律不动(①空串在本引擎里是"不改动"语义,
     * 见 labelsToCols 注释;②管理员只改表头时不能把各部门的签字刷成自己)。
     * 载荷自带的签字/日期已被 restoreRow 还原,伪造签名到不了这里。
     */
    private void stampSignature(Map<String, Object> it, Map<String, Object> cur, String operator) {
        String now = blankSafe(it.get("变更后内容"));
        String old = cur == null ? "" : blankSafe(cur.get("变更后内容"));
        if (now.isEmpty() || now.equals(old)) return;
        it.put("签字", operator);
        it.put("日期", LocalDate.now().toString());
    }

    // ══════════ 产品变更申请单:会签 / 审批 / 生效钩子(2026-09-21 第④⑤条) ══════════
    // 状态链:草稿 →(填写中)→ 会签中(可选)→ 审批中(admin)→ 已生效;驳回回草稿。
    // 会签不改表:会签人在 rd_change_head.会签人(账号,逗号/顿号/分号分隔),每签一行落既有
    //   yj_form_approval(action='SIGNOFF'),「会签中」= 存在 PENDING 签名(照 yj_plan_term 的做法)。
    // 生效 = 按勾选的受控文件**复制出下一版草稿**(带「变更来源单号」)+ 通知该文件责任人。

    /** 四个受控文件:显示名(勾选写入 rd_change_head.变更文件,顿号分隔)→ 面板编码 */
    private static final Map<String, String> CHANGE_FILE_PANELS = Map.of(
            "成型工艺清单", "RD_MOLD_PROC",
            "组装工艺清单", "RD_ASM_PROC",
            "规格书", "RD_SPEC_DOC",
            "出货检验计划表", "RD_INSP_PLAN");

    /** 变更单头字段取值(取不到返回空串) */
    private String changeHead(String no, String col) {
        List<String> v = jdbc.queryForList("SELECT ISNULL([" + col + "], N'') FROM rd_change_head WHERE 单据编号 = ?", String.class, no);
        return v.isEmpty() ? "" : String.valueOf(v.get(0)).trim();
    }

    /** 制单人(rd_change_head.asp_user1;查不到返回空串) */
    private String changeAuthor(String no) {
        List<String> v = jdbc.queryForList("SELECT TOP 1 ISNULL(asp_user1, N'') FROM rd_change_head WHERE 单据编号 = ?", String.class, no);
        return v.isEmpty() ? "" : String.valueOf(v.get(0)).trim();
    }

    /** 变更单的身份门禁:只有**发起人(制单人)∪ 管理员**能提交会签/提交审批/撤回会签 */
    private void requireChangeInitiator(String no, String user) {
        if (isAdminUser(user)) return;
        String author = changeAuthor(no);
        if (author.isEmpty() || !author.equals(user))
            throw new org.springframework.security.access.AccessDeniedException("只有本变更单的发起人（或管理员）可以执行该动作");
    }

    /** 会签人账号清单(rd_change_head.会签人:逗号/顿号/分号/空格分隔;去重保序) */
    private List<String> signersOf(String no) {
        String raw = changeHead(no, "会签人");
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (String s : raw.split("[,，、;；\\s]+")) if (!s.isBlank()) seen.add(s.trim());
        return new ArrayList<>(seen);
    }

    /** 会签结果(会签人账号 → result);重发会签时旧行已删,故一账号一行 */
    private Map<String, String> signoffResults(String no) {
        Map<String, String> out = new LinkedHashMap<>();
        jdbc.query("SELECT operator, result FROM yj_form_approval WHERE panel_code = ? AND form_no = ? AND action = 'SIGNOFF' ORDER BY id",
                (java.sql.ResultSet rs) -> {   // 块体=void → RowCallbackHandler(表达式体会被当成 ResultSetExtractor,不遍历行)
                    out.put(String.valueOf(rs.getString("operator")).trim(), String.valueOf(rs.getString("result")));
                },
                CHANGE_PANEL, no);
        return out;
    }

    /** 还等着签的会签人(「会签中」的判据) */
    private List<String> signoffPending(String no) {
        return signoffResults(no).entrySet().stream()
                .filter(e -> "PENDING".equals(e.getValue())).map(Map.Entry::getKey).toList();
    }

    /** 会签是否已全部通过(至少一人,且无 PENDING/REJECTED) */
    private boolean signoffAllApproved(String no) {
        Map<String, String> res = signoffResults(no);
        return !res.isEmpty() && res.values().stream().allMatch("APPROVED"::equals);
    }

    /** 会签留痕(operator = 会签人本人,不是当前操作者) */
    private void recordSignoff(String no, String signer, String result, String opinion) {
        jdbc.update("INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time) "
                        + "VALUES (?,?,?,?,1,?,?,SYSDATETIME())",
                CHANGE_PANEL, no, "SIGNOFF", result, signer, opinion == null || opinion.isEmpty() ? null : opinion);
    }

    /**
     * 提交会签(发起人 ∪ 管理员):勾了「需会签=是」且填了会签人才能提交。
     * 重发会签会清掉上一轮签名(驳回后再发起=新一轮),每个会签人收 SIGNOFF_REQUESTED。
     */
    private Map<String, Object> submitSignoff(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!CHANGE_PANEL.equals(def.code())) throw new IllegalStateException("仅产品变更申请单可提交会签");
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String user = currentUserName();
        requireChangeInitiator(no, user);
        String st = String.valueOf(docStatusOf(def.code(), no).get("status"));
        if ("会签中".equals(st)) throw new IllegalStateException("本单会签进行中，无需重复提交");
        if (!"草稿".equals(st)) throw new IllegalStateException("仅草稿状态可提交会签（当前：" + st + "）");
        if (!"是".equals(changeHead(no, "需会签"))) throw new IllegalStateException("本单未勾选「需会签」，直接提交审批即可");
        List<String> signers = signersOf(no);
        if (signers.isEmpty()) throw new IllegalStateException("请先填写会签人（账号）");
        if (signers.contains(user) && !isAdminUser(user))
            throw new IllegalStateException("发起人不能是会签人（编制与会签分离）");
        for (String s : signers)
            if (!isEnabledUser(s)) throw new IllegalStateException("会签人账号不存在或已停用：" + s);
        jdbc.update("DELETE FROM yj_form_approval WHERE panel_code = ? AND form_no = ? AND action = 'SIGNOFF'", CHANGE_PANEL, no);
        for (String s : signers) recordSignoff(no, s, "PENDING", "");
        recordApproval(def.code(), no, "SIGNOFF_SUBMIT", "PENDING", "会签人：" + String.join("、", signers));
        notify(() -> messageService.send(signers, MessageService.SIGNOFF_REQUESTED, def.code(), no,
                Map.of("docNo", no, "actor", user, "panelName", def.name()), user));
        return result(no, "会签中");
    }

    /** 会签通过(仅本单会签人):全部签完 → **自动**转审批中(用户口径:会签通过才进审核) */
    private Map<String, Object> signoffApprove(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String user = currentUserName();
        requireSigner(no, user);
        String opinion = opinionOf(formData);
        int n = jdbc.update("UPDATE yj_form_approval SET result = 'APPROVED', opinion = ?, create_time = SYSDATETIME() "
                        + "WHERE panel_code = ? AND form_no = ? AND action = 'SIGNOFF' AND result = 'PENDING' AND operator = ?",
                opinion.isEmpty() ? null : opinion, CHANGE_PANEL, no, user);
        if (n == 0) throw new IllegalStateException("会签已处理，请刷新后查看");
        if (signoffPending(no).isEmpty()) {
            // 全部通过:转审批中(走提交内核——刻意跳过发起人校验,最后一位会签人通常不是发起人)
            doSubmitApproval(def, no, opinion);
            notify(() -> messageService.sendToAuthor(def.headTable(), def.code(), no, MessageService.SIGNOFF_PASSED,
                    Map.of("docNo", no, "actor", user, "panelName", def.name()), user));
            return result(no, "审批中");
        }
        return result(no, "会签中");
    }

    /** 会签驳回(仅本单会签人,意见必填):回草稿,其余待签一并作废,通知发起人 */
    private Map<String, Object> signoffReject(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String user = currentUserName();
        requireSigner(no, user);
        String opinion = opinionOf(formData);
        if (opinion.isEmpty()) throw new IllegalStateException("会签驳回必须填写意见");
        int n = jdbc.update("UPDATE yj_form_approval SET result = 'REJECTED', opinion = ?, create_time = SYSDATETIME() "
                        + "WHERE panel_code = ? AND form_no = ? AND action = 'SIGNOFF' AND result = 'PENDING' AND operator = ?",
                opinion, CHANGE_PANEL, no, user);
        if (n == 0) throw new IllegalStateException("会签已处理，请刷新后查看");
        // 其余待签作废(一票否决:不留"还在会签中"的假状态)
        jdbc.update("UPDATE yj_form_approval SET result = 'CANCELED', opinion = N'他人已驳回，本签作废', create_time = SYSDATETIME() "
                + "WHERE panel_code = ? AND form_no = ? AND action = 'SIGNOFF' AND result = 'PENDING'", CHANGE_PANEL, no);
        recordApproval(def.code(), no, "SIGNOFF_REJECT", "REJECTED", opinion);
        notify(() -> messageService.sendToAuthor(def.headTable(), def.code(), no, MessageService.SIGNOFF_REJECTED,
                Map.of("docNo", no, "actor", user, "opinion", opinion, "panelName", def.name()), user));
        return result(no, "草稿");
    }

    /** 撤回会签(发起人 ∪ 管理员):会签中 → 草稿(卡死出口,照「撤回删除/修改申请」口径) */
    private Map<String, Object> signoffWithdraw(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String user = currentUserName();
        requireChangeInitiator(no, user);
        if (signoffPending(no).isEmpty()) throw new IllegalStateException("本单当前没有待签的会签");
        jdbc.update("UPDATE yj_form_approval SET result = 'WITHDRAWN', opinion = N'发起人撤回', create_time = SYSDATETIME() "
                + "WHERE panel_code = ? AND form_no = ? AND action = 'SIGNOFF' AND result = 'PENDING'", CHANGE_PANEL, no);
        recordApproval(def.code(), no, "SIGNOFF_WITHDRAW", "WITHDRAWN", "撤回人：" + user);
        // 不打扰会签人:撤回=这轮不算,发起人改完会重新发起会签(那时会再收到请求)
        return result(no, "草稿");
    }

    /** 会签人身份校验(管理员豁免:救急可代签,与其余动作同口径) */
    private void requireSigner(String no, String user) {
        if (isAdminUser(user)) return;
        if (!signersOf(no).contains(user))
            throw new org.springframework.security.access.AccessDeniedException(
                    "仅本单会签人（" + String.join("、", signersOf(no)) + "）可会签");
    }

    /**
     * 变更生效钩子(审批通过时执行):按 rd_change_head.变更文件 勾选的每个文件
     * **复制出下一版草稿**(带「变更来源单号」= 本变更单号)+ 通知该文件责任人(rd_dev_task.负责人;
     * 没登记责任人时兜底通知管理员,避免"生成了没人知道")。
     * 返回「显示名 新单号」清单(写进生效留痕,便于日后追)。
     */
    private String applyChangeEffect(String no, String operator) {
        List<String> names = new ArrayList<>();
        for (Map.Entry<String, String> e : CHANGE_FILE_PANELS.entrySet()) {
            if (!changeHead(no, "变更文件").contains(e.getKey())) continue;
            String panelCode = e.getValue();
            try {
                String product = changeHead(no, "产品编号");
                String newNo = cloneDocForChange(panelCode, product, no, operator);
                if (newNo == null) continue;
                names.add(e.getKey() + " " + newNo);
                String assignee = devTaskService.assignsOf(product).get(panelCode);
                final String doc = newNo, actor = operator, productName = changeHead(no, "产品名称");
                if (assignee != null && !assignee.isBlank()) {
                    notify(() -> messageService.send(List.of(assignee), MessageService.CHANGE_EFFECTIVE, panelCode, doc,
                            Map.of("docNo", doc, "changeNo", no, "actor", actor, "panelName", e.getKey()), actor));
                } else {
                    notify(() -> messageService.sendToAdmins(panelCode, doc, MessageService.CHANGE_EFFECTIVE,
                            Map.of("docNo", doc, "changeNo", no, "actor", actor, "panelName", e.getKey()), actor));
                }
            } catch (Exception ex) {
                log.warn("change-effect: 生成下一版草稿失败 panel={} change={} err={}", panelCode, no, ex.getMessage());
                names.add(e.getKey() + " 生成失败：" + ex.getMessage());
            }
        }
        return names.isEmpty() ? "（本单未勾选受控文件，未生成草稿）" : String.join("；", names);
    }

    /**
     * 为变更单复制出某受控文件的**下一版草稿**:
     * 有既有版本(该产品最新一张未作废单)→ 整单复制(头字段 + 全部明细行),新单号、`变更来源单号`=变更单号;
     * 没有既有版本 → 建一张只带产品标识与来源单号的空白草稿(受控文件本来就是新做的)。
     * 新单是**草稿**(saved='Y' 未审核),责任人按正常流程编辑→保存→重新走受控审核。
     */
    private String cloneDocForChange(String panelCode, String product, String changeNo, String operator) {
        PanelRegistry.PanelDef t = registry.panel(panelCode);
        if (t == null || !t.isDoc()) return null;
        String pkey = DevTaskService.productKeyOf(panelCode);
        String srcNo = null;
        if (product != null && !product.isBlank()) {
            List<String> src = jdbc.queryForList("SELECT TOP 1 " + t.groupCol() + " FROM " + t.headTable()
                    + " WHERE [" + pkey + "] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC", String.class, product);
            srcNo = src.isEmpty() ? null : String.valueOf(src.get(0));
        }
        String newNo = formNoService.next(t.prefix(), operator);
        Map<String, Object> headCols = new LinkedHashMap<>();
        if (srcNo != null) {
            Map<String, Object> src = jdbc.queryForMap("SELECT * FROM " + t.headTable() + " WHERE " + t.groupCol() + " = ?", srcNo);
            for (Map.Entry<String, Object> e : src.entrySet()) {
                String c = e.getKey();
                if ("id".equals(c) || t.groupCol().equals(c) || c.startsWith("asp_") || "变更来源单号".equals(c)) continue;
                headCols.put(c, e.getValue());
            }
        } else {
            if (product != null && !product.isBlank()) headCols.put(pkey, product);
        }
        if (tableCols(t.headTable()).contains("变更来源单号")) headCols.put("变更来源单号", changeNo);
        headCols.put(t.groupCol(), newNo);
        insertRow(t.headTable(), headCols, operator);
        if (srcNo != null) {
            List<Map<String, Object>> lines = jdbc.queryForList("SELECT * FROM " + t.lineTable()
                    + " WHERE " + t.groupCol() + " = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", srcNo);
            for (Map<String, Object> line : lines) {
                Map<String, Object> cols = new LinkedHashMap<>();
                for (Map.Entry<String, Object> e : line.entrySet()) {
                    String c = e.getKey();
                    if ("id".equals(c) || t.groupCol().equals(c) || c.startsWith("asp_")) continue;
                    cols.put(c, e.getValue());
                }
                cols.keySet().retainAll(tableCols(t.lineTable()));
                cols.put(t.groupCol(), newNo);
                insertRow(t.lineTable(), cols, operator);
            }
        }
        markDocSaved(panelCode, newNo, true);
        return newNo;
    }

    /** 变更单审批驳回:通知发起人与**已填写部门**(部门行的签字人 → 账号),让他们知道要重新填 */
    private void notifyChangeRejected(PanelRegistry.PanelDef def, String no, String actor, String opinion) {
        Set<String> targets = new java.util.LinkedHashSet<>();
        String author = changeAuthor(no);
        if (!author.isBlank()) targets.add(author);
        jdbc.query("SELECT DISTINCT 签字 FROM rd_change_detail WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' "
                        + "AND ISNULL(签字, N'') <> N''", (java.sql.ResultSet rs) -> {
                    String name = String.valueOf(rs.getString(1)).trim();
                    if (!name.isEmpty()) targets.add(name);
                }, no);
        if (targets.isEmpty()) return;
        // 签字存的是姓名:能对上账号的按账号通知,对不上的落管理员(不静默丢)
        List<String> users = new ArrayList<>();
        for (String t : targets) {
            String u = devTaskService.resolveUsername(t);
            if (u != null && !u.isBlank() && isEnabledUser(u)) users.add(u);
        }
        final String op = opinion;
        if (users.isEmpty()) {
            notify(() -> messageService.sendToAdmins(def.code(), no, MessageService.CHANGE_REJECTED,
                    Map.of("docNo", no, "actor", actor, "opinion", op, "panelName", def.name()), actor));
            return;
        }
        notify(() -> messageService.send(users, MessageService.CHANGE_REJECTED, def.code(), no,
                Map.of("docNo", no, "actor", actor, "opinion", op, "panelName", def.name()), actor));
    }

    /**
     * 分发责任人(2026-09-20;按钮名沿用「产品开发」兼容,新名「分发责任人」)。
     *
     * 口径(grill 六问):仅产品信息表、仅**已归档**;执行人 = **一级通过时选定的二级审核人 ∪ 管理员**
     *   (历史单没选过二级审核人的,退回旧口径:有本面板编辑权即可,避免存量卡死);
     * 载荷「分发责任人」= { 面板编码: 账号 } —— 四个下游文件**各自**指定一个责任人;
     *   不传该键时按旧口径用「产品负责人」解析出的账号兜底(可为空 = 任务挂起)。
     * 幂等:已分发过的产品可**随时改人**(改写 rd_dev_task.负责人),不再是"发过一次就锁死";
     * 每个责任人收到 TASK_ASSIGNED 消息(操作人自己除外)。
     */
    private Map<String, Object> dispatchDev(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"RD_PROD_INFO".equals(def.code())) throw new IllegalStateException("仅产品信息表可分发责任人");
        String user = currentUserName();
        if (!canEdit(user, def.code()))
            throw new org.springframework.security.access.AccessDeniedException("当前角色无该面板编辑权限");
        String no = requireNo(formData);
        ensureDocExists(def, no);
        String st = String.valueOf(docStatusOf(def.code(), no).get("status"));
        if (!"已归档".equals(st)) throw new IllegalStateException("仅已归档的产品信息表可分发责任人");
        String l2 = l2ApproverOf(def.code(), no);
        if (!l2.isEmpty() && !isAdminUser(user) && !l2.equals(user))
            throw new org.springframework.security.access.AccessDeniedException("仅二级审核人或管理员可分发责任人");
        Map<String, Object> head = jdbc.queryForMap(
                "SELECT TOP 1 产品编号, 产品名称, 责任人 FROM rd_prod_info_head WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        String productCode = head.get("产品编号") == null ? "" : String.valueOf(head.get("产品编号")).trim();
        String productName = head.get("产品名称") == null ? "" : String.valueOf(head.get("产品名称")).trim();
        if (productCode.isEmpty()) throw new IllegalStateException("产品信息表的「产品编号」为空,无法分发责任人");
        String respName = head.get("责任人") == null ? "" : String.valueOf(head.get("责任人")).trim();
        String supervisor = devTaskService.resolveUsername(respName);
        // 分工:载荷「分发责任人」= { 面板: 账号 };只认四个下游面板,账号必须存在且启用
        Map<String, String> picks = new java.util.LinkedHashMap<>();
        Object raw = formData == null ? null : formData.get("分发责任人");
        if (raw instanceof Map<?, ?> m) {
            for (Map.Entry<?, ?> e : m.entrySet()) {
                String panel = String.valueOf(e.getKey());
                String acc = e.getValue() == null ? "" : String.valueOf(e.getValue()).trim();
                if (!DevTaskService.devPanelCodes().contains(panel)) continue;
                if (acc.isEmpty()) continue;
                if (!isEnabledUser(acc)) throw new IllegalStateException("责任人账号不存在或已停用：" + acc);
                picks.put(panel, acc);
            }
        }
        Map<String, Object> out = devTaskService.dispatch(productCode, productName, no, user, supervisor, picks);
        // 每个新指定的责任人(≠操作人)收 TASK_ASSIGNED 消息
        @SuppressWarnings("unchecked")
        Map<String, String> assigns = (Map<String, String>) out.getOrDefault("assigns", Map.of());
        Set<String> fresh = new java.util.LinkedHashSet<>();
        for (Map.Entry<String, String> e : assigns.entrySet()) {
            if (e.getValue() != null && !e.getValue().isBlank() && !e.getValue().equals(user)) fresh.add(e.getValue());
        }
        if (!fresh.isEmpty()) {
            final List<String> to = new ArrayList<>(fresh);
            notify(() -> messageService.send(to, MessageService.TASK_ASSIGNED, "RD_PROD_INFO", no,
                    Map.of("productCode", productCode, "productName", productName), user));
        }
        // 旧口径消息:首次分发且总负责人落实时,提醒他安排规格书(二级审核人 ≠ 总负责人时才有意义)
        boolean firstTime = !Boolean.TRUE.equals(out.get("already"));
        if (firstTime && supervisor != null && !supervisor.equals(user) && !fresh.contains(supervisor)) {
            final String sup = supervisor;
            notify(() -> messageService.send(List.of(sup), MessageService.SPEC_DISPATCHED, "RD_PROD_INFO", no,
                    Map.of("productCode", productCode, "productName", productName), user));
        }
        Map<String, Object> r = result(no, "已下发");
        r.put("already", out.get("already"));
        r.put("productCode", productCode);
        r.put("panels", out.get("panels"));
        r.put("assigns", assigns);
        r.put("supervisor", out.get("supervisor"));
        r.put("supervisorName", out.get("supervisorName"));
        r.put("supervisorResolved", out.get("supervisorResolved"));
        return r;
    }

    /**
     * 四个下游文件的编辑门禁(2026-09-20 用户口径:未分发禁编;分发后只放该文件责任人 ∪ 管理员;
     * 四文件并行、无串行依赖)。服务端强制(前端仍保留提示)。
     *
     * 三条豁免/放宽:
     *   · 管理员恒可;
     *   · 单据**产品编号为空**(历史单/未关联产品的旧单)不拦 —— 否则 22 张既有成型工艺清单被锁死;
     *   · 规格书额外放「该单已分配的责任人 / 产品总负责人」:沿用 2026-09-12 的两级分发口径,
     *     不让既有 rd_spec_assign 分配白做(新口径的责任人在分发时会被设为 rd_dev_task.负责人,两套一致)。
     */
    private void ensureDevFileEditable(PanelRegistry.PanelDef def, String no, Map<String, Object> head, String user) {
        DevFileEdit v = devFileEditVerdict(def, no, head, user);
        if (!v.ok()) throw v.denied() == 1
                ? new IllegalStateException(v.reason())
                : new org.springframework.security.access.AccessDeniedException(v.reason());
    }

    /**
     * 四文件能不能编的**判定**(单一真源):保存门禁 {@link #ensureDevFileEditable} 与前端置灰用的
     * 接口 {@link #devFileEditState} 都走这里 —— 两边口径必须逐字一致,否则又会出现
     * "界面让改、保存被拒"(2026-09-21 走查发现的 UX 缺口)。
     *
     * @param denied 拒绝类型:1 = 未分发给 IllegalStateException(业务态,提示去分发),
     *               2 = 非责任人给 AccessDeniedException(权限态)
     */
    private record DevFileEdit(boolean applicable, boolean ok, String reason, String productCode,
                               String owner, String ownerName, int denied) {
        static DevFileEdit notApplicable() { return new DevFileEdit(false, true, "", "", "", "", 0); }
    }

    /** 责任人姓名(空账号回空串;用于前端提示"本文件责任人是谁") */
    private String ownerNameOf(String username) {
        return username == null || username.isBlank() ? "" : realNameOf(username);
    }

    private DevFileEdit devFileEditVerdict(PanelRegistry.PanelDef def, String no, Map<String, Object> head, String user) {
        if (!DevTaskService.devPanelCodes().contains(def.code())) return DevFileEdit.notApplicable();
        if (isAdminUser(user)) return new DevFileEdit(true, true, "", "", "", "", 0);
        String key = DevTaskService.productKeyOf(def.code());
        String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
        String productCode = "";
        // ① 先看**本次载荷**:新建/首次填产品编号时库里还没有这一格,只看库会漏拦(实测漏过)
        //    ⚠ 规格书例外:save() 把载荷「编号」当单据标识取走,产品编号只能从库读(由规格书分发盖章)
        if (head != null && !"RD_SPEC_DOC".equals(def.code())) {
            Object v = head.get(key);
            if (v == null) v = head.get("产品编号");
            if (v != null && !String.valueOf(v).isBlank()) productCode = String.valueOf(v).trim();
        }
        // ② 再看库里已存值
        if (productCode.isEmpty() && no != null && !no.isBlank()) {
            try {
                List<String> rows = jdbc.queryForList("SELECT TOP 1 [" + key + "] FROM " + table
                        + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", String.class, no);
                if (!rows.isEmpty() && rows.get(0) != null) productCode = rows.get(0).trim();
            } catch (Exception e) {
                return DevFileEdit.notApplicable(); // 取不到产品键(缺列等)⇒ 不拦,避免误伤
            }
        }
        if (productCode.isEmpty()) return DevFileEdit.notApplicable();   // 历史单(无产品编号)豁免
        String owner = null, ownerName = "";
        Map<String, String> assigns = devTaskService.assignsOf(productCode);
        if (assigns.isEmpty())
            return new DevFileEdit(true, false,
                    "该产品(" + productCode + ")尚未分发责任人，请先在产品信息表点「分发责任人」",
                    productCode, "", "", 1);
        owner = assigns.get(def.code());
        if (user.equals(owner)) return new DevFileEdit(true, true, "", productCode, owner, ownerNameOf(owner), 0);
        if ("RD_SPEC_DOC".equals(def.code())) {
            // 兼容既有规格书两级分发:已分配的责任人 / 产品总负责人照样可编辑
            Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM rd_spec_assign WHERE 单据编号 = ? AND 责任人 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    Integer.class, no, user);
            if (n != null && n > 0) return new DevFileEdit(true, true, "", productCode, owner, ownerNameOf(owner), 0);
            if (user.equals(devTaskService.supervisorOf(productCode)))
                return new DevFileEdit(true, true, "", productCode, owner, ownerNameOf(owner), 0);
        }
        return new DevFileEdit(true, false, "只有该文件的责任人（或管理员）可以编辑", productCode,
                owner == null ? "" : owner, ownerNameOf(owner), 2);
    }

    /**
     * 前端置灰用:当下登录账号对「某面板某单据」有没有编辑权(四文件门禁)。
     * 返回 { applicable, canEdit, reason, productCode, owner, ownerName };applicable=false = 该面板不受此门禁约束。
     */
    public Map<String, Object> devFileEditState(String panelCode, String docNo) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        Map<String, Object> out = new LinkedHashMap<>();
        if (def == null) {
            out.put("applicable", false);
            out.put("canEdit", true);
            return out;
        }
        DevFileEdit v = devFileEditVerdict(def, docNo, null, currentUserName());
        out.put("applicable", v.applicable());
        out.put("canEdit", v.ok());
        out.put("reason", v.reason());
        out.put("productCode", v.productCode());
        out.put("owner", v.owner());
        out.put("ownerName", v.ownerName());
        return out;
    }

    /**
     * 规格书分发(2026-09-12 两级分发第二级,当日改口径:不按种类建单,分发=把已有单据分给人)。
     * formData = {编号: 产品信息表单据编号, assigns: [{编号: 规格书单据编号, 责任人: 账号}]}。
     * 产品编号/名称/负责人一律服务端自查(不信客户端);分配后仅 责任人∪总负责人∪管理员 可编辑
     * (ensureSpecAssignEditable 在 保存/申请修改/删除 三个入口强制)。
     * 绑定:单据须存活、未分配过(一单一条活分配,分发过的不再重复分发)、编号为空或属本产品;
     * 绑定时 rd_spec_doc_head.编号 盖产品编号章(正常运行时唯一写入方,进度匹配依据)。多张同一事务全成或全无。
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> specAssign(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        if (!"RD_PROD_INFO".equals(def.code())) throw new IllegalStateException("仅产品信息表可执行规格书分发");
        String user = currentUserName();
        String no = requireNo(formData);
        ensureDocExists(def, no);
        Map<String, Object> head = jdbc.queryForMap(
                "SELECT TOP 1 产品编号, 产品名称 FROM rd_prod_info_head WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        String productCode = head.get("产品编号") == null ? "" : String.valueOf(head.get("产品编号")).trim();
        String productName = head.get("产品名称") == null ? "" : String.valueOf(head.get("产品名称")).trim();
        if (productCode.isEmpty()) throw new IllegalStateException("产品信息表的「产品编号」为空,无法分发");
        if (!devTaskService.dispatched(productCode))
            throw new IllegalStateException("该产品未下发产品开发，请先下发");
        if (!devTaskService.isSupervisorOrAdmin(productCode, user))
            throw new org.springframework.security.access.AccessDeniedException("该产品已下发，仅总负责人或管理员可执行规格书分发");
        // 解析 assigns 并整体校验(全成或全无)。2026-09-12 用户口径:分发=把已有规格书单分给人,
        // 不再按种类建单——条目 = {编号: 规格书单据编号, 责任人: 账号}
        Object raw = formData.get("assigns");
        List<Map<String, Object>> assigns = raw instanceof List<?> l
                ? l.stream().filter(x -> x instanceof Map).map(x -> (Map<String, Object>) x).toList() : List.of();
        if (assigns.isEmpty()) throw new IllegalArgumentException("请至少填写一条分发(规格书单据 + 责任人)");
        Set<String> seenDoc = new HashSet<>();
        for (Map<String, Object> a : assigns) {
            String docNo = a.get("编号") == null ? "" : String.valueOf(a.get("编号")).trim();
            String owner = a.get("责任人") == null ? "" : String.valueOf(a.get("责任人")).trim();
            if (docNo.isEmpty()) throw new IllegalArgumentException("分发条目缺少「规格书单据」");
            if (owner.isEmpty()) throw new IllegalArgumentException("分发条目「" + docNo + "」缺少责任人");
            if (!seenDoc.add(docNo)) throw new IllegalArgumentException("同一请求内规格书单据重复：" + docNo);
            Integer enabled = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM yj_user WHERE username = ? AND ISNULL(enabled,'1') = '1'", Integer.class, owner);
            if (enabled == null || enabled == 0)
                throw new IllegalArgumentException("责任人账号不存在或已停用：" + owner);
        }
        String supervisor = devTaskService.supervisorOf(productCode);
        String supervisorSnapshot = supervisor == null ? user : supervisor; // 挂起产品快照操作人(admin)
        // 绑定 + 写分配(同一事务):单据须存活、未分配过(分发过的不再重复分发)、
        // 且 编号为空(普通保存从不写该列)或已属于本产品;绑定时给单据盖上产品编号(进度匹配依据)
        List<Map<String, Object>> assigned = new ArrayList<>();
        for (Map<String, Object> a : assigns) {
            String docNo = String.valueOf(a.get("编号")).trim();
            String owner = String.valueOf(a.get("责任人")).trim();
            List<Map<String, Object>> docs = jdbc.queryForList(
                    "SELECT h.编号, h.规格书种类, ISNULL(s.deleting,'N') AS deleting, ISNULL(s.stopped,'N') AS stopped"
                            + " FROM rd_spec_doc_head h LEFT JOIN yj_doc_status s ON s.panel_code = 'RD_SPEC_DOC'"
                            + " AND s.doc_no = h.单据编号"
                            + " WHERE h.单据编号 = ? AND ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'", docNo);
            if (docs.isEmpty()) throw new IllegalArgumentException("规格书单据不存在或已作废：" + docNo);
            // 删除申请中/已中止单据不可分发(2026-09-12「删除的就不再显示选择」:与候选列表排除口径一致)
            if ("Y".equals(String.valueOf(docs.get(0).get("deleting"))))
                throw new IllegalArgumentException("规格书单据正在删除审批中，不可分发：" + docNo);
            if ("Y".equals(String.valueOf(docs.get(0).get("stopped"))))
                throw new IllegalArgumentException("规格书单据已中止，不可分发：" + docNo);
            String docProduct = docs.get(0).get("编号") == null ? "" : String.valueOf(docs.get(0).get("编号")).trim();
            if (!docProduct.isEmpty() && !docProduct.equals(productCode))
                throw new IllegalArgumentException("规格书单据「" + docNo + "」已属于其他产品（" + docProduct + "）");
            List<Map<String, Object>> prev = jdbc.queryForList(
                    "SELECT TOP 1 责任人 FROM rd_spec_assign WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
            if (!prev.isEmpty())
                throw new IllegalArgumentException("该规格书已分发：" + docNo + "（责任人 " + prev.get(0).get("责任人") + "），请勿重复分发");
            String kind = docs.get(0).get("规格书种类") == null ? "" : String.valueOf(docs.get(0).get("规格书种类")).trim();
            // 盖章:产品编号列(正常保存路径从不写,分发是运行时唯一写入方)+ 操作人留痕
            jdbc.update("UPDATE rd_spec_doc_head SET 编号 = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE 单据编号 = ?",
                    productCode, user, docNo);
            Map<String, Object> asg = new LinkedHashMap<>();
            asg.put("产品编号", productCode);
            asg.put("单据编号", docNo);
            asg.put("规格书种类", kind); // 单据自带种类的快照,仅展示用
            asg.put("负责人", supervisorSnapshot);
            asg.put("责任人", owner);
            insertRow("rd_spec_assign", asg, user);
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("单据编号", docNo);
            c.put("规格书种类", kind);
            c.put("责任人", owner);
            assigned.add(c);
            notify(() -> messageService.send(List.of(owner), MessageService.SPEC_ASSIGNED, "RD_SPEC_DOC", docNo,
                    Map.of("kind", kind, "productCode", productCode, "productName", productName), user));
        }
        Map<String, Object> r = result(no, "已分发");
        r.put("productCode", productCode);
        r.put("assigned", assigned);
        return r;
    }

    /** 已分配规格书单的编辑封锁:仅 责任人∪总负责人(活值)∪管理员 可保存/申请修改/删除;
     *  未分配的历史单不受限(直接放行)。 */
    private void ensureSpecAssignEditable(PanelRegistry.PanelDef def, String no, String user) {
        if (!"RD_SPEC_DOC".equals(def.code())) return;
        if (isAdminUser(user)) return;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 产品编号, 责任人 FROM rd_spec_assign WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        if (rows.isEmpty()) return;
        String owner = String.valueOf(rows.get(0).get("责任人"));
        if (user.equals(owner)) return;
        if (devTaskService.isSupervisorOrAdmin(String.valueOf(rows.get(0).get("产品编号")), user)) return;
        throw new org.springframework.security.access.AccessDeniedException("该规格书已分发：仅责任人、总负责人或管理员可保存/申请修改/删除");
    }

    /** 建单防绕过:保存载荷的「编号」是单据编号——若该号不是已有单据、却命中已下发产品的产品编号,
     *  说明有人以产品码为单号手工建规格书单(封面编号格输入产品编码保存),要求总负责人/admin。
     *  (物理 rd_spec_doc_head.编号 产品列正常保存路径从不写,唯一的手动向量就是这个改主键通道。)
     *  空白 directAdd 草稿编号=NULL 不参与产品匹配,天然无法绕过分发。 */
    private void ensureSpecCreateAllowed(PanelRegistry.PanelDef def, String no, String user) {
        if (!"RD_SPEC_DOC".equals(def.code())) return;
        if (no == null || no.isBlank() || isAdminUser(user)) return;
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM rd_spec_doc_head WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                Integer.class, no);
        if (existing != null && existing > 0) return; // 改既有单,走 ensureSpecAssignEditable
        if (!devTaskService.dispatched(no)) return;   // 未下发产品,维持自由建单
        if (!devTaskService.isSupervisorOrAdmin(no, user))
            throw new org.springframework.security.access.AccessDeniedException("该产品已下发产品开发，规格书单据须由总负责人在「规格书分发」中创建");
    }

    /** 编辑权:管理员恒可;普通用户角色对该面板勾了 add 或 modify */
    private boolean canEdit(String user, String panelCode) {
        if (isAdminUser(user)) return true;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT rp.perms FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                        + " WHERE u.username = ? AND rp.panel_code = ?", user, panelCode);
        for (Map<String, Object> row : rows) {
            String perms = row.get("perms") == null ? "" : String.valueOf(row.get("perms"));
            for (String p : perms.split(",")) {
                String t = p.trim();
                if ("add".equals(t) || "modify".equals(t)) return true;
            }
        }
        return false;
    }

    /** 申请修改:已归档/已审核 → 修改申请中(待管理员审批) */
    private Map<String, Object> modifyRequest(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        String no = requireNo(formData);
        ensureDocExists(def, no);
        ensureSpecAssignEditable(def, no, user); // 已分配规格书:申请修改同样仅 责任人∪总负责人∪管理员
        if (DevTaskService.devPanelCodes().contains(def.code())) ensureDevFileEditable(def, no, null, user); // 四文件门禁同口径
        String st = String.valueOf(docStatusOf(def.code(), no).get("status"));
        if (!"已归档".equals(st) && !"已审核".equals(st)) throw new IllegalStateException("仅已归档单据可申请修改");
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?, ?)) AS s(panel_code, doc_no) "
                        + "ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no "
                        + "WHEN MATCHED THEN UPDATE SET modify_state = 'R', modify_req_by = ?, modify_req_at = GETDATE(), update_at = GETDATE() "
                        + "WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, modify_state, modify_req_by, modify_req_at, update_at) "
                        + "VALUES (s.panel_code, s.doc_no, 'R', ?, GETDATE(), GETDATE());",
                def.code(), no, user, user);
        recordApproval(def.code(), no, "MODIFY_REQ", "PENDING", opinionOf(formData));
        // 消息:申请修改 → 管理员
        notify(() -> messageService.sendToAdmins(def.code(), no, MessageService.MODIFY_REQUESTED,
                Map.of("docNo", no, "actor", user, "opinion", opinionOf(formData)), user));
        return result(no, "修改申请中");
    }

    /** 修改审批通过(仅管理员):快照入库 → 修改态(可编辑,保存不再自动归档) */
    private Map<String, Object> modifyApprove(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!canApprove(user, def.code())) throw new IllegalStateException("当前角色无该面板的修改审批权限");
        String no = requireNo(formData);
        Map<String, Object> st = docStatusOf(def.code(), no);
        if (!"修改申请中".equals(st.get("status"))) throw new IllegalStateException("无待审批的修改申请");
        Map<String, Object> row = st.get("row") instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
        String applyBy = row == null || row.get("modify_req_by") == null ? user : String.valueOf(row.get("modify_req_by"));
        Object applyAt = row == null ? null : row.get("modify_req_at");
        jdbc.update("INSERT INTO yj_doc_modify_log (panel_code, doc_no, apply_by, apply_at, approve_by, approve_at, snapshot_head, snapshot_rows) "
                        + "VALUES (?,?,?,?,?,?,?,?)",
                def.code(), no, applyBy, applyAt, user, LocalDateTime.now(),
                toJson(headLabelSnapshot(def, no)), toJson(rowSnapshots(def, no)));
        int n = jdbc.update("UPDATE yj_doc_status SET modify_state='Y', modify_appr_by=?, modify_appr_at=GETDATE(), archived='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND modify_state='R'", user, def.code(), no);
        if (n == 0) throw new IllegalStateException("无待审批的修改申请");
        recordApproval(def.code(), no, "MODIFY_APPROVE", "MODIFYING", opinionOf(formData));
        // 消息:修改申请已同意 → 申请人(2026-09-12 补齐,申请人此前只在提交时收到过消息,结果无感知)
        if (!applyBy.isBlank()) notify(() -> messageService.send(List.of(applyBy), MessageService.MODIFY_APPROVED, def.code(), no,
                Map.of("docNo", no, "actor", user, "opinion", opinionOf(formData)), user));
        return result(no, "修改中");
    }

    /** 修改审批驳回(仅管理员):恢复已归档 */
    private Map<String, Object> modifyReject(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String user = currentUserName();
        if (!canApprove(user, def.code())) throw new IllegalStateException("当前角色无该面板的修改审批权限");
        String no = requireNo(formData);
        String reqBy = requestByOf(def.code(), no, "modify_req_by");
        String opinion = opinionOf(formData);
        int n = jdbc.update("UPDATE yj_doc_status SET modify_state=NULL, update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=? AND modify_state='R'", def.code(), no);
        if (n == 0) throw new IllegalStateException("无待审批的修改申请");
        recordApproval(def.code(), no, "MODIFY_REJECT", "ARCHIVED", opinion);
        // 消息:修改申请被驳回 → 申请人
        if (!reqBy.isBlank()) notify(() -> messageService.send(List.of(reqBy), MessageService.MODIFY_REJECTED, def.code(), no,
                Map.of("docNo", no, "actor", user, "opinion", opinion), user));
        return result(no, String.valueOf(docStatusOf(def.code(), no).get("status")));
    }

    // ══════════ 档案式面板「修改记录」(2026-09-22):每次存档留痕 ══════════
    // 档案式面板(QC_INSP_REQ 来料检验要求等)是整表 upsert 的全局资料,没有「申请修改/审批/再归档」闭环,
    // 故另立一张 yj_archive_change_log:每次保存比对「保存前快照 vs 提交内容」,记一条
    // (谁/何时/新增·删除·修改了几行/字段级 原值→新值)。库内全量保留,展示只取最近 3 条。

    /** 存档前快照:存活行 (行id -> 字段label -> 文本值),供保存后比对 */
    private Map<Object, Map<String, String>> archiveRowSnapshot(PanelRegistry.PanelDef def) {
        Map<Object, Map<String, String>> out = new LinkedHashMap<>();
        if (def.isDoc() || def.lineTable() == null || def.fields().isEmpty()) return out;
        LinkedHashSet<String> cols = new LinkedHashSet<>();
        for (PanelRegistry.FieldDef f : def.fields()) if (f.col() != null) cols.add(f.col());
        StringBuilder sql = new StringBuilder("SELECT ").append(def.pkCol());
        for (String c : cols) sql.append(", [").append(c).append("]");
        sql.append(" FROM ").append(def.lineTable()).append(" WHERE ISNULL(asp_cancel,'N')<>'Y'");
        for (Map<String, Object> r : jdbc.queryForList(sql.toString())) {
            Object id = pickCol(r, def.pkCol());
            if (id == null) continue;
            Map<String, String> vals = new LinkedHashMap<>();
            for (PanelRegistry.FieldDef f : def.fields()) vals.put(f.label(), nv(pickCol(r, f.col())));
            out.put(id, vals);
        }
        return out;
    }

    /** 存档后写一条修改记录(无变化不写;字段级变化最多 80 条,超出置 truncated) */
    private void recordArchiveChange(PanelRegistry.PanelDef def, Map<Object, Map<String, String>> before,
                                     List<Map<String, Object>> items, Set<Object> liveIds, String user) {
        if (def.isDoc() || def.lineTable() == null) return;
        List<Map<String, Object>> changes = new ArrayList<>();
        List<String> addedSamples = new ArrayList<>(), changedSamples = new ArrayList<>(), removedSamples = new ArrayList<>();
        int addedRows = 0, changedRows = 0, removedRows = 0;
        boolean truncated = false;
        for (Map<String, Object> item : items) {
            Object id = item.get("id");
            String sample = archiveRowSample(def, item);
            if (id == null || String.valueOf(id).isBlank()) { // 无 id = 新增行
                addedRows++;
                if (addedSamples.size() < 5) addedSamples.add(sample);
                continue;
            }
            Map<String, String> old = before.get(id);
            if (old == null) { // 库里原无此行(软删后复活):记行级变更,不做字段比对
                changedRows++;
                if (changedSamples.size() < 5) changedSamples.add(sample);
                continue;
            }
            boolean touched = false;
            for (PanelRegistry.FieldDef f : def.fields()) {
                String o = old.getOrDefault(f.label(), "");
                String n = nv(item.get(f.label()));
                if (o.equals(n)) continue;
                touched = true;
                if (changes.size() < 80) {
                    Map<String, Object> c = new LinkedHashMap<>();
                    c.put("label", sample + " · " + f.label());
                    c.put("kind", o.isEmpty() ? "补充" : (n.isEmpty() ? "清空" : "变化"));
                    c.put("old", o);
                    c.put("new", n);
                    changes.add(c);
                } else {
                    truncated = true;
                }
            }
            if (touched) {
                changedRows++;
                if (changedSamples.size() < 5) changedSamples.add(sample);
            }
        }
        for (Map.Entry<Object, Map<String, String>> e : before.entrySet()) {
            if (liveIds.contains(e.getKey())) continue;
            removedRows++;
            if (removedSamples.size() < 5) removedSamples.add(archiveRowSample(def, e.getValue()));
        }
        if (addedRows + changedRows + removedRows == 0) return; // 空存不留痕
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("addedRows", addedRows);
        meta.put("removedRows", removedRows);
        meta.put("changedRows", changedRows);
        meta.put("addedSamples", addedSamples);
        meta.put("removedSamples", removedSamples);
        meta.put("changedSamples", changedSamples);
        if (truncated) meta.put("truncated", true);
        jdbc.update("INSERT INTO yj_archive_change_log (panel_code, doc_no, user_name, saved_at, change_meta, changes)"
                        + " VALUES (?,?,?,GETDATE(),?,?)",
                def.code(), def.name(), user, toJson(meta), toJson(changes));
    }

    /** 行的可读标识:优先「编号/名称/类别」类字段取前两个非空值(如「折叠棉 YJ-YCYX-006」),退回首列值 */
    private String archiveRowSample(PanelRegistry.PanelDef def, Map<String, ?> row) {
        List<String> picks = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fields()) {
            String label = f.label() == null ? "" : f.label();
            if (!(label.contains("编号") || label.contains("名称") || label.contains("类别"))) continue;
            String v = nv(row.get(label));
            if (v.isEmpty()) continue;
            picks.add(v);
            if (picks.size() >= 2) break;
        }
        if (picks.isEmpty()) {
            for (PanelRegistry.FieldDef f : def.fields()) {
                String v = nv(row.get(f.label()));
                if (!v.isEmpty()) { picks.add(v); break; }
            }
        }
        return picks.isEmpty() ? "(空行)" : String.join(" ", picks);
    }

    /** 档案式面板修改记录:近 3 条存档留痕(库内全量保留不删) */
    private Map<String, Object> archiveChangeHistory(PanelRegistry.PanelDef def) {
        List<Map<String, Object>> records = jdbc.queryForList(
                "SELECT TOP 3 user_name, saved_at, changes, change_meta FROM yj_archive_change_log"
                        + " WHERE panel_code=? ORDER BY id DESC", def.code());
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : records) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("applyBy", pickCol(r, "user_name"));
            m.put("applyAt", fmtTime(pickCol(r, "saved_at")));
            m.put("changes", pickCol(r, "changes"));
            m.put("changeMeta", pickCol(r, "change_meta"));
            list.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", def.name());
        out.put("records", list);
        return out;
    }

    /** 结果集取值:列名大小写/别名兜底(驱动回传的键名不一定与 SQL 字面一致) */
    private static Object pickCol(Map<String, Object> row, String key) {
        if (row == null || key == null) return null;
        if (row.containsKey(key)) return row.get(key);
        for (Map.Entry<String, Object> e : row.entrySet())
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(key)) return e.getValue();
        return null;
    }

    /** 留痕用文本:null/空 -> "" */
    private static String nv(Object o) {
        String s = str(o);
        return s == null ? "" : s;
    }

    /** 修改记录:展示最近3条(库内全量留痕不删,2026-09-12);打开即刷新未收尾记录的 diff */
    private Map<String, Object> modifyHistory(PanelRegistry.PanelDef def, Map<String, Object> formData) {
        String no = requireNo(formData);
        // 修改中/审批中随时打开可见当前已改内容(快照 vs 当前实时 diff)
        refreshModifyDiff(def, no);
        List<Map<String, Object>> records = jdbc.queryForList(
                "SELECT TOP 3 apply_by, apply_at, approve_by, approve_at, rearchive_by, rearchive_at, changes, change_meta"
                        + " FROM yj_doc_modify_log WHERE panel_code=? AND doc_no=? ORDER BY id DESC", def.code(), no);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : records) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("applyBy", r.get("apply_by"));
            m.put("applyAt", fmtTime(r.get("apply_at")));
            m.put("approveBy", r.get("approve_by"));
            m.put("approveAt", fmtTime(r.get("approve_at")));
            m.put("rearchiveBy", r.get("rearchive_by"));
            m.put("rearchiveAt", fmtTime(r.get("rearchive_at")));
            m.put("changes", r.get("changes"));
            m.put("changeMeta", r.get("change_meta"));
            list.add(m);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("编号", no);
        out.put("records", list);
        return out;
    }

    /** 刷新修改记录 diff:未收尾记录的快照 vs 当前(头字段 变化/补充/清空 + 明细行摘要);返回是否存在未收尾记录 */
    private boolean refreshModifyDiff(PanelRegistry.PanelDef def, String no) {
        List<Map<String, Object>> open = jdbc.queryForList(
                "SELECT TOP 1 id, snapshot_head, snapshot_rows FROM yj_doc_modify_log"
                        + " WHERE panel_code=? AND doc_no=? AND rearchive_by IS NULL ORDER BY id DESC", def.code(), no);
        if (open.isEmpty()) return false;
        Map<String, String> oldHead = fromJsonMap(open.get(0).get("snapshot_head"));
        Map<String, String> curHead = headLabelSnapshot(def, no);
        List<Map<String, Object>> changes = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
            String oldV = oldHead.getOrDefault(f.label(), "");
            String newV = curHead.getOrDefault(f.label(), "");
            if (oldV.equals(newV)) continue;
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("label", f.label());
            c.put("kind", oldV.isEmpty() ? "补充" : (newV.isEmpty() ? "清空" : "变化"));
            c.put("old", oldV);
            c.put("new", newV);
            changes.add(c);
        }
        Map<String, Object> meta = rowDiffMeta(fromJsonList(open.get(0).get("snapshot_rows")), rowSnapshots(def, no));
        jdbc.update("UPDATE yj_doc_modify_log SET changes=?, change_meta=? WHERE id=?",
                toJson(changes), toJson(meta), open.get(0).get("id"));
        return true;
    }

    /** 再归档收尾:存在未收尾修改记录(申请修改闭环,或弃审后再编辑——2026-09-12 泛化,不再只认修改态)
     *  时:刷新 diff → 盖章再归档留痕 → 修改态归位。修改记录全量保留,不再物理删到只剩3条
     *  (审计要求:删掉的旧改动无法追溯;展示侧 modifyHistory 仍只列最近3条)。 */
    private boolean finalizeOpenModify(PanelRegistry.PanelDef def, String no, String user) {
        List<Map<String, Object>> open = jdbc.queryForList(
                "SELECT TOP 1 id FROM yj_doc_modify_log WHERE panel_code=? AND doc_no=? AND rearchive_by IS NULL ORDER BY id DESC",
                def.code(), no);
        if (open.isEmpty()) return false;
        refreshModifyDiff(def, no);
        jdbc.update("UPDATE yj_doc_modify_log SET rearchive_by=?, rearchive_at=GETDATE()"
                        + " WHERE panel_code=? AND doc_no=? AND rearchive_by IS NULL",
                user, def.code(), no);
        jdbc.update("UPDATE yj_doc_status SET modify_state=NULL, archived='Y', pending='N', update_at=GETDATE()"
                + " WHERE panel_code=? AND doc_no=?", def.code(), no);
        return true;
    }

    /** 弃审快照:无未收尾修改记录时插一条(apply/approve 记弃审人;快照=弃审前数据) */
    private void snapshotOnUnaudit(PanelRegistry.PanelDef def, String no, String user) {
        List<Map<String, Object>> open = jdbc.queryForList(
                "SELECT id FROM yj_doc_modify_log WHERE panel_code=? AND doc_no=? AND rearchive_by IS NULL",
                def.code(), no);
        if (!open.isEmpty()) return;
        jdbc.update("INSERT INTO yj_doc_modify_log (panel_code, doc_no, apply_by, apply_at, approve_by, approve_at, snapshot_head, snapshot_rows) "
                        + "VALUES (?,?,?,?,?,?,?,?)",
                def.code(), no, user, LocalDateTime.now(), user, LocalDateTime.now(),
                toJson(headLabelSnapshot(def, no)), toJson(rowSnapshots(def, no)));
    }

    /** 明细行变化摘要:新增/删除/修改行数 + 各取至多5个行标签样例 */
    private Map<String, Object> rowDiffMeta(List<Map<String, Object>> oldRows, List<Map<String, Object>> curRows) {
        Map<String, Map<String, Object>> oldById = new LinkedHashMap<>();
        for (Map<String, Object> r : oldRows) oldById.put(String.valueOf(r.get("id")), r);
        Map<String, Map<String, Object>> curById = new LinkedHashMap<>();
        for (Map<String, Object> r : curRows) curById.put(String.valueOf(r.get("id")), r);
        List<String> added = new ArrayList<>();
        List<String> removed = new ArrayList<>();
        int changed = 0;
        for (Map.Entry<String, Map<String, Object>> e : curById.entrySet()) {
            Map<String, Object> old = oldById.get(e.getKey());
            if (old == null) added.add(String.valueOf(e.getValue().getOrDefault("label", e.getKey())));
            else if (!String.valueOf(old.get("hash")).equals(String.valueOf(e.getValue().get("hash")))) changed++;
        }
        for (Map.Entry<String, Map<String, Object>> e : oldById.entrySet()) {
            if (!curById.containsKey(e.getKey())) removed.add(String.valueOf(e.getValue().getOrDefault("label", e.getKey())));
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("addedRows", added.size());
        meta.put("removedRows", removed.size());
        meta.put("changedRows", changed);
        meta.put("addedSamples", added.subList(0, Math.min(5, added.size())));
        meta.put("removedSamples", removed.subList(0, Math.min(5, removed.size())));
        return meta;
    }

    private String modifyStateOf(String panelCode, String no) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT modify_state FROM yj_doc_status WHERE panel_code=? AND doc_no=?", panelCode, no);
        return rows.isEmpty() || rows.get(0).get("modify_state") == null ? "" : String.valueOf(rows.get(0).get("modify_state"));
    }

    /** 头字段快照:头表当前行 → 标签→字符串值(去空白) */
    private Map<String, String> headLabelSnapshot(PanelRegistry.PanelDef def, String no) {
        String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM " + table + " WHERE " + def.groupCol() + " = ? AND ISNULL(asp_cancel,'N')<>'Y'", no);
        Map<String, String> out = new LinkedHashMap<>();
        if (rows.isEmpty()) return out;
        Map<String, Object> row = rows.get(0);
        for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
            Object v = row.get(f.col());
            out.put(f.label(), v == null ? "" : String.valueOf(v).trim());
        }
        return out;
    }

    /** 明细行快照:行主键/指纹(全部字段值拼接)/业务标签(首个非空文本字段值) */
    private List<Map<String, Object>> rowSnapshots(PanelRegistry.PanelDef def, String no) {
        if (!def.hasHeadTable() || def.lineTable() == null || def.lineTable().equals(def.headTable())) return List.of();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM " + def.lineTable() + " WHERE " + def.groupCol() + " = ? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY " + def.pkCol(), no);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            StringBuilder hash = new StringBuilder();
            String label = "";
            for (PanelRegistry.FieldDef f : def.fields()) {
                Object v = row.get(f.col());
                String s = v == null ? "" : String.valueOf(v);
                hash.append(f.col()).append('=').append(s).append(';');
                String colName = String.valueOf(f.col()).toLowerCase();
                if (label.isEmpty() && !s.isEmpty() && !colName.equals("id") && !colName.equals(String.valueOf(def.pkCol()).toLowerCase())) label = s;
            }
            Object id = row.get(def.pkCol()) != null ? row.get(def.pkCol()) : row.get("id");
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("hash", hash.toString());
            m.put("label", label);
            out.add(m);
        }
        return out;
    }

    private static final ObjectMapper MODIFY_JSON = new ObjectMapper();

    private String toJson(Object o) {
        try {
            return MODIFY_JSON.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException("修改记录序列化失败", e);
        }
    }

    private Map<String, String> fromJsonMap(Object json) {
        try {
            return json == null ? Map.of() : MODIFY_JSON.readValue(String.valueOf(json),
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private List<Map<String, Object>> fromJsonList(Object json) {
        try {
            return json == null ? List.of() : MODIFY_JSON.readValue(String.valueOf(json),
                    new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String fmtTime(Object t) {
        if (t == null) return "";
        if (t instanceof java.sql.Timestamp ts) return ts.toLocalDateTime()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        return String.valueOf(t);
    }

    private boolean isAdminUser(String user) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT is_admin FROM yj_user WHERE username=?", user);
        return !rows.isEmpty() && "Y".equals(String.valueOf(rows.get(0).get("is_admin")));
    }

    /** 单据制单人(头行式取头表、单表式取首行 asp_user1):编制审核分离用 */
    private String authorOfDoc(PanelRegistry.PanelDef def, String no) {
        try {
            String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
            List<String> rows = jdbc.queryForList(
                    "SELECT TOP 1 asp_user1 FROM " + table + " WHERE " + def.groupCol() + " = ?", String.class, no);
            return rows.isEmpty() || rows.get(0) == null ? "" : String.valueOf(rows.get(0));
        } catch (Exception e) {
            return "";
        }
    }

    // ============ 工具 ============

    private String requireNo(Map<String, Object> formData) {
        Object no = formData == null ? null : formData.get("编号");
        if (no == null || String.valueOf(no).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        return String.valueOf(no);
    }

    private void ensureDocExists(PanelRegistry.PanelDef def, String no) {
        String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + def.groupCol() + " = ? AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, no);
        if (c == null || c == 0) throw new IllegalArgumentException("表单数据不存在：" + no);
    }

    /** 单据时间戳统一格式(创建时间列 nvarchar,与金蝶同步口径一致) */
    private static final java.time.format.DateTimeFormatter TS_FMT =
            java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 文件类面板(文书式):保存即归档,退出草稿状态机;后续新增文件类面板在此登记(SysAdminController 权限动作集引用) */
    public static final java.util.Set<String> DOC_ARCHIVE_PANELS = java.util.Set.of(
            "RD_APPROVAL", "RD_PLAN", "RD_FILTER_EFF",
            "RD_ALKALINE", "RD_MINERAL", "RD_ANTIBACT", "RD_SCALE", "RD_RO_PROTECT", "RD_SOAK", "RD_DROP_PREC",
            "RD_SPIKE_WATER", "RD_DOM_TEST", "RD_EQUIP_USE", "RD_INSTR_USE",
            "RD_MOLD_PROC", "RD_MOLD_FORMULA", "RD_ASM_BOM", "RD_ASM_PROC", "RD_SPEC_DOC", "RD_INSP_PLAN", "RD_PROD_INFO",
            // 2026-09-18 新增:样品编号表 —— 发号台账,改样品编号=改追溯锚点,必须防篡改,故入归档闭环。
            // ⚠ RD_PROD_DOCLIST(产品文件列表)**刻意不入本集合**:它是**只读派生视图**
            //   (4 文件×状态矩阵由 DevTaskService 实时推导,面板本身没有可归档的"纸"),
            //   没有「新增」入口、永远没有单据可归档;登记进来只会让归档/修改闭环指向空集合。
            //   与 RD_PROGRESS(单单据、永远草稿、刻意排除)同一类处置 —— 见 CONTEXT「文书归档面板」。
            // 来料品质·检验数据记录(QC_INSP_REC,2026-09-22 用户口径)同样**不入本集合**:
            //   走**普通审批流**(保存=草稿/提交审批=审批中/审批通过=已审核)而非"保存即归档"
            //   —— 管理员保存即归档会让"提交审批"看起来直接归档,用户口径不认(曾登记后移出)。
            "RD_SAMPLE_NO");
    /** 文件类面板(有文档编号列):保存校验文档编号唯一(不允许重复)。
     *  ⚠ RD_INSP_PLAN(出货检验计划表)**刻意不入本集合**(2026-09-20 用户口径):
     *   它的文档编号不是"单据号"而是**表单固定值** —— 前端 recordSheetConfigs.js 的
     *   docNoDefault='YJ-RD001' 与 DB 默认约束 DF_insp_docno DEFAULT N'YJ-RD001'
     *   (tools/migrate-rd-prod-sheets.sql)双双把它钉死;留在集合里 ⇒ 第二张计划一保存就被
     *   "文档编号不允许重复：YJ-RD001" 挡下,面板实际只能存在一张单(已稳定复现)。
     *   一个产品一份检验计划应能共存 ⇒ 移出集合。 */
    private static final java.util.Set<String> DOC_NO_PANELS = java.util.Set.of(
            "RD_APPROVAL", "RD_PLAN", "RD_PROGRESS", "RD_FILTER_EFF",
            "RD_ALKALINE", "RD_MINERAL", "RD_ANTIBACT", "RD_SCALE", "RD_RO_PROTECT", "RD_SOAK", "RD_DROP_PREC",
            "RD_DOM_TEST");

    /** 单据状态查询(供生单等领域动作校验来源单状态) */
    public Map<String, Object> docStatus(String panelCode, String no) {
        return docStatusOf(panelCode, no);
    }

    /** 状态推导:已作废 > 已中止(含金蝶手动关闭) > 删除申请中 > 修改申请中 > 待二级审批/审批中 > 修改中 > 已生效 > 已归档 > 已完成(金蝶自动关单) > 已审核 > 草稿
     *  (2026-09-20 两级审批:待一级=「审批中」,一级通过后=「待二级审批」—— 两处推导必须同改,
     *   另一处在 QueryService.docStatus,管列表行状态) */
    private Map<String, Object> docStatusOf(String panelCode, String no) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT shr, canceled, stopped, pending, pending_by, pending_at, archived, deleting, modify_state, modify_req_by, modify_req_at, modify_appr_by, modify_appr_at, approve_node, l2_approver, effective, erp_close_state FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?",
                panelCode, no);
        Map<String, Object> out = new HashMap<>();
        Map<String, Object> r = rows.isEmpty() ? null : rows.get(0);
        // 项目实施计划:终止二级审批状态(2026-09-11)——已终止 > 终止审批中,排在删除申请中之后
        String ts = "RD_PLAN".equals(panelCode) && r != null ? termStateOf(no) : null;
        if (r == null) {
            out.put("status", "草稿");
        } else if ("Y".equals(r.get("canceled"))) {
            out.put("status", "已作废");
        } else if ("Y".equals(r.get("stopped"))) {
            out.put("status", "已中止");
        } else if ("H".equals(r.get("erp_close_state"))) {
            // 金蝶「手动关闭」= 人工终止(方案 A,2026-09-20):与 MES 中止同义
            out.put("status", "已中止");
        } else if ("Y".equals(r.get("deleting"))) {
            out.put("status", "删除申请中");
        } else if ("T".equals(ts)) {
            out.put("status", "已终止");
        } else if ("P2".equals(ts)) {
            out.put("status", "终止审批中（管理员）");
        } else if ("P1".equals(ts)) {
            out.put("status", "终止审批中（立项人）");
        } else if ("R".equals(r.get("modify_state"))) {
            out.put("status", "修改申请中");
        } else if (CHANGE_PANEL.equals(panelCode) && !signoffPending(no).isEmpty()) {
            // 产品变更申请单:有 PENDING 签名 = 会签中(排在审批中之前;会签全通过时会自动转审批)
            out.put("status", "会签中");
        } else if ("Y".equals(r.get("pending"))) {
            out.put("status", nodeOf(r) == 2 ? "待二级审批" : "审批中");
        } else if ("Y".equals(r.get("modify_state"))) {
            out.put("status", "修改中");
        } else if ("Y".equals(r.get("effective"))) {
            // 产品变更申请单:审批通过即生效(终态,不再叫「已审核」)
            out.put("status", "已生效");
        } else if ("Y".equals(r.get("archived"))) {
            out.put("status", "已归档");
        } else if ("S".equals(r.get("erp_close_state"))) {
            // 金蝶「已关闭」= 下游全执行完系统自动关单 → 业务语义"做完了"(方案 A,2026-09-20)
            out.put("status", "已完成");
        } else if (r.get("shr") != null) {
            out.put("status", "已审核");
        } else {
            out.put("status", "草稿");
        }
        if (r != null) out.put("row", r);
        return out;
    }

    private Map<String, Object> result(String no, String status) {
        Map<String, Object> out = new HashMap<>();
        out.put("编号", no);
        out.put("单据状态", status);
        return out;
    }

    private String currentUserName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}
