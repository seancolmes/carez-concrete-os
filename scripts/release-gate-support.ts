import ts from 'typescript';

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
  const result:{kind:'relation'|'function';name:string;file:string;line:number}[]=[];
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

export function assertLocalUrl(value:string){
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)
    throw new Error('Release browser target must be loopback');
}
