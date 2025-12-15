-- =============================================
-- Database: kids_books_world
-- Description: Database schema for Kid's Story World
-- Created: 2024
-- =============================================

-- Create database
CREATE DATABASE IF NOT EXISTS kids_books_world;
USE kids_books_world;

-- =============================================
-- Table: books
-- Stores all story books information
-- =============================================
CREATE TABLE books (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    genre ENUM('fairy', 'animal', 'adventure', 'educational', 'bedtime', 'fantasy', 'science', 'moral') NOT NULL,
    age_group ENUM('2-4', '5-7', '8-10', 'all') NOT NULL DEFAULT 'all',
    
    -- File paths
    cover_filename VARCHAR(255) NOT NULL,
    pdf_filename VARCHAR(255) NOT NULL,
    cover_url VARCHAR(500) GENERATED ALWAYS AS (CONCAT('/api/static/covers/', cover_filename)) STORED,
    pdf_url VARCHAR(500) GENERATED ALWAYS AS (CONCAT('/api/static/pdfs/', pdf_filename)) STORED,
    
    -- Engagement metrics
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    read_count INT DEFAULT 0,
    
    -- Metadata
    tags JSON,
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_genre (genre),
    INDEX idx_age_group (age_group),
    INDEX idx_created_at (created_at),
    INDEX idx_views (views DESC),
    INDEX idx_likes (likes DESC),
    FULLTEXT idx_search (title, author, description, tags)
);

-- =============================================
-- Table: comments
-- Stores user comments on books
-- =============================================
CREATE TABLE comments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    book_id VARCHAR(36) NOT NULL,
    
    -- Comment details
    author_name VARCHAR(100) DEFAULT 'Anonymous',
    author_email VARCHAR(255),
    comment TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key and indexes
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_book_id (book_id),
    INDEX idx_created_at (created_at DESC)
);

-- =============================================
-- Table: feedback
-- Stores user feedback after reading books
-- =============================================
CREATE TABLE feedback (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    book_id VARCHAR(36) NOT NULL,
    
    -- Rating details
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    
    -- User/device identification
    device_id VARCHAR(255) NOT NULL,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key and indexes
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE KEY unique_device_feedback (book_id, device_id), -- Prevent duplicate feedback
    INDEX idx_book_rating (book_id, rating),
    INDEX idx_created_at (created_at DESC)
);

-- =============================================
-- Table: views_tracking
-- Tracks detailed view statistics
-- =============================================
CREATE TABLE views_tracking (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- View details
    book_id VARCHAR(36),
    device_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    
    -- Device/geo info (anonymized)
    user_agent TEXT,
    referrer VARCHAR(500),
    
    -- Timestamps
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key and indexes
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
    INDEX idx_book_views (book_id, viewed_at),
    INDEX idx_daily_views (DATE(viewed_at)),
    INDEX idx_device_views (device_id, viewed_at)
);

-- =============================================
-- Table: likes
-- Tracks individual likes to prevent duplicate likes
-- =============================================
CREATE TABLE likes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    book_id VARCHAR(36) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite unique constraint
    UNIQUE KEY unique_device_like (book_id, device_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_book_likes (book_id)
);

-- =============================================
-- Table: genres
-- Master table for book genres
-- =============================================
CREATE TABLE genres (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    color VARCHAR(7) DEFAULT '#6a5acd',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Table: website_stats
-- Aggregated website statistics
-- =============================================
CREATE TABLE website_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stat_date DATE UNIQUE NOT NULL,
    
    -- Daily metrics
    total_views INT DEFAULT 0,
    unique_visitors INT DEFAULT 0,
    books_read INT DEFAULT 0,
    books_uploaded INT DEFAULT 0,
    feedback_count INT DEFAULT 0,
    
    -- Calculated metrics
    avg_rating DECIMAL(3,2),
    most_popular_book_id VARCHAR(36),
    
    -- Timestamps
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (most_popular_book_id) REFERENCES books(id) ON DELETE SET NULL,
    INDEX idx_stat_date (stat_date DESC)
);

