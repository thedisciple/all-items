import {z} from 'zod';
import {readPrivateJson} from './state';
const fixtureSchema=z.object({users:z.array(z.object({username:z.string().min(3).max(64),password:z.string().min(12).max(256),inventory:z.uuid(),item:z.uuid(),media:z.uuid()}).strict()).length(2)}).strict();
export async function readAcceptanceFixture(file:string){
  const fixture=fixtureSchema.parse(await readPrivateJson(file)),[first,second]=fixture.users;
  if(first!.username===second!.username||first!.inventory===second!.inventory)throw new Error('Two independent synthetic users required');
  return fixture;
}
