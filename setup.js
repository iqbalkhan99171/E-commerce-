#!/usr/bin/env node

/**
 * Setup script for Membership SaaS System
 * This script initializes the database and creates default data
 */

const path = require('path');
const fs = require('fs');

console.log('🏋️  GymSaaS - Membership Management System Setup');
console.log('================================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('⚠️  No .env file found. Creating from .env.example...');
    
    const envExamplePath = path.join(__dirname, '.env.example');
    if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ .env file created successfully!');
        console.log('📝 Please edit the .env file with your configurations.\n');
    } else {
        console.log('❌ .env.example file not found. Creating basic .env file...');
        
        const basicEnv = `# Membership SaaS System Environment Variables
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production-to-something-very-secure
ADMIN_EMAIL=admin@saas.com
ADMIN_PASSWORD=secret
`;
        fs.writeFileSync(envPath, basicEnv);
        console.log('✅ Basic .env file created successfully!\n');
    }
}

// Load environment variables
require('dotenv').config();

// Initialize database
console.log('🗄️  Initializing database...');
try {
    const database = require('./database/database');
    console.log('✅ Database initialized successfully!');
    console.log('📊 Default data created:\n');
    console.log('   👤 Super Admin: admin@saas.com / secret');
    console.log('   📋 Plans: Trial, Monthly (₹999), Yearly (₹9999)\n');
} catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
}

// Check if all required directories exist
const requiredDirs = ['database', 'routes', 'middleware', 'public'];
const missingDirs = requiredDirs.filter(dir => !fs.existsSync(path.join(__dirname, dir)));

if (missingDirs.length > 0) {
    console.log('⚠️  Missing directories:', missingDirs.join(', '));
    
    // Create missing directories
    missingDirs.forEach(dir => {
        fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
    });
}

// Verify critical files
const criticalFiles = [
    'server.js',
    'package.json',
    'database/database.js',
    'routes/auth.js',
    'middleware/auth.js',
    'public/index.html'
];

const missingFiles = criticalFiles.filter(file => !fs.existsSync(path.join(__dirname, file)));

if (missingFiles.length > 0) {
    console.log('❌ Missing critical files:');
    missingFiles.forEach(file => console.log(`   - ${file}`));
    console.log('\nPlease ensure all files are properly copied.\n');
    process.exit(1);
}

console.log('🎉 Setup completed successfully!\n');
console.log('🚀 To start the application:');
console.log('   npm start          # Production mode');
console.log('   npm run dev        # Development mode\n');
console.log('🌐 Access your application at: http://localhost:' + (process.env.PORT || 3000));
console.log('👤 Login as Super Admin: admin@saas.com / secret\n');
console.log('📚 Check README.md for detailed documentation.');
console.log('================================================');
console.log('✨ Happy gym management! 🏋️‍♀️🏋️‍♂️');