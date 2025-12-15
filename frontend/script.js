// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let books = [];

// Update the loadBooks function:
async function loadBooks() {
    try {
        booksContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        
        const response = await fetch(`${API_BASE_URL}/books`);
        const result = await response.json();
        
        if (result.success) {
            books = result.data;
            displayBooks(books);
            updateTotalBooksCount();
            
            // Load stats
            const statsResponse = await fetch(`${API_BASE_URL}/stats`);
            const statsResult = await statsResponse.json();
            if (statsResult.success) {
                totalViewsElement.textContent = statsResult.data.totalViews.toLocaleString();
                totalBooksElement.textContent = statsResult.data.totalBooks.toLocaleString();
            }
        }
    } catch (error) {
        console.error('Error:', error);
        booksContainer.innerHTML = '<p class="error">Failed to load books. Make sure backend is running at http://localhost:3000</p>';
    }
}

// Update handleBookUpload function:
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
        const response = await fetch(`${API_BASE_URL}/books`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Book uploaded successfully!');
            hideUploadForm();
            loadBooks(); // Reload books
        } else {
            alert('Upload failed: ' + result.error);
        }
    } catch (error) {
        alert('Upload failed: ' + error.message);
    }
}