import {test,expect} from '@playwright/test';
import {request as httpRequest} from 'node:http';
import {appendFile} from 'node:fs/promises';

test('bounded production cancellation diagnostic preserves responsiveness and settled requests',async({page,context,request})=>{
  test.setTimeout(90_000);const diagnostics=process.env.ALL_ITEMS_RUNTIME_DIAGNOSTICS;
  const mark=async(phase:string)=>{if(diagnostics)await appendFile(diagnostics,JSON.stringify({at:Date.now(),event:'phase',phase})+'\n');};
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
  await mark('settled-baseline');
  for(let index=0;index<10;index++){const response=await request.get('/account');expect(response.status()).toBe(200);}
  await page.goto('/account');const accountText=await page.locator('h1').textContent();
  const cookie=(await context.cookies()).map(value=>`${value.name}=${value.value}`).join('; ');
  await mark('deliberate-client-disconnect');
  for(let index=0;index<16;index++)await new Promise<void>(resolve=>{
    const req=httpRequest('http://127.0.0.1:3100/account',{headers:{cookie,RSC:'1'}},response=>response.resume());
    req.on('error',error=>{if(!['ECONNRESET','ABORT_ERR'].includes((error as NodeJS.ErrnoException).code??''))errors.push(error.name);});req.on('close',resolve);req.end();setTimeout(()=>req.destroy(),index%4);
  });
  await mark('rapid-navigation');
  const canceled=(error:unknown)=>{if(!String(error).includes('ERR_ABORTED')&&!String(error).includes('interrupted'))throw error;};
  for(let index=0;index<8;index++){const navigation=page.goto(index%2?'/account':'/').catch(canceled);await page.waitForTimeout(5);await page.goto('/account').catch(canceled);await navigation;}
  await mark('settled-recovery');
  for(let index=0;index<10;index++)expect((await request.get('/api/health')).status()).toBe(200);
  await page.goto('/account');expect(await page.locator('h1').textContent()).toBe(accountText);expect(errors).toEqual([]);await mark('complete');
});
