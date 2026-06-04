# POS System - Point of Sale Application

A production-ready Point of Sale (POS) web application built with React, Node.js, Express, SQLite, and Prisma.

## Features

### 🔐 Authentication
- JWT-based authentication with bcrypt password hashing
- Role-based access control (Admin / Cashier)
- Remember me functionality
- Session persistence

### 👑 Admin Features
- **Dashboard**: Real-time analytics with charts (daily/weekly/monthly sales, top products, category breakdown, payment methods)
- **Product Management**: Full CRUD with inventory tracking, stock alerts, and search
- **Category Management**: Organize products by categories
- **User Management**: Manage cashiers, activate/deactivate, reset passwords
- **Transaction Management**: View, search, filter, and refund transactions
- **Reports**: Daily, weekly, monthly sales, inventory, product sales, cashier performance, profit & loss
- **Settings**: Store information, tax rate, currency, database backup

### 💳 Cashier Features
- **POS Interface**: Fast product grid with search, barcode scanner support, category filtering
- **Shopping Cart**: Add/remove items, adjust quantities, apply discounts
- **Checkout**: Multiple payment methods (Cash, M-Pesa, Debit Card, Credit Card)
- **Receipt**: Printable receipts with store details

### 🎨 UI/UX
- Modern, responsive design (mobile, tablet, desktop)
- Dark mode / Light mode with local storage persistence
- Toast notifications for feedback
- Loading indicators
- Confirmation dialogs
- Clean typography and professional color palette

## Tech Stack

### Frontend
- React 19+ with Vite
- React Router v7
- Tailwind CSS v4
- Recharts for analytics
- Axios for API requests
- React Hot Toast for notifications
- React Icons & Lucide React

### Backend
- Node.js with Express.js
- SQLite database with Prisma ORM
- JWT authentication
- bcrypt password hashing
- Helmet for security headers
- Rate limiting
- CORS support

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd pos-system
```

### 2. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js
npm start
```

The backend will start on http://localhost:5000

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend will start on http://localhost:3000

## Default Users

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Cashier | `cashier` | `cashier123` |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Products
- `GET /api/products` - List products (with search, filter, pagination)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)
- `GET /api/products/:id/inventory-logs` - Get inventory history

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (Admin)
- `PUT /api/categories/:id` - Update category (Admin)
- `DELETE /api/categories/:id` - Delete category (Admin)

### Users
- `GET /api/users` - List users (Admin)
- `POST /api/users` - Create user (Admin)
- `PUT /api/users/:id` - Update user (Admin)
- `DELETE /api/users/:id` - Deactivate user (Admin)
- `GET /api/users/activity-logs` - Get activity logs (Admin)

### Transactions
- `GET /api/transactions` - List transactions (with search, filter, pagination)
- `GET /api/transactions/:id` - Get transaction details
- `POST /api/transactions` - Create transaction (checkout)
- `POST /api/transactions/:id/refund` - Refund transaction (Admin)

### Reports
- `GET /api/reports/daily-sales` - Daily sales report
- `GET /api/reports/weekly-sales` - Weekly sales report
- `GET /api/reports/monthly-sales` - Monthly sales report
- `GET /api/reports/product-sales` - Product sales report
- `GET /api/reports/inventory` - Inventory report
- `GET /api/reports/cashier-performance` - Cashier performance report
- `GET /api/reports/profit-loss` - Profit & loss report

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics (Admin)

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings (Admin)
- `POST /api/settings/backup` - Backup database (Admin)

## Database

The application uses SQLite with Prisma ORM. The database file is located at `backend/prisma/dev.db`.

### Models
- **User** - Admin and cashier accounts
- **Product** - Inventory items with pricing and stock
- **Category** - Product categories
- **Transaction** - Sales transactions with payment info
- **TransactionItem** - Individual items within a transaction
- **InventoryLog** - Stock change history
- **ActivityLog** - User activity audit trail
- **Setting** - Store configuration

### Backup
```bash
# Via the Settings page UI, or manually:
cp backend/prisma/dev.db backend/backups/backup-$(date +%Y%m%d).db
```

## Project Structure

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.js            # Seed data
│   └── src/
│       ├── index.js           # Express server
│       ├── middleware/
│       │   └── auth.js        # JWT authentication
│       └── routes/
│           ├── auth.js        # Authentication routes
│           ├── products.js    # Product management
│           ├── categories.js  # Category management
│           ├── users.js       # User management
│           ├── transactions.js # Transaction management
│           ├── reports.js     # Reports generation
│           ├── dashboard.js   # Dashboard analytics
│           └── settings.js    # Settings management
├── frontend/
│   └── src/
│       ├── App.jsx            # Main app with routing
│       ├── main.jsx           # Entry point
│       ├── index.css          # Tailwind CSS
│       ├── contexts/
│       │   ├── AuthContext.jsx # Authentication state
│       │   └── ThemeContext.jsx # Dark/light theme
│       ├── components/
│       │   ├── Layout.jsx     # Main layout with sidebar
│       │   └── ProtectedRoute.jsx # Route protection
│       ├── pages/
│       │   ├── Login.jsx      # Login page
│       │   ├── Dashboard.jsx  # Admin dashboard
│       │   ├── Products.jsx   # Product management
│       │   ├── Categories.jsx # Category management
│       │   ├── Users.jsx      # User management
│       │   ├── Transactions.jsx # Transaction history
│       │   ├── Reports.jsx    # Reports
│       │   ├── POS.jsx        # Cashier POS interface
│       │   └── Settings.jsx   # Store settings
│       └── services/
│           └── api.js         # Axios API service
└── README.md
```

## Security

- JWT tokens for authentication
- bcrypt for password hashing
- Helmet for HTTP security headers
- Rate limiting on API routes
- XSS protection
- CORS configured
- SQL injection protection via Prisma ORM
- Role-based access control

## License

MIT
