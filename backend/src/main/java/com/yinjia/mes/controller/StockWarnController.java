package com.yinjia.mes.controller;

import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.StockWarnService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 库存预警数量(用户 2026-10-15 第十六轮)——库存明细展开区按**批次号**读/设。
 *
 * <p>存储复用 <code>kucun.[预警数量]</code>(既有列,粒度 = 物料 + 仓库 + 批次号);
 * 出库审批的拦截面在 {@link StockWarnService#checkOutbound}。
 *
 * <p><b>权限(2026-10-15)</b>:写接口 /set 挂「预警配置」(warn 词)服务端闸门 ——
 * {@link PanelPermissionService#requireWarnConfig}(管理员恒过,普通用户要求该面板在
 * 组织架构「角色与面板权限」里勾了「预警配置」)。词表同 SysAdminController.PERMISSION_ACTIONS。
 */
@RestController
@RequestMapping("/api/stock/warn")
public class StockWarnController {

    /** 允许配置预警数量的面板(前端传面板码):库存状况行内编辑 / 库存明细展开区按批次设置。
     *  白名单防止"在别的面板碰巧有 warn 词"就拿来写库存预警。 */
    private static final java.util.Set<String> WARN_PANELS = java.util.Set.of("STOCK_STATUS", "STOCK_DETAIL");

    private final StockWarnService warn;
    private final PanelPermissionService perm;

    public StockWarnController(StockWarnService warn, PanelPermissionService perm) {
        this.warn = warn;
        this.perm = perm;
    }

    /** 读:某 (物料,仓库) 下每个批次的预警数量 ⇒ {批号: 数量}(库存明细展开区直接用)。 */
    @GetMapping("/list")
    public Map<String, Object> list(@RequestParam String wzdm, @RequestParam String ckdm) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", 200);
        out.put("message", "success");
        out.put("data", warn.warnMap(wzdm, ckdm));
        return out;
    }

    /** 写:设置某 (物料,仓库,批次号) 的预警数量。body = {wzdm, ckdm, lot, qty, panel?, user?}。
     *  权限:要求该面板的「预警配置」(warn)词,管理员恒过 —— 见 PanelPermissionService.requireWarnConfig。 */
    @PostMapping("/set")
    public Map<String, Object> set(@RequestBody Map<String, Object> body) {
        String panel = str(body.get("panel"));
        if (panel.isEmpty()) panel = "STOCK_DETAIL";   // 本接口的默认来源面板(库存明细展开区)
        if (!WARN_PANELS.contains(panel)) throw new IllegalArgumentException("该面板不支持配置预警数量：" + panel);
        perm.requireWarnConfig(panel);
        String wzdm = str(body.get("wzdm"));
        String ckdm = str(body.get("ckdm"));
        String lot = str(body.get("lot"));
        Object q = body.get("qty");
        BigDecimal qty = q == null || String.valueOf(q).isBlank() ? BigDecimal.ZERO : new BigDecimal(String.valueOf(q));
        String user = str(body.get("user"));
        if (user.isEmpty()) user = "warn:admin";
        if (wzdm.isEmpty() || ckdm.isEmpty()) throw new IllegalArgumentException("物料编码/仓库编码必填");
        if (qty.signum() < 0) throw new IllegalArgumentException("预警数量不能为负数");
        warn.set(wzdm, ckdm, lot, qty, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", 200);
        out.put("message", "success");
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("物料编码", wzdm);
        d.put("仓库编码", ckdm);
        d.put("批次号", lot);
        d.put("预警数量", qty);
        out.put("data", d);
        return out;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
