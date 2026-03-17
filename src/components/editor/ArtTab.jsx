import { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Plus, Pencil, Eraser, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, 
  Eye, EyeOff, Trash2, Copy, Layers, Move, PaintBucket, Pipette, 
  Square, Circle, Brush, Highlighter, PenTool, Palette, LassoSelect, Wand2, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const MAX_LAYERS = 10;

const ASPECT_RATIOS = {
  '16:9': { label: '16:9 (Panorámico)', width: 16, height: 9, presets: [
    { w: 1280, h: 720, label: 'HD (720p)' },
    { w: 1920, h: 1080, label: 'Full HD (1080p)' },
    { w: 2560, h: 1440, label: '2K (1440p)' },
    { w: 3840, h: 2160, label: '4K (2160p)' }
  ]},
  '4:3': { label: '4:3 (Clásico)', width: 4, height: 3, presets: [
    { w: 800, h: 600, label: 'SVGA' },
    { w: 1024, h: 768, label: 'XGA' },
    { w: 1600, h: 1200, label: 'UXGA' }
  ]},
  '1:1': { label: '1:1 (Cuadrado)', width: 1, height: 1, presets: [
    { w: 1080, h: 1080, label: 'Insta (1080p)' },
    { w: 2048, h: 2048, label: 'High Res' }
  ]},
  '9:16': { label: '9:16 (Móvil)', width: 9, height: 16, presets: [
    { w: 720, h: 1280, label: 'HD Vertical' },
    { w: 1080, h: 1920, label: 'FHD Vertical' }
  ]}
};

const BRUSH_PRESETS = {
    pencil: { id: 'pencil', label: 'Lápiz', icon: Pencil, mode: 'stroke', cap: 'round', smoothing: 0.55, defaults: { size: 10, hardness: 0.85, opacity: 1 } },
    ink: { id: 'ink', label: 'Tinta', icon: PenTool, mode: 'stroke', cap: 'round', smoothing: 0.25, defaults: { size: 6, hardness: 0.95, opacity: 1 } },
    marker: { id: 'marker', label: 'Marcador', icon: Highlighter, mode: 'stroke', cap: 'square', smoothing: 0.8, defaults: { size: 26, hardness: 0.95, opacity: 0.65 } },
    highlighter: { id: 'highlighter', label: 'Resaltador', icon: Highlighter, mode: 'stroke', cap: 'square', smoothing: 0.9, defaults: { size: 50, hardness: 0.85, opacity: 0.22 } },
    airbrush: { id: 'airbrush', label: 'Aerógrafo', icon: Brush, mode: 'stamp', cap: 'round', smoothing: 0.5, defaults: { size: 90, hardness: 0.15, opacity: 0.14 } },
    softBrush: { id: 'softBrush', label: 'Soft Brush', icon: Circle, mode: 'stamp', cap: 'round', smoothing: 0.55, defaults: { size: 120, hardness: 0.05, opacity: 0.45 } },
    hardBrush: { id: 'hardBrush', label: 'Hard Brush', icon: Circle, mode: 'stamp', cap: 'round', smoothing: 0.45, defaults: { size: 30, hardness: 1, opacity: 1 } },
    spray: { id: 'spray', label: 'Spray', icon: Brush, mode: 'spray', cap: 'round', smoothing: 0.2, sprayDensity: 28, defaults: { size: 120, hardness: 0.3, opacity: 0.18 } }
};

const ERASER_PRESET = { id: 'eraser', label: 'Borrador', icon: Eraser, mode: 'stamp', cap: 'round', smoothing: 0.55, defaults: { size: 60, hardness: 0.65, opacity: 1 } };

// --- ALGORITHMS ---

const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
};

const stampRadial = (ctx, x, y, radius, hexColor, hardness, alpha, composite) => {
    const rgb = hexToRgb(hexColor);
    const r = Math.max(0.5, radius);
    const h = Math.min(1, Math.max(0, hardness));
    const inner = r * h;
    const innerStop = r === 0 ? 0 : inner / r;

    if (h >= 0.999) {
        ctx.save();
        ctx.globalCompositeOperation = composite;
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
    }

    const grad = ctx.createRadialGradient(x, y, inner, x, y, r);
    grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`);
    grad.addColorStop(innerStop, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`);
    grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

    ctx.save();
    ctx.globalCompositeOperation = composite;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
};

const stampLine = (ctx, from, to, radius, hexColor, hardness, alpha, composite) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(0.5, radius * 0.35);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        stampRadial(ctx, from.x + dx * t, from.y + dy * t, radius, hexColor, hardness, alpha, composite);
    }
};

const sprayAt = (ctx, x, y, radius, hexColor, hardness, alpha, composite, density) => {
    const r = Math.max(1, radius);
    const h = Math.min(1, Math.max(0, hardness));
    const exponent = 1 / Math.max(0.001, 1 - h);
    const dotRadius = Math.max(0.5, r * 0.05);
    const count = Math.max(1, Math.floor(density));
    for (let i = 0; i < count; i++) {
        const u = Math.random();
        const rr = r * Math.pow(u, exponent);
        const a = Math.random() * Math.PI * 2;
        stampRadial(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, dotRadius, hexColor, 1, alpha, composite);
    }
};

const sprayLine = (ctx, from, to, radius, hexColor, hardness, alpha, composite, density) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, radius * 0.25);
    const steps = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        sprayAt(ctx, from.x + dx * t, from.y + dy * t, radius, hexColor, hardness, alpha, composite, density);
    }
};

const floodFill = (ctx, startX, startY, hexColor, tolerance = 10) => {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
    
    const startIdx = (startY * w + startX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];
    
    const fill = hexToRgb(hexColor);
    
    // Don't fill if color is same
    if (Math.abs(startR - fill.r) < tolerance && 
        Math.abs(startG - fill.g) < tolerance && 
        Math.abs(startB - fill.b) < tolerance && 
        Math.abs(startA - fill.a) < tolerance) return;
        
    const stack = [[startX, startY]];
    
    const matchStartColor = (idx) => {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        
        return Math.abs(r - startR) <= tolerance &&
               Math.abs(g - startG) <= tolerance &&
               Math.abs(b - startB) <= tolerance &&
               Math.abs(a - startA) <= tolerance;
    };
    
    const colorPixel = (idx) => {
        data[idx] = fill.r;
        data[idx + 1] = fill.g;
        data[idx + 2] = fill.b;
        data[idx + 3] = fill.a;
    };
    
    while (stack.length) {
        const popped = stack.pop();
        const cx = popped[0];
        let cy = popped[1];
        let currIdx = (cy * w + cx) * 4;
        
        while (cy >= 0 && matchStartColor(currIdx)) {
            cy--;
            currIdx -= w * 4;
        }
        cy++;
        currIdx += w * 4;
        
        let reachLeft = false;
        let reachRight = false;
        
        while (cy < h && matchStartColor(currIdx)) {
            colorPixel(currIdx);
            
            if (cx > 0) {
                if (matchStartColor(currIdx - 4)) {
                    if (!reachLeft) {
                        stack.push([cx - 1, cy]);
                        reachLeft = true;
                    }
                } else if (reachLeft) {
                    reachLeft = false;
                }
            }
            
            if (cx < w - 1) {
                if (matchStartColor(currIdx + 4)) {
                    if (!reachRight) {
                        stack.push([cx + 1, cy]);
                        reachRight = true;
                    }
                } else if (reachRight) {
                    reachRight = false;
                }
            }
            
            cy++;
            currIdx += w * 4;
        }
    }
    
    ctx.putImageData(imgData, 0, 0);
};

