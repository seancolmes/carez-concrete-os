import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,copyFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,relative} from 'node:path';
import net from 'node:net';
import {assertTapPassed,assertLintPassed,databaseReferences} from './release-gate-support.ts';

const root=process.cwd();
const databaseOnly=process.argv.includes('--database-only');
const id=`carez-release-${Date.now()}-${randomUUID().slice(0,6)}`;
const workspace=join(homedir(),'Documents','Carez-Rehearsal','release-gate',id);
const results:{check:string;status:'PASS'|'FAIL';detail:string}[]=[];
mkdirSync(join(workspace,'supabase','migrations'),{recursive:true});
const reportPath=join(workspace,'report.json');
const pnpm=process.platform==='win32'?'pnpm.cmd':'pnpm';
function command(exe:string,args:string[],input?:string){
  // Resolve package-manager invocations through its JS entry point so paths
  // and arguments never pass through cmd.exe string interpolation.
  if(exe===pnpm&&process.env.npm_execpath){args=[process.env.npm_execpath,...args];exe=process.execPath;}
  const result=spawnSync(exe,args,{cwd:root,input,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout:15*60*1000});
  const output=(result.stdout??'')+(result.stderr??'');
  if(result.error||result.status!==0)throw new Error(`${exe} ${args.slice(0,3).join(' ')} failed (${result.status}): ${result.error?.message??output.slice(-10000)}`);
  return output;
}
function cli(args:string[]){return command(pnpm,['exec','supabase',...args,'--workdir',workspace]);}
function sql(query:string){return command('docker',['exec','-i',`supabase_db_${id}`,'psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],query);}
function phase(check:string,fn:()=>string|void){
  process.stdout.write(`${check}…\n`);
  try {const detail=fn()??'';results.push({check,status:'PASS',detail});console.log(`PASS ${check}`);return true;}
  catch(error){const detail=String(error);results.push({check,status:'FAIL',detail});console.error(`FAIL ${check}: ${detail}`);return false;}
}
async function freePorts(count:number){
  const servers:net.Server[]=[];
  try{
    for(let i=0;i<count;i++){
      const server=net.createServer();
      await new Promise<void>((accept,reject)=>{server.once('error',reject);server.listen(0,'0.0.0.0',()=>accept());});
      servers.push(server);
    }
    return servers.map(s=>(s.address() as net.AddressInfo).port);
  }finally{await Promise.all(servers.map(s=>new Promise<void>(done=>s.close(()=>done()))));}
}
function files(directory:string):string[]{return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(directory,entry.name)):[join(directory,entry.name)]);}
function digest(path:string){return createHash('sha256').update(readFileSync(path)).digest('hex');}
function sourceManifest(){
  const paths=command('git',['ls-files','--cached','--others','--exclude-standard','-z','--','app','components','lib','scripts','tests','supabase/migrations','public','package.json','pnpm-lock.yaml','tsconfig.json','next.config.ts','next.config.mjs','postcss.config.mjs']).split('\0').filter(Boolean);
  return Object.fromEntries([...new Set(paths)].sort().map(path=>[path,digest(join(root,path))]));
}
const before=sourceManifest();
const head=command('git',['rev-parse','HEAD']).trim();
const branch=command('git',['branch','--show-current']).trim();
writeFileSync(join(workspace,'source-sha256.json'),JSON.stringify({head,branch,files:before},null,2));
writeFileSync(join(workspace,'README.md'),`# Disposable Carez release rehearsal\n\nOwner: FINAL-2026-09-26. Non-canonical local test evidence.\nSource: ${root}\nHEAD: ${head}\nNo production data or provider configuration is copied. Generated credentials are local-only.\nPreserve failed runs for diagnosis; cleanup requires explicit selection of this run.\nCanonical workflow: docs/workflow/RELEASE_GATE.md.\n`);
let started=false;
try{
  if(branch!=='staging')throw new Error(`Expected staging; found ${branch}`);
  const [api,db,shadow,smtp]=await freePorts(4);
  writeFileSync(join(workspace,'supabase','config.toml'),`project_id = "${id}"
[api]
enabled = true
port = ${api}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = ${db}
shadow_port = ${shadow}
major_version = 17
[db.seed]
enabled = false
[studio]
enabled = false
[local_smtp]
enabled = false
port = ${smtp}
[analytics]
enabled = false
[realtime]
enabled = false
[storage]
enabled = true
[edge_runtime]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
[auth.email]
enable_confirmations = false
`);
  const migrations=files(join(root,'supabase','migrations')).filter(f=>f.endsWith('.sql')).sort();
  for(const source of migrations) copyFileSync(source,join(workspace,'supabase','migrations',relative(join(root,'supabase','migrations'),source)));
  started=phase('fresh migration replay',()=>{
    cli(['start']);
    for(const source of migrations)if(digest(source)!==digest(join(workspace,'supabase','migrations',relative(join(root,'supabase','migrations'),source))))throw new Error(`Migration copy changed: ${source}`);
    const versions=sql('select version from supabase_migrations.schema_migrations order by version;').trim().split(/\r?\n/);
    if(JSON.stringify(versions)!==JSON.stringify(migrations.map(f=>f.split(/[\\/]/).at(-1)!.split('_')[0])))throw new Error('Migration ledger differs from source');
    return `${migrations.length} migrations; identical source/copy hashes`;
  });
  if(started){
    for(const fixture of files(join(root,'tests','fixtures')).filter(f=>f.endsWith('-runtime.sql'))){
      phase(`SQL ${relative(root,fixture)}`,()=>{const output=sql(readFileSync(fixture,'utf8'));writeFileSync(join(workspace,relative(root,fixture).replace(/[\\/]/g,'_')+'.log'),output);assertTapPassed(output);return 'Runtime transaction and pgTAP passed';});
    }
    phase('source database dependencies',()=>{
      const refs=['app','components','lib'].flatMap(dir=>files(join(root,dir))).filter(f=>/\.tsx?$/.test(f)).flatMap(f=>databaseReferences(readFileSync(f,'utf8'),relative(root,f)));
      const relations=new Set(sql("select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public';").trim().split(/\r?\n/));
      const functions=new Set(sql("select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public';").trim().split(/\r?\n/));
      const missing=refs.filter(ref=>!(ref.kind==='relation'?relations:functions).has(ref.name));
      writeFileSync(join(workspace,'database-dependencies.json'),JSON.stringify({references:refs,missing},null,2));
      if(missing.length)throw new Error(`${new Set(missing.map(ref=>ref.kind+':'+ref.name)).size} missing objects across ${missing.length} references; see database-dependencies.json`);
      return `${refs.length} literal database references resolve in fresh source schema`;
    });
    phase('schema security',()=>{
      const output=sql(readFileSync(join(root,'tests','fixtures','release-security.sql'),'utf8'));
      writeFileSync(join(workspace,'security.log'),output);assertTapPassed(output);
    });
    phase('schema lint',()=>assertLintPassed(cli(['db','lint','--local','--level','error'])));
  }
  if(!databaseOnly){
    phase('full tests',()=>{const output=command(pnpm,['test']);writeFileSync(join(workspace,'tests.log'),output);return output.slice(-650);});
    phase('typecheck',()=>{command(pnpm,['typecheck']);});
    phase('production build',()=>{const output=command(pnpm,['build']);writeFileSync(join(workspace,'build.log'),output);});
  }
  phase('diff whitespace',()=>{command('git',['diff','--check']);command('git',['diff','--cached','--check']);});
  phase('exact source unchanged',()=>{if(JSON.stringify(before)!==JSON.stringify(sourceManifest()))throw new Error('Source changed while validating; rerun on a stable source tree');});
  // A browser evidence producer must bind its result to this exact manifest.
  // Never turn an absent browser check into an overall PASS.
  if(!databaseOnly)phase('browser acceptance',()=>{throw new Error('Authenticated representative browser acceptance not yet automated; local V1 release remains held.');});
}catch(error){results.push({check:'harness',status:'FAIL',detail:String(error)});}
finally{
  // Stop only this newly-created, uniquely named project. Preserve its volume
  // and evidence for diagnosis; never reset or reuse another rehearsal.
  phase('isolated stack shutdown',()=>{cli(['stop']);});
  const report={head,branch,workspace,scope:databaseOnly?'database diagnostic only':'release',sourceHash:createHash('sha256').update(JSON.stringify(before)).digest('hex'),result:results.every(r=>r.status==='PASS')?'PASS':'FAIL',checks:results};
  writeFileSync(reportPath,JSON.stringify(report,null,2));
  console.log(`Carez ${report.scope}: ${report.result}\nReport: ${reportPath}`);
  process.exitCode=report.result==='PASS'?0:1;
}
