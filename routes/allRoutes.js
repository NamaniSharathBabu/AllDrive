import express from 'express';
import {login, register} from './loginRegRoutes.js';
import {uploadFiles, getFiles,deleteFile, middlewareUpload, createFolder, getFolders} from './uploadFiles.js';
import userModel from '../models/userModel.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/upload', authMiddleware, middlewareUpload, uploadFiles);
router.get('/files', authMiddleware, getFiles);
router.delete('/files/:fileId', authMiddleware, deleteFile);
router.post('/folders', authMiddleware, createFolder);
router.get('/folders', authMiddleware, getFolders);
router.get('/users', async (req,res)=>{
   await userModel.find().then(users=>{
        res.json(users);
    }).catch(err=>{
        res.status(500).json({message:"Error retrieving users"});
    });
})




export default router;