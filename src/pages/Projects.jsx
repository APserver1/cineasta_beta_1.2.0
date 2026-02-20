import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Clapperboard, Film, Trash2, Folder, ChevronLeft, MoreVertical, Edit2, Image, Share2, UserPlus, Users } from 'lucide-react';
import { deleteProjectResources } from '../utils/storageHelpers';

const Projects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isSeries, setIsSeries] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(searchParams.get('series') || null);
  const [creating, setCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, projectId: null, type: null }); // type: 'project' | 'series'
  
  // Renaming State
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  
  // Cover Upload
  const fileInputRef = useRef(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  
  // Sharing State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  // Sync selectedSeries with URL params
  useEffect(() => {
    const seriesParam = searchParams.get('series');
    if (seriesParam !== selectedSeries) {
      setSelectedSeries(seriesParam);
    }
  }, [searchParams]);

  const updateSelectedSeries = (seriesName) => {
    setSelectedSeries(seriesName);
    if (seriesName) {
      setSearchParams({ series: seriesName });
    } else {
      setSearchParams({});
    }
  };

  useEffect(() => {
    const handleClick = () => setContextMenu({ ...contextMenu, show: false });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      // Fetch Projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('proyectos_cineasta')
        .select('*');

      if (projectsError) throw projectsError;
      
      // Fetch Series Metadata (for covers)
      const { data: seriesData, error: seriesError } = await supabase
        .from('series_cineasta')
        .select('*');
        
      if (seriesError && seriesError.code !== 'PGRST116') console.error('Error fetching series:', seriesError);

      // Merge series cover info into projects if needed, or handle separately
      // Actually we need series info to display covers for series folders.
      // Let's create a map of series covers
      const seriesCovers = {};
      if (seriesData) {
          seriesData.forEach(s => {
              seriesCovers[s.serie_nombre] = s.cover_url;
          });
      }
      
      // Client-side sort by last_modified in concepto_data, fallback to created_at
      const sortedData = (projectsData || []).map(p => ({
          ...p,
          seriesCover: p.serie_nombre ? seriesCovers[p.serie_nombre] : null
      })).sort((a, b) => {
          const dateA = a.concepto_data?.last_modified ? new Date(a.concepto_data.last_modified) : new Date(a.created_at);
          const dateB = b.concepto_data?.last_modified ? new Date(b.concepto_data.last_modified) : new Date(b.created_at);
          return dateB - dateA;
      });

      setProjects(sortedData);
    } catch (error) {
      console.error('Error fetching projects:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setIsSeries(false);
    setNewProjectName('');
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      setCreating(true);
      
      let finalTitle = newProjectName;
      let finalSerieNombre = null;

      if (selectedSeries) {
        finalTitle = `${selectedSeries}: ${newProjectName}`;
        finalSerieNombre = selectedSeries;
      } else if (isSeries) {
        finalTitle = `${newProjectName}: Episodio 1 el inicio`;
        finalSerieNombre = newProjectName;
      }

      const { data, error } = await supabase
        .from('proyectos_cineasta')
        .insert([
          { 
            title: finalTitle,
            user_id: user.id,
            serie_nombre: finalSerieNombre
          }
        ])
        .select();

      if (error) throw error;

      // If it's a new series, initialize the series record
      if (finalSerieNombre && isSeries) {
        await supabase
          .from('series_cineasta')
          .insert([{ 
            serie_nombre: finalSerieNombre, 
            user_id: user.id,
            timeline_data: { events: [], period: { start: -10, end: 10 }, distantYears: [] }
          }]);
      }

      // Optimistic update - just reload for simplicity with new structure
      fetchProjects();
      setNewProjectName('');
      setIsSeries(false);
      setIsModalOpen(false);
      
      if (!isSeries) {
          navigate(`/editor/${data[0].id}`);
      }
    } catch (error) {
      console.error('Error creating project:', error.message);
      alert('Error al crear el proyecto');
    } finally {
      setCreating(false);
    }
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate position to keep menu on screen
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);

    setContextMenu({
      show: true,
      x,
      y,
      projectId: item.id, // For series, this is the series name
      type: item.type
    });
  };

  const handleDelete = async () => {
    if (!contextMenu.projectId) return;
    
    const isSeriesTarget = contextMenu.type === 'series';
    const confirmMsg = isSeriesTarget 
        ? '¿Estás seguro de que quieres eliminar esta serie y TODOS sus episodios? Se eliminarán también todas las imágenes y recursos asociados.' 
        : '¿Estás seguro de que quieres eliminar este proyecto? Se eliminarán también todas las imágenes y recursos asociados.';

    if (!window.confirm(confirmMsg)) return;

    try {
      if (isSeriesTarget) {
          const seriesName = contextMenu.projectId;
          
          // 1. Get Series Cover
          const { data: seriesData } = await supabase
            .from('series_cineasta')
            .select('cover_url')
            .eq('serie_nombre', seriesName)
            .single();
            
          // 2. Get all projects in series to delete their resources
          const { data: seriesProjects } = await supabase
            .from('proyectos_cineasta')
            .select('id, cover_url')
            .eq('serie_nombre', seriesName);
            
          // 3. Delete resources for each project
          if (seriesProjects) {
              await Promise.all(seriesProjects.map(p => deleteProjectResources(p.id, p.cover_url)));
          }
          
          // 4. Delete series cover (Pass a dummy ID for the folder part since series don't have concept refs)
          if (seriesData?.cover_url) {
              await deleteProjectResources('series_placeholder', seriesData.cover_url);
          }

          // 5. Delete from DB
          const { error: projError } = await supabase
            .from('proyectos_cineasta')
            .delete()
            .eq('serie_nombre', seriesName);
            
          if (projError) throw projError;
          
          const { error: seriesError } = await supabase
            .from('series_cineasta')
            .delete()
            .eq('serie_nombre', seriesName);
            
          if (seriesError) throw seriesError;
          
      } else {
          // Single Project
          const project = projects.find(p => p.id === contextMenu.projectId);
          if (project) {
              await deleteProjectResources(project.id, project.cover_url);
          } else {
              // Fallback fetch if not in state for some reason
              const { data: pData } = await supabase
                  .from('proyectos_cineasta')
                  .select('id, cover_url')
                  .eq('id', contextMenu.projectId)
                  .single();
              if (pData) await deleteProjectResources(pData.id, pData.cover_url);
          }

          const { error } = await supabase
            .from('proyectos_cineasta')
            .delete()
            .eq('id', contextMenu.projectId);

          if (error) throw error;
      }

      fetchProjects();
    } catch (error) {
      console.error('Error deleting:', error.message);
      alert('Error al eliminar');
    }
  };
  
  const handleRename = async () => {
      if (!renameValue.trim()) return;
      
      try {
          if (contextMenu.type === 'series') {
              // Rename series requires updating series_cineasta AND projects_cineasta
              // This is complex because PK is name. Ideally should be UUID.
              // For now, let's just alert limitation or try a complex transaction?
              // Supabase doesn't support easy cascade update on PKs usually unless configured.
              // Let's Skip rename for series for now or implement a "soft" rename?
              // Or better, alert user:
              alert("Renombrar series no está soportado actualmente.");
              // NOTE: A proper implementation would require a UUID for series table.
          } else {
              const { error } = await supabase
                .from('proyectos_cineasta')
                .update({ title: renameValue })
                .eq('id', contextMenu.projectId);
                
              if (error) throw error;
              fetchProjects();
          }
          setIsRenaming(false);
      } catch (error) {
          console.error('Error renaming:', error);
          alert('Error al renombrar');
      }
  };

  const handleUploadCover = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
          setUploadingCover(true);
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('project-assets')
            .upload(fileName, file);
            
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from('project-assets')
            .getPublicUrl(fileName);
            
          if (contextMenu.type === 'series') {
             // Upsert series record just in case
             const { error } = await supabase
                .from('series_cineasta')
                .upsert({ 
                    serie_nombre: contextMenu.projectId,
                    user_id: user.id,
                    cover_url: publicUrl
                }, { onConflict: 'serie_nombre' }); // Assuming serie_nombre is PK
                
             if (error) throw error;
          } else {
              const { error } = await supabase
                .from('proyectos_cineasta')
                .update({ cover_url: publicUrl })
                .eq('id', contextMenu.projectId);
                
              if (error) throw error;
          }
          
          fetchProjects();
      } catch (error) {
          console.error('Error uploading cover:', error);
          alert('Error al subir la portada');
      } finally {
          setUploadingCover(false);
      }
  };

  const handleShare = () => {
      setShareUsername('');
      setIsShareModalOpen(true);
  };

  const handleSendInvitation = async (e) => {
      e.preventDefault();
      if (!shareUsername.trim() || !contextMenu.projectId) return;
      
      setSharing(true);
      try {
          // 1. Find user by username
          // Try public_profile first
          let { data: profile, error: profileError } = await supabase
              .from('public_profile')
              .select('user_id')
              .ilike('username', shareUsername.trim())
              .single();
              
          if (profileError && profileError.code === 'PGRST116') {
               // Try users table fallback
               const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .ilike('username', shareUsername.trim())
                .single();
                
               if (userError || !userData) {
                   alert('Usuario no encontrado.');
                   setSharing(false);
                   return;
               }
               profile = { user_id: userData.id };
          } else if (profileError) {
              throw profileError;
          }
          
          const targetUserId = profile.user_id;
          if (targetUserId === user.id) {
              alert('No puedes invitarte a ti mismo.');
              setSharing(false);
              return;
          }

          // 2. Check if already member or invited
          // Ideally we check project_members and project_invitations
          // For now, let's just try to insert invitation and handle unique constraint if exists (though we didn't add unique constraint on invitation)
          // We should check manually.
          
          // Check Membership
          const { data: isMember } = await supabase
            .from('project_members')
            .select('id')
            .eq('project_id', contextMenu.projectId)
            .eq('user_id', targetUserId)
            .single();
            
          if (isMember) {
              alert('Este usuario ya es miembro del proyecto.');
              setSharing(false);
              return;
          }

          // Check Pending Invitation
          const { data: pendingInvite } = await supabase
            .from('project_invitations')
            .select('id')
            .eq('project_id', contextMenu.projectId)
            .eq('to_user_id', targetUserId)
            .eq('status', 'pending')
            .single();
            
          if (pendingInvite) {
              alert('Ya hay una invitación pendiente para este usuario.');
              setSharing(false);
              return;
          }
          
          // 3. Create Invitation
          const { error: inviteError } = await supabase
            .from('project_invitations')
            .insert({
                project_id: contextMenu.projectId,
                from_user_id: user.id,
                to_user_id: targetUserId
            });
            
          if (inviteError) throw inviteError;
          
          alert('Invitación enviada correctamente.');
          setIsShareModalOpen(false);
          
      } catch (error) {
          console.error('Error sending invitation:', error);
          alert('Error al enviar invitación.');
      } finally {
          setSharing(false);
      }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  const displayItems = [];
  if (!selectedSeries) {
    const seriesSeen = new Set();
    projects.forEach(p => {
      if (p.serie_nombre) {
        if (!seriesSeen.has(p.serie_nombre)) {
          displayItems.push({ 
              type: 'series', 
              name: p.serie_nombre, 
              id: p.serie_nombre, // Use name as ID for series logic
              cover_url: p.seriesCover 
          });
          seriesSeen.add(p.serie_nombre);
        }
      } else {
        displayItems.push({ type: 'project', data: p, id: p.id, cover_url: p.cover_url });
      }
    });
  } else {
    projects
      .filter(p => p.serie_nombre === selectedSeries)
      .forEach(p => {
        displayItems.push({ type: 'project', data: p, id: p.id, cover_url: p.cover_url });
      });
  }

  return (
    <div className="min-h-screen pt-24 px-4 sm:px-6 lg:px-8 pb-12">
      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {selectedSeries && (
              <button 
                onClick={() => updateSelectedSeries(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Clapperboard className="text-purple-600" />
              {selectedSeries ? selectedSeries : 'Mis Proyectos'}
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {/* Create Project Button Card */}
            <motion.button
              variants={itemVariants}
              onClick={() => setIsModalOpen(true)}
              className="group aspect-square rounded-2xl border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-white shadow-lg shadow-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform duration-300 mb-4">
                <Plus size={32} />
              </div>
              <span className="font-semibold text-purple-700">
                {selectedSeries ? 'Nuevo Episodio' : 'Nuevo Proyecto'}
              </span>
            </motion.button>

            {/* Project/Series Cards */}
            {displayItems.map((item) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                onClick={() => {
                  if (item.type === 'series') {
                    updateSelectedSeries(item.name);
                  } else {
                    navigate(`/editor/${item.data.id}`);
                  }
                }}
                className="group aspect-square relative rounded-2xl bg-white border border-purple-100 shadow-xl shadow-purple-100/20 hover:shadow-2xl hover:shadow-purple-200/40 transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1"
              >
                {/* Visual Placeholder or Cover */}
                {item.cover_url ? (
                    <img 
                        src={item.cover_url} 
                        alt="Cover" 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                ) : (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 group-hover:from-purple-500/10 group-hover:to-indigo-500/10 transition-colors" />
                        <div className="absolute inset-0 flex items-center justify-center text-purple-200 group-hover:text-purple-300 transition-colors">
                        {item.type === 'series' ? (
                            <Folder size={64} opacity={0.5} />
                        ) : (
                            <Film size={64} opacity={0.5} />
                        )}
                        </div>
                    </>
                )}
                
                {/* Gradient Overlay for Text Readability if Cover exists */}
                {item.cover_url && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />}

                {/* Kebab Menu Button - Visible on Hover */}
                <button
                    onClick={(e) => handleContextMenu(e, item)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20"
                >
                    <MoreVertical size={16} />
                </button>

                {/* Footer */}
                <div className={`absolute bottom-0 left-0 right-0 p-4 ${item.cover_url ? 'text-white' : 'bg-white/90 backdrop-blur-sm border-t border-purple-50 text-gray-900'}`}>
                  <h3 className="font-bold truncate shadow-sm">
                    {item.type === 'series' ? item.name : item.data.title}
                  </h3>
                  <p className={`text-xs mt-1 ${item.cover_url ? 'text-gray-300' : 'text-gray-500'}`}>
                    {item.type === 'series' ? 'Serie' : new Date(item.data.created_at).toLocaleDateString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu({...contextMenu, show: false})} />
            <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 min-w-[180px] overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right"
            >
            <button
                onClick={() => {
                    const item = displayItems.find(i => i.id === contextMenu.projectId);
                    setRenameValue(item.type === 'series' ? item.name : item.data.title);
                    setIsRenaming(true);
                    setContextMenu({...contextMenu, show: false});
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3 transition-colors"
            >
                <Edit2 size={16} /> Cambiar nombre
            </button>
            <button
                onClick={() => {
                    fileInputRef.current?.click();
                    setContextMenu({...contextMenu, show: false});
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3 transition-colors"
            >
                <Image size={16} /> Cambiar portada
            </button>
            <button
                onClick={() => {
                    handleShare();
                    setContextMenu({...contextMenu, show: false});
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3 transition-colors"
            >
                <Share2 size={16} /> Compartir acceso
            </button>
            <div className="h-px bg-gray-100 my-1" />
            <button
                onClick={() => {
                    handleDelete();
                    setContextMenu({...contextMenu, show: false});
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
            >
                <Trash2 size={16} /> Eliminar
            </button>
            </div>
        </>
      )}
      
      {/* Hidden File Input for Cover Upload */}
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleUploadCover}
      />

      {/* Rename Modal */}
      <AnimatePresence>
        {isRenaming && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRenaming(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">Cambiar nombre</h3>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all mb-6"
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') setIsRenaming(false);
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setIsRenaming(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRename}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700"
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">Compartir Acceso</h3>
              <p className="text-sm text-gray-500 mb-4">Invita a colaboradores a tu proyecto escribiendo su nombre de usuario.</p>
              
              <form onSubmit={handleSendInvitation}>
                  <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Nombre de Usuario
                      </label>
                      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-400 transition-all">
                          <UserPlus size={18} className="text-gray-400" />
                          <input
                            type="text"
                            value={shareUsername}
                            onChange={(e) => setShareUsername(e.target.value)}
                            className="flex-1 outline-none text-gray-800 bg-transparent"
                            placeholder="Ej: cineasta123"
                            autoFocus
                          />
                      </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsShareModalOpen(false)}
                      className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={sharing}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                      {sharing ? 'Enviando...' : (
                          <>
                            <span>Enviar</span>
                            <Share2 size={14} />
                          </>
                      )}
                    </button>
                  </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCreateModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 overflow-hidden"
            >
              <button 
                onClick={closeCreateModal}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Nuevo Proyecto</h2>
              <p className="text-gray-500 mb-6">Dale un nombre a tu próxima obra maestra.</p>

              <form onSubmit={handleCreateProject}>
                <div className="mb-6">
                  <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
                    Título del Proyecto
                  </label>
                  <input
                    type="text"
                    id="projectName"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                    placeholder="Ej: El Amanecer Eterno"
                    autoFocus
                    required
                  />
                </div>

                {!selectedSeries && (
                  <div className="mb-6 flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-600 rounded-lg text-white">
                        <Folder size={18} />
                      </div>
                      <div>
                        <span className="block text-sm font-bold text-gray-900">Proyecto Serie</span>
                        <span className="block text-xs text-gray-500">Agrupa varios guiones en una carpeta</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSeries(!isSeries)}
                      className={`w-12 h-6 rounded-full relative transition-colors ${isSeries ? 'bg-purple-600' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isSeries ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all disabled:opacity-70"
                  >
                    {creating ? 'Creando...' : 'Crear Proyecto'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Projects;
