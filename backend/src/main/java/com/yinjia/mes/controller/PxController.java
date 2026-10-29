package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.panel.PanelRuntimeService;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.DevTaskService;
import com.yinjia.mes.service.PanelConfigService;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.ReportColumnSettingsService;
import com.yinjia.mes.service.UsageLogService;
import com.yinjia.mes.service.VoucherFlowService;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.LinkedHashMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.Map;

/** 通用面板接口(对齐 light-mes:仅依赖 PanelRuntimeService 契约) */
@RestController
@RequestMapping("/api/px")
public class PxController {

    private final PanelRuntimeService service;
    private final PanelConfigService configService;
    private final ReportColumnSettingsService reportColumnSettingsService;
    private final VoucherFlowService voucherFlowService;
    private final PanelRegistry registry;
    private final UsageLogService usageLog;
    private final DevTaskService devTaskService;
    private final ButtonService buttons;
    /** 产品开发概览(项目进度 ↔ 产品信息表 关联视图,2026-10-16) */
    private final com.yinjia.mes.service.RdDevProductService rdDevProducts;
    private final PanelPermissionService perm;
    private final com.yinjia.mes.panel.PushGenerateHandler pushGenerateHandler;
    private final com.yinjia.mes.service.BatchService batchService;
    private final com.yinjia.mes.service.PuLabelService puLabel;
    /** 条码标签打印留痕(材料/半成品/成品条码面板,2026-10-18) */
    private final com.yinjia.mes.service.BarcodeLabelService barcodeLabel;
    /**
     * 查询服务(2026-10-25):只为「供应商会话逐单归属核对」而注入 ——
     * 单张单据详情接口(getFormDescriptor)不走列表过滤,必须调用
     * {@link com.yinjia.mes.service.QueryService#supplierMayReadDoc} 核对这张单是不是当前供应商的。
     */
    private final com.yinjia.mes.service.QueryService queryService;
    /** 研发「项目流程管控」只读取数(2026-10-20) */
    private final com.yinjia.mes.service.RdProjectFlowService rdFlow;
    /** 工单扫码领料取数(2026-10-21):工单行 plang + BOM mate,两张表都不是注册面板 */
    private final com.yinjia.mes.service.WorkOrderPickService woPick;
    /** 工单扫码领料的逐笔留痕(2026-10-21):扫了哪些料/各多少/什么时候 */
    private final com.yinjia.mes.service.WoPickScanLogService woPickLog;

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PxController.class);

    public PxController(PanelRuntimeService service, PanelConfigService configService,
                        ReportColumnSettingsService reportColumnSettingsService,
                        VoucherFlowService voucherFlowService,
                        PanelRegistry registry, UsageLogService usageLog,
                        DevTaskService devTaskService, ButtonService buttons,
                        com.yinjia.mes.service.RdDevProductService rdDevProducts,
                        PanelPermissionService perm,
                        com.yinjia.mes.panel.PushGenerateHandler pushGenerateHandler,
                        com.yinjia.mes.service.BatchService batchService,
                        com.yinjia.mes.service.PuLabelService puLabel,
                        com.yinjia.mes.service.BarcodeLabelService barcodeLabel,
                        com.yinjia.mes.service.QueryService queryService,
                        com.yinjia.mes.service.RdProjectFlowService rdFlow,
                        com.yinjia.mes.service.WorkOrderPickService woPick,
                        com.yinjia.mes.service.WoPickScanLogService woPickLog) {
        this.service = service;
        this.configService = configService;
        this.reportColumnSettingsService = reportColumnSettingsService;
        this.voucherFlowService = voucherFlowService;
        this.registry = registry;
        this.usageLog = usageLog;
        this.devTaskService = devTaskService;
        this.buttons = buttons;
        this.rdDevProducts = rdDevProducts;
        this.perm = perm;
        this.pushGenerateHandler = pushGenerateHandler;
        this.batchService = batchService;
        this.puLabel = puLabel;
        this.barcodeLabel = barcodeLabel;
        this.queryService = queryService;
        this.rdFlow = rdFlow;
        this.woPick = woPick;
        this.woPickLog = woPickLog;
    }

    // ============ 工单扫码领料取数(2026-10-21,手机端) ============
    /**
     * 按工单码取工单行。
     *
     * <p>前端扫工单二维码(格式 {@code 公司代码@工单号@(1000+行号)},见 print-formats.woQrText)
     * 后调本端点拿工单内容(产品/产线/排产数量)。工单落在 {@code plang},它不是注册面板,
     * 走不了 {@code queryFormDataList},故单列一个只读端点。
     *
     * @param orderNo 工单号(必填)
     * @param lineNo  工单行号;不传或 &lt;=0 表示整单全部行
     */
    @GetMapping("/woPick/lines")
    public Map<String, Object> woPickLines(@RequestParam String orderNo,
                                           @RequestParam(required = false) Integer lineNo) {
        perm.requirePanelView(com.yinjia.mes.service.PagePanelRegistry.WORK_ORDER_PICK);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", woPick.workOrderLines(orderNo, lineNo == null ? 0 : lineNo));
        return out;
    }

    /**
     * 按产品编码取 BOM 明细(该工单要领哪些料)。
     *
     * <p>数据源 = {@code mate}(WLBOM 物料清单面板的底层表)。
     * 返回空列表表示该产品还没录 BOM —— 前端提示去「物料清单」面板录入,
     * 而不是静默显示空清单(2026-10-21 实测:金蝶侧 BOM 接口 count=0,
     * MES 自建 bs_bom 已下架,mate 只剩 T382 一个产品 ⇒ 必须先补数据)。
     *
     * @param productCode 产品编码
     */
    @GetMapping("/woPick/bom")
    public Map<String, Object> woPickBom(@RequestParam String productCode) {
        perm.requirePanelView(com.yinjia.mes.service.PagePanelRegistry.WORK_ORDER_PICK);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", woPick.bomOf(productCode));
        return out;
    }

    /**
     * 扫码留痕:记一笔「谁、何时、哪张工单哪一行、扫了哪个物料、多少数量、秤读数」。
     *
     * <p>用户口径(2026-10-21):「要监控 App 使用情况,因为这个取数上报的要能看到他们的操作情况」
     * + 「还要记『扫了哪些料、各多少、什么时候』」。
     *
     * <p>前端每完成一次扫码(含「取秤」按行记量)调一次;提交时再调 {@code /woPick/attachDoc}
     * 把领料单号补上。写入失败不影响作业(服务内部吞异常只打日志)。
     *
     * <p>请求体字段:woNo / woLine / productCode / materialCode / materialName / qty / unit /
     * scaleValue / scaleDevice / scaleAt / scanType / scanSource / clientType / clientInfo / remark
     */
    @PostMapping("/woPick/scanLog")
    public ApiResult<Void> woPickScanLog(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        perm.requirePanelView(com.yinjia.mes.service.PagePanelRegistry.WORK_ORDER_PICK);
        String user = currentUser();
        woPickLog.record(body, user, clientIp(request));
        return ApiResult.ok(null);
    }

    /**
     * 整单提交后,把本次作业扫过的行补上领料单号(按单据回查)。
     *
     * @param body docNo / woNo / woLine
     */
    @PostMapping("/woPick/attachDoc")
    public Map<String, Object> woPickAttachDoc(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(com.yinjia.mes.service.PagePanelRegistry.WORK_ORDER_PICK);
        String docNo = String.valueOf(body.getOrDefault("docNo", ""));
        String woNo = String.valueOf(body.getOrDefault("woNo", ""));
        int woLine = body.get("woLine") instanceof Number n ? n.intValue() : 0;
        int n = woPickLog.attachDocNo(docNo, woNo, woLine, currentUser());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("updated", n);
        return out;
    }

    /**
     * 扫码流水查询(「扫码领料记录」面板数据源)。
     *
     * @param woNo 工单号(模糊)
     * @param user 操作人(模糊)
     * @param materialCode 物料编码/名称(模糊)
     * @param start 起始日期 yyyy-MM-dd
     * @param end 结束日期 yyyy-MM-dd
     */
    @GetMapping("/woPick/scanLogs")
    public Map<String, Object> woPickScanLogs(@RequestParam(required = false) String woNo,
                                              @RequestParam(required = false) String user,
                                              @RequestParam(required = false) String materialCode,
                                              @RequestParam(required = false) String start,
                                              @RequestParam(required = false) String end,
                                              @RequestParam(defaultValue = "1") int page,
                                              @RequestParam(defaultValue = "50") int size) {
        perm.requirePanelView(com.yinjia.mes.service.PagePanelRegistry.WORK_ORDER_PICK);
        return woPickLog.query(woNo, user, materialCode, start, end, page, size);
    }

    // ============ 条码标签打印留痕(材料 / 半成品 / 成品条码面板,2026-10-18) ============
    /**
     * 打印标签:前端本地出纸(二维码 + 卡面,内容全在列表行里),本端点只落**留痕**
     * —— 谁、什么时候、打了哪个码、哪张单据。重打会再记一行(只增不改,便于对账)。
     *
     * <p>权限:按目标面板的「打印」词(三个条码面板的权限行照库存台账复制,含 print)。
     * <p>面板白名单在 {@link com.yinjia.mes.service.BarcodeLabelService#PANELS},与迁移脚本的 yj_panel 一致。
     */
    @PostMapping("/barcode/print")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> barcodePrint(@RequestBody Map<String, Object> body) {
        String panel = body.get("panelCode") == null ? "" : String.valueOf(body.get("panelCode")).trim();
        if (!com.yinjia.mes.service.BarcodeLabelService.PANELS.contains(panel)) {
            return ApiResult.fail(400, "该面板不支持打印标签: " + panel);
        }
        perm.requireButton(panel, "打印");
        Object raw = body.getOrDefault("items", List.of());
        List<Map<String, Object>> items = raw instanceof List ? (List<Map<String, Object>>) raw : List.of();
        String user = SecurityContextHolder.getContext().getAuthentication() == null ? null
                : SecurityContextHolder.getContext().getAuthentication().getName();
        try {
            return ApiResult.ok(barcodeLabel.log(panel, items, user));
        } catch (IllegalArgumentException e) {
            return ApiResult.fail(400, e.getMessage());
        }
    }

    // ============ 采购订单材料码打印(供应商自行打码,2026-10-04) ============
    // 口径:批次号在**打印时**登记并预约该行数量;生单只消费预约,不再按公式重算。
    // 方案:docs/plans/2026-10-04-采购订单材料码批次号方案.md。**不建面板**(用户明确不要),
    // 故三个端点直接挂既有 /px 运行时,权限按「采购订单」面板的查看/修改权把关。

    /**
     * 打印弹窗取数:订单行(含可打印量)+ 预填批次号 + 本订单已有打印记录。
     *
     * <p>2026-10-29:供应商会话也要能用(用户报障「供应商登录打印材料码时,直接就显示打印成功了,
     * 没有和采购订单一样有弹窗」)。供应商没有 PU_ORDER 的面板权(它只有 SUPPLIER_PU_ORDER 的只读权),
     * 故:内部账号照旧按 PU_ORDER 的面板权把关;供应商会话改按**逐单归属**把关
     * ({@link com.yinjia.mes.service.QueryService#supplierMayReadDoc} —— 只能操作自己供应商的订单)。
     */
    @GetMapping("/puLabel/dialog")
    public ApiResult<Map<String, Object>> puLabelDialog(@RequestParam String orderNo) {
        requireMaterialLabelAccess(orderNo);
        return ApiResult.ok(puLabel.dialog(orderNo));
    }

    /**
     * 材料码打印的权限闸门(2026-10-29 抽出)。
     *
     * <p>内部账号:仍按「采购订单」面板的查看权(取数)/修改权(登记)。
     * <p>供应商账号:它只有 `SUPPLIER_PU_ORDER` 的 view/query/print,没有 PU_ORDER 的修改权,
     * 而这套「打自己的材料码」正是供应商门户的唯一作业(用户 2026-10-04 口径「供应商自己打码」),
     * 故改为**逐单核对归属**:单据必须属于登录态供应商,别人的单一律 403。
     * 写库范围由 {@code PuLabelService} 自己限定在那一张单,不会越界。
     */
    private void requireMaterialLabelAccess(String orderNo) {
        String supplierCode = queryService.sessionSupplierCode();
        if (supplierCode == null) {
            // 内部账号:保持原口径(查看 + 修改,与 saveButton 一致)
            perm.requirePanelView("PU_ORDER");
            return;
        }
        // 供应商账号:只认自己的单(停用账号 supplierCode 为 "" ⇒ 直接拒)
        if (supplierCode.isEmpty()
                || !queryService.supplierMayReadDoc(com.yinjia.mes.service.QueryService.SUPPLIER_PANEL_CODE, orderNo)) {
            throw new org.springframework.security.access.AccessDeniedException("该采购订单不属于当前供应商:" + orderNo);
        }
    }

    /**
     * 登记打印(2026-10-04 口径:**一次可勾多行,但每行各出一张打印单**;服务端按行取号建头)。
     * 2026-10-23 增 prodDate(生产日期,可空):批次号旁边填,登记在单头、印到材料码卡面。
     */
    @PostMapping("/puLabel/print")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> puLabelPrint(@RequestBody Map<String, Object> body) {
        String orderNo = String.valueOf(body.getOrDefault("orderNo", ""));
        // 供应商会话走逐单归属核对(它没有 PU_ORDER 的修改权,见 requireMaterialLabelAccess)
        requireMaterialLabelAccess(orderNo);
        String batchNo = body.get("batchNo") == null ? "" : String.valueOf(body.get("batchNo"));
        String prodDate = body.get("prodDate") == null ? "" : String.valueOf(body.get("prodDate"));
        List<Map<String, Object>> lines = new java.util.ArrayList<>();
        if (body.get("lines") instanceof List<?> l) {
            for (Object o : l) if (o instanceof Map<?, ?> m) lines.add(new LinkedHashMap<>((Map<String, Object>) m));
        }
        return ApiResult.ok(puLabel.print(orderNo, batchNo, prodDate, lines, currentUser()));
    }

    /** 重打:同一张打印单原样再打一遍(只累加打印次数,不新增预约) */
    @PostMapping("/puLabel/reprint")
    public ApiResult<Map<String, Object>> puLabelReprint(@RequestBody Map<String, Object> body) {
        perm.requireButton("PU_ORDER", "修改");
        return ApiResult.ok(puLabel.reprint(String.valueOf(body.getOrDefault("docNo", "")), currentUser()));
    }

    /**
     * 该单据的批次号是否因"来自材料码打印明细"而**不可修改**(用户口径:凡有关打印明细生成的单据
     * 都不可以改批次号)—— 前端打开单据时问一次,是则把单头「批次号」当只读渲染(草稿态也不给改)。
     */
    @GetMapping("/puLabel/batchLock")
    public ApiResult<Map<String, Object>> puLabelBatchLock(@RequestParam String panelCode, @RequestParam String docNo) {
        return ApiResult.ok(puLabel.batchLock(panelCode, docNo));
    }

    /** 作废打印记录(软删,预约量立即释放回余量) */
    @PostMapping("/puLabel/void")
    public ApiResult<Map<String, Object>> puLabelVoid(@RequestBody Map<String, Object> body) {
        perm.requireButton("PU_ORDER", "修改");
        return ApiResult.ok(puLabel.voidDoc(String.valueOf(body.getOrDefault("docNo", "")), currentUser()));
    }

    /** 当前操作人(与 batchFlow 各端点同口径:无认证上下文时记 system) */
    private static String currentUser() {
        return SecurityContextHolder.getContext().getAuthentication() == null ? "system"
                : SecurityContextHolder.getContext().getAuthentication().getName();
    }

    /** 产品开发:下游面板元数据(矩阵列头) */
    @GetMapping("/rdDev/meta")
    public ApiResult<List<Map<String, String>>> rdDevMeta() {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(DevTaskService.devPanelMeta());
    }

    /** 产品开发:产品信息表侧边栏按钮状态(是否已下发 / 能否分发责任人 / 二级审核人) */
    @GetMapping("/rdDev/buttonState")
    public ApiResult<Map<String, Object>> rdDevButtonState(@RequestParam String docNo) {
        perm.requirePanelView("RD_PROD_INFO");
        String productCode = productCodeOf(docNo);
        Map<String, Object> out = new LinkedHashMap<>(devTaskService.buttonState(productCode));
        // 2026-09-20 两级审批:分发责任人是**二级审核人的动作**,前端据此置灰/显示
        out.put("canAssign", buttons.canAssignDev(docNo));
        out.put("l2Approver", buttons.l2ApproverName(docNo));
        out.put("isL2Approver", buttons.isL2Approver(docNo));
        out.put("assigns", devTaskService.assignsOf(productCode));
        return ApiResult.ok(out);
    }

    /** 产品开发:四文件分工状态(分发责任人弹窗回显) */
    @GetMapping("/rdDev/assignState")
    public ApiResult<Map<String, Object>> rdDevAssignState(@RequestParam String docNo) {
        perm.requirePanelView("RD_PROD_INFO");
        Map<String, Object> out = new LinkedHashMap<>(devTaskService.assignState(productCodeOf(docNo)));
        out.put("docNo", docNo);
        out.put("canAssign", buttons.canAssignDev(docNo));
        out.put("l2Approver", buttons.l2ApproverName(docNo));
        return ApiResult.ok(out);
    }

    /** 产品开发:启用账号清单(一级通过选二级审核人 / 分发责任人选人;非管理员也可读 ⇒ 不能复用管理端接口) */
    @GetMapping("/rdDev/users")
    public ApiResult<List<Map<String, Object>>> rdDevUsers() {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(devTaskService.enabledUsers());
    }

    /**
     * 立项申请:流程状态(2026-10-08 研发流程图③④)——前端侧栏「分发对接人 / 确认责任人」两按钮
     * 的显隐与置灰**唯一真源**(口径在 ButtonService.rdApprovalFlowState,与按钮的服务端门禁逐条对齐)。
     */
    @GetMapping("/rdFlow/state")
    public ApiResult<Map<String, Object>> rdFlowState(@RequestParam String docNo) {
        perm.requirePanelView("RD_APPROVAL");
        return ApiResult.ok(buttons.rdApprovalFlowState(docNo));
    }

    /**
     * 立项申请:启用账号清单(分发对接人 / 确认责任人两个弹窗的选人下拉)。
     * ⚠ **不复用 `/rdDev/users`** —— 那个端点挂 `requirePanelView("RD_PROD_INFO")`,
     *   立项线的销售/对接人没有产品信息表的查看权,会被 403 挡掉(与 DevTaskService 注释同款理由)。
     */
    @GetMapping("/rdFlow/users")
    public ApiResult<List<Map<String, Object>>> rdFlowUsers() {
        perm.requirePanelView("RD_APPROVAL");
        return ApiResult.ok(devTaskService.enabledUsers());
    }

    /**
     * 四个受控文件「我能不能编这张单」(2026-09-21):前端据此把非责任人的纸张置灰 + 提示责任人是谁。
     * 口径与保存门禁**同一真源**(ButtonService.devFileEditState → devFileEditVerdict),
     * 免得再出现"界面让改、保存被拒"。
     */
    @GetMapping("/rdDev/fileEdit")
    public ApiResult<Map<String, Object>> rdDevFileEdit(@RequestParam String panelCode, @RequestParam String docNo) {
        perm.requirePanelView(panelCode);
        return ApiResult.ok(buttons.devFileEditState(panelCode, docNo));
    }

    /**
     * 引用单据上的「本单引用的规格书变了」提示(2026-10-16 用户口径)。
     *
     * <p>用户原话:「有一些单据是引用的规格书的数据,要是规格书申请修改数据了,但是其他的引用数据的
     * 单据是归档状态……应该有一个提示,提示说单据对应的规格书申请修改了数据,请及时核对,这些单据
     * 也可以对应的反审核然后重新引用数据」。只对引用方(成型工艺清单/组装工艺清单/出货检验计划表)适用;
     * 判定与取数全在 {@link com.yinjia.mes.service.ButtonService#specDriftState}(纯只读,无写副作用)。
     */
    @GetMapping("/rdDev/specDrift")
    public ApiResult<Map<String, Object>> rdDevSpecDrift(@RequestParam String panelCode, @RequestParam String docNo) {
        perm.requirePanelView(panelCode);
        return ApiResult.ok(buttons.specDriftState(panelCode, docNo));
    }

    /** 单据编号 → 产品编号(产品信息表侧边栏用;查不到返回空串) —— 数据在 DevTaskService */
    private String productCodeOf(String docNo) {
        return devTaskService.productCodeOfDocNo(docNo);
    }

    /**
     * 引用单据上的「本单引用的产品信息表变了」提示(2026-10-16 用户口径)。
     *
     * <p>用户原话:「产品信息表要是申请修改怎么办,那些引用产品信息表的怎么办?应该也做一个提示通知」。
     * 只对四个引用方(规格书/成型工艺清单/组装工艺清单/出货检验计划表)适用,按 [产品编号] 关联;
     * 判定与取数全在 {@link com.yinjia.mes.service.ButtonService#prodInfoDriftState}(纯只读,无写副作用)。
     */
    @GetMapping("/rdDev/prodInfoDrift")
    public ApiResult<Map<String, Object>> rdDevProdInfoDrift(@RequestParam String panelCode, @RequestParam String docNo) {
        perm.requirePanelView(panelCode);
        return ApiResult.ok(buttons.prodInfoDriftState(panelCode, docNo));
    }

    /** 产品开发:已下发产品的开发矩阵 */
    @GetMapping("/rdDev/board")
    public ApiResult<List<Map<String, Object>>> rdDevBoard() {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(devTaskService.board());
    }

    /**
     * 某人在某文件面板下的「待开发单据」清单(2026-10-13 用户需求)。
     *
     * <p>用户要的交互:4 类下游面板(规格书 / 成型工艺清单 / 组装工艺清单 / 出货检验计划表)
     * 的侧边有一个「待开发单据」入口 —— **只有被分发给该文件的人**看得到;点开弹出对应的
     * 产品信息表编号,逐条标 未开发 / 已开发;按钮右上角红点数字 = 未开发张数(0 则不显示)。
     *
     * <p>判定口径由用户拍板:**审批通过(已审核/已归档)才算「已开发」**。
     * 取数与判定全在 {@link com.yinjia.mes.service.DevTaskService#pendingDocsFor};本端点只
     * 收参 → 校验面板可见 → 组响应(分层规矩:Controller 不直写 jdbc)。
     */
    @GetMapping("/rdDev/pendingDocs")
    public ApiResult<Map<String, Object>> rdDevPendingDocs(@RequestParam String panelCode) {
        perm.requirePanelView(panelCode);
        List<Map<String, Object>> rows = devTaskService.pendingDocsFor(panelCode, currentUser());
        long pending = rows.stream().filter((r) -> "未开发".equals(String.valueOf(r.get("状态")))).count();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("panelCode", panelCode);
        out.put("pendingCount", pending);
        out.put("rows", rows);
        return ApiResult.ok(out);
    }

    /**
     * 产品文件列表(RD_PROD_DOCLIST)—— 设计《产品开发系统需求汇总》sheet「文件汇总表」那张表。
     *
     * 【不新建业务逻辑】列头与状态推导**直接复用** DevTaskService:
     *   · 4 个文件列 = DEV_PANELS 的 4 个下游面板(成型工艺清单/组装工艺清单/规格书/出货检验计划表)
     *   · 每格状态 = statusOf(产品编号, 面板) ⇒ 未开发/开发中/开发审核中/开发完毕
     * 本端点只做**只读拼装**:为每行补上「是否受控 / 受控日期」
     *   —— 设计流程图 5.1/5.2/5.3/5.4 尾部都是「保存/提交 → 提交后审批 → **审批后自动受控**」,
     *      故受控是**派生值**:该产品的 4 张文件**全部已归档**即为受控,受控日期取最后一份的归档时点。
     *
     * 状态存储查询:4 个面板的产品键字段不同(规格书是「编号」,其余是「产品编号」),
     * 用 DevTaskService.productKeyOf(panel) 取,避免写死。
     */
    @GetMapping("/prodDocList")
    public ApiResult<Map<String, Object>> prodDocList() {
        perm.requirePanelView("RD_PROD_DOCLIST");

        // 列头(顺序即矩阵列顺序):面板编码 + 显示名
        List<Map<String, String>> columns = DevTaskService.devPanelMeta();

        List<Map<String, Object>> rows = devTaskService.board();

        // 线上的受控推导(含 2026-09-30 口径与缺失降级)已随 SQL 一起下沉到 DevTaskService.controlledAt()
        Map<String, Map<String, String>> controlledAt = devTaskService.controlledAt();

        for (Map<String, Object> row : rows) {
            String productCode = String.valueOf(row.get("产品编号"));
            @SuppressWarnings("unchecked")
            Map<String, String> cells = (Map<String, String>) row.get("cells");
            // 四个文件**各自**受控(见上面口径);整产品"是否受控"仍按"四份都开发完毕"判定,
            // 受控日期取四者中最后一个受控时点 —— 列表只有一组受控列,逐文件的受控值在各文件面板自身。
            boolean allDone = cells != null && !cells.isEmpty()
                    && cells.values().stream().allMatch(DevTaskService.STATUS_DONE::equals);
            String lastAt = "";
            for (String panel : DevTaskService.devPanelCodes()) {
                String at = controlledAt.getOrDefault(panel, Map.of()).get(productCode);
                if (at != null && at.compareTo(lastAt) > 0) lastAt = at;
            }
            row.put("是否受控", allDone ? "是" : "否");
            row.put("受控日期", allDone ? lastAt : "");
            row.put("产品负责人", row.get("产品负责人") == null ? "" : row.get("产品负责人"));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("columns", columns);
        out.put("rows", rows);
        return ApiResult.ok(out);
    }

    /** 产品开发:参照标注(某面板下,这批产品是 未开发 / 已开发) */
    @PostMapping("/rdDev/annotate")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, String>> rdDevAnnotate(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("RD_PROD_INFO");
        String panelCode = body.get("panelCode") == null ? "" : String.valueOf(body.get("panelCode"));
        Object codes = body.get("productCodes");
        List<String> list = codes instanceof List<?> l
                ? l.stream().map(v -> v == null ? "" : String.valueOf(v)).toList()
                : List.of();
        return ApiResult.ok(devTaskService.annotateBatch(panelCode, list));
    }

    /** 规格书两级分发:某产品的分配总览(总负责人弹窗用;docs=可分配候选单,2026-09-12 改为绑定已有单据) */
    @GetMapping("/specAssign")
    public ApiResult<Map<String, Object>> specAssignState(@RequestParam String code) {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(devTaskService.specAssignState(code));
    }

    /** 规格书两级分发:单张规格书单的分配(编辑闸门/侧栏展示用;hasAssign=false 不受封锁约束) */
    @GetMapping("/specAssign/doc")
    public ApiResult<Map<String, Object>> specAssignDoc(@RequestParam String no) {
        perm.requirePanelView("RD_SPEC_DOC");
        return ApiResult.ok(devTaskService.specAssignOfDoc(no));
    }

    /**
     * 「自动填充规格书」数据源:按产品编号取对应规格书的表头 + 检验要求明细行。
     *
     * <p>【为什么要专门开一个端点】规格书的产品键在通用查询链路里**看不见**——
     * QueryService.loadDocs 对每个 doc 面板都会执行 doc.put("编号", 单据编号)。该字段原先就叫
     * 「编号」,于是真值被覆盖成单据号(2026-09-30 用户报障「封面右上角显示的不是产品编号」);
     * 现在字段已改名「产品编号」(migrate-rd-specdoc-prodno-2026-09-30.sql),与单据标识键分家,
     * 但通用链路是**按面板动态出列**的、且列里没有「产品编号」的兜底,故本端点仍直接读 head 表。
     *
     * <p>【产品编号 → 规格书单 的解析顺序】
     * <ol>
     *   <li>rd_spec_assign(产品编号=?)—— 分发写下的正式映射,带 责任人/负责人,是权威源;</li>
     *   <li>rd_spec_doc_head.产品编号 = ? —— 分发时盖在产品键列上的章(ButtonService 分发路径写)。</li>
     * </ol>
     * 两条都按 id 倒序取最新。同一产品可能分发了多张规格书(不同规格书种类),
     * 故用 matched 回报命中数,前端提示「按哪一张填的」,不让用户猜。
     *
     * 取数整体在 DevTaskService.specByProduct(code)(含 ProductCode→单号解析与审批门禁),
     * 这里只保留端点契约:校验 RD_INSP_PLAN 查看权 + 原样返回。
     *
     * <p>{@code sheetArea} 是**可选**的新参数(2026-10-13):不传 = 出货检验计划表原口径
     * (规格书「检验要求」表区),传了才换表区。本端点的权限、返回结构、缺省取数均不变。
     */
    @GetMapping("/specByProduct")
    public ApiResult<Map<String, Object>> specByProduct(@RequestParam String code,
                                                       @RequestParam(required = false) String sheetArea) {
        perm.requirePanelView("RD_INSP_PLAN");
        return ApiResult.ok(devTaskService.specByProduct(code, sheetArea));
    }

    /**
     * 「自动填充规格书」数据源 · 组装工艺清单版:按产品编号取规格书「1.关键物料列表」的物料行。
     *
     * <p>【为什么另开一个端点而不是复用上面那个】取数逻辑**完全共用**(同一个
     * DevTaskService.specByProduct(code, sheetArea)),差别只在**权限**:这张表长在组装工艺清单
     * (RD_ASM_PROC)的「组装BOM表」页上,能看这张表的人未必有出货检验计划表(RD_INSP_PLAN)的查看权;
     * 复用就得以别人的面板权限放行,反之也会把 RD_ASM_PROC 的查看者挡在门外。
     * 审批门禁在服务层(未审批 ⇒ reason=not_approved,一个格都不带回)。
     *
     * <p>{@code sheetArea} 缺省 = '物料清单'(本端点的语义就是取关键物料列表);
     * 显式传别的表区也允许,便于以后再加别的落点。
     */
    @GetMapping("/specByProductForAsm")
    public ApiResult<Map<String, Object>> specByProductForAsm(@RequestParam String code,
                                                             @RequestParam(required = false) String sheetArea) {
        perm.requirePanelView("RD_ASM_PROC");
        String area = sheetArea == null || sheetArea.isBlank()
                ? DevTaskService.SPEC_SHEET_AREA_MATERIAL : sheetArea;
        return ApiResult.ok(devTaskService.specByProduct(code, area));
    }

    /**
     * 「自动填充规格书」数据源 · 成型工艺清单版:按产品编号取规格书「检验要求」明细行
     * (表头那几格:跌落要求/强度要求kgf/压降标准kpa + 尺寸四格)。
     *
     * <p>【为什么要这个端点】与上面那个同款理由:权限按**承载面板**校验 —— 这张表长在成型工艺
     * 清单(RD_MOLD_PROC)的「检验要求」区上,复用 RD_INSP_PLAN / RD_ASM_PROC 的端点会以别人的
     * 面板权限放行,反之也会把本面板的查看者挡在 403 外。
     *
     * <p>【2026-10-15 口径变更,端点瘦身】原服务方法 {@code DevTaskService.specByProductForMold}
     * 是"一个端点回两个表区":检验要求 + 物料清单(页 2 配方表 ← 规格书物料行,后端按 bs_inv
     * 补派生列 所属类别)。用户改口:「这个需要改一下成型工艺清单的配方表的数据是在配方计算器里面
     * 填写数据然后填入单据的,**而不是带入的规格书的**」⇒ 配方表那条链连同该服务方法与派生列一并
     * **撤掉**,本端点只按本面板权限取「检验要求」表区(取数与门禁仍走同一套
     * {@link DevTaskService#specByProduct(String, String)},未审批 ⇒ reason=not_approved)。
     */
    @GetMapping("/specByProductForMold")
    public ApiResult<Map<String, Object>> specByProductForMold(@RequestParam String code) {
        perm.requirePanelView("RD_MOLD_PROC");
        return ApiResult.ok(devTaskService.specByProduct(code, DevTaskService.SPEC_SHEET_AREA_INSPECT));
    }

    /** 选单来源查询(已审核 + 占用过滤,对齐 T+ SelectVoucher)。
     *  权限按目标面板校验(选单是为了在目标面板生单,来源数据是选单必需的参照)。 */
    @PostMapping("/voucherFlow/sources")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> voucherFlowSources(@RequestBody Map<String, Object> body) {
        String sourcePanel = String.valueOf(body.getOrDefault("sourcePanel", ""));
        String targetPanel = String.valueOf(body.getOrDefault("targetPanel", ""));
        if (!targetPanel.isBlank()) perm.requirePanelView(targetPanel);
        Map<String, Object> condition = (Map<String, Object>) body.getOrDefault("condition", Map.of());
        int pageNo = body.get("pageNo") == null ? 1 : Integer.parseInt(String.valueOf(body.get("pageNo")));
        int pageSize = body.get("pageSize") == null ? 20 : Integer.parseInt(String.valueOf(body.get("pageSize")));
        return ApiResult.ok(voucherFlowService.sources(sourcePanel, targetPanel, condition, pageNo, pageSize));
    }

    /** 选单生单后写占用(来源行不再出现在选单列表;删除下游草稿自动释放) */
    @PostMapping("/voucherFlow/link")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> voucherFlowLink(@RequestBody Map<String, Object> body) {
        String targetPanel = String.valueOf(body.getOrDefault("targetPanel", ""));
        if (!targetPanel.isBlank()) perm.requireButton(targetPanel, "保存");
        voucherFlowService.link(
                String.valueOf(body.getOrDefault("sourcePanel", "")),
                String.valueOf(body.getOrDefault("sourceNo", "")),
                String.valueOf(body.getOrDefault("sourceKey", "items")),
                String.valueOf(body.getOrDefault("targetPanel", "")),
                String.valueOf(body.getOrDefault("targetNo", "")),
                String.valueOf(body.getOrDefault("targetKey", "items")),
                body.get("targetOffset") == null ? 0 : Integer.parseInt(String.valueOf(body.get("targetOffset"))),
                String.valueOf(body.getOrDefault("businessType", "")));
        return ApiResult.ok(null);
    }

    /** 分批送料:行状态(订单量/已送/已退回/剩余/可送上限)+ 下一批次号 + 已有批次清单(采购订单→送料暂收单) */
    @PostMapping("/batchFlow/lines")
    public ApiResult<Map<String, Object>> batchFlowLines(@RequestBody Map<String, Object> body) {
        String sourcePanel = String.valueOf(body.getOrDefault("sourcePanel", ""));
        String targetPanel = String.valueOf(body.getOrDefault("targetPanel", ""));
        String sourceNo = String.valueOf(body.getOrDefault("sourceNo", ""));
        perm.requirePanelView(sourcePanel);
        return ApiResult.ok(pushGenerateHandler.batchLines(sourcePanel, targetPanel, sourceNo));
    }

    /**
     * 保存「收料超送比例」(生单对话框里改动即自动保存,用户 2026-10-04 口径)。
     *
     * 存的是**系统参数** `yj_app_setting.receive_over_ratio`(与批量校验、材料码打印上限同一个参数),
     * 所以改一次之后:下次打开生单对话框按新比例预填、后端校验与打印上限也按新比例算。
     * body.overRatio 传 **0~1 的小数**(前端把输入框的百分数 ÷100);超 50% 服务端夹到 0.5。
     */
    @PostMapping("/batchFlow/overRatio")
    public ApiResult<Map<String, Object>> batchFlowSaveOverRatio(@RequestBody Map<String, Object> body) {
        perm.requireButton("PU_ORDER", "修改");
        double v = body.get("overRatio") instanceof Number n ? n.doubleValue() : 0d;
        double saved = batchService.saveOverRatio(v, currentUser());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("overRatio", saved);
        out.put("超送比例", Math.round(saved * 100));
        return ApiResult.ok(out);
    }

    /**
     * 分批送料:按行「本次送料数量」生成一张下游草稿(生单即取批次号 + 按量占用 + 写批次台账)。
     * body.batchNo = **生单对话框里人工填/改的批次号**(可选;2026-10-04 用户口径「在生单时批次号就可以修改」)
     * —— 只在链路头一跳(采购订单→送料暂收单,此时来源单还没有号)生效,留空则按
     * 「**当天 yyyyMMdd**」自动取号(2026-10-19 用户口径:批次号改回纯日期,不再拼供应商编码);
     * 下游各跳一律继承上游的号,忽略该值。
     */
    @PostMapping("/batchFlow/generate")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> batchFlowGenerate(@RequestBody Map<String, Object> body) {
        String sourcePanel = String.valueOf(body.getOrDefault("sourcePanel", ""));
        String targetPanel = String.valueOf(body.getOrDefault("targetPanel", ""));
        String sourceNo = String.valueOf(body.getOrDefault("sourceNo", ""));
        if (!targetPanel.isBlank()) perm.requireButton(targetPanel, "保存");
        Map<String, Double> qtyByLine = null;
        Object raw = body.get("lines");
        if (raw instanceof List<?> list && !list.isEmpty()) {
            qtyByLine = new java.util.LinkedHashMap<>();
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;
                Object key = m.get("lineKey");
                Object qty = m.get("qty");
                if (key == null) continue;
                qtyByLine.put(String.valueOf(key), qty == null ? 0d : Double.parseDouble(String.valueOf(qty)));
            }
        }
        // 材料码隔离行(行键 `...#行id@打印行id`)的批次号由后端按行自取,前端不需要另传
        Map<String, Object> res = pushGenerateHandler.generateBatch(sourcePanel, targetPanel, sourceNo,
                currentUser(),
                qtyByLine,
                body.get("overRatio") == null || String.valueOf(body.get("overRatio")).isBlank() ? null
                        : Double.parseDouble(String.valueOf(body.get("overRatio"))),
                body.get("batchNo") == null ? null : String.valueOf(body.get("batchNo")));
        return ApiResult.ok(res);
    }

    /** 某批次号的台账与下游单据(按批次反查:暂收/检验/入库/退回) */
    @GetMapping("/batchFlow/batch")
    public ApiResult<Map<String, Object>> batchFlowBatch(@RequestParam String batchNo) {
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("batch", batchService.batchOf(batchNo));
        out.put("links", batchService.linksOfBatch(batchNo));
        return ApiResult.ok(out);
    }

    /** 报表栏目设置读取(报表表头筛选与排序补丁) */    @GetMapping("/reportColumnSettings")
    public ApiResult<Map<String, Object>> getReportColumnSettings(@RequestParam String panelCode) {
        perm.requirePanelView(panelCode);
        return ApiResult.ok(reportColumnSettingsService.load(panelCode));
    }

    /** 报表栏目设置保存(报表表头筛选与排序补丁) */
    @PostMapping("/reportColumnSettings")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveReportColumnSettings(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requirePanelView(panelCode);
        Map<String, Object> settings = (Map<String, Object>) body.getOrDefault("settings", Map.of());
        reportColumnSettingsService.save(panelCode, settings);
        return ApiResult.ok(null);
    }

    @GetMapping("/getPanelConfig")
    public ApiResult<Map<String, Object>> getPanelConfig(@RequestParam String panelCode) {
        // 面板元数据(字段/参照绑定)不是人人可取:按读放行集合(可见 ∪ 参照目标 ∪ 同模块)校验,2026-09-22 补
        perm.requirePanelRead(panelCode);
        return ApiResult.ok(service.getPanelConfig(panelCode));
    }

    @GetMapping("/getPermMatrix")
    public ApiResult<Map<String, Object>> getPermMatrix(@RequestParam String panelCode) {
        perm.requirePanelRead(panelCode);
        return ApiResult.ok(service.getPermMatrix(panelCode));
    }

    @GetMapping("/getNewFormPermMatrix")
    public ApiResult<Map<String, Object>> getNewFormPermMatrix(@RequestParam String panelCode,
                                                               @RequestParam(required = false) String operationName) {
        perm.requirePanelRead(panelCode);
        return ApiResult.ok(service.getNewFormPermMatrix(panelCode, operationName));
    }

    @GetMapping("/getFormDescriptor")
    public ApiResult<Map<String, Object>> getFormDescriptor(@RequestParam String panelCode,
                                                            @RequestParam String code) {
        perm.requirePanelView(panelCode);
        // 供应商会话(2026-10-25「只有打印按钮和查询」):供应商端要用这条取「头+行」出纸质单,
        // 但本接口不走列表过滤 ⇒ 必须逐单核对归属:别人的单据一律 403(服务端权威,不信前端)。
        if (!queryService.supplierMayReadDoc(panelCode, code)) {
            throw new org.springframework.security.access.AccessDeniedException("该单据不属于当前供应商:" + code);
        }
        return ApiResult.ok(service.getFormDescriptor(panelCode, code));
    }

    /** 项目实施计划:终止审批状态查询(申请终止/审批按钮渲染依据;无终止单则 data=null) */
    @GetMapping("/planTerm")
    public ApiResult<Map<String, Object>> planTerm(@RequestParam String code) {
        perm.requirePanelView("RD_PLAN");
        return ApiResult.ok(buttons.termRowOf(code));
    }

    /** 项目进度查询:按项目编号(=立项申请文档编号)取该项目全部数据记录表单据(8 面板,含状态) */
    @GetMapping("/progress/dataSheets")
    public ApiResult<List<Map<String, Object>>> progressDataSheets(@RequestParam String code) {
        perm.requirePanelView("RD_PROGRESS");
        return ApiResult.ok(buttons.progressDataSheets(code));
    }

    /**
     * 研发「项目流程管控」(2026-10-20 用户口径):按立项申请单号查这条项目走到哪一步。
     * 入参 keyword = 立项单号(可只输片段;空 = 全部在册立项),出参见
     * {@link com.yinjia.mes.service.RdProjectFlowService#query}——环节判定在前端
     * {@code core/rd/flowStages.js} 里做(纯函数,单测钉边界)。
     * 权限:页面级虚拟面板 PROJECT_FLOW 的「可见」词。
     */
    @GetMapping("/rdFlow")
    public ApiResult<Map<String, Object>> rdFlow(@RequestParam(required = false) String keyword) {
        perm.requirePanelView("PROJECT_FLOW");
        return ApiResult.ok(rdFlowService().query(keyword));
    }

    /** 项目流程管控取数服务(直接注入字段,便于本类构造器保持短) */
    private com.yinjia.mes.service.RdProjectFlowService rdFlowService() {
        return rdFlow;
    }

    /**
     * 产品开发概览(2026-10-16):项目进度查询列表的「开发产品」按钮/状态 + 流程结构弹窗共用一份数据。
     * 返回 { plans: {立项文档编号: {单据编号,状态}}, products: [{产品编号,产品名称,立项文档编号,状态,
     * nodes:[{panel,label,docNo,状态,done,reaudited}],doneCount,allDone}] }。
     */
    @GetMapping("/rdDevOverview")
    public ApiResult<Map<String, Object>> rdDevOverview() {
        perm.requirePanelView("RD_PROGRESS");
        return ApiResult.ok(rdDevProducts.overview());
    }

    @PostMapping("/queryFormDataList")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> queryFormDataList(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requirePanelView(panelCode);
        String keyword = body.get("keyword") == null ? null : String.valueOf(body.get("keyword"));
        int pageNo = body.get("pageNo") == null ? 1 : Integer.parseInt(String.valueOf(body.get("pageNo")));
        int pageSize = body.get("pageSize") == null ? 20 : Integer.parseInt(String.valueOf(body.get("pageSize")));
        Map<String, Object> condition = (Map<String, Object>) body.getOrDefault("condition", Map.of());
        // 查询弹窗「高级筛选」条件行:[{field:字段标签, op:算子, value}]。只在报表(平表)面板生效。
        // 只取 field/op/value 三个键并限行数,避免把任意结构透进 SQL 构造层。
        List<Map<String, Object>> advFilters = new java.util.ArrayList<>();
        Object advRaw = body.get("advFilters");
        if (advRaw instanceof List<?> rawList) {
            for (Object o : rawList) {
                if (advFilters.size() >= 30) break; // 弹窗实际行数远小于此,纯防呆上限
                if (!(o instanceof Map<?, ?> m)) continue;
                Map<String, Object> row = new java.util.LinkedHashMap<>();
                row.put("field", m.get("field") == null ? "" : String.valueOf(m.get("field")));
                row.put("op", m.get("op") == null ? "" : String.valueOf(m.get("op")));
                row.put("value", m.get("value") == null ? "" : String.valueOf(m.get("value")));
                advFilters.add(row);
            }
        }
        return ApiResult.ok(service.queryFormDataList(panelCode, keyword, condition, pageNo, pageSize, advFilters,
                Boolean.parseBoolean(String.valueOf(body.getOrDefault("countOnly", "false")))));
    }

    @GetMapping("/getApprovalHistory")
    public ApiResult<List<Map<String, Object>>> getApprovalHistory(@RequestParam String panelCode,
                                                                   @RequestParam String code) {
        perm.requirePanelView(panelCode);
        return ApiResult.ok(service.getApprovalHistory(panelCode, code));
    }

    @PostMapping("/callButton")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> callButton(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        String buttonName = String.valueOf(body.getOrDefault("buttonName", ""));
        // 服务端按钮权限(2026-09-12):按 yj_role_panel.perms 词表映射校验,管理员恒过;
        // 此前仅审批类动作在 ButtonService 内校验,保存/删除/提交等对任何登录用户开放
        // 2026-09-20 例外:产品信息表的二级节点——被一级选定的二级审核人即使没有 audit 词
        //   (如 cp 这类普通账号)也可「审批通过/审批驳回」,否则两级审批第二级无人能点。
        Map<String, Object> formData0 = (Map<String, Object>) body.getOrDefault("formData", Map.of());
        if (!perm.isL2ApproverOf("RD_PROD_INFO", panelCode, buttonName, formData0)) {
            perm.requireButton(panelCode, buttonName);
        }
        Map<String, Object> formData = formData0;
        Map<String, Object> buttonParam = (Map<String, Object>) body.getOrDefault("buttonParam", Map.of());
        ApiResult<Map<String, Object>> result = ApiResult.ok(service.callButton(panelCode, buttonName, formData, buttonParam));
        // 使用记录:业务按钮动作(成功后才记;表单类动作附单据号)
        recordUsage(panelCode, buttonName, docNoOf(panelCode, formData), request);
        return result;
    }

    @PostMapping("/deleteForms")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> deleteForms(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requireButton(panelCode, "删除");
        List<String> rowCodes = (List<String>) body.getOrDefault("rowCodes", List.of());
        service.deleteForms(panelCode, rowCodes);
        // 使用记录:删除动作(单据号为删除清单)
        recordUsage(panelCode, "删除", String.join(",", rowCodes), request);
        return ApiResult.ok(null);
    }

    /** 纯视图类按钮(查询/刷新等),不算「权限使用」,不记录。 */
    private static final java.util.Set<String> VIEW_ONLY_BUTTONS = java.util.Set.of("刷新", "查找");

    /** 使用记录埋点:面板名 + 按钮名 + 单据号 + 当前账号 + IP(查询/刷新类纯浏览动作不记)。 */
    private void recordUsage(String panelCode, String buttonName, String docNo, HttpServletRequest request) {
        try {
            if (buttonName == null || VIEW_ONLY_BUTTONS.contains(buttonName)) return;
            String username = SecurityContextHolder.getContext().getAuthentication() == null ? null
                    : SecurityContextHolder.getContext().getAuthentication().getName();
            if (username == null) return;
            String realName = usageLog.realNameOf(username, username);
            String panelName = panelCode;
            try {
                PanelRegistry.PanelDef def = registry.panel(panelCode);
                if (def != null) panelName = def.name();
            } catch (Exception ignored) { /* 面板名取不到时回退 panelCode */ }
            usageLog.recordAction(username, realName, panelName, buttonName, docNo, clientIp(request));
        } catch (Exception ignored) { /* 埋点失败不影响业务 */ }
    }

    /** 单据号:优先前端审批动作传的「编号」键,其次面板单号字段(自动编号列)在当前表单数据中的值;取不到返回 null。 */
    private String docNoOf(String panelCode, Map<String, Object> formData) {
        if (formData == null || formData.isEmpty()) return null;
        // 前端提交审批/审批通过/审批驳回的 formData 只带 {编号, 审批意见}(见 PanelxList/PanelxForm)
        for (String key : List.of("编号", "单据编号", "记录编号")) {
            Object v = formData.get(key);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v);
        }
        try {
            PanelRegistry.PanelDef def = registry.panel(panelCode);
            if (def != null) {
                PanelRegistry.FieldDef g = def.byCol(def.groupCol());
                String label = g == null ? "单据编号" : g.label();
                Object v = formData.get(label);
                if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v);
            }
        } catch (Exception e) {
            // 面板名取不到时忽略
        }
        return null;
    }

    /** 客户端 IP(同 AuthController;带代理时取 X-Forwarded-For 首段)。 */
    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    /** 表格列自定义:保存排序/栏名/显隐 */
    @PostMapping("/saveColumnPrefs")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveColumnPrefs(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requirePanelRead(panelCode);
        List<Map<String, Object>> columns = (List<Map<String, Object>>) body.getOrDefault("columns", List.of());
        configService.saveColumnPrefs(panelCode, columns);
        return ApiResult.ok(null);
    }

    /** 表头调整:保存表头字段的排序/栏名/显隐(hidden+visible 同开同关) */
    @PostMapping("/saveHeaderPrefs")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveHeaderPrefs(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requirePanelRead(panelCode);
        List<Map<String, Object>> columns = (List<Map<String, Object>>) body.getOrDefault("columns", List.of());
        configService.saveHeaderPrefs(panelCode, columns);
        return ApiResult.ok(null);
    }

    // ---------- 动态字段(备用列池;规格 docs/design/动态字段扩展-备用列池-V1.0.md) ----------

    /** 字段管理总览:现有动态字段 + 备用列池占用/脏行 */
    @GetMapping("/extFields")
    public ApiResult<Map<String, Object>> extFields(@RequestParam String panel) {
        perm.requirePanelRead(panel);
        return ApiResult.ok(configService.extFieldOverview(panel));
    }

    /** 绑定新字段到空闲备用列(守卫 G1-G4;权限 = 该面板「自定义字段」,管理员恒过) */
    @PostMapping("/extField/add")
    public ApiResult<Map<String, Object>> extFieldAdd(@RequestBody Map<String, Object> body) {
        // 2026-10-09:原先 requireAdmin(只有超管能配自定义字段)→ 改为按面板授权,
        // 口径见 PanelPermissionService.requireFieldConfig(组织架构 →「角色与面板权限」勾「自定义字段」)
        perm.requireFieldConfig(String.valueOf(body.getOrDefault("panel", "")));
        return ApiResult.ok(configService.addExtField(body));
    }

    /** 退绑(数据保留,永不 DROP;守卫 G6;权限同绑定 = 该面板「自定义字段」) */
    @PostMapping("/extField/retire")
    public ApiResult<Void> extFieldRetire(@RequestBody Map<String, Object> body) {
        String panel = String.valueOf(body.getOrDefault("panel", ""));
        perm.requireFieldConfig(panel);
        int fieldId;
        try {
            fieldId = Integer.parseInt(String.valueOf(body.getOrDefault("fieldId", "0")));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("fieldId 必须是数字");
        }
        configService.retireExtField(panel, fieldId);
        return ApiResult.ok(null);
    }
}
