const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

// Import database configuration
const db = require('./config/database');
const initDatabase = require('./config/dbInit');

// Import routes
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Import middleware
const { authenticateAdmin } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Production security middleware
if (process.env.NODE_ENV === 'production') {
  // Set security headers
  app.use(helmet());
  
  // Compress responses
  app.use(compression());
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
  });
  
  // Apply rate limiting to all routes
  app.use(limiter);
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if (!origin) {
      return callback(null, true);
    }
    
    // List of allowed origins
    const allowedOrigins = [
      process.env.CLIENT_URL,           // Web client URL
      'capacitor://localhost',          // Capacitor mobile apps
      'ionic://localhost',              // Ionic framework
      'exp://localhost:19000',          // Expo
      'exp://localhost:19001',
      'http://localhost',               // Local development
      'http://localhost:5173',          // Vite dev server
      'http://192.168.1.7:5173'         // Local network IP (update as needed)
    ];
    
    // In development mode, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // In production, check if the origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
  // Allow all headers from mobile apps
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test database connection and initialize tables
db.authenticate()
  .then(() => {
    console.log('Database connection established successfully');
    return initDatabase();
  })
  .catch(err => console.error('Unable to connect to the database:', err));

// Basic route
app.get('/', (req, res) => {
  res.send('INTRA-HD API is running');
});

// API Routes
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // In production, you might want to gracefully shutdown
  // process.exit(1);
});
