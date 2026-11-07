import {createInterface} from "node:readline/promises";
import {getDatabase} from "@/db/client";
import {ORIGINAL_OWNER_ID,passwordSchema,provisionAccount,resetAccount,usernameSchema} from "./core";

function hidden(question:string):Promise<string>{
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error("Use an interactive local terminal; passwords are never accepted in arguments or environment variables.");
  process.stdout.write(question);process.stdin.setEncoding("utf8");process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{let value="";const finish=()=>{process.stdin.off("data",read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write("\n");};const read=(chunk:string)=>{for(const character of chunk){if(character==="\u0003"){finish();reject(new Error("Cancelled"));return;}if(character==="\r"||character==="\n"){finish();resolve(value);return;}if(character==="\u007f"||character==="\b")value=Array.from(value).slice(0,-1).join("");else if(character>=" "&&value.length<257)value+=character;}};process.stdin.on("data",read);});
}
async function main(){
  const [command,...extra]=process.argv.slice(2);if(extra.length||!["owner","invite","reset","revoke","disable","revoke-all"].includes(command??""))throw new Error("Usage: npm run auth -- owner | invite | reset | revoke | disable | revoke-all");
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error("Run from a local interactive terminal.");
  const client=(await getDatabase()).$client;
  try{
    if(command==="revoke-all"){await client.execute("DELETE FROM auth_sessions");console.log("All sessions revoked.");return;}
    const rl=createInterface({input:process.stdin,output:process.stdout});let username:string;try{const input=await rl.question("Username (3–64 ASCII letters, digits, . _ -): ");const parsed=usernameSchema.safeParse(input);if(!parsed.success)throw new Error("Username must be 3–64 ASCII letters, digits, . _ or - and start with a letter or digit.");username=parsed.data;}finally{rl.close();}
    if(command==="owner"||command==="invite"||command==="reset"){
      if(command==="invite"&&!(await client.execute({sql:"SELECT id FROM auth_users WHERE id=? AND password_hash IS NOT NULL AND disabled=0",args:[ORIGINAL_OWNER_ID]})).rows.length)throw new Error("Initialize the original owner first.");
      const password=await hidden("Password (12–256 characters, hidden): "),again=await hidden("Repeat password (hidden): ");if(password!==again)throw new Error("Passwords differ.");if(!passwordSchema.safeParse(password).success)throw new Error("Password must be 12–256 characters and at most 1024 UTF-8 bytes. No account was changed; run the command again.");
      if(command==="reset")await resetAccount(client,username,password);else await provisionAccount(client,username,password,command==="owner");
      console.log("Account configured. Use the local sign-in page. No inventory was assigned to a new invitee.");
    }else{const user=(await client.execute({sql:"SELECT id,is_admin FROM auth_users WHERE username=?",args:[username]})).rows[0];if(!user)throw new Error("Account unavailable.");const tx=await client.transaction("write");try{await tx.execute({sql:"DELETE FROM auth_sessions WHERE user_id=?",args:[user.id]});if(command==="disable"){if(user.is_admin===1)throw new Error("Do not disable the installation owner; use reset or revoke.");await tx.execute({sql:"UPDATE auth_users SET disabled=1 WHERE id=?",args:[user.id]});}await tx.commit();}catch(error){await tx.rollback();throw error;}console.log("Sessions revoked; requested account change applied.");}
  }finally{client.close();}
}
main().catch(error=>{const message=error instanceof Error?error.message:"";console.error(/no such table: (auth_users|auth_sessions)/i.test(message)?"Authentication tables are missing; run npm run db:migrate first.":message&&!message.startsWith("[")?message:"Account operation failed. Check the input and local database, then retry.");process.exitCode=1;});
