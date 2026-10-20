package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 数采流水定时清理(2026-10-19 用户口径「每 5 分钟清理一次数据」)。
 *
 * <p>背景:电子秤开了连续发送后按 1 秒一条落 {@code bs_dc_sample},一天 8.6 万行、一个月 260 万行,
 * 数据监控页只用得到"最近 10 条"(见 {@code DcPlatformService.monitor} 的 samples)。
 * 故每 5 分钟把**每个采集点**只保留最新 N 条,其余删掉。
 *
 * <p>口径与安全:
 * <ul>
 *   <li>保留条数 = {@code yinjia.dc.sample.retain}(默认 10,与页面展示的 10 条对齐);配 0 或负数 = 关闭清理;</li>
 *   <li>只删 {@code bs_dc_sample}(数采流水)。**不动**报警记录、在线状态日志、采集点/设备台账;</li>
 *   <li>按 point_id 分组保留,避免"多采集点时互相挤掉";</li>
 *   <li>删完打一行日志(本次删除行数),日志里没有这行就说明没删到东西(清理任务可能在空转)。</li>
 * </ul>
 *
 * <p>关掉的办法:在 application.yml / 启动参数里设 {@code yinjia.dc.sample.retain=0}。
 */
@Component
public class DcSampleCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(DcSampleCleanupScheduler.class);

    private final JdbcTemplate jdbc;

    /** 每个采集点保留的流水条数(默认 10;<=0 关闭) */
    @Value("${yinjia.dc.sample.retain:10}")
    private int retain;

    public DcSampleCleanupScheduler(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 每 5 分钟一次(整 5 分触发,与用户口径一致) */
    @Scheduled(cron = "${yinjia.dc.sample.cleanup-cron:0 */5 * * * *}")
    public void cleanup() {
        cleanupNow();
    }

    /** 抽成可重入方法,便于探针/手工触发 */
    public int cleanupNow() {
        if (retain <= 0) return 0;
        try {
            int deleted = jdbc.update("""
                    DELETE s FROM bs_dc_sample s
                     WHERE EXISTS (
                           SELECT 1 FROM (
                                 SELECT id,
                                        ROW_NUMBER() OVER (PARTITION BY point_id ORDER BY id DESC) AS rn
                                   FROM bs_dc_sample
                                  WHERE ISNULL(asp_cancel, 'N') <> 'Y'
                           ) t WHERE t.id = s.id AND t.rn > ?
                     )
                    """, retain);
            if (deleted > 0) log.info("[数采流水清理] 每点保留 {} 条,本次删除 {} 行", retain, deleted);
            else log.debug("[数采流水清理] 无过期流水(每点保留 {} 条)", retain);
            return deleted;
        } catch (Exception e) {
            log.warn("[数采流水清理] 失败:{}", e.getMessage());
            return -1;
        }
    }
}
