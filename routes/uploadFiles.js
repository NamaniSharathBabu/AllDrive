import multer from "multer";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "stream";
import dotenv from "dotenv";
import mongoose from "mongoose";
import foldermodel from "../models/folder.js";
import crypto, { randomBytes } from "crypto";
import argon2 from "argon2"; //for password creation

dotenv.config();
const upload = multer({ storage: multer.memoryStorage() });

export const middlewareUpload = upload.array('files');

// Lazy Mongo client and bucket initialization to avoid crashing when MONGO_URI is missing at import time
// let client;
let bucket = null;
async function ensureBucket() {
    if (bucket) return bucket;

    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: "uploads" });
    return bucket;
}
// function deriveFileKey(userId, salt) {
//     return crypto.scryptSync(
//         process.env.FILE_KEY_MASTER,
//         Buffer.concat([Buffer.from(String(userId)), salt]),//userId is Object in mongodb
//         32
//     )
// }
// if (!process.env.FILE_KEY_MASTER) {
//     throw new Error("File key master not found");
// }    
function encryptKey(key, masterKey) {
    const iv = randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    const encrypted = Buffer.concat([
        cipher.update(key),
        cipher.final()
    ])
    return {
        encryptedKey: encrypted,
        iv,
        authTag: cipher.getAuthTag()
    };
}

export async function deriveUserMasterKey(password, salt) {
    // Ensure salt is a Buffer, assuming it's stored as hex
    const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'hex');

    // console.log("deriveUserMasterKey Debug:", {
    //     passwordType: typeof password,
    //     passwordLength: password ? password.length : 0,
    //     saltInputType: typeof salt,
    //     saltIsBuffer: Buffer.isBuffer(salt),
    //     saltHexLength: salt && typeof salt === 'string' ? salt.length : 'N/A',
    //     saltBufferLength: saltBuffer.length
    // });

    try {
        return await argon2.hash(password, {
            type: argon2.argon2id,
            salt: saltBuffer,
            hashLength: 32,
            timeCost: 3,
            memoryCost: 2 ** 16,
            parallelism: 1,
            raw: true
        });
    } catch (err) {
        console.error("Argon2 execution failed:", err);
        throw err;
    }
}


