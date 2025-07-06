# 🏋️ GymSaaS - Complete Membership Management System

A comprehensive SaaS platform for gym owners to manage memberships, track payments, monitor attendance, and grow their fitness business.

## 🌟 Features

### 🔐 Role-Based Access Control
- **Super Admin**: Complete system management and oversight
- **Gym Owners (Clients)**: Full gym management capabilities

### 🧑‍💼 Client (Gym Owner) Features
- ✅ Email & password signup with plan selection
- ✅ Comprehensive dashboard with analytics
- ✅ Complete member management (Add/Edit/Delete)
- ✅ Membership tracking with auto-status updates
- ✅ Advanced search and filtering
- ✅ Payment tracking (Amount, Method, UPI ID)
- ✅ Plan status monitoring with expiry alerts
- ✅ Access blocking on plan expiry
- ✅ CSV export functionality
- ✅ Smart reminders for expiring memberships
- ✅ QR code generation for members
- ✅ Attendance tracking system

### 💼 Super Admin Features
- ✅ Admin dashboard with comprehensive analytics
- ✅ Client account management
- ✅ Signup approval system
- ✅ Plan and pricing management
- ✅ Revenue tracking and reporting
- ✅ CSV export for all data
- ✅ Client subscription monitoring

### 💳 Plan & Payment System
- ✅ Multiple plans: Trial, Monthly, Yearly
- ✅ Plan selection during signup
- ✅ Payment tracking via UPI
- ✅ Manual payment confirmation
- ✅ Subscription management

### 🎁 Bonus Features
- ✅ QR code attendance system
- ✅ Member-specific QR codes
- ✅ Responsive design for mobile/tablet
- ✅ Modern, clean UI with Bootstrap
- ✅ Real-time data updates

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd membership-saas-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env file with your configurations
```

4. **Start the application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

5. **Access the application**
- Open your browser and go to `http://localhost:3000`
- Super Admin login: `admin@saas.com` / `secret`

## 📁 Project Structure

```
membership-saas-system/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── database/
│   ├── database.js        # Database setup and helpers
│   └── membership_saas.db # SQLite database (auto-created)
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── admin.js          # Super admin routes
│   ├── client.js         # Client dashboard routes
│   ├── members.js        # Member management routes
│   └── plans.js          # Plan management routes
├── middleware/
│   └── auth.js           # Authentication middleware
├── public/
│   ├── index.html        # Landing page
│   ├── login.html        # Login page
│   ├── signup.html       # Registration page
│   ├── css/
│   │   └── style.css     # Custom styles
│   └── js/
│       └── app.js        # Frontend JavaScript
└── README.md
```

## 🔧 Configuration

### Environment Variables

Key environment variables in `.env`:

```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
ADMIN_EMAIL=admin@saas.com
ADMIN_PASSWORD=secret
```

### Default Data

The system automatically creates:
- Super admin account (`admin@saas.com` / `secret`)
- Default subscription plans (Trial, Monthly, Yearly)
- Database tables and relationships

## 📊 Database Schema

### Core Tables
- `users` - Super admin and gym owner accounts
- `plans` - Subscription plans (Trial, Monthly, Yearly)
- `client_subscriptions` - Client plan subscriptions
- `members` - Gym members
- `member_payments` - Payment records
- `attendance` - QR code attendance tracking

## 🔌 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - Client registration
- `GET /api/auth/plans` - Get available plans

### Admin Endpoints (Super Admin Only)
- `GET /api/admin/dashboard` - Admin dashboard data
- `GET /api/admin/clients` - List all clients
- `PUT /api/admin/clients/:id/status` - Update client status
- `DELETE /api/admin/clients/:id` - Delete client

### Client Endpoints (Gym Owners)
- `GET /api/client/dashboard` - Client dashboard data
- `GET /api/client/profile` - Get client profile
- `PUT /api/client/profile` - Update client profile
- `GET /api/client/members/expiring` - Get expiring members

### Member Management
- `GET /api/members` - List members (with pagination/search)
- `POST /api/members` - Create new member
- `GET /api/members/:id` - Get member details
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Delete member
- `POST /api/members/:id/payments` - Add payment
- `POST /api/members/:id/extend` - Extend membership
- `POST /api/members/:id/attendance` - Mark attendance