-- =============================================
-- Table: uploads_log
-- Logs all file uploads for audit
-- =============================================
CREATE TABLE uploads_log (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    book_id VARCHAR(36),
    filename VARCHAR(255) NOT NULL,
    file_type ENUM('cover', 'pdf') NOT NULL,
    file_size BIGINT,
    upload_ip VARCHAR(45),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
    INDEX idx_upload_date (uploaded_at DESC)
);

-- =============================================
-- Views for easier data access
-- =============================================

-- View: book_overview
CREATE VIEW book_overview AS
SELECT 
    b.id,
    b.title,
    b.author,
    b.genre,
    b.age_group,
    b.views,
    b.likes,
    b.read_count,
    b.cover_url,
    b.pdf_url,
    b.created_at,
    
    -- Aggregated feedback
    COALESCE(AVG(f.rating), 0) as avg_rating,
    COUNT(DISTINCT f.id) as feedback_count,
    
    -- Recent comments count
    COUNT(DISTINCT c.id) as comments_count,
    
    -- Popularity score
    (b.views * 0.4 + b.likes * 0.3 + b.read_count * 0.3) as popularity_score
    
FROM books b
LEFT JOIN feedback f ON b.id = f.book_id
LEFT JOIN comments c ON b.id = c.book_id AND c.is_approved = TRUE
WHERE b.is_active = TRUE
GROUP BY b.id;

-- View: daily_stats
CREATE VIEW daily_stats AS
SELECT 
    DATE(viewed_at) as view_date,
    COUNT(*) as total_views,
    COUNT(DISTINCT device_id) as unique_devices,
    COUNT(DISTINCT book_id) as unique_books_viewed
FROM views_tracking
GROUP BY DATE(viewed_at)
ORDER BY view_date DESC;

-- =============================================
-- Sample Data (Optional - for testing)
-- =============================================

-- Insert sample genres
INSERT INTO genres (code, name, description, icon, color, sort_order) VALUES
('fairy', 'Fairy Tales', 'Magical stories with princesses, fairies, and magical creatures', 'fairy', '#ff9f43', 1),
('animal', 'Animal Stories', 'Fun adventures with animal characters', 'paw', '#00cec9', 2),
('adventure', 'Adventure', 'Exciting journeys and discoveries', 'compass', '#e17055', 3),
('educational', 'Educational', 'Learning stories with numbers, letters, and facts', 'book', '#6c5ce7', 4),
('bedtime', 'Bedtime Stories', 'Calming tales for sleepy time', 'moon', '#0984e3', 5),
('fantasy', 'Fantasy', 'Imaginative worlds and magical adventures', 'dragon', '#d63031', 6),
('science', 'Science', 'STEM stories and scientific discoveries', 'flask', '#00b894', 7),
('moral', 'Moral Stories', 'Stories teaching values and life lessons', 'heart', '#fd79a8', 8);

-- Insert sample book (adjust filenames as needed)
INSERT INTO books (title, author, description, genre, age_group, cover_filename, pdf_filename) VALUES
('The Adventures of Sunny Bunny', 'Emma Johnson', 'Join Sunny Bunny on his magical adventure through the Enchanted Forest', 'animal', '3-5', 'sunny-bunny.jpg', 'sunny-bunny.pdf'),
('Counting with Colorful Cats', 'Dr. Lisa Wang', 'Learn numbers and colors with adorable rainbow cats', 'educational', '2-4', 'colorful-cats.jpg', 'colorful-cats.pdf'),
('Princess Luna''s Starry Night', 'Michael Chen', 'A beautiful bedtime story about collecting stars', 'fairy', '4-6', 'princess-luna.jpg', 'princess-luna.pdf');

-- =============================================
-- Stored Procedures
-- =============================================

-- Procedure: Update book likes
DELIMITER //
CREATE PROCEDURE update_book_likes(
    IN p_book_id VARCHAR(36),
    IN p_device_id VARCHAR(255)
)
BEGIN
    DECLARE already_liked BOOLEAN;
    
    START TRANSACTION;
    
    -- Check if already liked
    SELECT COUNT(*) > 0 INTO already_liked 
    FROM likes 
    WHERE book_id = p_book_id AND device_id = p_device_id;
    
    IF already_liked THEN
        -- Unlike: remove like record and decrement count
        DELETE FROM likes 
        WHERE book_id = p_book_id AND device_id = p_device_id;
        
        UPDATE books 
        SET likes = GREATEST(0, likes - 1) 
        WHERE id = p_book_id;
        
        SELECT 'unliked' as action, 
               (SELECT likes FROM books WHERE id = p_book_id) as total_likes;
    ELSE
        -- Like: add like record and increment count
        INSERT INTO likes (book_id, device_id) 
        VALUES (p_book_id, p_device_id);
        
        UPDATE books 
        SET likes = likes + 1 
        WHERE id = p_book_id;
        
        SELECT 'liked' as action, 
               (SELECT likes FROM books WHERE id = p_book_id) as total_likes;
    END IF;
    
    COMMIT;
