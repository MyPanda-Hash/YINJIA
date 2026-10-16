package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * **手机端报工吸收定时任务**(2026-10-17)。
 *
 * <p>为什么必须是"定时扫描"而不是"数据一到就触发":手机端(参考库 PDA)是**另一个程序直连数据库写
 * {@code scjl}** 的,MES 后端在这个过程中**根本没有被调用**(没有 HTTP、也没有触发器),
 * 所以"MES 侧发现这些新行"这一步绕不过去 —— 本任务就是那个"发现者",
 * 它把外部报工行按 MES 报工审核的同一套后果补齐(镜像 → 状态推进 → 转序派线)。
 *
 * <p>配置:
 * <ul>
 *   <li>{@code yinjia.report.absorb-enabled=false} 可整体关掉(默认开);</li>
 *   <li>{@code yinjia.report.absorb-cron} 可改频率(默认每分钟第 0 秒);</li>
 *   <li>{@code yinjia.report.absorb-days} 可改回看天数(默认 {@value ExternalReportAbsorbService#DEFAULT_DAYS} 天,
 *       只吸收最近几天的行,不回放历史账)。</li>
 * </ul>
 *
 * <p>失败只记日志(定时任务抛异常会被 Spring 吞掉,反而看不到原因);
 * 现场随时可用 {@code POST /api/px/scheduleBoard/absorbMobile} 手工补跑(返回逐行明细)。
 */
@Component
@ConditionalOnProperty(prefix = "yinjia.report", name = "absorb-enabled", havingValue = "true", matchIfMissing = true)
public class ExternalReportAbsorbScheduler {

    private static final Logger log = LoggerFactory.getLogger(ExternalReportAbsorbScheduler.class);

    private final ExternalReportAbsorbService absorb;

    @org.springframework.beans.factory.annotation.Value("${yinjia.report.absorb-days:3}")
    private int days;

    public ExternalReportAbsorbScheduler(ExternalReportAbsorbService absorb) {
        this.absorb = absorb;
    }

    @Scheduled(cron = "${yinjia.report.absorb-cron:0 * * * * *}")
    public void tick() {
        try {
            Map<String, Object> res = absorb.absorb(days, "system(手机端报工吸收)");
            int n = res.get("候选行") instanceof Number x ? x.intValue() : 0;
            int done = res.get("已吸收") instanceof Number x ? x.intValue() : 0;
            int fail = res.get("失败") instanceof Number x ? x.intValue() : 0;
            // 只在**真的干活或出错**时打日志:候选行可能长期存在但恒被跳过(等人工排产/补行号),
            // 每分钟打一条会把日志淹掉(size 抓不出问题)。
            if (done > 0 || fail > 0) {
                log.info("[手机端报工吸收] 候选={} 已吸收={} 跳过={} 失败={}", n,
                        res.get("已吸收"), res.get("跳过"), res.get("失败"));
                System.out.println("[YINJIA-MES][手机端报工吸收] 候选=" + n + " 已吸收=" + res.get("已吸收")
                        + " 跳过=" + res.get("跳过") + " 失败=" + res.get("失败") + " 明细=" + res.get("明细"));
            }
        } catch (Exception e) {
            log.error("[手机端报工吸收] 执行失败:{}", e.getMessage(), e);
            System.err.println("[YINJIA-MES][手机端报工吸收] 执行失败:" + e.getMessage());
        }
    }
}
