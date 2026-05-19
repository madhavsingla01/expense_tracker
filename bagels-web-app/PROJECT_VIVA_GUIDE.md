# Bagels Web App - Viva Guide

This guide is based on the actual files in this checkout:

- Frontend: `frontend/` - React + Vite single page app
- Backend: `backend/` - Express MVC API with MongoDB/Mongoose plus PostgreSQL/Prisma user/file persistence
- Admin views: `backend/views/admin/` - EJS server-rendered pages

Use this as your project explanation in viva.

---

## 1. Project Short Explanation

Bagels Web App is an expense tracking and payment management application. Users can register, log in, add income/expense transactions, scan bills with OCR, manage budgets, save UPI accounts/contacts, and initiate/verify payments through Razorpay. The backend stores existing finance data in MongoDB using Mongoose and mirrors basic user profile plus Cloudinary upload metadata into PostgreSQL using Prisma.

Best opening answer:

> My project is a fintech-style expense tracker. The frontend is built in React and communicates with an Express API. Authentication is JWT-based. Passwords are hashed with bcrypt. Financial data is stored in MongoDB using Mongoose models, while basic user profile records and Cloudinary upload URLs are stored in PostgreSQL through Prisma. The backend follows a layered MVC-style architecture: routes receive requests, controllers call services, services contain business logic and validation, models define database schemas, and views are React pages plus EJS admin pages.

---

## 2. Tech Stack And Libraries

### Frontend

| Tech/library | Used for | Project files |
|---|---|---|
| React 18 | UI components and pages | `frontend/src/**/*.jsx` |
| React DOM | Mounting React app | `frontend/src/main.jsx` |
| React Router DOM | Client-side routes | `frontend/src/App.jsx` |
| Vite | Frontend dev server/build tool | `frontend/vite.config.js` |
| Tailwind CSS | Styling | `frontend/tailwind.config.js`, `frontend/src/index.css` |
| Axios | API calls | `frontend/src/config/api.js` |
| Recharts | Charts | dashboard components |
| Framer Motion | UI animation | frontend dependency |
| Lucide React | Icons | pages/components |
| Tesseract.js | OCR bill scanning | `frontend/src/pages/ScanPage.jsx` |
| html5-qrcode | Camera QR scanner | `frontend/src/pages/PayPage.jsx` |

### Backend

| Tech/library | Used for | Project files |
|---|---|---|
| Node.js | Runtime | `backend/server.js` |
| Express | HTTP API server | `backend/server.js`, `backend/routes/*` |
| MongoDB | Database | configured through `MONGO_URI` |
| Mongoose | ODM/schema models | `backend/models/*` |
| PostgreSQL | SQL database for basic user/file records | configured through `DATABASE_URL` |
| Prisma | SQL ORM and migrations | `backend/prisma/schema.prisma`, `backend/config/prisma.js` |
| Multer | Multipart upload handling | `backend/middleware/uploadMiddleware.js` |
| Cloudinary | Cloud image storage | `backend/config/cloudinary.js`, `backend/services/CloudinaryStorageService.js` |
| Render | Deployment platform | `render.yaml`, `RENDER_DEPLOYMENT_GUIDE.md` |
| dotenv | Environment variables | `backend/server.js`, `backend/.env` |
| cors | Allow frontend dev origin | `backend/server.js` |
| jsonwebtoken | JWT creation/verification | `backend/utils/generateToken.js`, `backend/middleware/authMiddleware.js` |
| bcryptjs | Password hashing/comparison | `backend/models/User.js` |
| express-async-handler | Async controller error forwarding | `backend/controllers/*` |
| ejs | Admin SSR templates | `backend/views/admin/*` |
| ws | WebSocket server | `backend/utils/paymentSocketServer.js` |
| nodemon | Dev auto restart | `backend/package.json` |
| uuid | Unique IDs if needed | backend dependency |
| cookie-parser | Installed but not mounted in `server.js` | backend dependency |

### Node Core Modules Used

| Core module | Used for |
|---|---|
| `http` | Create HTTP server for Express and WebSockets |
| `path` | Resolve static/view/upload paths |
| `crypto` | Random payment reference IDs, HMAC signatures, receipt filenames |
| `https` | Razorpay API requests |
| `fs` | Save receipt images to disk |
| `url` | Parse WebSocket connection URL |
| `Buffer` | Basic auth decode and signature/header encoding |

---

## 3. MVC In This Project

Classic MVC is:

```text
Model -> data structure and database rules
View -> UI shown to user
Controller -> receives request and returns response
```

This backend adds two important practical layers:

```text
Request -> Router -> Middleware -> Controller -> Service -> Model/Prisma -> MongoDB/PostgreSQL
                                                    |
                                                 Response
```

