import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

// Generated identifiers do not make a pre-existing filesystem link safe.
export async function assertPrivatePath(root: string, full: string) {
  root=path.resolve(root); full=path.resolve(full);
  const relative=path.relative(root,full);
  if (!relative || relative===".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Invalid private destination");
  const stat=await lstat(root);
  if(stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Invalid private data directory");
  const actual=await realpath(root);
  const repository=await realpath(process.cwd());
  const fromRepository=path.relative(repository,actual);
  if(!fromRepository || !path.isAbsolute(fromRepository) && fromRepository!==".." && !fromRepository.startsWith(`..${path.sep}`)) throw new Error("Private storage must be outside the repository");
  let current=root;
  const parts=relative.split(path.sep);
  for(const [index,part] of parts.entries()) {
    current=path.join(current,part);
    try {
      const entry=await lstat(current);
      if(entry.isSymbolicLink() || index<parts.length-1 && !entry.isDirectory()) throw new Error("Unsafe private filesystem path");
    } catch(error) { if(error instanceof Error && "code" in error && error.code==="ENOENT") break; throw error; }
  }
}
