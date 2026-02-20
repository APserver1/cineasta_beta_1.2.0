import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useInView } from '../../hooks/useInView';
import SocialPostCard from './SocialPostCard';

const PAGE_SIZE = 15;

const SocialFeed = ({ mode, refreshKey, authorId }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [mediaByPostId, setMediaByPostId] = useState({});
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadedIdsRef = useRef(new Set());
  const followedIdsRef = useRef(null);

  const isFollowingMode = mode === 'following';

  const { ref: sentinelRef, inView } = useInView({ rootMargin: '600px' });

  const canUseFollowing = Boolean(user);

  const resetKey = useMemo(() => {
    return `${mode}:${authorId || 'all'}:${refreshKey || ''}`;
  }, [mode, authorId, refreshKey]);

  const fetchProfiles = async (userIds) => {
    const missing = userIds.filter((id) => !profilesById[id]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from('public_profile')
      .select('user_id, username, profile_picture_url')
      .in('user_id', missing);
    const next = { ...profilesById };
    (data || []).forEach((p) => {
      next[p.user_id] = p;
    });
    setProfilesById(next);
  };

  const fetchMedia = async (postIds) => {
    if (postIds.length === 0) return;
    const { data } = await supabase
      .from('post_media')
      .select('post_id, public_url, storage_path')
      .in('post_id', postIds);
    const next = { ...mediaByPostId };
    (data || []).forEach((m) => {
      if (!next[m.post_id]) next[m.post_id] = m;
    });
    setMediaByPostId(next);
  };

  const getFollowedIds = async () => {
    if (!user) return [];
    if (followedIdsRef.current) return followedIdsRef.current;
    const { data } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', user.id);
    const ids = (data || []).map((r) => r.followed_id);
    followedIdsRef.current = ids;
    return ids;
  };

  const loadMore = async ({ initial = false } = {}) => {
    if (loading) return;
    if (!hasMore && !initial) return;
    if (isFollowingMode && !canUseFollowing) return;

    setLoading(true);
    setError(null);

    try {
      let q = supabase
        .from('posts')
        .select('id, author_id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (authorId) {
        q = q.eq('author_id', authorId);
      } else if (isFollowingMode) {
        const ids = await getFollowedIds();
        if (ids.length === 0) {
          setItems([]);
          setHasMore(false);
          setCursor(null);
          setLoading(false);
          return;
        }
        q = q.in('author_id', ids);
      }

      const effectiveCursor = initial ? null : cursor;
      if (effectiveCursor?.created_at) {
        q = q.lt('created_at', effectiveCursor.created_at);
      }

      const { data, error: qErr } = await q;
      if (qErr) throw qErr;

      const rows = (data || []).filter((p) => {
        if (loadedIdsRef.current.has(p.id)) return false;
        loadedIdsRef.current.add(p.id);
        return true;
      });

      setItems((prev) => (initial ? rows : [...prev, ...rows]));

      const last = rows[rows.length - 1];
      setCursor(last ? { created_at: last.created_at } : effectiveCursor);
      setHasMore((data || []).length === PAGE_SIZE);

      const authorIds = [...new Set(rows.map((p) => p.author_id))];
      await Promise.all([fetchProfiles(authorIds), fetchMedia(rows.map((p) => p.id))]);
    } catch (e) {
      setError(e?.message || 'Error cargando el feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadedIdsRef.current = new Set();
    followedIdsRef.current = null;
    setItems([]);
    setProfilesById({});
    setMediaByPostId({});
    setCursor(null);
    setHasMore(true);
    loadMore({ initial: true });
  }, [resetKey]);

  useEffect(() => {
    if (inView) loadMore();
  }, [inView]);

  const onDeleted = (postId) => {
    setItems((prev) => prev.filter((p) => p.id !== postId));
  };

  if (isFollowingMode && !canUseFollowing) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="text-lg font-semibold text-gray-900">Inicia sesión</div>
        <div className="mt-1">Necesitas una cuenta para ver “Siguiendo”.</div>
        <a
          href="/login"
          className="inline-flex mt-4 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold"
        >
          Iniciar sesión
        </a>
      </div>
    );
  }

  if (!loading && items.length === 0 && !hasMore) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="text-lg font-semibold text-gray-900">Sin posts</div>
        <div className="mt-1 text-gray-600">Aún no hay publicaciones para mostrar.</div>
      </div>
    );
  }

  return (
    <div>
      {items.map((p) => (
        <SocialPostCard
          key={p.id}
          post={p}
          profile={profilesById[p.author_id]}
          media={mediaByPostId[p.id]}
          onDeleted={onDeleted}
        />
      ))}

      {error ? (
        <div className="px-4 py-6 text-sm text-red-600">
          {error}{' '}
          <button
            type="button"
            onClick={() => loadMore()}
            className="underline hover:text-red-700"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-10" />

      {loading ? (
        <div className="px-4 py-6 text-sm text-gray-500">Cargando…</div>
      ) : null}
    </div>
  );
};

export default SocialFeed;
