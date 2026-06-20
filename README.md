# Abros Healthcare Backend

Express + MongoDB API for medicine inventory, customers, and invoices.

## Setup

```bash
npm install
cp .env.example .env   # set MONGO_URI
npm run dev
```

API runs on `http://localhost:3000`  
Swagger docs: `http://localhost:3000/api-docs`

## Frontend

The React dashboard lives in a separate repo:

**https://github.com/abhinav21769/abros-web-frontend**

Live app: https://abros-healthcare.web.app

## Deploy

Backend deploys to [Render](https://render.com) via `render.yaml`.

Production API: https://abros-healthcare.onrender.com
