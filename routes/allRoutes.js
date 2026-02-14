import express from 'express';
import { login, register } from './loginRegRoutes.js';
import { uploadFiles, getFiles, deleteFile, middlewareUpload, createFolder, getFolders, deleteFolder, downloadFile, previewFile } from './uploadFiles.js';
import userModel from '../models/userModel.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { makePublic, publicFile, makePrivate } from './uploadFiles.js';
const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/upload', authMiddleware, middlewareUpload, uploadFiles);
router.get('/files', authMiddleware, getFiles);
router.get('/files/content/:fileId', authMiddleware, downloadFile);
router.delete('/files/:fileId', authMiddleware, deleteFile);
router.post('/folders', authMiddleware, createFolder);
router.get('/folders', authMiddleware, getFolders);
router.delete('/folders/:folderId', authMiddleware, deleteFolder);
router.get('/files/previewFile/:fileId', authMiddleware, previewFile);
router.post('/files/makePublic/:fileId', authMiddleware, makePublic);
router.get('/files/public/:filePublicId', publicFile);
router.post('/files/makePrivate/:fileId', authMiddleware, makePrivate);

export default router;