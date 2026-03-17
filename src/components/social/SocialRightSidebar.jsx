import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Search, User } from 'lucide-react';

const Card = ({ title, children }) => (
  <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
    <div className="px-4 py-3 font-bold text-gray-800 border-b border-gray-50">{title}</div>
    <div className="px-4 py-3">{children}</div>
  </div>
);

const SocialRightSidebar = () => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const trends = useMemo(
    () => [
      { tag: 'Guion', hint: 'Cine y escritura' },
      { tag: 'Storyboard', hint: 'Preproducción' },
      { tag: 'Animatics', hint: 'Edición' },
      { tag: 'ConceptArt', hint: 'Arte' },
    ],
    []
  );

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from('public_profile')
        .select('user_id, username, profile_picture_url')
        .not('username', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(6);
      if (!alive) return;
      setSuggestions((data || []).filter((p) => p.user_id !== user?.id));
    };
    load();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const follow = async (profile) => {
    if (!user) return;
    setBusyId(profile.user_id);
    await supabase
      .from('follows')
      .insert([{ follower_id: user.id, followed_id: profile.user_id }]);
    setBusyId(null);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="bg-white border border-gray-200 rounded-full px-4 py-2.5 flex items-center gap-2 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all shadow-sm">
        <Search size={18} className="text-gray-400" />
        <input
          className="w-full bg-transparent outline-none text-sm placeholder:text-gray-400 text-gray-700"
          placeholder="Buscar en Social"
        />
      </div>

      <Card title="Qué está pasando">
        <div className="space-y-4">
          {trends.map((t) => (
            <div key={t.tag} className="flex items-start justify-between gap-3 group cursor-pointer">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">{t.hint}</div>
                <div className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors">#{t.tag}</div>
              </div>
              <div className="text-xs text-gray-400 group-hover:text-purple-400">⋯</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="A quién seguir">
        <div className="space-y-4">
          {suggestions.slice(0, 3).map((p) => (
            <div key={p.user_id} className="flex items-center justify-between gap-3">
              <Link
                to={`/social/u/${encodeURIComponent(p.username || '')}`}
                className="min-w-0 flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-full bg-purple-50 overflow-hidden flex items-center justify-center border border-purple-100">
                  {p.profile_picture_url ? (
                    <img
                      src={p.profile_picture_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-white flex items-center justify-center text-purple-300">
                        <User size={20} />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-800 truncate group-hover:text-purple-700 transition-colors">{p.username || 'Usuario'}</div>
                  <div className="text-xs text-gray-500 truncate">@{p.username || 'cineasta'}</div>
                </div>
              </Link>
              {user ? (
                <button
                  type="button"
                  onClick={() => follow(p)}
                  disabled={busyId === p.user_id}
                  className="px-3 py-1.5 rounded-full bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {busyId === p.user_id ? '...' : 'Seguir'}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-full bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors"
                >
                  Seguir
                </Link>
              )}
            </div>
          ))}
          <div className="pt-2 border-t border-gray-50 mt-2">
            <Link to="/social/explore" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              Mostrar más
            </Link>
          </div>
        </div>
      </Card>

      <div className="text-xs text-gray-400 px-2">
        <div>© 2024 Cineasta Social Beta.</div>
      </div>
    </div>
  );
};

export default SocialRightSidebar;
