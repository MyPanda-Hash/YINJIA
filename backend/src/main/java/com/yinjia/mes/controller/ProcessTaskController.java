package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.ProcessTaskService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 工序任务(路线驱动,A 项 2026-10-05):一道工序一份待加工队列,可排序(急单/交期/排序号)、
 * 可派工到产线,报工回写完成量。前端页 /prod/plan/processQueue。
 * 权限:面板查看 = MANU_ORDER 可见;派工/排序 = MANU_ORDER「保存」词表。
 */
@RestController
@RequestMapping("/api/px/processTask")
public class ProcessTaskController {

    private final ProcessTaskService service;
    private final PanelPermissionService perm;

    public ProcessTaskController(ProcessTaskService service, PanelPermissionService perm) {
        this.service = service;
        this.perm = perm;
    }

    /** 工序任务队列(筛选:工序/生产车间/生产线/状态/关键字;排序:急单→计划完工日→排序号→工单号) */
    @PostMapping("/queue")
    public ApiResult<List<Map<String, Object>>> queue(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        Map<String, Object> b = body == null ? Map.of() : body;
        return ApiResult.ok(service.queue(str(b.get("工序")), str(b.get("生产车间")), str(b.get("生产线")),
                str(b.get("状态")), str(b.get("keyword"))));
    }

    /** 下拉选项(工序/状态/生产车间/产线/路线) */
    @PostMapping("/meta")
    public ApiResult<Map<String, Object>> meta() {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(service.meta());
    }

    /** 派工:勾选任务 → 目标生产线(状态转在加工) */
    @PostMapping("/assign")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> assign(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        return ApiResult.ok(service.assign((List<Object>) body.getOrDefault("ids", List.of()),
                str(body.get("生产线")), currentUser()));
    }

    /** 优先级/排序号(急单插队、人工排队) */
    @PostMapping("/prioritize")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> prioritize(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        Object so = body.get("排序号");
        Integer sortNo = so == null || String.valueOf(so).isBlank() ? null : Integer.valueOf(String.valueOf(so));
        return ApiResult.ok(service.prioritize((List<Object>) body.getOrDefault("ids", List.of()),
                str(body.get("优先级")), sortNo, currentUser()));
    }

    /** 按工单生成工序任务(转工单会自动生成;此处供历史工单补生成) */
    @PostMapping("/generate")
    public ApiResult<Map<String, Object>> generate(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        String plNo = str(body.get("工单号"));
        int n = service.generateForWorkOrder(plNo, currentUser());
        return ApiResult.ok(Map.of("工单号", String.valueOf(plNo), "生成任务数", n));
    }

    /** 按已审核报工重算某工单任务完成量(对账/修复) */
    @PostMapping("/rebuild")
    public ApiResult<Map<String, Object>> rebuild(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        return ApiResult.ok(service.rebuild(str(body.get("工单号")), currentUser()));
    }

    /** 可选工艺路线列表(含工序序列;订单结转/排产弹窗选择用) */
    @PostMapping("/routes")
    public ApiResult<List<Map<String, Object>>> routes() {
        perm.requirePanelView("SO_ORDER");
        return ApiResult.ok(service.routes());
    }

    /** 下一道工序 + 候选产线(排产/详情共用口径;入参 {工单号列表:[...]}) */
    @PostMapping("/nextProcess")
    @SuppressWarnings("unchecked")
    public ApiResult<List<Map<String, Object>>> nextProcess(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        Map<String, Object> b = body == null ? Map.of() : body;
        Object nos = b.get("工单号列表");
        List<String> list = nos instanceof List<?> l ? l.stream().map(String::valueOf).toList() : List.of();
        return ApiResult.ok(service.nextProcess(list));
    }

    /** 工序总览:按工序(成型/切炭/组装)汇总待加工/在加工/已完工/未完成量(只读视图) */
    @PostMapping("/board")
    public ApiResult<List<Map<String, Object>>> board() {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(service.board());
    }

    /**
     * 工单详情:表头 + 工序时间轴(这单处在哪个阶段)+ 汇总 —— 点工单号即看。
     * <p>2026-10-10 行级口径:body 带「工单行id」(plang.id)时按该行取数(计划=该行 pl_sl、报工锚该行),
     * 不带 = 整单聚合(旧行为);响应里回「追溯口径」供界面标注。
     */
    @PostMapping("/detail")
    public ApiResult<Map<String, Object>> detail(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        Object rid = body.get("工单行id");
        Long rowId = null;
        if (rid instanceof Number n) rowId = n.longValue();
        else if (rid != null && !String.valueOf(rid).isBlank()) {
            try { rowId = Long.valueOf(String.valueOf(rid).trim()); } catch (NumberFormatException ignore) { /* 非法值按整单 */ }
        }
        return ApiResult.ok(service.detail(str(body.get("工单号")), rowId));
    }

    /** **撤回派工**:任务退回待加工、清空生产线(可批量) */
    @PostMapping("/unassign")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> unassign(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        return ApiResult.ok(service.unassign((List<Object>) body.getOrDefault("ids", List.of()), currentUser()));
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || auth.getName() == null || auth.getName().isBlank() ? "system" : auth.getName();
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isBlank() || "null".equals(s) ? null : s;
    }
}
