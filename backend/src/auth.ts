import type { NextFunction,Request,Response } from 'express'; import jwt from 'jsonwebtoken'; import { config } from './config.js';
export type AuthRequest=Request&{userId?:string};
export function signToken(userId:string){return jwt.sign({sub:userId},config.JWT_SECRET,{expiresIn:'8h'});}
export function requireAuth(req:AuthRequest,res:Response,next:NextFunction){const token=req.headers.authorization?.replace(/^Bearer /,''); if(!token)return res.status(401).json({error:'Authentication required'}); try{req.userId=String(jwt.verify(token,config.JWT_SECRET).sub); next();}catch{return res.status(401).json({error:'Invalid or expired token'});}}
