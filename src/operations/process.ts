import {execFile,spawn} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {access} from "node:fs/promises";

export async function command(file:string,args:string[],cwd:string,env:NodeJS.ProcessEnv=process.env){
  try{return(await promisify(execFile)(file,args,{cwd,env,windowsHide:true,timeout:15*60_000,maxBuffer:16*1024**2})).stdout.trim();}
  catch{throw new Error(`Operational command failed: ${path.basename(file)} ${args[0]??""}; private output was not logged`);}
}
export async function npm(cwd:string,args:string[],env:NodeJS.ProcessEnv){
  const candidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),"node_modules/npm/bin/npm-cli.js"),"/usr/share/nodejs/npm/bin/npm-cli.js"].filter((value):value is string=>Boolean(value));
  for(const candidate of candidates){try{await access(candidate);}catch{continue;}return command(process.execPath,[candidate,...args],cwd,env);}
  throw new Error("Cannot locate npm CLI; start through npm run preview or npm run beta");
}
export function serve(cwd:string,args:string[],env:NodeJS.ProcessEnv){
  const child=spawn(process.execPath,args,{cwd,env,windowsHide:true,stdio:"inherit"});for(const signal of["SIGINT","SIGTERM"] as const)process.once(signal,()=>child.kill());child.once("exit",code=>{process.exitCode=code??1;});return child;
}