const PanelShell = ({ title, right, children, className = '' }) => {
  return (
    <section className={`flex flex-col min-h-0 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-200">
        <div className="text-xs font-extrabold tracking-widest uppercase text-gray-700">{title}</div>
        <div className="flex items-center gap-2">{right}</div>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
};

const SegmentedTabs = ({ options, value, onChange }) => {
  return (
    <div className="flex items-center rounded-xl bg-gray-100 p-1">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
            value === opt.value ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const TagTree = ({ tree, expanded, onToggle, onSelect, selectedPath, canvases = [], onAddSubTag, onAddCanvas, onSelectCanvas, selectedCanvasId }) => {
  const renderNode = (node, depth) => {
    const isExpanded = expanded.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    // Find canvases directly in this folder (exact match)
    const folderCanvases = canvases.filter(c => c.data?.meta?.tagPath === node.path);
    const hasContent = hasChildren || folderCanvases.length > 0;
    
    const isSelected = selectedPath === node.path;

    return (
      <div key={node.path}>
        <div 
          className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
            isSelected ? 'bg-purple-50 text-purple-800' : 'hover:bg-gray-50 text-gray-800'
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              // Toggle expand if it has content, always select
              if (hasContent) onToggle(node.path);
              onSelect(node.path);
            }}
            className="flex-1 flex items-center gap-2 min-w-0 text-left"
          >
            <span className={`w-4 text-gray-400 select-none flex-shrink-0 text-center transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              {hasContent ? '▸' : '•'}
            </span>
            <span className="truncate font-medium">{node.name}</span>
          </button>
          
          {/* Action buttons on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                  onClick={(e) => { e.stopPropagation(); onAddSubTag(node.path); }}
                  className="p-1 hover:bg-purple-100 rounded text-gray-400 hover:text-purple-600"
                  title="Nueva sub-etiqueta"
              >
                  <Plus size={12} />
              </button>
              <button 
                  onClick={(e) => { e.stopPropagation(); onAddCanvas(node.path); }}
                  className="p-1 hover:bg-purple-100 rounded text-gray-400 hover:text-purple-600"
                  title="Nuevo lienzo aquí"
              >
                  <Pencil size={12} />
              </button>
          </div>
        </div>
        
        {/* Render Children (Subfolders + Canvases) */}
        {isExpanded && (
          <div>
            {/* 1. Subfolders */}
            {node.children.map(child => renderNode(child, depth + 1))}
            
            {/* 2. Canvases in this folder */}
            {folderCanvases.map(canvas => (
                <div 
                  key={canvas.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs text-gray-600 hover:bg-gray-50 cursor-pointer ${selectedCanvasId === canvas.id ? 'bg-purple-50 text-purple-700 font-medium' : ''}`}
                  style={{ paddingLeft: 8 + (depth + 1) * 14 + 16 }} // Indent + space for folder icon placeholder
                  onClick={(e) => {
                      e.stopPropagation();
                      onSelectCanvas(canvas.id);
                  }}
                >
                  <span className="flex-shrink-0 opacity-50">📄</span>
                  <span className="truncate">{canvas.nombres_de_lienzos || 'Sin nombre'}</span>
                </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return <div className="p-2">{tree.map(node => renderNode(node, 0))}</div>;
};

const buildTagTree = (paths) => {
  const root = new Map();

  for (const rawPath of paths) {
    const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalized) continue;
    const parts = normalized.split('/').filter(Boolean);
    let current = root;
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      if (!current.has(part)) {
        current.set(part, { name: part, path: acc, children: new Map() });
      }
      current = current.get(part).children;
    }
  }

  const toArray = (map) => {
    return [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(v => ({ name: v.name, path: v.path, children: toArray(v.children) }));
  };

  return toArray(root);
};

const ArtTab = ({ project, readOnly = false }) => {
  const { user } = useAuth();
  const [leftTopTab, setLeftTopTab] = useState('recursos');
  const [rightBottomTab, setRightBottomTab] = useState('capas');

  const [loading, setLoading] = useState(true);
  const [recentCanvases, setRecentCanvases] = useState([]);
  const [selectedCanvasId, setSelectedCanvasId] = useState(null);
  const [activeVersionId, setActiveVersionId] = useState(null); // Track active version
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [newAspectRatio, setNewAspectRatio] = useState('16:9');
  const [newResolution, setNewResolution] = useState({ width: 1920, height: 1080 });
  const [creating, setCreating] = useState(false);
  const [dbError, setDbError] = useState(null);

  const [tagPaths, setTagPaths] = useState([
    'Fondos',
    'Personajes',
    'Objetos',
    'Estructuras',
    'Mapas'
  ]);
  const tagTree = useMemo(() => buildTagTree(tagPaths), [tagPaths]);
  const [expandedTags, setExpandedTags] = useState(() => new Set(['Fondos', 'Personajes', 'Objetos', 'Estructuras', 'Mapas']));
  const [selectedTagPath, setSelectedTagPath] = useState('');

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalParent, setTagModalParent] = useState(null); // null for root, string for parent path
  const [newTagName, setNewTagName] = useState('');

  // --- Layer System State ---
  const [layers, setLayers] = useState([]); // [{ id, name, visible, opacity }]
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [layerImages, setLayerImages] = useState({}); // { [layerId]: base64 }
  const layerRefs = useRef({}); // { [layerId]: canvasElement }
  const canvasContainerRef = useRef(null);

  const handleCreateTag = () => {
    setTagModalParent(null);
    setNewTagName('');
    setTagModalOpen(true);
  };

  const handleCreateSubTag = (parentPath) => {
      setTagModalParent(parentPath);
      setNewTagName('');
      setTagModalOpen(true);
  };

  const saveNewTag = async () => {
    if (!newTagName.trim()) return;

    let newPath = newTagName.trim().replace(/\\/g, '/').replace(/,/g, '/').replace(/\/+/g, '/');
    
    if (tagModalParent) {
        newPath = `${tagModalParent}/${newPath}`.replace(/\/+/g, '/');
    }

    if (!tagPaths.includes(newPath)) {
        const newTags = [...tagPaths, newPath].sort();
        await saveTagsToDb(newTags);
        if (tagModalParent) {
            setExpandedTags(prev => new Set([...prev, tagModalParent]));
        }
    }
    
    setTagModalOpen(false);
  };

  const handleCreateCanvasInTag = (tagPath) => {
      setSelectedTagPath(tagPath);
      setNewCanvasName('');
      setCreateModalOpen(true);
  };
  
  const [tagsConfigId, setTagsConfigId] = useState(null);

  const loadTags = async () => {
    if (!project?.id) return;
    try {
        const { data, error } = await supabase
            .from('arttab')
            .select('id, etiquetas')
            .eq('project_id', project.id)
            .eq('nombres_de_lienzos', 'SYSTEM_TAGS_CONFIG')
            .single();
            
        if (data) {
            setTagsConfigId(data.id);
            if (data.etiquetas && Array.isArray(data.etiquetas)) {
                setTagPaths(data.etiquetas);
            }
        } else {
             if (canCreate) {
                const initialTags = ['Fondos', 'Personajes', 'Objetos', 'Estructuras', 'Mapas'];
                const { data: newData, error: insertError } = await supabase
                    .from('arttab')
                    .insert({
                        project_id: project.id,
                        user_id: user.id,
                        nombres_de_lienzos: 'SYSTEM_TAGS_CONFIG',
                        etiquetas: initialTags,
                        data: {}, // empty
                        capas: [],
                        versiones: []
                    })
                    .select('id')
                    .single();
                
                if (!insertError && newData) {
                    setTagsConfigId(newData.id);
                    setTagPaths(initialTags);
                }
             }
        }
    } catch (err) {
        console.error("Error loading tags config:", err);
    }
  };

  useEffect(() => {
    loadTags();
  }, [project?.id]);

  const saveTagsToDb = async (newTags) => {
      setTagPaths(newTags); // Optimistic
      if (!tagsConfigId || !canCreate) return;
      
      await supabase
        .from('arttab')
        .update({ etiquetas: newTags, fecha_de_modificacion: new Date().toISOString() })
        .eq('id', tagsConfigId);
  };

  // --- PALETTE SYSTEM ---
  const [canvasPalettes, setCanvasPalettes] = useState([]); // [{ id, name, colors: [] }]
  const [projectPalettes, setProjectPalettes] = useState([]);
  const [activePaletteTab, setActivePaletteTab] = useState('canvas'); // 'canvas' | 'project'
  const [referenceImages, setReferenceImages] = useState([]);
  const [pinnedRefsCanvas, setPinnedRefsCanvas] = useState([]);
  const pinnedRefsCanvasRef = useRef(pinnedRefsCanvas);
  const refDragRef = useRef(null);
  const refTransformRef = useRef(null);
  const [selectedRefId, setSelectedRefId] = useState(null);
  const lastRefSelectionScopeRef = useRef(null);
  const [refContextMenu, setRefContextMenu] = useState({ open: false, x: 0, y: 0, refId: null });
  
  const selectedCanvas = useMemo(() => recentCanvases.find(c => c.id === selectedCanvasId) || null, [recentCanvases, selectedCanvasId]);
  const canCreate = Boolean(project?.id && user?.id) && !readOnly;
  
  const canvasWidth = selectedCanvas?.resolucion_del_lienzo?.width || 1920;
  const canvasHeight = selectedCanvas?.resolucion_del_lienzo?.height || 1080;

  // Load Project Palettes
  useEffect(() => {
      if (!project?.id) return;
      const loadProjectPalettes = async () => {
          const { data } = await supabase
              .from('proyectos_cineasta')
              .select('paletas_globales')
              .eq('id', project.id)
              .single();
          if (data?.paletas_globales) {
              setProjectPalettes(data.paletas_globales);
          }
      };
      loadProjectPalettes();
  }, [project?.id]);

  // Load Canvas Palettes when selection changes
  useEffect(() => {
      if (!selectedCanvas) {
          setCanvasPalettes([]);
          return;
      }
      if (selectedCanvas.paletas && Array.isArray(selectedCanvas.paletas)) {
          setCanvasPalettes(selectedCanvas.paletas);
      } else {
          setCanvasPalettes([]);
      }
  }, [selectedCanvas]);

  const saveCanvasPalettesToDb = async (newPalettes) => {
      setCanvasPalettes(newPalettes);
      // Update local cache
      setRecentCanvases(prev => prev.map(c => 
          c.id === selectedCanvasId ? { ...c, paletas: newPalettes } : c
      ));
      
      if (!selectedCanvasId || readOnly) return;
      await supabase.from('arttab').update({ paletas: newPalettes }).eq('id', selectedCanvasId);
  };

  const reloadReferences = async () => {
      if (!project?.id || !user?.id) return;
      
      try {
        const { data: allUserRefs, error } = await supabase
            .from('concept_art_references')
            .select('id, name, url, mime_type, size, created_at, project_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && Array.isArray(allUserRefs) && allUserRefs.length > 0) {
            const filtered = allUserRefs.filter(r => String(r.project_id) === String(project.id));
            setReferenceImages(filtered);
            return;
        }
      } catch (err) {
        // Silent failure for missing table
      }

      // Fallback to storage
      const { data: objects, error: listError } = await supabase.storage
          .from('concept-references')
          .list(`${user.id}/${project.id}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
          
      if (!listError && Array.isArray(objects)) {
          const mapped = objects
              .filter(o => o.name && !o.name.endsWith('/'))
              .map(o => {
                  const path = `${user.id}/${project.id}/${o.name}`;
                  const { data: pub } = supabase.storage.from('concept-references').getPublicUrl(path);
                  return {
                      id: o.id || path,
                      name: o.name,
                      url: pub.publicUrl,
                      created_at: o.created_at || o.updated_at
                  };
              });
          setReferenceImages(mapped);
      } else {
          setReferenceImages([]);
      }
  };
  useEffect(() => {
      reloadReferences();
  }, [project?.id, user?.id]);
  useEffect(() => {
      pinnedRefsCanvasRef.current = pinnedRefsCanvas;
  }, [pinnedRefsCanvas]);
  useEffect(() => {
      const refs = selectedCanvas?.data?.versions?.[activeVersionId]?.references || [];
      setPinnedRefsCanvas(refs);
      const scopeKey = `${selectedCanvasId || 'none'}:${activeVersionId || 'none'}`;
      if (lastRefSelectionScopeRef.current !== scopeKey) {
          setSelectedRefId(null);
          setRefContextMenu({ open: false, x: 0, y: 0, refId: null });
          lastRefSelectionScopeRef.current = scopeKey;
      }
  }, [selectedCanvasId, activeVersionId, selectedCanvas]);
  const uploadReferenceImage = async (file) => {
      if (!file || !project?.id || !user?.id) return;
      const path = `${user.id}/${project.id}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('concept-references').upload(path, file);
      if (upErr) return;
      const { data: pub } = supabase.storage.from('concept-references').getPublicUrl(path);
      const { data: inserted, error: insErr } = await supabase
          .from('concept_art_references')
          .insert({
              project_id: project.id,
              user_id: user.id,
              name: file.name,
              url: pub.publicUrl,
              mime_type: file.type,
              size: file.size
          })
          .select('id, name, url, mime_type, size, created_at, project_id');
      
      if (inserted && Array.isArray(inserted) && inserted.length > 0) {
          setReferenceImages(prev => [inserted[0], ...prev]);
      } else {
          // If DB insert failed (e.g. table missing), still update UI from storage info
          const newItem = {
             id: path, // Use path as fallback ID
             name: file.name,
             url: pub.publicUrl,
             created_at: new Date().toISOString()
          };
          setReferenceImages(prev => [newItem, ...prev]);
      }
  };
  const getWorldPosFromEvent = (e) => {
      const vp = viewportRef.current?.getBoundingClientRect();
      if (!vp) return { x: 0, y: 0 };
      const baseX = (vp.width - canvasWidth) / 2;
      const baseY = (vp.height - canvasHeight) / 2;
      return {
          x: (e.clientX - vp.left - baseX - pan.x) / zoom,
          y: (e.clientY - vp.top - baseY - pan.y) / zoom
      };
  };
  const createRefItem = async (url, x, y) => {
      const id = crypto.randomUUID();
      const maxSize = 220;
      return new Promise(resolve => {
          const img = new Image();
          img.onload = () => {
              const fit = Math.min(1, maxSize / img.width, maxSize / img.height);
              const w = Math.max(1, Math.round(img.width * fit));
              const h = Math.max(1, Math.round(img.height * fit));
              resolve({ id, url, x, y, scale: 1, w, h, z: 'front' });
          };
          img.onerror = () => resolve({ id, url, x, y, scale: 1, w: maxSize, h: maxSize, z: 'front' });
          img.src = url;
      });
  };
  const normalizeRefZ = (ref) => ({ ...ref, z: ref.z === 'back' ? 'back' : 'front' });

    const saveCanvasReferencesToDb = async (newRefs) => {
        // Ensure z property is correctly normalized
        const normalized = newRefs.map(normalizeRefZ);
        
        // Immediate local update to ensure UI responsiveness
        setPinnedRefsCanvas(normalized);
        pinnedRefsCanvasRef.current = normalized;

        setRecentCanvases(prev => prev.map(c => {
            if (c.id !== selectedCanvasId) return c;
            const vMap = c.data?.versions || {};
            const vData = vMap[activeVersionId] || {};
            return {
                ...c,
                data: {
                    ...c.data,
                    versions: {
                        ...vMap,
                        [activeVersionId]: { ...vData, references: normalized }
                    }
                }
            };
        }));

        if (!project?.id || !user?.id) return;

        const currentData = selectedCanvas?.data || {};
        const vMap = currentData.versions || {};
        const vData = vMap[activeVersionId] || {};

        try {
            await supabase.from('arttab').update({
                data: {
                    ...currentData,
                    versions: {
                        ...vMap,
                        [activeVersionId]: { ...vData, references: normalized }
                    }
                },
                fecha_de_modificacion: new Date().toISOString()
            }).eq('id', selectedCanvasId);
        } catch (error) {
            console.error('Error saving references:', error);
        }
    };

    const sendReferenceToBack = async (refId) => {
        // Find and update the reference
        const currentRefs = [...pinnedRefsCanvasRef.current];
        const refIndex = currentRefs.findIndex(r => r.id === refId);
        if (refIndex === -1) return;

        const ref = { ...currentRefs[refIndex], z: 'back' };
        
        // Remove from current position
        currentRefs.splice(refIndex, 1);
        
        // Add to the beginning (bottom of stack)
        const next = [ref, ...currentRefs];

        setRefContextMenu({ open: false, x: 0, y: 0, refId: null });
        await saveCanvasReferencesToDb(next);
    };

    const sendReferenceToFront = async (refId) => {
        // Find and update the reference
        const currentRefs = [...pinnedRefsCanvasRef.current];
        const refIndex = currentRefs.findIndex(r => r.id === refId);
        if (refIndex === -1) return;

        const ref = { ...currentRefs[refIndex], z: 'front' };
        
        // Remove from current position
        currentRefs.splice(refIndex, 1);
        
        // Add to the end (top of stack)
        const next = [...currentRefs, ref];

        setRefContextMenu({ open: false, x: 0, y: 0, refId: null });
        await saveCanvasReferencesToDb(next);
    };

    const deleteReference = async (refId) => {
        const next = pinnedRefsCanvasRef.current.filter(r => r.id !== refId);
        setSelectedRefId(null);
        setRefContextMenu({ open: false, x: 0, y: 0, refId: null });
        await saveCanvasReferencesToDb(next);
    };
  const handleDropReference = async (e) => {
      if (tool !== 'references') return;
      const url = e.dataTransfer.getData('text/ref-url');
      if (!url) return;
      e.preventDefault();
      const pos = getWorldPosFromEvent(e);
      const item = await createRefItem(url, pos.x, pos.y);
      const next = [...pinnedRefsCanvasRef.current, item];
      await saveCanvasReferencesToDb(next);
  };
  const handleDragOverViewport = (e) => {
      if (tool === 'references') e.preventDefault();
  };
  const startDragRefImage = (e, url) => {
      e.dataTransfer.setData('text/ref-url', url);
  };
  const startDragPinnedRef = (refId, e) => {
      if (tool !== 'references') return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedRefId(refId);
      setRefContextMenu({ open: false, x: 0, y: 0, refId: null });
      const list = pinnedRefsCanvasRef.current;
      const item = list.find(r => r.id === refId);
      if (!item) return;
      refDragRef.current = {
          refId,
          startX: e.clientX,
          startY: e.clientY,
          originX: item.x,
          originY: item.y
      };
  };
  const startResizePinnedRef = (refId, handle, e) => {
      if (tool !== 'references') return;
      e.preventDefault();
      e.stopPropagation();
      const ref = pinnedRefsCanvasRef.current.find(r => r.id === refId);
      if (!ref) return;
      setSelectedRefId(refId);
      setRefContextMenu({ open: false, x: 0, y: 0, refId: null });
      const baseW = ref.w || 220;
      const baseH = ref.h || 220;
      refTransformRef.current = {
          refId,
          handle,
          baseW,
          baseH,
          centerX: ref.x,
          centerY: ref.y
      };
  };
  const handleReferenceImageLoad = (refId, e) => {
      const img = e.currentTarget;
      if (!img?.naturalWidth || !img?.naturalHeight) return;
      const maxSize = 220;
      const fit = Math.min(1, maxSize / img.naturalWidth, maxSize / img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * fit));
      const h = Math.max(1, Math.round(img.naturalHeight * fit));
      setPinnedRefsCanvas(prev => prev.map(r => r.id === refId ? (r.w && r.h ? r : { ...r, w, h }) : r));
  };
  const openRefContextMenu = (e, refId) => {
      if (tool !== 'references') return;
      e.preventDefault();
      e.stopPropagation();
      const vp = viewportRef.current?.getBoundingClientRect();
      if (!vp) return;
      const relX = e.clientX - vp.left;
      const relY = e.clientY - vp.top;
      const pad = 4;
      const maxX = vp.width - 200;
      const maxY = vp.height - 140;
      const px = Math.max(pad, Math.min(relX, maxX));
      const py = Math.max(pad, Math.min(relY, maxY));
      setSelectedRefId(refId);
      setRefContextMenu({ open: true, x: px, y: py, refId });
  };

  const saveProjectPalettesToDb = async (newPalettes) => {
      setProjectPalettes(newPalettes);
      if (!project?.id || readOnly) return;
      await supabase.from('proyectos_cineasta').update({ paletas_globales: newPalettes }).eq('id', project.id);
  };

  const addPalette = () => {
      const newPalette = {
          id: crypto.randomUUID(),
          name: `Paleta ${activePaletteTab === 'canvas' ? canvasPalettes.length + 1 : projectPalettes.length + 1}`,
          colors: []
      };
      
      if (activePaletteTab === 'canvas') {
          saveCanvasPalettesToDb([...canvasPalettes, newPalette]);
      } else {
          saveProjectPalettesToDb([...projectPalettes, newPalette]);
      }
  };

  const deletePalette = (id) => {
      if (activePaletteTab === 'canvas') {
          saveCanvasPalettesToDb(canvasPalettes.filter(p => p.id !== id));
      } else {
          saveProjectPalettesToDb(projectPalettes.filter(p => p.id !== id));
      }
  };

  const addColorToPalette = (paletteId) => {
      const updateList = (list) => list.map(p => {
          if (p.id !== paletteId) return p;
          if (p.colors.includes(brushColor)) return p;
          return { ...p, colors: [...p.colors, brushColor] };
      });

      if (activePaletteTab === 'canvas') {
          saveCanvasPalettesToDb(updateList(canvasPalettes));
      } else {
          saveProjectPalettesToDb(updateList(projectPalettes));
      }
  };

  const removeColorFromPalette = (paletteId, color) => {
      const updateList = (list) => list.map(p => {
          if (p.id !== paletteId) return p;
          return { ...p, colors: p.colors.filter(c => c !== color) };
      });

      if (activePaletteTab === 'canvas') {
          saveCanvasPalettesToDb(updateList(canvasPalettes));
      } else {
          saveProjectPalettesToDb(updateList(projectPalettes));
      }
  };


  const [tool, setTool] = useState('brush'); // brush, eraser, fill, picker, move, rect, circle
  const [brushType, setBrushType] = useState('pencil');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef(null);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSettingsByType, setBrushSettingsByType] = useState(() => {
      return Object.fromEntries(Object.entries(BRUSH_PRESETS).map(([id, preset]) => ([
          id,
          { size: preset.defaults.size, hardness: preset.defaults.hardness, opacity: preset.defaults.opacity }
      ])));
  });
  const [eraserSettings, setEraserSettings] = useState(() => ({ ...ERASER_PRESET.defaults }));
  useEffect(() => {
      const handleMove = (e) => {
          const transform = refTransformRef.current;
          if (transform) {
              const pos = getWorldPosFromEvent(e);
              const dx = Math.abs(pos.x - transform.centerX);
              const dy = Math.abs(pos.y - transform.centerY);
              const scaleX = transform.baseW > 0 ? (dx * 2) / transform.baseW : 1;
              const scaleY = transform.baseH > 0 ? (dy * 2) / transform.baseH : 1;
              let nextScale = 1;
              if (['l', 'r'].includes(transform.handle)) nextScale = scaleX;
              else if (['t', 'b'].includes(transform.handle)) nextScale = scaleY;
              else nextScale = Math.max(scaleX, scaleY);
              nextScale = Math.min(10, Math.max(0.1, nextScale));
              setPinnedRefsCanvas(prev => prev.map(r => r.id === transform.refId ? { ...r, scale: nextScale } : r));
              return;
          }
          const drag = refDragRef.current;
          if (!drag) return;
          const dx = e.clientX - drag.startX;
          const dy = e.clientY - drag.startY;
          const nx = drag.originX + dx / zoom;
          const ny = drag.originY + dy / zoom;
          setPinnedRefsCanvas(prev => prev.map(r => r.id === drag.refId ? { ...r, x: nx, y: ny } : r));
      };
      const handleUp = () => {
          const transform = refTransformRef.current;
          if (transform) {
              saveCanvasReferencesToDb(pinnedRefsCanvasRef.current);
              refTransformRef.current = null;
              return;
          }
          const drag = refDragRef.current;
          if (!drag) return;
          saveCanvasReferencesToDb(pinnedRefsCanvasRef.current);
          refDragRef.current = null;
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      return () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleUp);
      };
  }, [zoom, pan.x, pan.y, canvasWidth, canvasHeight]);
  
  // Drawing State
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const points = useRef([]);
  // Track previous pressure/width for smoothing
  const lastWidth = useRef(3);
  const useStampRef = useRef(false);
  const lastStampPos = useRef(null);
  const spraySeedRef = useRef(0);
  const paintSessionRef = useRef(null);
  
  // Shape & Move State
  const shapeStart = useRef(null);
  const tempCanvasRef = useRef(null);
  const moveStart = useRef(null);
  const [isMovingLayer, setIsMovingLayer] = useState(false);
  // Selection State
  const [selection, setSelection] = useState({
      active: false,
      type: null, // 'rect' | 'lasso' | 'magic'
      layerId: null,
      bounds: null, // { x, y, w, h }
      maskCanvas: null,
      bufferCanvas: null,
      transform: { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      interaction: { mode: null, handle: null },
      eraseApplied: false
  });
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef(null);
  const selectionPathRef = useRef([]); // points for lasso
  const selectionDragStartRef = useRef(null);
  // Painting inside selection
  const selectionStrokeCanvasRef = useRef(null);
  const selectionStrokeCtxRef = useRef(null);
  const isSelectionPaintingRef = useRef(false);
  const magicWandRef = useRef({ running: false });

  // --- HISTORY SYSTEM ---
  const [history, setHistory] = useState({ past: [], future: [] });
  const [renderTrigger, setRenderTrigger] = useState(0);
  
  // Cursor Overlay
  const cursorRef = useRef(null);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0 });
  const prevToolRef = useRef(tool);
  const showSelectionContextMenu = (e) => {
      e.preventDefault();
      const allow = tool === 'select_rect' || tool === 'select_lasso' || tool === 'select_magic' || tool === 'move_selection';
      if (!selection.active || !allow) return;
      const { x, y } = getPointerPos(e);
      const fs = getCurrentFrameSelection();
      if (!fs) return;
      if (x >= fs.x && x <= fs.x + fs.w && y >= fs.y && y <= fs.y + fs.h) {
          const vp = viewportRef.current?.getBoundingClientRect();
          if (!vp) return;
          const relX = e.clientX - vp.left;
          const relY = e.clientY - vp.top;
          const pad = 4;
          const maxX = vp.width - 180; // approx menu width
          const maxY = vp.height - 140; // approx menu height
          const px = Math.max(pad, Math.min(relX, maxX));
          const py = Math.max(pad, Math.min(relY, maxY));
          setContextMenu({ open: true, x: px, y: py });
      }
  };
  useEffect(() => {
      if (prevToolRef.current === 'move_selection' && tool !== 'move_selection') {
          if (selection.active && selection.bufferCanvas && !selection.interaction.mode) {
              commitSelectionTransform();
          }
      }
      prevToolRef.current = tool;
  }, [tool]);

  const activePreset = tool === 'eraser' ? ERASER_PRESET : (BRUSH_PRESETS[brushType] || BRUSH_PRESETS.pencil);
  const activeSettings = tool === 'eraser' ? eraserSettings : (brushSettingsByType[brushType] || activePreset.defaults);
  const isRefTool = tool === 'references';
  const renderReferenceItem = (ref) => {
      const baseW = ref.w || 220;
      const baseH = ref.h || 220;
      const scale = ref.scale || 1;
      const w = baseW * scale;
      const h = baseH * scale;
      const handles = [
          { key: 'tl', left: '0%', top: '0%', cursor: 'nwse-resize' },
          { key: 't', left: '50%', top: '0%', cursor: 'ns-resize' },
          { key: 'tr', left: '100%', top: '0%', cursor: 'nesw-resize' },
          { key: 'l', left: '0%', top: '50%', cursor: 'ew-resize' },
          { key: 'r', left: '100%', top: '50%', cursor: 'ew-resize' },
          { key: 'bl', left: '0%', top: '100%', cursor: 'nesw-resize' },
          { key: 'b', left: '50%', top: '100%', cursor: 'ns-resize' },
          { key: 'br', left: '100%', top: '100%', cursor: 'nwse-resize' }
      ];
      return (
          <div
              key={ref.id}
              className={`absolute select-none ${isRefTool ? 'cursor-move' : 'cursor-default'}`}
              style={{ left: `${ref.x}px`, top: `${ref.y}px`, width: `${w}px`, height: `${h}px`, transform: 'translate(-50%, -50%)', pointerEvents: isRefTool ? 'auto' : 'none' }}
              onPointerDown={(e) => startDragPinnedRef(ref.id, e)}
              onContextMenu={(e) => openRefContextMenu(e, ref.id)}
          >
              <img
                  src={ref.url}
                  alt=""
                  className="w-full h-full shadow-md border border-white/70"
                  style={{ objectFit: 'contain' }}
                  draggable={false}
                  onLoad={(e) => handleReferenceImageLoad(ref.id, e)}
              />
              {isRefTool && selectedRefId === ref.id && (
                  <div className="absolute inset-0 border border-purple-500/80 pointer-events-none" />
              )}
              {isRefTool && selectedRefId === ref.id && (
                  <div className="absolute inset-0 pointer-events-none">
                      {handles.map(hd => (
                          <div
                              key={hd.key}
                              className="absolute w-2 h-2 bg-white border border-purple-500 pointer-events-auto"
                              style={{ left: hd.left, top: hd.top, transform: 'translate(-50%, -50%)', cursor: hd.cursor }}
                              onPointerDown={(e) => startResizePinnedRef(ref.id, hd.key, e)}
                          />
                      ))}
                  </div>
              )}
          </div>
      );
  };
  const setActiveSettings = (partial) => {
      if (tool === 'eraser') {
          setEraserSettings(prev => ({ ...prev, ...partial }));
      } else {
          setBrushSettingsByType(prev => ({
              ...prev,
              [brushType]: { ...(prev[brushType] || activePreset.defaults), ...partial }
          }));
      }
  };

  const addToHistory = (currentLayers, currentImages) => {
    setHistory(prev => {
        const newPast = [...prev.past, { layers: currentLayers, images: currentImages }];
        if (newPast.length > 20) newPast.shift();
        return {
            past: newPast,
            future: []
        };
    });
  };

  const undo = async () => {
      if (history.past.length === 0) return;
      
      const previous = history.past[history.past.length - 1];
      const newPast = history.past.slice(0, -1);
      
      const currentSnapshot = { layers, images: layerImages };
      
      setHistory({
          past: newPast,
          future: [currentSnapshot, ...history.future]
      });
      
      setLayers(previous.layers);
      setLayerImages(previous.images);
      
      // Update DB with previous state to persist the Undo
      await updateLayersInDb(previous.layers, previous.images);
      
      setRenderTrigger(p => p + 1);
  };

  const redo = async () => {
      if (history.future.length === 0) return;
      
      const next = history.future[0];
      const newFuture = history.future.slice(1);
      
      const currentSnapshot = { layers, images: layerImages };
      
      setHistory({
          past: [...history.past, currentSnapshot],
          future: newFuture
      });
      
      setLayers(next.layers);
      setLayerImages(next.images);
      
      // Update DB
      await updateLayersInDb(next.layers, next.images);
      
      setRenderTrigger(p => p + 1);
  };

  useEffect(() => {
      const handleKeyDown = (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  redo();
              } else {
                  undo();
              }
          } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              e.preventDefault();
              redo();
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, layers, layerImages]); // Dependencies important for closure capture

  const handleWheel = (e) => {
    e.preventDefault();
    if (!viewportRef.current) return;

    const minZoom = 0.1;
    const maxZoom = 10;
    const delta = e.deltaY > 0 ? 0.9 : 1.1; 
    
    const newZoom = Math.min(maxZoom, Math.max(minZoom, zoom * delta));
    
    // Calculate cursor position relative to the viewport
    const viewport = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - viewport.left;
    const mouseY = e.clientY - viewport.top;
    
    // Calculate the base offset (centering) of the canvas in the viewport
    // The canvas is centered using left: 50%, top: 50%, margin-left: -width/2, margin-top: -height/2
    // So the top-left corner (before transform) is at (ViewportW - CanvasW) / 2
    const baseX = (viewport.width - canvasWidth) / 2;
    const baseY = (viewport.height - canvasHeight) / 2;

    // Calculate World coordinates (local canvas coordinates unscaled)
    // Mouse = Base + Pan + (World * Zoom)
    // World = (Mouse - Base - Pan) / Zoom
    const worldX = (mouseX - baseX - pan.x) / zoom;
    const worldY = (mouseY - baseY - pan.y) / zoom;
    
    // Calculate New Pan to keep WorldX under MouseX
    // Mouse = Base + NewPan + (World * NewZoom)
    // NewPan = Mouse - Base - (World * NewZoom)
    
    const newPanX = mouseX - baseX - worldX * newZoom;
    const newPanY = mouseY - baseY - worldY * newZoom;
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };
  const fitCanvasToViewport = () => {
    if (!viewportRef.current) return;
    const vp = viewportRef.current.getBoundingClientRect();
    const minZoom = 0.1;
    const maxZoom = 10;
    const zoomFit = Math.min(vp.width / canvasWidth, vp.height / canvasHeight);
    const newZoom = Math.min(maxZoom, Math.max(minZoom, zoomFit));
    const baseX = (vp.width - canvasWidth) / 2;
    const baseY = (vp.height - canvasHeight) / 2;
    const worldX = canvasWidth / 2;
    const worldY = canvasHeight / 2;
    const newPanX = vp.width / 2 - baseX - worldX * newZoom;
    const newPanY = vp.height / 2 - baseY - worldY * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  useEffect(() => {
      renderSelectionOverlay();
  }, [tool, canvasWidth, canvasHeight, selection.active, selection.bounds, selection.transform]);

  // --- Selection Helpers ---
  const rotatePoint = (x, y, cx, cy, angle) => {
      const dx = x - cx;
      const dy = y - cy;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };
  const getCurrentFrameSelection = () => {
      if (!selection.bounds) return null;
      const fs = {
          x: selection.bounds.x + selection.transform.tx,
          y: selection.bounds.y + selection.transform.ty,
          w: selection.bounds.w * selection.transform.scaleX,
          h: selection.bounds.h * selection.transform.scaleY,
          rotation: selection.transform.rotation || 0
      };
      return fs;
  };
  const getTransformHandle = (mx, my, fs) => {
      if (!fs) return null;
      const cx = fs.x + fs.w / 2;
      const cy = fs.y + fs.h / 2;
      const p = rotatePoint(mx, my, cx, cy, -fs.rotation);
      const x = p.x, y = p.y;
      const handleSize = 10;
      // rotation handle position (above top center)
      const rotX = fs.x + fs.w / 2;
      const rotY = fs.y - 20;
      if (Math.hypot(x - rotX, y - rotY) <= handleSize) return 'rot';
      // corners
      if (Math.abs(x - fs.x) <= handleSize && Math.abs(y - fs.y) <= handleSize) return 'tl';
      if (Math.abs(x - (fs.x + fs.w)) <= handleSize && Math.abs(y - fs.y) <= handleSize) return 'tr';
      if (Math.abs(x - fs.x) <= handleSize && Math.abs(y - (fs.y + fs.h)) <= handleSize) return 'bl';
      if (Math.abs(x - (fs.x + fs.w)) <= handleSize && Math.abs(y - (fs.y + fs.h)) <= handleSize) return 'br';
      // edges
      if (Math.abs(y - fs.y) <= handleSize && x > fs.x && x < fs.x + fs.w) return 't';
      if (Math.abs(y - (fs.y + fs.h)) <= handleSize && x > fs.x && x < fs.x + fs.w) return 'b';
      if (Math.abs(x - fs.x) <= handleSize && y > fs.y && y < fs.y + fs.h) return 'l';
      if (Math.abs(x - (fs.x + fs.w)) <= handleSize && y > fs.y && y < fs.y + fs.h) return 'r';
      // body
      if (x > fs.x && x < fs.x + fs.w && y > fs.y && y < fs.y + fs.h) return 'body';
      return 'outside';
  };
  const drawTransformHandles = (ctx, fs, color = '#7e22ce') => {
      ctx.save();
      const cx = fs.x + fs.w / 2;
      const cy = fs.y + fs.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(fs.rotation || 0);
      ctx.translate(-cx, -cy);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(fs.x, fs.y, fs.w, fs.h);
      ctx.setLineDash([]);
      const handleSize = 8;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      const drawSquare = (x, y) => {
          ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
          ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
      };
      // corners
      drawSquare(fs.x, fs.y);
      drawSquare(fs.x + fs.w, fs.y);
      drawSquare(fs.x, fs.y + fs.h);
      drawSquare(fs.x + fs.w, fs.y + fs.h);
      // edges midpoints
      drawSquare(fs.x + fs.w/2, fs.y);
      drawSquare(fs.x + fs.w/2, fs.y + fs.h);
      drawSquare(fs.x, fs.y + fs.h/2);
      drawSquare(fs.x + fs.w, fs.y + fs.h/2);
      // rotation handle (circle)
      const rotX = fs.x + fs.w / 2;
      const rotY = fs.y - 20;
      ctx.beginPath();
      ctx.arc(rotX, rotY, handleSize/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
  };
  const drawSelectionBorder = (ctx) => {
      if (!selection.active || !selection.bounds) return;
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#7e22ce';
      ctx.lineWidth = 1;
      const b = selection.bounds;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);
  };
  const renderSelectionOverlay = () => {
      const ctx = tempCanvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      if (!selection.active || !selection.bounds) return;
      if (tool === 'move_selection' && selection.bufferCanvas) {
          const fs = getCurrentFrameSelection();
          ctx.save();
          const cx = selection.bounds.x + selection.bounds.w / 2;
          const cy = selection.bounds.y + selection.bounds.h / 2;
          ctx.translate(fs.x + fs.w / 2, fs.y + fs.h / 2);
          ctx.rotate(selection.transform.rotation || 0);
          ctx.scale(selection.transform.scaleX, selection.transform.scaleY);
          ctx.translate(-cx, -cy);
          ctx.drawImage(selection.bufferCanvas, 0, 0);
          ctx.restore();
          drawTransformHandles(ctx, fs);
      } else {
          ctx.imageSmoothingEnabled = false;
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = '#7e22ce';
          ctx.lineWidth = 1;
          const b = selection.bounds;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          ctx.setLineDash([]);
      }
  };
  const createMaskCanvasFromRect = (rect) => {
      const c = document.createElement('canvas');
      c.width = canvasWidth;
      c.height = canvasHeight;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      return c;
  };
  const createMaskCanvasFromPolygon = (points) => {
      const c = document.createElement('canvas');
      c.width = canvasWidth;
      c.height = canvasHeight;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (points.length) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
          ctx.closePath();
          ctx.fill();
      }
      return c;
  };
  const createMaskCanvasFromFlood = (layerCtx, startX, startY, tolerance = 10) => {
      const w = layerCtx.canvas.width;
      const h = layerCtx.canvas.height;
      const imgData = layerCtx.getImageData(0, 0, w, h);
      const data = imgData.data;
      startX = Math.floor(startX);
      startY = Math.floor(startY);
      if (startX < 0 || startX >= w || startY < 0 || startY >= h) return null;
      const startIdx = (startY * w + startX) * 4;
      const sr = data[startIdx], sg = data[startIdx + 1], sb = data[startIdx + 2], sa = data[startIdx + 3];
      const match = (idx) => Math.abs(data[idx] - sr) <= tolerance &&
                            Math.abs(data[idx + 1] - sg) <= tolerance &&
                            Math.abs(data[idx + 2] - sb) <= tolerance &&
                            Math.abs(data[idx + 3] - sa) <= tolerance;
      const mask = new Uint8Array(w * h);
      const stack = [[startX, startY]];
      while (stack.length) {
          const [cx, sy] = stack.pop();
          let cy = sy;
          let currIdx = (cy * w + cx) * 4;
          while (cy >= 0 && match(currIdx)) {
              cy--;
              currIdx -= w * 4;
          }
          cy++;
          currIdx += w * 4;
          let reachLeft = false;
          let reachRight = false;
          while (cy < h && match(currIdx)) {
              const mIdx = (cy * w + cx);
              mask[mIdx] = 255;
              if (cx > 0) {
                  const leftIdx = currIdx - 4;
                  if (match(leftIdx)) {
                      if (!reachLeft) {
                          stack.push([cx - 1, cy]);
                          reachLeft = true;
                      }
                  } else if (reachLeft) {
                      reachLeft = false;
                  }
              }
              if (cx < w - 1) {
                  const rightIdx = currIdx + 4;
                  if (match(rightIdx)) {
                      if (!reachRight) {
                          stack.push([cx + 1, cy]);
                          reachRight = true;
                      }
                  } else if (reachRight) {
                      reachRight = false;
                  }
              }
              cy++;
              currIdx += w * 4;
          }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const mctx = c.getContext('2d');
      const out = mctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
          const a = mask[i];
          out.data[i * 4 + 0] = 255;
          out.data[i * 4 + 1] = 255;
          out.data[i * 4 + 2] = 255;
          out.data[i * 4 + 3] = a;
      }
      mctx.putImageData(out, 0, 0);
      return c;
  };
  const createMaskCanvasFromFloodAsync = (layerCtx, startX, startY, tolerance = 10) => {
      return new Promise((resolve) => {
          if (!layerCtx) return resolve(null);
          const w = layerCtx.canvas.width;
          const h = layerCtx.canvas.height;
          const imgData = layerCtx.getImageData(0, 0, w, h);
          const data = imgData.data;
          startX = Math.floor(startX);
          startY = Math.floor(startY);
          if (startX < 0 || startX >= w || startY < 0 || startY >= h) return resolve(null);
          const startIdx = (startY * w + startX) * 4;
          const sr = data[startIdx], sg = data[startIdx + 1], sb = data[startIdx + 2], sa = data[startIdx + 3];
          const match = (idx) => Math.abs(data[idx] - sr) <= tolerance &&
                                Math.abs(data[idx + 1] - sg) <= tolerance &&
                                Math.abs(data[idx + 2] - sb) <= tolerance &&
                                Math.abs(data[idx + 3] - sa) <= tolerance;
          const mask = new Uint8Array(w * h);
          const stack = [[startX, startY]];
          const batch = 50000;
          const step = () => {
              let processed = 0;
              while (stack.length && processed < batch) {
                  const [cx, sy] = stack.pop();
                  let cy = sy;
                  let currIdx = (cy * w + cx) * 4;
                  while (cy >= 0 && match(currIdx)) {
                      cy--;
                      currIdx -= w * 4;
                  }
                  cy++;
                  currIdx += w * 4;
                  let reachLeft = false;
                  let reachRight = false;
                  while (cy < h && match(currIdx)) {
                      const mIdx = (cy * w + cx);
                      if (!mask[mIdx]) {
                          mask[mIdx] = 255;
                          processed++;
                          if (cx > 0) {
                              const leftIdx = currIdx - 4;
                              if (match(leftIdx)) {
                                  if (!reachLeft) {
                                      stack.push([cx - 1, cy]);
                                      reachLeft = true;
                                  }
                              } else if (reachLeft) {
                                  reachLeft = false;
                              }
                          }
                          if (cx < w - 1) {
                              const rightIdx = currIdx + 4;
                              if (match(rightIdx)) {
                                  if (!reachRight) {
                                      stack.push([cx + 1, cy]);
                                      reachRight = true;
                                  }
                              } else if (reachRight) {
                                  reachRight = false;
                              }
                          }
                      }
                      cy++;
                      currIdx += w * 4;
                  }
              }
              if (stack.length) {
                  requestAnimationFrame(step);
              } else {
                  const c = document.createElement('canvas');
                  c.width = w; c.height = h;
                  const mctx = c.getContext('2d');
                  const out = mctx.createImageData(w, h);
                  for (let i = 0; i < w * h; i++) {
                      const a = mask[i];
                      out.data[i * 4 + 0] = 255;
                      out.data[i * 4 + 1] = 255;
                      out.data[i * 4 + 2] = 255;
                      out.data[i * 4 + 3] = a;
                  }
                  mctx.putImageData(out, 0, 0);
                  resolve(c);
              }
          };
          requestAnimationFrame(step);
      });
  };
  const finalizeSelectionFromMask = (maskCanvas, typeHint = null) => {
      if (!maskCanvas || !activeLayerId) return;
      const mctx = maskCanvas.getContext('2d');
      const img = mctx.getImageData(0, 0, canvasWidth, canvasHeight);
      let minX = canvasWidth, minY = canvasHeight, maxX = 0, maxY = 0;
      for (let y = 0; y < canvasHeight; y++) {
          for (let x = 0; x < canvasWidth; x++) {
              const a = img.data[(y * canvasWidth + x) * 4 + 3];
              if (a > 0) {
                  if (x < minX) minX = x;
                  if (y < minY) minY = y;
                  if (x > maxX) maxX = x;
                  if (y > maxY) maxY = y;
              }
          }
      }
      if (maxX < minX || maxY < minY) return;
      const bounds = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      const buffer = document.createElement('canvas');
      buffer.width = canvasWidth;
      buffer.height = canvasHeight;
      const bctx = buffer.getContext('2d');
      const layerCanvas = layerRefs.current[activeLayerId];
      if (!layerCanvas) return;
      bctx.drawImage(layerCanvas, 0, 0);
      bctx.globalCompositeOperation = 'destination-in';
      bctx.drawImage(maskCanvas, 0, 0);
      bctx.globalCompositeOperation = 'source-over';
      setSelection({
          active: true,
          type: typeHint,
          layerId: activeLayerId,
          bounds,
          maskCanvas,
          bufferCanvas: buffer,
          transform: { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          interaction: { mode: null, handle: null },
          eraseApplied: false
      });
      renderSelectionOverlay();
  };
  const commitSelectionTransform = () => {
      if (!selection.active || !selection.bounds || !selection.bufferCanvas || !activeLayerId) return;
      const fs = getCurrentFrameSelection();
      const layerCanvas = layerRefs.current[activeLayerId];
      const ctx = layerCanvas?.getContext('2d');
      if (!ctx) return;
      addToHistory(layers, layerImages);
      if (!selection.eraseApplied) {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.drawImage(selection.maskCanvas, 0, 0);
          ctx.restore();
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = 'source-over';
      const cx = selection.bounds.x + selection.bounds.w / 2;
      const cy = selection.bounds.y + selection.bounds.h / 2;
      ctx.translate(fs.x + selection.bounds.w / 2, fs.y + selection.bounds.h / 2);
      ctx.rotate(selection.transform.rotation || 0);
      ctx.scale(selection.transform.scaleX, selection.transform.scaleY);
      ctx.translate(-cx, -cy);
      ctx.drawImage(selection.bufferCanvas, 0, 0);
      ctx.restore();
      const newMask = document.createElement('canvas');
      newMask.width = canvasWidth; newMask.height = canvasHeight;
      const mctx = newMask.getContext('2d');
      mctx.save();
      mctx.imageSmoothingEnabled = false;
      const ncx = fs.x + fs.w / 2;
      const ncy = fs.y + fs.h / 2;
      mctx.translate(fs.x + selection.bounds.w / 2, fs.y + selection.bounds.h / 2);
      mctx.rotate(selection.transform.rotation || 0);
      mctx.scale(selection.transform.scaleX, selection.transform.scaleY);
      mctx.translate(-(selection.bounds.x + selection.bounds.w / 2), -(selection.bounds.y + selection.bounds.h / 2));
      mctx.drawImage(selection.maskCanvas, 0, 0);
      mctx.restore();
      const img = mctx.getImageData(0, 0, canvasWidth, canvasHeight);
      for (let i = 0; i < img.data.length; i += 4) {
          img.data[i + 3] = img.data[i + 3] > 0 ? 255 : 0;
      }
      mctx.putImageData(img, 0, 0);
      let minX = canvasWidth, minY = canvasHeight, maxX = 0, maxY = 0;
      for (let y = 0; y < canvasHeight; y++) {
          for (let x = 0; x < canvasWidth; x++) {
              const a = img.data[(y * canvasWidth + x) * 4 + 3];
              if (a > 0) {
                  if (x < minX) minX = x;
                  if (y < minY) minY = y;
                  if (x > maxX) maxX = x;
                  if (y > maxY) maxY = y;
              }
          }
      }
      const newBounds = (maxX < minX || maxY < minY) ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      const newBuffer = document.createElement('canvas');
      newBuffer.width = canvasWidth; newBuffer.height = canvasHeight;
      const nbctx = newBuffer.getContext('2d');
      nbctx.imageSmoothingEnabled = false;
      nbctx.save();
      nbctx.translate(fs.x + selection.bounds.w / 2, fs.y + selection.bounds.h / 2);
      nbctx.rotate(selection.transform.rotation || 0);
      nbctx.scale(selection.transform.scaleX, selection.transform.scaleY);
      nbctx.translate(-(selection.bounds.x + selection.bounds.w / 2), -(selection.bounds.y + selection.bounds.h / 2));
      nbctx.drawImage(selection.bufferCanvas, 0, 0);
      nbctx.restore();
      nbctx.globalCompositeOperation = 'destination-in';
      nbctx.drawImage(newMask, 0, 0);
      nbctx.globalCompositeOperation = 'source-over';
      setSelection(prev => ({
          ...prev,
          bounds: newBounds || fs,
          maskCanvas: newMask,
          bufferCanvas: newBuffer,
          transform: { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          interaction: { mode: null, handle: null },
          eraseApplied: prev.eraseApplied
      }));
      saveCanvasState();
      renderSelectionOverlay();
  };
  const clearSelection = () => {
      if (selection.active && selection.bufferCanvas) {
          commitSelectionTransform();
      }
      const overlay = tempCanvasRef.current?.getContext('2d');
      if (overlay) overlay.clearRect(0, 0, canvasWidth, canvasHeight);
      setSelection({
          active: false,
          type: null,
          layerId: null,
          bounds: null,
          maskCanvas: null,
          bufferCanvas: null,
          transform: { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          interaction: { mode: null, handle: null },
          eraseApplied: false
      });
      setContextMenu({ open: false, x: 0, y: 0 });
  };
  const invertSelection = () => {
      if (!selection.active || !selection.maskCanvas) return;
      const c = document.createElement('canvas');
      c.width = canvasWidth; c.height = canvasHeight;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(selection.maskCanvas, 0, 0);
      finalizeSelectionFromMask(c, selection.type || 'rect');
      setContextMenu({ open: false, x: 0, y: 0 });
  };
  const reflectSelection = (axis) => {
      if (!selection.active) return;
      setSelection(prev => ({
          ...prev,
          transform: {
              ...prev.transform,
              scaleX: axis === 'h' ? -prev.transform.scaleX : prev.transform.scaleX,
              scaleY: axis === 'v' ? -prev.transform.scaleY : prev.transform.scaleY
          }
      }));
      setContextMenu({ open: false, x: 0, y: 0 });
      requestAnimationFrame(() => {
          commitSelectionTransform();
      });
  };

  const loadCanvases = async () => {
    if (!project?.id) return;
    setLoading(true);
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from('arttab')
        .select('id, project_id, user_id, nombres_de_lienzos, fecha_de_modificacion, capas, versiones, aspecto_ratio, resolucion_del_lienzo, data, paletas')
        .eq('project_id', project.id)
        .order('fecha_de_modificacion', { ascending: false })
        .limit(30);

      if (error) throw error;

      // Filter out system rows
      const rows = (data || []).filter(r => r.nombres_de_lienzos !== 'SYSTEM_TAGS_CONFIG');
      setRecentCanvases(rows);
      if (!selectedCanvasId && rows.length > 0) {
        setSelectedCanvasId(rows[0].id);
        // Default to first version if available
        if (rows[0].versiones && rows[0].versiones.length > 0) {
            setActiveVersionId(rows[0].versiones[0].id);
        }
      }

      const hasOwn = user?.id ? rows.some(r => r.user_id === user.id) : true;
      // if (canCreate && !hasOwn) {
      //   setCreateModalOpen(true);
      // }
    } catch (error) {
      setDbError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCanvases();
  }, [project?.id, user?.id]);

  // When selecting a canvas manually, set active version to first one
  const handleSelectCanvas = (id) => {
    setSelectedCanvasId(id);
    const canvas = recentCanvases.find(c => c.id === id);
    if (canvas && canvas.versiones && canvas.versiones.length > 0) {
        setActiveVersionId(canvas.versiones[0].id);
    } else {
        setActiveVersionId(null);
    }
  };

  const toggleTag = (path) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Add auto-expand effect when selecting a tag
  useEffect(() => {
      if (selectedTagPath) {
          const parts = selectedTagPath.split('/');
          setExpandedTags(prev => {
              const next = new Set(prev);
              let acc = '';
              // Expand all parents
              for (let i = 0; i < parts.length - 1; i++) {
                  acc = acc ? `${acc}/${parts[i]}` : parts[i];
                  next.add(acc);
              }
              return next;
          });
      }
  }, [selectedTagPath]);

  const insertNewCanvas = async () => {
    if (!canCreate || !newCanvasName.trim()) return;
    setCreating(true);
    setDbError(null);
    try {
      let finalTagPath = selectedTagPath || null;
      if (finalTagPath) {
          finalTagPath = finalTagPath.replace(/,/g, '/').split('/').map(s => s.trim()).filter(Boolean).join('/');
          
          if (!tagPaths.includes(finalTagPath)) {
             const newTags = [...tagPaths, finalTagPath].sort();
             await saveTagsToDb(newTags);
          }
      }

      const newVersionId = `${Date.now()}-v1`;
      const initialLayerId = crypto.randomUUID();
      
      const payload = {
        project_id: project.id,
        user_id: user.id,
        nombres_de_lienzos: newCanvasName.trim(),
        data: { 
            versions: { 
                [newVersionId]: { 
                    layers: [{ id: initialLayerId, name: 'Capa 1', visible: true, opacity: 1 }],
                    images: {} // Empty initially
                } 
            },
            meta: { tagPath: finalTagPath } 
        }, 
        capas: [], // Legacy field, ignored now
        aspecto_ratio: newAspectRatio,
        resolucion_del_lienzo: newResolution,
        versiones: [{ id: newVersionId, name: 'Versión 1', created_at: new Date().toISOString() }],
        referencias: [],
        registro: [],
        permisos: {}
      };

      const { data, error } = await supabase
        .from('arttab')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      setCreateModalOpen(false);
      setNewCanvasName('');
      await loadCanvases(); 
      handleSelectCanvas(data?.id); 
    } catch (error) {
      setDbError(error);
    } finally {
      setCreating(false);
    }
  };

  // --- INITIALIZE LAYERS EFFECT ---
  const lastLoadedRef = useRef({ canvasId: null, versionId: null });

  useEffect(() => {
    if (!selectedCanvas || !activeVersionId) {
        setLayers([]);
        setLayerImages({});
        setActiveLayerId(null);
        lastLoadedRef.current = { canvasId: null, versionId: null };
        setHistory({ past: [], future: [] });
        return;
    }

    // Avoid reloading if we are just saving (IDs haven't changed)
    // We only want to load from prop when the USER switches canvas/version
    if (selectedCanvas.id === lastLoadedRef.current.canvasId && activeVersionId === lastLoadedRef.current.versionId) {
        return;
    }
    
    // Reset history when switching context
    setHistory({ past: [], future: [] });
    
    lastLoadedRef.current = { canvasId: selectedCanvas.id, versionId: activeVersionId };

    const versionData = selectedCanvas.data?.versions?.[activeVersionId];
    
    if (versionData?.layers && Array.isArray(versionData.layers)) {
        // Modern Structure
        setLayers(versionData.layers);
        setLayerImages(versionData.images || {});
        // Restore active layer if possible, else first
        setActiveLayerId(prev => {
            const exists = versionData.layers.find(l => l.id === prev);
            return exists ? prev : (versionData.layers[0]?.id || null);
        });
    } else {
        // Legacy Structure Migration
        const isFirstVersion = selectedCanvas.versiones?.[0]?.id === activeVersionId;
        const legacyImage = versionData?.image || (isFirstVersion ? selectedCanvas.data?.image : null);
        
        const layerId = crypto.randomUUID();
        const defaultLayer = { id: layerId, name: 'Capa 1', visible: true, opacity: 1 };
        
        setLayers([defaultLayer]);
        setLayerImages(legacyImage ? { [layerId]: legacyImage } : {});
        setActiveLayerId(layerId);
    }

  }, [selectedCanvas, activeVersionId]);

  // --- RENDER LAYERS EFFECT ---
  useEffect(() => {
      // Repaint all layers when dependency changes (zoom, layers)
      // We REMOVED layerImages from dependency to avoid flickering when drawing (as we already have the image on canvas)
      // We only render when structure changes (layers) or we switch context (activeVersionId)
      
      layers.forEach(layer => {
          const canvas = layerRefs.current[layer.id];
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          
          // IMPORTANT: Reset composite operation to ensure we draw normally
          // (Eraser tool might have left it at 'destination-out')
          ctx.globalCompositeOperation = 'source-over';

          // Clear content
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const imgData = layerImages[layer.id];
          
          if (imgData) {
              const img = new Image();
              img.src = imgData;
              img.onload = () => {
                  // Ensure we are still in source-over mode before async draw
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.clearRect(0, 0, canvas.width, canvas.height); 
                  ctx.drawImage(img, 0, 0);
              };
          }
      });
      
  }, [layers, activeVersionId, selectedCanvasId, renderTrigger]); // Removed layerImages to fix flickering

  // --- DRAWING LOGIC ---
  
  const getPointerPos = (e) => {
    const container = canvasContainerRef.current;
    if (!container) return { x: 0, y: 0, pressure: 0.5 };
    
    const rect = container.getBoundingClientRect();
    
    // Canvas resolution (internal pixels)
    const cw = selectedCanvas?.resolucion_del_lienzo?.width || 1920;
    const ch = selectedCanvas?.resolucion_del_lienzo?.height || 1080;
    
    // Scale factor: Internal / Visual
    // Note: rect.width is the visual width on screen (affected by zoom)
    // We want the coordinate in internal pixels.
    const scaleX = cw / rect.width;
    const scaleY = ch / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure !== undefined ? e.pressure : 0.5
    };
  };
  
  const handlePointerDown = (e) => {
    if (!selectedCanvasId || readOnly) return;
    if (refContextMenu.open) {
        setRefContextMenu({ open: false, x: 0, y: 0, refId: null });
    }

    // Middle mouse (button 1)
    if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
    }

    // Right-click: open context menu if applicable and stop further handling
    if (e.button === 2) {
        showSelectionContextMenu(e);
        return;
    }

    if (tool === 'references') return;

    if (!activeLayerId) return;
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (!activeLayer || !activeLayer.visible) return;

    e.preventDefault(); 
    e.target.setPointerCapture(e.pointerId);
    
    const { x, y, pressure } = getPointerPos(e);

    // --- TOOL LOGIC ---
    
    if (tool === 'move') {
        moveStart.current = { x, y };
        setIsMovingLayer(true);
        addToHistory(layers, layerImages); // Save before move
        return;
    }
    if (tool === 'move_selection' && selection.active) {
        const fs = getCurrentFrameSelection();
        const handle = getTransformHandle(x, y, fs);
        if (handle && handle !== 'outside') {
            selectionDragStartRef.current = { x, y, fs, transform: { ...selection.transform } };
            setSelection(prev => ({ ...prev, interaction: { mode: handle === 'body' ? 'move' : (handle === 'rot' ? 'rotate' : 'scale'), handle } }));
            const layerCanvas = layerRefs.current[activeLayerId];
            const ctx = layerCanvas?.getContext('2d');
            if (ctx && selection.maskCanvas) {
                addToHistory(layers, layerImages);
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(selection.maskCanvas, 0, 0);
                ctx.restore();
                setSelection(prev => ({ ...prev, eraseApplied: true }));
            }
        }
        return;
    }
    
    if (tool === 'picker') {
        const ctx = layerRefs.current[activeLayerId]?.getContext('2d');
        if (!ctx) return;
        const p = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
        setBrushColor(hex);
        setTool('brush'); // Switch back to brush automatically
        return;
    }
    
    if (tool === 'fill') {
        const ctx = layerRefs.current[activeLayerId]?.getContext('2d');
        if (!ctx) return;
        addToHistory(layers, layerImages);
        floodFill(ctx, x, y, brushColor);
        saveCanvasState(); // Auto save after fill
        return;
    }
    
    if (tool === 'rect' || tool === 'circle') {
        shapeStart.current = { x, y };
        isDrawing.current = true;
        return;
    }
    if (tool === 'select_rect') {
        isSelectingRef.current = true;
        selectionStartRef.current = { x, y };
        setSelection({
            active: false,
            type: 'rect',
            layerId: activeLayerId,
            bounds: { x, y, w: 0, h: 0 },
            maskCanvas: null,
            bufferCanvas: null,
            transform: { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0 },
            interaction: { mode: null, handle: null }
        });
        return;
    }
    if (tool === 'select_lasso') {
        isSelectingRef.current = true;
        selectionStartRef.current = { x, y };
        selectionPathRef.current = [{ x, y }];
        setSelection({
            active: false,
            type: 'lasso',
            layerId: activeLayerId,
            bounds: null,
            maskCanvas: null,
            bufferCanvas: null,
            transform: { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0 },
            interaction: { mode: null, handle: null }
        });
        return;
    }
    if (tool === 'select_magic') {
        if (magicWandRef.current.running) return;
        const ctx = layerRefs.current[activeLayerId]?.getContext('2d');
        if (!ctx) return;
        magicWandRef.current.running = true;
        createMaskCanvasFromFloodAsync(ctx, x, y, 10).then((mask) => {
            magicWandRef.current.running = false;
            if (mask) {
                finalizeSelectionFromMask(mask, 'magic');
            }
        });
        return;
    }

    // --- BRUSH / ERASER LOGIC ---
    
    isDrawing.current = true;
    points.current = [{ x, y, pressure }];
    
    // Choose drawing context: offscreen if selection active and not moving selection
    let ctx = layerRefs.current[activeLayerId]?.getContext('2d');
    if (selection.active && tool !== 'move_selection') {
        const c = document.createElement('canvas');
        c.width = canvasWidth;
        c.height = canvasHeight;
        selectionStrokeCanvasRef.current = c;
        selectionStrokeCtxRef.current = c.getContext('2d');
        ctx = selectionStrokeCtxRef.current;
        isSelectionPaintingRef.current = true;
        const overlay = tempCanvasRef.current?.getContext('2d');
        if (overlay) overlay.clearRect(0, 0, canvasWidth, canvasHeight);
    }
    if (!ctx) return;

    const preset = tool === 'eraser' ? ERASER_PRESET : (BRUSH_PRESETS[brushType] || BRUSH_PRESETS.pencil);
    const settings = tool === 'eraser' ? eraserSettings : (brushSettingsByType[brushType] || preset.defaults);

    const composite = tool === 'eraser' ? 'destination-out' : 'source-over';
    const color = tool === 'eraser' ? '#000000' : brushColor;
    const opacity = Math.min(1, Math.max(0, settings.opacity));
    const hardness = Math.min(1, Math.max(0, settings.hardness));

    const p = typeof pressure === 'number' ? Math.min(1, Math.max(0, pressure)) : 0.5;
    let initialWidth = settings.size;
    if (preset.id === 'ink') {
        initialWidth = settings.size * (0.15 + p * 2.85);
    } else if (preset.id === 'marker' || preset.id === 'highlighter') {
        initialWidth = settings.size;
    } else {
        initialWidth = settings.size * (0.4 + p * 1.6);
    }
    initialWidth = Math.max(0.5, initialWidth);

    lastWidth.current = initialWidth;
    paintSessionRef.current = {
        presetId: preset.id,
        mode: preset.mode,
        cap: preset.cap,
        smoothing: preset.smoothing,
        sprayDensity: preset.sprayDensity || 0,
        composite,
        color,
        opacity,
        hardness,
        baseSize: settings.size
    };

    useStampRef.current = preset.mode !== 'stroke';
    lastStampPos.current = { x, y };

    if (preset.mode === 'spray') {
        spraySeedRef.current = (spraySeedRef.current + 1) % 1000000;
        const radius = Math.max(0.5, initialWidth / 2);
        const density = (preset.sprayDensity || 20) * Math.max(0.4, radius / 40);
        sprayAt(ctx, x, y, radius, color, hardness, opacity, composite, density);
        if (isSelectionPaintingRef.current) {
            const overlay = tempCanvasRef.current?.getContext('2d');
            if (overlay && selection.maskCanvas) {
                overlay.clearRect(0, 0, canvasWidth, canvasHeight);
                overlay.save();
                overlay.drawImage(selectionStrokeCanvasRef.current, 0, 0);
                overlay.globalCompositeOperation = 'destination-in';
                overlay.drawImage(selection.maskCanvas, 0, 0);
                overlay.restore();
                drawSelectionBorder(overlay);
            }
        }
        return;
    }

    if (preset.mode === 'stamp') {
        const radius = Math.max(0.5, initialWidth / 2);
        stampRadial(ctx, x, y, radius, color, hardness, opacity, composite);
        if (isSelectionPaintingRef.current) {
            const overlay = tempCanvasRef.current?.getContext('2d');
            if (overlay && selection.maskCanvas) {
                overlay.clearRect(0, 0, canvasWidth, canvasHeight);
                overlay.save();
                overlay.drawImage(selectionStrokeCanvasRef.current, 0, 0);
                overlay.globalCompositeOperation = 'destination-in';
                overlay.drawImage(selection.maskCanvas, 0, 0);
                overlay.restore();
                drawSelectionBorder(overlay);
            }
        }
        return;
    }

    ctx.globalCompositeOperation = composite;
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
    ctx.lineCap = preset.cap;
    ctx.lineJoin = preset.cap === 'square' ? 'miter' : 'round';
    ctx.lineWidth = initialWidth;
    const blur = (preset.id === 'marker' || preset.id === 'highlighter') ? (1 - hardness) * initialWidth * 0.6 : (1 - hardness) * initialWidth * 0.25;
    ctx.shadowBlur = tool === 'eraser' ? 0 : Math.max(0, blur);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const handlePointerDownOutsideViewport = (e) => {
      const vp = viewportRef.current;
      if (!vp) return;
      if (!vp.contains(e.target)) {
          setSelectedRefId(null);
          setRefContextMenu({ open: false, x: 0, y: 0, refId: null });
      }
  };
  
  const handlePointerMove = (e) => {
    // Update Custom Cursor Position
    if (cursorRef.current && viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        cursorRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }

    if (isPanning.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
    }

    const { x, y, pressure } = getPointerPos(e);
    
    // --- MOVE TOOL ---
    if (isMovingLayer && activeLayerId) {
        const dx = x - moveStart.current.x;
        const dy = y - moveStart.current.y;
        
        // We need the source image. For efficiency, we should have cached it on Down.
        // But for now, let's try using the layerImages (might be slightly laggy on first frame)
        const imgData = layerImages[activeLayerId];
        if (imgData) {
            const ctx = layerRefs.current[activeLayerId]?.getContext('2d');
            const img = new Image();
            img.src = imgData;
            // Note: In a real app, we'd cache this 'img' object on PointerDown
            if (img.complete) {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                ctx.drawImage(img, dx, dy);
            }
        }
        return;
    }
    // --- SELECTION PREVIEW & TRANSFORM ---
    if (isSelectingRef.current && tool === 'select_rect') {
        const sx = selectionStartRef.current.x;
        const sy = selectionStartRef.current.y;
        const rect = { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
        setSelection(prev => ({ ...prev, bounds: rect }));
        const ctx = tempCanvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#7e22ce';
            ctx.lineWidth = 1;
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
            ctx.setLineDash([]);
        }
        return;
    }
    if (isSelectingRef.current && tool === 'select_lasso') {
        selectionPathRef.current.push({ x, y });
        const ctx = tempCanvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            ctx.strokeStyle = '#7e22ce';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            const pts = selectionPathRef.current;
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        return;
    }
    if (tool === 'move_selection' && selection.active && selection.interaction.mode) {
        const start = selectionDragStartRef.current;
        if (start) {
            const dx = x - start.x;
            const dy = y - start.y;
            if (selection.interaction.mode === 'move') {
                setSelection(prev => ({ 
                    ...prev, 
                    transform: { 
                        ...prev.transform, 
                        tx: start.transform.tx + dx, 
                        ty: start.transform.ty + dy 
                    } 
                }));
            } else if (selection.interaction.mode === 'scale') {
                const handle = selection.interaction.handle;
                let sx = start.fs.w > 0 ? (start.fs.w + (handle.includes('l') ? -dx : handle.includes('r') ? dx : 0)) / selection.bounds.w : 1;
                let sy = start.fs.h > 0 ? (start.fs.h + (handle.includes('t') ? -dy : handle.includes('b') ? dy : 0)) / selection.bounds.h : 1;
                if (handle === 't' || handle === 'b') sx = selection.transform.scaleX;
                if (handle === 'l' || handle === 'r') sy = selection.transform.scaleY;
                sx = Math.max(0.1, sx);
                sy = Math.max(0.1, sy);
                setSelection(prev => ({ ...prev, transform: { ...prev.transform, scaleX: sx, scaleY: sy } }));
            } else if (selection.interaction.mode === 'rotate') {
                const cx = start.fs.x + start.fs.w / 2;
                const cy = start.fs.y + start.fs.h / 2;
                const a0 = Math.atan2(start.y - cy, start.x - cx);
                const a1 = Math.atan2(y - cy, x - cx);
                const delta = a1 - a0;
                setSelection(prev => ({ ...prev, transform: { ...prev.transform, rotation: start.transform.rotation + delta } }));
            }
            renderSelectionOverlay();
        }
        return;
    }
    
    // --- SHAPES PREVIEW ---
    if ((tool === 'rect' || tool === 'circle') && isDrawing.current) {
        const ctx = tempCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        const w = Math.max(0.5, activeSettings.size);
        const h = Math.min(1, Math.max(0, activeSettings.hardness));
        const o = Math.min(1, Math.max(0, activeSettings.opacity));
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = o;
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = w;
        ctx.lineJoin = activePreset.cap === 'square' ? 'miter' : 'round';
        ctx.lineCap = activePreset.cap;
        const blur = (1 - h) * w * (activePreset.id === 'highlighter' || activePreset.id === 'marker' ? 0.6 : 0.25);
        ctx.shadowBlur = Math.max(0, blur);
        ctx.shadowColor = brushColor;
        
        const sx = shapeStart.current.x;
        const sy = shapeStart.current.y;
        const ww = x - sx;
        const hh = y - sy;
        
        ctx.beginPath();
        if (tool === 'rect') {
            ctx.strokeRect(sx, sy, ww, hh);
        } else {
            ctx.ellipse(sx + ww/2, sy + hh/2, Math.abs(ww/2), Math.abs(hh/2), 0, 0, 2 * Math.PI);
            ctx.stroke();
        }
        return;
    }

    if (!isDrawing.current || !activeLayerId) return;
    e.preventDefault();
    
    const session = paintSessionRef.current;
    if (!session) return;

    const p = typeof pressure === 'number' ? Math.min(1, Math.max(0, pressure)) : 0.5;

    if (session.mode === 'stamp' || session.mode === 'spray') {
        let targetWidth = session.baseSize;
        if (session.presetId === 'ink') {
            targetWidth = session.baseSize * (0.15 + p * 2.85);
        } else if (session.presetId === 'marker' || session.presetId === 'highlighter') {
            targetWidth = session.baseSize;
        } else {
            targetWidth = session.baseSize * (0.4 + p * 1.6);
        }
        targetWidth = Math.max(0.5, targetWidth);

        const smoothingFactor = session.smoothing ?? 0.5;
        const smoothWidth = lastWidth.current * smoothingFactor + targetWidth * (1 - smoothingFactor);
        lastWidth.current = smoothWidth;

        let ctx = layerRefs.current[activeLayerId]?.getContext('2d');
        if (isSelectionPaintingRef.current && selectionStrokeCtxRef.current) {
            ctx = selectionStrokeCtxRef.current;
        }
        if (!ctx) return;

        const from = lastStampPos.current || { x, y };
        const to = { x, y };
        const radius = Math.max(0.5, smoothWidth / 2);

        if (session.mode === 'spray') {
            const density = (session.sprayDensity || 20) * Math.max(0.35, radius / 45);
            sprayLine(ctx, from, to, radius, session.color, session.hardness, session.opacity, session.composite, density);
        } else {
            stampLine(ctx, from, to, radius, session.color, session.hardness, session.opacity, session.composite);
        }

        lastStampPos.current = to;
        if (isSelectionPaintingRef.current) {
            const overlay = tempCanvasRef.current?.getContext('2d');
            if (overlay && selection.maskCanvas) {
                overlay.clearRect(0, 0, canvasWidth, canvasHeight);
                overlay.save();
                overlay.drawImage(selectionStrokeCanvasRef.current, 0, 0);
                overlay.globalCompositeOperation = 'destination-in';
                overlay.drawImage(selection.maskCanvas, 0, 0);
                overlay.restore();
                drawSelectionBorder(overlay);
            }
        }
        return;
    }

    points.current.push({ x, y, pressure });
    
    const pts = points.current;
    let ctx = layerRefs.current[activeLayerId]?.getContext('2d');
    if (isSelectionPaintingRef.current && selectionStrokeCtxRef.current) {
        ctx = selectionStrokeCtxRef.current;
    }
    if (!ctx) return;

    if (pts.length < 3) {
      const b = pts[pts.length - 1];
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }
    
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];
    
    const midPoint = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
    
    let targetWidth = session.baseSize;
    const sp = typeof p1.pressure === 'number' ? Math.min(1, Math.max(0, p1.pressure)) : 0.5;
    if (session.presetId === 'ink') {
        targetWidth = session.baseSize * (0.15 + sp * 2.85);
    } else if (session.presetId === 'marker' || session.presetId === 'highlighter') {
        targetWidth = session.baseSize;
    } else {
        targetWidth = session.baseSize * (0.4 + sp * 1.6);
    }
        
    const smoothingFactor = session.smoothing || 0.5;
    const smoothWidth = lastWidth.current * smoothingFactor + targetWidth * (1 - smoothingFactor);
    lastWidth.current = smoothWidth;
    
    ctx.globalCompositeOperation = session.composite;
    ctx.globalAlpha = session.opacity;
    ctx.strokeStyle = session.composite === 'destination-out' ? 'rgba(0,0,0,1)' : brushColor;
    ctx.lineCap = session.cap;
    ctx.lineJoin = session.cap === 'square' ? 'miter' : 'round';
    ctx.lineWidth = smoothWidth;
    const blur = (session.presetId === 'marker' || session.presetId === 'highlighter') ? (1 - session.hardness) * smoothWidth * 0.6 : (1 - session.hardness) * smoothWidth * 0.25;
    ctx.shadowBlur = session.composite === 'destination-out' ? 0 : Math.max(0, blur);
    ctx.shadowColor = ctx.strokeStyle;
    
    const p0 = pts[pts.length - 3];
    const startX = (p0.x + p1.x) / 2;
    const startY = (p0.y + p1.y) / 2;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
    ctx.stroke();
    if (isSelectionPaintingRef.current) {
        const overlay = tempCanvasRef.current?.getContext('2d');
        if (overlay && selection.maskCanvas) {
            overlay.clearRect(0, 0, canvasWidth, canvasHeight);
            overlay.save();
            overlay.drawImage(selectionStrokeCanvasRef.current, 0, 0);
            overlay.globalCompositeOperation = 'destination-in';
            overlay.drawImage(selection.maskCanvas, 0, 0);
            overlay.restore();
            drawSelectionBorder(overlay);
        }
    }
  };
  
  const handlePointerUp = (e) => {
    if (isPanning.current) {
        isPanning.current = false;
        return;
    }
    
    useStampRef.current = false;
    lastStampPos.current = null;
    paintSessionRef.current = null;
    
    // --- MOVE COMMIT ---
    if (isMovingLayer) {
        setIsMovingLayer(false);
        saveCanvasState();
        moveStart.current = null;
        return;
    }
    
    // --- SHAPE COMMIT ---
    if ((tool === 'rect' || tool === 'circle') && isDrawing.current) {
        isDrawing.current = false;
        
        // Clear Preview
        const tempCtx = tempCanvasRef.current?.getContext('2d');
        if (tempCtx) tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Draw Final to Layer
        const ctx = layerRefs.current[activeLayerId]?.getContext('2d');
        if (ctx) {
            addToHistory(layers, layerImages);
            
            const { x, y } = getPointerPos(e);
            const sx = shapeStart.current.x;
            const sy = shapeStart.current.y;
            const ww = x - sx;
            const hh = y - sy;
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.min(1, Math.max(0, activeSettings.opacity));
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = Math.max(0.5, activeSettings.size);
            ctx.lineJoin = activePreset.cap === 'square' ? 'miter' : 'round';
            ctx.lineCap = activePreset.cap;
            const blur = (1 - Math.min(1, Math.max(0, activeSettings.hardness))) * ctx.lineWidth * (activePreset.id === 'highlighter' || activePreset.id === 'marker' ? 0.6 : 0.25);
            ctx.shadowBlur = Math.max(0, blur);
            ctx.shadowColor = brushColor;
            
            ctx.beginPath();
            if (tool === 'rect') {
                ctx.strokeRect(sx, sy, ww, hh);
            } else {
                ctx.ellipse(sx + ww/2, sy + hh/2, Math.abs(ww/2), Math.abs(hh/2), 0, 0, 2 * Math.PI);
                ctx.stroke();
            }
            
            saveCanvasState();
        }
        return;
    }
    // --- SELECTION COMMIT ---
    if (isSelectingRef.current && tool === 'select_rect') {
        isSelectingRef.current = false;
        const { x, y } = getPointerPos(e);
        const sx = selectionStartRef.current.x;
        const sy = selectionStartRef.current.y;
        const rect = { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
        const mask = createMaskCanvasFromRect(rect);
        finalizeSelectionFromMask(mask, 'rect');
        return;
    }
    if (isSelectingRef.current && tool === 'select_lasso') {
        isSelectingRef.current = false;
        const mask = createMaskCanvasFromPolygon(selectionPathRef.current);
        selectionPathRef.current = [];
        finalizeSelectionFromMask(mask, 'lasso');
        return;
    }
    if (tool === 'move_selection' && selection.active && selection.interaction.mode) {
        setSelection(prev => ({ ...prev, interaction: { mode: null, handle: null } }));
        return;
    }

    if (!isDrawing.current) return;
    e.preventDefault();
    isDrawing.current = false;
    points.current = [];
    
    // Commit drawing
    if (isSelectionPaintingRef.current && selection.maskCanvas && selectionStrokeCanvasRef.current) {
        const masked = document.createElement('canvas');
        masked.width = canvasWidth; masked.height = canvasHeight;
        const mctx = masked.getContext('2d');
        mctx.drawImage(selectionStrokeCanvasRef.current, 0, 0);
        mctx.globalCompositeOperation = 'destination-in';
        mctx.drawImage(selection.maskCanvas, 0, 0);
        const layerCtx = layerRefs.current[activeLayerId]?.getContext('2d');
        if (layerCtx) {
            layerCtx.drawImage(masked, 0, 0);
        }
        const overlay = tempCanvasRef.current?.getContext('2d');
        if (overlay) overlay.clearRect(0, 0, canvasWidth, canvasHeight);
        selectionStrokeCanvasRef.current = null;
        selectionStrokeCtxRef.current = null;
        isSelectionPaintingRef.current = false;
        saveCanvasState();
        return;
    } else {
        saveCanvasState();
    }
  };

  const saveCanvasState = async () => {
    if (!selectedCanvasId || !activeVersionId || readOnly || !activeLayerId) return;
    
    // Save history before modifying
    addToHistory(layers, layerImages);

    // 1. Get current image data for the modified layer
    const canvas = layerRefs.current[activeLayerId];
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    
    // 2. Update local state 'layerImages' and 'recentCanvases'
    const nextImages = { ...layerImages, [activeLayerId]: dataUrl };
    setLayerImages(nextImages); // Optimistic update of image cache

    setRecentCanvases(prev => prev.map(c => {
      if (c.id !== selectedCanvasId) return c;
      
      const prevVersionsMap = c.data?.versions || {};
      const prevVersion = prevVersionsMap[activeVersionId] || {};
      
      const nextVersion = {
          ...prevVersion,
          layers: layers, // Save current layers metadata structure
          images: nextImages
      };
      
      return { ...c, data: { ...c.data, versions: { ...prevVersionsMap, [activeVersionId]: nextVersion } } };
    }));
    
    try {
        // 3. Save to Supabase
        const currentData = selectedCanvas?.data || {};
        const currentVersionsMap = currentData.versions || {};
        const prevVersion = currentVersionsMap[activeVersionId] || {};

        const newData = {
            ...currentData,
            versions: {
                ...currentVersionsMap,
                [activeVersionId]: {
                    ...prevVersion,
                    layers: layers,
                    images: nextImages
                }
            }
        };

        const { error } = await supabase
            .from('arttab')
            .update({ 
                data: newData,
                fecha_de_modificacion: new Date().toISOString()
            })
            .eq('id', selectedCanvasId);
            
        if (error) throw error;
    } catch (error) {
        console.error('Error saving canvas:', error);
    }
  };

  // --- LAYER MANAGEMENT ---
  
  const addLayer = () => {
      if (layers.length >= MAX_LAYERS) return;
      
      addToHistory(layers, layerImages);

      const newId = crypto.randomUUID();
      const newLayer = { 
          id: newId, 
          name: `Capa ${layers.length + 1}`, 
          visible: true, 
          opacity: 1 
      };
      
      // Add to top (start of array? or end? Rendering order: start is bottom usually in DOM if standard flow, but we use absolute.
      // Let's render layers in order: index 0 is bottom, index N is top.
      // So add to END of array.
      const newLayers = [...layers, newLayer];
      setLayers(newLayers);
      setActiveLayerId(newId);
      
      // We should trigger save of structure
      updateLayersInDb(newLayers, layerImages);
  };

  const removeLayer = (id) => {
      if (layers.length <= 1) return; // Keep at least one
      
      addToHistory(layers, layerImages);

      const idx = layers.findIndex(l => l.id === id);
      const newLayers = layers.filter(l => l.id !== id);
      
      setLayers(newLayers);
      
      // Remove image data
      const newImages = { ...layerImages };
      delete newImages[id];
      setLayerImages(newImages);

      // Select new active
      if (activeLayerId === id) {
          const newActive = newLayers[Math.max(0, idx - 1)] || newLayers[0];
          setActiveLayerId(newActive.id);
      }
      
      updateLayersInDb(newLayers, newImages);
  };

  const updateLayer = (id, updates) => {
      const newLayers = layers.map(l => l.id === id ? { ...l, ...updates } : l);
      setLayers(newLayers);
      // Debounce save? or immediate?
      // For visibility/opacity, better save immediately to keep sync
      updateLayersInDb(newLayers, layerImages);
  };

  const duplicateLayer = (id) => {
      if (layers.length >= MAX_LAYERS) return;
      const layerToCopy = layers.find(l => l.id === id);
      if (!layerToCopy) return;

      addToHistory(layers, layerImages);

      const newId = crypto.randomUUID();
      const newLayer = {
          ...layerToCopy,
          id: newId,
          name: `${layerToCopy.name} (copia)`
      };
      
      // Insert after original
      const idx = layers.findIndex(l => l.id === id);
      const newLayers = [...layers];
      newLayers.splice(idx + 1, 0, newLayer);
      
      setLayers(newLayers);
      
      // Copy image
      const sourceImg = layerImages[id];
      const newImages = { ...layerImages };
      if (sourceImg) {
          newImages[newId] = sourceImg;
      }
      setLayerImages(newImages);
      setActiveLayerId(newId);
      
      updateLayersInDb(newLayers, newImages);
  };

  const updateLayersInDb = async (newLayers, newImages) => {
      if (!selectedCanvasId || !activeVersionId) return;

      // Update local state first
      setRecentCanvases(prev => prev.map(c => {
        if (c.id !== selectedCanvasId) return c;
        const vMap = c.data?.versions || {};
        const vData = vMap[activeVersionId] || {};
        return {
            ...c,
            data: {
                ...c.data,
                versions: {
                    ...vMap,
                    [activeVersionId]: { ...vData, layers: newLayers, images: newImages }
                }
            }
        };
      }));

      // Fire and forget DB update
      try {
          const currentData = selectedCanvas?.data || {};
          const currentVersionsMap = currentData.versions || {};
          const currentVersion = currentVersionsMap[activeVersionId] || {};
          
          await supabase.from('arttab').update({
              data: {
                  ...currentData,
                  versions: {
                      ...currentVersionsMap,
                      [activeVersionId]: {
                          ...currentVersion,
                          layers: newLayers,
                          images: newImages
                      }
                  }
              }
          }).eq('id', selectedCanvasId);
      } catch (err) {
          console.error("Error saving layers:", err);
      }
  };

  const leftTopRight = (
    <SegmentedTabs
      options={[
        { value: 'recursos', label: 'Recursos' },
        { value: 'referencias', label: 'Referencias' }
      ]}
      value={leftTopTab}
      onChange={setLeftTopTab}
    />
  );

  const rightBottomRight = (
    <SegmentedTabs
      options={[
        { value: 'capas', label: 'Capas' },
        { value: 'registro', label: 'Registro' }
      ]}
      value={rightBottomTab}
      onChange={setRightBottomTab}
    />
  );

  const toolButton = (id, label, Icon) => {
    const isActive = tool === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setTool(id)}
        className={`p-2 rounded-xl border text-sm font-bold transition-colors ${
          isActive ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
        title={label}
      >
        <Icon size={16} />
      </button>
    );
  };

  // Filter canvases by tag
  const filteredCanvases = useMemo(() => {
      if (!selectedTagPath) return recentCanvases;
      return recentCanvases.filter(c => {
          const cTag = c.data?.meta?.tagPath || '';
          return cTag === selectedTagPath || cTag.startsWith(selectedTagPath + '/');
      });
  }, [recentCanvases, selectedTagPath]);

  const resourcesBody = (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500">
          {loading ? 'Cargando…' : `${filteredCanvases.length} lienzo(s)`}
        </div>
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => setCreateModalOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 disabled:opacity-60 flex items-center gap-2"
        >
          <Plus size={14} />
          Nuevo
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {dbError && (
          <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
            No se pudo cargar Arte desde la base de datos.
          </div>
        )}
        {!dbError && filteredCanvases.length === 0 && !loading && (
          <div className="p-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm">
            {selectedTagPath ? 'Carpeta vacía.' : 'Aún no hay lienzos en este proyecto.'}
          </div>
        )}
        <div className="space-y-2">
          {filteredCanvases.map(row => {
            const isSelected = row.id === selectedCanvasId;
            const ownerLabel = user?.id && row.user_id === user.id ? 'Tú' : 'Colaborador';
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => handleSelectCanvas(row.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  isSelected ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 truncate">{row.nombres_de_lienzos || 'Sin nombre'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{ownerLabel}</div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                    {row.fecha_de_modificacion ? new Date(row.fecha_de_modificacion).toLocaleDateString() : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const referenciasBody = (
    <div className="h-full p-3 text-sm text-gray-600">
        <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">{referenceImages.length} referencia(s)</div>
        <div className="flex gap-2">
            <button
                type="button"
                  onClick={reloadReferences}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                title="Recargar"
            >
                <Undo2 size={14} className="rotate-180" /> 
            </button>
            <label className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 cursor-pointer">
              Subir
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadReferenceImage(e.target.files?.[0])} />
            </label>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {referenceImages.map(ref => (
          <div key={ref.id} className="border rounded-xl overflow-hidden bg-white">
            <img src={ref.url} alt={ref.name} className="w-full h-24 object-cover" draggable onDragStart={(e) => startDragRefImage(e, ref.url)} />
            <div className="px-2 py-1 text-[10px] text-gray-500 truncate">{ref.name}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const herramientasBody = (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-3 grid grid-cols-4 gap-2">
        {toolButton('brush', 'Pincel', Pencil)}
        {toolButton('eraser', 'Borrador', Eraser)}
        {toolButton('fill', 'Relleno', PaintBucket)}
        {toolButton('picker', 'Gotero', Pipette)}
        {toolButton('references', 'Referencias', ImageIcon)}
        {toolButton('move', 'Mover Capa', Move)}
        {toolButton('rect', 'Rectángulo', Square)}
        {toolButton('circle', 'Círculo', Circle)}
        {toolButton('select_rect', 'Selección Rectángulo', Square)}
        {toolButton('select_lasso', 'Selección Libre', LassoSelect)}
        {toolButton('select_magic', 'Varita Mágica', Wand2)}
        {toolButton('move_selection', 'Mover Selección', Move)}
      </div>
      
      <div className="px-3 pb-3 space-y-4 overflow-y-auto">
        
        {tool === 'brush' && (
            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-2">Pinceles</label>
                <div className="grid grid-cols-4 gap-1">
                    {Object.values(BRUSH_PRESETS).map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => setBrushType(preset.id)}
                            className={`p-1.5 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                                brushType === preset.id ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300' : 'text-gray-500 hover:bg-gray-200'
                            }`}
                            title={preset.label}
                        >
                            <preset.icon size={16} />
                        </button>
                    ))}
                </div>
                <div className="text-center text-[10px] font-medium text-gray-600 mt-1">
                    {activePreset.label}
                </div>
            </div>
        )}

        {(tool === 'brush' || tool === 'eraser') && (
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Tamaño: {Math.round(activeSettings.size)}px
            </label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={Math.sqrt((Math.max(1, activeSettings.size) - 1) / 499) * 100} 
              onChange={(e) => {
                  const t = parseFloat(e.target.value) / 100;
                  setActiveSettings({ size: Math.round(1 + 499 * t * t) });
              }} 
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        )}

        {(tool === 'brush' || tool === 'eraser') && (
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Dureza: {Math.round(activeSettings.hardness * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(activeSettings.hardness * 100)}
              onChange={(e) => setActiveSettings({ hardness: parseInt(e.target.value, 10) / 100 })}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        )}

        {(tool === 'brush' || tool === 'eraser') && (
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Opacidad: {Math.round(activeSettings.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(activeSettings.opacity * 100)}
              onChange={(e) => setActiveSettings({ opacity: parseInt(e.target.value, 10) / 100 })}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        )}
        
        <div>
          <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Color</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {['#000000', '#555555', '#aaaaaa', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setBrushColor(c)}
                className={`w-6 h-6 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-110 ${brushColor === c ? 'ring-2 ring-offset-1 ring-purple-500' : ''}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <input 
                    type="color" 
                    value={brushColor.length === 7 ? brushColor : '#000000'}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
                  />
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: brushColor }} />
              </div>
              <input 
                type="text" 
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 uppercase font-mono"
              />
          </div>
        </div>
        
        {/* PALETTES UI */}
        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500">
                    <Palette size={10} /> Paletas
                </div>
                <div className="flex bg-gray-200 rounded-lg p-0.5">
                    <button 
                        onClick={() => setActivePaletteTab('canvas')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${activePaletteTab === 'canvas' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}
                    >
                        Lienzo
                    </button>
                    <button 
                        onClick={() => setActivePaletteTab('project')}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${activePaletteTab === 'project' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}
                    >
                        Proyecto
                    </button>
                </div>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {(activePaletteTab === 'canvas' ? canvasPalettes : projectPalettes).map(palette => (
                    <div key={palette.id} className="bg-white border border-gray-200 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-gray-700 truncate max-w-[100px]" title={palette.name}>
                                {palette.name}
                            </span>
                            <button 
                                onClick={() => deletePalette(palette.id)} 
                                className="text-gray-400 hover:text-red-500"
                                title="Eliminar paleta"
                            >
                                <Trash2 size={10} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {palette.colors.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setBrushColor(c)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        removeColorFromPalette(palette.id, c);
                                    }}
                                    className="w-4 h-4 rounded border border-gray-200 hover:scale-110 transition-transform relative group"
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))}
                            <button 
                                onClick={() => addColorToPalette(palette.id)}
                                className="w-4 h-4 rounded border border-dashed border-gray-300 text-gray-400 flex items-center justify-center hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-colors"
                                title="Añadir color actual"
                            >
                                <Plus size={10} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            <button 
                onClick={addPalette}
                className="w-full mt-2 py-1.5 border border-dashed border-gray-300 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center justify-center gap-1"
            >
                <Plus size={10} /> Nueva Paleta
            </button>
        </div>

      </div>
    </div>
  );

  const etiquetasBody = (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500 truncate">{selectedTagPath ? selectedTagPath : 'Sin selección'}</div>
        <button
          type="button"
          onClick={handleCreateTag}
          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          + Etiqueta
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <TagTree
          tree={tagTree}
          expanded={expandedTags}
          onToggle={toggleTag}
          onSelect={setSelectedTagPath}
          selectedPath={selectedTagPath}
          canvases={recentCanvases} 
          onAddSubTag={handleCreateSubTag}
          onAddCanvas={handleCreateCanvasInTag}
          onSelectCanvas={handleSelectCanvas}
          selectedCanvasId={selectedCanvasId}
        />
      </div>
    </div>
  );

  const capasBody = (
    <div className="h-full flex flex-col min-h-0">
        {/* Toolbar */}
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between gap-2 bg-gray-50">
        <div className="text-xs text-gray-500 font-bold">{layers.length} / {MAX_LAYERS}</div>
        <div className="flex items-center gap-1">
            <button onClick={addLayer} disabled={layers.length >= MAX_LAYERS} className="p-1 hover:bg-purple-200 text-purple-700 rounded transition-colors disabled:opacity-50" title="Nueva Capa">
                <Plus size={16} />
            </button>
        </div>
      </div>
      
      {/* Layers List */}
      <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1">
          {/* Reverse map to show top layers first */}
          {[...layers].reverse().map(layer => (
              <div 
                key={layer.id} 
                onClick={() => setActiveLayerId(layer.id)}
                className={`group flex items-center gap-2 p-2 rounded-lg border text-sm select-none cursor-pointer transition-all ${
                    activeLayerId === layer.id 
                    ? 'bg-purple-50 border-purple-300 shadow-sm' 
                    : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
              >
                  <button 
                    onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
                    className={`p-1 rounded hover:bg-gray-200 ${layer.visible ? 'text-gray-600' : 'text-gray-300'}`}
                  >
                      {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${activeLayerId === layer.id ? 'text-purple-900' : 'text-gray-700'}`}>
                          {layer.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 font-mono">OP: {Math.round(layer.opacity * 100)}%</span>
                          <input 
                            type="range" 
                            min="0" max="1" step="0.1" 
                            value={layer.opacity}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateLayer(layer.id, { opacity: parseFloat(e.target.value) })}
                            className="w-16 h-1 accent-purple-500 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                  </div>

                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.id); }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Duplicar"
                    >
                        <Copy size={12} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar"
                        disabled={layers.length <= 1}
                    >
                        <Trash2 size={12} />
                    </button>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );

  const registroBody = (
    <div className="h-full p-3 text-sm text-gray-600">
      Registro (base). Aquí irá el historial/bitácora del lienzo.
    </div>
  );

  const handleAddVersion = async () => {
    if (!selectedCanvasId || !selectedCanvas || readOnly) return;
    const currentVersions = selectedCanvas.versiones || [];
    if (currentVersions.length >= 5) return;

    const newVersionId = `${Date.now()}-v${currentVersions.length + 1}`;
    const newVersion = {
        id: newVersionId,
        name: `Versión ${currentVersions.length + 1}`,
        created_at: new Date().toISOString()
    };

    const updatedVersions = [...currentVersions, newVersion];
    
    // Create initial layer structure for new version
    const initialLayerId = crypto.randomUUID();
    const newVersionData = {
        layers: [{ id: initialLayerId, name: 'Capa 1', visible: true, opacity: 1 }],
        images: {}
    };

    // Update local state optimistic
    setRecentCanvases(prev => prev.map(c => {
        if (c.id !== selectedCanvasId) return c;
        return { 
            ...c, 
            versiones: updatedVersions,
            data: {
                ...c.data,
                versions: {
                    ...(c.data?.versions || {}),
                    [newVersionId]: newVersionData
                }
            }
        };
    }));

    // Select new version immediately
    setActiveVersionId(newVersionId);

    try {
        const currentData = selectedCanvas.data || {};
        await supabase
            .from('arttab')
            .update({ 
                versiones: updatedVersions,
                data: {
                    ...currentData,
                    versions: {
                        ...(currentData.versions || {}),
                        [newVersionId]: newVersionData
                    }
                }
            })
            .eq('id', selectedCanvasId);
    } catch (error) {
        console.error('Error adding version:', error);
    }
  };

  const versionesBody = (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-auto p-3">
        <div className="flex items-center gap-4">
          {(selectedCanvas?.versiones || []).slice(0, 5).map(v => {
            const isActive = v.id === activeVersionId;
            return (
                <button 
                    key={v.id || v.name} 
                    onClick={() => setActiveVersionId(v.id)}
                    className={`w-40 h-24 rounded-xl border flex items-center justify-center text-xs transition-all ${
                        isActive 
                        ? 'border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-200' 
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <div className="text-center">
                        <div className="font-bold mb-1">{v.name}</div>
                        <div className="text-[9px] opacity-60">
                            {new Date(v.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </button>
            );
          })}
          {(selectedCanvas?.versiones || []).length < 5 && (
            <button
                type="button"
                onClick={handleAddVersion}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50 flex flex-col items-center justify-center gap-2 transition-colors"
                title="Añadir versión (máx 5)"
                disabled={readOnly}
            >
                <Plus size={24} />
                <span className="text-[10px] font-bold">NUEVA</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const lienzoRight = (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2">
        {toolButton('brush', 'Pincel', Pencil)}
        {toolButton('eraser', 'Borrador', Eraser)}
        <button 
            type="button" 
            onClick={undo}
            disabled={history.past.length === 0}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" 
            title="Deshacer (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button 
            type="button" 
            onClick={redo}
            disabled={history.future.length === 0}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" 
            title="Rehacer (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>
      </div>
      <div className="flex items-center rounded-xl bg-gray-100 p-1">
        <button type="button" onClick={() => setZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} className="p-2 rounded-lg text-gray-700 hover:bg-white" title="Zoom -">
          <ZoomOut size={16} />
        </button>
        <div className="px-2 text-[11px] font-mono text-gray-600 w-14 text-center">{Math.round(zoom * 100)}%</div>
        <button type="button" onClick={() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))} className="p-2 rounded-lg text-gray-700 hover:bg-white" title="Zoom +">
          <ZoomIn size={16} />
        </button>
      </div>
      <button type="button" onClick={fitCanvasToViewport} className="p-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50" title="Ajustar (base)">
        <Maximize2 size={16} />
      </button>
    </div>
  );

  return (
    <div className="h-full p-4 bg-gray-100 overflow-hidden" onPointerDown={handlePointerDownOutsideViewport}>
      <div className="h-full grid gap-4 grid-cols-[280px_1fr_280px] min-h-0">
        
        {/* Columna Izquierda: Recursos y Etiquetas (50% / 50%) */}
        <div className="flex flex-col gap-4 h-full min-h-0">
          <PanelShell title="Recursos" right={leftTopRight} className="flex-1">
            {leftTopTab === 'recursos' ? resourcesBody : referenciasBody}
          </PanelShell>
          <PanelShell title="Etiquetas" className="flex-1">
            {etiquetasBody}
          </PanelShell>
        </div>

        {/* Columna Central: Lienzo (grande) y Versiones (pequeño) */}
        <div className="flex flex-col gap-4 h-full min-h-0">
          <PanelShell title="Lienzo" right={lienzoRight} className="flex-[3] min-h-0">
            {!selectedCanvas ? (
                <div className="h-full w-full bg-gray-50 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                    <div className="mb-4 p-4 bg-gray-100 rounded-full">
                        <Layers size={48} className="opacity-50" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-600 mb-2">No hay lienzo seleccionado</h3>
                    <p className="text-sm max-w-xs mb-6">Selecciona un lienzo de la lista o crea uno nuevo para empezar a dibujar.</p>
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-6 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        Crear Primer Lienzo
                    </button>
                </div>
            ) : (
            <div className="h-full w-full bg-gray-900 touch-none overflow-hidden relative">
                {/* Viewport */}
                <div 
                    ref={viewportRef}
                    className={`absolute inset-0 overflow-hidden touch-none ${
                        (tool === 'brush' || tool === 'eraser') 
                        ? 'cursor-none' 
                        : (tool === 'move' || tool === 'move_selection') 
                          ? 'cursor-move' 
                          : (tool === 'references')
                            ? 'cursor-default'
                            : 'cursor-crosshair'
                    }`}
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={(e) => {
                        handlePointerUp(e);
                        setIsHoveringCanvas(false);
                    }}
                    onPointerEnter={() => setIsHoveringCanvas(true)}
                    onDragOver={handleDragOverViewport}
                    onDrop={handleDropReference}
                >
                    {/* Content Container (Transformed) */}
                    <div
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: '0 0',
                            width: `${canvasWidth}px`, 
                            height: `${canvasHeight}px`,
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            marginLeft: `-${canvasWidth / 2}px`,
                            marginTop: `-${canvasHeight / 2}px`
                        }}
                    >
                         {/* Front References Layer (z-index high to be above strokes) */}
                         <div className="absolute inset-0 z-[500] pointer-events-none">
                            {pinnedRefsCanvas.filter(r => r.z !== 'back').map(renderReferenceItem)}
                         </div>
                         <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden touch-none h-full w-full">
                            <div 
                                ref={canvasContainerRef}
                                className="relative w-full h-full"
                                onContextMenu={showSelectionContextMenu}
                                style={{ backgroundColor: '#ffffff' }}
                            >
                                <div className="absolute inset-0 bg-white" />
                                {/* Back References Layer (z-index 5, below layers starting at 10) */}
                                <div className="absolute inset-0 z-[5] pointer-events-none">
                                    {pinnedRefsCanvas.filter(r => r.z === 'back').map(renderReferenceItem)}
                                </div>
                                {layers.map((layer, index) => (
                                    <canvas
                                        key={layer.id}
                                        ref={el => layerRefs.current[layer.id] = el}
                                        width={canvasWidth}
                                        height={canvasHeight}
                                        className="absolute inset-0 pointer-events-none"
                                        style={{ 
                                            zIndex: index + 10,
                                            opacity: layer.visible ? layer.opacity : 0,
                                            visibility: layer.visible ? 'visible' : 'hidden'
                                        }}
                                    />
                                ))}
                                {/* Temp Canvas for Shapes/Previews */}
                                <canvas
                                    ref={tempCanvasRef}
                                    width={canvasWidth}
                                    height={canvasHeight}
                                    className="absolute inset-0 pointer-events-none"
                                    style={{ zIndex: 100 }}
                                />
                            </div>
                         </div>
                    </div>
                </div>
                {/* Info Overlay */}
                <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 pointer-events-none select-none z-[800]">
                  Seleccionado: <span className="font-semibold text-gray-700">{selectedCanvas?.nombres_de_lienzos || '—'}</span> · Herramienta: <span className="font-semibold text-gray-700">{tool}</span> · Zoom: {Math.round(zoom * 100)}%
                </div>

                {/* Brush Cursor Overlay */}
                <div
                    ref={cursorRef}
                    className={`absolute top-0 left-0 pointer-events-none border shadow-sm transition-opacity duration-75 z-[900] ${activePreset.cap === 'square' ? 'rounded-md' : 'rounded-full'}`}
                    style={{
                        width: `${Math.max(1, activeSettings.size) * zoom}px`,
                        height: `${Math.max(1, activeSettings.size) * zoom}px`,
                        opacity: isHoveringCanvas && (tool === 'brush' || tool === 'eraser') ? 1 : 0,
                        borderColor: tool === 'eraser' ? '#000' : brushColor,
                        borderWidth: '1.5px',
                        backgroundColor: tool === 'eraser' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                        transform: 'translate(-50%, -50%)'
                    }}
                />
                {contextMenu.open && (
                    <div
                        className="absolute z-[1000] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
                        style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                    >
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            Deseleccionar
                        </button>
                        <button
                            type="button"
                            onClick={invertSelection}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            Invertir Selección
                        </button>
                    </div>
                )}
                {refContextMenu.open && (
                    <div
                        className="absolute z-[1000] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
                        style={{ left: `${refContextMenu.x}px`, top: `${refContextMenu.y}px` }}
                    >
                        <button
                            type="button"
                            onClick={() => deleteReference(refContextMenu.refId)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            Eliminar
                        </button>
                        <button
                            type="button"
                            onClick={() => sendReferenceToBack(refContextMenu.refId)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            Enviar al fondo
                        </button>
                        <button
                            type="button"
                            onClick={() => sendReferenceToFront(refContextMenu.refId)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            Enviar al frente
                        </button>
                    </div>
                )}
            </div>
            )}
          </PanelShell>
          <PanelShell title="Versiones" className="flex-1 min-h-0">
            {versionesBody}
          </PanelShell>
        </div>

        {/* Columna Derecha: Herramientas y Capas (50% / 50%) */}
        <div className="flex flex-col gap-4 h-full min-h-0">
          <PanelShell title="Herramientas" className="flex-1">
            {herramientasBody}
          </PanelShell>
          <PanelShell title="Capas" right={rightBottomRight} className="flex-1">
            {rightBottomTab === 'capas' ? capasBody : registroBody}
          </PanelShell>
        </div>

      </div>

      {tagModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setTagModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">
                {tagModalParent ? 'Nueva Sub-etiqueta' : 'Nueva Etiqueta'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
                {tagModalParent 
                    ? `Creando dentro de "${tagModalParent}"` 
                    : 'Crea una nueva carpeta para organizar tus lienzos.'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nombre</label>
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') saveNewTag();
                      if (e.key === 'Escape') setTagModalOpen(false);
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                  placeholder="Ej: Personajes"
                  autoFocus
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setTagModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveNewTag}
                className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-70"
                disabled={!newTagName.trim()}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreateModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">Crear Lienzo</h3>
            <p className="text-sm text-gray-500 mb-4">Crea tu primer lienzo para empezar a dibujar.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nombre</label>
                <input
                  value={newCanvasName}
                  onChange={(e) => setNewCanvasName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                  placeholder="Ej: Castillo - Fondo"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Relación de Aspecto</label>
                    <select
                        value={newAspectRatio}
                        onChange={(e) => {
                            const r = e.target.value;
                            setNewAspectRatio(r);
                            const preset = ASPECT_RATIOS[r].presets.find(p => p.label.includes('1080')) || ASPECT_RATIOS[r].presets[0];
                            setNewResolution({ width: preset.w, height: preset.h });
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 text-sm"
                    >
                        {Object.entries(ASPECT_RATIOS).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Resolución</label>
                    <select
                        value={`${newResolution.width}x${newResolution.height}`}
                        onChange={(e) => {
                            const [w, h] = e.target.value.split('x').map(Number);
                            setNewResolution({ width: w, height: h });
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 text-sm"
                    >
                        {ASPECT_RATIOS[newAspectRatio].presets.map(p => (
                            <option key={`${p.w}x${p.h}`} value={`${p.w}x${p.h}`}>
                                {p.w} x {p.h} ({p.label})
                            </option>
                        ))}
                    </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Etiqueta (opcional)</label>
                {/* Tag Selection UI */}
                <div className="space-y-2">
                    {/* Predefined Chips */}
                    <div className="flex flex-wrap gap-1.5">
                        {tagPaths.slice(0, 8).map(tag => (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                    const val = tag.includes('/') ? tag.split('/').pop() : tag;
                                    setSelectedTagPath(tag + ',');
                                    document.getElementById('tag-input')?.focus();
                                }}
                                className="px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-600 hover:bg-purple-50 hover:text-purple-700 border border-transparent hover:border-purple-200 transition-colors"
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                    
                    <input
                      id="tag-input"
                      value={selectedTagPath}
                      onChange={(e) => setSelectedTagPath(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                      placeholder="Ej: fondos, castillo (crea fondos/castillo)"
                    />
                    <p className="text-[10px] text-gray-400">
                        Usa coma (,) para crear sub-etiquetas. Ej: "Fondos, Nivel 1" creará la etiqueta "Fondos/Nivel 1".
                    </p>
                </div>
              </div>
              {dbError && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
                  {dbError.message || 'Error creando lienzo.'}
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={insertNewCanvas}
                className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-70"
                disabled={creating || !newCanvasName.trim() || !canCreate}
              >
                {creating ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtTab;
