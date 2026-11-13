import {it,expect} from "vitest";
import {GET} from "@/app/api/health/route";
it('reports only a validated runtime revision and never assumes checkout HEAD or leaks runtime secrets',async()=>{
  const previous=process.env.ALL_ITEMS_RELEASE_SHA;
  try{delete process.env.ALL_ITEMS_RELEASE_SHA;expect(await GET().json()).toMatchObject({status:'ok',revision:null});process.env.ALL_ITEMS_RELEASE_SHA='a'.repeat(40);const response=GET();expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual({status:'ok',version:'0.1.0',revision:'a'.repeat(40)});process.env.ALL_ITEMS_RELEASE_SHA='invalid';expect((await GET().json()).revision).toBeNull();}finally{if(previous===undefined)delete process.env.ALL_ITEMS_RELEASE_SHA;else process.env.ALL_ITEMS_RELEASE_SHA=previous;}
});
