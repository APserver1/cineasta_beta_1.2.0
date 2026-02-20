-- Habilitar la extensión de almacenamiento si no está habilitada (normalmente viene por defecto)
-- create extension if not exists "storage";

-- Crear un bucket público para archivos del proyecto (audio, imágenes, etc.)
insert into storage.buckets (id, name, public)
values ('project_assets', 'project_assets', true)
on conflict (id) do nothing;

-- Políticas de Seguridad (RLS) para el bucket 'project_assets'

-- 1. Permitir acceso público de LECTURA a todos los archivos
create policy "Acceso público de lectura"
  on storage.objects for select
  using ( bucket_id = 'project_assets' );

-- 2. Permitir a usuarios autenticados SUBIR archivos
create policy "Usuarios autenticados pueden subir archivos"
  on storage.objects for insert
  with check ( bucket_id = 'project_assets' and auth.role() = 'authenticated' );

-- 3. Permitir a usuarios autenticados ACTUALIZAR sus propios archivos (opcional)
create policy "Usuarios autenticados pueden actualizar archivos"
  on storage.objects for update
  using ( bucket_id = 'project_assets' and auth.role() = 'authenticated' );

-- 4. Permitir a usuarios autenticados ELIMINAR sus propios archivos
create policy "Usuarios autenticados pueden eliminar archivos"
  on storage.objects for delete
  using ( bucket_id = 'project_assets' and auth.role() = 'authenticated' );
