import com.yinjia.mes.service.ScheduleBoardService;
import com.yinjia.mes.service.WorkOrderSplitService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.sql.*;
import java.util.*;

/** Real assign() integration regression, TEST ledger only; every fixture is rolled back. */
class _ScheduleQuantityRegression {
 public static void main(String[] args) throws Exception {
  String pass=System.getenv("YINJIA_SQL_PASS");
  try(Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true","yinjia",pass)) {
   c.setAutoCommit(false);
   try {
    JdbcTemplate j=new JdbcTemplate(new SingleConnectionDataSource(c,true));
    String line=j.queryForObject("SELECT TOP 1 生产线 FROM bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(停用,0)=0",String.class);
    for(int scenario=0;scenario<3;scenario++) {
     String no="QTY-REG-"+UUID.randomUUID().toString().substring(0,8);
     double previous=scenario==2?0:100;
     j.update("INSERT INTO plang(comm,pl_no,pl_xc,pl_sl,xq_sl,rk_sl,scx,ja,asp_cancel,[批次号],khdm) VALUES(N'YJ',?,1,?,100,0,N'',N'N',N'N',N'QTY-REG',N'LONG-CUSTOMER-CODE')",no,previous);
     Integer id=j.queryForObject("SELECT id FROM plang WHERE pl_no=?",Integer.class,no);
     Map<String,Object> row=new HashMap<>(Map.of("加工单号",no,"行id",id,"生产线",line));
     if(scenario==0)row.put("排产数量",60);
     new ScheduleBoardService(j).assign(List.of(row),"quantity-regression");
     double expected=scenario==0?60:100;
     Map<String,Object> actual=j.queryForMap("SELECT p.pl_sl AS order_qty,pc.pl_sl AS schedule_qty FROM plang p JOIN plang_pc pc ON pc.plang_id=p.id WHERE p.id=?",id);
     if(Math.abs(((Number)actual.get("order_qty")).doubleValue()-expected)>0.0001 || Math.abs(((Number)actual.get("schedule_qty")).doubleValue()-expected)>0.0001)
      throw new AssertionError("FAIL scenario="+scenario+" expected="+expected+" actual="+actual);
     System.out.println("PASS scenario="+scenario+" quantity="+expected);
     Integer pcId=j.queryForObject("SELECT id FROM plang_pc WHERE plang_id=?",Integer.class,id);
     WorkOrderSplitService split=new WorkOrderSplitService(j,null);
     Map<String,Object> child=split.split(Map.of("行id",id,"切出数量",20),"qty-regression");
     Number childId=(Number)child.get("子工单行id");
     double parentQty=j.queryForObject("SELECT pl_sl FROM plang_pc WHERE plang_id=?",Double.class,id);
     double childQty=j.queryForObject("SELECT pl_sl FROM plang_pc WHERE plang_id=?",Double.class,childId);
     if(Math.abs(parentQty-(expected-20))>0.0001 || childQty!=20)throw new AssertionError("split quantities not synchronized");
     split.unsplit(Map.of("行id",childId),"qty-regression");
     if(j.queryForObject("SELECT pl_sl FROM plang_pc WHERE plang_id=?",Double.class,id)!=expected
       || !pcId.equals(j.queryForObject("SELECT id FROM plang_pc WHERE plang_id=?",Integer.class,id)))
      throw new AssertionError("unsplit quantity or schedule identity changed");
     System.out.println("PASS split/unsplit scenario="+scenario+" stable schedule id="+pcId);
     // Historical multi-record schedules must not be overwritten by later writebacks.
     j.update("INSERT INTO plang_pc(comm,pl_no,pl_xc,plang_id,pl_sl,scx,asp_cancel) VALUES(N'YJ',?,1,?,40,?,N'N')",no,id,line);
     j.update("UPDATE plang_pc SET pl_sl=30 WHERE id=?",pcId);
     java.lang.reflect.Method sync=Class.forName("com.yinjia.mes.service.WorkOrderScheduleRecord").getDeclaredMethod("sync",JdbcTemplate.class,Object.class,String.class);
     sync.setAccessible(true); sync.invoke(null,j,id,"qty-regression");
     double historical=j.queryForObject("SELECT SUM(pl_sl) FROM plang_pc WHERE plang_id=?",Double.class,id);
     if(historical!=70)throw new AssertionError("historical split schedules overwritten: "+historical);
     System.out.println("PASS historical multi-record quantities preserved");
    }
   } finally { c.rollback(); System.out.println("TEST fixtures rolled back"); }
  }
 }
}
