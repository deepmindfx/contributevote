# ContributeVote

A modern, production-ready web application for managing group contributions and voting with integrated wallet functionality, powered by Supabase and Flutterwave.

## 🚀 Features

- 💰 **Wallet Management**
  - Real-time balance tracking
  - Secure transaction history
  - Bank transfers via Flutterwave
  - Multi-currency support (NGN/USD)

- 🏦 **Bank Integration**
  - Bank account validation
  - Secure transfers with Flutterwave
  - Transaction confirmation
  - Real-time transfer status

- 📊 **Group Contributions**
  - Create and manage contribution groups
  - Set targets and schedules
  - Track progress in real-time
  - Withdrawal management with voting

- 🔒 **Security & Performance**
  - PostgreSQL database with Supabase
  - Row Level Security (RLS)
  - Serverless Edge Functions
  - Real-time data synchronization

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, Shadcn UI, Lucide Icons
- **Database**: Supabase (PostgreSQL)
- **Payments**: Flutterwave API
- **Deployment**: Netlify
- **State Management**: React Context + Supabase

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)
- Supabase account
- Flutterwave account

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/contributevote.git
   cd contributevote
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual keys
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:8080](http://localhost:8080)**

## 🔧 Environment Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Flutterwave Configuration
VITE_FLW_SECRET_KEY_PROD=your_flutterwave_secret_key
VITE_FLW_PUBLIC_KEY_PROD=your_flutterwave_public_key
VITE_FLW_ENCRYPTION_KEY_PROD=your_flutterwave_encryption_key
VITE_FLW_SECRET_HASH=your_flutterwave_secret_hash

# Production Settings
VITE_USE_SUPABASE=true
```

## 🚀 Deployment

### Netlify Deployment

1. **Build for production:**
   ```bash
   npm run build:prod
   ```

2. **Deploy to Netlify:**
   - Connect your GitHub repository
   - Set build command: `npm run build:prod`
   - Set publish directory: `dist`
   - Add environment variables in Netlify dashboard

### Manual Deployment

```bash
# Build the project
npm run build:prod

# Preview the build
npm run preview

# Deploy the dist folder to your hosting provider
```

## 🔒 Security Features

- **Content Security Policy (CSP)** headers
- **X-Frame-Options** protection
- **XSS Protection** enabled
- **Row Level Security** in Supabase
- **Secure API endpoints** with authentication
- **Environment variable protection**

## 📊 Database Schema

The app uses Supabase with the following tables:
- `profiles` - User accounts and wallet balances
- `contribution_groups` - Group savings and targets
- `contributors` - Individual contribution records
- `transactions` - All financial transactions
- `withdrawal_requests` - Withdrawal management
- `notifications` - User notifications

## 🎯 API Endpoints

### Supabase Edge Functions
- `/flutterwave-banks` - Get Nigerian banks
- `/flutterwave-resolve-account` - Verify bank accounts
- `/flutterwave-transfer` - Process transfers
- `/webhook-contribution` - Handle payment webhooks

## 🧪 Testing

```bash
# Run linting
npm run lint

# Build and test
npm run build:prod
npm run preview
```

## 📈 Performance

- **Code splitting** with Rollup
- **Lazy loading** of components
- **Optimized bundle** sizes
- **CDN delivery** via Netlify
- **Real-time updates** with Supabase

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@contributevote.com or create an issue on GitHub.

---

**Built with ❤️ using React, Supabase, and Flutterwave**
