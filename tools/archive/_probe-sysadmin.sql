SELECT IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin, IS_SRVROLEMEMBER('dbcreator') AS is_dbcreator, SUSER_SNAME() AS who;
