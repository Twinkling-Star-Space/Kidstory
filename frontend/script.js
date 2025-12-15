// Global variables
let books = [];
let currentViewCount = 0;
let selectedBookId = null;
let selectedRating = 0;

// DOM Elements
const booksContainer = document.getElementById('booksContainer');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const totalViewsElement = document.getElementById('totalViews');
const totalBooksElement = document.getElementById('totalBooks');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Check if user has visited before
    if (!getCookie('hasVisited')) {
        setCookie('hasVisited', 'true', 365);
        currentViewCount = 1;
        updateViewCount();
    }
    
    // Load initial data
    loadBooks();
    loadViewsCount();
}

function setupEventListeners() {
    // Search functionality
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Genre filter
    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterBooksByGenre(btn.dataset.genre);
        });
    });
    
    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', handleBookUpload);
    
    // Star rating
    document.querySelectorAll('.star-rating i').forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating);
            updateStarRating();
        });
        star.addEventListener('mouseover', (e) => {
            const rating = parseInt(e.target.dataset.rating);
            highlightStars(rating);
        });
        star.addEventListener('mouseout', () => {
            updateStarRating();
        });
    });
}

// Cookie functions
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) return cookieValue;
    }
    return null;
}

// View count functions
function loadViewsCount() {
    const savedViews = localStorage.getItem('totalViews') || '0';
    currentViewCount = parseInt(savedViews);
    updateViewCount();
}

function updateViewCount() {
    currentViewCount++;
    localStorage.setItem('totalViews', currentViewCount.toString());
    totalViewsElement.textContent = currentViewCount.toLocaleString();
}

// Book loading and display
async function loadBooks() {
    try {
        // Show loading
        booksContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        
        // In production, replace this with actual API call
        // const response = await fetch('/api/books');
        // books = await response.json();
        
        // For demo, use mock data
        books = getMockBooks();
        displayBooks(books);
        updateTotalBooksCount();
    } catch (error) {
        console.error('Error loading books:', error);
        booksContainer.innerHTML = '<p class="error">Failed to load books. Please try again.</p>';
    }
}

function displayBooks(booksToDisplay) {
    if (booksToDisplay.length === 0) {
        booksContainer.innerHTML = '<p class="no-books">No books found. Try a different search!</p>';
        return;
    }
    
    booksContainer.innerHTML = booksToDisplay.map(book => `
        <div class="book-card" data-id="${book.id}" data-genre="${book.genre}">
            <div class="book-cover" style="background-image: url('${book.coverUrl}')">
                <div class="book-overlay">
                    <div class="book-age-badge">${book.ageGroup}</div>
                </div>
            </div>
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <div class="book-meta">
                    <span><i class="fas fa-user"></i> ${book.author}</span>
                    <span><i class="fas fa-eye"></i> ${book.views.toLocaleString()} views</span>
                    <span><i class="fas fa-heart"></i> ${book.likes}</span>
                </div>
                <p class="book-description">${book.description}</p>
                <div class="book-actions">
                    <button class="action-btn like-btn ${book.liked ? 'liked' : ''}" onclick="toggleLike(${book.id})">
                        <i class="fas fa-heart"></i> Like
                    </button>
                    <button class="action-btn" onclick="shareBook(${book.id})">
                        <i class="fas fa-share"></i> Share
                    </button>
                    <button class="read-btn" onclick="readBook(${book.id})">
                        <i class="fas fa-book-open"></i> Read Now
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateTotalBooksCount() {
    totalBooksElement.textContent = books.length.toLocaleString();
}

// Search and filter
function performSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    if (!searchTerm) {
        displayBooks(books);
        return;
    }
    
    const filteredBooks = books.filter(book => 
        book.title.toLowerCase().includes(searchTerm) ||
        book.author.toLowerCase().includes(searchTerm) ||
        book.description.toLowerCase().includes(searchTerm) ||
        book.genre.toLowerCase().includes(searchTerm)
    );
    
    displayBooks(filteredBooks);
}

function filterBooksByGenre(genre) {
    if (genre === 'all') {
        displayBooks(books);
        return;
    }
    
    const filteredBooks = books.filter(book => book.genre === genre);
    displayBooks(filteredBooks);
}

// Book actions
function toggleLike(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    
    const likeBtn = document.querySelector(`.book-card[data-id="${bookId}"] .like-btn`);
    
    if (book.liked) {
        book.likes--;
        book.liked = false;
        likeBtn.classList.remove('liked');
    } else {
        book.likes++;
        book.liked = true;
        likeBtn.classList.add('liked');
    }
    
    // Update like count in UI
    const likeCountElement = likeBtn.parentElement.parentElement.querySelector('.book-meta span:nth-child(3)');
    likeCountElement.innerHTML = `<i class="fas fa-heart"></i> ${book.likes}`;
    
    // In production, send to server
    // fetch(`/api/books/${bookId}/like`, { method: 'POST' });
}

function shareBook(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    
    const shareUrl = `${window.location.origin}/book/${bookId}`;
    const shareText = `Check out "${book.title}" on Kid's Story World!`;
    
    if (navigator.share) {
        navigator.share({
            title: book.title,
            text: shareText,
            url: shareUrl
        });
    } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert('Link copied to clipboard!');
    }
}

