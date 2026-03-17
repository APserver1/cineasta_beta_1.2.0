import { useState, useEffect, useRef, useMemo } from 'react';
import { ZoomIn, ZoomOut, Plus, Trash2, ChevronLeft, ChevronRight, PenTool, Eraser, Move, Layers, Eye, EyeOff, Film, Volume2, Clock, Play, Pause, Repeat, Pencil, Brush, Highlighter, SprayCan, Undo, Copy, Music, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// Constants for Script Elements (copied from GuionTab)
const ELEMENT_TYPES = {
    SCENE: 'scene',
    ACTION: 'action',
    CHARACTER: 'character',
    PARENTHETICAL: 'parenthetical',
    DIALOGUE: 'dialogue',
    SHOT: 'shot',
    TRANSITION: 'transition',
    NOTE: 'note'
};

const ELEMENT_STYLES = {
    [ELEMENT_TYPES.SCENE]: "uppercase font-bold text-left mb-4 mt-6 tracking-wider",
    [ELEMENT_TYPES.ACTION]: "text-left mb-2",
    [ELEMENT_TYPES.CHARACTER]: "uppercase text-center font-bold mt-4 mb-0 mx-auto w-2/3 tracking-wide",
    [ELEMENT_TYPES.PARENTHETICAL]: "text-center text-sm mb-0 mx-auto w-1/2 italic",
    [ELEMENT_TYPES.DIALOGUE]: "text-center mb-2 mx-auto w-3/4",
    [ELEMENT_TYPES.SHOT]: "uppercase text-left font-bold mb-4 mt-4 tracking-wider",
    [ELEMENT_TYPES.TRANSITION]: "uppercase text-right mb-4 mt-4 font-bold text-sm",
    [ELEMENT_TYPES.NOTE]: "text-left bg-yellow-100 p-2 text-sm text-gray-600 mb-2 border-l-4 border-yellow-400 italic"
};

// Brush Presets
const BRUSH_PRESETS = {
    pencil: { name: 'Lápiz Grafito', width: 2, color: '#4b5563', alpha: 0.8, lineCap: 'round', shadowBlur: 0 },
    pen: { name: 'Estilógrafo', width: 1.5, color: '#000000', alpha: 1, lineCap: 'butt', shadowBlur: 0 },
    marker: { name: 'Marcador', width: 8, color: '#1f2937', alpha: 0.7, lineCap: 'round', shadowBlur: 0 },
    thick: { name: 'Pincel Grueso', width: 15, color: '#000000', alpha: 0.9, lineCap: 'round', shadowBlur: 2 },
    highlighter: { name: 'Resaltador', width: 20, color: '#fde047', alpha: 0.3, lineCap: 'square', shadowBlur: 0 },
    spray: { name: 'Spray', width: 25, color: '#000000', alpha: 0.4, lineCap: 'round', shadowBlur: 15, shadowColor: '#000000' },
    eraser: { name: 'Borrador', width: 20, composite: 'destination-out' },
    soft_eraser: { name: 'Borrador Suave', width: 30, composite: 'destination-out', shadowBlur: 10, shadowColor: '#ffffff' }
};

const ScriptViewer = ({ pages }) => {
    const [zoom, setZoom] = useState(0.55); // Default zoom smaller for the side panel

    if (!pages || pages.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 p-4 text-center text-sm">
                No hay contenido en el guion.
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-100 border-l border-gray-300">
            {/* Header / Zoom Controls */}
            <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Guion (Referencia)</span>
                <div className="flex items-center bg-gray-100 rounded-md">
                    <button 
                        onClick={() => setZoom(prev => Math.max(prev - 0.05, 0.3))} 
                        className="p-1 hover:bg-gray-200 rounded-l-md text-gray-600"
                    >
                        <ZoomOut size={14} />
                    </button>
                    <span className="px-2 text-[10px] font-mono text-gray-500">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button 
                        onClick={() => setZoom(prev => Math.min(prev + 0.05, 1.5))} 
                        className="p-1 hover:bg-gray-200 rounded-r-md text-gray-600"
                    >
                        <ZoomIn size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                <div 
                    className="flex flex-col items-center gap-4 origin-top"
                    style={{ zoom: zoom }}
                >
                    {pages.map((page, index) => (
                        <div key={page.id || index} className="bg-white shadow-md p-[25mm] min-h-[297mm] w-[210mm] relative">
                            {/* Page Number */}
                            <div className="absolute top-8 right-10 text-gray-300 font-mono text-xs select-none">
                                {index + 1}.
                            </div>
                            
                            <div className="text-gray-900 text-[12pt] font-mono leading-normal">
                                {page.elements && page.elements.map((element, i) => (
                                    <div key={element.id || i} className={`${ELEMENT_STYLES[element.type] || ''} whitespace-pre-wrap`}>
                                        {element.content}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Canvas Component
const StoryboardCanvas = ({ frame, onUpdate, tool, brushSize, brushOpacity, brushColor, activeLayerId, onStartDrawing }) => {
    const containerRef = useRef(null);
    const viewportRef = useRef(null);
    const tempCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPos = useRef({ x: 0, y: 0, pressure: 0 });
    const points = useRef([]); // Buffer for smoothing
    const [cursorPos, setCursorPos] = useState(null); // {x, y}
    const [canvasScale, setCanvasScale] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const zoomRef = useRef(1);
    const panRef = useRef({ x: 0, y: 0 });
    const isDrawingRef = useRef(false);

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => {
        panRef.current = pan;
    }, [pan]);

    useEffect(() => {
        isDrawingRef.current = isDrawing;
    }, [isDrawing]);

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        const handleWheel = (e) => {
            if (isDrawingRef.current) return;
            e.preventDefault();

            const containerRect = containerRef.current?.getBoundingClientRect();
            if (!containerRect) return;

            const cx = e.clientX - containerRect.left;
            const cy = e.clientY - containerRect.top;

            const prevZoom = zoomRef.current;
            const prevPan = panRef.current;

            const factor = Math.exp(-e.deltaY * 0.0015);
            const nextZoomRaw = prevZoom * factor;
            const nextZoom = Math.min(6, Math.max(0.2, nextZoomRaw));

            if (nextZoom === prevZoom) return;

            const contentX = (cx - prevPan.x) / prevZoom;
            const contentY = (cy - prevPan.y) / prevZoom;

            const nextPan = {
                x: cx - contentX * nextZoom,
                y: cy - contentY * nextZoom
            };

            setZoom(nextZoom);
            setPan(nextPan);
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);
    
    // Ensure layers exist (Migration / Initialization)
    const layers = frame.layers || (frame.drawing ? [{ id: 'default', name: 'Capa 1', visible: true, data: frame.drawing }] : [{ id: 'default', name: 'Capa 1', visible: true, data: null }]);

    // Find active layer object
    const activeLayer = layers.find(l => l.id === activeLayerId) || layers[layers.length - 1];

    // Helper to update a specific layer (internal for drawing)
    const updateLayerData = (layerId, newData) => {
        const newLayers = layers.map(l => 
            l.id === layerId ? { ...l, ...newData } : l
        );
        onUpdate({ layers: newLayers });
    };

    // Drawing Logic
    const startDrawing = (e) => {
        if (!activeLayer?.visible) return; // Can't draw on invisible layer
        
        // Notify parent to save history state
        if (onStartDrawing) onStartDrawing();
        
        // Prevent default to stop scrolling/selection
        e.preventDefault();
        
        const canvas = tool === 'eraser' 
            ? containerRef.current?.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`)
            : tempCanvasRef.current;

        if (!canvas) return;

        const viewportRect = viewportRef.current?.getBoundingClientRect();
        if (!viewportRect) return;

        const x = (e.clientX - viewportRect.left) * (canvas.width / viewportRect.width);
        const y = (e.clientY - viewportRect.top) * (canvas.height / viewportRect.height);
        
        lastPos.current = { x, y, pressure: e.pressure };
        points.current = [{ x, y, pressure: e.pressure }]; // Reset buffer
        setIsDrawing(true);
        
        // Draw initial point (dot)
        const ctx = canvas.getContext('2d');
        const settings = BRUSH_PRESETS[tool] || BRUSH_PRESETS.pencil;
        const effectivePressure = e.pointerType !== 'mouse' ? e.pressure : 1.0;
        const width = (brushSize || settings.width) * Math.pow(effectivePressure, 2);

        ctx.beginPath();
        ctx.arc(x, y, width / 2, 0, Math.PI * 2);
        
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = brushColor || settings.color;
            // Draw fully opaque on temp canvas to avoid overlaps
            ctx.globalAlpha = 1; 
        }
        ctx.fill();
    };

    const draw = (e) => {
        // Update Cursor Position
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCursorPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
            setCanvasScale(rect.width / 1280);
        }

        if (!isDrawing) return;
        e.preventDefault();

        const canvas = tool === 'eraser' 
            ? containerRef.current?.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`)
            : tempCanvasRef.current;
            
        if (!canvas) return;

        const viewportRect = viewportRef.current?.getBoundingClientRect();
        if (!viewportRect) return;

        const scaleX = canvas.width / viewportRect.width;
        const scaleY = canvas.height / viewportRect.height;

        // Get coalesced events for high-precision input (tablets)
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

        events.forEach(event => {
            const x = (event.clientX - viewportRect.left) * scaleX;
            const y = (event.clientY - viewportRect.top) * scaleY;
            const pressure = event.pointerType !== 'mouse' ? event.pressure : 1.0;

            // Push new point
            points.current.push({ x, y, pressure });

            // Need at least 3 points for quadratic curve
            if (points.current.length >= 3) {
                const lastTwo = points.current.slice(-3);
                const p0 = lastTwo[0];
                const p1 = lastTwo[1];
                const p2 = lastTwo[2];

                const mid1 = { 
                    x: (p0.x + p1.x) / 2, 
                    y: (p0.y + p1.y) / 2,
                    pressure: (p0.pressure + p1.pressure) / 2
                };
                const mid2 = { 
                    x: (p1.x + p2.x) / 2, 
                    y: (p1.y + p2.y) / 2,
                    pressure: (p1.pressure + p2.pressure) / 2
                };

                drawQuadraticSegment(canvas, mid1, p1, mid2, tool, brushSize);
            }
        });
    };

    const drawQuadraticSegment = (canvas, start, control, end, tool, brushSize) => {
        const ctx = canvas.getContext('2d');
        const settings = BRUSH_PRESETS[tool] || BRUSH_PRESETS.pencil;
        const baseWidth = brushSize || settings.width;
        
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = '#000000';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = brushColor || settings.color;
            ctx.globalAlpha = 1; // Draw opaque on temp canvas
            ctx.shadowBlur = settings.shadowBlur || 0;
            ctx.shadowColor = settings.shadowColor || brushColor || settings.color;
        }

        const dist = Math.hypot(control.x - start.x, control.y - start.y) + 
                     Math.hypot(end.x - control.x, end.y - control.y);
        const steps = Math.max(Math.ceil(dist * 2), 1);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            const tt = t * t;
            const u = 1 - t;
            const uu = u * u;
            
            const x = uu * start.x + 2 * u * t * control.x + tt * end.x;
            const y = uu * start.y + 2 * u * t * control.y + tt * end.y;

            const currentPressure = start.pressure + (end.pressure - start.pressure) * t;
            
            const radius = (baseWidth * Math.pow(currentPressure, 2)) / 2;

            if (radius < 0.1) continue;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            points.current = []; // Clear buffer

            // If we were using temp canvas, commit to layer
            if (tool !== 'eraser' && tempCanvasRef.current) {
                const layerCanvas = containerRef.current?.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`);
                if (layerCanvas) {
                    const ctx = layerCanvas.getContext('2d');
                    const tempCtx = tempCanvasRef.current.getContext('2d');
                    const settings = BRUSH_PRESETS[tool] || BRUSH_PRESETS.pencil;
                    
                    // Commit with correct opacity
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = (settings.alpha || 1) * brushOpacity;
                    ctx.drawImage(tempCanvasRef.current, 0, 0);
                    
                    // Clear temp
                    tempCtx.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height);
                    
                    // Trigger save
                    updateLayerData(activeLayer.id, { data: layerCanvas.toDataURL() });
                }
            } else if (tool === 'eraser') {
                // Eraser works directly on layer, just save
                const layerCanvas = containerRef.current?.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`);
                if (layerCanvas) {
                    updateLayerData(activeLayer.id, { data: layerCanvas.toDataURL() });
                }
            }
        }
    };

    const settings = BRUSH_PRESETS[tool] || BRUSH_PRESETS.pencil;
    const currentOpacity = (settings.alpha || 1) * brushOpacity;

    return (
        <div className="relative w-full h-full" ref={containerRef} onPointerLeave={() => { stopDrawing(); setCursorPos(null); }}>
            {/* Custom Brush Cursor */}
            {cursorPos && (
                <div 
                    className="absolute rounded-full pointer-events-none z-50 border border-gray-500 bg-white/10 mix-blend-difference"
                    style={{
                        left: cursorPos.x,
                        top: cursorPos.y,
                        width: brushSize * canvasScale * zoom,
                        height: brushSize * canvasScale * zoom,
                        transform: 'translate(-50%, -50%)',
                        borderColor: tool === 'eraser' ? 'white' : 'gray'
                    }}
                />
            )}

            {/* Canvases Stack */}
            <div 
                ref={viewportRef}
                className={`relative w-full h-full overflow-hidden touch-none ${cursorPos ? 'cursor-none' : 'cursor-crosshair'}`}
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0'
                }}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
            >
                {/* Visual Border for Canvas Bounds */}
                <div className="absolute inset-0 border border-gray-300 pointer-events-none z-50 shadow-sm" />

                {/* White Background */}
                <div className="absolute inset-0 bg-white pointer-events-none" />

                {layers.map((layer) => (
                    <LayerCanvas 
                        key={layer.id} 
                        layer={layer} 
                        isActive={layer.id === activeLayerId}
                    />
                ))}

                <canvas 
                    ref={tempCanvasRef}
                    width={1280}
                    height={720}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ 
                        zIndex: 100, 
                        opacity: tool === 'eraser' ? 1 : currentOpacity 
                    }}
                />
            </div>
        </div>
    );
};

