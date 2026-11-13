import {it,expect} from 'vitest';
import {mkdtemp,writeFile,mkdir,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {command} from './process';
import {buildRelease,materialize} from './build';
it('reuses exact builds and refuses incompatible or unreceipted existing builds without replacing them',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'all-items-build-receipt-')),repository=path.join(root,'source'),releases=path.join(root,'releases');await mkdir(repository);const lock='{}';
  await writeFile(path.join(repository,'package-lock.json'),lock);await writeFile(path.join(repository,'.gitignore'),'.next/\n.all-items-release.json\n');await command('git',['init'],repository);await command('git',['add','.'],repository);await command('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-m','Synthetic fixture'],repository);
  const sha=await command('git',['rev-parse','HEAD'],repository),release=await materialize(repository,releases,sha);await mkdir(path.join(release,'.next'));await writeFile(path.join(release,'.next/BUILD_ID'),'preserved');
  await expect(buildRelease(repository,releases,sha)).rejects.toThrow('unreceipted');
  const receipt={sha,lock:createHash('sha256').update(lock).digest('hex'),node:'incompatible'};await writeFile(path.join(release,'.all-items-release.json'),JSON.stringify(receipt));await expect(buildRelease(repository,releases,sha)).rejects.toThrow('incompatible');
  await writeFile(path.join(release,'.all-items-release.json'),JSON.stringify({...receipt,node:process.versions.node.split('.')[0]}));await expect(buildRelease(repository,releases,sha)).resolves.toBe(release);expect(await readFile(path.join(release,'.next/BUILD_ID'),'utf8')).toBe('preserved');
});
