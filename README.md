# Construction Progress Platform

A comprehensive construction project management platform with 3D BIM visualization, real-time progress tracking, and role-based access control.

## Features

### 🏗️ Core Features
- **3D BIM Visualization**: Interactive 3D models directly from Revit
- **Real-time Progress Tracking**: Live updates from construction site activities
- **Excel Integration**: Import and manage project data from Excel sheets
- **Role-based Access Control**: Secure user management with customizable permissions

### 👥 User Roles
- **Viewer**: Can only view projects and progress
- **Uploader**: Can upload projects and update baselines
- **Admin**: Full system access and user management

### 🎨 Modern UI/UX
- Responsive design for all devices
- Dark theme with glass morphism effects
- Smooth animations and transitions
- Professional construction industry aesthetics

## Setup Instructions

### 1. Prerequisites
- Node.js 18+ installed
- Supabase account
- Git

### 2. Supabase Setup

1. **Create a new Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Set up authentication**:
   - Go to Authentication > Settings
   - Disable email confirmations (or configure SMTP)
   - Enable email/password authentication

3. **Create admin user**:
   - Go to Authentication > Users
   - Create a new user with email: `admin@construction.com`
   - Password: `123456789ff`
   - Note the user ID

4. **Run database migrations**:
   - Go to SQL Editor in Supabase
   - Copy and run the SQL from `supabase/migrations/create_auth_schema.sql`
   - Update the admin user ID in the INSERT statements

### 3. Environment Setup

1. **Clone and install**:
   ```bash
   git clone <your-repo>
   cd construction-platform
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

### 4. Admin Access

- **Username**: `admin`
- **Password**: `123456789ff`

Or use the email: `admin@construction.com`

## Project Structure

```
src/
├── components/          # React components
│   ├── LandingPage.tsx     # Marketing landing page
│   ├── AuthModal.tsx       # Login/Register modal
│   ├── Dashboard.tsx       # User dashboard
│   ├── BaselinePage.tsx    # Project baseline view
│   └── AdminPanel.tsx      # Admin management panel
├── hooks/              # Custom React hooks
│   └── useAuth.ts         # Authentication hook
├── lib/                # Utilities and configurations
│   └── supabase.ts        # Supabase client and types
├── core/               # BIM viewer core (existing)
└── main/               # Application entry points
```

## Database Schema

### Tables
- **user_profiles**: User information and roles
- **projects**: Construction projects
- **project_permissions**: User access permissions per project

### Roles
- `viewer`: Read-only access to assigned projects
- `uploader`: Can create/update projects and baselines
- `admin`: Full system access

## Key Features Implementation

### 1. Authentication & Authorization
- Supabase Auth for secure user management
- Row Level Security (RLS) for data protection
- Role-based access control

### 2. Project Management
- Project creation and management
- File upload for models and Excel sheets
- Permission management per project

### 3. 3D Visualization
- Integration with existing BIM viewer
- Real-time progress visualization
- Interactive 3D models

### 4. Progress Tracking
- Excel sheet integration
- Activity progress monitoring
- Baseline comparison

## Deployment

### Production Build
```bash
npm run build
```

### Deploy to Vercel/Netlify
1. Connect your repository
2. Set environment variables
3. Deploy

### Supabase Production
1. Upgrade to Pro plan if needed
2. Configure custom domain
3. Set up proper SMTP for emails
4. Configure storage for file uploads

## Additional Professional Features

### Security
- JWT-based authentication
- Row-level security
- Input validation and sanitization
- HTTPS enforcement

### Performance
- Code splitting and lazy loading
- Image optimization
- Caching strategies
- CDN integration

### Monitoring
- Error tracking (Sentry integration ready)
- Analytics (Google Analytics ready)
- Performance monitoring
- User activity logging

### Integrations
- Email notifications
- File storage (Supabase Storage)
- Real-time updates
- Mobile app ready (PWA)

## Support

For technical support or feature requests, please contact the development team.

## License

Proprietary - All rights reserved