## 🎨 Frontend Features

### Modern UI/UX
- Bootstrap 5 for responsive design
- Font Awesome icons
- Smooth animations and transitions
- Mobile-first approach

### Key Pages
- **Landing Page**: Feature showcase and pricing
- **Login/Signup**: Secure authentication
- **Admin Dashboard**: System overview and management
- **Client Dashboard**: Gym management interface
- **Member Management**: Complete CRUD operations

### Interactive Features
- Real-time form validation
- Dynamic plan selection
- QR code generation and display
- CSV export functionality
- Search and filtering

## 🔒 Security Features

- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- Rate limiting
- Input validation and sanitization
- SQL injection prevention
- XSS protection

## 📱 Mobile Responsiveness

- Fully responsive design
- Touch-friendly interface
- Optimized for tablets and smartphones
- Progressive Web App (PWA) ready

## 🚀 Deployment Options

### Option 1: Heroku
1. Create a Heroku app
2. Set environment variables
3. Deploy using Git:
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### Option 2: Railway
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically

### Option 3: DigitalOcean App Platform
1. Create a new app
2. Connect repository
3. Configure environment variables
4. Deploy

### Option 4: VPS/Self-Hosted
1. Set up Node.js on your server
2. Clone repository
3. Install dependencies
4. Configure environment
5. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js --name "gym-saas"
```

## 🔧 Production Setup

### Essential Production Steps
1. **Change JWT Secret**: Use a strong, unique secret
2. **Set NODE_ENV**: Set to `production`
3. **Configure HTTPS**: Use SSL certificates
4. **Set up Monitoring**: Use PM2 or similar
5. **Database Backups**: Regular SQLite backups
6. **Rate Limiting**: Configure appropriate limits

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-very-secure-production-secret
```

## 📊 Usage Analytics

### Super Admin Dashboard
- Total clients and revenue
- Monthly revenue trends
- Client signup statistics
- System health metrics

### Client Dashboard
- Member statistics (total, active, expired)
- Revenue tracking
- Expiring memberships alerts
- Recent activities

## 🎯 Business Model

### Revenue Streams
- Monthly subscriptions (₹999/month)
- Annual subscriptions (₹9999/year)
- Trial to paid conversions

### Target Market
- Independent gym owners
- Fitness studios
- Personal trainers
- Small to medium fitness centers

## 🛠️ Development

### Available Scripts
```bash
npm start      # Start production server
npm run dev    # Start development server with nodemon
npm run setup  # Initialize database and default data
```

### Adding New Features
1. Create API endpoints in appropriate route files
2. Add middleware for authentication/validation
3. Update database schema if needed
4. Create frontend components
5. Test thoroughly

## 📈 Future Enhancements

### Planned Features
- [ ] WhatsApp/SMS notifications
- [ ] Online payment integration (Razorpay/Stripe)
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-gym chain support
- [ ] Inventory management
- [ ] Trainer management
- [ ] Class scheduling
- [ ] Member mobile app

### Technical Improvements
- [ ] Redis caching
- [ ] PostgreSQL migration option
- [ ] Docker containerization
- [ ] Automated testing suite
- [ ] CI/CD pipeline

## 🐛 Troubleshooting

### Common Issues

**Database not created**
```bash
# Delete existing database and restart
rm database/membership_saas.db
npm start
```

**Permission errors**
```bash
# Fix file permissions
chmod -R 755 .
```

**Port already in use**
```bash
# Change port in .env file
PORT=3001
```

**Login issues**
- Verify email/password combination
- Check if account is approved (for clients)
- Ensure subscription is active

## 📞 Support

### Getting Help
- Check the troubleshooting section
- Review error logs in the console
- Verify environment configuration
- Test with demo credentials

### Demo Credentials
- **Super Admin**: `admin@saas.com` / `secret`

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🎉 Acknowledgments

- Bootstrap for the UI framework
- Font Awesome for icons
- Node.js and Express.js communities
- SQLite for the lightweight database
- All the amazing open-source libraries used

---

**Built with ❤️ for gym owners who want to focus on fitness, not paperwork.**