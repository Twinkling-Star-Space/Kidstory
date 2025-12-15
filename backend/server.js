const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create necessary directories
const createDirectories = () => {
    const dirs = ['uploads/covers', 'uploads/pdfs', 'data'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};
createDirectories();

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/';
        if (file.mimetype.startsWith('image/')) {
            uploadPath = 'uploads/covers/';
        } else if (file.mimetype === 'application/pdf') {
            uploadPath = 'uploads/pdfs/';
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
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 2 // Max 2 files
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
        }
    }
});

// Data storage files
const BOOKS_FILE = 'data/books.json';
const VIEWS_FILE = 'data/views.json';
const FEEDBACK_FILE = 'data/feedback.json';
const COMMENTS_FILE = 'data/comments.json';

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
let commentsData = readJSONFile(COMMENTS_FILE);

// Serve static files
app.use('/uploads', express.static('uploads'));
app.use('/api/static', express.static('uploads'));

// API Routes

// Get all books with pagination and filtering
app.get('/api/books', (req, res) => {
    try {
        const { 
            search = '', 
            genre = '', 
            page = 1, 
            limit = 12,
            sort = 'newest'
        } = req.query;
        
        let filteredBooks = [...books];
        
        // Search filter
        if (search) {
            const searchLower = search.toLowerCase();
            filteredBooks = filteredBooks.filter(book => 
                book.title.toLowerCase().includes(searchLower) ||
                book.author.toLowerCase().includes(searchLower) ||
                book.description.toLowerCase().includes(searchLower) ||
                book.tags?.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }
        
        // Genre filter
        if (genre && genre !== 'all') {
            filteredBooks = filteredBooks.filter(book => book.genre === genre);
        }
        
        // Sorting
        switch(sort) {
            case 'popular':
                filteredBooks.sort((a, b) => b.views - a.views);
                break;
            case 'likes':
                filteredBooks.sort((a, b) => b.likes - a.likes);
                break;
            case 'oldest':
                filteredBooks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'newest':
            default:
                filteredBooks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
        }
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedBooks = filteredBooks.slice(startIndex, endIndex);
        
        // Update view counts (just for served books)
        paginatedBooks.forEach(book => {
            book.views = (book.views || 0) + 1;
        });
        
        res.json({
            success: true,
            data: paginatedBooks,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(filteredBooks.length / limit),
                totalBooks: filteredBooks.length,
                hasMore: endIndex < filteredBooks.length
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch books' 
        });
    }
});

// Get single book by ID
app.get('/api/books/:id', (req, res) => {
    try {
        const bookId = req.params.id;
        const book = books.find(b => b.id === bookId);
        
        if (!book) {
            return res.status(404).json({ 
                success: false, 
                error: 'Book not found' 
            });
        }
        
        // Increment views
        book.views = (book.views || 0) + 1;
        writeJSONFile(BOOKS_FILE, books);
        
        // Get book comments
        const bookComments = commentsData.filter(comment => comment.bookId === bookId);
        
        res.json({
            success: true,
            data: {
                ...book,
                comments: bookComments
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch book' 
        });
    }
});

// Upload new book
app.post('/api/books', upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), (req, res) => {
    try {
        const { 
            title, 
            author, 
            description, 
            genre, 
            ageGroup,
            tags = ''
        } = req.body;
        
        // Validation
        if (!title || !author || !description || !genre || !ageGroup) {
            return res.status(400).json({ 
                success: false, 
                error: 'All required fields must be filled' 
            });
        }
        
        if (!req.files?.cover || !req.files?.pdf) {
            return res.status(400).json({ 
                success: false, 
                error: 'Both cover image and PDF file are required' 
            });
        }
        
        // Create book object
        const newBook = {
            id: uuidv4(),
            title,
            author,
            description,
            genre,
            ageGroup,
            tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
            coverUrl: `/api/static/covers/${req.files.cover[0].filename}`,
            pdfUrl: `/api/static/pdfs/${req.files.pdf[0].filename}`,
            views: 0,
            likes: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save to books array
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

// Add comment to book
app.post('/api/books/:id/comment', (req, res) => {
    try {
        const bookId = req.params.id;
        const { comment, author = 'Anonymous' } = req.body;
        
        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Comment cannot be empty' 
            });
        }
        
        const newComment = {
            id: uuidv4(),
            bookId,
            author,
            comment: comment.trim(),
            createdAt: new Date().toISOString()
        };
        
        commentsData.push(newComment);
        writeJSONFile(COMMENTS_FILE, commentsData);
        
        res.status(201).json({
            success: true,
            message: 'Comment added successfully!',
            data: newComment
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to add comment' 
        });
    }
});

// Get book comments
app.get('/api/books/:id/comments', (req, res) => {
    try {
        const bookId = req.params.id;
        const bookComments = commentsData
            .filter(comment => comment.bookId === bookId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            data: bookComments
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch comments' 
        });
    }
});

// Submit feedback
app.post('/api/feedback', (req, res) => {
    try {
        const { bookId, rating, comment, deviceId } = req.body;
        
        if (!bookId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid book ID and rating (1-5) are required' 
            });
        }
        
        const newFeedback = {
            id: uuidv4(),
            bookId,
            rating: parseInt(rating),
            comment: comment || '',
            deviceId: deviceId || 'unknown',
            createdAt: new Date().toISOString()
        };
        
        feedbackData.push(newFeedback);
        writeJSONFile(FEEDBACK_FILE, feedbackData);
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your feedback!',
            data: newFeedback
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to submit feedback' 
        });
    }
});

