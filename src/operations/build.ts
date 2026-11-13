import {mkdir,readFile,writeFile,access} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {command,npm} from "./process";
import {isolatedEnvironment,revision} from "./environment";
import {plainPath,within} from "./paths";

export async function materialize(repository:string,root:string,sha:string){
  revision.parse(sha);await plainPath(root);if(within(repository,root)||within(root,repository))throw new Error("Release storage must be outside source repository");
  await mkdir(root,{recursive:true});const release=path.join(root,sha);
  try{await access(release);}catch{await command("git",["worktree","add","--detach",release,sha],repository);}
  if(await command("git",["rev-parse","HEAD"],release)!==sha||await command("git",["status","--porcelain","--untracked-files=normal"],release))throw new Error("Release checkout is not the requested clean commit");
  return release;
}
export async function buildRelease(repository:string,root:string,sha:string){
  const release=await materialize(repository,root,sha),lock=createHash('sha256').update(await readFile(path.join(release,"package-lock.json"))).digest('hex');
  const receipt=path.join(release,".all-items-release.json");
  try{const previous=JSON.parse(await readFile(receipt,"utf8"));if(previous.sha===sha&&previous.lock===lock&&previous.node===process.versions.node.split('.')[0]){await access(path.join(release,".next/BUILD_ID"));return release;}}catch{/* A missing or incompatible build is rebuilt in the isolated release only. */}
  const env:NodeJS.ProcessEnv={...isolatedEnvironment(path.join(root,"build-unused-data"),"http://127.0.0.1:3200",sha),NODE_ENV:'production'};await npm(release,["ci","--include=dev"],env);await npm(release,["run","build"],env);
  await writeFile(receipt,JSON.stringify({sha,lock,node:process.versions.node.split('.')[0],builtAt:new Date().toISOString()}),{mode:0o600});return release;
}
