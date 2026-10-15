using System;using System.Net;using System.Text;
class P{static void Main(){
 var req=(HttpWebRequest)WebRequest.Create("http://127.0.0.1:8090/api/auth/login");
 req.Method="POST";req.ContentType="application/json";
 var b=Encoding.UTF8.GetBytes("{\"account\":\"admin\",\"password\":\"123456\",\"db\":\"HSDZ_MES\"}");
 using(var s=req.GetRequestStream())s.Write(b,0,b.Length);
 try{var r=(HttpWebResponse)req.GetResponse();Console.WriteLine(r.StatusCode);Console.WriteLine(new System.IO.StreamReader(r.GetResponseStream()).ReadToEnd());}
 catch(WebException e){var r=(HttpWebResponse)e.Response;Console.WriteLine("HTTP "+(int)r.StatusCode);Console.WriteLine(new System.IO.StreamReader(r.GetResponseStream()).ReadToEnd());}
}}