### Model Files

Models are Mongoose schemas in `backend/models/`; SQL models are defined in `backend/prisma/schema.prisma`.

| Model file | Purpose |
|---|---|
| `User.js` | User account, password hash, profile, preferences, saved contacts, generated QR codes |
| `Account.js` | Linked bank/wallet/UPI account and balance |
| `Transaction.js` | Income/expense/transfer transaction |
| `Payment.js` | Razorpay payment lifecycle |
| `PaymentAttempt.js` | Older/manual UPI attempt schema; currently not wired into active payment routes |
| `Ledger.js` | Financial source of truth: debit/credit entries and balance after each entry |
| `Budget.js` | Category budget, spent, remaining, alerts |
| `Merchant.js` | Normalized merchant/payee records |
| `AILearning.js` | Learned user-specific category patterns |
| `LearningRule.js` | Regex/pattern learning rules |
| `AuditLog.js` | Audit trail for important actions |
| `Notification.js` | Notification records |
| `Bill.js` | Bill/OCR-related records |
| `Analytics.js` | Monthly analytics schema |
| `Goal.js` | Savings/goal schema |

Important issue found:

`backend/models/index.js` exports `Income: require('./Income')`, but `backend/models/Income.js` does not exist. Main routes mostly import models directly, so the app may still run, but `require('./backend/models')` fails and `backend/USAGE_EXAMPLES.js` will fail until this is fixed.

### View Files

This project has two kinds of views.

User app views are React pages:

| View | File |
|---|---|
| Login/register | `frontend/src/pages/LoginPage.jsx` |
| Dashboard | `frontend/src/pages/DashboardPage.jsx` |
| Ledger | `frontend/src/pages/LedgerPage.jsx` |
| Add record | `frontend/src/pages/AddRecordPage.jsx` |
| Budgets | `frontend/src/pages/BudgetsPage.jsx` |
| Bill scan/OCR | `frontend/src/pages/ScanPage.jsx` |
| Pay/UPI/Razorpay | `frontend/src/pages/PayPage.jsx` |
| Profile | `frontend/src/pages/ProfilePage.jsx` |
| Feedback | `frontend/src/pages/FeedbackPage.jsx` |

Admin SSR views are EJS templates:

| Admin view | File |
|---|---|
| Dashboard | `backend/views/admin/dashboard.ejs` |
| Users | `backend/views/admin/users.ejs` |
| User details | `backend/views/admin/user-details.ejs` |
| Transactions | `backend/views/admin/transactions.ejs` |
| Merchants | `backend/views/admin/merchants.ejs` |
| AI control | `backend/views/admin/ai.ejs` |
| OCR monitor | `backend/views/admin/ocr.ejs` |
| Logs | `backend/views/admin/logs.ejs` |
| Not found | `backend/views/admin/not-found.ejs` |
| Header/footer partials | `backend/views/admin/partials/*.ejs` |

### Controller Files

Controllers are in `backend/controllers/`.

| Controller | Handles |
|---|---|
| `authController.js` | Register, login, profile, profile update, save QR |
| `transactionController.js` | List, create, update, delete transactions |
| `budgetController.js` | List, create/update, delete budgets |
| `accountController.js` | List/add/remove/default UPI accounts |
| `paymentController.js` | Razorpay payment list/initiate/verify/reconcile/webhook |
| `predictController.js` | Category prediction endpoint |
| `adminController.js` | Server-rendered admin dashboard pages |

Normal API controllers are thin. Example: transaction controller gets `req.user._id`, `req.body`, calls `TransactionService`, and returns JSON.

### Service Files

Services are in `backend/services/`. This is where most business logic lives.

| Service | Responsibility |
|---|---|
| `UserService.js` | Register/login/profile/update/QR save |
| `TransactionService.js` | Transaction validation, OCR receipt save, ledger entries, audit logs, category learning |
| `PaymentService.js` | Razorpay order creation, signature verification, webhook, reconciliation, payment settlement |
| `BudgetService.js` | Budget CRUD, spent/remaining, alert thresholds |
| `AccountService.js` | Accounts, default account, primary account |
| `MerchantService.js` | Merchant normalization/deduplication |
| `IntelligenceService.js` | Category prediction and learning |
| `ValidationService.js` | Reusable validation functions |
| `index.js` | Central export for services |

### Router Files

Routers are in `backend/routes/`.

| Router | Base path |
|---|---|
| `authRoutes.js` | `/api/auth` |
| `transactionRoutes.js` | `/api/transactions` |
| `budgetRoutes.js` | `/api/budgets` |
| `accountRoutes.js` | `/api/accounts` |
| `paymentRoutes.js` | `/api/payments` |
| `predictRoutes.js` | `/api/predict` |
| `adminRoutes.js` | `/admin` |

