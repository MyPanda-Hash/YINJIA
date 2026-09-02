package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.panel.PanelRuntimeService;
import com.yinjia.mes.service.PanelConfigService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.ReportColumnSettingsService;
import com.yinjia.mes.service.UsageLogService;
import com.yinjia.mes.service.VoucherFlowService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
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

    public PxController(PanelRuntimeService service, PanelConfigService configService,
                        ReportColumnSettingsService reportColumnSettingsService,
                        VoucherFlowService voucherFlowService,
                        PanelRegistry registry, UsageLogService usageLog, JdbcTemplate jdbc) {
        this.service = service;
        this.configService = configService;
        this.reportColumnSettingsService = reportColumnSettingsService;
        this.voucherFlowService = voucherFlowService;
        this.registry = registry;
        this.usageLog = usageLog;
        this.jdbc = jdbc;
    }

    /** 选单来源查询(已审核 + 占用过滤,对齐 T+ SelectVoucher) */
    @PostMapping("/voucherFlow/sources")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> voucherFlowSources(@RequestBody Map<String, Object> body) {
        String sourcePanel = String.valueOf(body.getOrDefault("sourcePanel", ""));
        String targetPanel = String.valueOf(body.getOrDefault("targetPanel", ""));
        Map<String, Object> condition = (Map<String, Object>) body.getOrDefault("condition", Map.of());
        int pageNo = body.get("pageNo") == null ? 1 : Integer.parseInt(String.valueOf(body.get("pageNo")));
        int pageSize = body.get("pageSize") == null ? 20 : Integer.parseInt(String.valueOf(body.get("pageSize")));
        return ApiResult.ok(voucherFlowService.sources(sourcePanel, targetPanel, condition, pageNo, pageSize));
    }

    /** 选单生单后写占用(来源行不再出现在选单列表;删除下游草稿自动释放) */
    @PostMapping("/voucherFlow/link")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> voucherFlowLink(@RequestBody Map<String, Object> body) {
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
        return ApiResult.ok(reportColumnSettingsService.load(panelCode));
    }

    /** 报表栏目设置保存(报表表头筛选与排序补丁) */
    @PostMapping("/reportColumnSettings")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveReportColumnSettings(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
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
        return ApiResult.ok(service.getFormDescriptor(panelCode, code));
    }

    @PostMapping("/queryFormDataList")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> queryFormDataList(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        String keyword = body.get("keyword") == null ? null : String.valueOf(body.get("keyword"));
        int pageNo = body.get("pageNo") == null ? 1 : Integer.parseInt(String.valueOf(body.get("pageNo")));
        int pageSize = body.get("pageSize") == null ? 20 : Integer.parseInt(String.valueOf(body.get("pageSize")));
        Map<String, Object> condition = (Map<String, Object>) body.getOrDefault("condition", Map.of());
        return ApiResult.ok(service.queryFormDataList(panelCode, keyword, condition, pageNo, pageSize));
    }

    @GetMapping("/getApprovalHistory")
    public ApiResult<List<Map<String, Object>>> getApprovalHistory(@RequestParam String panelCode,
                                                                   @RequestParam String code) {
        return ApiResult.ok(service.getApprovalHistory(panelCode, code));
    }

    @PostMapping("/callButton")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> callButton(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        String buttonName = String.valueOf(body.getOrDefault("buttonName", ""));
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
}
