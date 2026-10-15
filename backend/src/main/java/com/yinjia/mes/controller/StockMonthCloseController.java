package com.yinjia.mes.controller;

import com.yinjia.mes.service.StockMonthCloseService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
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
     * @param lot    批号(空 = 无批号那一组)
     */
    @GetMapping("/detail")
    public Map<String, Object> detail(@RequestParam(required = false) String period,
                                      @RequestParam String wzdm,
                                      @RequestParam String ckdm,
                                      @RequestParam(required = false, defaultValue = "") String lot) {
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
}
