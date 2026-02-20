import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const MAX_CHARS = 280;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const SocialComposer = ({ onPosted }) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = useMemo(() => text.trim(), [text]);
  const canPost = useMemo(() => {
    return !posting && (trimmed.length > 0 || Boolean(file)) && trimmed.length <= MAX_CHARS;
  }, [file, posting, trimmed.length]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickImage = () => {
    fileInputRef.current?.click();
  };

  const onPickFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Solo se permiten imágenes.');
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError('La imagen es demasiado grande (máx 8 MB).');
      return;
    }
    setError(null);
    setFile(f);
  };

  const clearImage = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const post = async () => {
    if (!user) return;
    if (!canPost) return;
    setPosting(true);
    setError(null);

    const postId = crypto.randomUUID();
    const content = trimmed.length > 0 ? trimmed : '';

    try {
      const { error: postErr } = await supabase
        .from('posts')
        .insert([{ id: postId, author_id: user.id, content }]);
      if (postErr) throw postErr;

      if (file) {
        const safeName = (file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${user.id}/${postId}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from('post-images')
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(storagePath);
        const publicUrl = urlData?.publicUrl;
        if (!publicUrl) throw new Error('No se pudo obtener la URL pública de la imagen.');

        const { error: mediaErr } = await supabase
          .from('post_media')
          .insert([
            {
              post_id: postId,
              owner_id: user.id,
              storage_path: storagePath,
              public_url: publicUrl,
              mime_type: file.type,
              size_bytes: file.size,
            },
          ]);
        if (mediaErr) throw mediaErr;
      }

      setText('');
      clearImage();
      onPosted?.();
    } catch (_e) {
      await supabase.from('post_media').delete().eq('post_id', postId);
      await supabase.from('posts').delete().eq('id', postId);
      setError('No se pudo publicar.');
    } finally {
      setPosting(false);
    }
  };

  if (!user) {
    return (
      <div id="composer" className="px-4 py-4 border-b border-purple-100">
        <div className="bg-white/70 border border-purple-100 rounded-2xl p-4">
          <div className="text-sm text-gray-900 font-semibold">¿Qué estás pensando?</div>
          <div className="mt-1 text-sm text-gray-600">
            Inicia sesión para publicar texto e imágenes.
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500">
              <ImagePlus size={18} />
              <span className="text-xs">Imagen</span>
            </div>
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="composer" className="px-4 py-4 border-b border-purple-100">
      <div className="bg-white/70 border border-purple-100 rounded-2xl p-4">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-full bg-purple-100 overflow-hidden flex items-center justify-center flex-shrink-0">
            <div className="w-full h-full bg-gradient-to-br from-purple-600/40 to-fuchsia-600/20" />
          </div>

          <div className="min-w-0 flex-1">
            <textarea
              value={text}
              onChange={(e) => {
                const next = e.target.value;
                setText(next);
                if (next.length > MAX_CHARS) setError(`Máximo ${MAX_CHARS} caracteres.`);
                else setError(null);
              }}
              placeholder="¿Qué está pasando?"
              className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed text-gray-900 placeholder:text-gray-400 min-h-[72px]"
              maxLength={MAX_CHARS + 50}
            />

            {previewUrl ? (
              <div className="mt-3 rounded-2xl overflow-hidden border border-purple-100 bg-white relative">
                <img src={previewUrl} alt="Preview" className="w-full max-h-[420px] object-contain" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-gray-700 border border-purple-100 flex items-center justify-center"
                  title="Quitar"
                >
                  <X size={18} />
                </button>
              </div>
            ) : null}

            {error ? (
              <div className="mt-2 text-sm text-red-300">{error}</div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={pickImage}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-purple-50 text-gray-700"
                >
                  <ImagePlus size={18} />
                  <span className="text-sm font-medium">Imagen</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
                <div className="text-xs text-gray-500">
                  {trimmed.length}/{MAX_CHARS}
                </div>
              </div>

              <button
                type="button"
                onClick={post}
                disabled={!canPost}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {posting ? 'Publicando…' : 'Postear'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialComposer;
