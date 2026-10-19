package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * **结案巡检 / 自愈定时任务**(2026-10-18)。
 *
 * <p>背景:生产工单的「已结案」只看 {@code plang.ja},而这张表被**手机端小程序/参考库直连写入** ——
 * 现场出现过「扫码报工后其余工单全部变成已结案」。MES 自己结案必须
 * 「入库 ≥ 排产 + 组装成品检验已审核」且一定留痕,所以没有留痕的 {@code ja='Y'} 就是外部写的。
 *
 * <p>本任务每分钟看一次(不写库也能提前发现):
 * <ul>
 *   <li>有异常且开关**关**(默认)⇒ 每 30 分钟最多 WARN 一次,把「谁、几行、哪几行」写进日志,
 *       现场据此判断要不要点「结案回正」或跑回正脚本;</li>
 *   <li>有异常且开关**开**({@code yinjia.workorder.ja-selfheal-enabled=true})⇒ 直接回正
 *       (单次上限 {@link WorkOrderCloseGuard} 内定的 200 行),逐行留痕,并把结果写日志。</li>
 * </ul>
 *
 * <p>为什么默认关:回正 = **写生产数据**,还会和外部程序"互搏"(它写 Y、我们改 N)。
 * 口径确认后再开,或先用页面上的「结案回正」手工处理。
 *
 * <p>配置:
 * <pre>
 *   yinjia.workorder.ja-selfheal-enabled: false      # true = 自动回正
 *   yinjia.workorder.ja-selfheal-cron: 20 * * * * *   # 每分钟第 20 秒(= 错开吸收任务的第 0 秒)
 * </pre>
 */
@Component
public class WorkOrderCloseGuardScheduler {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderCloseGuardScheduler.class);
    /** 开关关着时,两次告警的最小间隔(避免每分钟刷屏) */
    private static final long WARN_INTERVAL_MS = 30 * 60 * 1000L;

    private final WorkOrderCloseGuard guard;

    @Value("${yinjia.workorder.ja-selfheal-enabled:false}")
    private boolean selfHealEnabled;

    /** 上次告警时间/上次异常行数(只在"有异常"时更新,用于抑制重复日志) */
    private long lastWarnAt = 0L;
    private int lastWarnCount = -1;

    public WorkOrderCloseGuardScheduler(WorkOrderCloseGuard guard) {
        this.guard = guard;
    }

    @Scheduled(cron = "${yinjia.workorder.ja-selfheal-cron:20 * * * * *}")
    public void tick() {
        try {
            List<Map<String, Object>> anomalies = guard.findAnomalies(500);
            if (anomalies.isEmpty()) {
                if (lastWarnCount > 0) log.info("[结案巡检] 已无「外部写入的已结案」异常行");
                lastWarnCount = 0;
                return;
            }
            if (!selfHealEnabled) {
                long now = System.currentTimeMillis();
                if (anomalies.size() != lastWarnCount || now - lastWarnAt >= WARN_INTERVAL_MS) {
                    String sample = anomalies.stream().limit(5)
                            .map(r -> r.get("工单号") + "#" + r.get("工单行号"))
                            .reduce((a, b) -> a + "," + b).orElse("");
                    log.warn("[结案巡检] 发现 {} 行「外部写入的已结案」(入库 < 排产 ⇒ 不可能是 MES 结的,"
                                    + "判据见 PlangClose.anomaly):"
                                    + " {} … 开关 ja-selfheal-enabled=false,本轮只报告不回正(可点「结案回正」或开开关)",
                            anomalies.size(), sample);
                    lastWarnAt = now;
                    lastWarnCount = anomalies.size();
                }
                return;
            }
            List<String> healed = guard.heal("system(结案自愈)", 0);
            int left = anomalies.size() - healed.size();
            log.warn("[结案自愈] 本轮回正 {} 行{};明细:{}", healed.size(),
                    left > 0 ? "(单次上限 200,余 " + left + " 行下一轮继续)" : "",
                    healed.stream().limit(20).reduce((a, b) -> a + "," + b).orElse(""));
            lastWarnCount = 0;
        } catch (Exception e) {
            // 定时任务抛异常会被 Spring 吞掉 ⇒ 自己记一行
            log.warn("[结案巡检] 执行失败(下一轮重试):{}", e.getMessage());
        }
    }
}
