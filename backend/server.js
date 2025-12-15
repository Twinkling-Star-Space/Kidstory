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
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

// Important: Calculate correct paths based on your folder structure
const BACKEND_DIR = __dirname; // Points to backend folder
const PROJECT_ROOT = path.join(__dirname, '..'); // Points to kidstory folder
const UPLOAD_DIR = path.join(BACKEND_DIR, process.env.UPLOAD_DIR || 'uploads');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

console.log('=========================================');
console.log('📁 Folder Structure:');
console.log('Project Root:', PROJECT_ROOT);
console.log('Backend Dir:', BACKEND_DIR);
console.log('Frontend Dir:', FRONTEND_DIR);
console.log('Upload Dir:', UPLOAD_DIR);
console.log('=========================================\n');

// Create necessary directories
const createDirectories = () => {
    const dirs = [
        UPLOAD_DIR,
        path.join(UPLOAD_DIR, 'covers'),
        path.join(UPLOAD_DIR, 'pdfs'),
        path.join(BACKEND_DIR, 'data')
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    });
};
createDirectories();

// Middleware - Allow frontend access
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = UPLOAD_DIR;
        if (file.mimetype.startsWith('image/')) {
            uploadPath = path.join(UPLOAD_DIR, 'covers');
        } else if (file.mimetype === 'application/pdf') {
            uploadPath = path.join(UPLOAD_DIR, 'pdfs');
        }
        
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
        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'application/pdf'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type. Only images and PDFs are allowed.`));
        }
    }
});

// Data storage files (in backend/data)
const BOOKS_FILE = path.join(BACKEND_DIR, 'data/books.json');
const VIEWS_FILE = path.join(BACKEND_DIR, 'data/views.json');
const FEEDBACK_FILE = path.join(BACKEND_DIR, 'data/feedback.json');

// Helper functions for file operations
const readJSONFile = (filename) => {
    try {
        if (fs.existsSync(filename)) {
            const data = fs.readFileSync(filename, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

const writeJSONFile = (filename, data) => {
    try {
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
};

// Initialize data
let books = readJSONFile(BOOKS_FILE);
let viewsData = readJSONFile(VIEWS_FILE);
let feedbackData = readJSONFile(FEEDBACK_FILE);

// Serve static files from uploads
app.use('/api/static', express.static(UPLOAD_DIR));

// =============== API ROUTES ===============

// Root route - Show API info
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to Kid\'s Story World API!',
        endpoints: {
            api: '/api',
            books: '/api/books',
            upload: '/api/books (POST)',
            stats: '/api/stats',
            health: '/api/health'
        },
        frontend: 'http://localhost:5500'
    });
});

// API welcome
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Kid\'s Story World API',
        version: '1.0.0'
    });
});

// Get all books
app.get('/api/books', (req, res) => {
    try {
        res.json({
            success: true,
            data: books,
            count: books.length
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch books' 
        });
    }
});

// Upload new book
app.post('/api/books', upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), (req, res) => {
    try {
        const { title, author, description, genre, ageGroup } = req.body;
        
        if (!title || !author || !description || !genre || !ageGroup) {
            return res.status(400).json({ 
                success: false, 
                error: 'All fields are required' 
            });
        }
        
        if (!req.files?.cover || !req.files?.pdf) {
            return res.status(400).json({ 
                success: false, 
                error: 'Both cover and PDF are required' 
            });
        }
        
        const newBook = {
            id: uuidv4(),
            title,
            author,
            description,
            genre,
            ageGroup,
            coverFilename: req.files.cover[0].filename,
            pdfFilename: req.files.pdf[0].filename,
            coverUrl: `/api/static/covers/${req.files.cover[0].filename}`,
            pdfUrl: `/api/static/pdfs/${req.files.pdf[0].filename}`,
            views: 0,
            likes: 0,
            createdAt: new Date().toISOString()
        };
        
        books.unshift(newBook);
        writeJSONFile(BOOKS_FILE, books);
        
        res.status(201).json({
            success: true,
            message: 'Book uploaded successfully!',
            data: newBook
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload book' 
        });
    }
});

// Like a book
app.post('/api/books/:id/like', (req, res) => {
    try {
        const bookId = req.params.id;
        const book = books.find(b => b.id === bookId);
        
        if (!book) {
            return res.status(404).json({ 
                success: false, 
                error: 'Book not found' 
            });
        }
        
        book.likes = (book.likes || 0) + 1;
        writeJSONFile(BOOKS_FILE, books);
        
        res.json({
            success: true,
            likes: book.likes
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to like book' 
        });
    }
});

// Get statistics
app.get('/api/stats', (req, res) => {
    try {
        const totalBooks = books.length;
        const totalViews = books.reduce((sum, book) => sum + (book.views || 0), 0);
        const totalLikes = books.reduce((sum, book) => sum + (book.likes || 0), 0);
        
        res.json({
            success: true,
            data: {
                totalBooks,
                totalViews,
                totalLikes
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch statistics' 
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        booksCount: books.length
    });
});

// Serve frontend in development
if (fs.existsSync(FRONTEND_DIR)) {
    app.use(express.static(FRONTEND_DIR));
    console.log(`✅ Serving frontend from: ${FRONTEND_DIR}`);
}

// Seed sample data
if (books.length === 0) {
    console.log('🌱 Seeding sample data...');
    books = [
        {
            id: uuidv4(),
            title: "The Adventures of Sunny Bunny",
            author: "Emma Johnson",
            description: "Join Sunny Bunny on his magical adventure through the Enchanted Forest.",
            genre: "animal",
            ageGroup: "3-5",
            coverFilename: "sample-bunny.jpg",
            pdfFilename: "sample-bunny.pdf",
            coverUrl: "/api/static/covers/sample-bunny.jpg",
            pdfUrl: "/api/static/pdfs/sample-bunny.pdf",
            views: 1245,
            likes: 89,
            createdAt: "2024-01-15T10:30:00Z"
        },
        {
            id: uuidv4(),
            title: "Counting with Colorful Cats",
            author: "Dr. Lisa Wang",
            description: "Learn numbers and colors with adorable rainbow cats.",
            genre: "educational",
            ageGroup: "2-4",
            coverFilename: "sample-cats.jpg",
            pdfFilename: "sample-cats.pdf",
            coverUrl: "/api/static/covers/sample-cats.jpg",
            pdfUrl: "/api/static/pdfs/sample-cats.pdf",
            views: 892,
            likes: 67,
            createdAt: "2024-01-10T14:20:00Z"
        }
    ];
    writeJSONFile(BOOKS_FILE, books);
}

// Start server
app.listen(PORT, () => {
    console.log(`
=========================================
🚀 Server is running!
📚 Kid's Story World Backend
🔗 Local: http://localhost:${PORT}
📁 Serving from: ${BACKEND_DIR}
=========================================
`);
});