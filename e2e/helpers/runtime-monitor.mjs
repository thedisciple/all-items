import {IncomingMessage} from 'node:http';
// Test-only observations. No exception is consumed and no error handler is replaced.
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const file=process.env.ALL_ITEMS_RUNTIME_DIAGNOSTICS;
if(file){
  const relative=path.relative(os.tmpdir(),file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!path.basename(file).startsWith('all-items-'))throw new Error('Diagnostics must use isolated temporary storage');
  const record=value=>{try{appendFileSync(file,JSON.stringify({at:Date.now(),pid:process.pid,...value})+'\n');}catch{/* Observation cannot change application behavior. */}};
  process.on('uncaughtExceptionMonitor',(error,origin)=>record({event:'uncaught',origin,code:typeof error?.code==='string'?error.code:null,frames:String(error?.stack??'').split('\n').slice(1,7).map(line=>line.replace(/[A-Za-z]:[^\s()]*/g,'<local-path>').replace(/\/[^\s()]*/g,'<module-path>'))}));
  const emit=IncomingMessage.prototype.emit;
  IncomingMessage.prototype.emit=function(event,...args){if(event==='aborted')record({event:'request-aborted'});return emit.call(this,event,...args);};
}
