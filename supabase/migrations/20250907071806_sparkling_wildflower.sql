/*
  # Authentication and User Management Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, references auth.users)
      - `email` (text)
      - `full_name` (text)
      - `role` (enum: viewer, uploader, admin)
      - `company` (text)
      - `position` (text)
      - `avatar_url` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `projects`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `model_url` (text)
      - `excel_url` (text)
      - `baseline_data` (jsonb)
      - `created_by` (uuid, references user_profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `is_active` (boolean)

    - `project_permissions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `project_id` (uuid, references projects)
      - `permission_type` (enum: view, upload, manage)
      - `granted_by` (uuid, references user_profiles)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('viewer', 'uploader', 'admin');
CREATE TYPE permission_type AS ENUM ('view', 'upload', 'manage');

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role user_role DEFAULT 'viewer',
  company text,
  position text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  model_url text,
  excel_url text,
  baseline_data jsonb,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Project permissions table
CREATE TABLE IF NOT EXISTS project_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  permission_type permission_type NOT NULL,
  granted_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_permissions ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Projects policies
CREATE POLICY "Users can view projects they have permission for"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_permissions
      WHERE user_id = auth.uid() AND project_id = projects.id
    ) OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Uploaders and admins can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('uploader', 'admin')
    )
  );

CREATE POLICY "Project creators and admins can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Project permissions policies
CREATE POLICY "Users can view their own permissions"
  ON project_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all permissions"
  ON project_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert default admin user (you'll need to create this user in Supabase Auth first)
-- This is just a placeholder - you'll need to update with actual admin user ID
INSERT INTO user_profiles (id, email, full_name, role) 
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with actual admin user ID
  'admin@construction.com',
  'System Administrator',
  'admin'
) ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Insert sample MOC project
INSERT INTO projects (name, description, model_url, excel_url, created_by) 
VALUES (
  'MOC Building Model',
  'Main construction project for MOC building with complete BIM model and progress tracking',
  '/models/z06.frag',
  '/excel-sheet/data.xlsx',
  '00000000-0000-0000-0000-000000000000' -- Replace with actual admin user ID
) ON CONFLICT DO NOTHING;