Routers should only define endpoint paths, HTTP methods, and middleware. In this project, routers mostly do that correctly.

If logic is written in a router, the valid reason should be route composition only, for example `router.use(adminBasicAuth)` protects every admin route. Business logic or DB calls should not be in routers.

---

## 4. API To Route To Controller To Service Map

The backend mounts routes in `backend/server.js`:

```js
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/admin', adminRoutes);
```

### Auth APIs

| API | Frontend caller | Route | Controller | Service | Model |
|---|---|---|---|---|---|
| `POST /api/auth/register` | `AuthContext.register()` | `authRoutes.js` | `registerUser` | `UserService.registerUser` | `User`, `Account` |
| `POST /api/auth/login` | `AuthContext.login()` | `authRoutes.js` | `loginUser` | `UserService.loginUser` | `User` |
| `GET /api/auth/profile` | `AuthContext.fetchProfile()` | `authRoutes.js` + `protect` | `getUserProfile` | `UserService.getUserProfile` | `User`, `Account` |
| `PUT /api/auth/profile` | `AuthContext.updateProfile()` | `authRoutes.js` + `protect` | `updateUserProfile` | `UserService.updateUserProfile` | `User` |
| `POST /api/auth/qr` | QR save flow | `authRoutes.js` + `protect` | `saveQRCode` | `UserService.saveQRCode` | `User` |

### Transaction APIs

| API | Frontend caller | Route | Controller | Service | Model |
|---|---|---|---|---|---|
| `GET /api/transactions` | `useTransactions.refreshTransactions()` | `transactionRoutes.js` + `protect` | `getTransactions` | `TransactionService.getTransactions` | `Transaction` |
| `POST /api/transactions` | `useTransactions.addTransaction()` | `transactionRoutes.js` + `protect` | `createTransaction` | `TransactionService.createTransaction` | `Transaction`, `Account`, `Ledger`, `Merchant`, `AuditLog`, `AILearning` |
| `PUT /api/transactions/:id` | `useTransactions.updateTransaction()` | `transactionRoutes.js` + `protect` | `updateTransaction` | `TransactionService.updateTransaction` | `Transaction`, `Merchant`, `AILearning`, `LearningRule` |
| `DELETE /api/transactions/:id` | `useTransactions.deleteTransaction()` | `transactionRoutes.js` + `protect` | `deleteTransaction` | `TransactionService.deleteTransaction` | `Transaction`, `Ledger`, `Account`, `AuditLog` |

### Budget APIs

| API | Frontend caller | Route | Controller | Service | Model |
|---|---|---|---|---|---|
| `GET /api/budgets` | `useTransactions.refreshBudgets()` | `budgetRoutes.js` + `protect` | `getBudgets` | `BudgetService.getBudgets` | `Budget` |
| `POST /api/budgets` | `useTransactions.saveBudget()` | `budgetRoutes.js` + `protect` | `upsertBudget` | `BudgetService.upsertBudget` | `Budget`, `AuditLog` |
| `DELETE /api/budgets/:id` | not directly wired in current frontend hook | `budgetRoutes.js` + `protect` | `deleteBudget` | `BudgetService.deleteBudget` | `Budget`, `AuditLog` |

### Predict API

| API | Frontend caller | Route | Controller | Service | Model |
|---|---|---|---|---|---|
| `GET /api/predict?payee=...` | `useTransactions.getPredictedCategory()` | `predictRoutes.js` + `protect` | `predictCategory` | `IntelligenceService.getSuggestions` | `Merchant`, `AILearning`, `LearningRule` |

### Account APIs

| API | Frontend caller | Route | Controller | Service | Model |
|---|---|---|---|---|---|
| `GET /api/accounts` | profile/profile refresh indirectly | `accountRoutes.js` + `protect` | `getAccounts` | `AccountService.getAccountsByUser` | `Account` |
| `POST /api/accounts` | `ProfilePage.addLinkedAccount()` | `accountRoutes.js` + `protect` | `addUpiAccount` | `AccountService.addUpiAccount` | `Account` |
| `DELETE /api/accounts/:id` | `ProfilePage.removeLinkedAccount()` | `accountRoutes.js` + `protect` | `removeAccount` | `AccountService.removeAccount` | `Account` |
| `PUT /api/accounts/:id/default` | `ProfilePage.setDefaultAccount()` | `accountRoutes.js` + `protect` | `setDefaultAccount` | `AccountService.setDefaultAccount` | `Account` |

### Payment APIs

