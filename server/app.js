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
 if (!MONGO_URI) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
}

try {
   
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB`);
} catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
}

app.use(logger);
//Allow requests from the frontend
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());
app.use('/api', routes);

app.get('/', (_, res)=>{
    res.send('API is running')
})

app.listen(PORT, () => {
    console.log(`Server is running on port : ${PORT}`);
});
