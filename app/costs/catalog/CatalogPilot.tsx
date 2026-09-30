'use client';

import {useMemo,useState} from 'react';

import {Refine,useCreate,useList,useUpdate,type DataProvider,type HttpError} from '@refinedev/core';

import {Button,Checkbox,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,Input,Label,Select} from '@fluentui/react-components';



type Code={id:string;code:string;name:string};

type Category={id:string;name:string};

type Item={id:string;name:string;description:string|null;default_unit:string;default_unit_cost:number|null;cost_code_id:string;category_id:string|null;vendor_name:string|null;sku:string|null;active:boolean;cost_codes?:{code:string;name:string}|null};

type Values=Omit<Item,'id'|'cost_codes'>;

const endpoint='/api/cost-catalog';

async function request(method:'GET'|'POST'|'PATCH',url:string,body?:unknown){

  const response=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,credentials:'same-origin'});

  const result=await response.json().catch(()=>({error:'Request failed'}));

  if(!response.ok)throw Object.assign(new Error(result.error||'Request failed'),{statusCode:response.status});

  return result;

}

const unsupported=async()=>{throw new Error('This pilot supports catalog listing, creation and editing only.');};

const dataProvider:DataProvider={

  getApiUrl:()=>endpoint,

  getList:async({resource,pagination,sorters,filters})=>{

    if(resource==='cost-catalog-categories')return request('GET','/api/cost-catalog/categories');

    if(resource!=='cost-catalog')throw new Error('Unknown resource');

    const params=new URLSearchParams({page:String(pagination?.currentPage||1),size:String(pagination?.pageSize||20)});

    if(sorters?.[0]?.order)params.set('order',sorters[0].order);

    const search=filters?.find(filter=>'field' in filter&&filter.field==='name');if(search?.value)params.set('search',String(search.value));

    const category=filters?.find(filter=>'field' in filter&&filter.field==='category_id');if(category?.value)params.set('category',String(category.value));

    return request('GET',`${endpoint}?${params}`);

  },

  getOne:unsupported,getMany:unsupported,

  create:async({resource,variables})=>{if(resource==='cost-catalog-categories')return request('POST','/api/cost-catalog/categories',variables);if(resource!=='cost-catalog')throw new Error('Unknown resource');return request('POST',endpoint,variables);},

  update:async({resource,id,variables})=>{if(resource!=='cost-catalog')throw new Error('Unknown resource');return request('PATCH',endpoint,{...variables,id});},

  deleteOne:unsupported,

};

const currency=(value:number|null)=>value==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);



export function CatalogPilot({codes}:{codes:Code[]}){

  return <Refine dataProvider={dataProvider} resources={[{name:'cost-catalog'},{name:'cost-catalog-categories'}]} options={{syncWithLocation:false,disableTelemetry:true}}><CatalogWorkspace codes={codes}/></Refine>;

}