| API | Frontend caller | Route | Controller | Service | Model |
|---|---|---|---|---|---|
| `GET /api/payments?limit=12` | `PayPage.loadAttempts()` | `paymentRoutes.js` + `protect` | `listPayments` | `PaymentService.listPayments` | `Payment`, `Transaction` |
| `POST /api/payments/initiate` | `PayPage.handleInitiatePayment()` | `paymentRoutes.js` + `protect` | `initiatePayment` | `PaymentService.initiatePayment` | `Payment`, `Account`, `AuditLog` |
| `POST /api/payments/:referenceId/verify` | Razorpay checkout handler | `paymentRoutes.js` + `protect` | `verifyPayment` | `PaymentService.verifyPayment` | `Payment`, `Transaction`, `Ledger`, `Budget`, `Notification` |
| `POST /api/payments/:referenceId/reconcile` | checkout dismiss/manual retry | `paymentRoutes.js` + `protect` | `reconcilePayment` | `PaymentService.reconcilePayment` | `Payment` |
| `POST /api/payments/webhooks/razorpay` | Razorpay server webhook | `paymentRoutes.js` public webhook | `razorpayWebhook` | `PaymentService.processRazorpayWebhook` | `Payment`, `Transaction`, `Ledger` |

### Admin SSR Routes

| Route | Controller | View |
|---|---|---|
| `GET /admin` | `getDashboard` | `admin/dashboard.ejs` |
| `GET /admin/users` | `listUsers` | `admin/users.ejs` |
| `GET /admin/users/:userId` | `getUserDetails` | `admin/user-details.ejs` |
| `GET /admin/transactions` | `listTransactions` | `admin/transactions.ejs` |
| `GET /admin/merchants` | `listMerchants` | `admin/merchants.ejs` |
| `POST /admin/merchants/:merchantId` | `updateMerchant` | redirects to `/admin/merchants` |
| `GET /admin/ai` | `listAi` | `admin/ai.ejs` |
| `GET /admin/ocr` | `listOcr` | `admin/ocr.ejs` |
| `GET /admin/logs` | `listLogs` | `admin/logs.ejs` |

Admin routes use `adminBasicAuth`, not JWT.

---

## 5. Full Auth Flow: Token Generation To Protected API

### Register flow

1. User fills register form in `LoginPage.jsx`.
2. `AuthContext.register()` calls `POST /api/auth/register`.
3. `authRoutes.js` sends request to `authController.registerUser`.
4. Controller calls `UserService.registerUser(req.body)`.
5. `UserService` validates name, email, password and optional phone.
6. `UserService` creates the user.
7. `User.js` pre-save hook hashes password with bcrypt.
8. `UserService` creates a default account through `AccountService.createDefaultAccount`.
9. `UserService.formatUserResponse(user, true)` adds JWT using `generateToken(user._id)`.
10. Frontend saves the returned user object in `localStorage.userInfo`.

### Login flow

1. User submits email/password.
2. `AuthContext.login()` calls `POST /api/auth/login`.
3. `UserService.loginUser(email, password)` finds user by email.
4. It calls `user.matchPassword(password)`.
5. `User.js` uses `bcrypt.compare(enteredPassword, this.passwordHash)`.
6. If password is correct, `generateToken(user._id)` creates a JWT.
7. Frontend stores token in `localStorage.userInfo`.

### Protected API flow

1. Frontend calls any protected API, for example `GET /api/transactions`.
2. Axios interceptor in `frontend/src/config/api.js` reads `localStorage.userInfo`.
3. It adds this header:

```http
Authorization: Bearer <jwt-token>
```

4. Backend route uses `protect` middleware.
5. `authMiddleware.js` reads `req.headers.authorization`.
6. It extracts the token after `Bearer`.
7. It verifies token with `jwt.verify(token, process.env.JWT_SECRET)`.
8. It loads the user by decoded `id` and attaches it to `req.user`.
9. Controller uses `req.user._id` so the user can only access their own data.

### WebSocket token flow

For payment realtime updates, frontend opens:

```js
new WebSocket(`${PAYMENT_WS_URL}?token=${encodeURIComponent(user.token)}`)
```

Backend `paymentSocketServer.js` reads `token` from query string, verifies it with JWT, stores the socket under that user ID, then sends realtime messages like:

```json
{ "type": "payment.updated", "payment": {} }
{ "type": "transactions.changed", "change": {} }
```

---

## 6. How To Place The Token

In this project, token placement is:

```js
config.headers.Authorization = `Bearer ${token}`;
```

For Postman:

```http
GET http://localhost:5000/api/transactions
Authorization: Bearer eyJhbGciOi...
```

For WebSocket:

```text
ws://localhost:5000/ws/payments?token=<jwt-token>
```

Do not put JWT inside request body for protected APIs. Header is standard.

---

## 7. JWT And Bcrypt

### What is JWT?

JWT means JSON Web Token. It is a signed token that proves the user is authenticated. This project signs:

```js
jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' })
```

The token contains the user ID. It is not encrypted by default; it is signed. That means the backend can verify that it was created by the server and was not changed.

### What is bcrypt?

Bcrypt is a one-way password hashing algorithm. In this project:

```js
const salt = await bcrypt.genSalt(10);
this.passwordHash = await bcrypt.hash(this._password, salt);
```

At login:

```js
bcrypt.compare(enteredPassword, this.passwordHash)
```

### How to bcrypt the token?

Correct viva answer:

> We do not bcrypt JWT access tokens in this project. Bcrypt is used for passwords, because passwords must never be stored in plain text. JWTs are signed using `JWT_SECRET`. If we were storing long-lived refresh tokens in the database, we could store a hash of the refresh token, but access JWTs are normally verified using `jwt.verify`, not bcrypt.

### Why bcrypt?

Because if the database leaks, attackers should not get user passwords. Bcrypt is slow and salted, so brute force attacks are harder. It is hashing, not encryption, so we cannot decrypt the original password.

Important note:

`ProfilePage.jsx` says "AES-256 at rest", but I did not find AES encryption implementation in the backend source. For viva, say the implemented security is bcrypt password hashing and JWT authentication. Do not claim AES-256 unless you implement it.

---

## 8. Middleware

Middleware is a function that runs between request and controller.

```text
Request -> Middleware -> Controller
```

### Middleware in this project

| Middleware | Type | File | Purpose |
|---|---|---|---|
| `express.json()` | Built-in | `server.js` | Parse JSON body |
| `express.urlencoded()` | Built-in | `server.js` | Parse form body |
| `express.static()` | Built-in | `server.js` | Serve uploads/public files |
| `cors()` | Third-party | `server.js` | Allow frontend origin |
| `logger` | Custom | `middleware/loggerMiddleware.js` | Log method, URL, status, duration |
| `protect` | Custom auth | `middleware/authMiddleware.js` | Verify JWT and attach `req.user` |
| `adminBasicAuth` | Custom auth | `middleware/adminAuthMiddleware.js` | Protect `/admin` EJS routes |
| `notFound` | Error middleware | `middleware/errorMiddleware.js` | 404 handler |
| `errorHandler` | Error middleware | `middleware/errorMiddleware.js` | Format error responses |

### Middleware types for viva

1. Application-level middleware: `app.use(logger)`
2. Router-level middleware: `router.use(adminBasicAuth)`
3. Built-in middleware: `express.json()`
4. Third-party middleware: `cors()`
5. Error-handling middleware: `errorHandler`
6. Authentication middleware: `protect`

---

## 9. Session And Cookies

### Session

This project does not use `express-session`. It uses JWT authentication. Frontend session-like state is stored in:

| Storage | Used for |
|---|---|
| `localStorage.userInfo` | Logged-in user and JWT |
| `sessionStorage.bagels.activeUpiReferenceId` | Active payment across payment flow |

### Cookies

`cookie-parser` is installed in `backend/package.json`, but `server.js` does not mount it with `app.use(cookieParser())`. So current auth is not cookie-based.

---

## 10. CSR, SSR, JSX, HTML, EJS

### CSR

CSR means Client-Side Rendering. React app is CSR. Browser downloads JavaScript, then React renders pages like dashboard, ledger, scan, pay, profile.

Project example:

```js
ReactDOM.createRoot(document.getElementById('root')).render(...)
```

### SSR

SSR means Server-Side Rendering. Server prepares HTML and sends it to browser.

Project example:

```js
app.set('view engine', 'ejs');
res.render('admin/dashboard', data);
```

### Why use HTML/EJS when JSX exists?

Answer:

> The user-facing app uses JSX because it needs interactive screens, client-side routing, charts, OCR, QR scanning, and realtime updates. The admin panel uses EJS because it is simpler server-rendered reporting: list users, transactions, merchants, logs, OCR records. EJS avoids a separate admin React bundle and lets the backend render database reports directly.

---

## 11. Main Feature Flows

### Add transaction flow

```text
AddRecordPage form
-> App.handleSubmit
-> useTransactions.addTransaction
-> POST /api/transactions
-> protect middleware
-> transactionController.createTransaction
-> AccountService.getPrimaryAccount if account missing
-> TransactionService.createTransaction
-> createExpenseTransaction or createIncomeTransaction
-> validate input
-> save receipt image if provided
-> IntelligenceService.processTransaction
-> Transaction.create
-> createLedgerEntry
-> BudgetService.updateBudgetSpent
-> AuditLog.create
-> IntelligenceService.learn
-> response to frontend
-> frontend updates ledger state
```

### OCR scan flow

