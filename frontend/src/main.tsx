import React from 'react'; import {createRoot} from 'react-dom/client'; import './style.css';
type Project={id:string;name:string;description:string;task_count:number;done_count:number}; type Task={id:string;title:string;description:string;status:'todo'|'in_progress'|'done';priority:'low'|'medium'|'high'};
const api=async(path:string,options:RequestInit={})=>{const token=localStorage.getItem('token');const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...options.headers}});if(!r.ok){const x=await r.json().catch(()=>({}));throw new Error(x.error||'Request failed');}return r.status===204?null:r.json();};
function App(){const [logged,setLogged]=React.useState(!!localStorage.getItem('token'));const [projects,setProjects]=React.useState<Project[]>([]);const [selected,setSelected]=React.useState<Project|null>(null);const [tasks,setTasks]=React.useState<Task[]>([]);const [error,setError]=React.useState('');const [deleting,setDeleting]=React.useState(false);
 const loadProjects=React.useCallback(async()=>{try{const p:Project[]=await api('/api/projects');setProjects(p);setSelected(current=>p.find(project=>project.id===current?.id)??p[0]??null);}catch(e){setError((e as Error).message);}},[]);
 React.useEffect(()=>{if(logged)loadProjects();},[logged,loadProjects]);
 React.useEffect(()=>{
  let cancelled=false;
  setTasks([]);
  if(selected)api(`/api/projects/${selected.id}/tasks`).then(data=>{if(!cancelled)setTasks(data);}).catch(e=>{if(!cancelled)setError(e.message);});
  return ()=>{cancelled=true;};
 },[selected]);
 const deleteProject=async()=>{
  if(!selected||deleting)return;
  const project=selected;
  if(!window.confirm(`Delete "${project.name}" and all its tasks? This cannot be undone.`))return;
  setDeleting(true);setError('');
  try{
   await api(`/api/projects/${project.id}`,{method:'DELETE'});
   const remaining=projects.filter(p=>p.id!==project.id);
   setProjects(remaining);
   setSelected(current=>current?.id===project.id?(remaining[0]??null):current);
  }catch(e){setError((e as Error).message);}
  finally{setDeleting(false);}
 };
 if(!logged)return <main className="login"><section><h1>TaskBoard</h1><p>Turn plans into shipped work.</p><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{const x=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});localStorage.setItem('token',x.token);setLogged(true);}catch(err){setError((err as Error).message);}}}><input name="email" type="email" defaultValue="demo@example.com"/><input name="password" type="password" defaultValue="password123"/><button>Sign in</button>{error&&<small>{error}</small>}</form></section></main>;
 const columns=[['todo','To do'],['in_progress','In progress'],['done','Done']] as const; return <><header><div><b>TaskBoard</b><span>Delivery workspace</span></div><button className="ghost" onClick={()=>{localStorage.removeItem('token');setLogged(false);}}>Sign out</button></header><div className="shell"><aside><h3>Projects</h3>{projects.map(p=><button className={selected?.id===p.id?'active':''} onClick={()=>setSelected(p)} key={p.id}><b>{p.name}</b><small>{p.done_count}/{p.task_count} complete</small></button>)}<form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);await api('/api/projects',{method:'POST',body:JSON.stringify({name:f.get('name')})});form.reset();loadProjects();}}><input name="name" placeholder="New project" required/><button>Add project</button></form></aside><main className="board">{error&&<p role="alert">{error}</p>}<div className="title"><div><h1>{selected?.name||'Your work'}</h1><p>{selected?.description}</p>{selected&&<button className="danger" disabled={deleting} onClick={deleteProject}>{deleting?'Deleting…':'Delete project'}</button>}</div><form onSubmit={async e=>{e.preventDefault();if(!selected)return;const form=e.currentTarget;const f=new FormData(form);await api(`/api/projects/${selected.id}/tasks`,{method:'POST',body:JSON.stringify({title:f.get('title'),priority:f.get('priority')})});form.reset();setTasks(await api(`/api/projects/${selected.id}/tasks`));}}><input name="title" placeholder="Add a task" required/><select name="priority"><option>low</option><option selected>medium</option><option>high</option></select><button>Add</button></form></div><div className="columns">{columns.map(([status,label])=><section key={status}><h2>{label}<span>{tasks.filter(t=>t.status===status).length}</span></h2>{tasks.filter(t=>t.status===status).map(t=><article key={t.id}><i className={t.priority}>{t.priority}</i><h3>{t.title}</h3><p>{t.description||'No description'}</p><select value={t.status} onChange={async e=>{const status=e.currentTarget.value as Task['status'];await api(`/api/tasks/${t.id}`,{method:'PATCH',body:JSON.stringify({status})});setTasks(tasks.map(x=>x.id===t.id?{...x,status}:x));}}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></article>)}</section>)}</div></main></div></>}
createRoot(document.getElementById('root')!).render(<App/>);
