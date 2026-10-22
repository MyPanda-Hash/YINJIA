# sa 密码重置取证（2026-10-22）

用户口径：「能不能重置 sql 数据库的 sa 密码」→ 给了目标密码后**当场重置并验证**。

## 结论

- **能重置，且不用重启实例**（`ALTER LOGIN` 在线生效，MES 应用不受影响 —— 它连的是 `yinjia`）；
- 入口 = 本机 Windows 账号 `DESKTOP-JHUNFT6\Lenovo` 在实例里是 sysadmin，
  但**必须走 `-S .` / `-S localhost`**（集成认证 + 共享内存）；
  走 TCP `-S 127.0.0.1,1433 -E` 会报 **18452「该登录名来自不受信任的域」**（本机 WORKGROUP + 本地账号的已知现象）；
- 应用账号 `yinjia` **不是** sysadmin、没有 `ALTER ANY LOGIN` ⇒ 用仓库里的 JDBC 工具**改不了** sa。

## 实测证据

| 检查 | 结果 |
|---|---|
| `sqlcmd -S 127.0.0.1,1433 -E` | ❌ 18452 不受信任的域 |
| `sqlcmd -S . -E` | ✅ `DESKTOP-JHUNFT6\Lenovo`，`IS_SRVROLEMEMBER('sysadmin')=1` |
| JDBC(`yinjia`) 查 `SUSER_SNAME/IS_SRVROLEMEMBER` | `yinjia / 0`（无 sysadmin、无 securityadmin、无 ALTER ANY LOGIN） |
| `EXEC sp_helpsrvrolemember 'sysadmin'` | 只有 **`sa`** 一个成员 |
| `sys.server_principals` 里的登录 | 仅 `sa` / `yinjia` / `mes_app`，**没有任何 Windows 登录** |
| 服务账户 | `NT Service\MSSQLSERVER`（非 LocalSystem） |
| 认证模式 | 混合（`IsIntegratedSecurityOnly = 0`） |

## 做了什么

```powershell
# 以本机 sysadmin 身份（集成认证，注意 -S .）
sqlcmd -S . -E -C -b -Q "ALTER LOGIN sa WITH PASSWORD = N'<新密码>';"
# exit=0（sa 开了 CHECK_POLICY=1，新密码过了本机策略，无需关策略）

# 验证（TCP + SQL 认证，与工具链同一条路）
java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" sa "<新密码>" archive\_sa-reset-20261022\_q-verify.sql
#   → sa | sysadmin=1 | 实例 DESKTOP-JHUNFT6 | 当前库 HSDZ_MES | 用户库 5
```

结果：`sa` 仍是启用状态、`is_policy_checked=1`、`modify_date` 更新为 2026-10-22 14:47；
`yinjia` 一行没动（`modify_date` 仍是 2026-08-31）。

> 密码本身**不写进仓库**（本文与探针文件里都是 `<新密码>` 占位）。
> 标准操作步骤已落进 `docs/development/环境与数据库.md`「SQL Server 的 sa 密码」一节。

## 文件

- `_q-sa-perm.sql` —— 权限探测（sysadmin? securityadmin? ALTER ANY LOGIN?）
- `_q-sysadmin.sql` —— sysadmin 成员 + 全部登录
- `_q-verify.sql` —— 改完后用 sa 登录验证（供文档里的命令直接复用）
