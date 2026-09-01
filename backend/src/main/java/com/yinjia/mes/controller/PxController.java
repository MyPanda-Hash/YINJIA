package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.panel.PanelRuntimeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 通用面板接口(对齐 light-mes:仅依赖 PanelRuntimeService 契约) */
@RestController
@RequestMapping("/api/px")
public class PxController {

    private final PanelRuntimeService service;
    private final com.yinjia.mes.service.PanelConfigService configService;
    private final com.yinjia.mes.service.ReportColumnSettingsService reportColumnSettingsService;
    private final com.yinjia.mes.service.VoucherFlowService voucherFlowService;

    public PxController(PanelRuntimeService service, com.yinjia.mes.service.PanelConfigService configService,
                        com.yinjia.mes.service.ReportColumnSettingsService reportColumnSettingsService,
                        com.yinjia.mes.service.VoucherFlowService voucherFlowService) {
        this.service = service;
        this.configService = configService;
        this.reportColumnSettingsService = reportColumnSettingsService;
        this.voucherFlowService = voucherFlowService;
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
    public ApiResult<Map<String, Object>> callButton(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        String buttonName = String.valueOf(body.getOrDefault("buttonName", ""));
        Map<String, Object> formData = (Map<String, Object>) body.getOrDefault("formData", Map.of());
        Map<String, Object> buttonParam = (Map<String, Object>) body.getOrDefault("buttonParam", Map.of());
        return ApiResult.ok(service.callButton(panelCode, buttonName, formData, buttonParam));
    }

    @PostMapping("/deleteForms")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> deleteForms(@RequestBody Map<String, Object> body) {
        String panelCode = String.valueOf(body.getOrDefault("panelCode", ""));
        List<String> rowCodes = (List<String>) body.getOrDefault("rowCodes", List.of());
        service.deleteForms(panelCode, rowCodes);
        return ApiResult.ok(null);
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
