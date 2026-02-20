CREATE TABLE IF NOT EXISTS public.series_cineasta (
    serie_nombre TEXT PRIMARY KEY,
    timeline_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.series_cineasta ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own series data" ON public.series_cineasta
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own series data" ON public.series_cineasta
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own series data" ON public.series_cineasta
    FOR UPDATE USING (auth.uid() = user_id);
