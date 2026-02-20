import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, Layout, List, FileText, Scroll, Image, MoreVertical, Clock, Edit2, Share2, Trash2, Users, UserPlus, Shield, Plus, MapPin, Brush } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConceptTab from '../components/editor/ConceptTab';
import EscaletaTab from '../components/editor/EscaletaTab';
import TratamientoTab from '../components/editor/TratamientoTab';
import GuionTab from '../components/editor/GuionTab';
import StoryboardTab from '../components/editor/StoryboardTab';
import TimelineTab from '../components/editor/TimelineTab';
import ArtTab from '../components/editor/ArtTab';
import EditorAdBanner from '../components/editor/EditorAdBanner';
import { deleteProjectResources } from '../utils/storageHelpers';
import { motion, AnimatePresence } from 'framer-motion';
import postitTexture from '../textures/postit.png';

const Editor = () => {
  const { user } = useAuth();
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('concepto');
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const navigate = useNavigate();
  
  // Permissions
  const [userRole, setUserRole] = useState('owner');
  const [permissions, setPermissions] = useState(null); // { concept: 'edit', ... }

  const flushCurrentTabRef = useRef(async () => {});
  
  // Cover Upload
  const fileInputRef = useRef(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  
  // Sharing & Roles
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharing, setSharing] = useState(false);
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');

  const [pinsMode, setPinsMode] = useState(false);
  const [pins, setPins] = useState([]);
  const [activePinId, setActivePinId] = useState(null);
  const [pinDraft, setPinDraft] = useState('');
  const [savingPins, setSavingPins] = useState(false);
  const [pinPositions, setPinPositions] = useState({});
  const pinsDirtyRef = useRef(false);
  const pinsSaveQueue = useRef(Promise.resolve());
  const mainRef = useRef(null);
  
  // Tabs Definition
  const tabs = [
    { id: 'concepto', label: 'Concepto', icon: Layout },
    { id: 'escaleta', label: 'Escaleta', icon: List },
    { id: 'tratamiento', label: 'Tratamiento', icon: FileText },
    { id: 'guion', label: 'Guion', icon: Scroll },
    { id: 'storyboard', label: 'Storyboard', icon: Image },
    { id: 'arte', label: 'Arte', icon: Brush },
    { id: 'timeline', label: 'Timeline', icon: Clock },
  ];

  const rolePermissionItems = [...tabs.map(t => ({ id: t.id, label: t.label }))];

  useEffect(() => {
    if (user && projectId) {
      fetchProject();
    }
  }, [projectId, user]);

  const resolvePermissions = async (projectData) => {
    if (!user || !projectData) return;

    if (projectData.user_id === user.id) {
      setUserRole('owner');
      setPermissions({ all: 'edit' });
      return;
    }

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('id, role_id')
        .eq('project_id', projectData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!memberData) {
        setUserRole('guest');
        setPermissions({ default: 'none' });
        return;
      }

      setUserRole('member');

      if (!memberData.role_id) {
        setPermissions({ default: 'view' });
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('project_roles')
        .select('permissions')
        .eq('id', memberData.role_id)
        .maybeSingle();

      if (roleError) throw roleError;
      setPermissions(roleData?.permissions || { default: 'view' });
    } catch (error) {
      console.error('Error resolving permissions:', error);
      setUserRole('guest');
      setPermissions({ default: 'none' });
    }
  };

  const fetchProject = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proyectos_cineasta')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
      resolvePermissions(data);

      const initialPins = Array.isArray(data?.pins_data?.pins) ? data.pins_data.pins : [];
      setPins(initialPins);
      
      // Restore last active tab based on User ID
      let lastState = data.last_state || {};
      // Handle legacy format (direct object) vs new format (keyed by user id)
      // We'll migrate on save, but for reading try both.
      // New format: { "user_uuid": { ... } }
      // Old format: { activeTab: ... }
      
      let userState = null;
      if (lastState[user.id]) {
          userState = lastState[user.id];
      } else if (lastState.activeTab) {
          // Legacy or global fallback
          userState = lastState;
      }
      
      if (userState && userState.activeTab) {
          setActiveTab(userState.activeTab);
      }
    } catch (error) {
      console.error('Error fetching project:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProjectState = (newData) => {
    setProject(prev => ({ ...prev, ...newData }));
  };

  const savePinsToDb = async (pinsToSave) => {
    if (!project) return;
    if (!canEditPinsForTab(activeTab)) return;

    setSavingPins(true);
    pinsDirtyRef.current = false;

    const payload = { pins: pinsToSave };

    pinsSaveQueue.current = pinsSaveQueue.current.then(async () => {
      try {
        const { error } = await supabase
          .from('proyectos_cineasta')
          .update({ pins_data: payload })
          .eq('id', project.id);

        if (error) throw error;
        updateProjectState({ pins_data: payload });
      } catch (error) {
        console.error('Error saving pins:', error);
      } finally {
        setSavingPins(false);
      }
    });

    return pinsSaveQueue.current;
  };

  useEffect(() => {
    if (!project) return;
    if (!pinsDirtyRef.current) return;

    const timer = setTimeout(() => {
      savePinsToDb(pins);
    }, 800);

    return () => clearTimeout(timer);
  }, [pins, project]);

  useEffect(() => {
    const flush = async () => {
      if (!project) return;
      if (!pinsDirtyRef.current) return;
      await savePinsToDb(pins);
    };
    const prev = flushCurrentTabRef.current;
    flushCurrentTabRef.current = async () => {
      await prev();
      await flush();
    };
    return () => {
      flushCurrentTabRef.current = prev;
    };
  }, [pins, project]);
  
  // ... (Previous handlers: handleUpdateTitle, handleDeleteProject, handleUploadCover) ...
  // Re-implementing them here to ensure context availability
  
  const handleUpdateTitle = async () => {
    if (!newTitle.trim()) return;
    if (!canEdit('settings')) {
        alert('No tienes permiso para editar el título.');
        return;
    }
    try {
        const { error } = await supabase
            .from('proyectos_cineasta')
            .update({ title: newTitle })
            .eq('id', project.id);
        if (error) throw error;
        updateProjectState({ title: newTitle });
        setIsRenaming(false);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al actualizar');
    }
  };

  const handleDeleteProject = async () => {
      if (userRole !== 'owner') {
          alert('Solo el propietario puede eliminar el proyecto.');
          return;
      }
      if (!confirm('¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.')) return;
      try {
          await deleteProjectResources(project.id, project.cover_url);
          const { error } = await supabase.from('proyectos_cineasta').delete().eq('id', project.id);
          if (error) throw error;
          navigate('/projects');
      } catch (error) {
          console.error('Error:', error);
          alert('Error al eliminar');
      }
  };
  
  const handleUploadCover = async (e) => {
      if (!canEdit('settings')) {
          alert('No tienes permiso para cambiar la portada.');
          return;
      }
      const file = e.target.files[0];
      if (!file) return;
      try {
          setUploadingCover(true);
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('project-assets').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('project-assets').getPublicUrl(fileName);
          const { error } = await supabase.from('proyectos_cineasta').update({ cover_url: publicUrl }).eq('id', project.id);
          if (error) throw error;
          updateProjectState({ cover_url: publicUrl });
          alert('Portada actualizada');
      } catch (error) {
          console.error('Error:', error);
          alert('Error al subir portada');
      } finally {
          setUploadingCover(false);
      }
  };

  // Permission Helper
  const normalizePermissionEntry = (value, defaultView = true) => {
      if (value === 'edit') return { view: true, edit: true };
      if (value === 'view') return { view: true, edit: false };
      if (value && typeof value === 'object') {
          return {
              view: Boolean(value.view ?? defaultView),
              edit: Boolean(value.edit)
          };
      }
      return { view: defaultView, edit: false };
  };

  const getEffectivePermission = (featureId) => {
      if (!permissions) return { view: false, edit: false };
      if (permissions.all === 'edit') return { view: true, edit: true };
      if (permissions.all && typeof permissions.all === 'object') {
          return normalizePermissionEntry(permissions.all, true);
      }

      const raw = permissions[featureId];
      if (raw !== undefined) return normalizePermissionEntry(raw, true);

      if (permissions.default === 'none') return { view: false, edit: false };
      if (permissions.default !== undefined) return normalizePermissionEntry(permissions.default, true);

      return { view: true, edit: false };
  };

  const canEdit = (featureId) => {
      if (userRole === 'owner') return true;
      return getEffectivePermission(featureId).edit;
  };

  const canView = (featureId) => {
      if (userRole === 'owner') return true;
      const perm = getEffectivePermission(featureId);
      return perm.view || perm.edit;
  };

  const normalizePinsPermission = (value) => {
      return normalizePermissionEntry(value, false);
  };

  const getPinsPermissionForTab = (tabId) => {
      if (userRole === 'owner') return { view: true, edit: true };
      if (!permissions) return { view: false, edit: false };
      if (permissions.all === 'edit') return { view: true, edit: true };
      if (permissions.all && typeof permissions.all === 'object') {
          const allPerm = normalizePinsPermission(permissions.all);
          if (allPerm.edit || allPerm.view) return allPerm;
      }

      const raw = permissions.pines;
      if (!raw) return { view: false, edit: false };

      if (raw === 'edit' || raw === 'view') {
          return normalizePinsPermission(raw);
      }

      if (raw && typeof raw === 'object') {
          const looksLikeEntry = Object.prototype.hasOwnProperty.call(raw, 'view') || Object.prototype.hasOwnProperty.call(raw, 'edit');
          if (looksLikeEntry) return normalizePinsPermission(raw);

          if (tabId && raw[tabId] !== undefined) {
              return normalizePinsPermission(raw[tabId]);
          }

          if (raw.default !== undefined) {
              return normalizePinsPermission(raw.default);
          }
      }

      return { view: false, edit: false };
  };

  const canViewPinsForTab = (tabId) => {
      const perm = getPinsPermissionForTab(tabId);
      return perm.view || perm.edit;
  };

  const canEditPinsForTab = (tabId) => {
      return getPinsPermissionForTab(tabId).edit;
  };

  const handleShare = () => {
      setShareUsername('');
      setIsShareModalOpen(true);
      setShowMenu(false);
  };

  const handleSendInvitation = async (e) => {
      e.preventDefault();
      if (!shareUsername.trim()) return;
      setSharing(true);
      try {
          // Logic same as Projects.jsx (should refactor to hook ideally, but copying for now)
          let { data: profile, error: profileError } = await supabase.from('public_profile').select('user_id').ilike('username', shareUsername.trim()).single();
          if (profileError && profileError.code === 'PGRST116') {
               const { data: userData } = await supabase.from('users').select('id').ilike('username', shareUsername.trim()).single();
               if (!userData) { alert('Usuario no encontrado.'); setSharing(false); return; }
               profile = { user_id: userData.id };
          }
          const targetUserId = profile.user_id;
          if (targetUserId === user.id) { alert('No puedes invitarte a ti mismo.'); setSharing(false); return; }
          
          const { data: isMember } = await supabase.from('project_members').select('id').eq('project_id', project.id).eq('user_id', targetUserId).single();
          if (isMember) { alert('Ya es miembro.'); setSharing(false); return; }
          
          const { data: pending } = await supabase.from('project_invitations').select('id').eq('project_id', project.id).eq('to_user_id', targetUserId).eq('status', 'pending').single();
          if (pending) { alert('Ya invitado.'); setSharing(false); return; }
          
          await supabase.from('project_invitations').insert({ project_id: project.id, from_user_id: user.id, to_user_id: targetUserId });
          alert('Invitación enviada.');
          setIsShareModalOpen(false);
      } catch (error) { console.error(error); alert('Error al invitar'); }
      finally { setSharing(false); }
  };

  const handleManageRoles = async () => {
      setShowMenu(false);
      setIsRolesModalOpen(true);
      fetchMembersAndRoles();
  };

  const fetchMembersAndRoles = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', project.id);

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select('id, user_id, role_id')
        .eq('project_id', project.id);

      if (membersError) throw membersError;

      const userIds = Array.from(new Set((membersData || []).map(m => m.user_id)));
      let profilesByUserId = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('public_profile')
          .select('user_id, username, profile_picture_url')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;
        profilesByUserId = (profilesData || []).reduce((acc, p) => {
          acc[p.user_id] = p;
          return acc;
        }, {});
      }

      setMembers(
        (membersData || []).map(m => ({
          ...m,
          profile: profilesByUserId[m.user_id] || null
        }))
      );
    } catch (error) {
      console.error('Error fetching members/roles:', error);
      setRoles([]);
      setMembers([]);
    }
  };

  const handleCreateRole = async () => {
      if (!newRoleName.trim()) return;
      try {
          const { error } = await supabase.from('project_roles').insert({ project_id: project.id, name: newRoleName, permissions: {} });
          if (error) throw error;
          setNewRoleName('');
          fetchMembersAndRoles();
      } catch (e) { console.error(e); }
  };

  const handleAssignRole = async (memberId, roleId) => {
      try {
          await supabase.from('project_members').update({ role_id: roleId }).eq('id', memberId);
          fetchMembersAndRoles();
      } catch (e) { console.error(e); }
  };

  const toggleRolePermission = async (roleId, tabId, permissionKey) => {
      const role = roles.find(r => r.id === roleId);
      if (!role) return;

      const current = normalizePermissionEntry(role.permissions?.[tabId], true);
      let next = { ...current };

      if (permissionKey === 'edit') {
          next.edit = !current.edit;
          if (next.edit) next.view = true;
      }

      if (permissionKey === 'view') {
          next.view = !current.view;
          if (!next.view) next.edit = false;
      }

      const newPerms = { ...(role.permissions || {}), [tabId]: next };
      try {
          await supabase.from('project_roles').update({ permissions: newPerms }).eq('id', roleId);
          setRoles(roles.map(r => r.id === roleId ? { ...r, permissions: newPerms } : r));
      } catch (e) {
          console.error(e);
      }
  };

  const toggleRolePinsPermission = async (roleId, tabId, permissionKey) => {
      const role = roles.find(r => r.id === roleId);
      if (!role) return;

      const currentRaw = role.permissions?.pines;
      const currentTabEntry = (currentRaw && typeof currentRaw === 'object' && !('view' in currentRaw) && !('edit' in currentRaw))
          ? currentRaw?.[tabId]
          : currentRaw;

      const current = normalizePinsPermission(currentTabEntry);
      let next = { ...current };

      if (permissionKey === 'edit') {
          next.edit = !current.edit;
          if (next.edit) next.view = true;
      }

      if (permissionKey === 'view') {
          next.view = !current.view;
          if (!next.view) next.edit = false;
      }

      const nextPines = {
          ...(currentRaw && typeof currentRaw === 'object' && !('view' in currentRaw) && !('edit' in currentRaw) ? currentRaw : {}),
          [tabId]: next
      };

      const newPerms = { ...(role.permissions || {}), pines: nextPines };
      try {
          await supabase.from('project_roles').update({ permissions: newPerms }).eq('id', roleId);
          setRoles(roles.map(r => r.id === roleId ? { ...r, permissions: newPerms } : r));
      } catch (e) {
          console.error(e);
      }
  };

  const getPinForEdit = () => {
    if (!activePinId) return null;
    return pins.find(p => p.id === activePinId) || null;
  };

  const openPinEditor = (pinId) => {
    const pin = pins.find(p => p.id === pinId);
    setActivePinId(pinId);
    setPinDraft(pin?.text || '');
  };

  const closePinEditor = () => {
    setActivePinId(null);
    setPinDraft('');
  };

  const savePinText = () => {
    if (!activePinId) return;
    if (!canEditPinsForTab(activeTab)) return;
    pinsDirtyRef.current = true;
    setPins(prev => prev.map(p => p.id === activePinId ? { ...p, text: pinDraft, updated_at: new Date().toISOString() } : p));
  };

  const deletePin = () => {
    if (!activePinId) return;
    if (!canEditPinsForTab(activeTab)) return;
    pinsDirtyRef.current = true;
    setPins(prev => prev.filter(p => p.id !== activePinId));
    closePinEditor();
  };

  const handlePinsCanvasClick = (e) => {
    if (!pinsMode) return;
    if (!canEditPinsForTab(activeTab)) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    const mainEl = mainRef.current;
    if (!mainEl) return;

    const surfaces = Array.from(mainEl.querySelectorAll('[data-pins-surface]'));
    const matching = surfaces.filter(el => {
      const r = el.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    });

    const surfaceEl = matching[matching.length - 1] || null;
    const surfaceId = surfaceEl?.dataset?.pinsSurface || null;
    const surfaceType = surfaceEl?.dataset?.pinsType || 'viewport';

    const storyboardFrameId = surfaceEl?.dataset?.pinsFrameId || null;
    const storyboardSceneId = surfaceEl?.dataset?.pinsSceneId || null;

    const getCanvasDimsFromSurface = (el) => {
      const canvas = el?.querySelector?.('canvas');
      if (!canvas) return null;
      const w = Number(canvas.width);
      const h = Number(canvas.height);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
      return { w, h };
    };

    const parseTransform = (transformStr) => {
      if (!transformStr || transformStr === 'none') return { tx: 0, ty: 0, scale: 1 };
      const translateScale = transformStr.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/);
      if (translateScale) {
        return { tx: Number(translateScale[1]) || 0, ty: Number(translateScale[2]) || 0, scale: Number(translateScale[3]) || 1 };
      }
      const matrix = transformStr.match(/matrix\(([-\d.,\s]+)\)/);
      if (matrix) {
        const parts = matrix[1].split(',').map(p => Number(p.trim()));
        if (parts.length >= 6) {
          const [a, b, c, d, e, f] = parts;
          const scale = Math.sqrt((a * a) + (b * b)) || 1;
          return { tx: e || 0, ty: f || 0, scale };
        }
      }
      return { tx: 0, ty: 0, scale: 1 };
    };

    let pinX = 0;
    let pinY = 0;

    if (surfaceEl) {
      const rect = surfaceEl.getBoundingClientRect();

      if (surfaceType === 'scroll') {
        const contentEl = surfaceEl.querySelector('[data-pins-content]');
        const zoom = contentEl ? (Number(window.getComputedStyle(contentEl).zoom) || 1) : 1;
        pinX = ((clientX - rect.left) + (surfaceEl.scrollLeft || 0)) / zoom;
        pinY = ((clientY - rect.top) + (surfaceEl.scrollTop || 0)) / zoom;
      } else if (surfaceType === 'reactflow') {
        const viewport = surfaceEl.querySelector('.react-flow__viewport');
        const transformStr = viewport ? window.getComputedStyle(viewport).transform : 'none';
        const { tx, ty, scale } = parseTransform(transformStr);
        pinX = ((clientX - rect.left) - tx) / scale;
        pinY = ((clientY - rect.top) - ty) / scale;
      } else if (surfaceType === 'canvas') {
        const canvasEl = surfaceEl.querySelector('canvas');
        const canvasRect = canvasEl?.getBoundingClientRect?.();
        const dims = getCanvasDimsFromSurface(surfaceEl) || { w: 1280, h: 720 };
        const r = canvasRect || rect;
        pinX = (clientX - r.left) * (dims.w / r.width);
        pinY = (clientY - r.top) * (dims.h / r.height);
      } else {
        const mainRect = mainEl.getBoundingClientRect();
        pinX = (clientX - mainRect.left) / mainRect.width;
        pinY = (clientY - mainRect.top) / mainRect.height;
      }
    } else {
      const mainRect = mainEl.getBoundingClientRect();
      pinX = (clientX - mainRect.left) / mainRect.width;
      pinY = (clientY - mainRect.top) / mainRect.height;
    }

    const newPin = {
      id: crypto.randomUUID(),
      tabId: activeTab,
      surfaceId,
      surfaceType,
      x: pinX,
      y: pinY,
      ...(activeTab === 'storyboard' ? { frameId: storyboardFrameId, sceneId: storyboardSceneId } : {}),
      text: '',
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    pinsDirtyRef.current = true;
    setPins(prev => [...prev, newPin]);
    openPinEditor(newPin.id);
  };

  useEffect(() => {
    let rafId = null;
    let cancelled = false;

    const compute = () => {
      const mainEl = mainRef.current;
      if (!mainEl) return {};
      const mainRect = mainEl.getBoundingClientRect();

      const storyboardSurface = mainEl.querySelector('[data-pins-surface="storyboard-canvas"]');
      const currentStoryboardFrameId = storyboardSurface?.dataset?.pinsFrameId || null;
      const currentStoryboardSceneId = storyboardSurface?.dataset?.pinsSceneId || null;

      const parseTransform = (transformStr) => {
        if (!transformStr || transformStr === 'none') return { tx: 0, ty: 0, scale: 1 };
        const translateScale = transformStr.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/);
        if (translateScale) {
          return { tx: Number(translateScale[1]) || 0, ty: Number(translateScale[2]) || 0, scale: Number(translateScale[3]) || 1 };
        }
        const matrix = transformStr.match(/matrix\(([-\d.,\s]+)\)/);
        if (matrix) {
          const parts = matrix[1].split(',').map(p => Number(p.trim()));
          if (parts.length >= 6) {
            const [a, b, , , e, f] = parts;
            const scale = Math.sqrt((a * a) + (b * b)) || 1;
            return { tx: e || 0, ty: f || 0, scale };
          }
        }
        return { tx: 0, ty: 0, scale: 1 };
      };

      const getCanvasDimsFromSurface = (el) => {
        const canvas = el?.querySelector?.('canvas');
        if (!canvas) return null;
        const w = Number(canvas.width);
        const h = Number(canvas.height);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
        return { w, h };
      };

      const next = {};
      for (const pin of pins) {
        if (pin.tabId !== activeTab) continue;

        if (activeTab === 'storyboard') {
          if (pin.frameId && currentStoryboardFrameId && pin.frameId !== currentStoryboardFrameId) continue;
          if (pin.sceneId && currentStoryboardSceneId && pin.sceneId !== currentStoryboardSceneId) continue;
        }

        let screenX = null;
        let screenY = null;

        if (pin.surfaceId) {
          const surfaceEl = mainEl.querySelector(`[data-pins-surface="${pin.surfaceId}"]`);
          if (surfaceEl) {
            const rect = surfaceEl.getBoundingClientRect();
            const type = pin.surfaceType || surfaceEl.dataset.pinsType;

            if (type === 'scroll') {
              const contentEl = surfaceEl.querySelector('[data-pins-content]');
              const zoom = contentEl ? (Number(window.getComputedStyle(contentEl).zoom) || 1) : 1;
              const sx = rect.left + ((pin.x * zoom) - (surfaceEl.scrollLeft || 0));
              const sy = rect.top + ((pin.y * zoom) - (surfaceEl.scrollTop || 0));
              screenX = sx;
              screenY = sy;
            } else if (type === 'reactflow') {
              const viewport = surfaceEl.querySelector('.react-flow__viewport');
              const transformStr = viewport ? window.getComputedStyle(viewport).transform : 'none';
              const { tx, ty, scale } = parseTransform(transformStr);
              screenX = rect.left + tx + (pin.x * scale);
              screenY = rect.top + ty + (pin.y * scale);
            } else if (type === 'canvas') {
              const canvasEl = surfaceEl.querySelector('canvas');
              const canvasRect = canvasEl?.getBoundingClientRect?.();
              const dims = getCanvasDimsFromSurface(surfaceEl) || { w: 1280, h: 720 };
              const px = pin.x <= 1 && pin.y <= 1 ? { x: pin.x * dims.w, y: pin.y * dims.h } : { x: pin.x, y: pin.y };
              const r = canvasRect || rect;
              screenX = r.left + (px.x / dims.w) * r.width;
              screenY = r.top + (px.y / dims.h) * r.height;
            }
          }
        }

        if (screenX === null || screenY === null) {
          const px = (pin.x <= 1 && pin.y <= 1) ? { x: pin.x * mainRect.width, y: pin.y * mainRect.height } : { x: pin.x, y: pin.y };
          screenX = mainRect.left + px.x;
          screenY = mainRect.top + px.y;
        }

        next[pin.id] = {
          left: screenX - mainRect.left,
          top: screenY - mainRect.top
        };
      }

      return next;
    };

    const tick = () => {
      if (cancelled) return;
      setPinPositions(compute());
      rafId = requestAnimationFrame(tick);
    };

    const shouldRun = pinsMode || (pins.some(p => p.tabId === activeTab)) || Boolean(activePinId);
    if (shouldRun) {
      tick();
    }

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [pins, pinsMode, activeTab, activePinId]);

  const getVisiblePinsForTab = () => {
    const base = pins.filter(p => p.tabId === activeTab);
    if (activeTab !== 'storyboard') return base;

    const mainEl = mainRef.current;
    const surface = mainEl?.querySelector?.('[data-pins-surface="storyboard-canvas"]');
    const frameId = surface?.dataset?.pinsFrameId || null;
    const sceneId = surface?.dataset?.pinsSceneId || null;

    return base.filter(p => {
      if (p.frameId && frameId && p.frameId !== frameId) return false;
      if (p.sceneId && sceneId && p.sceneId !== sceneId) return false;
      return true;
    });
  };

  // Save last state when switching tabs (User Scoped)
  const handleTabChange = async (tabId) => {
    if (!project) return;

    try {
      await flushCurrentTabRef.current();
    } catch (error) {
      console.error('Error flushing tab state:', error);
    }

    setActiveTab(tabId);

    try {
      const currentGlobalState = project.last_state || {};
      const newGlobalState = {
        ...currentGlobalState,
        [user.id]: {
          ...(currentGlobalState[user.id] || {}),
          activeTab: tabId
        }
      };

      await supabase
        .from('proyectos_cineasta')
        .update({ last_state: newGlobalState })
        .eq('id', project.id);

      updateProjectState({ last_state: newGlobalState });
    } catch (error) {
      console.error('Error saving tab state:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Proyecto no encontrado</h1>
        <Link to="/projects" className="text-purple-600 hover:text-purple-800">
          Volver a Mis Proyectos
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="relative h-16 bg-white border-b border-gray-200 grid grid-cols-[1fr_auto_1fr] items-center px-4 z-50">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/projects" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900" title={project.title}>
                    {project.title.length > 30 ? `${project.title.substring(0, 30)}...` : project.title}
                </h1>
                
                {userRole === 'owner' && (
                    <div className="relative">
                        <button 
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        >
                            <MoreVertical size={16} />
                        </button>
                        
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                                <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-xl overflow-hidden min-w-[180px] z-40 py-1">
                                    <button 
                                        onClick={() => { setNewTitle(project.title); setIsRenaming(true); setShowMenu(false); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2"
                                    >
                                        <Edit2 size={16} /> Cambiar nombre
                                    </button>
                                    <button 
                                        onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2"
                                    >
                                        <Image size={16} /> Cambiar portada
                                    </button>
                                    <button 
                                        onClick={handleShare}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2"
                                    >
                                        <Share2 size={16} /> Compartir acceso
                                    </button>
                                    <button 
                                        onClick={handleManageRoles}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2"
                                    >
                                        <Shield size={16} /> Editar Roles
                                    </button>
                                    <div className="h-px bg-gray-100 my-1" />
                                    <button 
                                        onClick={() => { setShowMenu(false); handleDeleteProject(); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-2"
                                    >
                                        <Trash2 size={16} /> Eliminar Proyecto
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
                {userRole === 'owner' ? 'Propietario' : 'Colaborador'}
                {userRole !== 'owner' && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">INVITADO</span>}
            </p>
          </div>
        </div>
        
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadCover} />

        {/* Tabs (Centered) */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const tabCanView = canView(tab.id);

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  disabled={!tabCanView}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                  } ${!tabCanView ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Icon size={16} />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center justify-end gap-3">
          {canViewPinsForTab(activeTab) && (
            <button
              onClick={() => { if (pinsMode) closePinEditor(); setPinsMode(v => !v); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-all ${
                pinsMode
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              title={pinsMode ? 'Desactivar Pines' : 'Activar Pines'}
            >
              <MapPin size={16} />
              <span className="hidden lg:inline">Pines</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 overflow-hidden relative">
        {canViewPinsForTab(activeTab) && (
          <div
            className={`absolute inset-0 z-40 ${pinsMode && canEditPinsForTab(activeTab) ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onPointerDown={(e) => {
              if (e.target?.dataset?.pin === '1') return;
              e.preventDefault();
              handlePinsCanvasClick(e);
            }}
          />
        )}

        {canViewPinsForTab(activeTab) && (
          <div className="absolute inset-0 z-50 pointer-events-none">
            {getVisiblePinsForTab().map(p => (
              <button
                key={p.id}
                data-pin="1"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openPinEditor(p.id);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full shadow-lg border flex items-center justify-center pointer-events-auto ${
                  activePinId === p.id
                    ? 'bg-purple-600 border-purple-600'
                    : 'bg-white border-gray-200 hover:border-purple-300'
                }`}
                style={{ left: `${pinPositions[p.id]?.left ?? 0}px`, top: `${pinPositions[p.id]?.top ?? 0}px` }}
                title="Pin"
              >
                <MapPin size={14} className={activePinId === p.id ? 'text-white' : 'text-purple-600'} />
              </button>
            ))}

            {(() => {
              const pin = getPinForEdit();
              if (!pin) return null;
              const canEditPins = canEditPinsForTab(activeTab);
              const anchor = pinPositions[pin.id];
              if (!anchor) return null;
              return (
                <div
                  className="absolute pointer-events-auto w-[420px] h-[340px] max-w-[95vw] overflow-hidden"
                  style={{
                    left: `${Math.min(Math.max(anchor.left, 12), mainRef.current ? (mainRef.current.getBoundingClientRect().width - 12) : anchor.left)}px`,
                    top: `${Math.min(Math.max(anchor.top, 12), mainRef.current ? (mainRef.current.getBoundingClientRect().height - 12) : anchor.top)}px`,
                    transform: 'translate(-50%, 12px)',
                    backgroundImage: `url(${postitTexture})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="h-full w-full flex flex-col box-border pt-12 pb-10 pl-16 pr-12">
                    <div className="w-full max-w-[270px] mx-auto flex items-center justify-between mb-1">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-gray-700/80">Pin</div>
                      <button
                        type="button"
                        onClick={closePinEditor}
                        className="text-[11px] font-bold text-gray-700/80 hover:text-gray-900"
                      >
                        Cerrar
                      </button>
                    </div>
                    <textarea
                      value={pinDraft}
                      onChange={(e) => setPinDraft(e.target.value)}
                      readOnly={!canEditPins}
                      className="w-full max-w-[250px] mx-auto flex-1 min-h-0 overflow-y-auto resize-none outline-none bg-transparent text-[13px] text-gray-900 placeholder:text-gray-700/70 break-words leading-relaxed"
                      placeholder="Escribe una nota..."
                    />
                    <div className="w-full max-w-[270px] mx-auto mt-2 flex items-center justify-between">
                      <div className="text-[10px] text-gray-700/70 font-bold uppercase tracking-widest">
                        {savingPins ? 'Guardando…' : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        {canEditPins && (
                          <button
                            type="button"
                            onClick={deletePin}
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-white/60 text-red-700 text-[11px] font-bold hover:bg-white/80"
                          >
                            Eliminar
                          </button>
                        )}
                        {canEditPins && (
                          <button
                            type="button"
                            onClick={() => {
                              savePinText();
                              closePinEditor();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600/90 text-white text-[11px] font-bold hover:bg-purple-700"
                          >
                            Guardar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Pass readOnly prop based on permissions */}
        {activeTab === 'concepto' && <ConceptTab project={project} onUpdateProject={updateProjectState} readOnly={!canEdit('concepto')} registerFlush={(fn) => { flushCurrentTabRef.current = fn || (async () => {}); }} />}
        {activeTab === 'escaleta' && <EscaletaTab project={project} onUpdateProject={updateProjectState} readOnly={!canEdit('escaleta')} />}
        {activeTab === 'tratamiento' && <TratamientoTab project={project} onUpdateProject={updateProjectState} readOnly={!canEdit('tratamiento')} />}
        {activeTab === 'guion' && <GuionTab project={project} onUpdateProject={updateProjectState} readOnly={!canEdit('guion')} />}
        {activeTab === 'storyboard' && <StoryboardTab project={project} pins={pins} onUpdateProject={updateProjectState} readOnly={!canEdit('storyboard')} registerFlush={(fn) => { flushCurrentTabRef.current = fn || (async () => {}); }} />}
        {activeTab === 'arte' && <ArtTab project={project} readOnly={!canEdit('arte')} />}
        {activeTab === 'timeline' && <TimelineTab project={project} onUpdateProject={updateProjectState} readOnly={!canEdit('timeline')} />}
      </main>

      <EditorAdBanner height={120} />

      {/* Rename Modal */}
      {isRenaming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-w-[90vw]">
                <h3 className="text-lg font-bold mb-4 text-gray-900">Cambiar Título</h3>
                <input 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded mb-6 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    autoFocus
                    placeholder="Nuevo título..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateTitle();
                        if (e.key === 'Escape') setIsRenaming(false);
                    }}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsRenaming(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors">Cancelar</button>
                    <button onClick={handleUpdateTitle} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors">Guardar</button>
                </div>
            </div>
        </div>
      )}
      
      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsShareModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Compartir Acceso</h3>
              <p className="text-sm text-gray-500 mb-4">Invita a colaboradores.</p>
              <form onSubmit={handleSendInvitation}>
                  <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nombre de Usuario</label>
                      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-400 transition-all">
                          <UserPlus size={18} className="text-gray-400" />
                          <input type="text" value={shareUsername} onChange={(e) => setShareUsername(e.target.value)} className="flex-1 outline-none text-gray-800 bg-transparent" placeholder="Ej: cineasta123" autoFocus />
                      </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setIsShareModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">Cancelar</button>
                    <button type="submit" disabled={sharing} className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-70 flex items-center justify-center gap-2">{sharing ? 'Enviando...' : <span>Enviar</span>}</button>
                  </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Roles Modal */}
      <AnimatePresence>
        {isRolesModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRolesModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Gestión de Roles y Permisos</h3>
                  <button onClick={() => setIsRolesModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><Users size={20} /></button>
              </div>
              
              <div className="flex gap-6 flex-1 overflow-hidden">
                  {/* Left: Roles List & Creation */}
                  <div className="w-1/3 border-r border-gray-200 pr-6 flex flex-col">
                      <div className="mb-4 flex gap-2">
                          <input 
                            value={newRoleName} 
                            onChange={(e) => setNewRoleName(e.target.value)} 
                            placeholder="Nuevo Rol (ej: Artista)" 
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none"
                          />
                          <button onClick={handleCreateRole} className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700"><Plus size={20} /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2">
                          {roles.map(role => (
                              <div key={role.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                  <div className="font-bold text-gray-800">{role.name}</div>
                                  <div className="mt-2 space-y-1">
                                      {rolePermissionItems.map(tab => (
                                          <div key={tab.id} className="flex items-center justify-between text-xs">
                                              <span className="text-gray-600">{tab.label}</span>
                                              <div className="flex items-center gap-2">
                                                  {(() => {
                                                      const entry = normalizePermissionEntry(role.permissions?.[tab.id], true);
                                                      const viewActive = entry.view;
                                                      const editActive = entry.edit;
                                                      const editDisabled = !viewActive;
                                                      return (
                                                          <div className="flex items-center gap-1">
                                                              <button
                                                                  type="button"
                                                                  onClick={() => toggleRolePermission(role.id, tab.id, 'view')}
                                                                  className={`px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide ${
                                                                      viewActive
                                                                          ? 'bg-purple-600 text-white border-purple-600'
                                                                          : 'bg-white text-gray-500 border-gray-300'
                                                                  }`}
                                                              >
                                                                  Ver
                                                              </button>
                                                              <button
                                                                  type="button"
                                                                  onClick={() => toggleRolePermission(role.id, tab.id, 'edit')}
                                                                  className={`px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide ${
                                                                      editActive
                                                                          ? 'bg-purple-600 text-white border-purple-600'
                                                                          : 'bg-white text-gray-500 border-gray-300'
                                                                  } ${editDisabled ? 'opacity-50 pointer-events-none' : ''}`}
                                                              >
                                                                  Editar
                                                              </button>
                                                          </div>
                                                      );
                                                  })()}

                                                  {(() => {
                                                      const raw = role.permissions?.pines;
                                                      const current = (raw && typeof raw === 'object' && !('view' in raw) && !('edit' in raw))
                                                          ? raw?.[tab.id]
                                                          : raw;
                                                      const entry = normalizePinsPermission(current);
                                                      const viewActive = entry.view;
                                                      const editActive = entry.edit;
                                                      const editDisabled = !viewActive;
                                                      return (
                                                          <div className="flex items-center gap-1">
                                                              <button
                                                                  type="button"
                                                                  onClick={() => toggleRolePinsPermission(role.id, tab.id, 'view')}
                                                                  className={`px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide ${
                                                                      viewActive
                                                                          ? 'bg-purple-600 text-white border-purple-600'
                                                                          : 'bg-white text-gray-500 border-gray-300'
                                                                  }`}
                                                              >
                                                                  Pines
                                                              </button>
                                                              <button
                                                                  type="button"
                                                                  onClick={() => toggleRolePinsPermission(role.id, tab.id, 'edit')}
                                                                  className={`px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide ${
                                                                      editActive
                                                                          ? 'bg-purple-600 text-white border-purple-600'
                                                                          : 'bg-white text-gray-500 border-gray-300'
                                                                  } ${editDisabled ? 'opacity-50 pointer-events-none' : ''}`}
                                                              >
                                                                  Colocar
                                                              </button>
                                                          </div>
                                                      );
                                                  })()}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ))}
                          {roles.length === 0 && <div className="text-gray-400 text-sm text-center italic">No hay roles personalizados</div>}
                      </div>
                  </div>
                  
                  {/* Right: Members List */}
                  <div className="w-2/3 pl-6 flex flex-col">
                      <h4 className="font-bold text-gray-700 mb-4">Miembros del Proyecto</h4>
                      <div className="flex-1 overflow-y-auto space-y-3">
                          {members.map(member => (
                              <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                          {member.profile?.profile_picture_url ? (
                                              <img src={member.profile.profile_picture_url} className="w-full h-full object-cover" />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center text-gray-500"><Users size={20} /></div>
                                          )}
                                      </div>
                                      <div>
                                          <div className="font-bold text-gray-900">{member.profile?.username || 'Usuario'}</div>
                                          <div className="text-xs text-gray-500">Miembro</div>
                                      </div>
                                  </div>
                                  <select 
                                    value={member.role_id || ''} 
                                    onChange={(e) => handleAssignRole(member.id, e.target.value || null)}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-purple-200 outline-none"
                                  >
                                      <option value="">Sin Rol (Solo Lectura)</option>
                                      {roles.map(r => (
                                          <option key={r.id} value={r.id}>{r.name}</option>
                                      ))}
                                  </select>
                              </div>
                          ))}
                          {members.length === 0 && <div className="text-gray-400 text-center py-10">No hay miembros invitados aún.</div>}
                      </div>
                  </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Editor;