END //
DELIMITER ;

-- Procedure: Track view with device
DELIMITER //
CREATE PROCEDURE track_book_view(
    IN p_book_id VARCHAR(36),
    IN p_device_id VARCHAR(255),
    IN p_user_agent TEXT,
    IN p_referrer VARCHAR(500)
)
BEGIN
    -- Insert view tracking record
    INSERT INTO views_tracking (book_id, device_id, user_agent, referrer)
    VALUES (p_book_id, p_device_id, p_user_agent, p_referrer);
    
    -- Update book view count
    UPDATE books 
    SET views = views + 1 
    WHERE id = p_book_id;
    
    -- Update daily stats
    INSERT INTO website_stats (stat_date, total_views)
    VALUES (CURDATE(), 1)
    ON DUPLICATE KEY UPDATE 
        total_views = total_views + 1,
        updated_at = CURRENT_TIMESTAMP;
    
    SELECT 'view_tracked' as status;
END //
DELIMITER ;

-- =============================================
-- Triggers
-- =============================================

-- Trigger: Update website_stats when feedback is added
DELIMITER //
CREATE TRIGGER after_feedback_insert
AFTER INSERT ON feedback
FOR EACH ROW
BEGIN
    -- Update average rating in website_stats
    UPDATE website_stats ws
    JOIN (
        SELECT 
            CURDATE() as stat_date,
            AVG(rating) as new_avg_rating,
            COUNT(*) as new_feedback_count
        FROM feedback
        WHERE DATE(created_at) = CURDATE()
    ) daily ON ws.stat_date = daily.stat_date
    SET 
        ws.avg_rating = daily.new_avg_rating,
        ws.feedback_count = daily.new_feedback_count,
        ws.updated_at = CURRENT_TIMESTAMP
    ON DUPLICATE KEY UPDATE 
        avg_rating = VALUES(avg_rating),
        feedback_count = VALUES(feedback_count),
        updated_at = VALUES(updated_at);
END //
DELIMITER ;

-- Trigger: Log file uploads
DELIMITER //
CREATE TRIGGER after_book_insert
AFTER INSERT ON books
FOR EACH ROW
BEGIN
    -- Log cover upload
    INSERT INTO uploads_log (book_id, filename, file_type, file_size)
    VALUES (NEW.id, NEW.cover_filename, 'cover', NULL);
    
    -- Log PDF upload
    INSERT INTO uploads_log (book_id, filename, file_type, file_size)
    VALUES (NEW.id, NEW.pdf_filename, 'pdf', NULL);
END //
DELIMITER ;

-- =============================================
-- User Management (for future expansion)
-- =============================================
/*
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    role ENUM('admin', 'moderator', 'user', 'child') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
);
*/

-- =============================================
-- Database Users and Permissions
-- =============================================

-- Create application user (for production)
/*
CREATE USER 'kidsbooks_app'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT SELECT, INSERT, UPDATE, DELETE ON kids_books_world.* TO 'kidsbooks_app'@'localhost';
GRANT EXECUTE ON PROCEDURE kids_books_world.* TO 'kidsbooks_app'@'localhost';

-- Create read-only user for analytics
CREATE USER 'kidsbooks_readonly'@'localhost' IDENTIFIED BY 'another_strong_password';
GRANT SELECT ON kids_books_world.* TO 'kidsbooks_readonly'@'localhost';
GRANT SELECT ON kids_books_world.book_overview TO 'kidsbooks_readonly'@'localhost';
GRANT SELECT ON kids_books_world.daily_stats TO 'kidsbooks_readonly'@'localhost';
*/