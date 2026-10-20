package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.DbBackupService;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 系统管理平台 · 数据安全(数据库主动备份 / 自动备份)—— 用户 2026-10-19
 * 「系统管理模块加一个面板,可以设置系统的数据库数据的主动备份和自动备份的时间」。
 *
 * <p>四个接口对应面板上的四件事:看当前设置({@code GET /overview})、改设置({@code POST /save})、
 * 立即备份一次({@code POST /run})、看备份记录({@code GET /logs})。
 *
 * <p><b>权限</b>:整页 {@link PanelPermissionService#requireAdmin()} —— 备份会启动数据库写盘任务、
 * 备份文件本身就是全库数据拷贝,只给管理员。前端 {@code /sys/backup} 路由同时带
 * {@code meta.requireAdmin}(直接敲 URL 也进不去)+ 菜单 adminOnly 隐藏,三层同源。
 *
 * <p><b>为什么「立即备份」是同步返回</b>:用户点了要马上知道成不成(成败都进 yj_backup_log);
 * 完整备份几十秒内完成,请求超时在 {@code application.yml} 里调高即可,不必引入任务队列。
 */
@RestController
@RequestMapping("/api/sys/backup")
public class SysBackupController {

    private final DbBackupService backup;
    private final PanelPermissionService perm;

    public SysBackupController(DbBackupService backup, PanelPermissionService perm) {
        this.backup = backup;
        this.perm = perm;
    }

    /** 面板首屏:当前库名 + 设置 + 最近备份记录 + 是否正在备份。 */
    @GetMapping("/overview")
    public ApiResult<Map<String, Object>> overview() {
        perm.requireAdmin();
        return ApiResult.ok(backup.overview());
    }

    /** 保存设置:body {autoEnabled(布尔), autoTime('HH:mm'), keepFiles(整数), dir(绝对路径)}。 */
    @PostMapping("/save")
    public ApiResult<Map<String, Object>> save(@RequestBody(required = false) Map<String, Object> body) {
        perm.requireAdmin();
        return ApiResult.ok(backup.save(body == null ? Map.of() : body, currentUser()));
    }

    /** 立即备份(主动备份):返回本次留痕行 {status, filePath, fileSizeKb, elapsedMs, message, ...}。 */
    @PostMapping("/run")
    public ApiResult<Map<String, Object>> run() {
        perm.requireAdmin();
        return ApiResult.ok(backup.runNow(currentUser()));
    }

    /** 备份记录(新的在前,默认 20 条)。 */
    @GetMapping("/logs")
    public ApiResult<List<Map<String, Object>>> logs(@RequestParam(defaultValue = "20") int limit) {
        perm.requireAdmin();
        return ApiResult.ok(backup.logs(limit));
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}
