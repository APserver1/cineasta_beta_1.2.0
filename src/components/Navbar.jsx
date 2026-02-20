import { Menu, User, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import logo from '../logos/cineasta200.png';

const Navbar = ({ onMenuClick }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('public_profile')
          .select('username, profile_picture_url')
          .eq('user_id', user.id)
          .single();
        
        if (data) {
            setProfile(data);
        } else {
            // Fallback to 'users' table if public_profile not ready
             const { data: userData } = await supabase
                .from('users')
                .select('username, profile_picture')
                .eq('id', user.id)
                .single();
             if (userData) {
                 setProfile({ 
                     username: userData.username, 
                     profile_picture_url: userData.profile_picture 
                 });
             }
        }
      };
      
      const fetchInvitations = async () => {
          // Fetch pending invitations
          const { data: invitationsData, error } = await supabase
            .from('project_invitations')
            .select(`
                id,
                project_id,
                from_user_id
            `)
            .eq('to_user_id', user.id)
            .eq('status', 'pending');
            
          if (error) {
              console.error("Error fetching invitations:", error);
              return;
          }

          if (invitationsData && invitationsData.length > 0) {
              // Manually fetch related data to avoid complex RLS/Join issues
              const enrichedInvitations = await Promise.all(invitationsData.map(async (inv) => {
                  // Get Project Title (RLS must allow viewing project if invited, or we use a secure method? 
                  // We fixed RLS to allow viewing if invited via get_my_project_ids() or is_project_owner()
                  // BUT 'get_my_project_ids' only checks MEMBERS. Pending invites are NOT members.
                  // So user still can't see project title.
                  // We need to fetch title blindly or handle it.
                  
                  let projectTitle = 'Proyecto';
                  // Try to fetch project title
                  const { data: pData } = await supabase
                      .from('proyectos_cineasta')
                      .select('title')
                      .eq('id', inv.project_id)
                      .single();
                  
                  if (pData) projectTitle = pData.title;
                  
                  // Get Sender Name
                  let fromUser = 'Un usuario';
                  const { data: uData } = await supabase
                      .from('public_profile')
                      .select('username')
                      .eq('user_id', inv.from_user_id)
                      .single();
                      
                  if (uData) fromUser = uData.username;
                  
                  return {
                      id: inv.id,
                      projectTitle,
                      fromUser
                  };
              }));
              
              setInvitations(enrichedInvitations);
          } else {
              setInvitations([]);
          }
      };

      fetchProfile();
      fetchInvitations();
      
      // Subscribe to invitations
      const subscription = supabase
        .channel('invitations')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'project_invitations',
            filter: `to_user_id=eq.${user.id}`
        }, (payload) => {
            fetchInvitations();
        })
        .subscribe();
        
      return () => {
          subscription.unsubscribe();
      };
    }
  }, [user]);

  const handleAcceptInvitation = async (invitationId) => {
      try {
          const { error } = await supabase.rpc('accept_project_invitation', { invitation_id: invitationId });
          if (error) throw error;
          
          setInvitations(prev => prev.filter(i => i.id !== invitationId));
          alert('Has aceptado la invitación. Ahora tienes acceso al proyecto.');
      } catch (error) {
          console.error('Error accepting invitation:', error);
          alert('Error al aceptar la invitación');
      }
  };

  const handleRejectInvitation = async (invitationId) => {
      try {
          const { error } = await supabase
            .from('project_invitations')
            .update({ status: 'rejected' })
            .eq('id', invitationId);
            
          if (error) throw error;
          
          setInvitations(prev => prev.filter(i => i.id !== invitationId));
      } catch (error) {
          console.error('Error rejecting invitation:', error);
      }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 glass z-30 flex items-center justify-between px-4 md:px-8 transition-all duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-purple-100/50 text-purple-900 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={24} />
        </button>
        <Link to="/" className="flex items-center gap-2 group">
          <img src={logo} alt="Cineasta Logo" className="w-10 h-10 object-contain transition-transform group-hover:scale-110" />
          <span className="text-2xl font-bold text-gray-800 tracking-tighter" style={{ fontFamily: '"Courier Prime", monospace' }}>
            CINEASTA
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            {/* Notifications */}
            <div className="relative">
                <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-full hover:bg-gray-100 relative text-gray-600"
                >
                    <Bell size={20} />
                    {invitations.length > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                            {invitations.length}
                        </span>
                    )}
                </button>
                
                {showNotifications && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                            <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 text-sm">Notificaciones</h3>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {invitations.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        No tienes nuevas notificaciones
                                    </div>
                                ) : (
                                    invitations.map(inv => (
                                        <div key={inv.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-purple-100 text-purple-600 rounded-full">
                                                    <User size={16} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-gray-900">Solicitud de Grupo</p>
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        <span className="font-bold text-gray-800">{inv.fromUser}</span> te ha invitado a colaborar en <span className="font-bold text-gray-800">{inv.projectTitle || 'un proyecto'}</span>.
                                                    </p>
                                                    <div className="flex gap-2 mt-3">
                                                        <button 
                                                            onClick={() => handleAcceptInvitation(inv.id)}
                                                            className="flex-1 py-1.5 bg-purple-600 text-white text-xs font-bold rounded hover:bg-purple-700"
                                                        >
                                                            Aceptar
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRejectInvitation(inv.id)}
                                                            className="flex-1 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300"
                                                        >
                                                            Rechazar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <Link to="/public_profile" className="flex items-center gap-3 pl-4 border-l border-purple-100 hover:opacity-80 transition-opacity">
                <div className="hidden md:block text-right">
                    <p className="text-sm font-semibold text-gray-700">
                        {profile?.username || user.user_metadata?.username || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-purple-500">Cineasta</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                    {profile?.profile_picture_url || user.user_metadata?.avatar_url ? (
                        <img 
                            src={profile?.profile_picture_url || user.user_metadata?.avatar_url} 
                            alt="Profile" 
                            className="w-full h-full object-cover" 
                        />
                    ) : (
                        <User size={20} className="text-purple-600" />
                    )}
                </div>
                </div>
            </Link>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-purple-700 hover:text-purple-900 transition-colors"
            >
              Iniciar Sesión
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-full hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all hover:scale-105"
            >
              Registrarse
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
