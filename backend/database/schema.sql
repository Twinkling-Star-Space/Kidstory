-- Simplified schema for quick setup
CREATE DATABASE IF NOT EXISTS kids_books_world;
USE kids_books_world;

-- Main tables only
CREATE TABLE books (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT,
    genre VARCHAR(50),
    age_group VARCHAR(20),
    cover_url VARCHAR(500),
    pdf_url VARCHAR(500),
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
    id VARCHAR(36) PRIMARY KEY,
    book_id VARCHAR(36),
    author VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feedback (
    id VARCHAR(36) PRIMARY KEY,
    book_id VARCHAR(36),
    rating INT,
    device_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);