// Get website statistics
app.get('/api/stats', (req, res) => {
    try {
        const totalBooks = books.length;
        const totalViews = books.reduce((sum, book) => sum + (book.views || 0), 0);
        const totalLikes = books.reduce((sum, book) => sum + (book.likes || 0), 0);
        
        // Genre distribution
        const genreStats = books.reduce((stats, book) => {
            stats[book.genre] = (stats[book.genre] || 0) + 1;
            return stats;
        }, {});
        
        // Age group distribution
        const ageGroupStats = books.reduce((stats, book) => {
            stats[book.ageGroup] = (stats[book.ageGroup] || 0) + 1;
            return stats;
        }, {});
        
        res.json({
            success: true,
            data: {
                totalBooks,
                totalViews,
                totalLikes,
                averageRating: feedbackData.length > 0 
                    ? (feedbackData.reduce((sum, fb) => sum + fb.rating, 0) / feedbackData.length).toFixed(1)
                    : 0,
                genreStats,
                ageGroupStats,
                recentBooks: books.slice(0, 5).map(book => ({
                    id: book.id,
                    title: book.title,
                    views: book.views,
                    likes: book.likes
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch statistics' 
        });
    }
});

// Increment view count (for individual book reads)
app.post('/api/views/increment', (req, res) => {
    try {
        const { bookId, deviceId } = req.body;
        
        // Track overall views
        if (!viewsData.totalViews) {
            viewsData.totalViews = 0;
        }
        viewsData.totalViews += 1;
        
        // Track per-book views
        if (bookId) {
            const book = books.find(b => b.id === bookId);
            if (book) {
                book.views = (book.views || 0) + 1;
                writeJSONFile(BOOKS_FILE, books);
            }
        }
        
        // Track unique devices (simplified)
        if (deviceId && !viewsData.uniqueDevices?.includes(deviceId)) {
            if (!viewsData.uniqueDevices) viewsData.uniqueDevices = [];
            viewsData.uniqueDevices.push(deviceId);
        }
        
        viewsData.lastUpdated = new Date().toISOString();
        writeJSONFile(VIEWS_FILE, viewsData);
        
        res.json({
            success: true,
            totalViews: viewsData.totalViews,
            uniqueDevices: viewsData.uniqueDevices?.length || 0
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update view count' 
        });
    }
});

// Get genres list
app.get('/api/genres', (req, res) => {
    try {
        const genres = [...new Set(books.map(book => book.genre))];
        res.json({
            success: true,
            data: genres
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch genres' 
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        stats: {
            books: books.length,
            feedback: feedbackData.length,
            comments: commentsData.length
        }
    });
});

// Serve frontend (for production)
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false, 
                error: 'File too large. Maximum size is 10MB.' 
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
                success: false, 
                error: 'Too many files. Maximum is 2.' 
            });
        }
    }
    
    if (err.message.includes('Invalid file type')) {
        return res.status(400).json({ 
            success: false, 
            error: err.message 
        });
    }
    
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

// Seed initial data if empty
const seedInitialData = () => {
    if (books.length === 0) {
        const sampleBooks = [
            {
                id: uuidv4(),
                title: "The Adventures of Sunny Bunny",
                author: "Emma Johnson",
                description: "Join Sunny Bunny on his magical adventure through the Enchanted Forest, where he makes new friends and learns about kindness and bravery. This colorful story teaches children about friendship and perseverance.",
                genre: "adventure",
                ageGroup: "3-5",
                tags: ["bunny", "forest", "friendship", "magic"],
                coverUrl: "/api/static/sample-cover1.jpg",
                pdfUrl: "/api/static/sample-book1.pdf",
                views: 1245,
                likes: 89,
                createdAt: "2024-01-15T10:30:00Z",
                updatedAt: "2024-01-15T10:30:00Z"
            },
            {
                id: uuidv4(),
                title: "Counting with Colorful Cats",
                author: "Dr. Lisa Wang",
                description: "Learn numbers and colors with this interactive story featuring adorable cats in rainbow colors. Perfect for early learners! Each page introduces a new number and color combination.",
                genre: "educational",
                ageGroup: "2-4",
                tags: ["counting", "colors", "cats", "learning"],
                coverUrl: "/api/static/sample-cover2.jpg",
                pdfUrl: "/api/static/sample-book2.pdf",
                views: 892,
                likes: 67,
                createdAt: "2024-01-10T14:20:00Z",
                updatedAt: "2024-01-10T14:20:00Z"
            },
            {
                id: uuidv4(),
                title: "Princess Luna's Starry Night",
                author: "Michael Chen",
                description: "A beautiful bedtime story about Princess Luna who collects stars to light up the night sky for all sleepy children. This calming tale helps children drift off to sleep with peaceful imagery.",
                genre: "bedtime",
                ageGroup: "4-6",
                tags: ["princess", "stars", "bedtime", "magic"],
                coverUrl: "/api/static/sample-cover3.jpg",
                pdfUrl: "/api/static/sample-book3.pdf",
                views: 1567,
                likes: 124,
                createdAt: "2024-01-05T09:15:00Z",
                updatedAt: "2024-01-05T09:15:00Z"
            }
        ];
        
        books = sampleBooks;
        writeJSONFile(BOOKS_FILE, books);
        
        console.log('Seeded initial data with 3 sample books');
    }
};

// Start server
app.listen(PORT, () => {
    seedInitialData();
    console.log(`
    🚀 Server is running!
    📚 Kid's Story World Backend
    🔗 Local: http://localhost:${PORT}
    
    📊 Endpoints:
    📖 GET  /api/books        - Get all books
    📄 GET  /api/books/:id    - Get single book
    📤 POST /api/books        - Upload new book
    ❤️ POST /api/books/:id/like - Like a book
    💬 POST /api/books/:id/comment - Add comment
    ⭐ POST /api/feedback     - Submit feedback
    📈 GET  /api/stats        - Get statistics
    👁️ POST /api/views/increment - Track views
    
    📁 Uploads: http://localhost:${PORT}/api/static/
    🩺 Health: http://localhost:${PORT}/api/health
    `);
});