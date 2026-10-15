package com.yinjia.mes.controller;

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
 */
@RestController
@RequestMapping("/api/stock/warn")
public class StockWarnController {

    private final StockWarnService warn;

    public StockWarnController(StockWarnService warn) {
        this.warn = warn;
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

    /** 写:设置某 (物料,仓库,批次号) 的预警数量。body = {wzdm, ckdm, lot, qty, user?}。 */
    @PostMapping("/set")
    public Map<String, Object> set(@RequestBody Map<String, Object> body) {
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
