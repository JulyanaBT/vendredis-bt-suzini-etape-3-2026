import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('automatic refresh preserves any dirty form, in-flight submit and open dialog',async()=>{
 const source=(await readFile(new URL('../assets/js/refresh.js',import.meta.url),'utf8')).replaceAll('export ','').replaceAll('import.meta.url',JSON.stringify('https://example.test/assets/js/refresh.js'));
 for(const mode of ['dirty','submitting','dialog']){
  const context=vm.createContext({URL,document:{querySelector:selector=>selector.includes('data-submitting')?(mode==='submitting'?{}:null):mode!=='submitting'?{}:null},navigator:{onLine:true},requestAnimationFrame:()=>{throw Error('refresh should be blocked');}});
  vm.runInContext(source,context);assert.equal(vm.runInContext('refreshPage({automatic:true})',context),false,mode);
 }
});

test('installation suggestion appears once per session, with temporary dismissal',async()=>{
 const source=await readFile(new URL('../assets/js/install.js',import.meta.url),'utf8');
 const session=new Map(),local=new Map();let banners=0,removed=0;const buttons={};
 const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)});
 const boot=()=>{
  const c=vm.createContext({URL,sessionStorage:storage(session),localStorage:storage(local),navigator:{userAgent:'',platform:''},matchMedia:()=>({matches:false,addEventListener(){}}),window:{addEventListener(){}},document:{body:{dataset:{space:'public'},append(){banners++;}},createElement:()=>({setAttribute(){},querySelector:selector=>({addEventListener:(_,fn)=>buttons[selector]=fn}),innerHTML:''}),querySelector:()=>({remove(){removed++;}}),addEventListener(){}}});
  vm.runInContext(source.replace('import.meta.url',JSON.stringify('https://example.test/assets/js/install.js')),c);return c;
 };
 boot();assert.equal(banners,1);buttons['.install-later']();assert.equal(removed,1);assert.equal(local.size,0);boot();assert.equal(banners,1);
});
