import {test,expect} from './helpers/browser-reliability';
test('minimal version probe retains exact-origin protection and exposes no inventory or identity fields',async({request})=>{
  const response=await request.get('/api/health');expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');const body=await response.json();expect(Object.keys(body).sort()).toEqual(['revision','status','version']);expect(body.status).toBe('ok');expect(body.revision).toBe(process.env.ALL_ITEMS_E2E_SHA||null);
  expect((await request.get('/api/health',{headers:{'x-forwarded-host':'attacker.invalid'}})).status()).toBe(403);expect((await request.post('/api/health',{headers:{origin:'https://attacker.invalid'}})).status()).toBe(403);
});
