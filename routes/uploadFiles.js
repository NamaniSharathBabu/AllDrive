import multer from "multer";
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "stream";
import dotenv from "dotenv";
import mongoose from "mongoose";
import foldermodel from "../models/folder.js";
dotenv.config();
const upload = multer({ storage: multer.memoryStorage() });

export const middlewareUpload = upload.array('files');

// Lazy Mongo client and bucket initialization to avoid crashing when MONGO_URI is missing at import time
// let client;
let bucket = null;
async function ensureBucket() {
    if (bucket) return bucket;
    // const mongoURI = process.env.MONGO_URI;
    // if (!mongoURI) {
    //     throw new Error('MONGO_URI is not set');
    // }
    // client = new MongoClient(mongoURI);
    // await client.connect();
    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: "uploads" });
    return bucket;
}

export async function uploadFiles(req, res) {
    try {
        const bucket = await ensureBucket();
        // console.log(req.files);
        // console.log(req.body)
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).send("No files uploaded");
        }
        const uploadPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const readableStream = new Readable();
                readableStream.push(file.buffer);
                readableStream.push(null); // Indicate end of stream
                const uploadStream = bucket.openUploadStream(file.originalname, { contentType: file.mimetype, metadata: { userId: req.user.id, path: req.body.path, isFolder: false } });
                readableStream.pipe(uploadStream);
                uploadStream.on('error', (err) => {
                    reject(err);
                });
                uploadStream.on('finish', () => {
                    resolve({ filename: file.originalname });
                });
            });
        });
        Promise.all(uploadPromises).then(results => {
            res.status(201).json({ files: results });
        }).catch(err => {
            res.status(500).send('Error uploading files1');
        });

    } catch (error) {
        res.status(500).send('Error uploading files2');
    }
}

export async function getFiles(req, res) {
    try {
        const bucket = await ensureBucket();
        // console.log(req.user);
        const decoded = req.user;
        const files = await bucket.find({ "metadata.userId": req.user.id, "metadata.path": req.query.path }).toArray();
        if (!files || files.length === 0) {
            return res.status(200).json([]);
        }
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: "Error retrieving files" });
    }
}

export async function deleteFile(req, res) {
    try {
        const bucket = await ensureBucket();
        const fileId = new ObjectId(req.params.fileId);
        await bucket.delete(fileId);

        res.status(200).json({ message: "File deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ error: "Error deleting file" });
    }
}

export async function createFolder(req, res) {
    const { path, folderName } = req.body;

    const folderDoc = new foldermodel({
        filename: folderName,
        uploadDate: new Date(),
        contentType: 'folder',
        metadata: {
            userId: req.user.id,
            path,
        }
    });

    const result = await folderDoc.save();
    // console.log(result);
    res.status(201).json({
        _id: result.insertedId,
        ...folderDoc
    });
}
export async function getFolders(req, res) {
    try {
        console.log(req.query.path);
        const folders = await foldermodel.find({ "metadata.userId": req.user.id, "metadata.path": req.query.path })
        if (!folders || folders.length === 0) {
            return res.status(200).json([]);
        }
        return res.status(200).json(folders);
    }
    catch (err) {
        return res.status(500).json({ error: "Error retrieving folders" });
    }
}
export async function deleteFolder(req, res) {
    try {
        const folderId = req.params.folderId;
        const result = await foldermodel.findByIdAndDelete(folderId);
        if (result.ok) {
            res.status(200).json({ message: "Folder deleted successfully", result });
        }
        res.status(200).json({ message: "Folder not found" });
    }
    catch (err) {
        res.status(500).json({ error: "Error deleting folder" });
    }
}

export async function downloadFile(req, res) {
    try {
        const bucket = await ensureBucket();
        const fileId = new ObjectId(req.params.fileId);
        // console.log(fileId+" in uploadFIles downloadig file");
        const file = await bucket.find({ _id: fileId }).toArray();//checking if metadatat is present
        if (!file || file.length === 0) {
            return res.status(404).json({ error: 'File not found' });//if metadata is not present then file is not found
        }
        res.set('Content-Type', file[0].contentType);
        res.set('Content-Disposition', `inline; filename="${file[0].filename}"`);
        res.set('Cache-Control', 'private, max-age=86400'); // 1 day

        const downloadStream = bucket.openDownloadStream(fileId);
        downloadStream.on('error', (err)=>{
            console.error("Error downloading file", err);
            res.status(500).json({error:"Error downloading file"})
        })
        downloadStream.pipe(res);
    } catch (err) {
        console.error("Error downloading file:", err);
        res.status(500).json({ error: "Error downloading file" });
    }
}