export async function uploadFiles(req, res) {
    try {

        const bucket = await ensureBucket();
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).send("No files uploaded");
        }
        const uploadPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const readableStream = new Readable();
                const iv = crypto.randomBytes(12);
                const salt = crypto.randomBytes(16);
                // const key = deriveFileKey(req.user.id, salt);
                if (!req.session.userMasterKey) {
                    return res.status(401).json({ error: "Session expired. Please Login again to view files" });
                }
                const USER_MASTER_KEY = Buffer.from(req.session.userMasterKey, 'hex');
                const fileKey = crypto.randomBytes(32);
                const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
                const encrypted = Buffer.concat([
                    cipher.update(file.buffer),
                    cipher.final()
                ])
                const authTag = cipher.getAuthTag();
                const encryptedFile = Buffer.concat([
                    encrypted,
                    authTag
                ])
                const encryptedFileKey = encryptKey(fileKey, USER_MASTER_KEY)
                readableStream.push(encryptedFile);
                readableStream.push(null); // Indicate end of stream
                const uploadStream = bucket.openUploadStream(file.originalname, {
                    contentType: file.mimetype,
                    metadata: {
                        userId: req.user.id,
                        path: req.body.path,
                        iv: iv.toString('hex'),
                        encryptedFileKey: encryptedFileKey.encryptedKey.toString('hex'),
                        keyAuthTag: encryptedFileKey.authTag.toString('hex'),
                        keyIv: encryptedFileKey.iv.toString('hex'),
                        isPublic: false
                    }
                });
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
        // const decoded = req.user;
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
        if (!fileId) {
            return res.status(404).json({ error: "File not found" });
        }
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
        const result = await foldermodel.findByIdAndDelete(folderId, { "metadata.userId": req.user.id });
        if (result.ok) {
            res.status(200).json({ message: "Folder deleted successfully", result });
        }
        res.status(200).json({ message: "Folder not found" });
    }
    catch (err) {
        res.status(500).json({ error: "Error deleting folder" });
    }
}
function decryptKey(encryptedFileKey, userMasterKey, keyIv, keyAuthTag) {
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', userMasterKey, keyIv);
        decipher.setAuthTag(keyAuthTag);
        const fileKey = Buffer.concat([
            decipher.update(encryptedFileKey),
            decipher.final()
        ])
        return fileKey;
    }
    catch (err) {
        console.log("Error decrypting file key", err);
        return null;
    }
}
export async function downloadFile(req, res) {
    try {
        const bucket = await ensureBucket();
        const fileId = new ObjectId(req.params.fileId);
        // console.log(fileId+" in uploadFIles downloadig file");
        const files = await bucket.find({ _id: fileId, "metadata.userId": req.user.id }).toArray();//checking if metadatat is present
        if (!files || files.length === 0) {
            return res.status(404).json({ error: 'File not found' });//if metadata is not present then file is not found
        }

        const file = files[0];

        let DECRYPTION_KEY;
        if (file.metadata.isPublic) {
            if (!process.env.SERVER_MASTER_KEY) {
                return res.status(500).json({ error: 'Server master key not found' });
            }
            DECRYPTION_KEY = Buffer.from(process.env.SERVER_MASTER_KEY, 'hex');
        } else {
            if (!req.session || !req.session.userMasterKey) {
                return res.status(401).json({ error: 'Session expired. Please login again to view files.' });
            }
            DECRYPTION_KEY = Buffer.from(req.session.userMasterKey, 'hex');
        }

        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `inline; filename="${file.filename}"`);
        // res.set('Cache-Control', 'private, max-age=86400'); // 1 day
        // const salt = Buffer.from(file.metadata.salt, 'hex');
        const iv = Buffer.from(file.metadata.iv, 'hex');
        // const key = deriveFileKey(req.user.id, salt);
        const fileKey = decryptKey(
            Buffer.from(file.metadata.encryptedFileKey, "hex"),
            DECRYPTION_KEY,
            Buffer.from(file.metadata.keyIv, "hex"),
            Buffer.from(file.metadata.keyAuthTag, "hex")
        )
        const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv);
        const downloadStream = bucket.openDownloadStream(fileId);
        let tail = Buffer.alloc(0);

        downloadStream.on('data', (chunk) => {
            tail = Buffer.concat([tail, chunk]);
            if (tail.length > 16) {
                const data = tail.slice(0, tail.length - 16);
                tail = tail.slice(tail.length - 16);
                const decrypted = decipher.update(data);
                res.write(decrypted);
            }
        })
        downloadStream.on('end', () => {
            try {
                decipher.setAuthTag(tail);
                const final = decipher.final();
                if (final.length) res.write(final)
                res.end();
            } catch (err) {
                console.log("Auth failed", err);
                res.status(401).end();
            }
        })
        downloadStream.on('error', (err) => {
            console.error("Stream Error:", err);
            res.status(500).end();
        })
    }
    catch (err) {
        console.error("Error downloading file:", err);
        res.status(500).end();
    }
}
export async function previewFile(req, res) {
    try {
        const fileId = new ObjectId(req.params.fileId);
        const bucket = await ensureBucket();
        const files = await bucket.find({ _id: fileId, "metadata.userId": req.user.id }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = files[0];

        let DECRYPTION_KEY;
        if (file.metadata.isPublic) {
            if (!process.env.SERVER_MASTER_KEY) {
                return res.status(500).json({ error: 'Server master key not found' });
            }
            DECRYPTION_KEY = Buffer.from(process.env.SERVER_MASTER_KEY, 'hex');
        } else {
            if (!req.session || !req.session.userMasterKey) {
                return res.status(401).json({ error: 'Session expired. Please login again to preview files.' });
            }
            DECRYPTION_KEY = Buffer.from(req.session.userMasterKey, 'hex');
        }

        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', 'inline'); // 👈 key line

        const iv = Buffer.from(file.metadata.iv, 'hex');
        const fileKey = decryptKey(
            Buffer.from(file.metadata.encryptedFileKey, 'hex'),
            DECRYPTION_KEY,
            Buffer.from(file.metadata.keyIv, 'hex'),
            Buffer.from(file.metadata.keyAuthTag, 'hex')
        )
        const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv);

        const readStream = bucket.openDownloadStream(fileId);
        let tail = Buffer.alloc(0);
        readStream.on('data', chunk => {
            tail = Buffer.concat([tail, chunk]);
            if (tail.length > 16) {
                const data = tail.slice(0, tail.length - 16);
                tail = tail.slice(tail.length - 16);
                const decrypted = decipher.update(data);
                res.write(decrypted);
            }
        })
        readStream.on('end', () => {
            try {
                decipher.setAuthTag(tail);
                const final = decipher.final();
                if (final.length) res.write(final);
                res.end();
            } catch (err) {
                console.log("Auth failed", err);
                res.status(401).end();
            }
        })
        readStream.on('error', (err) => {
            console.error("Stream Error:", err);
            res.status(500).end();
        })
    }
    catch (err) {
        console.error("Error previewing file:", err);
        res.status(500).end();
    }
}

