# Bagels Web App - Tech & Library Inventory

This repo is a 2-part system:

- `bagels-web-app/frontend`: React + Vite SPA (port 5173 in dev)
- `bagels-web-app/backend`: Express MVC API with MongoDB/Mongoose, PostgreSQL/Prisma user profile sync, Cloudinary uploads (port 5000 by default)

## Tech / Stack (What’s Used + Where + What It Does)

| Area | Tech | Where | What it does / how it works |
|---|---|---|---|
| Frontend | React 18 | `frontend/` | SPA UI; components in `src/components`, pages in `src/pages`. |
| Frontend routing | React Router DOM | `frontend/src/main.jsx`, `frontend/src/App.jsx` | `BrowserRouter` wraps app; routes defined in `App.jsx`; protected pages wrapped by `ProtectedRoute`. |
| Frontend build tool | Vite | `frontend/vite.config.js` | Dev server + bundler (`npm run dev/build/preview`). |
| Styling | Tailwind CSS + PostCSS + Autoprefixer | `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/src/index.css` | Utility CSS pipeline; Tailwind scans `index.html` + `src/**/*`. |
| HTTP client | Axios | `frontend/src/config/api.js` | `API` instance uses `baseURL=http://localhost:5000/api`; request interceptor adds `Authorization: Bearer <token>` from `localStorage.userInfo`; response interceptor auto-logs-out on `401` and redirects to `/login`. |
| Charts | Recharts | `frontend/src/components/ui/` | Dashboard/mini chart rendering. |
| Animations | Framer Motion | `frontend/` | UI animations/transitions. |
| Icons | lucide-react | `frontend/` | Icon set for UI. |
| OCR (receipt scan) | tesseract.js | `frontend/src/pages/ScanPage.jsx` | Client-side OCR on captured/uploaded image; extracted fields used to prefill “Add Record”. |
| Camera/QR | html5-qrcode | `frontend/src/pages/PayPage.jsx` + scan flows | Uses device camera for QR scanning / camera-based flows. |
| Backend runtime | Node.js | `backend/` | Runs API server (`node server.js`). |
| Web framework | Express | `backend/server.js` | REST API under `/api/*`; JSON body limit `10mb`; serves `/uploads` static. |
| CORS | cors | `backend/server.js` | Allows frontend dev origins (`http://localhost:5173`, `http://127.0.0.1:5173`) with credentials. |
| Env config | dotenv | `backend/server.js`, `backend/.env` | Loads environment variables (DB URI, JWT secret, PORT, etc.). |
| Primary app DB | MongoDB + Mongoose | `backend/config/db`, `backend/models/*` | Existing app data models for `User`, `Transaction`, `Ledger`, `Budget`, `Merchant`, etc. |
| SQL DB | PostgreSQL + Prisma | `backend/prisma/schema.prisma`, `backend/config/prisma.js`, `backend/services/SqlUserService.js` | Stores basic SQL user profiles and Cloudinary file metadata without replacing the existing MongoDB collections. |
| File upload handling | Multer | `backend/middleware/uploadMiddleware.js`, `backend/routes/authRoutes.js` | Validates multipart profile image uploads in memory before service-layer processing. |
| Cloud storage | Cloudinary | `backend/config/cloudinary.js`, `backend/services/CloudinaryStorageService.js`, `backend/services/ProfileImageService.js` | Stores profile images in Cloudinary and persists Cloudinary URLs/public IDs through Prisma. |
| Deployment | Render | `../render.yaml`, `RENDER_DEPLOYMENT_GUIDE.md` | Blueprint and manual deployment guide for backend, frontend, PostgreSQL, Prisma migrations, and environment variables. |
| Auth | JSON Web Tokens | `backend/routes/authRoutes.js`, `backend/middleware/authMiddleware.js` | JWT-based auth; frontend attaches token; backend middleware authorizes and sets `req.user`. |
| Password hashing | bcryptjs | `backend/services/UserService.js` | Hash/compare passwords during register/login. |
| Cookies | cookie-parser | `backend/` | Cookie parsing (if used by auth flows). |
| Async error handling | express-async-handler | `backend/controllers/*` | Wraps async controllers so thrown errors hit `errorHandler`. |
| IDs | uuid | `backend/` | Generates unique identifiers (where needed). |
| Dev server | nodemon | `backend/package.json` | Auto-restarts backend during development (`npm run dev`). |
| Logging | custom middleware | `backend/middleware/loggerMiddleware.js` | Request logging. |
| Error handling | custom middleware | `backend/middleware/errorMiddleware.js` | `notFound` + `errorHandler` for consistent API errors. |
| Architecture pattern | Controller -> Service -> Model | `backend/controllers/*`, `backend/services/*`, `backend/models/*` | Controllers stay thin; services validate + implement business logic; models persist. Documented in `backend/ARCHITECTURE.md`. |

