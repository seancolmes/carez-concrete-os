import ts from 'typescript';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {sourceAuthorityFor, assertSourceAuthorityManifest, isReleaseBlockingSourceClass} from './source-authority-manifest.ts';
import type {DatabaseObjectKind, SourceAuthorityEntry} from './source-authority-manifest.ts';

export function assertTapPassed(output:string){
  if (/^not ok\b|^Bail out!/m.test(output)) throw new Error(`pgTAP failed:\n${output}`);
  const plan=output.match(/^1\.\.(\d+)\s*$/m);
  if(!plan) throw new Error('pgTAP plan missing');
  const count=[...output.matchAll(/^ok \d+\b/gm)].length;
  if(count!==Number(plan[1])) throw new Error(`pgTAP incomplete: ${count}/${plan[1]}`);
}

export function assertLintPassed(output:string){
  if(/No schema errors found/i.test(output)) return;
  // CLI versions emit either an array or a log envelope, sometimes on stderr.
  const line=output.split(/\r?\n/).find(line=>line.trim().startsWith('{')||line.trim().startsWith('['));
  if(!line) throw new Error('SQL lint returned unrecognized output');
  let parsed:any;
  try { parsed=JSON.parse(output.slice(output.indexOf(line)).trim()); }
  catch { try {parsed=JSON.parse(line);} catch {throw new Error('SQL lint returned unrecognized output');} }
  const results=Array.isArray(parsed)?parsed:parsed.results;
  if(!Array.isArray(results)) throw new Error('SQL lint returned unrecognized results');
  const errors=results.filter((r:any)=>(r.issues??[]).some((i:any)=>i.level==='error'));
  if(errors.length) throw new Error(`SQL lint failed: ${JSON.stringify(errors)}`);
}

export function databaseReferences(source:string,file:string){
  const result:{kind:DatabaseObjectKind;name:string;file:string;line:number}[]=[];
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function visit(node:ts.Node){
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
      const method=node.expression.name.text;
      const receiver=node.expression.expression.getText(tree);
      const arg=node.arguments[0];
      if((method==='from'||method==='rpc')&&arg&&ts.isStringLiteralLike(arg)&&receiver!=='Array'&&!/\.storage\b/.test(receiver)){
        result.push({kind:method==='from'?'relation':'function',name:arg.text,file,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1});
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);
  return result;
}

export function migrationObjectOwners(migrationsDirectory:string){
  const owners=new Map<string,string[]>();
  for(const file of readdirSync(migrationsDirectory).filter(name=>name.endsWith('.sql')).sort()){
    const source=readFileSync(join(migrationsDirectory,file),'utf8');
    const patterns:[DatabaseObjectKind,RegExp][]=[
      ['relation',/create\s+(?:or\s+replace\s+)?(?:table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi],
      ['function',/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_][a-z0-9_]*)/gi],
    ];
    for(const [kind,pattern] of patterns){
      for(const match of source.matchAll(pattern)){
        const key=`${kind}:${match[1]}`;
        owners.set(key,[...(owners.get(key)??[]),file]);
      }
    }
  }
  return owners;
}

export type ClassifiedDatabaseReference = {
  kind: DatabaseObjectKind;
  name: string;
  file: string;
  line: number;
  classification?: SourceAuthorityEntry['classification'];
  reason?: string;
  owners: string[];
};

export function classifyMissingDatabaseReferences(
  references:{kind:DatabaseObjectKind;name:string;file:string;line:number}[],
  existing:Set<string>,
  owners:Map<string,string[]>,
): ClassifiedDatabaseReference[] {
  const missing=references.filter(reference => !existing.has(reference.name));
  assertSourceAuthorityManifest(missing);
  return missing.map(reference => {
    const authority=sourceAuthorityFor(reference.kind,reference.name)!;
    return {...reference,classification:authority.classification,reason:authority.reason,owners:owners.get(`${reference.kind}:${reference.name}`)??[]};
  });
}

export function releaseBlockingDatabaseReferences(missing:ClassifiedDatabaseReference[]) {
  return missing.filter(reference => reference.classification && isReleaseBlockingSourceClass(reference.classification));
}

export function assertLocalUrl(value:string){
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)
    throw new Error('Release browser target must be loopback');
}
