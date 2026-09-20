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
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbc;
    private final DevTaskService devTaskService;
    private final ButtonService buttons;
    private final PanelPermissionService perm;

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PxController.class);

    public PxController(PanelRuntimeService service, PanelConfigService configService,
                        ReportColumnSettingsService reportColumnSettingsService,
                        VoucherFlowService voucherFlowService,
                        PanelRegistry registry, UsageLogService usageLog, JdbcTemplate jdbc,
                        DevTaskService devTaskService, ButtonService buttons,
                        PanelPermissionService perm) {
        this.service = service;
        this.configService = configService;
        this.reportColumnSettingsService = reportColumnSettingsService;
        this.voucherFlowService = voucherFlowService;
        this.registry = registry;
        this.usageLog = usageLog;
        this.jdbc = jdbc;
        this.devTaskService = devTaskService;
        this.buttons = buttons;
        this.perm = perm;
    }

    /** 产品开发:下游面板元数据(矩阵列头) */
    @GetMapping("/rdDev/meta")
    public ApiResult<List<Map<String, String>>> rdDevMeta() {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(DevTaskService.devPanelMeta());
    }

    /** 产品开发:产品信息表侧边栏按钮状态(是否已下发) */
    @GetMapping("/rdDev/buttonState")
    public ApiResult<Map<String, Object>> rdDevButtonState(@RequestParam String docNo) {
        perm.requirePanelView("RD_PROD_INFO");
        String productCode = null;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 产品编号 FROM rd_prod_info_head WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", docNo);
        if (!rows.isEmpty() && rows.get(0).get("产品编号") != null) {
            productCode = String.valueOf(rows.get(0).get("产品编号")).trim();
        }
        return ApiResult.ok(devTaskService.buttonState(productCode));
    }

    /** 产品开发:已下发产品的开发矩阵 */
    @GetMapping("/rdDev/board")
    public ApiResult<List<Map<String, Object>>> rdDevBoard() {
        perm.requirePanelView("RD_PROD_INFO");
        return ApiResult.ok(devTaskService.board());
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

        // 各面板"已归档单据的产品键 → 归档时点"。产品键字段各面板不同(规格书是「编号」,其余是「产品编号」),
        // 用 DevTaskService.productKeyOf(panel) 取;单据号列用面板自己的 groupCol。
        Map<String, Map<String, String>> archivedAt = new LinkedHashMap<>();  // 面板 → (产品键 → 归档时点)
        for (String panel : DevTaskService.devPanelCodes()) {
            Map<String, String> m = new LinkedHashMap<>();
            try {
                String table = registry.panel(panel).headTable();
                String keyCol = DevTaskService.productKeyOf(panel);
                String docCol = pickGroupCol(panel);
                jdbc.query("SELECT t.[" + keyCol + "] AS k, MAX(s.archived_at) AS at "
                                + "FROM " + table + " t "
                                + "JOIN yj_doc_status s ON s.panel_code = ? AND s.doc_no = t.[" + docCol + "] "
                                + "WHERE ISNULL(s.archived,'N') = 'Y' AND ISNULL(t.asp_cancel,'N') <> 'Y' "
                                + "GROUP BY t.[" + keyCol + "]",
                        rs -> {
                            String k = rs.getString("k");
                            if (k != null && !k.isBlank()) {
                                Object at = rs.getObject("at");
                                m.put(k, at == null ? "" : String.valueOf(at));
                            }
                        }, panel);
            } catch (Exception e) {
                // 某面板表/列缺失时降级:该面板不参与受控推导,矩阵主体仍可用
                log.warn("[RD_PROD_DOCLIST] 受控推导跳过 panel={}: {}", panel, e.getMessage());
            }
            archivedAt.put(panel, m);
        }

        for (Map<String, Object> row : rows) {
            String productCode = String.valueOf(row.get("产品编号"));
            @SuppressWarnings("unchecked")
            Map<String, String> cells = (Map<String, String>) row.get("cells");
            boolean allDone = cells != null && !cells.isEmpty()
                    && cells.values().stream().allMatch(DevTaskService.STATUS_DONE::equals);
            String lastAt = "";
            for (String panel : DevTaskService.devPanelCodes()) {
                String at = archivedAt.getOrDefault(panel, Map.of()).get(productCode);
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

    /** 该面板的单据号列(状态表 doc_no 的对应列):优先 group_col,缺省「单据编号」 */
    private String pickGroupCol(String panelCode) {
        String g = registry.panel(panelCode).groupCol();
        return g == null || g.isBlank() ? "单据编号" : g;
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

    /** 报表栏目设置读取(报表表头筛选与排序补丁) */
    @GetMapping("/reportColumnSettings")
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
        return ApiResult.ok(service.getPanelConfig(panelCode));
    }

    @GetMapping("/getPermMatrix")
    public ApiResult<Map<String, Object>> getPermMatrix(@RequestParam String panelCode) {
        return ApiResult.ok(service.getPermMatrix(panelCode));
    }

    @GetMapping("/getNewFormPermMatrix")
    public ApiResult<Map<String, Object>> getNewFormPermMatrix(@RequestParam String panelCode,
                                                               @RequestParam(required = false) String operationName) {
        return ApiResult.ok(service.getNewFormPermMatrix(panelCode, operationName));
    }

    @GetMapping("/getFormDescriptor")
    public ApiResult<Map<String, Object>> getFormDescriptor(@RequestParam String panelCode,
                                                            @RequestParam String code) {
        perm.requirePanelView(panelCode);
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

    @PostMapping("/queryFormDataList")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> queryFormDataList(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        perm.requirePanelView(panelCode);
        String keyword = body.get("keyword") == null ? null : String.valueOf(body.get("keyword"));
        int pageNo = body.get("pageNo") == null ? 1 : Integer.parseInt(String.valueOf(body.get("pageNo")));
        int pageSize = body.get("pageSize") == null ? 20 : Integer.parseInt(String.valueOf(body.get("pageSize")));
        Map<String, Object> condition = (Map<String, Object>) body.getOrDefault("condition", Map.of());
        return ApiResult.ok(service.queryFormDataList(panelCode, keyword, condition, pageNo, pageSize));
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
        perm.requireButton(panelCode, buttonName);
        Map<String, Object> formData = (Map<String, Object>) body.getOrDefault("formData", Map.of());
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
            List<Map<String, Object>> u = jdbc.queryForList(
                    "SELECT real_name FROM yj_user WHERE username = ?", username);
            String realName = u.isEmpty() ? username : String.valueOf(u.get(0).get("real_name"));
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
        List<Map<String, Object>> columns = (List<Map<String, Object>>) body.getOrDefault("columns", List.of());
        configService.saveColumnPrefs(panelCode, columns);
        return ApiResult.ok(null);
    }

    /** 表头调整:保存表头字段的排序/栏名/显隐(hidden+visible 同开同关) */
    @PostMapping("/saveHeaderPrefs")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveHeaderPrefs(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        List<Map<String, Object>> columns = (List<Map<String, Object>>) body.getOrDefault("columns", List.of());
        configService.saveHeaderPrefs(panelCode, columns);
        return ApiResult.ok(null);
    }
}
