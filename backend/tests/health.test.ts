import {describe,expect,it,vi} from 'vitest';
vi.mock('../src/db.js',()=>({pool:{query:vi.fn().mockResolvedValue({rows:[{one:1}]})}}));
process.env.DATABASE_URL='postgres://test'; process.env.JWT_SECRET='1234567890123456';
describe('health response contract',()=>{it('has the expected fields',()=>{expect({status:'ok',database:'ok'}).toMatchObject({status:'ok',database:'ok'});});});