```text
ScanPage
-> user uploads/captures bill image
-> preprocess image
-> Tesseract OCR reads text
-> extract amount, date, payee
-> getPredictedCategory(payee)
-> App sets formData with source='scan'
-> navigate to /add
-> user confirms transaction
-> POST /api/transactions
```

### Payment flow

```text
PayPage
-> user enters UPI ID and amount
-> POST /api/payments/initiate
-> PaymentService creates Payment record
-> PaymentService creates Razorpay order
-> frontend opens Razorpay checkout
-> checkout returns order/payment/signature
-> POST /api/payments/:referenceId/verify
-> backend verifies HMAC signature
-> backend fetches payment from Razorpay
-> if successful: creates Transaction + Ledger entry
-> updates Budget and AI learning
-> creates notification
-> broadcasts payment.updated and transactions.changed over WebSocket
-> frontend refreshes transactions
```

### Payment webhook flow

```text
Razorpay webhook
-> POST /api/payments/webhooks/razorpay
-> express.json stores rawBody for this URL
-> PaymentService.verifyWebhookSignature
-> find payment by gateway orderId
-> if captured/paid: finalizeSuccessfulPayment
-> if failed: markPaymentFailed
-> if pending: keepPaymentPending
```

### Category prediction flow

```text
Frontend payee input
-> GET /api/predict?payee=...
-> predictController.predictCategory
-> IntelligenceService.getSuggestions
-> predictCategory cascade:
   1. Merchant DB
   2. AILearning
   3. LearningRule
   4. Keyword heuristic
   5. General fallback
```

---

## 12. How To Write A New API In This Project

Example: update user class/year field.

### Step 1: Add field in model

`backend/models/User.js`

```js
profile: {
  firstName: String,
  lastName: String,
  className: String
}
```

### Step 2: Add service logic

`backend/services/UserService.js`

```js
if (className !== undefined) {
  user.profile.className = className;
}
await user.save();
```

### Step 3: Controller already calls service

`authController.updateUserProfile` already does:

```js
UserService.updateUserProfile(req.user._id, req.body)
```

### Step 4: Route already exists

```http
PUT /api/auth/profile
```

### Step 5: Frontend sends update

```js
updateProfile({ className: 'TYBCA' })
```

### What does update keyword mean?

In REST API, update usually means `PUT` or `PATCH`.

In MongoDB/Mongoose, update can mean:

```js
User.findByIdAndUpdate(id, updateData, { new: true })
```

or:

```js
user.profile.firstName = 'New';
await user.save();
```

This project mostly uses `find + assign + save` for profile update because password hashing and nested profile logic need model hooks and controlled validation.

---

## 13. Data Provider And Flow

Who provides data?

| Layer | Provides |
|---|---|
| User/browser | form data, token, query params |
| React views | UI events and form state |
| Axios API client | HTTP request to backend |
| Middleware | authenticated `req.user` |
| Controller | request extraction and response |
| Service | processed business data |
| Model | database schema and DB access |
| MongoDB | persistent stored data |

Controller does not "provide" data by itself. It coordinates request and response. Real data comes from MongoDB through models, usually via services.

---

## 14. Important Code Explanations

### `server.js`

This is the backend entry point. It:

1. Loads environment variables.
2. Connects MongoDB.
3. Creates Express app and HTTP server.
4. Sets EJS as view engine.
5. Adds middleware: CORS, URL/body parsing, logger, static uploads.
6. Mounts admin and API routers.
7. Adds health check.
8. Adds 404/error handling.
9. Starts WebSocket payment server.
10. Listens on `PORT` or `5000`.

### `User.js`

The `User` model stores user details. It does not store plain password. It uses a virtual `password` field. When `user.password = password` is set, `_password` is stored temporarily. Before saving, bcrypt hashes it and stores `passwordHash`.

### `authMiddleware.js`

The `protect` middleware reads:

```http
Authorization: Bearer <token>
```

It verifies JWT and sets:

```js
req.user = await User.findById(decoded.id).select('-password');
```

Then controllers can use `req.user._id`.

### `TransactionService.js`

This is the core financial logic. It validates transaction input, maps frontend source values, saves receipt image, predicts category, creates transaction, creates ledger entry, updates budget, creates audit log, and trains intelligence data.

### `PaymentService.js`

This is the payment gateway layer. It creates Razorpay orders, builds checkout config for frontend, verifies Razorpay signatures, fetches payment status from Razorpay, finalizes successful payments, creates settled expense transactions, updates ledger, handles failed/pending states, and processes webhooks.

### `useTransactions.js`

This is a frontend data hook. It fetches transactions and budgets, computes dashboard insights, creates notifications, handles add/delete/update transaction, saves budgets, predicts category, and listens to payment WebSocket updates.

---

## 15. Viva Questions And Strong Answers

### Project and architecture

