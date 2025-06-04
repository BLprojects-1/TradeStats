-- Migration: Create trade_criteria table for Professional Trade Checklist
-- Created: 2024-12-23

-- Create the trade_criteria table
CREATE TABLE IF NOT EXISTS public.trade_criteria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('yes', 'no', 'more_than', 'less_than', 'between')),
  value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trade_criteria_updated_at
  BEFORE UPDATE ON public.trade_criteria
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS trade_criteria_user_id_idx ON public.trade_criteria(user_id);
CREATE INDEX IF NOT EXISTS trade_criteria_created_at_idx ON public.trade_criteria(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.trade_criteria ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own trade criteria" 
  ON public.trade_criteria FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade criteria" 
  ON public.trade_criteria FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade criteria" 
  ON public.trade_criteria FOR UPDATE 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade criteria" 
  ON public.trade_criteria FOR DELETE 
  USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.trade_criteria TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated; 