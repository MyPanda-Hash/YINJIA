package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工序路线排线提交的编排层(2026-11-13 第五轮)。
 *
 * <p>把两件事放在**同一个事务**里:
 * <ol>
 *   <li><b>排产数量 &lt; 需求数量</b> ⇒ 先调 {@link WorkOrderSplitService#splitRemainderForSchedule}
 *       把剩余数量切出子工单(未排产,进待排产池),父行需求同步核减到本次排产量;</li>
 *   <li>再调 {@link ProcessTaskService#preplanManual} 写排产(产线/排产数量/工序台账)。</li>
 * </ol>
 * 顺序不能反:先切单把父行需求改成"本次排产量",preplan 的「排产数量不得超过需求数量」校验自然通过;
 * 且若切单失败,整次排产回滚(不会出现"父单排了 100、剩余 100 凭空消失"的中间态)。
 *
 * <p>为什么不写在 {@link ProcessTaskService} 里:它已被 {@link WorkOrderSplitService} 依赖
 * (切单复制台账),再反向依赖会形成循环;本类作为上层编排即可。
 *
 * <p>用户口径(2026-11-13):「当前我排产数量未能达到需求数量的话会导致这个工单的剩余数量无法被排产,
 * 需要实现当目前排产数量小于这个需求数量时自动将剩余数量切单。」
 */
@Service
public class SchedulePreplanService {

    private static final Logger log = LoggerFactory.getLogger(SchedulePreplanService.class);

    private final JdbcTemplate jdbc;
    private final ProcessTaskService processTask;
    private final WorkOrderSplitService splitService;

    public SchedulePreplanService(JdbcTemplate jdbc, ProcessTaskService processTask,
                                  WorkOrderSplitService splitService) {
        this.jdbc = jdbc;
        this.processTask = processTask;
        this.splitService = splitService;
    }

    /**
     * 工序路线排线(含"排产数量小于需求 ⇒ 剩余自动切单")。
     *
     * @param planQty 本次人工给定的排产数量;空 = 沿用现值(现值为 0 取需求),此时不做自动切单
     * @return preplanManual 的回执 + 自动切单信息:{自动切出子工单, 自动切出数量, 自动切单提示}
     */
    @Transactional
    public Map<String, Object> preplan(String plNo, Long lineId, List<Map<String, Object>> steps,
                                       String team, Double planQty, String user) {
        Map<String, Object> autoSplit = Map.of();
        if (planQty != null && lineId != null && planQty > 0.0001) {
            Double demand = demandOf(lineId);
            double qty = round(planQty);
            // 剩余 = 需求 − 本次排产;> 0 才切(相等=全排,不切;负数由 preplan 自身报"超过需求")
            if (demand != null && demand > 0.0001 && qty < demand - 0.0001) {
                double rest = round(demand - qty);
                autoSplit = splitService.splitRemainderForSchedule(lineId, rest, user);
                log.info("[排产剩余切单] 工单 {} 行id={} 需求 {} 本次排产 {} → 自动切出 {} ({})",
                        plNo, lineId, demand, qty, autoSplit.get("子工单号"), autoSplit.get("切出数量"));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>(processTask.preplanManual(plNo, lineId, steps, team, planQty, user));
        if (!autoSplit.isEmpty()) {
            out.put("自动切出子工单", autoSplit.get("子工单号"));
            out.put("自动切出数量", autoSplit.get("切出数量"));
            out.put("自动切单提示", autoSplit.get("提示"));
        }
        return out;
    }

    /** 该工单行的当前需求数量(xq_sl);行不存在 → null */
    private Double demandOf(long rowId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ISNULL(xq_sl,0) AS xq_sl FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", rowId);
        return rows.isEmpty() ? null : num(rows.get(0).get("xq_sl"));
    }

    private static double num(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        if (v == null) return 0;
        try {
            return Double.parseDouble(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static double round(double v) {
        return Math.round(v * 10000d) / 10000d;
    }
}
