package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.QcFlowService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 品质流程监控(2026-11-12):只读,按「送料暂收单的一条物料行 = 一个来料批次」列出
 * 送料 → 检验 → 入库 三张单的落点与状态,供品质盯批次用。
 *
 * <p>页面是专用 Vue({@code views/modules/qc/QcFlowMonitor.vue}),**不是** yj_panel 单据面板
 * ⇒ 按页面级虚拟面板 {@link PagePanelRegistry#QC_FLOW} 登记,授权落 {@code yj_role_panel};
 * 动作集只有可见/查询(本页不写任何业务数据,跳转也只跳到别的面板去看)。
 *
 * <p>跳转的权限闸门在前端({@code canViewPanel},与导航/我的桌面同一口径)而且**目标面板自己还有一道**
 * ({@code requirePanelView}) —— 本 Controller 只保证"能看这张看板的人才能读到这份数据"。
 */
@RestController
@RequestMapping("/api/px/qcFlow")
public class QcFlowController {

    private final QcFlowService service;
    private final PanelPermissionService perm;

    public QcFlowController(QcFlowService service, PanelPermissionService perm) {
        this.service = service;
        this.perm = perm;
    }

    /**
     * 看板数据(只读)。
     *
     * @param body 可选条件:{@code 状态}(未完成/已完成/待检验/待入库/异常/全部)、{@code keyword}、
     *             {@code 日期起}/{@code 日期止}、{@code limit}
     */
    @PostMapping("/list")
    public ApiResult<Map<String, Object>> list(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.QC_FLOW);
        return ApiResult.ok(service.board(body));
    }
}