export async function makePublic(req, res) {
    try {
        const db = mongoose.connection.db;
        // console.log('went into makepublic')
        console.log(req.user.id)
        const fileId = new ObjectId(req.params.fileId);
        const bucket = await ensureBucket();
        const files = await bucket.find({ _id: fileId, "metadata.userId": req.user.id }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }
        if (!req.session.userMasterKey) {
            return res.status(401).json({ error: 'Session expired. Please login again to make file public.' });
        }
        const USER_MASTER_KEY = Buffer.from(req.session.userMasterKey, 'hex');
        console.log(USER_MASTER_KEY)
        const file = files[0];
        console.log(file)
        const iv = Buffer.from(file.metadata.iv, 'hex');
        const fileKey = decryptKey(
            Buffer.from(file.metadata.encryptedFileKey, 'hex'),
            USER_MASTER_KEY,
            Buffer.from(file.metadata.keyIv, 'hex'),
            Buffer.from(file.metadata.keyAuthTag, 'hex')
        )
        if (!process.env.SERVER_MASTER_KEY) {
            return res.status(500).json({ error: 'Server master key not found' });
        }
        const encryptedFile = encryptKey(fileKey, Buffer.from(process.env.SERVER_MASTER_KEY, 'hex'))
        const publicFileId = crypto.randomBytes(16).toString('hex');
        const updatedFile = await db.collection('uploads.files').updateOne({
            _id: fileId,
            "metadata.userId": req.user.id
        }, {
            $set: {
                "metadata.isPublic": true,
                "metadata.encryptedFileKey": encryptedFile.encryptedKey.toString('hex'),
                "metadata.keyIv": encryptedFile.iv.toString('hex'),
                "metadata.keyAuthTag": encryptedFile.authTag.toString('hex'),
                "metadata.filePublicId": publicFileId
            }
        });
        if (!updatedFile.modifiedCount) {
            return res.status(400).json({ error: 'Failed to make file public' });
        }
        res.status(200).json({ message: 'File made public successfully', publicFileId: publicFileId });
    }
    catch (err) {
        console.error("Error making file public:", err);
        res.status(500).json({ error: "Error making file public: " + err.message })
    }
}
export async function publicFile(req, res) {
    try {
        console.log("came into public file" + req.params.filePublicId)
        const filePublicId = req.params.filePublicId;
        const bucket = await ensureBucket();
        const files = await bucket.find({ "metadata.filePublicId": filePublicId, "metadata.isPublic": true }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }
        const file = files[0];
        const iv = Buffer.from(file.metadata.iv, 'hex');
        const fileKey = decryptKey(
            Buffer.from(file.metadata.encryptedFileKey, 'hex'),
            Buffer.from(process.env.SERVER_MASTER_KEY, 'hex'),
            Buffer.from(file.metadata.keyIv, 'hex'),
            Buffer.from(file.metadata.keyAuthTag, 'hex')
        )
        const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv);
        const readStream = bucket.openDownloadStream(file._id);
        let tail = Buffer.alloc(0);
        readStream.on('data', chunk => {
            tail = Buffer.concat([tail, chunk]);
            if (tail.length > 16) {
                const data = tail.slice(0, tail.length - 16);
                tail = tail.slice(tail.length - 16);
                const decrypted = decipher.update(data);
                res.write(decrypted);
            }
        })
        readStream.on('end', () => {
            try {
                decipher.setAuthTag(tail);
                const final = decipher.final();
                if (final.length) res.write(final);
                res.end();
            } catch (err) {
                console.log("Auth failed", err);
                res.status(401).end();
            }
        })
        readStream.on('error', (err) => {
            console.error("Stream Error:", err);
            res.status(500).end();
        })
    }
    catch (err) {
        console.error("Error making file public:", err);
        res.status(500).json({ error: "Error making file public: " + err.message })
    }
}

export async function makePrivate(req, res) {
    try {
        console.log("came into make private" + req.params.fileId)
        const fileId = new ObjectId(req.params.fileId);
        const db = mongoose.connection.db;
        const bucket = await ensureBucket();
        const files = await bucket.find({ _id: fileId, "metadata.userId": req.user.id }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }
        const file = files[0];
        const fileKey = decryptKey(
            Buffer.from(file.metadata.encryptedFileKey, 'hex'),
            Buffer.from(process.env.SERVER_MASTER_KEY, 'hex'),
            Buffer.from(file.metadata.keyIv, 'hex'),
            Buffer.from(file.metadata.keyAuthTag, 'hex')
        )
        const encryptedFileKey = encryptKey(fileKey, Buffer.from(req.session.userMasterKey, 'hex'))
        const updatedFile = await db.collection('uploads.files').updateOne({
            _id: file._id,
            "metadata.userId": req.user.id
        }, {
            $set: {
                "metadata.isPublic": false,
                "metadata.encryptedFileKey": encryptedFileKey.encryptedKey.toString('hex'),
                "metadata.keyIv": encryptedFileKey.iv.toString('hex'),
                "metadata.keyAuthTag": encryptedFileKey.authTag.toString('hex'),
                "metadata.filePublicId": null
            }
        });
        if (!updatedFile.modifiedCount) {
            return res.status(400).json({ error: 'Failed to make file private' });
        }
        res.status(200).json({ message: 'File made private successfully' });
    }
    catch (err) {
        console.error("Error making file public:", err);
        res.status(500).json({ error: "Error making file public: " + err.message })
    }
}