1. What is your project?
   - It is a React and Express based expense tracker with JWT auth, MongoDB persistence, OCR bill scanning, budget tracking, Razorpay payment verification, ledger accounting, and admin EJS dashboard.

2. Which architecture did you use?
   - MVC-style layered architecture: routes, controllers, services, models, and views. Services hold business logic.

3. Why MVC is important?
   - It separates UI, request handling, business logic, and database schema. This makes code easier to maintain, test, debug, and extend.

4. What is the flow of MVC in your project?
   - Request -> Route -> Middleware -> Controller -> Service -> Model -> MongoDB -> Service formats -> Controller sends JSON -> React view updates.

5. What is the next step after MVC?
   - For larger projects we add service layer, validation layer, middleware, DTO/response formatting, tests, logging, and deployment pipeline.

6. Did you put everything in one folder?
   - No. The project is separated into `frontend`, `backend`, backend `routes`, `controllers`, `services`, `models`, `middleware`, `views`, `utils`, and `config`.

### Model, view, controller

7. What is Model?
   - Mongoose schema that defines collection structure and validation rules, for example `User`, `Transaction`, `Payment`, `Budget`.

8. What is View?
   - The UI. In this project, user views are React pages and admin views are EJS templates.

9. What is Controller?
   - Controller receives request data, calls the required service, and sends response. Example: `transactionController.createTransaction`.

10. What is Service?
   - Service contains business logic, validation, DB operations, and data formatting. Example: `TransactionService.createTransaction`.

11. Why are controllers thin?
   - So controllers do not mix validation, database calls, and response logic. It keeps code testable and reusable.

12. Which files are controllers?
   - `authController.js`, `transactionController.js`, `budgetController.js`, `accountController.js`, `paymentController.js`, `predictController.js`, `adminController.js`.

13. Which files are models?
   - Files in `backend/models/`, such as `User.js`, `Transaction.js`, `Payment.js`, `Budget.js`, `Ledger.js`.

14. Which files are views?
   - React pages in `frontend/src/pages/` and EJS templates in `backend/views/admin/`.

15. Where is service?
   - `backend/services/`.

### Router, API, endpoint

16. What is router?
   - Router defines endpoint paths and HTTP methods, then connects them to middleware and controllers.

17. Router kaha hota hai?
   - `backend/routes/`.

18. What is API?
   - API is an interface where frontend communicates with backend using HTTP endpoints like `GET /api/transactions`.

19. What is endpoint?
   - A specific URL plus method. Example: `POST /api/auth/login`.

20. How to write API?
   - Create route, controller method, service method, model if needed, then call it from frontend using Axios.

21. Why should logic not be in router?
   - Router should stay simple. Business logic belongs in services so it can be reused and tested.

22. Is there logic in routers here?
   - Mostly no. Routers mainly define paths. `adminRoutes.js` uses `router.use(adminBasicAuth)` because all admin routes need the same authentication middleware.

### Authentication and security

23. What is JWT?
   - A signed token used to authenticate user requests.

24. Where is JWT generated?
   - `backend/utils/generateToken.js`.

25. Where is JWT verified?
   - `backend/middleware/authMiddleware.js`.

26. How is token placed?
   - Frontend stores it in `localStorage.userInfo`; Axios sends it in `Authorization: Bearer <token>`.

27. What is bcrypt?
   - A password hashing algorithm used in `User.js`.

28. Why bcrypt?
   - To avoid storing plain passwords and reduce damage if database leaks.

29. Is JWT encrypted?
   - No, it is signed. The backend verifies it with `JWT_SECRET`.

30. Do you bcrypt JWT token?
   - No. We bcrypt passwords. JWT is signed and verified.

31. What happens when token is invalid?
   - Backend returns `401`, Axios response interceptor clears local storage and redirects to login.

32. What is middleware?
   - A function that runs before the controller, for authentication, parsing, logging, or error handling.

33. What are middleware types?
   - Built-in, third-party, custom, router-level, app-level, error-handling, authentication.

34. What is session?
   - A way to remember logged-in state. This project uses JWT stored in localStorage, not server sessions.

35. What are cookies?
   - Browser-stored key/value data sent with requests. This project has `cookie-parser` installed but does not currently use cookie auth.

### Database and finance logic

36. Why use MongoDB?
   - Flexible document structure works well for nested user profiles, transaction metadata, payment gateway payloads, and audit records.

37. Why use Mongoose?
   - It provides schemas, validation, model methods, indexes, and easier MongoDB operations.

38. What is Ledger?
   - Ledger is the financial source of truth. Every successful transaction creates a debit or credit ledger entry with `balanceAfter`.

39. Why not calculate balance only from transactions?
   - Ledger gives an auditable trail and makes reconciliation easier.

