package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.WorkOrderCompletionService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

/** 完工明细入口；权限、参数校验与转发，不含 SQL。 */
@RestController
@RequestMapping("/api/px/workOrderList")
public class WorkOrderCompletionController {
    private final PanelPermissionService perm;
    private final WorkOrderCompletionService service;

    public WorkOrderCompletionController(PanelPermissionService perm, WorkOrderCompletionService service) {
        this.perm = perm;
        this.service = service;
    }

    @PostMapping("/completionDetails")
    public ApiResult<Map<String, Object>> completionDetails(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_LIST);
        if (body == null || !(body.get("工单号") instanceof String no) || no.isBlank()) {
            throw new IllegalArgumentException("请提供工单号");
        }
        long rowId;
        try {
            rowId = new BigDecimal(String.valueOf(body.get("行id"))).longValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            throw new IllegalArgumentException("行id必须为正整数");
        }
        if (rowId <= 0) throw new IllegalArgumentException("行id必须为正整数");
        return ApiResult.ok(service.completionDetails(no, rowId));
    }
}
