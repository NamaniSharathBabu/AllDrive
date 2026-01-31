import dotenv from 'dotenv';

import express from 'express';
import cors from 'cors';
import routes from '../routes/allRoutes.js';
import logger from '../middleware/logger.js';
import mongoose from 'mongoose';
// import cookieParser from 'cookie-parser';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

// Connect to MongoDB before starting the server


app.use(logger);
//Allow requests from the frontend
app.use(cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
app.use('/api', routes);

app.get('/', (_, res)=>{
    res.send('AllDrive API is running')
})
app.get('/health', (_, res)=>{
    res.status(200).send('OK')
})

app.listen(PORT, () => {
    console.log(`Server is running on port : ${PORT}`);
});


if (!MONGO_URI) {
  console.error('MONGO_URI is not defined');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection failed:', err.message));
}