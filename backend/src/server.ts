import { app } from './app.js'; import { config } from './config.js'; import { pool } from './db.js';
const server=app.listen(config.PORT,()=>console.log(JSON.stringify({level:'info',message:'API listening',port:config.PORT})));
async function shutdown(){server.close(async()=>{await pool.end();process.exit(0);});} process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
