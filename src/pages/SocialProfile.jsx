import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import SocialLayout from '../components/social/SocialLayout';
import SocialFeed from '../components/social/SocialFeed';

const SocialProfile = () => {
  const { username } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [counts, setCounts] = useState({ seguidos: 0, seguidores: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const decodedUsername = useMemo(() => {
    try {
      return decodeURIComponent(username || '');
    } catch (_e) {
      return username || '';
    }
  }, [username]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('public_profile')
        .select('user_id, username, description, profile_picture_url, banner_url')
        .eq('username', decodedUsername)
        .maybeSingle();

      if (!alive) return;
      setProfile(data || null);
      setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [decodedUsername]);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    const loadCounts = async () => {
      const { data } = await supabase
        .from('users')
        .select('seguidos, seguidores')
        .eq('id', profile.user_id)
        .maybeSingle();
      if (!alive) return;
      if (data) setCounts({ seguidos: data.seguidos || 0, seguidores: data.seguidores || 0 });
    };
    loadCounts();
    return () => {
      alive = false;
    };
  }, [profile?.user_id]);

  useEffect(() => {
    if (!user || !profile) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('followed_id', profile.user_id)
        .maybeSingle();
      if (!alive) return;
      setIsFollowing(Boolean(data));
    };
    load();
    return () => {
      alive = false;
    };
  }, [user?.id, profile?.user_id]);

  const toggleFollow = async () => {
    if (!user || !profile) return;
    setBusy(true);
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('followed_id', profile.user_id);
        setIsFollowing(false);
        setCounts((c) => ({ ...c, seguidores: Math.max(0, c.seguidores - 1) }));
      } else {
        await supabase
          .from('follows')
          .insert([{ follower_id: user.id, followed_id: profile.user_id }]);
        setIsFollowing(true);
        setCounts((c) => ({ ...c, seguidores: c.seguidores + 1 }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SocialLayout>
      <div className="h-full glass border border-purple-100 rounded-2xl overflow-hidden shadow-lg shadow-purple-100 flex flex-col">
        <div className="px-4 py-3 border-b border-purple-100 bg-white/40 flex items-center justify-between">
          <Link to="/social" className="text-sm text-gray-600 hover:text-purple-800">
            ← Volver
          </Link>
          <div className="text-sm text-gray-500">Perfil</div>
        </div>

        {loading ? (
          <div className="p-8 text-gray-600">Cargando…</div>
        ) : !profile ? (
          <div className="p-8 text-gray-600">Perfil no encontrado.</div>
        ) : (
          <div className="min-h-0 overflow-y-auto">
            <div className="border-b border-purple-100">
              <div className="h-28 bg-purple-50/40 overflow-hidden">
                {profile.banner_url ? (
                  <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-purple-200/70 to-fuchsia-100/50" />
                )}
              </div>
              <div className="px-4 pb-4">
                <div className="-mt-7 flex items-end justify-between gap-4">
                  <div className="w-14 h-14 rounded-full bg-white border border-purple-100 overflow-hidden shadow-sm">
                    {profile.profile_picture_url ? (
                      <img
                        src={profile.profile_picture_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-200/70 to-fuchsia-100/50" />
                    )}
                  </div>
                  {user ? (
                    <button
                      type="button"
                      onClick={toggleFollow}
                      disabled={busy || user.id === profile.user_id}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                        isFollowing
                          ? 'bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      } disabled:opacity-60`}
                    >
                      {user.id === profile.user_id
                        ? 'Tu perfil'
                        : busy
                          ? '...'
                          : isFollowing
                            ? 'Siguiendo'
                            : 'Seguir'}
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
                    >
                      Seguir
                    </Link>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-xl font-bold text-gray-900">{profile.username}</div>
                  <div className="text-sm text-gray-500">@{profile.username}</div>
                  {profile.description ? (
                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {profile.description}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-900">{counts.seguidos}</span>{' '}
                      <span className="text-gray-500">Siguiendo</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">{counts.seguidores}</span>{' '}
                      <span className="text-gray-500">Seguidores</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <SocialFeed mode="forYou" authorId={profile.user_id} />
          </div>
        )}
      </div>
    </SocialLayout>
  );
};

export default SocialProfile;
