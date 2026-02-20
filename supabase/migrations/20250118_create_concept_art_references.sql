-- Create a new table for concept art references
CREATE TABLE IF NOT EXISTS public.concept_art_references (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.proyectos_cineasta(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.concept_art_references ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own references" 
    ON public.concept_art_references FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own references" 
    ON public.concept_art_references FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own references" 
    ON public.concept_art_references FOR DELETE 
    USING (auth.uid() = user_id);

-- Create bucket for references if it doesn't exist (this is usually done via UI or specialized call, but putting policy here just in case)
-- Note: Bucket creation via SQL is not standard in all Supabase setups, but policies are.
-- Assuming bucket 'concept-references' will be created.

INSERT INTO storage.buckets (id, name, public) 
VALUES ('concept-references', 'concept-references', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Give users access to own folder 1okq6b_0" ON storage.objects FOR SELECT TO public USING (bucket_id = 'concept-references' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Give users access to own folder 1okq6b_1" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'concept-references' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Give users access to own folder 1okq6b_2" ON storage.objects FOR DELETE TO public USING (bucket_id = 'concept-references' AND auth.uid()::text = (storage.foldername(name))[1]);
