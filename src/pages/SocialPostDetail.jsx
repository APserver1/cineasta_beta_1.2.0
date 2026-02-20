import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import SocialLayout from '../components/social/SocialLayout';
import SocialPostCard from '../components/social/SocialPostCard';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { Trash2 } from 'lucide-react';

const SocialPostDetail = () => {
  const { postId } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);

      // Load post + author + media
      const { data: pData, error: pErr } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (pErr || !pData) {
        setLoading(false);
        return;
      }

      const [authorRes, mediaRes] = await Promise.all([
        supabase.from('public_profile').select('*').eq('user_id', pData.author_id).single(),
        supabase.from('post_media').select('*').eq('post_id', postId).maybeSingle(),
      ]);

      const loadedPost = {
        ...pData,
        author: authorRes.data,
        media: mediaRes.data,
      };

      if (!alive) return;
      setPost(loadedPost);

      // Load replies
      await loadReplies();
      setLoading(false);
    };

    load();
    return () => { alive = false; };
  }, [postId]);

  const loadReplies = async () => {
    const { data } = await supabase
      .from('post_replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    
    if (!data) return;

    // Fetch authors for replies
    const userIds = [...new Set(data.map(r => r.author_id))];
    const { data: authors } = await supabase
      .from('public_profile')
      .select('user_id, username, profile_picture_url')
      .in('user_id', userIds);
    
    const authorsMap = {};
    (authors || []).forEach(a => authorsMap[a.user_id] = a);

    const enriched = data.map(r => ({
      ...r,
      author: authorsMap[r.author_id]
    }));

    setReplies(enriched);
  };

  const sendReply = async () => {
    if (!user || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('post_replies')
        .insert([{
          post_id: postId,
          author_id: user.id,
          content: replyText.trim()
        }]);
      
      if (!error) {
        setReplyText('');
        await loadReplies();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const deleteReply = async (replyId) => {
    if (!confirm('¿Borrar respuesta?')) return;
    await supabase.from('post_replies').delete().eq('id', replyId);
    setReplies(prev => prev.filter(r => r.id !== replyId));
  };

  if (loading) {
    return (
      <SocialLayout>
        <div className="p-8 text-center text-gray-500">Cargando...</div>
      </SocialLayout>
    );
  }

  if (!post) {
    return (
      <SocialLayout>
        <div className="p-8 text-center text-gray-500">Post no encontrado.</div>
      </SocialLayout>
    );
  }

  return (
    <SocialLayout>
      <div className="glass rounded-2xl overflow-hidden shadow-lg shadow-purple-100 min-h-full flex flex-col">
        <div className="px-4 py-3 border-b border-purple-100 flex items-center gap-2">
          <Link to="/social" className="text-sm text-gray-600 hover:text-purple-800">← Volver</Link>
          <div className="text-lg font-semibold tracking-tight text-gray-900">Post</div>
        </div>

        <SocialPostCard
          post={post}
          profile={post.author}
          media={post.media}
        />

        <div className="p-4 border-b border-purple-100 bg-purple-50/30">
          {user ? (
            <div className="flex gap-3">
               <div className="w-10 h-10 rounded-full bg-purple-100 overflow-hidden flex-shrink-0">
                  {/* Current user avatar placeholder if needed, or fetch from context */}
                  <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-fuchsia-600/20" />
               </div>
               <div className="flex-1">
                 <textarea
                   value={replyText}
                   onChange={e => setReplyText(e.target.value)}
                   placeholder="Postea tu respuesta"
                   className="w-full bg-transparent outline-none resize-none text-[15px] placeholder:text-gray-400 min-h-[60px]"
                 />
                 <div className="flex justify-end mt-2">
                   <button
                     onClick={sendReply}
                     disabled={!replyText.trim() || submitting}
                     className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm disabled:opacity-50"
                   >
                     Responder
                   </button>
                 </div>
               </div>
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500 py-2">
              <Link to="/login" className="text-purple-600 font-semibold hover:underline">Inicia sesión</Link> para responder.
            </div>
          )}
        </div>

        <div className="flex-1">
          {replies.map(reply => (
            <div key={reply.id} className="px-4 py-3 border-b border-purple-50 hover:bg-purple-50/20 transition-colors flex gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 overflow-hidden flex-shrink-0">
                {reply.author?.profile_picture_url ? (
                  <img src={reply.author.profile_picture_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600/40 to-fuchsia-600/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{reply.author?.username || 'Usuario'}</span>
                    <span className="text-xs text-gray-500">{formatRelativeTime(reply.created_at)}</span>
                  </div>
                  {user?.id === reply.author_id && (
                    <button onClick={() => deleteReply(reply.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="text-[15px] text-gray-800 mt-1 whitespace-pre-wrap">{reply.content}</div>
              </div>
            </div>
          ))}
          {replies.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              No hay respuestas aún. Sé el primero en opinar.
            </div>
          )}
        </div>
      </div>
    </SocialLayout>
  );
};

export default SocialPostDetail;