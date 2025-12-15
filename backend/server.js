// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Use environment variables
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:5500'];

// Configure CORS with environment variable
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (ALLOWED_ORIGINS.indexOf(origin) === -1) {
            const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id']
}));

// ... rest of your server.js code continues ...

// Update file upload configuration to use env variables
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = UPLOAD_DIR;
        if (file.mimetype.startsWith('image/')) {
            uploadPath = path.join(UPLOAD_DIR, 'covers');
        } else if (file.mimetype === 'application/pdf') {
            uploadPath = path.join(UPLOAD_DIR, 'pdfs');
        }
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: MAX_FILE_SIZE,
        files: 2
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES + ',' + process.env.ALLOWED_PDF_TYPE)
            .split(',')
            .map(type => type.trim());
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
        }
    }
});