## Libraries (Direct Dependencies Only)

### Frontend (`frontend/package.json`)

| Lib | Version | Purpose |
|---|---:|---|
| `react` | `^18.2.0` | UI framework |
| `react-dom` | `^18.2.0` | DOM renderer |
| `react-router-dom` | `^7.14.2` | Client-side routing |
| `axios` | `^1.15.2` | API calls + interceptors |
| `recharts` | `^3.8.1` | Charts |
| `framer-motion` | `^12.38.0` | Animations |
| `lucide-react` | `^1.8.0` | Icons |
| `tesseract.js` | `^7.0.0` | OCR |
| `html5-qrcode` | `^2.3.8` | Camera/QR scanning |
| `vite` | `^4.4.5` (dev) | Dev server + bundler |
| `@vitejs/plugin-react` | `^4.0.3` (dev) | React plugin for Vite |
| `tailwindcss` | `^3.3.3` (dev) | Utility CSS |
| `postcss` | `^8.4.27` (dev) | CSS processing |
| `autoprefixer` | `^10.4.14` (dev) | Vendor prefixes |

### Backend (`backend/package.json`)

| Lib | Version | Purpose |
|---|---:|---|
| `express` | `^4.22.1` | HTTP API server |
| `mongoose` | `^7.8.9` | MongoDB ODM |
| `@prisma/client` | `^6.19.0` | Prisma runtime client for PostgreSQL |
| `prisma` | `^6.19.0` | Prisma schema, generate, and migration CLI |
| `cloudinary` | `^2.10.0` | Cloudinary upload/delete SDK |
| `multer` | `^2.0.2` | Multipart upload middleware |
| `cors` | `^2.8.6` | CORS headers |
| `dotenv` | `^16.6.1` | Env vars |
| `jsonwebtoken` | `^9.0.3` | JWT auth |
| `bcryptjs` | `^3.0.3` | Password hashing |
| `cookie-parser` | `^1.4.7` | Cookie parsing |
| `express-async-handler` | `^1.2.0` | Async controller error handling |
| `uuid` | `^14.0.0` | Unique IDs |
| `nodemon` | `^3.0.1` (dev) | Dev auto-reload |

## How Things Work (Main Flows)

| Flow | Frontend entry | Backend entry | How it works (high level) |
|---|---|---|---|
| App boot | `frontend/src/main.jsx` | - | Mounts React, wraps with `BrowserRouter` + `AuthProvider`, renders routes in `App.jsx`. |
| Auth + protected pages | `frontend/src/App.jsx`, `frontend/src/context/AuthContext` | `backend/routes/authRoutes.js` | Login saves token in `localStorage.userInfo`; Axios interceptor attaches Bearer token; `ProtectedRoute` blocks unauth’d pages. |
| API calling | `frontend/src/config/api.js` | `backend/server.js` | Requests go to `http://localhost:5000/api`; `401` triggers localStorage clear + redirect to `/login`. |
| Transactions CRUD | `LedgerPage`, `AddRecordPage`, `useTransactions` | `backend/routes/transactionRoutes.js` | Controllers delegate to `TransactionService`; service validates, writes `Transaction`, creates `Ledger` entries, logs audit where applicable (`backend/ARCHITECTURE.md`). |
| Budgets | `BudgetsPage` | `backend/routes/budgetRoutes.js` | Budget CRUD + alerts/spent/remaining concept in `BudgetService`; schema in `backend/DATABASE_SCHEMA.md`. |
| OCR receipt scan | `ScanPage` -> `onScanComplete` sets form | `backend/routes/predictRoutes.js` (optional) | `ScanPage` OCR extracts fields; `App.jsx` merges into `formData` then navigates to `/add`; predicted category can be fetched from `/api/predict`. |
| Payments / QR | `PayPage` | `backend/routes/paymentRoutes.js` | Camera/QR flow uses `html5-qrcode` on frontend; backend has `PaymentService` + `PaymentAttempt` model for tracking attempts. |

## Generate Full Inventory Output

This prints:

- Direct deps from `frontend/package.json` and `backend/package.json`
- Transitive deps (from `package-lock.json`) summary + full list (optional)

Run from `bagels-web-app/`:

```powershell
node .\scripts\tech-inventory.mjs
```

Full transitive list (big):

```powershell
node .\scripts\tech-inventory.mjs --all
```