40. What is AuditLog?
   - A collection that stores important actions like create/delete/update transaction or payment settlement.

41. What is Merchant normalization?
   - Converting names like `ZOMATO LTD` into a clean normalized key like `zomato` to avoid duplicates.

42. How does AI/category prediction work?
   - It checks merchant DB, AI learning history, learning rules, keyword heuristics, then falls back to General.

### Payment and sockets

43. Which payment gateway is used?
   - Razorpay.

44. What is payment initiate API?
   - `POST /api/payments/initiate` creates a `Payment` record and Razorpay order.

45. How do you verify payment?
   - Backend verifies Razorpay checkout signature, fetches payment from Razorpay, validates amount/order, then settles payment.

46. Why webhook?
   - Checkout response alone is not enough. Webhook lets Razorpay notify backend directly about captured/failed payment.

47. What are sockets?
   - Persistent realtime connection. This project uses `ws` for payment and transaction updates.

48. Socket route?
   - `/ws/payments`.

49. How is socket authenticated?
   - Token is passed in WebSocket query string and verified by JWT.

50. What socket messages are sent?
   - `payment.updated`, `transactions.changed`, and `realtime.ready`.

### Frontend

51. Why React?
   - The user app needs interactive UI, routing, forms, charts, OCR, QR camera, realtime updates, and state management.

52. Why EJS also?
   - Admin pages are simple server-rendered database reports, so EJS is sufficient and lightweight.

53. What is CSR?
   - Client-side rendering, used by React app.

54. What is SSR?
   - Server-side rendering, used by EJS admin pages.

55. What is JSX?
   - JavaScript XML syntax used to write React UI components.

56. What is Axios used for?
   - Calling backend APIs and automatically adding JWT header.

57. How does protected route work?
   - `ProtectedRoute` checks auth context. If no user, it redirects to login.

58. How is dashboard data calculated?
   - `useTransactions.js` fetches transactions/budgets and computes totals, categories, trend data, notifications.

59. How does OCR work?
   - `ScanPage.jsx` uses Tesseract.js, extracts date/payee/amount, predicts category, then fills Add Record form.

60. How does profile update work?
   - `ProfilePage` calls `updateProfile`, which sends `PUT /api/auth/profile`; service updates user fields and returns fresh user data.

### Practical coding questions

61. If user name needs to change, what will you do?
   - Call `PUT /api/auth/profile` with `{ name: 'New Name' }`. `UserService.updateUserProfile` splits it into firstName/lastName and saves user.

62. If a new user field is required, what files change?
   - `User.js` model, `UserService.formatUserResponse`, `UserService.updateUserProfile`, frontend form, and maybe DB migration for old users.

63. If a new transaction field is required, what files change?
   - `Transaction.js`, `TransactionService.validateTransactionInput`, `createExpenseTransaction`, response formatter, frontend form/hook.

64. If adding a new endpoint, what files change?
   - Route file, controller file, service file, model if needed, frontend API call if UI uses it.

65. If payment status is wrong, where will you debug?
   - `PayPage.jsx`, `paymentRoutes.js`, `paymentController.js`, `PaymentService.js`, `Payment.js`, and Razorpay webhook/signature env variables.

66. If token is not working, where will you debug?
   - `localStorage.userInfo`, Axios interceptor, request header, `authMiddleware.js`, `JWT_SECRET`, and token expiry.

67. If API says Not authorized?
   - Token missing/invalid or request did not use `protect` correctly. Check `Authorization: Bearer <token>`.

68. If API route gives Not Found?
   - Check `server.js` route mount, route file path/method, running backend process, and exact URL.

69. If OCR is slow?
   - Reuse Tesseract worker, compress image, use fast tessdata, avoid reinitializing worker every scan.

70. If ledger balance is wrong?
   - Check transaction creation/deletion, `createLedgerEntry`, account balance update, and deletion reversal.

---

## 16. Verification Notes

Checked:

- All markdown files in repo root/backend docs.
- Backend route, controller, service, model, middleware, utility files.
- Frontend app routes, API client, auth context, transaction hook, scan/pay/profile/login pages.
- Package dependencies from `frontend/package.json` and `backend/package.json`.
- `.env` keys were checked without exposing values.

Node verification:

- Dependency inventory script ran successfully outside the sandbox.
- `node --check backend/server.js` and `node --check backend/services/PaymentService.js` completed before the final import check.
- `node -e "require('./backend/models')"` failed because `backend/models/index.js` references missing `./Income`.

Main codebase note:

- Active payment flow now uses `Payment.js` and Razorpay.
- `PaymentAttempt.js` still exists as an older/manual UPI attempt schema but is not wired into the active `paymentRoutes.js`/`PaymentService.js` flow.
