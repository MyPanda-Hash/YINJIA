package com.yinjia.mes.controller;

import com.yinjia.mes.service.StockMonthCloseService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 库存月结接口(2026-10-15)。
 *
 * <p>分工:
 * <ul>
 *   <li><b>三个动作按钮</b>(上月月结/取消上月月结/重新月结)走的是面板统一入口
 *       {@code POST /api/px/callButton}(见 {@code ButtonService.monthClose})—— 与其它面板按钮同权限、同审计;</li>
 *   <li>本控制器只提供**读取类**能力,给「库存明细」页用:
 *       ① {@code GET /status} 期间状态(建议期间=上月、最近月结记录、未月结期间);
 *       ② {@code GET /detail} 某一行 (物料,仓库,批号) 在指定期间的**展开明细**
 *          (月结快照 + 该月入库流水 + 该月出库流水 + 结转行)—— 报表行展开就是它。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/stock/monthClose")
public class StockMonthCloseController {

    private final StockMonthCloseService monthClose;

    public StockMonthCloseController(StockMonthCloseService monthClose) {
        this.monthClose = monthClose;
    }

    /** 月结状态:建议期间(上月) + 最近月结记录 + 未月结期间 */
    @GetMapping("/status")
    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", 200);
        out.put("message", "success");
        out.put("data", monthClose.status());
        return out;
    }

    /**
     * 展开明细。
     *
     * @param period 期间 'YYYY-MM',缺省 = 上月
     * @param wzdm   物料编码(必填)
     * @param ckdm   仓库编码(必填)
     * @param lot    批号;**不传 = 不限批号**(所有批次一起看);传值(含**空串**)= 精确匹配该批号
     *               —— 空串表示「无批号那一组」。⚠ 别给这个参数加 {@code defaultValue = ""}:
     *               那会把"不传"变成"空批号",所有批次的行都被过滤掉(实测踩过:加了默认值后
     *               本键 19 条批号结转行只剩 1 条,当月 17 张单据全被滤没)。
     */
    @GetMapping("/detail")
    public Map<String, Object> detail(@RequestParam(required = false) String period,
                                      @RequestParam String wzdm,
                                      @RequestParam String ckdm,
                                      @RequestParam(required = false) String lot) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", 200);
        out.put("message", "success");
        out.put("data", monthClose.detail(period, wzdm, ckdm, lot));
        return out;
    }

    /** 当前期间状态(调试/探针用) */
    @GetMapping("/state")
    public Map<String, Object> state(@RequestParam(required = false) String period) {
        String p = period == null || period.isBlank() ? StockMonthCloseService.prevPeriod(LocalDate.now()) : period;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", 200);
        out.put("data", Map.of("期间", p, "状态", monthClose.periodState(p)));
        return out;
    }

    /**
     * 月结直调入口(运维/补做历史月用):{@code POST /api/stock/monthClose/run}
     * body = {@code {"action":"close|cancel|reclose","period":"2026-09"}}。
     *
     * <p>与面板按钮走的是**同一份引擎**,差别只在入口:按钮那条路经 {@code /api/px/callButton}
     * (含按钮权限与操作留痕);这条路给「面板点不动/要写脚本补月」的场景。
     *
     * <p>失败时把**异常类名 + 消息 + 前 8 帧**原样返回 —— 全局异常处理器会把异常归一成
     * 「400/500 + 消息」,消息为空时(如 NPE)只剩一个 code,排查时看不到线索(2026-10-15 实测踩到)。
     */
    @PostMapping("/run")
    public Map<String, Object> run(@RequestBody Map<String, Object> body) {
        String action = body == null ? null : String.valueOf(body.getOrDefault("action", "close"));
        Object rawPeriod = body == null ? null : body.get("period");
        String period = rawPeriod == null || String.valueOf(rawPeriod).isBlank()
                ? StockMonthCloseService.prevPeriod(LocalDate.now())
                : StockMonthCloseService.normPeriod(String.valueOf(rawPeriod));
        String user = currentUserName();
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            Map<String, Object> res = switch (action) {
                case "cancel" -> monthClose.cancel(period, user);
                case "reclose" -> monthClose.reclose(period, user);
                default -> monthClose.close(period, user);
            };
            out.put("code", 200);
            out.put("message", "success");
            out.put("data", res);
        } catch (Throwable e) {
            out.put("code", 500);
            out.put("message", e.getClass().getSimpleName() + ": " + e.getMessage()
                    + (e.getCause() == null ? "" : " ← " + e.getCause().getClass().getSimpleName() + ": " + e.getCause().getMessage()));
            List<String> trace = new ArrayList<>();
            StackTraceElement[] st = e.getStackTrace();
            for (int i = 0; i < Math.min(8, st.length); i++) trace.add(st[i].toString());
            out.put("stack", trace);
        }
        return out;
    }

    private static String currentUserName() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}
