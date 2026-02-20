import { useState, useEffect, useRef, useMemo } from 'react';
import { ZoomIn, ZoomOut, Plus, Trash2, ChevronLeft, ChevronRight, PenTool, Eraser, Move, Layers, Eye, EyeOff, Film, Volume2, Clock, Play, Pause, Repeat, Pencil, Brush, Highlighter, SprayCan, Undo, Copy, Music, Zap, Scissors, MousePointer2, BoxSelect, Lasso, Wand, PaintBucket, Maximize, RotateCw, Download, Sparkles, Diamond } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import StoryboardExportModal from './StoryboardExportModal';

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

const ScriptViewer = ({ pages, selectedSceneId, onSelectScene }) => {
    const [zoom, setZoom] = useState(0.55); // Default zoom smaller for the side panel

    // Flatten all elements to easily find the scene for any element
    const elementToSceneMap = useMemo(() => {
        const map = new Map();
        let currentSceneId = null;
        
        pages.forEach(page => {
            if (page.type === 'title') return;
            page.elements?.forEach(el => {
                if (el.type === ELEMENT_TYPES.SCENE) {
                    currentSceneId = el.id;
                }
                if (currentSceneId) {
                    map.set(el.id, currentSceneId);
                }
            });
        });
        return map;
    }, [pages]);

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
                    {pages.filter(p => p.type !== 'title').map((page, index) => (
                        <div key={page.id || index} className="bg-white shadow-md p-[25mm] min-h-[297mm] w-[210mm] relative">
                            {/* Page Number */}
                            <div className="absolute top-8 right-10 text-gray-300 font-mono text-xs select-none">
                                {index + 1}.
                            </div>
                            
                            <div className="text-gray-900 text-[12pt] font-mono leading-normal">
                                {page.elements && page.elements.map((element, i) => {
                                    const isScene = element.type === ELEMENT_TYPES.SCENE;
                                    const sceneIdForThisElement = elementToSceneMap.get(element.id);
                                    const isSelected = isScene && element.id === selectedSceneId;
                                    const isElementFromSelectedScene = sceneIdForThisElement === selectedSceneId;
                                    
                                    return (
                                        <div 
                                            key={element.id || i} 
                                            onClick={() => {
                                                if (sceneIdForThisElement) {
                                                    onSelectScene(sceneIdForThisElement);
                                                }
                                            }}
                                            className={`relative group ${ELEMENT_STYLES[element.type] || ''} whitespace-pre-wrap transition-all duration-200 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 ${
                                                isSelected ? 'bg-green-50 border-2 border-green-500 rounded p-2 -m-2 z-10' : ''
                                            } ${
                                                !isSelected && isElementFromSelectedScene ? 'bg-green-50/30' : ''
                                            }`}
                                        >
                                            {isScene && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectScene(element.id);
                                                    }}
                                                    className={`absolute -left-12 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${
                                                        isSelected 
                                                        ? 'bg-green-500 text-white shadow-lg scale-110' 
                                                        : 'bg-white text-gray-400 border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                                                    }`}
                                                    title={isSelected ? "Escena seleccionada" : "Seleccionar esta escena"}
                                                >
                                                    <Zap size={16} fill={isSelected ? "currentColor" : "none"} />
                                                </button>
                                            )}
                                            {element.content}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Canvas Component
const StoryboardCanvas = ({ frame, onUpdate, tool, brushSize, brushOpacity, brushColor, activeLayerId, onStartDrawing, activeElement, activeReference, onUpdateReference }) => {
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
    
    // New Tools State
    const selectionRef = useRef(null); // { type: 'rect'|'free'|'magic', points: [], rect: {x,y,w,h}, path: Path2D }
    const [hasSelection, setHasSelection] = useState(false);
    const floatingSelectionRef = useRef(null); // { image: HTMLCanvasElement, x, y, w, h, rotation: 0 }
    const isDraggingSelectionRef = useRef(false);
    const transformActionRef = useRef(null); // { type: 'move'|'rotate'|'resize', handle: 'tl'|'tr'..., startX, startY, startParam: {x,y,w,h,rotation} }
    const [transformCursor, setTransformCursor] = useState('default');
    const referenceTransformRef = useRef(null); // { type: 'move'|'rotate'|'resize', handle, startX, startY, startParam }

    // Commit floating selection to layer
    const commitSelection = () => {
        const fs = floatingSelectionRef.current;
        if (!fs) return;

        const layerId = fs.layerId || activeLayer?.id;
        if (!layerId) return;

        const layerCanvas = containerRef.current?.querySelector(`canvas[data-layer-id="${layerId}"]`);
        if (!layerCanvas) return;
        
        const ctx = layerCanvas.getContext('2d');
        
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.save();
        // Translate to center of image
        const cx = fs.x + fs.w / 2;
        const cy = fs.y + fs.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(fs.rotation || 0);
        ctx.drawImage(fs.image, -fs.w / 2, -fs.h / 2, fs.w, fs.h);
        ctx.restore();
        
        // Update persistent state
        updateLayerData(layerId, { data: layerCanvas.toDataURL() });
        
        // Clear floating
        floatingSelectionRef.current = null;
        const tempCtx = tempCanvasRef.current?.getContext('2d');
        if (tempCtx) tempCtx.clearRect(0, 0, 1280, 720);
    };

    const renderFloatingSelectionOverlay = () => {
        const fs = floatingSelectionRef.current;
        const ctx = tempCanvasRef.current?.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, 1280, 720);

        if (fs) {
            ctx.save();
            const cx = fs.x + fs.w / 2;
            const cy = fs.y + fs.h / 2;
            ctx.translate(cx, cy);
            ctx.rotate(fs.rotation || 0);
            ctx.drawImage(fs.image, -fs.w / 2, -fs.h / 2, fs.w, fs.h);
            ctx.restore();
            drawTransformHandles(ctx, fs);
        } else if (tool === 'transform' && activeElement.type === 'reference' && activeReference?.image) {
            // Draw reference image transform handles
            const refBounds = {
                x: activeReference.x - (1280 * activeReference.scaleX) / 2,
                y: activeReference.y - (720 * activeReference.scaleY) / 2,
                w: 1280 * activeReference.scaleX,
                h: 720 * activeReference.scaleY,
                rotation: activeReference.rotation
            };
            drawTransformHandles(ctx, refBounds, '#3b82f6'); // Blue for reference
        }
    };

    const getNormalizedSelectionBounds = () => {
        if (!selectionRef.current) return null;
        const s = selectionRef.current;

        let sx, sy, sw, sh;
        if (s.type === 'rect') {
            if (!s.rect) return null;
            ({ x: sx, y: sy, w: sw, h: sh } = s.rect);
            if (sw < 0) { sx += sw; sw = Math.abs(sw); }
            if (sh < 0) { sy += sh; sh = Math.abs(sh); }
        } else if (s.type === 'free') {
            if (!s.points || s.points.length < 2) return null;
            const xs = s.points.map(p => p.x);
            const ys = s.points.map(p => p.y);
            sx = Math.min(...xs);
            sy = Math.min(...ys);
            sw = Math.max(...xs) - sx;
            sh = Math.max(...ys) - sy;
        } else if (s.type === 'magic') {
            if (!s.rect || !s.maskCanvas) return null;
            ({ x: sx, y: sy, w: sw, h: sh } = s.rect);
        } else {
            return null;
        }

        if (sw <= 0 || sh <= 0) return null;

        return { sx, sy, sw, sh, type: s.type, points: s.points, maskCanvas: s.maskCanvas, layerId: s.layerId };
    };

    const liftSelectionToFloating = () => {
        if (!hasSelection || !selectionRef.current) return;
        if (floatingSelectionRef.current) return;

        const bounds = getNormalizedSelectionBounds();
        if (!bounds) return;

        const targetLayerId = bounds.layerId || activeLayer?.id;
        if (!targetLayerId) return;

        const layerCanvas = containerRef.current?.querySelector(`canvas[data-layer-id="${targetLayerId}"]`);
        if (!layerCanvas) return;
        const ctx = layerCanvas.getContext('2d');

        const { sx, sy, sw, sh } = bounds;

        const rawData = ctx.getImageData(sx, sy, sw, sh);

        const tempC = document.createElement('canvas');
        tempC.width = sw;
        tempC.height = sh;
        const tCtx = tempC.getContext('2d');
        tCtx.putImageData(rawData, 0, 0);

        if (bounds.type === 'free' && bounds.points?.length) {
            tCtx.globalCompositeOperation = 'destination-in';
            tCtx.beginPath();
            const pts = bounds.points;
            tCtx.moveTo(pts[0].x - sx, pts[0].y - sy);
            for (let i = 1; i < pts.length; i++) tCtx.lineTo(pts[i].x - sx, pts[i].y - sy);
            tCtx.closePath();
            tCtx.fill();
        } else if (bounds.type === 'magic' && bounds.maskCanvas) {
            tCtx.globalCompositeOperation = 'destination-in';
            tCtx.drawImage(bounds.maskCanvas, 0, 0);
        }

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        if (bounds.type === 'rect') {
            ctx.fillRect(sx, sy, sw, sh);
        } else {
            if (bounds.type === 'free') {
                ctx.beginPath();
                const pts = bounds.points;
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                ctx.closePath();
                ctx.clip();
                ctx.fillRect(sx, sy, sw, sh);
            } else if (bounds.type === 'magic' && bounds.maskCanvas) {
                ctx.drawImage(bounds.maskCanvas, sx, sy);
            }
        }
        ctx.restore();

        floatingSelectionRef.current = {
            image: tempC,
            layerId: targetLayerId,
            x: sx,
            y: sy,
            w: sw,
            h: sh,
            rotation: 0
        };

        updateLayerData(targetLayerId, { data: layerCanvas.toDataURL() });
        renderFloatingSelectionOverlay();
    };

    const createMagicSelectionAt = (mx, my) => {
        if (!activeLayer?.id) return;
        const layerCanvas = containerRef.current?.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`);
        if (!layerCanvas) return;

        const ctx = layerCanvas.getContext('2d');
        const width = layerCanvas.width;
        const height = layerCanvas.height;

        const startX = Math.floor(mx);
        const startY = Math.floor(my);
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const startPos = (startY * width + startX) * 4;
        const startR = data[startPos];
        const startG = data[startPos + 1];
        const startB = data[startPos + 2];
        const startA = data[startPos + 3];

        const tolerance = 32;
        const tolSq = tolerance * tolerance * 3;

        const matches = (pos) => {
            const a = data[pos + 3];
            if (startA === 0) return a === 0;
            if (a === 0) return false;
            const dr = data[pos] - startR;
            const dg = data[pos + 1] - startG;
            const db = data[pos + 2] - startB;
            return (dr * dr + dg * dg + db * db) <= tolSq;
        };

        const visited = new Uint8Array(width * height);
        const mask = new Uint8Array(width * height);
        const stack = [[startX, startY]];

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        let selectedCount = 0;

        let iterations = 0;
        const maxIterations = width * height;

        while (stack.length && iterations < maxIterations) {
            iterations++;
            const [cx, cy] = stack.pop();
            const idx = cy * width + cx;
            if (visited[idx]) continue;
            visited[idx] = 1;

            const pos = idx * 4;
            if (!matches(pos)) continue;

            mask[idx] = 255;
            selectedCount++;
            if (cx < minX) minX = cx;
            if (cy < minY) minY = cy;
            if (cx > maxX) maxX = cx;
            if (cy > maxY) maxY = cy;

            if (cx > 0) stack.push([cx - 1, cy]);
            if (cx < width - 1) stack.push([cx + 1, cy]);
            if (cy > 0) stack.push([cx, cy - 1]);
            if (cy < height - 1) stack.push([cx, cy + 1]);
        }

        if (selectedCount === 0 || maxX < minX || maxY < minY) return;

        const sx = minX;
        const sy = minY;
        const sw = maxX - minX + 1;
        const sh = maxY - minY + 1;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = sw;
        maskCanvas.height = sh;
        const mCtx = maskCanvas.getContext('2d');
        const maskImageData = mCtx.createImageData(sw, sh);
        const mData = maskImageData.data;

        for (let yy = sy; yy <= maxY; yy++) {
            for (let xx = sx; xx <= maxX; xx++) {
                const srcIdx = yy * width + xx;
                if (!mask[srcIdx]) continue;
                const di = ((yy - sy) * sw + (xx - sx)) * 4;
                mData[di + 3] = 255;
            }
        }

        mCtx.putImageData(maskImageData, 0, 0);

        selectionRef.current = {
            type: 'magic',
            layerId: activeLayer.id,
            rect: { x: sx, y: sy, w: sw, h: sh },
            maskCanvas
        };

        setHasSelection(true);

        const overlayCtx = tempCanvasRef.current?.getContext('2d');
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, 1280, 720);
            overlayCtx.lineWidth = 1;
            overlayCtx.strokeStyle = '#7e22ce';
            overlayCtx.setLineDash([5, 5]);
            overlayCtx.strokeRect(sx, sy, sw, sh);
            overlayCtx.setLineDash([]);
        }
    };

    // Effect to commit selection when tool changes away from transform
    useEffect(() => {
        if (tool !== 'transform' && floatingSelectionRef.current) {
            commitSelection();
        }
    }, [tool]);

    useEffect(() => {
        if (tool !== 'transform') return;
        renderFloatingSelectionOverlay();
    }, [tool, hasSelection, activeReference, activeElement]);

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

    // Helper: Rotate point around center
    const rotatePoint = (x, y, cx, cy, angle) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = (cos * (x - cx)) - (sin * (y - cy)) + cx;
        const ny = (sin * (x - cx)) + (cos * (y - cy)) + cy;
        return { x: nx, y: ny };
    };

    // Helper: Get transform handle under cursor
    const getTransformHandle = (mx, my, fs) => {
        if (!fs) return null;
        const cx = fs.x + fs.w / 2;
        const cy = fs.y + fs.h / 2;
        // Rotate mouse back to unrotated coordinates relative to center
        const { x, y } = rotatePoint(mx, my, cx, cy, -fs.rotation);
        
        const handleSize = 10 / zoom; // Adjust hit area by zoom
        const half = handleSize / 2;

        // Check corners
        if (Math.abs(x - fs.x) <= handleSize && Math.abs(y - fs.y) <= handleSize) return 'tl';
        if (Math.abs(x - (fs.x + fs.w)) <= handleSize && Math.abs(y - fs.y) <= handleSize) return 'tr';
        if (Math.abs(x - fs.x) <= handleSize && Math.abs(y - (fs.y + fs.h)) <= handleSize) return 'bl';
        if (Math.abs(x - (fs.x + fs.w)) <= handleSize && Math.abs(y - (fs.y + fs.h)) <= handleSize) return 'br';

        // Check edges
        if (Math.abs(y - fs.y) <= handleSize && x > fs.x && x < fs.x + fs.w) return 't';
        if (Math.abs(y - (fs.y + fs.h)) <= handleSize && x > fs.x && x < fs.x + fs.w) return 'b';
        if (Math.abs(x - fs.x) <= handleSize && y > fs.y && y < fs.y + fs.h) return 'l';
        if (Math.abs(x - (fs.x + fs.w)) <= handleSize && y > fs.y && y < fs.y + fs.h) return 'r';

        // Check body
        if (x > fs.x && x < fs.x + fs.w && y > fs.y && y < fs.y + fs.h) return 'body';

        return 'outside';
    };

    // Helper: Draw transform handles
    const drawTransformHandles = (ctx, fs, color = '#7e22ce') => {
        ctx.save();
        const cx = fs.x + fs.w / 2;
        const cy = fs.y + fs.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate(fs.rotation || 0);
        ctx.translate(-cx, -cy);

        // Border
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(fs.x, fs.y, fs.w, fs.h);
        ctx.setLineDash([]);

        // Handles
        const handleSize = 8 / zoom;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color;
        
        const drawSquare = (x, y) => {
            ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        };

        // Corners
        drawSquare(fs.x, fs.y); // tl
        drawSquare(fs.x + fs.w, fs.y); // tr
        drawSquare(fs.x, fs.y + fs.h); // bl
        drawSquare(fs.x + fs.w, fs.y + fs.h); // br

        // Edges
        drawSquare(fs.x + fs.w / 2, fs.y); // t
        drawSquare(fs.x + fs.w / 2, fs.y + fs.h); // b
        drawSquare(fs.x, fs.y + fs.h / 2); // l
        drawSquare(fs.x + fs.w, fs.y + fs.h / 2); // r

        ctx.restore();
    };

    // Drawing Logic
    const startDrawing = (e) => {
        if (activeElement.type === 'reference' && tool !== 'transform') return; // Disable drawing when reference is selected unless using transform tool
        if (!activeLayer?.visible) return; // Can't draw on invisible layer
        
        // Notify parent to save history state
        if (onStartDrawing) onStartDrawing();
        
        // Prevent default to stop scrolling/selection
        e.preventDefault();

        const viewportRect = viewportRef.current?.getBoundingClientRect();
        if (!viewportRect) return;
        
        // Calculate coords relative to canvas 1280x720
        const x = (e.clientX - viewportRect.left) * (1280 / viewportRect.width);
        const y = (e.clientY - viewportRect.top) * (720 / viewportRect.height);
        
        // --- BUCKET TOOL ---
        if (tool === 'bucket') {
            const canvas = containerRef.current?.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                
                // Simple Flood Fill
                const width = canvas.width;
                const height = canvas.height;
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                
                // Parse hex color
                const r = parseInt(brushColor.slice(1, 3), 16);
                const g = parseInt(brushColor.slice(3, 5), 16);
                const b = parseInt(brushColor.slice(5, 7), 16);
                const a = 255;

                const startX = Math.floor(x);
                const startY = Math.floor(y);
                const startPos = (startY * width + startX) * 4;
                
                if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

                const startR = data[startPos];
                const startG = data[startPos + 1];
                const startB = data[startPos + 2];
                const startA = data[startPos + 3];

                if (startR === r && startG === g && startB === b && startA === a) return;

                const stack = [[startX, startY]];
                const visited = new Set(); // Prevent infinite loops in some edge cases
                
                // Limit iterations to prevent browser freeze
                let iterations = 0;
                const maxIterations = 1280 * 720; 

                while (stack.length && iterations < maxIterations) {
                    iterations++;
                    const [cx, cy] = stack.pop();
                    const key = `${cx},${cy}`;
                    if (visited.has(key)) continue;
                    visited.add(key);

                    const pos = (cy * width + cx) * 4;

                    if (data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA) {
                        data[pos] = r;
                        data[pos + 1] = g;
                        data[pos + 2] = b;
                        data[pos + 3] = a;

                        if (cx > 0) stack.push([cx - 1, cy]);
                        if (cx < width - 1) stack.push([cx + 1, cy]);
                        if (cy > 0) stack.push([cx, cy - 1]);
                        if (cy < height - 1) stack.push([cx, cy + 1]);
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
                updateLayerData(activeLayer.id, { data: canvas.toDataURL() });
            }
            return;
        }

        // --- SELECTION TOOLS ---
        if (tool.startsWith('select')) {
            // If we have a floating selection and switch to select tool, commit it first (handled by useEffect)
            // But if we are just starting a new selection, we clear previous

            // Clear previous selection if new one starts
            setHasSelection(false);
            const ctx = tempCanvasRef.current?.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, 1280, 720);
            selectionRef.current = null;

            if (tool === 'select_magic') {
                createMagicSelectionAt(x, y);
                return;
            }

            setIsDrawing(true);
            lastPos.current = { x, y };

            if (tool === 'select_rect') {
                selectionRef.current = { type: 'rect', layerId: activeLayer.id, startX: x, startY: y, rect: { x, y, w: 0, h: 0 } };
            } else if (tool === 'select_free') {
                selectionRef.current = { type: 'free', layerId: activeLayer.id, points: [{x, y}] };
            }
            return;
        }
        
        // --- TRANSFORM TOOL ---
        if (tool === 'transform') {
            if (activeElement.type === 'reference' && activeReference?.image) {
                const refBounds = {
                    x: activeReference.x - (1280 * activeReference.scaleX) / 2,
                    y: activeReference.y - (720 * activeReference.scaleY) / 2,
                    w: 1280 * activeReference.scaleX,
                    h: 720 * activeReference.scaleY,
                    rotation: activeReference.rotation
                };
                const handle = getTransformHandle(x, y, refBounds);
                if (handle) {
                    const cx = activeReference.x;
                    const cy = activeReference.y;
                    const startAngle = Math.atan2(y - cy, x - cx);
                    referenceTransformRef.current = {
                        type: handle === 'outside' ? 'rotate' : (handle === 'body' ? 'move' : 'resize'),
                        handle,
                        startX: x,
                        startY: y,
                        startAngle,
                        startParam: { 
                            x: activeReference.x, 
                            y: activeReference.y, 
                            scaleX: activeReference.scaleX, 
                            scaleY: activeReference.scaleY, 
                            rotation: activeReference.rotation 
                        }
                    };
                    setIsDrawing(true);
                    return;
                }
            }

            if (!hasSelection || !selectionRef.current) return;
            
            // If already floating, check handle hit
            if (floatingSelectionRef.current) {
                const handle = getTransformHandle(x, y, floatingSelectionRef.current);
                if (handle === 'outside') {
                    const fs = floatingSelectionRef.current;
                    const cx = fs.x + fs.w / 2;
                    const cy = fs.y + fs.h / 2;
                    const startAngle = Math.atan2(y - cy, x - cx);
                    transformActionRef.current = {
                        type: 'rotate',
                        handle: 'outside',
                        startX: x,
                        startY: y,
                        startAngle,
                        startParam: { ...fs }
                    };
                    isDraggingSelectionRef.current = true;
                    setIsDrawing(true);
                    return;
                }
                if (handle && handle !== 'outside') {
                    transformActionRef.current = {
                        type: handle === 'body' ? 'move' : 'resize',
                        handle,
                        startX: x,
                        startY: y,
                        startParam: { ...floatingSelectionRef.current }
                    };
                    isDraggingSelectionRef.current = true;
                    setIsDrawing(true);
                    return;
                }
                return;
            }

            liftSelectionToFloating();
            if (!floatingSelectionRef.current) return;

            transformActionRef.current = {
                type: 'move',
                handle: 'body',
                startX: x,
                startY: y,
                startParam: { ...floatingSelectionRef.current }
            };
            isDraggingSelectionRef.current = true;
            setIsDrawing(true);
            return;
        }

        // --- BRUSH TOOLS ---
        const canvas = tool === 'eraser' 
            ? containerRef.current?.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`)
            : tempCanvasRef.current;

        if (!canvas) return;
        
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
            
            // Handle Transform Cursor Update
            if (tool === 'transform') {
                const viewportRect = viewportRef.current?.getBoundingClientRect();
                if (viewportRect) {
                     const scaleX = 1280 / viewportRect.width;
                     const scaleY = 720 / viewportRect.height;
                     const x = (e.clientX - viewportRect.left) * scaleX;
                     const y = (e.clientY - viewportRect.top) * scaleY;

                     if (referenceTransformRef.current) {
                        const action = referenceTransformRef.current;
                        let cursor = 'default';
                        if (action.type === 'move') cursor = 'grabbing';
                        else if (action.type === 'rotate') cursor = 'grabbing';
                        else if (action.type === 'resize') {
                            const h = action.handle;
                            if (h === 'tl' || h === 'br') cursor = 'nwse-resize';
                            else if (h === 'tr' || h === 'bl') cursor = 'nesw-resize';
                            else if (h === 't' || h === 'b') cursor = 'ns-resize';
                            else if (h === 'l' || h === 'r') cursor = 'ew-resize';
                        }
                        setTransformCursor(cursor);
                     } else if (floatingSelectionRef.current) {
                        if (isDraggingSelectionRef.current && transformActionRef.current) {
                            const action = transformActionRef.current;
                            let cursor = 'default';
                            if (action.type === 'move') cursor = 'grabbing';
                            else if (action.type === 'rotate') cursor = 'grabbing';
                            else if (action.type === 'resize') {
                                const h = action.handle;
                                if (h === 'tl' || h === 'br') cursor = 'nwse-resize';
                                else if (h === 'tr' || h === 'bl') cursor = 'nesw-resize';
                                else if (h === 't' || h === 'b') cursor = 'ns-resize';
                                else if (h === 'l' || h === 'r') cursor = 'ew-resize';
                            }
                            setTransformCursor(cursor);
                        } else {
                            const handle = getTransformHandle(x, y, floatingSelectionRef.current);
                            let cursor = 'default';
                            if (handle === 'tl' || handle === 'br') cursor = 'nwse-resize';
                            else if (handle === 'tr' || handle === 'bl') cursor = 'nesw-resize';
                            else if (handle === 't' || handle === 'b') cursor = 'ns-resize';
                            else if (handle === 'l' || handle === 'r') cursor = 'ew-resize';
                            else if (handle === 'body') cursor = 'move';
                            else if (handle === 'outside') cursor = 'grab';
                            setTransformCursor(cursor);
                        }
                     } else if (activeElement.type === 'reference' && activeReference?.image) {
                        const refBounds = {
                            x: activeReference.x - (1280 * activeReference.scaleX) / 2,
                            y: activeReference.y - (720 * activeReference.scaleY) / 2,
                            w: 1280 * activeReference.scaleX,
                            h: 720 * activeReference.scaleY,
                            rotation: activeReference.rotation
                        };
                        const handle = getTransformHandle(x, y, refBounds);
                        let cursor = 'default';
                        if (handle === 'tl' || handle === 'br') cursor = 'nwse-resize';
                        else if (handle === 'tr' || handle === 'bl') cursor = 'nesw-resize';
                        else if (handle === 't' || handle === 'b') cursor = 'ns-resize';
                        else if (handle === 'l' || handle === 'r') cursor = 'ew-resize';
                        else if (handle === 'body') cursor = 'move';
                        else if (handle === 'outside') cursor = 'grab';
                        setTransformCursor(cursor);
                     } else {
                        setTransformCursor('default');
                     }
                }
            } else {
                setTransformCursor('default');
            }
        }

        if (!isDrawing) return;
        e.preventDefault();
        
        const viewportRect = viewportRef.current?.getBoundingClientRect();
        if (!viewportRect) return;

        const scaleX = 1280 / viewportRect.width;
        const scaleY = 720 / viewportRect.height;
        
        const x = (e.clientX - viewportRect.left) * scaleX;
        const y = (e.clientY - viewportRect.top) * scaleY;

        // --- REFERENCE TRANSFORM DRAG ---
        if (referenceTransformRef.current && activeReference) {
            const action = referenceTransformRef.current;
            const start = action.startParam;
            
            if (action.type === 'move') {
                onUpdateReference(activeReference.id, {
                    x: start.x + (x - action.startX),
                    y: start.y + (y - action.startY)
                });
            } else if (action.type === 'resize') {
                const cx = start.x;
                const cy = start.y;
                const p = rotatePoint(x, y, cx, cy, -start.rotation);
                const sp = rotatePoint(action.startX, action.startY, cx, cy, -start.rotation);
                
                const dx = p.x - sp.x;
                const dy = p.y - sp.y;
                
                const startW = 1280 * start.scaleX;
                const startH = 720 * start.scaleY;
                
                let nw = startW;
                let nh = startH;
                let nx = start.x;
                let ny = start.y;
                
                const h = action.handle;
                if (h.includes('l')) { nw -= dx * 2; } // Scale from center
                if (h.includes('r')) { nw += dx * 2; }
                if (h.includes('t')) { nh -= dy * 2; }
                if (h.includes('b')) { nh += dy * 2; }
                
                onUpdateReference(activeReference.id, {
                    scaleX: Math.max(0.01, nw / 1280),
                    scaleY: Math.max(0.01, nh / 720)
                });
            } else if (action.type === 'rotate') {
                const cx = start.x;
                const cy = start.y;
                const currentAngle = Math.atan2(y - cy, x - cx);
                onUpdateReference(activeReference.id, {
                    rotation: start.rotation + (currentAngle - action.startAngle)
                });
            }
            return;
        }

        // --- TRANSFORM DRAG ---
        if (tool === 'transform' && isDraggingSelectionRef.current && floatingSelectionRef.current && transformActionRef.current) {
             const ctx = tempCanvasRef.current?.getContext('2d');
             if (!ctx) return;
             
             const action = transformActionRef.current;
             const fs = floatingSelectionRef.current;
             const start = action.startParam;
             
             if (action.type === 'move') {
                 // Move logic (taking rotation into account, but movement is always screen space)
                 fs.x = start.x + (x - action.startX);
                 fs.y = start.y + (y - action.startY);
             } 
             else if (action.type === 'resize') {
                 // Resize Logic
                 // 1. Rotate current mouse pos back to align with unrotated box
                 const cx = start.x + start.w / 2;
                 const cy = start.y + start.h / 2;
                 const p = rotatePoint(x, y, cx, cy, -start.rotation);
                 const sp = rotatePoint(action.startX, action.startY, cx, cy, -start.rotation);
                 
                 const dx = p.x - sp.x;
                 const dy = p.y - sp.y;
                 
                 let nx = start.x;
                 let ny = start.y;
                 let nw = start.w;
                 let nh = start.h;
                 
                 const h = action.handle;
                 
                 if (h.includes('l')) { nx += dx; nw -= dx; }
                 if (h.includes('r')) { nw += dx; }
                 if (h.includes('t')) { ny += dy; nh -= dy; }
                 if (h.includes('b')) { nh += dy; }
                 
                 // Prevent negative size
                 if (nw < 1) nw = 1;
                 if (nh < 1) nh = 1;
                 
                 // 2. We need to adjust position so it scales around the opposite corner/edge
                 // BUT since we calculated in local space relative to center, the center might shift.
                 // The simple approach above works if we rotate back.
                 // Let's recalculate the new center in local space, then rotate it back to world space.
                 
                 // Actually, simpler: we modified the unrotated box (nx, ny, nw, nh).
                 // We need to place this box such that its center is correctly positioned in world space.
                 // The pivot for the resize was implied by the edges we didn't move.
                 
                 // However, since we rotated the mouse points around the OLD center, 
                 // the new box is defined relative to the OLD center.
                 // We need to find the new center of this box in World Space.
                 
                 // Old Center World: (cx, cy)
                 // New Box Local Center relative to (cx, cy) frame:
                 const newLocalCx = nx + nw/2;
                 const newLocalCy = ny + nh/2;
                 
                 // BUT wait, rotatePoint rotates around (cx, cy).
                 // So (nx, ny) are coordinates in the system where (cx, cy) is the pivot?
                 // No, rotatePoint returns absolute coordinates as if the plane was unrotated around (cx,cy).
                 // So (nx, ny) are valid coordinates in that unrotated space.
                 
                 // So the new center in unrotated space is:
                 const ncx_unrotated = nx + nw/2;
                 const ncy_unrotated = ny + nh/2;
                 
                 // Now rotate this new center back by +rotation to get world center
                 const newCenterWorld = rotatePoint(ncx_unrotated, ncy_unrotated, cx, cy, start.rotation);
                 
                 // Now we have the new center and the new dimensions.
                 // The top-left (fs.x, fs.y) should be derived from this new center.
                 // fs.x = newCenterWorld.x - nw/2
                 // fs.y = newCenterWorld.y - nh/2
                 
                 fs.w = nw;
                 fs.h = nh;
                 fs.x = newCenterWorld.x - nw/2;
                 fs.y = newCenterWorld.y - nh/2;
             }
             else if (action.type === 'rotate') {
                 const cx = start.x + start.w / 2;
                 const cy = start.y + start.h / 2;
                 const startAngle = action.startAngle ?? Math.atan2(action.startY - cy, action.startX - cx);
                 const currentAngle = Math.atan2(y - cy, x - cx);
                 fs.rotation = (start.rotation || 0) + (currentAngle - startAngle);
             }

             ctx.clearRect(0, 0, 1280, 720);
             
             // Draw Transformed Image
             ctx.save();
             const cx = fs.x + fs.w / 2;
             const cy = fs.y + fs.h / 2;
             ctx.translate(cx, cy);
             ctx.rotate(fs.rotation || 0);
             ctx.drawImage(fs.image, -fs.w / 2, -fs.h / 2, fs.w, fs.h);
             ctx.restore();
             
             // Draw Handles
             drawTransformHandles(ctx, fs);
             
             return;
        }

        // --- SELECTION DRAWING ---
        if (tool.startsWith('select')) {
             const ctx = tempCanvasRef.current?.getContext('2d');
             if (!ctx) return;
             
             ctx.clearRect(0, 0, 1280, 720);
             ctx.lineWidth = 1;
             ctx.strokeStyle = '#7e22ce'; // purple-700
             ctx.setLineDash([5, 5]);
             
             if (tool === 'select_rect' && selectionRef.current) {
                 const w = x - selectionRef.current.startX;
                 const h = y - selectionRef.current.startY;
                 selectionRef.current.rect = { x: selectionRef.current.startX, y: selectionRef.current.startY, w, h };
                 ctx.strokeRect(selectionRef.current.startX, selectionRef.current.startY, w, h);
             } else if (tool === 'select_free' && selectionRef.current) {
                 selectionRef.current.points.push({x, y});
                 ctx.beginPath();
                 const pts = selectionRef.current.points;
                 ctx.moveTo(pts[0].x, pts[0].y);
                 for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                 ctx.stroke();
             }
             return;
        }

        const canvas = tool === 'eraser' 
            ? containerRef.current?.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`)
            : tempCanvasRef.current;
            
        if (!canvas) return;

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
        
        ctx.save();

        // --- CLIPPING TO SELECTION ---
        if (hasSelection && selectionRef.current && selectionRef.current.layerId === activeLayer?.id) {
             const region = new Path2D();
             if (selectionRef.current.type === 'rect' && selectionRef.current.rect) {
                 const {x, y, w, h} = selectionRef.current.rect;
                 region.rect(x, y, w, h);
                 ctx.clip(region);
             } else if (selectionRef.current.type === 'free' && selectionRef.current.points) {
                 const pts = selectionRef.current.points;
                 if (pts.length > 2) {
                     region.moveTo(pts[0].x, pts[0].y);
                     for(let i=1; i<pts.length; i++) region.lineTo(pts[i].x, pts[i].y);
                     region.closePath();
                     ctx.clip(region);
                 }
             } else if (selectionRef.current.type === 'magic' && selectionRef.current.rect) {
                 const {x, y, w, h} = selectionRef.current.rect;
                 region.rect(x, y, w, h);
                 ctx.clip(region);
             }
        }
        
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
        
        ctx.restore();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            
            if (tool === 'transform') {
                isDraggingSelectionRef.current = false;
                transformActionRef.current = null;
                referenceTransformRef.current = null;
                return;
            }

            if (tool.startsWith('select')) {
                 setHasSelection(true);
                 // Normalize rect if needed
                 if (tool === 'select_rect' && selectionRef.current?.rect) {
                     let {x, y, w, h} = selectionRef.current.rect;
                     if (w < 0) { x += w; w = Math.abs(w); }
                     if (h < 0) { y += h; h = Math.abs(h); }
                     selectionRef.current.rect = {x, y, w, h};
                 }
                 return;
            }

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
            {cursorPos && BRUSH_PRESETS[tool] && tool !== 'transform' && (
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
                className={`relative w-full h-full overflow-hidden touch-none ${cursorPos && BRUSH_PRESETS[tool] && tool !== 'transform' ? 'cursor-none' : ''}`}
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    cursor: tool === 'transform' ? transformCursor : 'crosshair'
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

                {/* Reference Image (Bottom) */}
                {activeReference?.image && (
                    <div 
                        className="absolute pointer-events-none overflow-hidden"
                        style={{
                            left: `${(activeReference.x / 1280) * 100}%`,
                            top: `${(activeReference.y / 720) * 100}%`,
                            width: `${(activeReference.scaleX || 1) * 100}%`,
                            height: `${(activeReference.scaleY || 1) * 100}%`,
                            transform: `translate(-50%, -50%) rotate(${activeReference.rotation || 0}rad)`,
                            opacity: activeReference.opacity !== undefined ? activeReference.opacity : 0.5,
                            zIndex: 0
                        }}
                    >
                        <img 
                            src={activeReference.image} 
                            className="w-full h-full object-fill"
                            style={{ 
                                // Ensure no borders or gaps
                                display: 'block',
                                minWidth: '100%',
                                minHeight: '100%'
                            }}
                            draggable={false}
                        />
                    </div>
                )}

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
    
    // Find all scenes to manage scene-based storyboard
    const allScenes = useMemo(() => {
        const scenes = [];
        pages.forEach(page => {
            page.elements?.forEach(el => {
                if (el.type === ELEMENT_TYPES.SCENE) {
                    scenes.push(el);
                }
            });
        });
        return scenes;
    }, [pages]);

    // Storyboard State
    const [selectedSceneId, setSelectedSceneId] = useState(null);
    
    // Set initial scene if not set
    useEffect(() => {
        if (!selectedSceneId && allScenes.length > 0) {
            setSelectedSceneId(allScenes[0].id);
        }
    }, [allScenes, selectedSceneId]);
    
    // Scoped Data State
    const [frames, setFrames] = useState([]);
    const [dialogues, setDialogues] = useState([]);
    const [animatics, setAnimatics] = useState([]);
    const [audioTracks, setAudioTracks] = useState([]);
    const [referenceTracks, setReferenceTracks] = useState([]);
    const [activeFrameIndex, setActiveFrameIndex] = useState(0);

    // Load data for the selected scene
    useEffect(() => {
        const storyboardData = project?.storyboard_data || {};
        
        // Check if we have scene-based structure
        let sceneData;
        if (storyboardData.scenes && selectedSceneId) {
            sceneData = storyboardData.scenes[selectedSceneId];
        } else if (!storyboardData.scenes && selectedSceneId === allScenes[0]?.id) {
            // Migration: if no scenes structure yet, use top-level data for first scene
            sceneData = {
                frames: storyboardData.frames,
                dialogues: storyboardData.dialogues,
                animatics: storyboardData.animatics,
                audioTracks: storyboardData.audioTracks,
                referenceTracks: storyboardData.referenceTracks
            };
        }

        // Initialize or Load
        if (sceneData) {
            setFrames(sceneData.frames || [{ id: crypto.randomUUID(), layers: [{ id: 'layer-1', name: 'Capa 1', visible: true, data: null }], duration: 1000 }]);
            setDialogues(sceneData.dialogues || []);
            setAnimatics(sceneData.animatics || []);
            setAudioTracks(sceneData.audioTracks || []);
            setReferenceTracks(sceneData.referenceTracks || []);
        } else {
            // New Scene: Default to 1 blank frame
            setFrames([{ id: crypto.randomUUID(), layers: [{ id: 'layer-1', name: 'Capa 1', visible: true, data: null }], duration: 1000 }]);
            setDialogues([]);
            setAnimatics([]);
            setAudioTracks([]);
            setReferenceTracks([]);
        }
        setActiveFrameIndex(0);
        setCurrentTime(0);
        setHistory([]); // Clear undo history when switching scenes
    }, [selectedSceneId, project?.storyboard_data?.scenes === undefined]);

    const [activeElement, setActiveElement] = useState({ type: 'frame', id: null }); // { type: 'frame' | 'dialogue', id: string }
    const [saving, setSaving] = useState(false);
    const saveQueue = useRef(Promise.resolve());
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    
    // Zoom / Timeline State
    const [pixelsPerSecond, setPixelsPerSecond] = useState(50); // Default 50px per second (Time-based scaling)
    const [currentTime, setCurrentTime] = useState(0); // Current playback time in ms
    const [isDraggingRuler, setIsDraggingRuler] = useState(false);
    const [lastMouseX, setLastMouseX] = useState(null);
    const rulerInteractionRef = useRef(null);
    const rulerDragThresholdPx = 4;

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

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const selection = selectedAnimaticKeyframeRef.current;
                if (selection?.elementId && selection?.keyframeId) {
                    e.preventDefault();
                    deleteSelectedAnimaticKeyframe();
                    return;
                }
            }

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

            // Next Frame: ArrowRight
            if (e.key === 'ArrowRight') {
                if (activeFrameIndex < frames.length - 1) {
                    e.preventDefault();
                    const nextIndex = activeFrameIndex + 1;
                    setActiveFrameIndex(nextIndex);
                    
                    // Move playhead to start of next frame
                    let startTime = 0;
                    for (let i = 0; i < nextIndex; i++) {
                        startTime += (frames[i].duration || 1000);
                    }
                    setCurrentTime(startTime);
                }
            }

            // Previous Frame: ArrowLeft
            if (e.key === 'ArrowLeft') {
                if (activeFrameIndex > 0) {
                    e.preventDefault();
                    const prevIndex = activeFrameIndex - 1;
                    setActiveFrameIndex(prevIndex);
                    
                    // Move playhead to start of previous frame
                    let startTime = 0;
                    for (let i = 0; i < prevIndex; i++) {
                        startTime += (frames[i].duration || 1000);
                    }
                    setCurrentTime(startTime);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, frames, dialogues, activeElement, activeFrameIndex, animatics]);

    // Update brush size when tool changes
    useEffect(() => {
        if (BRUSH_PRESETS[tool]) {
            setBrushSize(BRUSH_PRESETS[tool].width);
        }
    }, [tool]);

    // Auto-switch to transform tool when reference is selected
    useEffect(() => {
        if (activeElement.type === 'reference' || activeElement.type === 'animatic') {
            setTool('transform');
        }
    }, [activeElement.id, activeElement.type]);

    const [animaticPreview, setAnimaticPreview] = useState(null);
    const animaticPreviewRef = useRef(null);
    const pendingAnimaticKeyframeEditsRef = useRef(new Map());
    const [draggingAnimatic, setDraggingAnimatic] = useState(null);
    const [selectedAnimaticKeyframe, setSelectedAnimaticKeyframe] = useState(null);
    const selectedAnimaticKeyframeRef = useRef(null);

    useEffect(() => {
        selectedAnimaticKeyframeRef.current = selectedAnimaticKeyframe;
    }, [selectedAnimaticKeyframe]);

    const activeElementRef = useRef(activeElement);

    useEffect(() => {
        const prev = activeElementRef.current;
        activeElementRef.current = activeElement;
        const selection = selectedAnimaticKeyframeRef.current;
        if (!selection) return;
        if (activeElement.type === 'animatic' && activeElement.id === selection.elementId) return;
        commitSelectedAnimaticKeyframePosition(selection);
        setSelectedAnimaticKeyframe(null);
    }, [activeElement]);

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

    // Timeline State
    const [timelineTool, setTimelineTool] = useState('cursor'); // 'cursor', 'scissor'

    // Timeline Splitting Logic
    const handleSplit = (type, id, splitTime) => {
        pushToHistory();

        if (type === 'frame') {
            const index = id;
            const frame = frames[index];
            if (!frame) return;

            // Calculate local split time
            let frameStartTime = 0;
            for (let i = 0; i < index; i++) frameStartTime += (frames[i].duration || 1000);
            
            const splitOffset = splitTime - frameStartTime;
            
            // Check bounds (min 100ms per frame)
            if (splitOffset < 100 || splitOffset > (frame.duration || 1000) - 100) return;

            const firstDuration = splitOffset;
            const secondDuration = (frame.duration || 1000) - splitOffset;

            // Duplicate frame with same data but different ID and adjusted duration
            const firstFrame = { ...frame, duration: firstDuration };
            const secondFrame = { 
                ...JSON.parse(JSON.stringify(frame)), // Deep copy layers/data
                id: crypto.randomUUID(), 
                duration: secondDuration 
            };

            const newFrames = [...frames];
            newFrames.splice(index, 1, firstFrame, secondFrame);
            setFrames(newFrames);
            
            // Restore tool to cursor
            setTimelineTool('cursor');
            
        } else if (type === 'dialogue') {
            const dialogue = dialogues.find(d => d.id === id);
            if (!dialogue) return;

            const splitOffset = splitTime - dialogue.startTime;
            if (splitOffset < 100 || splitOffset > dialogue.duration - 100) return;

            const firstDuration = splitOffset;
            const secondDuration = dialogue.duration - splitOffset;

            const firstPart = { ...dialogue, duration: firstDuration };
            const secondPart = {
                ...dialogue,
                id: crypto.randomUUID(),
                startTime: dialogue.startTime + firstDuration,
                duration: secondDuration,
                text: `${dialogue.text} (Parte 2)`
            };

            setDialogues(prev => {
                const filtered = prev.filter(d => d.id !== id);
                return [...filtered, firstPart, secondPart];
            });

            setTimelineTool('cursor');

        } else if (type === 'audio') {
            const track = audioTracks.find(t => t.id === id);
            if (!track) return;

            const splitOffset = splitTime - track.startTime;
            if (splitOffset < 100 || splitOffset > track.duration - 100) return;

            const firstDuration = splitOffset;
            const secondDuration = track.duration - splitOffset;

            const firstPart = { ...track, duration: firstDuration };
            const secondPart = {
                ...track,
                id: crypto.randomUUID(),
                startTime: track.startTime + firstDuration,
                duration: secondDuration,
                name: `${track.name} (Parte 2)`,
                offset: (track.offset || 0) + firstDuration
            };

            setAudioTracks(prev => {
                const filtered = prev.filter(t => t.id !== id);
                return [...filtered, firstPart, secondPart];
            });

            setTimelineTool('cursor');
        } else if (type === 'reference') {
            const track = referenceTracks.find(t => t.id === id);
            if (!track) return;

            const splitOffset = splitTime - track.startTime;
            if (splitOffset < 100 || splitOffset > track.duration - 100) return;

            const firstDuration = splitOffset;
            const secondDuration = track.duration - splitOffset;

            const firstPart = { ...track, duration: firstDuration };
            const secondPart = {
                ...track,
                id: crypto.randomUUID(),
                startTime: track.startTime + firstDuration,
                duration: secondDuration,
                name: `${track.name} (Parte 2)`
            };

            setReferenceTracks(prev => {
                const filtered = prev.filter(t => t.id !== id);
                return [...filtered, firstPart, secondPart];
            });

            setTimelineTool('cursor');
        }
    };

    // Playback Logic (Time-based)
    useEffect(() => {
        let animationFrameId;
        
        if (isPlaying) {
            let startTimestamp = Date.now();
            let initialTime = currentTime;
            const framesDurationMs = frames.reduce((acc, f) => acc + (f.duration || 1000), 0);
            const dialoguesEndMs = dialogues.reduce((acc, d) => Math.max(acc, (d.startTime || 0) + (d.duration || 0)), 0);
            const audioEndMs = audioTracks.reduce((acc, t) => Math.max(acc, (t.startTime || 0) + (t.duration || 0)), 0);
            const referencesEndMs = referenceTracks.reduce((acc, r) => Math.max(acc, (r.startTime || 0) + (r.duration || 0)), 0);
            const animaticsEndMs = animatics.reduce((acc, a) => Math.max(acc, (a.startTime || 0) + (a.duration || 0)), 0);
            const totalDuration = Math.max(framesDurationMs, dialoguesEndMs, audioEndMs, referencesEndMs, animaticsEndMs);

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
    }, [isPlaying, isLooping, frames, dialogues, audioTracks, referenceTracks, animatics, currentTime]);

    // Initialize if empty
    useEffect(() => {
        if (frames.length === 0) {
            const initialFrame = { id: crypto.randomUUID(), drawing: null, order: 0, duration: 1000 };
            setFrames([initialFrame]);
        }
    }, []);

    const activeFrame = frames[activeFrameIndex] || frames[0];
    const activeAnimatic = activeElement.type === 'animatic' ? animatics.find(a => a.id === activeElement.id) : null;
    const isEditingAnimaticCanvas = activeElement.type === 'animatic' && tool !== 'transform';
    const activeCanvasModel = isEditingAnimaticCanvas ? activeAnimatic : activeFrame;
    const layers = activeCanvasModel?.layers || (activeCanvasModel?.drawing ? [{ id: 'default', name: 'Capa 1', visible: true, data: activeCanvasModel.drawing }] : [{ id: 'default', name: 'Capa 1', visible: true, data: null }]);
    const activeLayerObj = layers.find(l => l.id === activeLayerId) || layers[layers.length - 1];

    // Sync activeLayerId when changing frames
    useEffect(() => {
        if (activeElement.type !== 'frame' && activeElement.type !== 'animatic') return;

        // If activeLayerId is not in current layers, reset to top layer
        if (!activeLayerId || !layers.find(l => l.id === activeLayerId)) {
            if (layers.length > 0) {
                setActiveLayerId(layers[layers.length - 1].id);
            }
        }
    }, [activeFrameIndex, activeElement, layers, activeLayerId]);

    // Save State & Refs
    const isDirtyRef = useRef(false);
    const saveDataRef = useRef(null);

    // Keep latest saveData function in ref for unmount cleanup
    useEffect(() => {
        saveDataRef.current = saveData;
    });

    // Save on unmount
    useEffect(() => {
        return () => {
            if (isDirtyRef.current && saveDataRef.current) {
                saveDataRef.current();
            }
        };
    }, []);

    // Save debouncer
    useEffect(() => {
        if (!project) return;
        
        // Mark as dirty whenever dependencies change
        isDirtyRef.current = true;

        const timer = setTimeout(() => {
            saveData();
        }, 2000);
        return () => clearTimeout(timer);
    }, [frames, dialogues, animatics, audioTracks, referenceTracks]);

    const saveData = async () => {
        // Mark as clean immediately so subsequent changes trigger new dirty state
        isDirtyRef.current = false;
        
        if (!selectedSceneId) return;
        
        // Capture data from closure synchronously
        const dataToSave = {
            frames,
            dialogues,
            animatics,
            audioTracks,
            referenceTracks
        };
        const sceneId = selectedSceneId;
        const currentProject = project;

        // Queue the save operation to ensure serialization
        saveQueue.current = saveQueue.current.then(async () => {
            setSaving(true);
            try {
                const currentStoryboardData = currentProject?.storyboard_data || {};
                const updatedScenes = {
                    ...(currentStoryboardData.scenes || {}),
                    [sceneId]: dataToSave
                };

                const newStoryboardData = {
                    ...currentStoryboardData,
                    scenes: updatedScenes
                };

                const { error } = await supabase
                    .from('proyectos_cineasta')
                    .update({ storyboard_data: newStoryboardData })
                    .eq('id', currentProject.id);

                if (error) throw error;
                if (onUpdateProject) {
                    onUpdateProject({ storyboard_data: newStoryboardData });
                }
            } catch (error) {
                console.error('Error saving storyboard:', error);
            } finally {
                setSaving(false);
            }
        });
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

    const addReference = () => {
        // Calculate current time based on active frame
        let currentTime = 0;
        for (let i = 0; i < activeFrameIndex; i++) {
             currentTime += (frames[i].duration || 1000);
        }

        const newRef = {
            id: crypto.randomUUID(),
            name: 'Nueva Referencia',
            startTime: currentTime,
            duration: 2000
        };

        setReferenceTracks([...referenceTracks, newRef]);
        setActiveElement({ type: 'reference', id: newRef.id });
        setTool('transform');
    };

    const getAnimaticPositionAtTime = (element, timeMs) => {
        if (!element) return { x: 0, y: 0 };
        const t = Math.round(timeMs);
        const keyframes = Array.isArray(element.keyframes) ? [...element.keyframes] : [];
        keyframes.sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
        if (keyframes.length === 0) return { x: 0, y: 0 };

        const getValue = (k) => {
            const pending = pendingAnimaticKeyframeEditsRef.current.get(k.id);
            if (pending && pending.elementId === element.id) return { x: pending.x, y: pending.y };
            return { x: k.value?.x || 0, y: k.value?.y || 0 };
        };

        const first = keyframes[0];
        if (t <= first.timeMs) return getValue(first);

        const last = keyframes[keyframes.length - 1];
        if (t >= last.timeMs) return getValue(last);

        for (let i = 0; i < keyframes.length - 1; i++) {
            const a = keyframes[i];
            const b = keyframes[i + 1];
            if (t >= a.timeMs && t <= b.timeMs) {
                const span = b.timeMs - a.timeMs;
                const k = span <= 0 ? 0 : (t - a.timeMs) / span;
                const av = getValue(a);
                const bv = getValue(b);
                const ax = av.x;
                const ay = av.y;
                const bx = bv.x;
                const by = bv.y;
                return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k };
            }
        }

        return { x: 0, y: 0 };
    };

    const updateAnimatic = (id, data) => {
        setAnimatics(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    };

    const commitSelectedAnimaticKeyframePosition = (selection) => {
        if (!selection?.elementId || !selection?.keyframeId) return;
        const el = animatics.find(a => a.id === selection.elementId);
        if (!el) return;
        const keyframes = Array.isArray(el.keyframes) ? [...el.keyframes] : [];
        const idx = keyframes.findIndex(k => k.id === selection.keyframeId);
        if (idx < 0) return;

        const timeMs = Math.round(keyframes[idx].timeMs || 0);
        const pending = pendingAnimaticKeyframeEditsRef.current.get(selection.keyframeId);
        const pos = pending && pending.elementId === selection.elementId
            ? { x: pending.x, y: pending.y }
            : getAnimaticPositionAtTime(el, timeMs);

        keyframes[idx] = {
            ...keyframes[idx],
            timeMs,
            value: { x: pos.x, y: pos.y }
        };
        keyframes.sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
        updateAnimatic(el.id, { keyframes });

        pendingAnimaticKeyframeEditsRef.current.delete(selection.keyframeId);
        animaticPreviewRef.current = null;
        setAnimaticPreview(null);
    };

    const setActiveElementWithCommit = (next) => {
        const prevSelection = selectedAnimaticKeyframeRef.current;
        if (prevSelection && (next.type !== 'animatic' || next.id !== prevSelection.elementId)) {
            commitSelectedAnimaticKeyframePosition(prevSelection);
            setSelectedAnimaticKeyframe(null);
        }
        setActiveElement(next);
    };

    const addAnimaticElement = () => {
        const startTime = Math.max(0, Math.round(currentTime));
        const firstKeyframeId = crypto.randomUUID();
        const newElement = {
            id: crypto.randomUUID(),
            name: `Animatic ${animatics.length + 1}`,
            startTime,
            duration: 2000,
            layers: [{ id: 'layer-1', name: 'Capa 1', visible: true, data: null }],
            keyframes: [{ id: firstKeyframeId, timeMs: startTime, value: { x: 0, y: 0 } }]
        };
        setAnimatics(prev => [...prev, newElement]);
        setActiveElement({ type: 'animatic', id: newElement.id });
        setSelectedAnimaticKeyframe({ elementId: newElement.id, keyframeId: firstKeyframeId });
        setCurrentTime(startTime);
        setTool('transform');
    };

    const createAnimaticKeyframe = () => {
        if (activeElement.type !== 'animatic') return;
        const el = animatics.find(a => a.id === activeElement.id);
        if (!el) return;
        const t = Math.round(currentTime);
        if (t < (el.startTime || 0)) return;

        const pos = getAnimaticPositionAtTime(el, t);
        const existingIndex = (el.keyframes || []).findIndex(k => Math.abs((k.timeMs || 0) - t) <= 10);
        const nextKeyframes = Array.isArray(el.keyframes) ? [...el.keyframes] : [];

        if (existingIndex >= 0) {
            nextKeyframes[existingIndex] = { ...nextKeyframes[existingIndex], timeMs: t, value: { x: pos.x, y: pos.y } };
        } else {
            nextKeyframes.push({ id: crypto.randomUUID(), timeMs: t, value: { x: pos.x, y: pos.y } });
        }
        nextKeyframes.sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));

        const endNeeded = t - (el.startTime || 0) + 500;
        const nextDuration = Math.max(el.duration || 0, endNeeded, 300);

        updateAnimatic(el.id, { keyframes: nextKeyframes, duration: nextDuration });

        const selected = nextKeyframes.find(k => Math.abs((k.timeMs || 0) - t) <= 0) || nextKeyframes.find(k => Math.abs((k.timeMs || 0) - t) <= 10);
        if (selected) setSelectedAnimaticKeyframe({ elementId: el.id, keyframeId: selected.id });
    };

    const deleteSelectedAnimaticKeyframe = () => {
        const selection = selectedAnimaticKeyframeRef.current;
        if (!selection?.elementId || !selection?.keyframeId) return;
        const el = animatics.find(a => a.id === selection.elementId);
        if (!el) return;
        const keyframes = Array.isArray(el.keyframes) ? [...el.keyframes] : [];
        if (keyframes.length <= 1) {
            alert('No puedes eliminar el último keyframe.');
            return;
        }
        const idx = keyframes.findIndex(k => k.id === selection.keyframeId);
        if (idx < 0) return;
        const nextKeyframes = keyframes.filter((_, i) => i !== idx).sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
        updateAnimatic(el.id, { keyframes: nextKeyframes });
        pendingAnimaticKeyframeEditsRef.current.delete(selection.keyframeId);

        const nextIndex = Math.min(idx, nextKeyframes.length - 1);
        const next = nextKeyframes[nextIndex];
        if (next) {
            setSelectedAnimaticKeyframe({ elementId: el.id, keyframeId: next.id });
            setCurrentTime(Math.round(next.timeMs || 0));
        } else {
            setSelectedAnimaticKeyframe(null);
        }
    };

    useEffect(() => {
        if (!draggingAnimatic) return;

        const handleMove = (e) => {
            const container = document.getElementById('main-canvas-container');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const sx = 1280 / rect.width;
            const sy = 720 / rect.height;
            const dx = (e.clientX - draggingAnimatic.startClientX) * sx;
            const dy = (e.clientY - draggingAnimatic.startClientY) * sy;
            setAnimaticPreview({
                elementId: draggingAnimatic.elementId,
                timeMs: draggingAnimatic.timeMs,
                x: draggingAnimatic.startX + dx,
                y: draggingAnimatic.startY + dy
            });
            animaticPreviewRef.current = {
                elementId: draggingAnimatic.elementId,
                timeMs: draggingAnimatic.timeMs,
                x: draggingAnimatic.startX + dx,
                y: draggingAnimatic.startY + dy
            };

            if (draggingAnimatic.keyframeId) {
                pendingAnimaticKeyframeEditsRef.current.set(draggingAnimatic.keyframeId, {
                    elementId: draggingAnimatic.elementId,
                    timeMs: draggingAnimatic.timeMs,
                    x: draggingAnimatic.startX + dx,
                    y: draggingAnimatic.startY + dy
                });
            }
        };

        const handleUp = () => {
            const selection = selectedAnimaticKeyframeRef.current;
            if (selection && selection.elementId === draggingAnimatic.elementId) commitSelectedAnimaticKeyframePosition(selection);
            animaticPreviewRef.current = null;
            setAnimaticPreview(null);
            setDraggingAnimatic(null);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [draggingAnimatic, animatics, selectedAnimaticKeyframe]);

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
        rulerInteractionRef.current = { startClientX: e.clientX, didDrag: false };
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
    const [draggingReference, setDraggingReference] = useState(null); // { id, startX, initialStartTime }
    const [draggingTimelineAnimatic, setDraggingTimelineAnimatic] = useState(null); // { id, startX, initialStartTime }
    const referenceFileInputRef = useRef(null);

    const handleUploadReferenceImage = async (e, referenceId) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona una imagen válida.');
            return;
        }

        setSaving(true);
        try {
            const fileName = `ref_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
            const { data, error } = await supabase.storage
                .from('project_assets')
                .upload(fileName, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('project_assets')
                .getPublicUrl(fileName);

            setReferenceTracks(prev => prev.map(r => 
                r.id === referenceId 
                ? { 
                    ...r, 
                    image: publicUrl,
                    x: 640,
                    y: 360,
                    scaleX: 0.5,
                    scaleY: 0.5,
                    rotation: 0,
                    opacity: 0.5
                } 
                : r
            ));
        } catch (error) {
            console.error('Error uploading reference image:', error);
            alert('Error al subir la imagen.');
        } finally {
            setSaving(false);
            if (referenceFileInputRef.current) referenceFileInputRef.current.value = '';
        }
    };

    const [draggingFrameIndex, setDraggingFrameIndex] = useState(null);
    const [dropTargetIndex, setDropTargetIndex] = useState(null);

    // Timeline Resizing States
    const [resizingTarget, setResizingTarget] = useState(null); // { type, id/index, edge, startX, initialDuration, initialStartTime, initialOffset }

    const handleResizeMouseDown = (e, type, id, edge, initialDuration, initialStartTime = 0, initialOffset = 0) => {
        e.stopPropagation();
        setResizingTarget({
            type,
            id,
            edge,
            startX: e.clientX,
            initialDuration,
            initialStartTime,
            initialOffset
        });
    };

    const handleTimelineDialogueMouseDown = (e, dialogue) => {
        if (timelineTool === 'scissor') {
            e.stopPropagation();
            const tracksArea = document.getElementById('timeline-tracks-area');
            if (!tracksArea) return;
            const rect = tracksArea.getBoundingClientRect();
            const scrollLeft = tracksArea.scrollLeft;
            const clickX = e.clientX - rect.left + scrollLeft;
            const clickTime = (clickX / pixelsPerSecond) * 1000;
            
            const playheadX = (currentTime / 1000) * pixelsPerSecond;
            const diff = Math.abs(clickX - playheadX);
            const finalSplitTime = (diff < 10) ? currentTime : clickTime;
            
            handleSplit('dialogue', dialogue.id, finalSplitTime);
            return;
        }

        e.stopPropagation();
        setDraggingTimelineDialogue({
            id: dialogue.id,
            startX: e.clientX,
            initialStartTime: dialogue.startTime
        });
        setActiveElementWithCommit({ type: 'dialogue', id: dialogue.id });
    };

    const handleAudioMouseDown = (e, audio) => {
        if (timelineTool === 'scissor') {
            e.stopPropagation();
            const tracksArea = document.getElementById('timeline-tracks-area');
            if (!tracksArea) return;
            const rect = tracksArea.getBoundingClientRect();
            const scrollLeft = tracksArea.scrollLeft;
            const clickX = e.clientX - rect.left + scrollLeft;
            const clickTime = (clickX / pixelsPerSecond) * 1000;
            
            const playheadX = (currentTime / 1000) * pixelsPerSecond;
            const diff = Math.abs(clickX - playheadX);
            const finalSplitTime = (diff < 10) ? currentTime : clickTime;
            
            handleSplit('audio', audio.id, finalSplitTime);
            return;
        }

        e.stopPropagation();
        setDraggingAudio({
            id: audio.id,
            startX: e.clientX,
            initialStartTime: audio.startTime
        });
        // We can reuse 'activeElement' but type='audio'
        setActiveElementWithCommit({ type: 'audio', id: audio.id });
    };

    const handleReferenceMouseDown = (e, ref) => {
        if (timelineTool === 'scissor') {
            e.stopPropagation();
            const tracksArea = document.getElementById('timeline-tracks-area');
            if (!tracksArea) return;
            const rect = tracksArea.getBoundingClientRect();
            const scrollLeft = tracksArea.scrollLeft;
            const clickX = e.clientX - rect.left + scrollLeft;
            const clickTime = (clickX / pixelsPerSecond) * 1000;
            
            const playheadX = (currentTime / 1000) * pixelsPerSecond;
            const diff = Math.abs(clickX - playheadX);
            const finalSplitTime = (diff < 10) ? currentTime : clickTime;
            
            handleSplit('reference', ref.id, finalSplitTime);
            return;
        }

        e.stopPropagation();
        setDraggingReference({
            id: ref.id,
            startX: e.clientX,
            initialStartTime: ref.startTime
        });
        setActiveElementWithCommit({ type: 'reference', id: ref.id });
        setTool('transform');
    };

    const handleFrameMouseDown = (e, index) => {
        if (timelineTool === 'scissor') {
            e.stopPropagation();
            const tracksArea = document.getElementById('timeline-tracks-area');
            if (!tracksArea) return;
            const rect = tracksArea.getBoundingClientRect();
            const scrollLeft = tracksArea.scrollLeft;
            const clickX = e.clientX - rect.left + scrollLeft;
            const clickTime = (clickX / pixelsPerSecond) * 1000;
            
            const playheadX = (currentTime / 1000) * pixelsPerSecond;
            const diff = Math.abs(clickX - playheadX);
            const finalSplitTime = (diff < 10) ? currentTime : clickTime;
            
            handleSplit('frame', index, finalSplitTime);
            return;
        }

        e.stopPropagation();
        setDraggingFrameIndex(index);
        setActiveFrameIndex(index);
        setActiveElementWithCommit({ type: 'frame', id: null });
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
        } else if (target.type === 'reference') {
            const id = target.id;
            setReferenceTracks(prev => prev.filter(r => r.id !== id));
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
        } else if (target.type === 'reference') {
            const id = target.id;
            const originalRef = referenceTracks.find(r => r.id === id);
            if (!originalRef) return;

            const insertTime = originalRef.startTime + originalRef.duration;
            const shiftAmount = originalRef.duration;

            // Shift all references that start >= insertTime
            setReferenceTracks(prev => {
                const shiftedRefs = prev.map(r => {
                    if (r.startTime >= insertTime - 1) { 
                        return { ...r, startTime: r.startTime + shiftAmount };
                    }
                    return r;
                });

                const newRef = {
                    ...originalRef,
                    id: crypto.randomUUID(),
                    startTime: insertTime
                };

                return [...shiftedRefs, newRef];
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
                const interaction = rulerInteractionRef.current;
                const startClientX = interaction?.startClientX ?? e.clientX;
                const totalDx = Math.abs(e.clientX - startClientX);

                if (totalDx >= rulerDragThresholdPx) {
                    if (interaction && !interaction.didDrag) {
                        interaction.didDrag = true;
                        const deltaX = e.clientX - startClientX;
                        setLastMouseX(e.clientX);
                        setPixelsPerSecond(prev => {
                            const newWidth = prev + (deltaX * 0.5);
                            return Math.max(10, Math.min(200, newWidth)); // Min 10px/s, Max 200px/s
                        });
                        return;
                    }

                    if (lastMouseX === null) {
                        setLastMouseX(e.clientX);
                        return;
                    }

                    const deltaX = e.clientX - lastMouseX;
                    setLastMouseX(e.clientX);
        
                    setPixelsPerSecond(prev => {
                        const newWidth = prev + (deltaX * 0.5);
                        return Math.max(10, Math.min(200, newWidth)); // Min 10px/s, Max 200px/s
                    });
                }
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
                        
                        let newDuration, newStartTime;

                        if (resizingTarget.edge === 'right') {
                            newDuration = Math.max(1000, resizingTarget.initialDuration + timeDelta);
                            return { ...a, duration: newDuration };
                        } else {
                            // Left edge
                            newDuration = resizingTarget.initialDuration - timeDelta;
                            newStartTime = resizingTarget.initialStartTime + timeDelta;
                            
                            // Calculate new offset (trim from start)
                            // If timeDelta is positive (moved right), offset increases.
                            let newOffset = (resizingTarget.initialOffset || 0) + timeDelta;

                            if (newDuration < 1000) {
                                newDuration = 1000;
                                const diff = 1000 - (resizingTarget.initialDuration - timeDelta);
                                // Adjust start time back
                                newStartTime = resizingTarget.initialStartTime + timeDelta - diff; 
                                // Actually simple math: newStartTime = initialStartTime + (initialDuration - 1000)
                                newStartTime = resizingTarget.initialStartTime + (resizingTarget.initialDuration - 1000);
                                
                                // Adjust offset back
                                newOffset = (resizingTarget.initialOffset || 0) + (resizingTarget.initialDuration - 1000);
                            }
                            
                            // Ensure offset is not negative (can't start before 0)
                            if (newOffset < 0) {
                                newOffset = 0;
                                // If offset hits 0, start time is constrained by original start time - original offset
                                // newStartTime = resizingTarget.initialStartTime - resizingTarget.initialOffset
                                // But simpler: newStartTime = resizingTarget.initialStartTime + timeDelta
                                // If timeDelta makes offset < 0, it means we dragged way left beyond original start of file.
                                // We should clamp newStartTime.
                                // timeDelta = newOffset - initialOffset. If newOffset=0, timeDelta = -initialOffset.
                                const limitDelta = -(resizingTarget.initialOffset || 0);
                                newStartTime = resizingTarget.initialStartTime + limitDelta;
                                newDuration = resizingTarget.initialDuration - limitDelta;
                            }

                            return { ...a, startTime: newStartTime, duration: newDuration, offset: newOffset };
                        }
                    }));
                } else if (resizingTarget.type === 'reference') {
                    setReferenceTracks(prev => prev.map(r => {
                        if (r.id !== resizingTarget.id) return r;

                        let newDuration, newStartTime;

                        if (resizingTarget.edge === 'right') {
                            newDuration = Math.max(500, resizingTarget.initialDuration + timeDelta);
                            return { ...r, duration: newDuration };
                        } else {
                            // Left edge
                            newDuration = resizingTarget.initialDuration - timeDelta;
                            newStartTime = resizingTarget.initialStartTime + timeDelta;

                            if (newDuration < 500) {
                                newDuration = 500;
                                newStartTime = resizingTarget.initialStartTime + (resizingTarget.initialDuration - 500);
                            }
                            return { ...r, startTime: newStartTime, duration: newDuration };
                        }
                    }));
                } else if (resizingTarget.type === 'animatic') {
                    setAnimatics(prev => prev.map(a => {
                        if (a.id !== resizingTarget.id) return a;

                        const startTime = a.startTime || 0;
                        const duration = a.duration || 0;
                        const initialStartTime = resizingTarget.initialStartTime ?? startTime;
                        const initialDuration = resizingTarget.initialDuration ?? duration;

                        if (resizingTarget.edge === 'right') {
                            const newDuration = Math.max(300, initialDuration + timeDelta);
                            return { ...a, duration: newDuration };
                        }

                        let newDuration = initialDuration - timeDelta;
                        let newStartTime = initialStartTime + timeDelta;

                        if (newDuration < 300) {
                            newDuration = 300;
                            newStartTime = initialStartTime + (initialDuration - 300);
                        }

                        newStartTime = Math.max(0, newStartTime);
                        return { ...a, startTime: newStartTime, duration: newDuration };
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
                const newTime = Math.max(0, (x / pixelsPerSecond) * 1000);
                setCurrentTime(newTime);

                // Sync active frame
                let accumulatedTime = 0;
                let newActiveIndex = frames.length - 1;
                for (let i = 0; i < frames.length; i++) {
                    const duration = frames[i].duration || 1000;
                    if (newTime >= accumulatedTime && newTime < accumulatedTime + duration) {
                        newActiveIndex = i;
                        break;
                    }
                    accumulatedTime += duration;
                }
                setActiveFrameIndex(newActiveIndex);
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

            // Reference Dragging
            if (draggingReference) {
                const deltaX = e.clientX - draggingReference.startX;
                const deltaTime = (deltaX / pixelsPerSecond) * 1000;
                const newStartTime = Math.max(0, draggingReference.initialStartTime + deltaTime);
                
                setReferenceTracks(prev => prev.map(r => 
                    r.id === draggingReference.id 
                    ? { ...r, startTime: newStartTime } 
                    : r
                ));
            }

            // Timeline Animatics Dragging
            if (draggingTimelineAnimatic) {
                const deltaX = e.clientX - draggingTimelineAnimatic.startX;
                const deltaTime = (deltaX / pixelsPerSecond) * 1000;
                const nextStartTime = Math.max(0, Math.round(draggingTimelineAnimatic.initialStartTime + deltaTime));
                const shift = nextStartTime - Math.round(draggingTimelineAnimatic.initialStartTime);

                setAnimatics(prev => prev.map(a => {
                    if (a.id !== draggingTimelineAnimatic.id) return a;

                    const baseTimes = new Map((draggingTimelineAnimatic.initialKeyframes || []).map(k => [k.id, Math.round(k.timeMs || 0)]));
                    const keyframes = Array.isArray(a.keyframes)
                        ? a.keyframes
                            .map(k => {
                                const base = baseTimes.has(k.id) ? baseTimes.get(k.id) : Math.round(k.timeMs || 0);
                                return {
                                    ...k,
                                    timeMs: Math.max(0, Math.round(base + shift))
                                };
                            })
                            .sort((x, y) => (x.timeMs || 0) - (y.timeMs || 0))
                        : a.keyframes;

                    return { ...a, startTime: nextStartTime, keyframes };
                }));
            }
        };

        const handleMouseUp = () => {
            // Frame Reordering
            if (draggingFrameIndex !== null && dropTargetIndex !== null) {
                moveFrame(draggingFrameIndex, dropTargetIndex);
            }

            if (isDraggingRuler) {
                const interaction = rulerInteractionRef.current;
                if (interaction && !interaction.didDrag) {
                    const tracksArea = document.getElementById('timeline-tracks-area');
                    if (tracksArea) {
                        const rect = tracksArea.getBoundingClientRect();
                        const scrollLeft = tracksArea.scrollLeft;
                        const clickX = interaction.startClientX - rect.left + scrollLeft;
                        const newTime = Math.max(0, (clickX / pixelsPerSecond) * 1000);
                        setCurrentTime(newTime);

                        // Sync active frame
                        let accumulatedTime = 0;
                        let newActiveIndex = frames.length - 1;
                        for (let i = 0; i < frames.length; i++) {
                            const duration = frames[i].duration || 1000;
                            if (newTime >= accumulatedTime && newTime < accumulatedTime + duration) {
                                newActiveIndex = i;
                                break;
                            }
                            accumulatedTime += duration;
                        }
                        setActiveFrameIndex(newActiveIndex);
                    }
                }
            }

            setIsDraggingRuler(false);
            setIsDraggingPlayhead(false);
            setDraggingTimelineDialogue(null);
            setDraggingAudio(null);
            setDraggingReference(null);
            setDraggingTimelineAnimatic(null);
            setDraggingFrameIndex(null);
            setDropTargetIndex(null);
            setResizingTarget(null);
            setLastMouseX(null);
            rulerInteractionRef.current = null;
        };

        if (isDraggingRuler || isDraggingPlayhead || draggingTimelineDialogue || draggingAudio || draggingReference || draggingTimelineAnimatic || draggingFrameIndex !== null || resizingTarget) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingRuler, isDraggingPlayhead, draggingTimelineDialogue, draggingAudio, draggingReference, draggingTimelineAnimatic, draggingFrameIndex, dropTargetIndex, lastMouseX, pixelsPerSecond, frames, resizingTarget]);

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
                        audio.currentTime = (currentTime - track.startTime + (track.offset || 0)) / 1000;
                        audio.play().catch(e => console.error("Audio play failed", e));
                    } else {
                        // Sync check (if drift > 0.1s)
                        const expectedTime = (currentTime - track.startTime + (track.offset || 0)) / 1000;
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
                                <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100 shadow-sm">
                                    <Film size={14} className="text-purple-600" />
                                    <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                                        Escena {(() => {
                                            const sceneIndex = allScenes.findIndex(s => s.id === selectedSceneId);
                                            return sceneIndex !== -1 ? sceneIndex + 1 : '—';
                                        })()}
                                    </span>
                                </div>

                                <div className="w-[1px] h-6 bg-gray-200 mx-2" />
                                
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Editor</span>

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

                                {/* Export PDF Button */}
                                <button 
                                    onClick={() => setIsExportModalOpen(true)}
                                    className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all flex items-center gap-2 text-xs font-bold"
                                    title="Exportar a PDF"
                                >
                                    <Download size={14} />
                                    <span>Exportar PDF</span>
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
                                <div className="flex items-center gap-2">
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
                                                            className={`group flex items-center justify-between p-2 cursor-pointer border-b border-gray-50 last:border-0 ${
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

                                    <div
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium max-w-[140px] truncate"
                                        title={activeLayerObj?.name || ''}
                                    >
                                        {activeLayerObj?.name || '—'}
                                    </div>
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
                        ) : activeElement.type === 'reference' ? (
                            // REFERENCE EDITOR
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Editar Referencia</span>
                                    <button 
                                        onClick={() => setActiveElement({ type: 'frame', id: null })}
                                        className="text-xs text-purple-600 hover:underline"
                                    >
                                        Volver
                                    </button>
                                </div>

                                {(() => {
                                    const activeRef = referenceTracks.find(r => r.id === activeElement.id);
                                    if (!activeRef) return null;

                                    return (
                                        <>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-gray-500">Nombre de Referencia</label>
                                                <input 
                                                    type="text"
                                                    value={activeRef.name}
                                                    onChange={(e) => setReferenceTracks(prev => prev.map(r => r.id === activeRef.id ? { ...r, name: e.target.value } : r))}
                                                    className="w-full border border-gray-300 rounded p-2 text-sm"
                                                    placeholder="Nombre de la referencia..."
                                                />
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-gray-500">Imagen de Referencia</label>
                                                <div className="flex flex-col gap-2">
                                                    {activeRef.image ? (
                                                        <div className="relative group rounded border border-gray-200 overflow-hidden bg-gray-50">
                                                            <img src={activeRef.image} className="w-full h-32 object-contain" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                <button 
                                                                    onClick={() => referenceFileInputRef.current?.click()}
                                                                    className="p-2 bg-white rounded-full text-gray-700 hover:bg-purple-50"
                                                                    title="Cambiar imagen"
                                                                >
                                                                    <RotateCw size={16} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => setReferenceTracks(prev => prev.map(r => r.id === activeRef.id ? { ...r, image: null } : r))}
                                                                    className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50"
                                                                    title="Eliminar imagen"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => referenceFileInputRef.current?.click()}
                                                            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-all bg-gray-50"
                                                        >
                                                            <Plus size={24} />
                                                            <span className="text-xs font-medium">Subir Imagen</span>
                                                        </button>
                                                    )}
                                                    <input 
                                                        type="file" 
                                                        ref={referenceFileInputRef}
                                                        onChange={(e) => handleUploadReferenceImage(e, activeRef.id)}
                                                        className="hidden"
                                                        accept="image/*"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-bold text-gray-500">Opacidad</label>
                                                    <span className="text-xs font-mono text-gray-500">{Math.round((activeRef.opacity !== undefined ? activeRef.opacity : 0.5) * 100)}%</span>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="1" 
                                                    step="0.05"
                                                    value={activeRef.opacity !== undefined ? activeRef.opacity : 0.5}
                                                    onChange={(e) => setReferenceTracks(prev => prev.map(r => r.id === activeRef.id ? { ...r, opacity: parseFloat(e.target.value) } : r))}
                                                    className="w-full accent-purple-600"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-gray-500">Duración</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        min="100"
                                                        step="100"
                                                        value={activeRef.duration}
                                                        onChange={(e) => setReferenceTracks(prev => prev.map(r => r.id === activeRef.id ? { ...r, duration: parseInt(e.target.value) } : r))}
                                                        className="w-full border border-gray-300 rounded p-1 text-sm"
                                                    />
                                                    <span className="text-xs text-gray-500">ms</span>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => {
                                                    if (confirm('¿Eliminar referencia?')) {
                                                        setReferenceTracks(prev => prev.filter(r => r.id !== activeRef.id));
                                                        setActiveElement({ type: 'frame', id: null });
                                                    }
                                                }}
                                                className="mt-4 bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Trash2 size={14} /> Eliminar Referencia
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
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        <PenTool size={12} /> Herramientas
                                    </label>
                                    {activeElement.type === 'reference' && (
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                            MODO REFERENCIA
                                        </span>
                                    )}
                                </div>
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
                                                onClick={() => {
                                                    if (activeElement.type === 'reference') {
                                                        setActiveElement({ type: 'frame', id: null });
                                                    }
                                                    setTool(key);
                                                }}
                                                title={preset.name}
                                                className={`flex items-center justify-center p-2 rounded-lg border transition-all aspect-square ${
                                                    tool === key 
                                                    ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500' 
                                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                                                } ${activeElement.type === 'reference' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                            >
                                                <Icon size={20} strokeWidth={key === 'marker' ? 3 : 2} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Brush Size Control */}
                            <div className={`flex flex-col gap-2 ${activeElement.type === 'reference' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
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
                            <div className={`flex flex-col gap-2 ${activeElement.type === 'reference' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
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
                            <div className={`flex flex-col gap-2 ${activeElement.type === 'reference' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
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

                            {/* Selección y Transformación */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Selección
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => {
                                            if (activeElement.type === 'reference') {
                                                setActiveElement({ type: 'frame', id: null });
                                            }
                                            setTool('select_rect');
                                        }}
                                        title="Selección Cuadrada"
                                        className={`flex items-center justify-center p-2 rounded-lg border transition-all aspect-square ${
                                            tool === 'select_rect'
                                            ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500'
                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                                        } ${activeElement.type === 'reference' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                    >
                                        <BoxSelect size={20} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (activeElement.type === 'reference') {
                                                setActiveElement({ type: 'frame', id: null });
                                            }
                                            setTool('select_free');
                                        }}
                                        title="Selección Dibujada"
                                        className={`flex items-center justify-center p-2 rounded-lg border transition-all aspect-square ${
                                            tool === 'select_free'
                                            ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500'
                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                                        } ${activeElement.type === 'reference' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                    >
                                        <Lasso size={20} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (activeElement.type === 'reference') {
                                                setActiveElement({ type: 'frame', id: null });
                                            }
                                            setTool('select_magic');
                                        }}
                                        title="Barita Mágica"
                                        className={`flex items-center justify-center p-2 rounded-lg border transition-all aspect-square ${
                                            tool === 'select_magic'
                                            ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500'
                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                                        } ${activeElement.type === 'reference' ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                    >
                                        <Wand size={20} />
                                    </button>
                                    <button
                                        onClick={() => setTool('transform')}
                                        title="Mover y Transformar"
                                        className={`flex items-center justify-center p-2 rounded-lg border transition-all aspect-square ${
                                            tool === 'transform'
                                            ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm ring-1 ring-purple-500'
                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                                        }`}
                                    >
                                        <Move size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Add Dialogue Button */}
                            <button 
                                onClick={addDialogue}
                                className="w-full py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="text-lg font-bold">T</span> Agregar Diálogo
                            </button>

                            {/* Add Reference Button */}
                            <button 
                                onClick={addReference}
                                className="w-full py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 mt-2"
                            >
                                <Layers size={16} /> Agregar Referencia
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

                                <button
                                    onClick={addAnimaticElement}
                                    className="w-full py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Sparkles size={16} /> Añadir Elemento Animado
                                </button>

                                <button
                                    onClick={createAnimaticKeyframe}
                                    disabled={activeElement.type !== 'animatic' || !activeElement.id}
                                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                        activeElement.type === 'animatic' && activeElement.id
                                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={activeElement.type === 'animatic' ? 'Crear un keyframe en el tiempo actual' : 'Selecciona un elemento animado'}
                                >
                                    <Diamond size={16} /> Crear Keyframe
                                </button>

                                <button
                                    onClick={deleteSelectedAnimaticKeyframe}
                                    disabled={!(activeElement.type === 'animatic' && activeElement.id && selectedAnimaticKeyframe?.elementId === activeElement.id)}
                                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                        activeElement.type === 'animatic' && activeElement.id && selectedAnimaticKeyframe?.elementId === activeElement.id
                                            ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={activeElement.type === 'animatic' ? 'Eliminar el keyframe seleccionado' : 'Selecciona un elemento animado'}
                                >
                                    <Trash2 size={16} /> Eliminar Keyframe
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
                             {activeCanvasModel && (
                                <StoryboardCanvas 
                                    key={activeCanvasModel.id} // Re-mount on frame change
                                    frame={activeCanvasModel} 
                                    onUpdate={isEditingAnimaticCanvas && activeAnimatic ? (data) => updateAnimatic(activeAnimatic.id, data) : updateFrame}
                                    tool={tool}
                                    brushSize={brushSize}
                                    brushOpacity={brushOpacity}
                                    brushColor={brushColor}
                                    activeLayerId={activeLayerId}
                                    onStartDrawing={isEditingAnimaticCanvas ? () => {} : pushToHistory}
                                    activeElement={activeElement}
                                    activeReference={isEditingAnimaticCanvas ? null : (() => {
                                        // Strict time-based visibility as requested by user
                                        const refAtTime = referenceTracks.find(r => {
                                            const rEnd = r.startTime + r.duration;
                                            return currentTime >= r.startTime && currentTime < rEnd;
                                        });
                                        
                                        // If we are explicitly editing a reference, we might want to see it 
                                        // but only if it's actually the one active at this time to avoid confusion
                                        return refAtTime;
                                    })()}
                                    onUpdateReference={(id, data) => {
                                        setReferenceTracks(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
                                    }}
                                />
                             )}

                             {!isEditingAnimaticCanvas && (
                                <div className="absolute inset-0 z-30">
                                    {animatics
                                        .filter(a => {
                                            const end = (a.startTime || 0) + (a.duration || 0);
                                            return currentTime >= (a.startTime || 0) && currentTime < end;
                                        })
                                        .map(a => {
                                            const pos = getAnimaticPositionAtTime(a, currentTime);
                                            const isActive = activeElement.type === 'animatic' && activeElement.id === a.id;
                                            const visibleLayers = (a.layers || []).filter(l => l.visible && l.data);
                                            return (
                                                <div
                                                    key={a.id}
                                                    onPointerDown={(e) => {
                                                        if (isPlaying) return;
                                                        if (tool !== 'transform') return;
                                                        const selection = selectedAnimaticKeyframeRef.current;
                                                        if (!selection || selection.elementId !== a.id) return;
                                                        const kf = (a.keyframes || []).find(k => k.id === selection.keyframeId);
                                                        if (!kf) return;
                                                        setActiveElement({ type: 'animatic', id: a.id });
                                                        const t = Math.round(kf.timeMs || 0);
                                                        setCurrentTime(t);
                                                        const p = getAnimaticPositionAtTime(a, t);
                                                        setDraggingAnimatic({
                                                            elementId: a.id,
                                                            keyframeId: selection.keyframeId,
                                                            timeMs: t,
                                                            startClientX: e.clientX,
                                                            startClientY: e.clientY,
                                                            startX: p.x,
                                                            startY: p.y
                                                        });
                                                        e.stopPropagation();
                                                    }}
                                                    className={`absolute w-full h-full ${isActive && tool === 'transform' && !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'} ${isActive ? 'outline outline-2 outline-amber-500' : ''}`}
                                                    style={{
                                                        left: `${(pos.x / 1280) * 100}%`,
                                                        top: `${(pos.y / 720) * 100}%`
                                                    }}
                                                >
                                                    {visibleLayers.map((layer) => (
                                                        <img
                                                            key={layer.id}
                                                            src={layer.data}
                                                            className="absolute inset-0 w-full h-full object-fill select-none"
                                                            draggable={false}
                                                        />
                                                    ))}
                                                </div>
                                            );
                                        })}
                                </div>
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
                <div className="h-64 bg-white border-t border-gray-200 flex flex-col text-gray-600 select-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    {/* Toolbar / Timecode */}
                    <div className="h-8 bg-gray-50 flex items-center justify-between px-4 border-b border-gray-200">
                        <div className="flex items-center gap-4">
                            {/* Playback Controls */}
                            <div className="flex items-center gap-1 mr-2 border-r border-gray-200 pr-4">
                                <button
                                    onClick={() => setTimelineTool('cursor')}
                                    className={`p-1 rounded hover:bg-gray-200 ${timelineTool === 'cursor' ? 'text-purple-600 bg-purple-50' : 'text-gray-400'}`}
                                    title="Selección (V)"
                                >
                                    <MousePointer2 size={14} />
                                </button>
                                <button
                                    onClick={() => setTimelineTool('scissor')}
                                    className={`p-1 rounded hover:bg-gray-200 ${timelineTool === 'scissor' ? 'text-purple-600 bg-purple-50' : 'text-gray-400'}`}
                                    title="Cortar (C)"
                                >
                                    <Scissors size={14} />
                                </button>
                                <div className="w-[1px] h-4 bg-gray-200 mx-1" />
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

                            <div className="h-10 border-b border-gray-200 flex items-center justify-between px-2 relative bg-amber-50">
                                 <span className="text-xs font-bold text-amber-700">AN1</span>
                                 <div className="flex flex-col gap-1">
                                     <div className="w-4 h-4 bg-white rounded-sm flex items-center justify-center border border-amber-200 text-amber-600"><Sparkles size={10} /></div>
                                 </div>
                            </div>

                            {/* V1 Header (Reduced Height) */}
                            <div className="h-10 border-b border-gray-200 flex items-center justify-between px-2 relative bg-white">
                                 <span className="text-xs font-bold text-gray-500">V1</span>
                                 <div className="flex flex-col gap-1">
                                     <div className="w-4 h-4 bg-gray-100 rounded-sm flex items-center justify-center border border-gray-200 text-gray-400"><Eye size={10} /></div>
                                 </div>
                            </div>

                            {/* R1 Header (References) */}
                            <div className="h-10 border-b border-gray-200 flex items-center justify-between px-2 relative bg-white">
                                 <span className="text-xs font-bold text-gray-500">R1</span>
                                 <div className="flex flex-col gap-1">
                                     <div className="w-4 h-4 bg-gray-100 rounded-sm flex items-center justify-center border border-gray-200 text-gray-400"><Layers size={10} /></div>
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
                        {(() => {
                            const framesDurationMs = frames.reduce((acc, f) => acc + (f.duration || 1000), 0);
                            const dialoguesEndMs = dialogues.reduce((acc, d) => Math.max(acc, (d.startTime || 0) + (d.duration || 0)), 0);
                            const audioEndMs = audioTracks.reduce((acc, t) => Math.max(acc, (t.startTime || 0) + (t.duration || 0)), 0);
                            const referencesEndMs = referenceTracks.reduce((acc, r) => Math.max(acc, (r.startTime || 0) + (r.duration || 0)), 0);
                            const animaticsEndMs = animatics.reduce((acc, a) => Math.max(acc, (a.startTime || 0) + (a.duration || 0)), 0);
                            const totalDurationMs = Math.max(framesDurationMs, dialoguesEndMs, audioEndMs, referencesEndMs, animaticsEndMs);
                            const totalWidthPx = Math.max(1200, (totalDurationMs / 1000) * pixelsPerSecond + 400); // More buffer at end

                            return (
                                <div id="timeline-tracks-area" 
                                     className={`flex-1 overflow-x-auto overflow-y-hidden bg-gray-100 relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${timelineTool === 'scissor' ? 'cursor-crosshair' : ''}`}
                                >
                                    {/* Playhead Overlay - Spans all tracks */}
                                    <div className="absolute top-0 bottom-0 z-50 pointer-events-none" style={{ left: 0, width: totalWidthPx, height: '100%' }}>
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
                                        className={`h-6 bg-gray-50 border-b border-gray-200 flex items-end pb-1 sticky top-0 z-10 min-w-max shadow-sm ${isDraggingRuler ? 'cursor-ew-resize' : 'cursor-pointer hover:bg-gray-100'}`}
                                        style={{ width: totalWidthPx }}
                                        onMouseDown={handleRulerMouseDown}
                                        title="Arrastra para hacer zoom horizontal"
                                    >
                                        {/* Generate ticks (Seconds) */}
                                        {(() => {
                                            const tickCount = Math.ceil(totalWidthPx / pixelsPerSecond);
                                            return Array.from({ length: tickCount }).map((_, i) => (
                                                <div key={i} style={{ width: `${pixelsPerSecond}px` }} className="border-l border-gray-300 h-2 text-[9px] pl-1 text-gray-400 relative select-none flex-shrink-0">
                                                    <span className="absolute -top-3 left-1 font-mono">
                                                        {(() => {
                                                            const mins = Math.floor(i / 60);
                                                            const secs = i % 60;
                                                            return `${mins < 10 ? '0'+mins : mins}:${secs < 10 ? '0'+secs : secs}`;
                                                        })()}
                                                    </span>
                                                </div>
                                            ));
                                        })()}
                                    </div>

                                    {/* D1 Track Content */}
                                    <div className="h-10 border-b border-gray-200 bg-purple-50/30 flex items-center px-0 relative overflow-hidden" style={{ width: totalWidthPx }}>
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

                                    <div className="h-10 border-b border-gray-200 bg-amber-50/40 flex items-center px-0 relative overflow-hidden" style={{ width: totalWidthPx }}>
                                        {animatics.map(a => (
                                            <div
                                                key={a.id}
                                                onMouseDown={(e) => {
                                                    if (timelineTool === 'scissor') return;
                                                    e.stopPropagation();
                                                    const selection = selectedAnimaticKeyframeRef.current;
                                                    if (selection && selection.elementId === a.id) {
                                                        commitSelectedAnimaticKeyframePosition(selection);
                                                    }
                                                    setActiveElementWithCommit({ type: 'animatic', id: a.id });
                                                    setDraggingTimelineAnimatic({
                                                        id: a.id,
                                                        startX: e.clientX,
                                                        initialStartTime: a.startTime || 0,
                                                        initialKeyframes: Array.isArray(a.keyframes)
                                                            ? a.keyframes.map(k => ({ id: k.id, timeMs: Math.round(k.timeMs || 0) }))
                                                            : []
                                                    });
                                                }}
                                                className={`absolute top-1 bottom-1 rounded border overflow-hidden text-[10px] flex items-center px-2 cursor-pointer transition-colors select-none ${
                                                    activeElement.type === 'animatic' && activeElement.id === a.id
                                                        ? 'bg-amber-500 border-amber-600 text-white z-10 shadow-sm'
                                                        : 'bg-amber-200 border-amber-300 text-amber-900 hover:bg-amber-300'
                                                }`}
                                                style={{
                                                    left: `${((a.startTime || 0) / 1000) * pixelsPerSecond}px`,
                                                    width: `${(((a.duration || 0) / 1000) * pixelsPerSecond)}px`
                                                }}
                                                title={a.name}
                                            >
                                                <span className="truncate w-full">{a.name}</span>

                                                <div
                                                    className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                                    onMouseDown={(e) => {
                                                        const selection = selectedAnimaticKeyframeRef.current;
                                                        if (selection && selection.elementId === a.id) {
                                                            commitSelectedAnimaticKeyframePosition(selection);
                                                        }
                                                        handleResizeMouseDown(e, 'animatic', a.id, 'left', a.duration || 0, a.startTime || 0);
                                                    }}
                                                />
                                                <div
                                                    className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                                    onMouseDown={(e) => {
                                                        const selection = selectedAnimaticKeyframeRef.current;
                                                        if (selection && selection.elementId === a.id) {
                                                            commitSelectedAnimaticKeyframePosition(selection);
                                                        }
                                                        handleResizeMouseDown(e, 'animatic', a.id, 'right', a.duration || 0, a.startTime || 0);
                                                    }}
                                                />

                                                {(a.keyframes || []).map(k => {
                                                    const localX = ((k.timeMs - (a.startTime || 0)) / 1000) * pixelsPerSecond;
                                                    if (localX < 0 || localX > ((a.duration || 0) / 1000) * pixelsPerSecond) return null;
                                                    const isSelected = selectedAnimaticKeyframe?.elementId === a.id && selectedAnimaticKeyframe?.keyframeId === k.id;
                                                    return (
                                                        <div
                                                            key={k.id}
                                                            onMouseDown={(e) => {
                                                                if (timelineTool === 'scissor') return;
                                                                e.stopPropagation();
                                                                setIsPlaying(false);
                                                                const prev = selectedAnimaticKeyframeRef.current;
                                                                if (prev && (prev.elementId !== a.id || prev.keyframeId !== k.id)) {
                                                                    commitSelectedAnimaticKeyframePosition(prev);
                                                                }
                                                                setActiveElement({ type: 'animatic', id: a.id });
                                                                setSelectedAnimaticKeyframe({ elementId: a.id, keyframeId: k.id });
                                                                setCurrentTime(Math.round(k.timeMs || 0));
                                                            }}
                                                            className={`absolute top-1/2 w-2 h-2 rotate-45 -translate-y-1/2 ${
                                                                isSelected
                                                                    ? 'bg-amber-900 border border-white shadow-sm'
                                                                    : 'bg-white/90 border border-amber-700'
                                                            }`}
                                                            style={{ left: `${localX}px` }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>

                                    {/* V1 Track Content */}
                                    <div 
                                        className="h-10 border-b border-gray-200 bg-white flex items-center px-0 relative"
                                        style={{ width: totalWidthPx }}
                                        onClick={() => setActiveElementWithCommit({ type: 'frame', id: null })}
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
                                                    className={`h-[90%] ml-[1px] rounded-md cursor-pointer relative group flex flex-col overflow-hidden transition-all select-none flex-shrink-0 ${
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
                                            className="h-[90%] w-8 bg-gray-50 hover:bg-gray-100 ml-1 flex items-center justify-center text-gray-400 hover:text-purple-500 rounded-md transition-colors border border-gray-200 hover:border-purple-200 border-dashed flex-shrink-0"
                                            title="Añadir frame"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>

                                    {/* R1 Track Content (References) */}
                                    <div className="h-10 border-b border-gray-200 bg-white flex items-center px-0 relative overflow-hidden" style={{ width: totalWidthPx }}>
                                        {referenceTracks.map(r => (
                                            <div
                                                key={r.id}
                                                onMouseDown={(e) => handleReferenceMouseDown(e, r)}
                                                onContextMenu={(e) => handleContextMenu(e, 'reference', r.id)}
                                                className={`absolute top-1 bottom-1 rounded border overflow-hidden text-[10px] flex items-center px-2 cursor-pointer transition-colors select-none ${
                                                    activeElement.id === r.id && activeElement.type === 'reference'
                                                    ? 'bg-blue-500 border-blue-600 text-white z-10 shadow-sm'
                                                    : 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200'
                                                }`}
                                                style={{
                                                    left: `${(r.startTime / 1000) * pixelsPerSecond}px`,
                                                    width: `${(r.duration / 1000) * pixelsPerSecond}px`
                                                }}
                                                title={r.name}
                                            >
                                                <span className="truncate w-full">{r.name}</span>
                                                
                                                {/* Resize Handles (References) */}
                                                <div 
                                                    className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                                    onMouseDown={(e) => handleResizeMouseDown(e, 'reference', r.id, 'left', r.duration, r.startTime)}
                                                />
                                                <div 
                                                    className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                                    onMouseDown={(e) => handleResizeMouseDown(e, 'reference', r.id, 'right', r.duration, r.startTime)}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* A1 Track Content */}
                                    <div className="h-16 border-b border-gray-200 bg-gray-50 relative flex items-center overflow-hidden" style={{ width: totalWidthPx }}>
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
                                                
                                                {/* Resize Handles (Audio) */}
                                                <div 
                                                    className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                                    onMouseDown={(e) => handleResizeMouseDown(e, 'audio', track.id, 'left', track.duration, track.startTime, track.offset)}
                                                />
                                                <div 
                                                    className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize hover:bg-black/20 z-20"
                                                    onMouseDown={(e) => handleResizeMouseDown(e, 'audio', track.id, 'right', track.duration, track.startTime, track.offset)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

            </div>

            {/* Right Side (1/4) - Script Reference */}
            <div className="w-1/4 h-full">
                <ScriptViewer 
                    pages={pages} 
                    selectedSceneId={selectedSceneId}
                    onSelectScene={(id) => {
                        // Save current scene before switching
                        saveData();
                        setSelectedSceneId(id);
                    }}
                />
            </div>

            {/* Export PDF Modal */}
            <StoryboardExportModal 
                project={project}
                allScenes={allScenes}
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
            />
        </div>
    );
};

export default StoryboardTab;