function CatalogWorkspace({codes}:{codes:Code[]}){

  const [search,setSearch]=useState('');const [order,setOrder]=useState<'asc'|'desc'>('asc');const [page,setPage]=useState(1);const [categoryFilter,setCategoryFilter]=useState('');const [categoryDialog,setCategoryDialog]=useState(false);const [categoryError,setCategoryError]=useState('');

  const [editing,setEditing]=useState<Item|null|undefined>(undefined);const [error,setError]=useState('');

  const filters=useMemo(()=>[{field:'name',operator:'contains' as const,value:search},{field:'category_id',operator:'eq' as const,value:categoryFilter}], [search,categoryFilter]);

  const {result:categoryResult,query:categoryQuery}=useList<Category,HttpError>({resource:'cost-catalog-categories',pagination:{mode:'off'}});

  const {result,query}=useList<Item,HttpError>({resource:'cost-catalog',pagination:{currentPage:page,pageSize:20},sorters:[{field:'name',order}],filters});

  const {mutation:createMutation}=useCreate<Item,HttpError,Values>();

  const {mutation:updateMutation}=useUpdate<Item,HttpError,Values>();

  const {mutation:categoryMutation}=useCreate<Category,HttpError,{name:string}>();

  const categories=categoryResult.data||[];const categoryAvailable=!categoryQuery.isError;

  const categoryName=(id:string|null)=>categories.find(category=>category.id===id)?.name||'Uncategorized';

  const items=result.data||[];const total=result.total||0;const busy=createMutation.isPending||updateMutation.isPending;

  async function saveCategory(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setCategoryError('');const name=String(new FormData(event.currentTarget).get('name')||'').trim();try{await categoryMutation.mutateAsync({resource:'cost-catalog-categories',values:{name}});setCategoryDialog(false);categoryQuery.refetch();}catch(cause){setCategoryError(cause instanceof Error?cause.message:'Could not save category');}}

  async function save(event:React.FormEvent<HTMLFormElement>){

    event.preventDefault();if(busy)return;setError('');

    const form=new FormData(event.currentTarget);const rawCost=String(form.get('default_unit_cost')||'').trim();

    const values:Values={name:String(form.get('name')||'').trim(),description:String(form.get('description')||'').trim()||null,default_unit:String(form.get('default_unit')||'EA'),default_unit_cost:rawCost===''?null:Number(rawCost),cost_code_id:String(form.get('cost_code_id')||''),category_id:String(form.get('category_id')||'')||null,vendor_name:String(form.get('vendor_name')||'').trim()||null,sku:String(form.get('sku')||'').trim()||null,active:form.get('active')==='on'};

    try{if(editing)await updateMutation.mutateAsync({resource:'cost-catalog',id:editing.id,values});else await createMutation.mutateAsync({resource:'cost-catalog',values});setEditing(undefined);query.refetch();}

    catch(cause){setError(cause instanceof Error?cause.message:'Could not save the catalog item');}

  }

  return <section className="border border-border bg-card" aria-label="Cost catalog pilot">

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary px-3 py-2"><div><h2 className="text-base font-semibold">Catalog items</h2><p className="text-xs text-muted-foreground">{total} item{total===1?'':'s'} · company catalog</p></div><div className="flex gap-2"><Button appearance="secondary" size="small" onClick={()=>{setCategoryError('');setCategoryDialog(true);}} disabled={!categoryAvailable}>New category</Button><Button size="small" onClick={()=>{setError('');setEditing(null);}} disabled={codes.length===0}>New item</Button></div></div>

    {!categoryAvailable&&<p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Categories will be available after the local database migration is applied. Catalog items remain accessible.</p>}{codes.length===0&&<p className="border-b border-border px-3 py-3 text-sm text-warning">Add an active cost code before creating catalog items.</p>}

    <div className="flex flex-wrap gap-2 border-b border-border p-3"><Input appearance="underline" className="max-w-sm" aria-label="Search catalog items" placeholder="Search catalog items" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/><Select aria-label="Sort catalog items" className="h-9 border border-input bg-background px-2 text-sm" value={order} onChange={event=>{setOrder(event.target.value as 'asc'|'desc');setPage(1);}}><option value="asc">Name A–Z</option><option value="desc">Name Z–A</option></Select><Select aria-label="Filter catalog by category" className="h-9 border border-input bg-background px-2 text-sm" value={categoryFilter} disabled={!categoryAvailable} onChange={event=>{setCategoryFilter(event.target.value);setPage(1);}}><option value="">All categories</option><option value="uncategorized">Uncategorized</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</Select></div>

    {query.isLoading?<p className="px-3 py-6 text-sm text-muted-foreground">Loading catalog…</p>:query.isError?<div className="flex items-center gap-3 px-3 py-6 text-sm text-destructive">Catalog could not be loaded. <Button appearance="secondary" size="small" onClick={()=>query.refetch()}>Retry</Button></div>:items.length===0?<p className="px-3 py-6 text-sm text-muted-foreground">{search||categoryFilter?'No matching catalog items.':'No catalog items yet.'}</p>:<><div className="md:hidden">{items.map(item=><div className="border-b border-border px-3 py-3" key={item.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><span className="text-xs text-muted-foreground">{categoryName(item.category_id)} · {item.cost_codes?.code||codes.find(code=>code.id===item.cost_code_id)?.code||'—'} · {item.default_unit}{item.vendor_name?` · ${item.vendor_name}`:''}</span></div><strong className="shrink-0 font-mono text-sm tabular-nums">{currency(item.default_unit_cost)}</strong></div><div className="mt-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">{item.active?'Active':'Inactive'}</span><Button appearance="secondary" size="small" onClick={()=>{setError('');setEditing(item);}}>View / Edit</Button></div></div>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[670px] text-left text-sm"><thead className="bg-secondary text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Category</th><th className="px-3 py-2 font-semibold">Cost code</th><th className="px-3 py-2 font-semibold">Unit</th><th className="px-3 py-2 text-right font-semibold">Default cost</th><th className="px-3 py-2 font-semibold">State</th><th className="px-3 py-2 text-right font-semibold">Action</th></tr></thead><tbody>{items.map(item=><tr className="border-t border-border" key={item.id}><td className="px-3 py-2"><strong className="font-medium">{item.name}</strong>{item.vendor_name&&<span className="block text-xs text-muted-foreground">{item.vendor_name}</span>}</td><td className="px-3 py-2 text-muted-foreground">{categoryName(item.category_id)}</td><td className="px-3 py-2 text-muted-foreground">{item.cost_codes?.code||codes.find(code=>code.id===item.cost_code_id)?.code||'—'}</td><td className="px-3 py-2">{item.default_unit}</td><td className="px-3 py-2 text-right font-mono tabular-nums">{currency(item.default_unit_cost)}</td><td className="px-3 py-2">{item.active?'Active':'Inactive'}</td><td className="px-3 py-2 text-right"><Button appearance="secondary" size="small" onClick={()=>{setError('');setEditing(item);}}>View / Edit</Button></td></tr>)}</tbody></table></div></>}

    <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground"><span>{total?`${(page-1)*20+1}–${Math.min(page*20,total)} of ${total}`:'0 items'}</span><div className="flex gap-2"><Button size="small" appearance="secondary" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</Button><Button size="small" appearance="secondary" disabled={page*20>=total} onClick={()=>setPage(page+1)}>Next</Button></div></div>

    <Dialog open={editing!==undefined} onOpenChange={(_event,data)=>{if(!data.open&&!busy)setEditing(undefined);}}><DialogSurface className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogBody><DialogTitle>{editing?'Catalog item':'New catalog item'}</DialogTitle><DialogContent>Set the company default for future cost entries. Existing job costs keep their recorded values.</DialogContent></DialogBody><form className="grid gap-3" onSubmit={save} key={editing?.id||'new'}><div className="grid gap-2"><Label htmlFor="catalog-name">Item name</Label><Input appearance="underline" id="catalog-name" name="name" required defaultValue={editing?.name||''}/></div><div className="grid gap-2"><Label htmlFor="catalog-category">Category</Label><Select id="catalog-category" name="category_id" defaultValue={editing?.category_id||''} disabled={!categoryAvailable} className="h-9 border border-input bg-background px-2 text-sm"><option value="">Uncategorized</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</Select></div><div className="grid gap-2"><Label htmlFor="catalog-code">Cost code</Label><Select id="catalog-code" name="cost_code_id" required defaultValue={editing?.cost_code_id||''} className="h-9 border border-input bg-background px-2 text-sm"><option value="" disabled>Choose cost code</option>{codes.map(code=><option key={code.id} value={code.id}>{code.code} · {code.name}</option>)}</Select></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="catalog-unit">Unit</Label><Input appearance="underline" id="catalog-unit" name="default_unit" required defaultValue={editing?.default_unit||'EA'}/></div><div className="grid gap-2"><Label htmlFor="catalog-cost">Default unit cost</Label><Input appearance="underline" id="catalog-cost" name="default_unit_cost" type="number" min="0" step="0.0001" defaultValue={editing?.default_unit_cost==null?'':String(editing.default_unit_cost)}/></div></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="catalog-vendor">Vendor</Label><Input appearance="underline" id="catalog-vendor" name="vendor_name" defaultValue={editing?.vendor_name||''}/></div><div className="grid gap-2"><Label htmlFor="catalog-sku">SKU</Label><Input appearance="underline" id="catalog-sku" name="sku" defaultValue={editing?.sku||''}/></div></div><div className="grid gap-2"><Label htmlFor="catalog-description">Description</Label><Input appearance="underline" id="catalog-description" name="description" defaultValue={editing?.description||''}/></div><Checkbox name="active" defaultChecked={editing?.active??true} label="Active for new selections"/>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" appearance="secondary" onClick={()=>setEditing(undefined)} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':'Save item'}</Button></div></form></DialogSurface></Dialog>

    <Dialog open={categoryDialog} onOpenChange={(_event,data)=>{if(!data.open&&!categoryMutation.isPending)setCategoryDialog(false);}}><DialogSurface className="sm:max-w-md"><DialogBody><DialogTitle>New category</DialogTitle><DialogContent>Group company catalog items for faster browsing. Existing items stay uncategorized until assigned.</DialogContent></DialogBody><form className="grid gap-3" onSubmit={saveCategory}><div className="grid gap-2"><Label htmlFor="category-name">Category name</Label><Input appearance="underline" id="category-name" name="name" maxLength={80} required autoFocus/></div>{categoryError&&<p role="alert" className="text-sm text-destructive">{categoryError}</p>}<div className="flex justify-end gap-2"><Button type="button" appearance="secondary" onClick={()=>setCategoryDialog(false)} disabled={categoryMutation.isPending}>Cancel</Button><Button type="submit" disabled={categoryMutation.isPending}>{categoryMutation.isPending?'Saving...':'Create category'}</Button></div></form></DialogSurface></Dialog>

  </section>;

}

