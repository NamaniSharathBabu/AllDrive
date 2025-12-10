import multer from "multer";
import { MongoClient, GridFSBucket } from "mongodb";
import { Readable } from "stream";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();
const upload = multer({ storage: multer.memoryStorage() });

export const middlewareUpload = upload.array('files');

// Lazy Mongo client and bucket initialization to avoid crashing when MONGO_URI is missing at import time
// let client;
let bucket=null;
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
        if(!files || files.length ===0){
            return res.status(400).send("No files uploaded");
        }
    const uploadPromises = files.map(file=>{
            return new Promise((resolve, reject)=>{
                const readableStream = new Readable();
                readableStream.push(file.buffer);
                readableStream.push(null); // Indicate end of stream
                const uploadStream = bucket.openUploadStream(file.originalname, { contentType: file.mimetype , metadata: { userId: req.user.id } });
                readableStream.pipe(uploadStream);
                uploadStream.on('error', (err)=>{
                    reject(err);
                });
                uploadStream.on('finish', ()=>{
                    resolve({ filename: file.originalname });
                });
            });
        });
    Promise.all(uploadPromises).then(results=>{
            res.status(201).json({ files: results });
        }).catch(err=>{
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
        const files = await bucket.find({"metadata.userId": req.user.id }).toArray();
        // console.log(files);
        if(!files || files.length ===0){
          return res.status(200).json([]);
        }
        res.json(files);
    } catch (error) {
        res.status(500).json({error: "Error retrieving files"});
    }
}