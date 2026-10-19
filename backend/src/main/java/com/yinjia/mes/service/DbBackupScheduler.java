package com.yinjia.mes.service;

import com.yinjia.mes.config.DataSourceRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 数据库自动备份的「到点检查」(用户 2026-10-19「可以设置…自动备份的时间」)。
 *
 * <p>为什么用固定频率轮询而不是 {@code @Scheduled(cron=...)}:
 * <ul>
 *   <li>备份时间由用户在面板里改({@code yj_app_setting.db_backup.auto_day/auto_time}),cron 是启动时固定的,
 *       改完得重启才生效 —— 面板设置"保存即生效"只能靠轮询;</li>
 *   <li>轮询间隔 60 秒,错过一分钟不影响结果:判断条件是「现在 ≥ 本月设定时刻 且 本月还没成功自动备份过」,
 *       所以服务重启、机器该备份那天没开机,只要本月内再起来就补一次(不会一个月备两次)。</li>
 * </ul>
 *
 * <p><b>两个账套各查一遍</b>:调度线程没有请求上下文,{@link DataSourceRouter} 的默认是正式库 ——
 * 只跑默认上下文的话,「测试账套里开了自动备份」永远不会触发(用户看着开关是开的却没备份)。
 * 故这里显式轮流 use(PROD)/use(TEST),每个账套按自己的 {@code db_backup.*} 参数判断,
 * 备份文件名也带库名,互不覆盖。服务器上没启用测试账套时,测试那一遍会抛连接异常,只记日志不中断。
 *
 * <p>异常一律吞掉并记日志:调度线程抛异常会被 Spring 停掉后续触发(备份功能自己把自己关掉)。
 * 真正的失败原因由 {@link DbBackupService#run} 写进 {@code yj_backup_log}。
 */
@Component
public class DbBackupScheduler {

    private static final Logger log = LoggerFactory.getLogger(DbBackupScheduler.class);

    private final DbBackupService backup;

    public DbBackupScheduler(DbBackupService backup) {
        this.backup = backup;
    }

    /** 每 60 秒把两个账套各看一眼是否到点(启动后先等 30 秒,避开应用启动高峰) */
    @Scheduled(initialDelayString = "${yinjia.db.backup.initial-delay-ms:30000}",
               fixedDelayString = "${yinjia.db.backup.tick-ms:60000}")
    public void tick() {
        for (String factory : new String[] { DataSourceRouter.PROD, DataSourceRouter.TEST }) {
            DataSourceRouter.use(factory);
            try {
                Map<String, Object> ran = backup.autoTick();
                if (ran != null) log.info("[数据库备份] {} 自动备份结束:{} ({})", factory, ran.get("status"), ran.get("filePath"));
            } catch (Exception e) {
                // 测试账套在服务器上可能根本没建库/没启用 → 这类异常只记 debug,不刷 warn 刷屏
                log.debug("[数据库备份] {} 自动备份检查跳过:{}", factory, e.getMessage());
            } finally {
                DataSourceRouter.clear();
            }
        }
    }
}
