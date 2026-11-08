package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.WorkOrderProgressService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 生产工序进度看板(2026-11-08):只读,按「工单号+工单行号」列出各道工序的进度,
 * 供大屏/列表两种视图查看;点击行跳「生产工单」并定位该工单(前端路由跳转,后端不参与)。
 *
 * <p>页面是专用 Vue({@code views/modules/plan/WorkOrderProgressBoard.vue}),**不是** yj_panel 单据面板
 * ⇒ 按页面级虚拟面板 {@link PagePanelRegistry#WORK_ORDER_PROGRESS} 登记,授权落 {@code yj_role_panel};
 * 动作集只有可见/查询(本页不写任何业务数据)。数据口径见 {@link WorkOrderProgressService}。
 */
@RestController
@RequestMapping("/api/px/workOrderProgress")
public class WorkOrderProgressController {

    private final WorkOrderProgressService service;
    private final PanelPermissionService perm;

    public WorkOrderProgressController(WorkOrderProgressService service, PanelPermissionService perm) {
        this.service = service;
        this.perm = perm;
    }

    /**
     * 看板数据(只读)。
     *
     * @param body 可选条件:{@code 状态}(未完工/已完工/全部,默认未完工)、{@code keyword}、{@code 生产线}、{@code limit}
     */
    @PostMapping("/list")
    public ApiResult<Map<String, Object>> list(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.WORK_ORDER_PROGRESS);
        return ApiResult.ok(service.board(body));
    }
}
