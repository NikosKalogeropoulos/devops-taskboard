import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import type {NextFunction,Request,Response} from 'express';
import type {Server} from 'node:http';
vi.mock('pino-http',()=>({pinoHttp:()=> (_req:Request,_res:Response,next:NextFunction)=>next()}));
vi.mock('../src/db.js',()=>({pool:{query:vi.fn()}}));
process.env.DATABASE_URL='postgres://test';
process.env.JWT_SECRET='1234567890123456';
const {app}=await import('../src/app.js');
const {pool}=await import('../src/db.js');
const {signToken}=await import('../src/auth.js');
const projectId='22222222-2222-4222-8222-222222222222';
const ownerId='11111111-1111-4111-8111-111111111111';
let server:Server;
let base:string;
beforeAll(async()=>{
 server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const address=server.address();
 if(!address||typeof address==='string')throw new Error('Missing server address');
 base=`http://127.0.0.1:${address.port}`;
});
afterAll(()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())));
beforeEach(()=>{vi.mocked(pool.query).mockReset();});
const remove=(id=projectId, user:string|null=ownerId)=>fetch(`${base}/api/projects/${id}`,{
 method:'DELETE',headers:user?{Authorization:`Bearer ${signToken(user)}`}:{},
});
describe('project deletion',()=>{
 it('requires authentication',async()=>{
  expect((await remove(projectId,null)).status).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
 });
 it('deletes only a project owned by the signed-in user',async()=>{
  vi.mocked(pool.query).mockImplementation(async()=>({rowCount:1}) as never);
  const response=await remove();
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(pool.query).toHaveBeenCalledWith('DELETE FROM projects WHERE id=$1 AND owner_id=$2',[projectId,ownerId]);
 });
 it('returns 404 when no owned project matches',async()=>{
  vi.mocked(pool.query).mockImplementation(async()=>({rowCount:0}) as never);
  const response=await remove();
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({error:'Project not found'});
 });
 it('accepts existing seed project IDs',async()=>{
  vi.mocked(pool.query).mockImplementation(async()=>({rowCount:1}) as never);
  expect((await remove('22222222-2222-2222-2222-222222222222')).status).toBe(204);
 });
 it('rejects malformed IDs before querying the database',async()=>{
  expect((await remove('invalid')).status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
 });
 it('reports database errors',async()=>{
  vi.mocked(pool.query).mockRejectedValue(new Error('Unavailable'));
  expect((await remove()).status).toBe(500);
 });
});

describe('task updates',()=>{
 it('preserves priority and description when only status changes',async()=>{
  const task={id:projectId,title:'Verify task workflow',description:'Keep this note',status:'todo',priority:'high',due_date:null};
  vi.mocked(pool.query).mockImplementationOnce(async()=>({rowCount:1,rows:[task]}) as never);
  vi.mocked(pool.query).mockImplementationOnce(async()=>({rowCount:1,rows:[{...task,status:'done'}]}) as never);
  const response=await fetch(`${base}/api/tasks/${task.id}`,{
   method:'PATCH',headers:{Authorization:`Bearer ${signToken(ownerId)}`,'Content-Type':'application/json'},
   body:JSON.stringify({status:'done'}),
  });
  expect(response.status).toBe(200);
  expect(vi.mocked(pool.query).mock.calls[1][1]).toEqual([task.id,task.title,task.description,'done','high',null]);
 });
});
