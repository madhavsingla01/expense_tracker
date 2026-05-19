# Render Deployment Guide

## Backend

Root directory:
```bash
bagels-web-app/backend
```

Plan:
```bash
starter
```

Build command:
```bash
npm install && npm run prisma:generate
```

Pre-deploy command:
```bash
npm run prisma:deploy
```

Start command:
```bash
npm start
```

Required environment variables:
```bash
NODE_ENV=production
NODE_VERSION=22.12.0
DATABASE_URL=<Render PostgreSQL internal connection string>
MONGO_URI=<existing MongoDB connection string>
JWT_SECRET=<generated secret>
CORS_ORIGINS=<frontend Render URL>
CLOUDINARY_CLOUD_NAME=<cloudinary cloud name>
CLOUDINARY_API_KEY=<cloudinary api key>
CLOUDINARY_API_SECRET=<cloudinary api secret>
CLOUDINARY_PROFILE_FOLDER=bagels/profiles
RAZORPAY_KEY_ID=<razorpay key>
RAZORPAY_KEY_SECRET=<razorpay secret>
RAZORPAY_WEBHOOK_SECRET=<razorpay webhook secret>
RAZORPAY_ACCOUNT_NAME=CASH CLAIR
RAZORPAY_THEME_COLOR=#10b981
ADMIN_USERNAME=<admin username>
ADMIN_PASSWORD=<admin password>
```

## Frontend

Root directory:
```bash
bagels-web-app/frontend
```

Build command:
```bash
npm install && npm run build
```

Publish directory:
```bash
dist
```

Required environment variables:
```bash
VITE_API_BASE_URL=https://<backend-service>.onrender.com/api
VITE_SERVER_URL=https://<backend-service>.onrender.com
```

## Database

Create a Render PostgreSQL database and connect its internal connection string to `DATABASE_URL`.

Apply Prisma migrations through the backend pre-deploy command:
```bash
npm run prisma:deploy
```

Sync existing Mongo users into PostgreSQL after the first deploy:
```bash
npm run prisma:sync-users
```

References:
- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploy-prisma-orm
- https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate
