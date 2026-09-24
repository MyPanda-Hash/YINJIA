package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.OrderConvertService;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 订单结转·发单工作台(《订单结转实现方案-V1.0》):
 * 待结转行(剩余=需求−已排产−已采购)/汇总/转工单(自制)/转采购单(外购成品)。
 * 权限:查询类 SO_ORDER 可见;转单类 SO_ORDER 编辑权(add/modify)。
 */
@RestController
@RequestMapping("/api/px/orderConvert")
public class OrderConvertController {

    private final OrderConvertService service;
    private final PanelPermissionService perm;

    public OrderConvertController(OrderConvertService service, PanelPermissionService perm) {
        this.service = service;
        this.perm = perm;
    }

    /** 待结转订单行(剩余>0;已转满自动消失,删下游草稿自动回现) */
    @PostMapping("/pending")
    public ApiResult<List<Map<String, Object>>> pending(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView("SO_ORDER");
        return ApiResult.ok(service.pending(body == null ? null : str(body.get("keyword"))));
    }

    /** 顶部汇总条:未结转/今日结转(笔数/款数/数量) + 当前数据笔数 */
    @PostMapping("/stats")
    public ApiResult<Map<String, Object>> stats() {
        perm.requirePanelView("SO_ORDER");
        return ApiResult.ok(service.stats());
    }

    /** 保存交期(行内编辑):修正 预计交货日期 回写订单行(同步侧历史数据与创建日期雷同,结转处就地修正) */
    @PostMapping("/saveDates")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> saveDates(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("SO_ORDER");
        perm.requireButton("SO_ORDER", "保存");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(service.saveDates(rows, currentUser()));
    }

    /** 转工单(自制):勾选行 → 加工单草稿(生单数量缺省=两通道剩余) */
    @PostMapping("/toManu")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> toManu(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("SO_ORDER");
        perm.requireButton("SO_ORDER", "保存");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(service.toManu(rows, currentUser()));
    }

    /** 转采购单(外购成品):勾选行 → 采购申请草稿(行=订单产品本身,数量=剩余)+占用+推送采购 */
    @PostMapping("/toPurchase")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> toPurchase(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("SO_ORDER");
        perm.requireButton("SO_ORDER", "保存");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(service.toPurchase(rows, currentUser()));
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
