package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 库存**月结定时任务**(用户口径:「每月 1 号自动月结上个月的」)。
 *
 * <p>行为:每月 1 号 00:20 自动月结**上个月**。失败不抛出(只记日志 + 打 ERROR 到控制台)——
 * 定时任务抛异常只会被 Spring 吞掉,反而看不到原因;面板上随时可用
 * 「上月月结 / 重新月结」手工补做(见 {@code ButtonService.monthClose})。
 *
 * <p>幂等与安全:
 * <ul>
 *   <li>已月结的期间会抛 {@code IllegalStateException},这里捕获后按「跳过」记录(每月的 1 号只可能中一次,重复触发也不会改数);</li>
 *   <li>跨账套:任务跑在**当前实例连的那个账套**上(正式/测试各一套服务,各自月结各自的库);</li>
 *   <li>时间点选 00:20 而不是 00:00:留出跨零点结算/备份的余量,且不依赖任何外部调度器。</li>
 * </ul>
 */
@Component
public class StockMonthCloseScheduler {

    private static final Logger log = LoggerFactory.getLogger(StockMonthCloseScheduler.class);

    /** cron:秒 分 时 日 月 周 —— 每月 1 号 00:20 */
    static final String CRON = "0 20 0 1 * ?";

    private final StockMonthCloseService monthClose;

    public StockMonthCloseScheduler(StockMonthCloseService monthClose) {
        this.monthClose = monthClose;
    }

    @Scheduled(cron = CRON)
    public void autoClosePrevMonth() {
        String period = StockMonthCloseService.prevPeriod(LocalDate.now());
        try {
            var res = monthClose.close(period, "system(自动月结)");
            log.info("[月结·自动] {} 完成:{}", period, res);
            System.out.println("[YINJIA-MES][月结·自动] " + period + " 完成:" + res);
        } catch (IllegalStateException e) {
            log.info("[月结·自动] {} 跳过:{}", period, e.getMessage());
        } catch (Exception e) {
            log.error("[月结·自动] {} 失败:{}", period, e.getMessage(), e);
            System.err.println("[YINJIA-MES][月结·自动] " + period + " 失败:" + e.getMessage());
        }
    }
}