function readBook(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    
    selectedBookId = bookId;
    book.views++;
    
    // Update view count in UI
    const viewsElement = document.querySelector(`.book-card[data-id="${bookId}"] .book-meta span:nth-child(2)`);
    viewsElement.innerHTML = `<i class="fas fa-eye"></i> ${book.views.toLocaleString()} views`;
    
    // Open PDF in new tab
    window.open(book.pdfUrl, '_blank');
    
    // Show feedback modal after a delay (simulating reading completion)
    setTimeout(() => {
        showFeedbackModal();
    }, 30000); // 30 seconds delay for demo
}

// Upload form functions
function showUploadForm() {
    document.getElementById('uploadModal').style.display = 'flex';
}

function hideUploadForm() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('uploadForm').reset();
}

async function handleBookUpload(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('title', document.getElementById('bookTitle').value);
    formData.append('author', document.getElementById('authorName').value);
    formData.append('description', document.getElementById('description').value);
    formData.append('genre', document.getElementById('genre').value);
    formData.append('ageGroup', document.getElementById('ageGroup').value);
    formData.append('cover', document.getElementById('bookCover').files[0]);
    formData.append('pdf', document.getElementById('pdfFile').files[0]);
    
    try {
        // In production, send to server
        // const response = await fetch('/api/books', {
        //     method: 'POST',
        //     body: formData
        // });
        
        // const newBook = await response.json();
        
        // For demo, create mock book
        const newBook = {
            id: books.length + 1,
            title: document.getElementById('bookTitle').value,
            author: document.getElementById('authorName').value,
            description: document.getElementById('description').value,
            genre: document.getElementById('genre').value,
            ageGroup: document.getElementById('ageGroup').value,
            coverUrl: URL.createObjectURL(document.getElementById('bookCover').files[0]),
            pdfUrl: URL.createObjectURL(document.getElementById('pdfFile').files[0]),
            views: 0,
            likes: 0,
            liked: false
        };
        
        books.unshift(newBook);
        displayBooks(books);
        updateTotalBooksCount();
        hideUploadForm();
        
        alert('Book uploaded successfully!');
    } catch (error) {
        console.error('Error uploading book:', error);
        alert('Failed to upload book. Please try again.');
    }
}

// Feedback functions
function showFeedbackModal() {
    if (!getCookie(`feedback_${selectedBookId}`)) {
        document.getElementById('feedbackModal').style.display = 'flex';
        selectedRating = 0;
        updateStarRating();
    }
}

function hideFeedbackModal() {
    document.getElementById('feedbackModal').style.display = 'none';
}

function updateStarRating() {
    const stars = document.querySelectorAll('.star-rating i');
    stars.forEach((star, index) => {
        if (index < selectedRating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    document.getElementById('ratingValue').textContent = selectedRating;
}

function highlightStars(rating) {
    const stars = document.querySelectorAll('.star-rating i');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.style.color = 'gold';
        } else {
            star.style.color = 'var(--warning)';
        }
    });
}

function submitFeedback() {
    if (selectedRating === 0) {
        alert('Please select a rating!');
        return;
    }
    
    const feedback = {
        bookId: selectedBookId,
        rating: selectedRating,
        comment: document.getElementById('feedbackText').value,
        date: new Date().toISOString()
    };
    
    // Save to localStorage for demo
    const allFeedback = JSON.parse(localStorage.getItem('bookFeedback') || '[]');
    allFeedback.push(feedback);
    localStorage.setItem('bookFeedback', JSON.stringify(allFeedback));
    
    // Set cookie to remember feedback
    setCookie(`feedback_${selectedBookId}`, 'true', 30);
    
    hideFeedbackModal();
    alert('Thank you for your feedback! 🌟');
}

// Mock data for demo
function getMockBooks() {
    return [
        {
            id: 1,
            title: "The Adventures of Sunny Bunny",
            author: "Emma Johnson",
            description: "Join Sunny Bunny on his magical adventure through the Enchanted Forest, where he makes new friends and learns about kindness.",
            genre: "adventure",
            ageGroup: "3-5",
            coverUrl: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=300&fit=crop",
            pdfUrl: "#",
            views: 1245,
            likes: 89,
            liked: false
        },
        {
            id: 2,
            title: "Counting with Colorful Cats",
            author: "Dr. Lisa Wang",
            description: "Learn numbers and colors with this interactive story featuring adorable cats in rainbow colors. Perfect for early learners!",
            genre: "educational",
            ageGroup: "2-4",
            coverUrl: "https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400&h=300&fit=crop",
            pdfUrl: "#",
            views: 892,
            likes: 67,
            liked: true
        },
        {
            id: 3,
            title: "Princess Luna's Starry Night",
            author: "Michael Chen",
            description: "A beautiful bedtime story about Princess Luna who collects stars to light up the night sky for all sleepy children.",
            genre: "fairy",
            ageGroup: "4-6",
            coverUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w-400&h=300&fit=crop",
            pdfUrl: "#",
            views: 1567,
            likes: 124,
            liked: false
        }
    ];
}