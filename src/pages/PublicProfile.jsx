import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Camera, Edit2, Save, X, User } from 'lucide-react';
import SocialPostCard from '../components/social/SocialPostCard';

const PublicProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    description: '',
    banner_url: null,
    profile_picture_url: null
  });
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [userPosts, setUserPosts] = useState([]);
  const [mediaByPostId, setMediaByPostId] = useState({});
  
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempDesc, setTempDesc] = useState('');
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
      fetchUserPosts();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const [followers, following, postsCount] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('followed_id', user.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', user.id)
      ]);
      
      setStats({
        followers: followers.count || 0,
        following: following.count || 0,
        posts: postsCount.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const { data: postsData, error: postsErr } = await supabase
        .from('posts')
        .select('id, author_id, content, created_at, likes_count, replies_count')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      if (postsErr) throw postsErr;

      const posts = postsData || [];
      setUserPosts(posts);

      const postIds = posts.map((p) => p.id);
      if (postIds.length === 0) {
        setMediaByPostId({});
        return;
      }

      const { data: mediaData, error: mediaErr } = await supabase
        .from('post_media')
        .select('post_id, public_url, storage_path')
        .in('post_id', postIds);

      if (mediaErr) throw mediaErr;
      const map = {};
      (mediaData || []).forEach((m) => {
        if (!map[m.post_id]) map[m.post_id] = m;
      });
      setMediaByPostId(map);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const handlePostDeleted = (postId) => {
    setUserPosts(prev => prev.filter(p => p.id !== postId));
    setMediaByPostId((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setStats(prev => ({ ...prev, posts: Math.max(0, prev.posts - 1) }));
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Try fetching from public_profile
      let { data, error } = await supabase
        .from('public_profile')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, try to create it from users table or defaults
        const { data: userData } = await supabase
            .from('users')
            .select('username, profile_picture, description')
            .eq('id', user.id)
            .single();
            
        if (userData) {
            // Create public_profile record
            const { data: newProfile, error: createError } = await supabase
                .from('public_profile')
                .insert([{
                    user_id: user.id,
                    username: userData.username,
                    profile_picture_url: userData.profile_picture,
                    description: userData.description
                }])
                .select()
                .single();
            
            if (!createError) data = newProfile;
        }
      }

      if (data) {
        setProfile(data);
        setTempDesc(data.description || '');
        setTempName(data.username || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file, bucketPath) => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${bucketPath}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir la imagen');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const publicUrl = await uploadImage(file, 'banners');
    if (publicUrl) {
      const { error } = await supabase
        .from('public_profile')
        .update({ banner_url: publicUrl })
        .eq('user_id', user.id);

      if (!error) {
        setProfile(prev => ({ ...prev, banner_url: publicUrl }));
      }
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const publicUrl = await uploadImage(file, 'avatars');
    if (publicUrl) {
      // Update both public_profile and users table for consistency
      const { error } = await supabase
        .from('public_profile')
        .update({ profile_picture_url: publicUrl })
        .eq('user_id', user.id);

      await supabase
        .from('users')
        .update({ profile_picture: publicUrl })
        .eq('id', user.id);

      if (!error) {
        setProfile(prev => ({ ...prev, profile_picture_url: publicUrl }));
      }
    }
  };

  const saveDescription = async () => {
    const { error } = await supabase
      .from('public_profile')
      .update({ description: tempDesc })
      .eq('user_id', user.id);

    if (!error) {
      setProfile(prev => ({ ...prev, description: tempDesc }));
      setIsEditingDesc(false);
      
      // Sync with users table
      await supabase
        .from('users')
        .update({ description: tempDesc })
        .eq('id', user.id);
    }
  };

  const saveUsername = async () => {
    if (tempName === profile.username) {
        setIsEditingName(false);
        return;
    }
    
    if (tempName.length < 3) {
        alert('El nombre de usuario debe tener al menos 3 caracteres.');
        return;
    }

    try {
        // Check availability
        const { data: isAvailable, error: checkError } = await supabase
            .rpc('check_username_availability', { username_to_check: tempName });

        if (checkError) throw checkError;
        if (!isAvailable) {
            alert('El nombre de usuario ya está en uso.');
            return;
        }

        const { error } = await supabase
          .from('public_profile')
          .update({ username: tempName })
          .eq('user_id', user.id);

        if (error) throw error;

        setProfile(prev => ({ ...prev, username: tempName }));
        setIsEditingName(false);
        
        // Sync with users table
        await supabase
            .from('users')
            .update({ username: tempName })
            .eq('id', user.id);
            
    } catch (error) {
        console.error('Error updating username:', error);
        alert('Error al actualizar el nombre de usuario');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando perfil...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Banner Section */}
      <div className="relative w-full h-64 md:h-80 bg-gray-200 group overflow-hidden">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-2xl tracking-widest bg-gray-100">
            BANNER
          </div>
        )}
        
        <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
          <Camera size={48} className="mb-2" />
          <span className="font-bold text-sm uppercase tracking-wider">Cambiar Banner</span>
          <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      <div className="container mx-auto px-4 sm:px-8">
        <div className="relative flex flex-col md:flex-row items-end -mt-16 md:-mt-20 mb-8 gap-6">
          {/* Profile Picture */}
          <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white bg-white shadow-xl overflow-hidden flex-shrink-0 group">
            {profile.profile_picture_url ? (
              <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                <User size={64} />
              </div>
            )}
            
            <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white rounded-full">
              <Camera size={24} />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
            </label>
          </div>

          {/* User Info */}
          <div className="flex-1 pb-2 text-center md:text-left">
            {isEditingName ? (
                <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                    <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="text-3xl font-black text-gray-900 uppercase tracking-tight bg-white border border-gray-300 rounded px-2 py-1 max-w-[300px]"
                        autoFocus
                    />
                    <button 
                        onClick={saveUsername}
                        className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                    >
                        <Save size={20} />
                    </button>
                    <button 
                        onClick={() => { setIsEditingName(false); setTempName(profile.username); }}
                        className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2 mb-1 justify-center md:justify-start group/name">
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
                    {profile.username || 'Usuario'}
                    </h1>
                    <button 
                        onClick={() => setIsEditingName(true)}
                        className="opacity-0 group-hover/name:opacity-100 p-1 text-gray-400 hover:text-purple-600 transition-all"
                        title="Editar nombre de usuario"
                    >
                        <Edit2 size={18} />
                    </button>
                </div>
            )}
            <p className="text-purple-600 font-bold text-sm uppercase tracking-wider mb-3">
              Cineasta
            </p>
            
            {/* Stats */}
            <div className="flex items-center justify-center md:justify-start gap-6 text-sm">
                <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900 text-lg">{stats.followers}</span>
                    <span className="text-gray-500">Seguidores</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900 text-lg">{stats.following}</span>
                    <span className="text-gray-500">Seguidos</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900 text-lg">{stats.posts}</span>
                    <span className="text-gray-500">Posts</span>
                </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: About */}
            <div className="lg:col-span-1">
                <div className="max-w-3xl">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide border-b-2 border-purple-500 pb-1">Sobre Mí</h2>
                        {!isEditingDesc && (
                            <button 
                                onClick={() => setIsEditingDesc(true)}
                                className="text-purple-600 hover:text-purple-700 flex items-center gap-1 text-sm font-bold uppercase tracking-wider"
                            >
                                <Edit2 size={14} /> Editar
                            </button>
                        )}
                    </div>

                    {isEditingDesc ? (
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <textarea
                                value={tempDesc}
                                onChange={(e) => setTempDesc(e.target.value)}
                                className="w-full min-h-[150px] p-3 border border-gray-200 rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 resize-y mb-3"
                                placeholder="Escribe algo sobre ti..."
                            />
                            <div className="flex gap-2 justify-end">
                                <button 
                                    onClick={() => { setIsEditingDesc(false); setTempDesc(profile.description); }}
                                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                                >
                                    <X size={16} /> Cancelar
                                </button>
                                <button 
                                    onClick={saveDescription}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors flex items-center gap-2"
                                >
                                    <Save size={16} /> Guardar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[100px]">
                            {profile.description ? (
                                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{profile.description}</p>
                            ) : (
                                <p className="text-gray-400 italic text-sm">Sin descripción aún.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Posts */}
            <div className="lg:col-span-2">
                <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide border-b-2 border-purple-500 pb-1 mb-4 inline-block">Mis Posts</h2>
                <div className="space-y-4">
                    {userPosts.length > 0 ? (
                        userPosts.map(post => (
                            <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <SocialPostCard 
                                    post={post} 
                                    profile={profile} 
                                    media={mediaByPostId[post.id]} 
                                    onDeleted={handlePostDeleted}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
                            <p className="text-gray-400">No has publicado nada aún.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
