package com.yinjia.mes;

import com.yinjia.mes.service.InvCostService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
public class MesApplication {

    public static void main(String[] args) {
        SpringApplication.run(MesApplication.class, args);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** 首次启动时若无用户则种子 admin/123456(BCrypt),与 light-mes 初始账号一致 */
    @Bean
    public ApplicationRunner adminSeeder(JdbcTemplate jdbc, PasswordEncoder encoder) {
        return args -> {
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM yj_user", Integer.class);
            if (count == null || count == 0) {
                jdbc.update("INSERT INTO yj_user (username, password_hash, real_name, is_admin) VALUES (?,?,?,?)",
                        "admin", encoder.encode("123456"), "系统管理员", "Y");
                System.out.println("[YINJIA-MES] 已种子初始账号 admin/123456");
            }
        };
    }

    /**
     * 启动自检库存移动加权成本物化表(inv_cost_ledger):与流水不一致则全量重算。
     * 必要性:审核钩子只覆盖走 ButtonService 的审核动作,而金蝶同步会把已审核单据直接写进
     * bl_(行表)与 bd_(头表) —— 这类旁路写入不触发钩子,成本会静默过期;启动自检兜住这种情况,
     * 同时让「迁移后尚未回填」的库自动补齐。失败不阻断启动(见 InvCostService#reconcileOnStartup)。
     */
    @Bean
    public ApplicationRunner invCostReconciler(InvCostService invCost) {
        return args -> invCost.reconcileOnStartup();
    }
}