// Individual Layer Canvas Component
const LayerCanvas = ({ layer, isActive }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Reset context to ensure clean draw
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        
        if (layer.data) {
            const img = new Image();
            img.onload = () => {
                // Ensure context settings are correct for drawing image
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
                
                // Clear ONLY when we are ready to draw the new frame to prevent flickering
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = layer.data;
        } else {
            // If no data, clear immediately
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [layer.data]); // Redraw when data changes

    return (
        <canvas 
            ref={canvasRef}
            data-layer-id={layer.id}
            width={1280}
            height={720}
            className={`absolute inset-0 w-full h-full ${!layer.visible ? 'opacity-0 pointer-events-none' : ''}`}
            style={{ zIndex: layer.visible ? 1 : 0 }} 
        />
    );
};

const StoryboardTab = ({ project, onUpdateProject }) => {
    const pages = project?.guion_data?.pages || [];
    
    // Storyboard State
    const [frames, setFrames] = useState(project?.storyboard_data?.frames || []);
    const [dialogues, setDialogues] = useState(project?.storyboard_data?.dialogues || []);
    const [audioTracks, setAudioTracks] = useState(project?.storyboard_data?.audioTracks || []);
    const [activeFrameIndex, setActiveFrameIndex] = useState(0);
    const [activeElement, setActiveElement] = useState({ type: 'frame', id: null }); // { type: 'frame' | 'dialogue', id: string }
    const [saving, setSaving] = useState(false);
    
    // Zoom / Timeline State
    const [pixelsPerSecond, setPixelsPerSecond] = useState(50); // Default 50px per second (Time-based scaling)
    const [currentTime, setCurrentTime] = useState(0); // Current playback time in ms
    const [isDraggingRuler, setIsDraggingRuler] = useState(false);
    const [lastMouseX, setLastMouseX] = useState(null);

    // Dialogue Dragging
    const [draggingDialogueId, setDraggingDialogueId] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    
    // Audio Upload
    const fileInputRef = useRef(null);
    const audioInstances = useRef({}); // Map: trackId -> Audio Object

    const handleUploadAudio = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file type
        if (!file.type.startsWith('audio/')) {
            alert('Por favor selecciona un archivo de audio válido.');
            return;
        }

        const audio = new Audio(URL.createObjectURL(file));
        audio.onloadedmetadata = async () => {
            if (audio.duration > 120) {
                alert('El audio no puede durar más de 2 minutos.');
                return;
            }
            
            setSaving(true);
            try {
                const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
                const { data, error } = await supabase.storage
                    .from('project_assets')
                    .upload(fileName, file);

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage
                    .from('project_assets')
                    .getPublicUrl(fileName);

                const newAudioTrack = {
                    id: crypto.randomUUID(),
                    name: file.name,
                    url: publicUrl,
                    duration: audio.duration * 1000,
                    startTime: currentTime, // Add at current playhead position
                    volume: 1.0
                };

                setAudioTracks(prev => [...prev, newAudioTrack]);
                // Trigger save implicitly by effect or explicit call? 
                // saveData uses current state, which won't be updated yet here.
                // We should rely on auto-save or call saveData with new data.
                // Since saveData reads from state, we can't call it immediately.
                // But typically we have an effect for auto-save or we wait.
                // I will let the user click save or rely on future auto-save if implemented.
                // But wait, saveData in this component reads from STATE variables (frames, dialogues, audioTracks).
                // So calling it here will save OLD state.
                // I'll just set state. The user can click save.
            } catch (error) {
                console.error('Error uploading audio:', error);
                alert('Error al subir el audio.');
            } finally {
                setSaving(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
    };

    const handleDialogueMouseDown = (e, dialogue) => {
        e.stopPropagation();
        setDraggingDialogueId(dialogue.id);
        setActiveElement({ type: 'dialogue', id: dialogue.id });
        setDragOffset({ x: e.clientX, y: e.clientY });
    };

    const handleDialogueMouseMove = (e) => {
        if (!draggingDialogueId) return;
        
        const deltaX = e.clientX - dragOffset.x;
        const deltaY = e.clientY - dragOffset.y;
        
        setDragOffset({ x: e.clientX, y: e.clientY });

        const container = document.getElementById('main-canvas-container');
        if (container) {
             const rect = container.getBoundingClientRect();
             const scaleX = 1280 / rect.width;
             const scaleY = 720 / rect.height;
             
             setDialogues(prev => prev.map(d => {
                 if (d.id === draggingDialogueId) {
                     return {
                         ...d,
                         x: d.x + (deltaX * scaleX),
                         y: d.y + (deltaY * scaleY)
                     };
                 }
                 return d;
             }));
        }
    };

    const handleDialogueMouseUp = () => {
        setDraggingDialogueId(null);
    };

    useEffect(() => {
        if (draggingDialogueId) {
            window.addEventListener('mousemove', handleDialogueMouseMove);
            window.addEventListener('mouseup', handleDialogueMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleDialogueMouseMove);
            window.removeEventListener('mouseup', handleDialogueMouseUp);
        };
    }, [draggingDialogueId, dragOffset]);

    // Tool & Layer State (Lifted Up)
    const [tool, setTool] = useState('pen'); // 'pen', 'eraser'
    const [brushSize, setBrushSize] = useState(BRUSH_PRESETS.pen.width);
    const [brushOpacity, setBrushOpacity] = useState(1);
    const [brushColor, setBrushColor] = useState('#000000');
    const [activeLayerId, setActiveLayerId] = useState(null);
    const [showLayerMenu, setShowLayerMenu] = useState(false);

    // Undo History
    const [history, setHistory] = useState([]);
    
    // Add current state to history before modifying
    const pushToHistory = () => {
        // Deep copy of frames to avoid reference issues
        // Limit history to 20 steps
        setHistory(prev => {
            const newHistory = [...prev, JSON.parse(JSON.stringify(frames))];
            if (newHistory.length > 20) newHistory.shift();
            return newHistory;
        });
    };

    const undo = () => {
        if (history.length === 0) return;
        
        const previousFrames = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        
        setHistory(newHistory);
        setFrames(previousFrames);
    };

    // Handle Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if input/textarea is active
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }

            // Duplicate: Ctrl+D
            if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                const target = activeElement.type === 'dialogue' && activeElement.id
                    ? { type: 'dialogue', id: activeElement.id }
                    : { type: 'frame', id: activeFrameIndex };
                handleDuplicateElement(target);
            }

            // Delete: Ctrl+E (As requested)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
                e.preventDefault();
                const target = activeElement.type === 'dialogue' && activeElement.id
                    ? { type: 'dialogue', id: activeElement.id }
                    : { type: 'frame', id: activeFrameIndex };
                handleDeleteElement(target);
            }

            // Play/Pause: Space
            if (e.code === 'Space') {
                e.preventDefault();
                setIsPlaying(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, frames, dialogues, activeElement, activeFrameIndex]);

    // Update brush size when tool changes
    useEffect(() => {
        if (BRUSH_PRESETS[tool]) {
            setBrushSize(BRUSH_PRESETS[tool].width);
        }
    }, [tool]);

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);

    // Helper: Get start time of a frame
    const getFrameStartTime = (index) => {
        return frames.slice(0, index).reduce((acc, f) => acc + (f.duration || 1000), 0);
    };

    // Helper: Get frame index from time
    const getFrameIndexFromTime = (time) => {
        let accumulated = 0;
        for (let i = 0; i < frames.length; i++) {
            const duration = frames[i].duration || 1000;
            if (time < accumulated + duration) return i;
            accumulated += duration;
        }
        return Math.max(0, frames.length - 1);
    };

    // Sync currentTime when activeFrameIndex changes manually (and not playing)
    useEffect(() => {
        if (!isPlaying) {
            setCurrentTime(getFrameStartTime(activeFrameIndex));
        }
    }, [activeFrameIndex]);

    // Playback Logic (Time-based)
    useEffect(() => {
        let animationFrameId;
        
        if (isPlaying) {
            let startTimestamp = Date.now();
            let initialTime = currentTime;
            const totalDuration = frames.reduce((acc, f) => acc + (f.duration || 1000), 0);

            // If starting from end, reset to 0
            if (initialTime >= totalDuration) {
                initialTime = 0;
                setCurrentTime(0);
                setActiveFrameIndex(0);
            }

            const loop = () => {
                const now = Date.now();
                const delta = now - startTimestamp;
                let newTime = initialTime + delta;

                if (newTime >= totalDuration) {
                    if (isLooping) {
                        newTime = newTime % totalDuration;
                        startTimestamp = now;
                        initialTime = newTime;
                    } else {
                        newTime = totalDuration;
                        setIsPlaying(false);
                        setCurrentTime(newTime);
                        // Ensure we show the last frame
                        setActiveFrameIndex(frames.length - 1);
                        return;
                    }
                }

                setCurrentTime(newTime);
                
                // Sync Active Frame
                const newIndex = getFrameIndexFromTime(newTime);
                setActiveFrameIndex(prev => {
                    if (prev !== newIndex) return newIndex;
                    return prev;
                });

                animationFrameId = requestAnimationFrame(loop);
            };

            animationFrameId = requestAnimationFrame(loop);
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying, isLooping, frames]);

    // Initialize if empty
    useEffect(() => {
        if (frames.length === 0) {
            const initialFrame = { id: crypto.randomUUID(), drawing: null, order: 0, duration: 1000 };
            setFrames([initialFrame]);
        }
    }, []);

    // Active Frame and Layer Logic
    const activeFrame = frames[activeFrameIndex] || frames[0];
    const layers = activeFrame?.layers || (activeFrame?.drawing ? [{ id: 'default', name: 'Capa 1', visible: true, data: activeFrame.drawing }] : [{ id: 'default', name: 'Capa 1', visible: true, data: null }]);

    // Sync activeLayerId when changing frames
    useEffect(() => {
        // Only if we are editing frames
        if (activeElement.type !== 'frame') return;

        // If activeLayerId is not in current layers, reset to top layer
        if (!activeLayerId || !layers.find(l => l.id === activeLayerId)) {
            if (layers.length > 0) {
                setActiveLayerId(layers[layers.length - 1].id);
            }
        }
    }, [activeFrameIndex, layers, activeLayerId, activeElement]);

    // Save debouncer
    useEffect(() => {
        if (!project) return;
        const timer = setTimeout(() => {
            saveData();
        }, 2000);
        return () => clearTimeout(timer);
    }, [frames, dialogues, audioTracks]);

    const saveData = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('proyectos_cineasta')
                .update({ storyboard_data: { frames, dialogues, audioTracks } })
                .eq('id', project.id);

            if (error) throw error;
            if (onUpdateProject) {
                onUpdateProject({ storyboard_data: { frames, dialogues, audioTracks } });
            }
        } catch (error) {
            console.error('Error saving storyboard:', error);
        } finally {
            setSaving(false);
        }
    };

    const addFrame = (offset) => {
        // Get structure from current frame to maintain layer consistency
        const currentLayers = activeFrame?.layers || (activeFrame?.drawing ? [{ id: 'default', name: 'Capa 1', visible: true, data: activeFrame.drawing }] : [{ id: 'default', name: 'Capa 1', visible: true, data: null }]);
        
        // Create new layers with empty data but same structure
        const newLayers = currentLayers.map(l => ({
            ...l,
            data: null // Clear data for new frame
        }));

        const newFrame = { 
            id: crypto.randomUUID(), 
            layers: newLayers, 
            order: frames.length,
            duration: 1000
        };

        const newFrames = [...frames];
        const insertIndex = activeFrameIndex + offset;
        
        if (insertIndex < 0) {
            newFrames.unshift(newFrame);
            setActiveFrameIndex(0);
        } else if (insertIndex >= newFrames.length) {
            newFrames.push(newFrame);
            setActiveFrameIndex(newFrames.length - 1);
        } else {
            newFrames.splice(insertIndex, 0, newFrame);
            setActiveFrameIndex(insertIndex);
        }
        
        setFrames(newFrames);
    };

    const updateFrame = (data) => {
        const newFrames = [...frames];
        newFrames[activeFrameIndex] = { ...newFrames[activeFrameIndex], ...data };
        setFrames(newFrames);
    };

    const deleteFrame = () => {
        if (frames.length <= 1) return;
        if (!confirm('¿Estás seguro de eliminar este cuadro?')) return;
        
        const newFrames = frames.filter((_, i) => i !== activeFrameIndex);
        setFrames(newFrames);
        if (activeFrameIndex >= newFrames.length) {
            setActiveFrameIndex(newFrames.length - 1);
        }
    };

    // Dialogue Helpers
    const addDialogue = () => {
        // Calculate current time based on active frame
        let currentTime = 0;
        for (let i = 0; i < activeFrameIndex; i++) {
             currentTime += (frames[i].duration || 1000);
        }

        const newDialogue = {
            id: crypto.randomUUID(),
            text: 'Nuevo Diálogo',
            startTime: currentTime,
            duration: 2000,
            x: 640, // Center of 1280
            y: 600, // Bottom area
            fontSize: 24
        };

        setDialogues([...dialogues, newDialogue]);
        setActiveElement({ type: 'dialogue', id: newDialogue.id });
    };

    const updateDialogue = (id, data) => {
        setDialogues(dialogues.map(d => d.id === id ? { ...d, ...data } : d));
    };

    const deleteDialogue = (id) => {
        if (!confirm('¿Eliminar diálogo?')) return;
        setDialogues(dialogues.filter(d => d.id !== id));
        setActiveElement({ type: 'frame', id: null });
    };

    // Layer Helpers
    const updateLayer = (layerId, newData) => {
        const newLayers = layers.map(l => 
            l.id === layerId ? { ...l, ...newData } : l
        );
        updateFrame({ layers: newLayers });
    };

    const addLayer = () => {
        if (layers.length >= 5) return;
        
        const newLayerId = crypto.randomUUID();
        const newLayerName = `Capa ${layers.length + 1}`;

        // Add layer to ALL frames
        const newFrames = frames.map(frame => {
            // Normalize existing layers
            const frameLayers = frame.layers || (frame.drawing ? [{ id: 'default', name: 'Capa 1', visible: true, data: frame.drawing }] : [{ id: 'default', name: 'Capa 1', visible: true, data: null }]);
            
            const newLayerForFrame = {
                id: newLayerId, // Same ID across frames for consistency
                name: newLayerName,
                visible: true,
                data: null
            };
            
            return {
                ...frame,
                layers: [...frameLayers, newLayerForFrame]
            };
        });

        setFrames(newFrames);
        setActiveLayerId(newLayerId);
    };

    const deleteLayer = (layerId) => {
        if (layers.length <= 1) return;
        
        // Remove layer from ALL frames
        const newFrames = frames.map(frame => {
            const frameLayers = frame.layers || (frame.drawing ? [{ id: 'default', name: 'Capa 1', visible: true, data: frame.drawing }] : [{ id: 'default', name: 'Capa 1', visible: true, data: null }]);
            
            return {
                ...frame,
                layers: frameLayers.filter(l => l.id !== layerId)
            };
        });

        setFrames(newFrames);
    };

    const toggleVisibility = (layerId) => {
        const layer = layers.find(l => l.id === layerId);
        updateLayer(layerId, { visible: !layer.visible });
    };

    // Ruler Drag Handling
    const handleRulerMouseDown = (e) => {
        setIsDraggingRuler(true);
        setLastMouseX(e.clientX);
    };

    // Playhead Drag Handling
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    
    const handlePlayheadMouseDown = (e) => {
        e.stopPropagation();
        setIsDraggingPlayhead(true);
    };

    // Timeline Dragging States
    const [draggingTimelineDialogue, setDraggingTimelineDialogue] = useState(null); // { id, startX, initialStartTime }
    const [draggingAudio, setDraggingAudio] = useState(null); // { id, startX, initialStartTime }
    const [draggingFrameIndex, setDraggingFrameIndex] = useState(null);
    const [dropTargetIndex, setDropTargetIndex] = useState(null);

    // Timeline Resizing States
    const [resizingTarget, setResizingTarget] = useState(null); // { type, id/index, edge, startX, initialDuration, initialStartTime }

    const handleResizeMouseDown = (e, type, id, edge, initialDuration, initialStartTime = 0) => {
        e.stopPropagation();
        setResizingTarget({
            type,
            id,
            edge,
            startX: e.clientX,
            initialDuration,
            initialStartTime
        });
    };

    const handleTimelineDialogueMouseDown = (e, dialogue) => {
        e.stopPropagation();
        setDraggingTimelineDialogue({
            id: dialogue.id,
            startX: e.clientX,
            initialStartTime: dialogue.startTime
        });
        setActiveElement({ type: 'dialogue', id: dialogue.id });
    };

    const handleAudioMouseDown = (e, audio) => {
        e.stopPropagation();
        setDraggingAudio({
            id: audio.id,
            startX: e.clientX,
            initialStartTime: audio.startTime
        });
        // We can reuse 'activeElement' but type='audio'
        setActiveElement({ type: 'audio', id: audio.id });
    };

    const handleFrameMouseDown = (e, index) => {
        e.stopPropagation();
        setDraggingFrameIndex(index);
        setActiveFrameIndex(index);
    };

    const handleFrameMouseEnter = (index) => {
        if (draggingFrameIndex !== null && draggingFrameIndex !== index) {
            setDropTargetIndex(index);
        }
    };

    const moveFrame = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        
        const newFrames = [...frames];
        const [movedFrame] = newFrames.splice(fromIndex, 1);
        newFrames.splice(toIndex, 0, movedFrame);
        
        setFrames(newFrames);
        setActiveFrameIndex(toIndex);
    };

    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null); // { visible: boolean, x: number, y: number, target: { type: 'frame'|'dialogue', id: string|number } }

    const handleContextMenu = (e, type, id) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            target: { type, id }
        });
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    // Context Menu Actions
    const handleDeleteElement = (targetOverride = null) => {
        const target = targetOverride || (contextMenu ? contextMenu.target : null);
        if (!target) return;
        
        pushToHistory();

        if (target.type === 'frame') {
            const index = target.id;
            setFrames(prev => prev.filter((_, i) => i !== index));
            // Adjust active frame if needed
            if (activeFrameIndex >= index && activeFrameIndex > 0) {
                setActiveFrameIndex(prev => prev - 1);
            }
        } else if (target.type === 'dialogue') {
            const id = target.id;
            setDialogues(prev => prev.filter(d => d.id !== id));
        }
        if (contextMenu) closeContextMenu();
    };

    const handleDuplicateElement = (targetOverride = null) => {
        const target = targetOverride || (contextMenu ? contextMenu.target : null);
        if (!target) return;

        pushToHistory();

        if (target.type === 'frame') {
            const index = target.id;
            const originalFrame = frames[index];
            if (!originalFrame) return;
            
            // Deep copy
            const newFrame = JSON.parse(JSON.stringify({
                ...originalFrame,
                id: crypto.randomUUID(), // Ensure unique ID
            }));

            setFrames(prev => {
                const newFrames = [...prev];
                newFrames.splice(index + 1, 0, newFrame);
                return newFrames;
            });

        } else if (target.type === 'dialogue') {
            const id = target.id;
            const originalDialogue = dialogues.find(d => d.id === id);
            if (!originalDialogue) return;

            const insertTime = originalDialogue.startTime + originalDialogue.duration;
            const shiftAmount = originalDialogue.duration;

            // Shift all dialogues that start >= insertTime
            setDialogues(prev => {
                const shiftedDialogues = prev.map(d => {
                    // Using a small tolerance for float comparison safety, though JS ints are usually fine here
                    if (d.startTime >= insertTime - 1) { 
                        return { ...d, startTime: d.startTime + shiftAmount };
                    }
                    return d;
                });

                const newDialogue = {
                    ...originalDialogue,
                    id: crypto.randomUUID(),
                    startTime: insertTime,
                    // text: originalDialogue.text // Keep same text
                };

                return [...shiftedDialogues, newDialogue];
            });
        }
        if (contextMenu) closeContextMenu();
    };

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => closeContextMenu();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e) => {
            // Ruler Dragging
            if (isDraggingRuler) {
                const deltaX = e.clientX - lastMouseX;
                setLastMouseX(e.clientX);
    
                setPixelsPerSecond(prev => {
                    const newWidth = prev + (deltaX * 0.5);
                    return Math.max(10, Math.min(200, newWidth)); // Min 10px/s, Max 200px/s
                });
            }

            // Timeline Resizing
            if (resizingTarget) {
                const totalDeltaX = e.clientX - resizingTarget.startX;
                const timeDelta = (totalDeltaX / pixelsPerSecond) * 1000;

                if (resizingTarget.type === 'dialogue') {
                    setDialogues(prev => prev.map(d => {
                        if (d.id !== resizingTarget.id) return d;

                        let newDuration, newStartTime;

                        if (resizingTarget.edge === 'right') {
                            newDuration = Math.max(500, resizingTarget.initialDuration + timeDelta);
                            return { ...d, duration: newDuration };
                        } else {
                            // Left edge: Start time changes, Duration changes (inverse)
                            newDuration = resizingTarget.initialDuration - timeDelta;
                            newStartTime = resizingTarget.initialStartTime + timeDelta;

                            if (newDuration < 500) {
                                newDuration = 500;
                                newStartTime = resizingTarget.initialStartTime + (resizingTarget.initialDuration - 500);
                            }
                            return { ...d, startTime: newStartTime, duration: newDuration };
                        }
                    }));
                } else if (resizingTarget.type === 'audio') {
                    setAudioTracks(prev => prev.map(a => {
                        if (a.id !== resizingTarget.id) return a;
                        // Right edge only for now (duration)
                        const newDuration = Math.max(1000, resizingTarget.initialDuration + timeDelta);
                        return { ...a, duration: newDuration };
                    }));
                } else if (resizingTarget.type === 'frame') {
                    setFrames(prev => {
                        const newFrames = [...prev];
                        const index = resizingTarget.id;
                        
                        // We are always resizing the duration of frame[index] here
                        // (Left edge clicks on Frame i were converted to Right edge clicks on Frame i-1)
                        const newDuration = Math.max(500, resizingTarget.initialDuration + timeDelta);
                        
                        if (newFrames[index]) {
                            newFrames[index] = { ...newFrames[index], duration: newDuration };
                        }
                        return newFrames;
                    });
                }
                return; // Skip other drags if resizing
            }

            // Playhead Dragging
            if (isDraggingPlayhead) {
                const tracksArea = document.getElementById('timeline-tracks-area');
                if (!tracksArea) return;
                const rect = tracksArea.getBoundingClientRect();
                const scrollLeft = tracksArea.scrollLeft;
                const x = e.clientX - rect.left + scrollLeft;
                const newTime = (x / pixelsPerSecond) * 1000;
                setCurrentTime(Math.max(0, newTime));
            }

            // Timeline Dialogue Dragging
            if (draggingTimelineDialogue) {
                const deltaX = e.clientX - draggingTimelineDialogue.startX;
                const deltaTime = (deltaX / pixelsPerSecond) * 1000;
                const newStartTime = Math.max(0, draggingTimelineDialogue.initialStartTime + deltaTime);
                
                setDialogues(prev => prev.map(d => 
                    d.id === draggingTimelineDialogue.id 
                    ? { ...d, startTime: newStartTime } 
                    : d
                ));
            }

            // Audio Dragging
            if (draggingAudio) {
                const deltaX = e.clientX - draggingAudio.startX;
                const deltaTime = (deltaX / pixelsPerSecond) * 1000;
                const newStartTime = Math.max(0, draggingAudio.initialStartTime + deltaTime);
                
                setAudioTracks(prev => prev.map(a => 
                    a.id === draggingAudio.id 
                    ? { ...a, startTime: newStartTime } 
                    : a
                ));
            }
        };

        const handleMouseUp = () => {
            // Frame Reordering
            if (draggingFrameIndex !== null && dropTargetIndex !== null) {
                moveFrame(draggingFrameIndex, dropTargetIndex);
            }

            setIsDraggingRuler(false);
            setIsDraggingPlayhead(false);
            setDraggingTimelineDialogue(null);
            setDraggingAudio(null);
            setDraggingFrameIndex(null);
            setDropTargetIndex(null);
            setResizingTarget(null);
            setLastMouseX(null);
        };

        if (isDraggingRuler || isDraggingPlayhead || draggingTimelineDialogue || draggingAudio || draggingFrameIndex !== null || resizingTarget) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingRuler, isDraggingPlayhead, draggingTimelineDialogue, draggingAudio, draggingFrameIndex, dropTargetIndex, lastMouseX, pixelsPerSecond, frames, resizingTarget]);

    // Audio Playback Management
    useEffect(() => {
        // Cleanup function to stop all audio when component unmounts
        return () => {
            Object.values(audioInstances.current).forEach(audio => {
                audio.pause();
                audio.src = '';
            });
            audioInstances.current = {};
        };
    }, []);

    useEffect(() => {
        // Sync audio tracks
        audioTracks.forEach(track => {
            if (!audioInstances.current[track.id]) {
                const audio = new Audio(track.url);
                audio.volume = track.volume || 1.0;
                audioInstances.current[track.id] = audio;
            }
        });

        // Cleanup removed tracks
        Object.keys(audioInstances.current).forEach(trackId => {
            if (!audioTracks.find(t => t.id === trackId)) {
                audioInstances.current[trackId].pause();
                delete audioInstances.current[trackId];
            }
        });
    }, [audioTracks]);

    useEffect(() => {
        // Playback Loop
        if (isPlaying) {
            // Check which audios should be playing
            audioTracks.forEach(track => {
                const audio = audioInstances.current[track.id];
                if (!audio) return;

                const trackEndTime = track.startTime + track.duration;
                
                if (currentTime >= track.startTime && currentTime < trackEndTime) {
                    // Should be playing
                    if (audio.paused) {
                        audio.currentTime = (currentTime - track.startTime) / 1000;
                        audio.play().catch(e => console.error("Audio play failed", e));
                    } else {
                        // Sync check (if drift > 0.1s)
                        const expectedTime = (currentTime - track.startTime) / 1000;
                        if (Math.abs(audio.currentTime - expectedTime) > 0.1) {
                            audio.currentTime = expectedTime;
                        }
                    }
                } else {
                    // Should be stopped
                    if (!audio.paused) {
                        audio.pause();
                    }
                }
            });
        } else {
            // Pause all
            Object.values(audioInstances.current).forEach(audio => audio.pause());
        }
    }, [isPlaying, currentTime, audioTracks]);

    // Handle seeking (when not playing)
    useEffect(() => {
        if (!isPlaying) {
             audioTracks.forEach(track => {
                const audio = audioInstances.current[track.id];
                if (!audio) return;
                audio.pause();
            });
        }
    }, [currentTime, isPlaying, audioTracks]);

    return (
        <div className="flex h-full w-full overflow-hidden relative">
            {/* Context Menu Overlay */}
            {contextMenu && (
                <div 
                    className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-48 overflow-hidden"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                >
                    <button 
                        onClick={() => handleDuplicateElement()}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-2">
                            <Copy size={14} />
                            <span>Duplicar</span>
                        </div>
                        <span className="text-[10px] text-gray-400 group-hover:text-purple-400 font-mono">(CTRL+D)</span>
                    </button>
                    <button 
                        onClick={() => handleDeleteElement()}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-2">
                            <Trash2 size={14} />
                            <span>Eliminar</span>
                        </div>
                        <span className="text-[10px] text-red-300 group-hover:text-red-400 font-mono">(CTRL+E)</span>
                    </button>
                </div>
            )}
            
            {/* Left Side (3/4) - Main Storyboard Area */}
            <div className="w-3/4 h-full bg-gray-50 flex flex-col relative">
                
                {/* Top Toolbar (New Location for Tools & Layers) */}
                        <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30 shadow-sm">
                            {/* Left: Tools */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Editor</span>

                                <div className="w-[1px] h-6 bg-gray-200 mx-2" />

                                {/* Undo Button */}
                                <button 
                                    onClick={undo}
                                    disabled={history.length === 0}
                                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium border ${
                                        history.length === 0 
                                        ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' 
                                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 hover:text-gray-900 shadow-sm'
                                    }`}
                                    title="Deshacer (Ctrl+Z)"
                                >
                                    <Undo size={14} />
                                    <span>Deshacer</span>
                                </button>

                                <div className="w-[1px] h-6 bg-gray-200 mx-2" />

                                {/* Audio Button */}
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 hover:text-purple-600 shadow-sm transition-colors flex items-center gap-2 text-xs font-medium"
                                    title="Añadir audio (Max 2min)"
                                >
                                    <Music size={14} />
                                    <span>Audio</span>
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="audio/*" 
                                    onChange={handleUploadAudio} 
                                />

                                <div className="w-[1px] h-6 bg-gray-200 mx-2" />

                                {/* Layer Selector */}
                                <div className="relative">
                            <button
                                onClick={() => setShowLayerMenu(!showLayerMenu)}
                                className="flex items-center gap-2 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 transition-all text-xs font-medium"
                            >
                                <Layers size={14} className="text-purple-600" />
                                <span>Capas ({layers.length}/5)</span>
                            </button>

                            {showLayerMenu && (
                                <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col z-50">
                                    <div className="p-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Capas</span>
                                        {layers.length < 5 ? (
                                            <button onClick={addLayer} className="text-purple-600 hover:text-purple-700 p-1 rounded hover:bg-purple-100 transition-colors" title="Nueva Capa">
                                                <Plus size={14} />
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-gray-400 font-normal border border-gray-200 px-1 rounded bg-gray-50" title="Límite alcanzado">Max</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col-reverse max-h-48 overflow-y-auto">
                                        {layers.map((layer) => (
                                            <div 
                                                key={layer.id}
                                                onClick={() => setActiveLayerId(layer.id)}
                                                className={`flex items-center justify-between p-2 cursor-pointer border-b border-gray-50 last:border-0 ${
                                                    activeLayerId === layer.id ? 'bg-purple-50' : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                                                        className={`p-1 rounded-full ${layer.visible ? 'text-gray-600 hover:text-purple-600' : 'text-gray-300 hover:text-gray-500'}`}
                                                    >
                                                        {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                                    </button>
                                                    <span className={`text-xs truncate ${activeLayerId === layer.id ? 'font-medium text-purple-700' : 'text-gray-600'}`}>
                                                        {layer.name}
                                                    </span>
                                                </div>
                                                {layers.length > 1 && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                                                        className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Frame Info */}
                    <div className="text-xs text-gray-400 font-mono">
                         Frame {activeFrameIndex + 1} / {frames.length}
                    </div>
                </div>

                {/* Top: Canvas Area (Split with Left Panel) */}
                <div className="flex-1 flex relative p-4 bg-gray-50 overflow-hidden">
                    
                    {/* Left Options Panel */}
                    <div className="w-64 bg-white border-r border-gray-200 flex flex-col p-4 gap-6 overflow-y-auto shadow-sm z-20">
                        {activeElement.type === 'dialogue' ? (
                            // DIALOGUE EDITOR
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Editar Diálogo</span>
                                    <button 
                                        onClick={() => setActiveElement({ type: 'frame', id: null })}
                                        className="text-xs text-purple-600 hover:underline"
                                    >
                                        Volver
                                    </button>
                                </div>

                                {(() => {
                                    const activeDialogue = dialogues.find(d => d.id === activeElement.id);
                                    if (!activeDialogue) return null;

                                    return (
                                        <>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-gray-500">Texto</label>
                                                <textarea 
                                                    value={activeDialogue.text}
                                                    onChange={(e) => updateDialogue(activeDialogue.id, { text: e.target.value })}
                                                    className="w-full border border-gray-300 rounded p-2 text-sm h-32 resize-none"
                                                    placeholder="Escribe el diálogo aquí..."
                                                />
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-gray-500">Tamaño de Fuente</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="range" 
                                                        min="12" 
                                                        max="72" 
                                                        value={activeDialogue.fontSize}
                                                        onChange={(e) => updateDialogue(activeDialogue.id, { fontSize: parseInt(e.target.value) })}
                                                        className="flex-1 accent-purple-600"
                                                    />
                                                    <span className="text-xs font-mono w-8">{activeDialogue.fontSize}px</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-gray-500">Duración</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        min="100"
                                                        step="100"
                                                        value={activeDialogue.duration}
                                                        onChange={(e) => updateDialogue(activeDialogue.id, { duration: parseInt(e.target.value) })}
                                                        className="w-full border border-gray-300 rounded p-1 text-sm"
                                                    />
                                                    <span className="text-xs text-gray-500">ms</span>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => deleteDialogue(activeDialogue.id)}
                                                className="mt-4 bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Trash2 size={14} /> Eliminar Diálogo
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>
                        ) : (
                            // FRAME / DRAWING EDITOR
                            <>
                        {/* Frame Duration Control */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Clock size={12} /> Duración del Frame
                            </label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="100" 
                                    step="100"
                                    value={activeFrame?.duration || 1000}
                                    onChange={(e) => updateFrame({ duration: parseInt(e.target.value) })}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
                                />
                                <span className="text-xs text-gray-500">ms</span>
                            </div>
                        </div>

                        {/* Brush Selector */}
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <PenTool size={12} /> Herramientas
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.entries(BRUSH_PRESETS).map(([key, preset]) => {
                                        const Icon = {
                                            pencil: Pencil,
                                            pen: PenTool,
                                            marker: PenTool,
                                            thick: Brush,
                                            highlighter: Highlighter,
                                            spray: SprayCan,
                                            eraser: Eraser,
                                            soft_eraser: Eraser
                                        }[key] || PenTool;

                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setTool(key)}
                                                title={preset.name}
                                                className={`flex items-center justify-center p-2 rounded-lg border transition-all aspect-square ${
                                                    tool === key 
                                                    ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500' 
                                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                                                }`}
                                            >
                                                <Icon size={20} strokeWidth={key === 'marker' ? 3 : 2} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Brush Size Control */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Tamaño
                                    </label>
                                    <span className="text-xs font-mono text-gray-500">{brushSize}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="100" 
                                    value={brushSize} 
                                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="w-full accent-purple-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Opacity Control */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Opacidad
                                    </label>
                                    <span className="text-xs font-mono text-gray-500">{Math.round(brushOpacity * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.1" 
                                    max="1" 
                                    step="0.1"
                                    value={brushOpacity} 
                                    onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                                    className="w-full accent-purple-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Color Picker */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Color
                                </label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="color" 
                                        value={brushColor} 
                                        onChange={(e) => setBrushColor(e.target.value)}
                                        className="w-full h-8 rounded cursor-pointer border border-gray-200 p-0 bg-transparent"
                                    />
                                    <span className="text-xs font-mono text-gray-500 uppercase hidden">{brushColor}</span>
                                </div>
                            </div>

                            {/* Add Dialogue Button */}
                            <button 
                                onClick={addDialogue}
                                className="w-full py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="text-lg font-bold">T</span> Agregar Diálogo
                            </button>

                            {/* Add Action Button */}
                            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-100">
                                <button 
                                    onClick={() => {
                                        if (activeFrame.action === undefined) {
                                            updateFrame({ action: '' });
                                        }
                                    }}
                                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                        activeFrame?.action !== undefined 
                                        ? 'bg-gray-100 text-gray-400 cursor-default'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                    }`}
                                    disabled={activeFrame?.action !== undefined}
                                    title={activeFrame?.action !== undefined ? "Acción ya agregada" : "Añadir descripción de acción"}
                                >
                                    <Zap size={16} /> {activeFrame?.action !== undefined ? 'Acción Agregada' : 'Añadir Acción'}
                                </button>
                                
                                {activeFrame?.action !== undefined && (
                                    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                Descripción de Acción
                                            </label>
                                            <button 
                                                onClick={() => updateFrame({ action: undefined })}
                                                className="text-[10px] text-red-400 hover:text-red-600 hover:underline"
                                                title="Eliminar acción"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                        <textarea 
                                            value={activeFrame.action}
                                            onChange={(e) => updateFrame({ action: e.target.value })}
                                            className="w-full border border-gray-300 rounded p-2 text-sm h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Describe la acción que ocurre en este frame..."
                                        />
                                        <p className="text-[10px] text-gray-400 italic leading-tight">
                                            * Este texto no será visible en el storyboard. Solo aparecerá en la exportación a PDF.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        </>
                        )}
                    </div>

                    {/* Main Canvas Wrapper */}
                    <div className="flex-1 flex items-center justify-center relative pl-8">
                        {/* Previous Button (Floating) */}
                        <button 
                            onClick={() => addFrame(0)}
                            className="absolute left-2 p-3 bg-white rounded-full shadow-md hover:bg-purple-50 text-gray-500 hover:text-purple-600 transition-all z-10 border border-gray-100"
                            title="Añadir cuadro antes"
                        >
                            <Plus size={24} />
                        </button>

                        {/* Main Canvas Container (16:9) */}
                        <div id="main-canvas-container" className="aspect-video w-full max-w-4xl relative group-canvas">
                             {activeFrame && (
                                <StoryboardCanvas 
                                    key={activeFrame.id} // Re-mount on frame change
                                    frame={activeFrame} 
                                    onUpdate={updateFrame}
                                    tool={tool}
                                    brushSize={brushSize}
                                    brushOpacity={brushOpacity}
                                    brushColor={brushColor}
                                    activeLayerId={activeLayerId}
                                    onStartDrawing={pushToHistory}
                                />
                             )}

                             {/* Dialogues Overlay */}
                            {(() => {
                                // Calculate time range of current frame (for legacy check or if we want to show all in frame while paused)
                                // But for accurate playback, we use currentTime.
                                
                                // Strategy:
                                // Always show ONLY if currentTime is within dialogue range,
                                // UNLESS the user specifically selected a dialogue, then we MIGHT want to show it?
                                // User request: "cuando el marcador en una posicion donde el dialogo no deberia de aparecer este sigue apareciendo"
                                // So strictly enforce time visibility.

                                return dialogues
                                    .filter(d => {
                                        const dEnd = d.startTime + d.duration;
                                        // Strict visibility based on playhead position
                                        return currentTime >= d.startTime && currentTime < dEnd;
                                    })
                                    .map(d => (
                                         <div
                                             key={d.id}
                                             onMouseDown={(e) => handleDialogueMouseDown(e, d)}
                                             className={`absolute p-2 rounded cursor-move select-none transition-all ${
                                                 activeElement.id === d.id 
                                                 ? 'ring-2 ring-purple-500 bg-gray-900/80 text-white z-50' 
                                                 : 'bg-gray-900/50 text-white/90 hover:bg-gray-900/70 z-40'
                                             }`}
                                             style={{
                                                 left: `${(d.x / 1280) * 100}%`,
                                                 top: `${(d.y / 720) * 100}%`,
                                                 fontSize: `${(d.fontSize / 720) * 100}cqh`, // Container Query Units or just responsive?
                                                 // Using cqh might fail if container query not set.
                                                 // Let's use % based on height approx or just transform scale.
                                                 // Or easier:
                                                 fontSize: 'clamp(12px, 2vw, 48px)', // Simple responsive
                                                 // Actually, user set fontSize in px relative to 720p.
                                                 // We should probably scale it.
                                                 transform: 'translate(-50%, -50%)',
                                                 whiteSpace: 'pre-wrap',
                                                 textAlign: 'center',
                                                 minWidth: '100px'
                                             }}
                                         >
                                             <span style={{ fontSize: `${d.fontSize}px`, lineHeight: 1.2, display: 'block', transformOrigin: 'center' }}>
                                                 {d.text}
                                             </span>
                                         </div>
                                     ));
                             })()}
                             
                             {/* Frame Number Badge */}
                             <div className="absolute top-2 right-2 bg-gray-900/10 text-gray-500 px-2 py-1 rounded text-xs font-mono pointer-events-none backdrop-blur-sm">
                                #{activeFrameIndex + 1}
                             </div>

                             {/* Delete Button */}
                             {frames.length > 1 && (
                                 <button 
                                    onClick={deleteFrame}
                                    className="absolute bottom-2 right-2 p-2 bg-white hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors shadow-sm border border-gray-100"
                                    title="Eliminar cuadro"
                                 >
                                     <Trash2 size={16} />
                                 </button>
                             )}
                        </div>

                        {/* Next Button (Floating) */}
                        <button 
                            onClick={() => addFrame(1)}
                            className="absolute right-2 p-3 bg-white rounded-full shadow-md hover:bg-purple-50 text-gray-500 hover:text-purple-600 transition-all z-10 border border-gray-100"
                            title="Añadir cuadro después"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </div>

                {/* Bottom: Timeline (Premiere Style - Light Theme) */}
                <div className="h-48 bg-white border-t border-gray-200 flex flex-col text-gray-600 select-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    {/* Toolbar / Timecode */}
                    <div className="h-8 bg-gray-50 flex items-center justify-between px-4 border-b border-gray-200">
                        <div className="flex items-center gap-4">
                            {/* Playback Controls */}
                            <div className="flex items-center gap-1 mr-2 border-r border-gray-200 pr-4">
                                <button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className={`p-1 rounded hover:bg-gray-200 text-gray-700 ${isPlaying ? 'text-purple-600 bg-purple-50' : ''}`}
                                    title={isPlaying ? "Pausar" : "Reproducir"}
                                >
                                    {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsPlaying(false);
                                        setActiveFrameIndex(0);
                                    }}
                                    className="p-1 rounded hover:bg-gray-200 text-gray-700"
                                    title="Detener"
                                >
                                    <div className="w-3 h-3 bg-current rounded-sm" />
                                </button>
                                <button
                                    onClick={() => setIsLooping(!isLooping)}
                                    className={`p-1 rounded hover:bg-gray-200 ${isLooping ? 'text-purple-600 bg-purple-50' : 'text-gray-400'}`}
                                    title="Bucle"
                                >
                                    <Repeat size={14} />
                                </button>
                            </div>

                            <span className="text-xs font-mono text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded">
                                {(() => {
                                    const totalSeconds = Math.floor(currentTime / 1000);
                                    const mins = Math.floor(totalSeconds / 60);
                                    const secs = totalSeconds % 60;
                                    const ms = Math.floor((currentTime % 1000) / 10); // 2 digits
                                    return `${mins < 10 ? '0'+mins : mins}:${secs < 10 ? '0'+secs : secs}:${ms < 10 ? '0'+ms : ms}`;
                                })()}
                            </span>
                            <div className="text-[10px] text-gray-400 border-l border-gray-300 pl-4 flex gap-2">
                                <span className="hover:text-purple-600 cursor-pointer"><Film size={12} /></span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {saving && <span className="text-[10px] text-purple-500 animate-pulse font-medium">Guardando...</span>}
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Track Headers */}
                        <div className="w-24 bg-gray-50 border-r border-gray-200 flex flex-col z-20 shadow-sm">
                            {/* D1 Header (New - Dialogue) */}
                            <div className="h-10 border-b border-gray-200 flex items-center justify-between px-2 relative bg-purple-50">
                                 <span className="text-xs font-bold text-purple-600">D1</span>
                                 <div className="flex flex-col gap-1">
                                     <div className="w-4 h-4 bg-white rounded-sm flex items-center justify-center border border-purple-200 text-purple-500 font-bold text-[8px]">T</div>
                                 </div>
                            </div>

                            {/* V1 Header (Reduced Height) */}
                            <div className="h-10 border-b border-gray-200 flex items-center justify-between px-2 relative bg-white">
                                 <span className="text-xs font-bold text-gray-500">V1</span>
                                 <div className="flex flex-col gap-1">
                                     <div className="w-4 h-4 bg-gray-100 rounded-sm flex items-center justify-center border border-gray-200 text-gray-400"><Eye size={10} /></div>
                                 </div>
                            </div>
                            {/* A1 Header (Visual Only) */}
                            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-2 relative bg-gray-50">
                                 <span className="text-xs font-bold text-gray-400">A1</span>
                                 <div className="flex flex-col gap-1">
                                     <div className="w-4 h-4 bg-gray-100 rounded-sm flex items-center justify-center border border-gray-200 text-gray-400"><Volume2 size={10} /></div>
                                 </div>
                            </div>
                        </div>

                        {/* Tracks Area */}
                        <div id="timeline-tracks-area" className="flex-1 overflow-x-auto overflow-y-hidden bg-gray-100 relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                            {/* Playhead Overlay - Spans all tracks */}
                            <div className="absolute top-0 bottom-0 z-50 pointer-events-none" style={{ left: 0, width: '100%', height: '100%' }}>
                                <div 
                                    className="absolute top-0 bottom-0"
                                    style={{ left: `${(currentTime / 1000) * pixelsPerSecond}px` }}
                                >
                                    {/* Line - Starts below ruler (24px) */}
                                    <div className="absolute top-6 bottom-0 w-[2px] bg-red-500 transform -translate-x-1/2 pointer-events-none" />
                                    
                                    {/* Head (Diamond) - Draggable, positioned at top of D1 track */}
                                    <div 
                                        onMouseDown={handlePlayheadMouseDown}
                                        className="absolute top-6 w-4 h-4 bg-red-500 transform -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize pointer-events-auto hover:scale-110 transition-transform shadow-sm z-50"
                                    />
                                </div>
                            </div>

                            {/* Time Ruler (Visual) */}
                            <div 
                                className={`h-6 bg-gray-50 border-b border-gray-200 flex items-end pb-1 sticky top-0 z-10 w-full min-w-max shadow-sm ${isDraggingRuler ? 'cursor-ew-resize' : 'cursor-pointer hover:bg-gray-100'}`}
                                onMouseDown={handleRulerMouseDown}
                                title="Arrastra para hacer zoom horizontal"
                            >
                                {/* Generate ticks (Seconds) */}
                                {Array.from({ length: Math.max(20, Math.ceil(frames.reduce((acc, f) => acc + (f.duration || 1000), 0) / 1000) + 5) }).map((_, i) => (
                                     <div key={i} style={{ width: `${pixelsPerSecond}px` }} className="border-l border-gray-300 h-2 text-[9px] pl-1 text-gray-400 relative select-none">
                                        <span className="absolute -top-3 left-1 font-mono">
                                            {(() => {
                                                const mins = Math.floor(i / 60);
                                                const secs = i % 60;
                                                return `${mins < 10 ? '0'+mins : mins}:${secs < 10 ? '0'+secs : secs}`;
                                            })()}
                                        </span>
                                     </div>
                                ))}
                            </div>

                            {/* D1 Track Content */}
                            <div className="h-10 border-b border-gray-200 bg-purple-50/30 flex items-center px-0 min-w-max relative overflow-hidden">
                                {dialogues.map(d => (
                                    <div
                                        key={d.id}
                                        onMouseDown={(e) => handleTimelineDialogueMouseDown(e, d)}
                                        onContextMenu={(e) => handleContextMenu(e, 'dialogue', d.id)}
                                        className={`absolute top-1 bottom-1 rounded border overflow-hidden text-[10px] flex items-center px-1 cursor-pointer transition-colors select-none ${
                                            activeElement.id === d.id
                                            ? 'bg-purple-500 border-purple-600 text-white z-10 shadow-sm'
                                            : 'bg-purple-200 border-purple-300 text-purple-800 hover:bg-purple-300'
                                        }`}
                                        style={{
                                            left: `${(d.startTime / 1000) * pixelsPerSecond}px`,
                                            width: `${(d.duration / 1000) * pixelsPerSecond}px`
                                        }}
                                        title={d.text}
                                    >
                                        <span className="truncate w-full">{d.text}</span>
                                        
                                        {/* Resize Handles (Dialogues) */}
                                        <div 
                                            className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                            onMouseDown={(e) => handleResizeMouseDown(e, 'dialogue', d.id, 'left', d.duration, d.startTime)}
                                        />
                                        <div 
                                            className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                            onMouseDown={(e) => handleResizeMouseDown(e, 'dialogue', d.id, 'right', d.duration, d.startTime)}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* V1 Track Content */}
                            <div 
                                className="h-10 border-b border-gray-200 bg-white flex items-center px-0 min-w-max relative"
                                onClick={() => setActiveElement({ type: 'frame', id: null })}
                            >
                                {frames.map((frame, index) => {
                                    // Determine thumbnail image
                                    let thumbSrc = null;
                                    if (frame.layers) {
                                        // Find top-most visible layer with data
                                        const visible = frame.layers.filter(l => l.visible && l.data);
                                        if (visible.length > 0) thumbSrc = visible[visible.length - 1].data;
                                    } else {
                                        thumbSrc = frame.drawing;
                                    }
                                    
                                    const frameWidth = ((frame.duration || 1000) / 1000) * pixelsPerSecond;

                                    return (
                                        <div 
                                            key={frame.id}
                                            onMouseDown={(e) => handleFrameMouseDown(e, index)}
                                            onContextMenu={(e) => handleContextMenu(e, 'frame', index)}
                                            onMouseEnter={() => handleFrameMouseEnter(index)}
                                            style={{ width: `${frameWidth}px` }}
                                            className={`h-[90%] ml-[1px] rounded-md cursor-pointer relative group flex flex-col overflow-hidden transition-all select-none ${
                                                index === activeFrameIndex 
                                                ? 'bg-purple-100 border-2 border-purple-500 shadow-md z-10' 
                                                : draggingFrameIndex === index
                                                    ? 'bg-purple-50 opacity-50 border-dashed border-2 border-purple-400'
                                                    : 'bg-purple-50 border border-purple-200 hover:border-purple-300 hover:shadow-sm'
                                            } ${
                                                dropTargetIndex === index && draggingFrameIndex !== null && draggingFrameIndex !== index 
                                                ? (draggingFrameIndex < index ? 'border-r-4 border-r-purple-600' : 'border-l-4 border-l-purple-600')
                                                : ''
                                            }`}
                                        >
                                            {/* Clip Name Header */}
                                            <div className={`h-4 text-[9px] px-1 truncate flex items-center font-medium ${
                                                index === activeFrameIndex ? 'bg-purple-500 text-white' : 'bg-purple-200 text-purple-800'
                                            }`}>
                                                {frame.layers ? `C:${frame.layers.length} - Frame ${index+1}` : `Frame ${index+1}`}
                                            </div>
                                            
                                            {/* Thumbnail Slice */}
                                            <div className="flex-1 overflow-hidden relative bg-white">
                                                 {thumbSrc ? (
                                                    <img 
                                                        src={thumbSrc} 
                                                        className="w-full h-full object-cover opacity-90" 
                                                        draggable={false}
                                                    />
                                                 ) : (
                                                     <div className="w-full h-full flex items-center justify-center opacity-20">
                                                         <Film size={16} className="text-purple-300" />
                                                     </div>
                                                 )}
                                            </div>

                                            {/* Resize Handles (Frames) */}
                                            {/* Left Handle: Resizes previous frame (if exists) */}
                                            {index > 0 && (
                                                <div 
                                                    className="absolute top-0 bottom-0 left-0 w-3 cursor-ew-resize hover:bg-purple-500/30 z-20"
                                                    onMouseDown={(e) => {
                                                        // Map Left Edge of Frame i to Right Edge of Frame i-1
                                                        const prevFrame = frames[index - 1];
                                                        handleResizeMouseDown(e, 'frame', index - 1, 'right', prevFrame.duration || 1000);
                                                    }}
                                                />
                                            )}
                                            {/* Right Handle: Resizes current frame */}
                                            <div 
                                                className="absolute top-0 bottom-0 right-0 w-3 cursor-ew-resize hover:bg-purple-500/30 z-20"
                                                onMouseDown={(e) => handleResizeMouseDown(e, 'frame', index, 'right', frame.duration || 1000)}
                                            />
                                        </div>
                                    );
                                })}
                                
                                {/* Add Button as a "Gap" filler */}
                                <button 
                                    onClick={() => addFrame(1)}
                                    className="h-[90%] w-8 bg-gray-50 hover:bg-gray-100 ml-1 flex items-center justify-center text-gray-400 hover:text-purple-500 rounded-md transition-colors border border-gray-200 hover:border-purple-200 border-dashed"
                                    title="Añadir frame"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>

                            {/* A1 Track Content */}
                            <div className="h-16 border-b border-gray-200 bg-gray-50 min-w-max relative flex items-center overflow-hidden">
                                {audioTracks.map(track => (
                                    <div
                                        key={track.id}
                                        onMouseDown={(e) => handleAudioMouseDown(e, track)}
                                        onContextMenu={(e) => handleContextMenu(e, 'audio', track.id)}
                                        className={`absolute top-2 bottom-2 rounded border overflow-hidden text-[10px] flex items-center px-2 cursor-pointer transition-colors select-none ${
                                            activeElement.id === track.id && activeElement.type === 'audio'
                                            ? 'bg-green-500 border-green-600 text-white z-10 shadow-sm'
                                            : 'bg-green-200 border-green-300 text-green-800 hover:bg-green-300'
                                        }`}
                                        style={{
                                            left: `${(track.startTime / 1000) * pixelsPerSecond}px`,
                                            width: `${(track.duration / 1000) * pixelsPerSecond}px`
                                        }}
                                        title={track.name}
                                    >
                                        <Music size={12} className="mr-1 flex-shrink-0" />
                                        <span className="truncate w-full">{track.name}</span>
                                        
                                        {/* Resize Handle (Right only for now as per logic) */}
                                        <div 
                                            className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                            onMouseDown={(e) => handleResizeMouseDown(e, 'audio', track.id, 'right', track.duration, track.startTime)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Right Side (1/4) - Script Reference */}
            <div className="w-1/4 h-full">
                <ScriptViewer pages={pages} />
            </div>
        </div>
    );
};

export default StoryboardTab;
