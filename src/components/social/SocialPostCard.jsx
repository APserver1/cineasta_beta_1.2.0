import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Repeat2, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

const iconBtn =
  'inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition-colors';

const SocialPostCard = ({ post, profile, media, onDeleted }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // States for interaction
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasBookmarked, setHasBookmarked] = useState(false);

  const canDelete = user?.id && post.author_id === user.id;

  const handle = useMemo(() => {
    const u = profile?.username || 'cineasta';
    return u;
  }, [profile?.username]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const checkInteractions = async () => {
      const [lRes, bRes] = await Promise.all([
        supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('post_bookmarks').select('id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle(),
      ]);
      if (!alive) return;
      if (lRes.data) setHasLiked(true);
      if (bRes.data) setHasBookmarked(true);
    };
    checkInteractions();
    return () => { alive = false; };
  }, [user, post.id]);

  const toggleLike = async () => {
    if (!user) return; // or show login modal
    const prevLiked = hasLiked;
    const prevCount = likesCount;

    // Optimistic UI
    setHasLiked(!prevLiked);
    setLikesCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      if (prevLiked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').insert([{ post_id: post.id, user_id: user.id }]);
      }
    } catch (_e) {
      // Revert
      setHasLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const toggleBookmark = async () => {
    if (!user) return;
    const prevBookmarked = hasBookmarked;
    setHasBookmarked(!prevBookmarked);

    try {
      if (prevBookmarked) {
        await supabase.from('post_bookmarks').delete().eq('post_id', post.id).eq('user_id', user.id);
      } else {
        await supabase.from('post_bookmarks').insert([{ post_id: post.id, user_id: user.id }]);
      }
    } catch (_e) {
      setHasBookmarked(prevBookmarked);
    }
  };

  const onDelete = async () => {
    if (!canDelete) return;
    const ok = window.confirm('¿Borrar este post?');
    if (!ok) return;
    setBusy(true);
    try {
      if (media?.storage_path) {
        await supabase.storage.from('post-images').remove([media.storage_path]);
      }
      await supabase.from('post_media').delete().eq('post_id', post.id);
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      onDeleted?.(post.id);
    } catch (_e) {
      alert('No se pudo borrar el post.');
    } finally {
      setBusy(false);
    }
  };

  const handleCardClick = (e) => {
    // Avoid navigation if clicking interactive elements
    if (e.target.closest('a') || e.target.closest('button')) return;
    navigate(`/social/post/${post.id}`);
  };

  return (
    <article 
      onClick={handleCardClick}
      className="px-4 py-4 border-b border-purple-100 hover:bg-purple-50/40 transition-colors cursor-pointer"
    >
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-full bg-purple-100 overflow-hidden flex items-center justify-center flex-shrink-0">
          {profile?.profile_picture_url ? (
            <img
              src={profile.profile_picture_url}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600/40 to-fuchsia-600/20" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  to={`/social/u/${encodeURIComponent(handle)}`}
                  className="font-semibold truncate hover:underline"
                >
                  {profile?.username || 'Usuario'}
                </Link>
                <span className="text-sm text-gray-500 truncate">@{handle}</span>
                <span className="text-sm text-gray-500">· {formatRelativeTime(post.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {canDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className={`${iconBtn} ${busy ? 'opacity-60' : ''}`}
                  title="Borrar"
                >
                  <Trash2 size={18} />
                </button>
              ) : (
                <button type="button" className={iconBtn} title="Más">
                  <MoreHorizontal size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </div>

          {media?.public_url ? (
            <a
              href={media.public_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block rounded-2xl overflow-hidden border border-purple-100 bg-white"
            >
              <img
                src={media.public_url}
                alt="Post"
                className="w-full max-h-[520px] object-contain"
              />
            </a>
          ) : null}

          <div className="mt-3 flex items-center justify-between max-w-md">
            <button type="button" className={`${iconBtn} group`} title="Responder">
              <MessageCircle size={18} className="group-hover:text-purple-600" />
              {post.replies_count > 0 && <span className="ml-1 text-xs">{post.replies_count}</span>}
            </button>
            <button type="button" className={`${iconBtn} group`} title="Repostear">
              <Repeat2 size={18} className="group-hover:text-green-600" />
            </button>
            <button
              type="button"
              onClick={toggleLike}
              className={`${iconBtn} group ${hasLiked ? 'text-pink-600 hover:text-pink-700 hover:bg-pink-50' : ''}`}
              title="Me gusta"
            >
              <Heart size={18} className={`group-hover:text-pink-600 ${hasLiked ? 'fill-current' : ''}`} />
              {likesCount > 0 && <span className="ml-1 text-xs">{likesCount}</span>}
            </button>
            <button
              type="button"
              onClick={toggleBookmark}
              className={`${iconBtn} group ${hasBookmarked ? 'text-purple-600 hover:text-purple-700' : ''}`}
              title="Guardar"
            >
              <Bookmark size={18} className={`group-hover:text-purple-600 ${hasBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
export default SocialPostCard;

