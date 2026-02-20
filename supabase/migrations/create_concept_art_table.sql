CREATE TABLE IF NOT EXISTS public.concept_art (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.proyectos_cineasta(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    name TEXT,
    tag TEXT,
    aspect_ratio TEXT,
    width INTEGER,
    height INTEGER,
    layers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.concept_art ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own concept art" ON public.concept_art
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own concept art" ON public.concept_art
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own concept art" ON public.concept_art
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own concept art" ON public.concept_art
    FOR DELETE USING (auth.uid() = user_id);
