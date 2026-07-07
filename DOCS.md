# Bythebuzz POS System — User Guide

> A modern, full-featured Point of Sale (POS) desktop application for managing sales, inventory, staff, and reporting.

---

## 📖 Table of Contents

1. [Getting Started](#-getting-started)
2. [Login & Authentication](#-login--authentication)
3. [Dashboard (Admin)](#-dashboard-admin)
4. [Products Management](#-products-management)
5. [Categories Management](#-categories-management)
6. [Users Management](#-users-management)
7. [Point of Sale (POS) Interface](#-point-of-sale-pos-interface)
8. [Transactions](#-transactions)
9. [Reports](#-reports)
10. [Settings](#-settings)
11. [Barcode Scanner Support](#-barcode-scanner-support)
12. [M-Pesa Integration](#-mpesa-integration)
13. [Keyboard Shortcuts & Tips](#-keyboard-shortcuts--tips)
14. [Troubleshooting](#-troubleshooting)

---

## 🚀 Getting Started

### Installation

**Desktop App (Recommended):**
1. Download the latest installer from the releases page
2. Run the installer and follow the on-screen instructions
3. Launch "Bythebuzz POS" from your Start Menu or Desktop

**Browser Version (Development):**
```bash
# Terminal 1 — Start the backend
cd backend
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js
npm start
# Backend runs on http://localhost:5000

# Terminal 2 — Start the frontend
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| **Admin** | `admin` | `admin123` |
| **Cashier** | `cashier` | `cashier123` |

> ⚠️ **Important:** Change your password immediately after first login.

---

## 🧭 Navigating the App

Once logged in, the **sidebar** on the left side of the screen is your main navigation menu:

| Section | Icon | Who Can Access |
|---------|------|----------------|
| **Dashboard** | 📊 | Admin only |
| **POS** (Point of Sale) | 💳 | Everyone |
| **Products** | 📦 | Everyone (add/edit/delete: Admin only) |
| **Categories** | 🏷️ | Everyone (add/edit/delete: Admin only) |
| **Users** | 👥 | Admin only |
| **Transactions** | 📋 | Everyone (refund: Admin only) |
| **Reports** | 📈 | Admin only |
| **Settings** | ⚙️ | Admin only |

Click any section name or icon in the sidebar to navigate. The current page is highlighted.

---

## 🔐 Login & Authentication

The login screen is your entry point to the system.

### How to Login
1. Enter your **Username**
2. Enter your **Password**
3. Check **"Remember Me"** if you want to stay logged in longer
4. Click **Login**

### Role-Based Access
- **Admin** — Full access to all features: dashboard, products, categories, users, transactions, reports, settings
- **Cashier** — Limited to the POS interface and viewing transactions

### Changing Your Password
1. Click your name/profile icon in the sidebar bottom
2. Select **Change Password**
3. Enter your current password and new password
4. Click **Save**

### Session & Security
- Sessions expire after 7 days by default
- Deactivated accounts cannot log in
- All login attempts are logged in the activity log

---

## 📊 Dashboard (Admin)

The dashboard gives you a real-time overview of your store's performance.

### Summary Cards (Top)
- **Today's Sales** — Total revenue today
- **Weekly Sales** — Total revenue this week
- **Monthly Sales** — Total revenue this month
- **Total Products** — Number of products in inventory
- **Low Stock Items** — Products below their reorder level (⚠️ watch these!)
- **Active Cashiers** — Number of active cashier accounts
- **Categories** — Total product categories
- **Total Revenue** — All-time revenue

### Charts & Graphs
The dashboard features interactive charts that update automatically:

| Chart | What it shows |
|-------|--------------|
| **Daily Sales (7 days)** | Bar chart of sales for each of the last 7 days |
| **Hourly Sales (Today)** | How sales break down by hour today |
| **Weekly Sales by Day** | Current week's sales, Monday through Sunday |
| **Monthly Sales by Week** | Monthly sales grouped into 4 weekly buckets |
| **Yearly Sales by Month** | Sales across every month of the current year |
| **Top Selling Products** | Best-selling products ranked by quantity sold |
| **Sales by Category** | Revenue breakdown by product category |
| **Payment Methods** | Pie/bar chart showing cash vs M-Pesa vs card |
| **Recent Transactions** | Latest 10 transactions with quick-view |

> 💡 **Tip:** Use the date range filter at the top of the charts section to view historical data.

---

## 📦 Products Management

The Products page is where you manage your entire inventory.

### Viewing Products
- Products are displayed in a table with **image**, **name**, **SKU**, **category**, **pricing**, **quantity**, and **stock status**
- **Stock status badges:**
  - 🟢 **In Stock** — Quantity is above reorder level
  - 🟡 **Low Stock** — Quantity is at or below reorder level
  - 🔴 **Out of Stock** — Quantity is zero
- Products are sorted by stock status (out of stock first, then low stock)

### Searching & Filtering
- **Search bar** — Search by product name, SKU, or barcode
- **Category filter** — Filter to show only products in a specific category
- Results update instantly as you type

### Adding a Product
1. Click **"+ Add Product"** button
2. Fill in the form:
   - **Name** (required) — Product display name
   - **SKU** (required) — Stock Keeping Unit (unique identifier)
   - **Barcode** — Scan or type the barcode number
   - **Description** — Optional product description
   - **Product Image** — Upload an image (JPEG, PNG, GIF, WebP, max 5MB)
   - **Category** (required) — Select a category
   - **Cost Price** — Your purchase cost
   - **Retail Price** (required) — Customer selling price
   - **Wholesale Price** (required) — Bulk/wholesale price
   - **Initial Quantity** — Starting stock level
   - **Reorder Level** — When stock drops to this number, it's flagged as low
3. Click **Create**

### Editing a Product
Click the ✏️ icon on any product row to edit. The form will be pre-filled with existing data.

### Adding Stock
1. Click the 📦 icon on a product row
2. Enter the quantity to add
3. Click **"Add Stock"**

The system logs all stock additions so you have a complete inventory history.

### Deleting a Product
1. Click the 🗑️ icon on a product row
2. Confirm the deletion in the dialog
3. The product is permanently removed

> ⚠️ **Note:** Deletion cannot be undone.

---

## 🏷️ Categories Management

Categories help you organize products into logical groups.

### Viewing Categories
Categories are displayed as cards showing:
- **Category name**
- **Description**
- **Product count** — How many products belong to this category

You can use the search bar on the page to quickly filter categories by name.

### Adding a Category
1. Click **"+ Add Category"**
2. Enter a **Name** (required) and optional **Description**
3. Click **Create**

### Editing a Category
Click the ✏️ icon on any category card to edit its name or description.

### Deleting a Category
1. Click the 🗑️ icon on a category card
2. Confirm the deletion

> ⚠️ **Note:** You cannot delete a category that still has products assigned to it. Move or delete those products first.

---

## 👥 Users Management

Manage cashier and admin accounts.

### Viewing Users
The users table shows:
- **Name**, **Username**, **Email**
- **Role** — Admin or Cashier
- **Status** — Active (🟢) or Inactive (🔴)
- **Last Login** — When they last logged in

Use the search bar to find a user by name, username, or email.

### Adding a User
1. Click **"+ Add User"**
2. Fill in: **Name**, **Username**, **Email**, **Role**, and **Password**
3. Click **Create**

### Editing a User
Click the ✏️ icon to edit a user's details. You can also reset their password here.

### Deactivating / Activating a User
- Click the 🔒 icon to **deactivate** a user — they will no longer be able to log in
- Click the 🔓 icon to **reactivate** a deactivated user

> 💡 **Tip:** Instead of deleting users, deactivate them. This preserves transaction history while preventing access.

### Activity Logs
Admins can view a full audit trail of all user actions:
- Login/logout events
- Product CRUD operations
- Transaction creation and refunds
- Category management
- Settings changes

---

## 💳 Point of Sale (POS) Interface

The POS interface is the heart of the system — where cashiers ring up sales.

### Layout

```
┌─────────────────────────────────────────────────┐
│  🔍 Search products...    [Category Filter ▼]   │
├──────────────────────┬──────────────────────────┤
│                      │    Current Cart           │
│   Product Grid       │   ┌──────────────────┐   │
│   ┌───┐ ┌───┐ ┌───┐ │   │ Item  x2  KSh 300│   │
│   │ P │ │ P │ │ P │ │   │ Item  x1  KSh 150│   │
│   └───┘ └───┘ └───┘ │   │                  │   │
│   ┌───┐ ┌───┐ ┌───┐ │   │ Subtotal  KSh 450│   │
│   │ P │ │ P │ │ P │ │   │ Discount  KSh  0 │   │
│   └───┘ └───┘ └───┘ │   │ Tax(16%) KSh 72 │   │
│                      │   │ ─────────────────│   │
│                      │   │ Total     KSh 522│   │
│                      │   └──────────────────┘   │
│                      │   [Checkout ▼]           │
├──────────────────────┴──────────────────────────┤
│  📡 Mobile Scanner Connected │  Items: 2  │ 💰 │
└─────────────────────────────────────────────────┘
```

### Adding Items to Cart

**Method 1: Click products in the grid**
- Click a product card to add 1 unit
- Each product card shows: name, retail price, and stock status

**Method 2: Search and select**
- Type in the search bar to find products by name, SKU, or barcode
- Click a search result to add it to the cart

**Method 3: Barcode scanner**
- Scan a barcode with a connected scanner to instantly add the product

### Managing the Cart
- **Increase quantity** — Click the **+** button next to an item
- **Decrease quantity** — Click the **-** button (removes the item at zero)
- **Remove item** — Click the delete icon
- **Set pricing type** — Toggle between **Retail** and **Wholesale** pricing per item

### Applying Discounts
- Enter a discount amount in the **Discount** field
- The discount is subtracted from the subtotal before tax

### Checkout Process

1. Review the cart to ensure everything is correct
2. Click **Checkout** to open the payment modal
3. Select a **Payment Method**:

#### Cash
- Enter the amount tendered
- The system calculates and displays **change** due

#### M-Pesa (Mobile Money)
1. Enter the customer's **phone number** (e.g., 0712345678)
2. Click **"Push STK"** to send a payment request to the customer's phone
3. The customer enters their M-Pesa PIN on their phone
4. The system **polls** and waits for confirmation — you'll see a waiting screen
5. Once confirmed, the transaction completes automatically

**Split Payment (M-Pesa + Cash):**
- If the customer wants to pay partially with M-Pesa and partially with cash:
  1. Enter the M-Pesa amount
  2. Enter the cash amount
  3. The system handles both simultaneously
  4. Inventory is deducted immediately (since cash is collected)

#### Debit Card / Credit Card
- Record the card payment as a completed transaction

### Completing the Sale
- After payment, the system shows a **receipt** with all transaction details
- Click **Print Receipt** to get a physical copy
- The inventory is automatically updated

### Transaction States

| State | Badge | Description |
|-------|-------|-------------|
| Completed | 🟢 Completed | Payment received, inventory deducted |
| Pending M-Pesa | 🟡 Pending | M-Pesa sent, waiting for customer confirmation |
| Failed | 🔴 Failed | M-Pesa was cancelled or failed |
| Refunded | 🔵 Refunded | Transaction was refunded, inventory restored |
| Mixed | 🟣 Mixed | Split payment (M-Pesa + Cash) completed |

---

## 📋 Transactions

View, search, and manage all sales transactions.

### Viewing Transactions
The transactions list shows:
- **Receipt #** — Unique receipt identifier
- **Invoice #** — Unique invoice identifier
- **Date & Time** — When the transaction occurred
- **Cashier** — Who processed the sale
- **Items** — Number of items purchased
- **Total** — Transaction total
- **Payment** — Payment method used
- **Status** — Current transaction state
- **Actions** — View details, refund, etc.

### Searching & Filtering
- **Search** — Find by receipt number or invoice number
- **Date Range** — Filter by start and end date
- **Cashier** — Filter by who processed the sale
- **Status** — Filter by transaction status

### Viewing Transaction Details
Click on any transaction to see its full details:
- All items purchased with quantities and prices
- Payment breakdown
- Cashier information
- Notes (if any)

### Refunding a Transaction (Admin only)
1. Find the transaction
2. Click the **Refund** button
3. Confirm the refund
4. The system **restores inventory** for all items
5. The transaction status changes to "Refunded"

> ⚠️ **Note:** Only completed transactions can be refunded. Already refunded transactions cannot be refunded again.

### Managing Pending M-Pesa Transactions
If a customer's M-Pesa payment doesn't come through:
1. You can **retry** the STK push
2. You can **complete manually** (e.g., if the customer pays cash instead)
3. You can **cancel** the transaction

---

## 📈 Reports

Generate detailed reports to understand your business performance.

### Available Reports

| Report | What it shows |
|--------|--------------|
| **Daily Sales** | Transactions and totals for a specific day, with payment method and cashier breakdowns |
| **Weekly Sales** | Sales data for a date range, grouped by day |
| **Monthly Sales** | Yearly sales grouped by month |
| **Product Sales** | Which products sell the most — ranked by quantity and revenue |
| **Inventory Report** | Complete stock overview with values, low stock alerts, and out-of-stock items |
| **Cashier Performance** | How each cashier is performing — transactions, sales totals, average transaction value |
| **Profit & Loss** | Revenue vs cost analysis including gross profit, net profit, and margins |

### Viewing a Report
1. Go to the **Reports** page
2. Select the report type from the tabs
3. Set the date range (where applicable)
4. The report generates automatically with a summary and detailed data
5. Use the **Export** button to download the report as a PDF

---

## ⚙️ Settings

Configure your store and system preferences.

### Store Information
| Setting | Description |
|---------|-------------|
| **Store Name** | Appears on receipts and reports |
| **Phone Number** | Contact number for receipts |
| **Email Address** | Store contact email |
| **Address** | Physical store location |
| **Tax Rate (%)** | VAT/sales tax percentage (Default:16%) |
| **Currency** | Currency code (e.g., KES, USD) |
| **Sound Effects** | Enable/disable scanner beep sounds |

### M-Pesa Configuration
To accept M-Pesa payments, you need a Safaricom Daraja API account:

1. Go to [Safaricom Daraja Portal](https://developer.safaricom.co.ke/)
2. Create an account and get your **Consumer Key** and **Consumer Secret**
3. Set up your **Pass Key** and **Business Short Code**
4. Add the account in **Settings → M-Pesa Accounts**
5. Toggle **Sandbox Mode** for testing or disable it for live payments

You can configure multiple M-Pesa accounts (e.g., for different till numbers).

### Database Backup
1. Go to **Settings**
2. Click **"Backup Database"**
3. The system creates a timestamped backup file
4. Backups are stored in the `backups/` folder

> 💡 **Tip:** Regularly backup your database to prevent data loss.

### Network Info
View your store's **local IP address** and **hostname** — useful for connecting the mobile scanner app.

---

## 📡 Barcode Scanner Support

The system supports multiple barcode scanning methods:

### 1. Physical USB Barcode Scanner
- Plug in any USB barcode scanner
- It works like a keyboard — just scan any product barcode
- The scanner automatically detects the barcode and searches for the product
- Works from both the **Products page** search bar and the **POS search bar**

### 2. Mobile Scanner App (via network)
1. Install a barcode scanner app on your phone
2. Configure it to send scans to: `http://{your-computer-ip}:5000/api/scanner/scan`
3. Scans from your phone appear in real-time on the POS screen
4. Click on a scan to search for that product

### 3. Mobile Scanner Panel
- A floating button 📱 appears on the POS and Products pages
- Shows recent scans from connected mobile devices
- Click any scan to instantly search for that item

### Scanner Flash Feedback
When a barcode is detected, the search field flashes **green** briefly to confirm the scan was received.

### Scanner Sound (Beep)
If **Sound Effects** are enabled in Settings, the system plays an audible beep whenever a barcode is scanned successfully. This gives you audio confirmation without needing to look at the screen.

---

## 💰 M-Pesa Integration

### How M-Pesa Payments Work
1. Cashier enters the customer's **phone number** and amount
2. System sends an **STK Push** request to Safaricom
3. Customer receives a prompt on their phone to enter M-Pesa PIN
4. Safaricom processes the payment and sends a **callback**
5. System confirms payment and completes the transaction

### Split Payments
Customers can pay partially with M-Pesa and partially with cash:
- Enter the **M-Pesa amount** and **cash amount**
- Cash is collected immediately (inventory deducted)
- M-Pesa is processed and confirmed via callback
- Transaction is marked as "mixed" payment

### Testing (Sandbox Mode)
- Use Safaricom's sandbox environment for testing
- Test phone numbers: `254708374149`
- Test PIN: `174379`
- No real money is moved in sandbox mode

---

## ⌨️ Keyboard Shortcuts & Tips

### POS Interface
| Shortcut | Action |
|----------|--------|
| **Type any text** | Automatically searches products |
| **Scan barcode** | Instantly adds product to cart |
| **Click product** | Adds 1 unit to cart |
| **Click + / -** | Adjust item quantity in cart |

### General Tips
- 🔍 **Quick search** — The search bar on every list page filters results instantly
- 🌙 **Dark Mode** — Toggle between light and dark themes using the theme switcher in the sidebar
- 📱 **Mobile scanner panel** — The floating 📱 button shows recent barcode scans from mobile devices
- 🖨️ **Print receipts** — After checkout, use the print button to get a physical receipt
- 📋 **Pagination** — Long lists are paginated; use Previous/Next to navigate

---

## 🔧 Troubleshooting

### Login Issues

| Problem | Solution |
|---------|----------|
| **Forgot password** | Contact an admin to reset your password |
| **Account deactivated** | Contact an admin to reactivate your account |
| **"Invalid credentials"** | Check your username and password are correct |
| **Session expired** | Log in again |

### M-Pesa Issues

| Problem | Solution |
|---------|----------|
| **STK push not sent** | Check that M-Pesa account is configured in Settings |
| **Customer didn't receive prompt** | Verify the phone number is correct (format: 0712345678) |
| **Payment pending too long** | Try "Retry" or collect cash instead with "Complete Manually" |
| **Sandbox not working** | Use test phone `254708374149` with test PIN |

### Scanner Issues

| Problem | Solution |
|---------|----------|
| **Scanner not detected** | Unplug and re-plug the scanner; try a different USB port |
| **Scanner types wrong characters** | Ensure the scanner is configured for your keyboard layout |
| **Mobile scanner not connecting** | Verify your computer's IP address in Settings → Network Info |
| **Scan not showing up** | Check that the app is running on the same network (Wi-Fi) |

### Other Issues

| Problem | Solution |
|---------|----------|
| **App won't start (desktop)** | Check the backend log file for error details |
| **Database errors** | Restart the app; if persistent, restore from backup |
| **"Cannot delete category"** | Remove all products from that category first |
| **Low stock not updating** | Adjust the reorder level in the product settings |
| **Printer not working** | Make sure your printer is installed and set as default |

### Getting Help
If you encounter issues not covered here:
- Check the backend logs in the app's user data directory
- Contact your system administrator
- Visit the project's support page for updates and assistance

---

> **Bythebuzz POS** — Built with ❤️ for modern retail management.
