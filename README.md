# Voro QR - Restaurant Menu System

## Deploy to Cloudflare Pages

### Option 1: Deploy via Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command**: `echo "No build needed"`
   - **Build output directory**: `.`
   - **Root directory**: `/` (or leave empty)
5. Click **Save and Deploy**

### Option 2: Deploy via Wrangler CLI

```bash
npm install -g wrangler
npx wrangler pages deploy . --project-name=voro-qr
```

### Build Settings for Cloudflare Pages:

- **Framework preset**: None
- **Build command**: (leave empty or use `echo "No build needed"`)
- **Build output directory**: `.`
- **Root directory**: `/`

## Local Development

Simply open `index.html` in a browser or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

## Project Structure

- `index.html` - Login page
- `admin.html` - Admin dashboard
- `menu.html` - Customer menu (QR code page)
- `config.js` - Configuration and API setup
- `database.js` - Database operations
- `admin-script.js` - Admin page logic
- `menu-script.js` - Menu page logic
