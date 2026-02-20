import { useState, useRef, useEffect } from 'react';
import { X, Download, Columns, Image as ImageIcon, Type, Layout, Check, Settings2, Clock, Calendar, ZoomIn, ZoomOut, FileText, AlignJustify, AlignLeft } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PAPER_SIZES = {
    letter: { name: 'Carta (US)', width: 215.9, height: 279.4 },
    a4: { name: 'A4 (ISO)', width: 210, height: 297 },
    oficio: { name: 'Oficio', width: 216, height: 340 },
    legal: { name: 'Legal (US)', width: 215.9, height: 355.6 }
};

const StoryboardExportModal = ({ project, allScenes = [], isOpen, onClose }) => {
    const [config, setConfig] = useState({
        columns: 3,
        rowsPerPage: 2,
        showAction: true,
        showDialogue: true,
        exportRange: 'all', // 'all' or scene ID
        frameSize: 'medium', // 'small', 'medium', 'large'
        zoom: 0.6,
        paperSize: 'letter', 
        orientation: 'portrait', // 'portrait' or 'landscape'
    });
    const [exporting, setExporting] = useState(false);
    const [progress, setExportProgress] = useState(0);
    const previewRef = useRef(null);

    if (!isOpen) return null;

    const scenesToExport = config.exportRange === 'all' 
        ? allScenes 
        : allScenes.filter(s => String(s.id) === String(config.exportRange));

    const handleExport = async () => {
        setExporting(true);
        setExportProgress(0);
        
        try {
            const pdf = new jsPDF({
                orientation: config.orientation,
                unit: 'mm',
                format: config.paperSize
            });

            const pages = previewRef.current.querySelectorAll('.pdf-page');
            const totalPages = pages.length;

            for (let i = 0; i < totalPages; i++) {
                const page = pages[i];
                const canvas = await html2canvas(page, {
                    scale: 2, // Better quality
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                
                if (i > 0) pdf.addPage();
                
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                setExportProgress(Math.round(((i + 1) / totalPages) * 100));
            }

            pdf.save(`${project.title || 'Storyboard'}_Export.pdf`);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Error al exportar el PDF');
        } finally {
            setExporting(false);
            onClose();
        }
    };

    // Helper to format duration
    const formatDuration = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Frame size map
    const frameSizeClasses = {
        small: 'w-1/4',
        medium: 'w-1/3',
        large: 'w-1/2'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                            <Download size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Exportar Storyboard</h2>
                            <p className="text-xs text-gray-500">Configura y descarga tu storyboard en formato PDF</p>
                        </div>
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button 
                            onClick={() => setConfig(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.1, 0.2) }))}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span className="px-3 text-xs font-mono font-bold text-gray-600 w-16 text-center">
                            {Math.round(config.zoom * 100)}%
                        </span>
                        <button 
                            onClick={() => setConfig(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.1, 1.5) }))}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Options */}
                    <div className="w-80 border-r border-gray-100 p-6 overflow-y-auto bg-gray-50/50">
                        <div className="space-y-8">
                            {/* Paper Size */}
                            <section>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                    <FileText size={14} /> Formato de Papel
                                </label>
                                <div className="space-y-2">
                                    <select 
                                        value={config.paperSize}
                                        onChange={(e) => setConfig({...config, paperSize: e.target.value})}
                                        className="w-full px-4 py-2.5 rounded-lg text-sm bg-white border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold text-gray-700"
                                    >
                                        {Object.entries(PAPER_SIZES).map(([key, value]) => (
                                            <option key={key} value={key}>{value.name}</option>
                                        ))}
                                    </select>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => setConfig({...config, orientation: 'portrait'})}
                                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                                config.orientation === 'portrait' 
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                                            }`}
                                        >
                                            <AlignJustify size={14} className="rotate-90" /> Vertical
                                        </button>
                                        <button 
                                            onClick={() => setConfig({...config, orientation: 'landscape'})}
                                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                                config.orientation === 'landscape' 
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                                            }`}
                                        >
                                            <AlignJustify size={14} /> Horizontal
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* Export Range */}
                            <section>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                    <Layout size={14} /> Rango de Exportación
                                </label>
                                <div className="space-y-2">
                                    <button 
                                        onClick={() => setConfig({...config, exportRange: 'all'})}
                                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all border ${
                                            config.exportRange === 'all' 
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-md' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                                        }`}
                                    >
                                        <span>Todas las escenas</span>
                                        {config.exportRange === 'all' && <Check size={14} />}
                                    </button>
                                    <select 
                                        value={config.exportRange === 'all' ? '' : config.exportRange}
                                        onChange={(e) => setConfig({...config, exportRange: e.target.value})}
                                        className="w-full px-4 py-2.5 rounded-lg text-sm bg-white border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="" disabled>Seleccionar escena...</option>
                                        {allScenes.map((scene, idx) => (
                                            <option key={scene.id} value={scene.id}>
                                                Escena {idx + 1}: {scene.content.substring(0, 30)}...
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </section>

                            {/* Grid Layout */}
                            <section>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                    <Columns size={14} /> Diseño de Página
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[10px] text-gray-400 block mb-1">Columnas</span>
                                        <input 
                                            type="number" 
                                            min="1" max="4"
                                            value={config.columns}
                                            onChange={(e) => {
                                                const cols = parseInt(e.target.value) || 1;
                                                let rows = config.rowsPerPage;
                                                // Dynamic row limit based on columns to prevent page overflow
                                                const maxRows = cols === 1 ? 2 : (cols === 2 ? 3 : 4);
                                                if (rows > maxRows) rows = maxRows;
                                                setConfig({...config, columns: cols, rowsPerPage: rows});
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 block mb-1">Filas</span>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max={config.columns === 1 ? 2 : (config.columns === 2 ? 3 : 4)}
                                            value={config.rowsPerPage}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 1;
                                                const maxRows = config.columns === 1 ? 2 : (config.columns === 2 ? 3 : 4);
                                                setConfig({...config, rowsPerPage: Math.min(val, maxRows)});
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Content Toggles */}
                            <section>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                                    <Settings2 size={14} /> Contenido
                                </label>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${config.showAction ? 'bg-purple-600' : 'bg-gray-200'}`}>
                                            <input type="checkbox" className="hidden" checked={config.showAction} onChange={() => setConfig({...config, showAction: !config.showAction})} />
                                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${config.showAction ? 'translate-x-5' : ''}`} />
                                        </div>
                                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Mostrar Acciones</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${config.showDialogue ? 'bg-purple-600' : 'bg-gray-200'}`}>
                                            <input type="checkbox" className="hidden" checked={config.showDialogue} onChange={() => setConfig({...config, showDialogue: !config.showDialogue})} />
                                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${config.showDialogue ? 'translate-x-5' : ''}`} />
                                        </div>
                                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Mostrar Diálogos</span>
                                    </label>
                                </div>
                            </section>
                        </div>

                        <div className="mt-12">
                            <button 
                                onClick={handleExport}
                                disabled={exporting}
                                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                                    exporting 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                    : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-purple-200 active:scale-[0.98]'
                                }`}
                            >
                                {exporting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                        Exportando {progress}%
                                    </>
                                ) : (
                                    <>
                                        <Download size={18} /> Descargar PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 bg-gray-200 p-8 overflow-auto flex flex-col items-center">
                        <div 
                            ref={previewRef} 
                            className="flex flex-col items-center gap-8 origin-top transition-transform duration-200 ease-out"
                            style={{ transform: `scale(${config.zoom})` }}
                        >
                            {scenesToExport.length === 0 && (
                                <div className="bg-white p-12 rounded-xl shadow-sm text-center" style={{ 
                                    width: config.orientation === 'portrait' 
                                        ? `${PAPER_SIZES[config.paperSize].width}mm` 
                                        : `${PAPER_SIZES[config.paperSize].height}mm`
                                }}>
                                    <ImageIcon size={48} className="mx-auto text-gray-200 mb-4" />
                                    <h3 className="text-gray-500 font-medium">No hay escenas seleccionadas</h3>
                                    <p className="text-gray-400 text-sm">Asegúrate de que el guion tenga escenas definidas.</p>
                                </div>
                            )}
                            {scenesToExport.map((scene, sceneIdx) => {
                                // Migration logic: handle both new scene-based structure and old top-level structure
                                const storyboardData = project?.storyboard_data || {};
                                let sceneData = { frames: [], dialogues: [], audioTracks: [], referenceTracks: [] };
                                
                                if (storyboardData.scenes && storyboardData.scenes[scene.id]) {
                                    sceneData = storyboardData.scenes[scene.id];
                                } else if (!storyboardData.scenes && allScenes.length > 0 && scene.id === allScenes[0].id) {
                                    // Migration: Use top-level data for the first scene if no scenes structure exists yet
                                    sceneData = {
                                        frames: storyboardData.frames || [],
                                        dialogues: storyboardData.dialogues || [],
                                        audioTracks: storyboardData.audioTracks || [],
                                        referenceTracks: storyboardData.referenceTracks || []
                                    };
                                }

                                const sceneFrames = sceneData.frames || [];
                                const framesPerPage = config.columns * config.rowsPerPage;
                                const pageCount = Math.ceil(sceneFrames.length / framesPerPage) || 1;
                                
                                // Calculate scene metadata
                                const totalDuration = sceneFrames.reduce((acc, f) => acc + (f.duration || 1000), 0);
                                const sceneNumber = allScenes.findIndex(s => s.id === scene.id) + 1;

                                return Array.from({ length: pageCount }).map((_, pageIdx) => {
                                    const pageFrames = sceneFrames.slice(pageIdx * framesPerPage, (pageIdx + 1) * framesPerPage);
                                    
                                    return (
                                        <div 
                                            key={`scene-${scene.id}-page-${pageIdx}`} 
                                            className="pdf-page bg-white shadow-xl flex flex-col relative shrink-0"
                                            style={{ 
                                                width: config.orientation === 'portrait' 
                                                    ? `${PAPER_SIZES[config.paperSize].width}mm` 
                                                    : `${PAPER_SIZES[config.paperSize].height}mm`,
                                                minHeight: config.orientation === 'portrait' 
                                                    ? `${PAPER_SIZES[config.paperSize].height}mm` 
                                                    : `${PAPER_SIZES[config.paperSize].width}mm`,
                                                padding: '15mm'
                                            }}
                                        >
                                            {/* PDF Header */}
                                            <div className="flex justify-between items-start mb-8 border-b-2 border-gray-900 pb-4">
                                                <div>
                                                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">ESCENA {sceneNumber}</h1>
                                                    <div className="flex items-center gap-4 mt-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                        <div className="flex items-center gap-1.5"><ImageIcon size={12} /> Boards: {sceneFrames.length}</div>
                                                        <div className="flex items-center gap-1.5"><Clock size={12} /> Duración: {formatDuration(totalDuration)}</div>
                                                        <div className="flex items-center gap-1.5"><Layout size={12} /> Aspect Ratio: 16:9</div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                        <Calendar size={10} /> DRAFT: {new Date().toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                                                    </div>
                                                </div>
                                                <div className="text-xs font-mono text-gray-400">
                                                    PÁGINA {pageIdx + 1} / {pageCount}
                                                </div>
                                            </div>

                                            {/* Frames Grid */}
                                            <div className="flex-1 grid gap-8 h-full" style={{ 
                                                gridTemplateColumns: `repeat(${config.columns}, 1fr)`,
                                                gridTemplateRows: `repeat(${config.rowsPerPage}, minmax(0, 1fr))`
                                            }}>
                                                {pageFrames.map((frame, frameIdx) => {
                                                    // Find relevant dialogue and references
                                                    const frameStartTime = sceneFrames.slice(0, pageIdx * framesPerPage + frameIdx).reduce((acc, f) => acc + (f.duration || 1000), 0);
                                                    const frameEndTime = frameStartTime + (frame.duration || 1000);
                                                    
                                                    const sceneDialogues = sceneData.dialogues || [];
                                                    const activeDialogues = sceneDialogues.filter(d => {
                                                         const dEnd = d.startTime + d.duration;
                                                         return d.startTime < frameEndTime && dEnd > frameStartTime;
                                                     });
                                                     
                                                     const frameDialogue = [...activeDialogues].sort((a, b) => {
                                                         const overlapA = Math.min(a.startTime + a.duration, frameEndTime) - Math.max(a.startTime, frameStartTime);
                                                         const overlapB = Math.min(b.startTime + b.duration, frameEndTime) - Math.max(b.startTime, frameStartTime);
                                                         return overlapB - overlapA;
                                                     })[0];

                                                    const sceneReferences = sceneData.referenceTracks || [];
                                                     const activeReferences = sceneReferences.filter(r => {
                                                         const rEnd = r.startTime + r.duration;
                                                         const overlap = Math.min(rEnd, frameEndTime) - Math.max(r.startTime, frameStartTime);
                                                         const frameDuration = frame.duration || 1000;
                                                         return overlap > (frameDuration / 2);
                                                     });

                                                    return (
                                                        <div key={frame.id} className="flex flex-col gap-3">
                                                            {/* Frame Image Container */}
                                                            <div className="relative aspect-video border-2 border-gray-900 overflow-hidden bg-gray-50">
                                                                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-gray-900 text-white text-[10px] font-black z-[100]">
                                                                    {pageIdx * framesPerPage + frameIdx + 1}A
                                                                </div>

                                                                {/* Reference Images (Bottom) */}
                                                                {activeReferences.map(ref => ref.image && (
                                                                    <div 
                                                                        key={ref.id}
                                                                        className="absolute pointer-events-none overflow-hidden"
                                                                        style={{
                                                                            left: `${(ref.x / 1280) * 100}%`,
                                                                            top: `${(ref.y / 720) * 100}%`,
                                                                            width: `${(ref.scaleX || 1) * 100}%`,
                                                                            height: `${(ref.scaleY || 1) * 100}%`,
                                                                            transform: `translate(-50%, -50%) rotate(${ref.rotation || 0}rad)`,
                                                                            opacity: ref.opacity !== undefined ? ref.opacity : 0.5,
                                                                            zIndex: 0
                                                                        }}
                                                                    >
                                                                        <img 
                                                                            src={ref.image} 
                                                                            className="w-full h-full object-fill"
                                                                        />
                                                                    </div>
                                                                ))}

                                                                {/* Drawing Layers */}
                                                                {frame.layers?.map((layer, idx) => layer.data && (
                                                                    <img 
                                                                        key={layer.id} 
                                                                        src={layer.data} 
                                                                        className="absolute inset-0 w-full h-full object-contain"
                                                                        style={{ zIndex: idx + 10 }}
                                                                    />
                                                                ))}

                                                                {/* Dialogues Overlay (Top) */}
                                                                 {frameDialogue && (
                                                                     <div
                                                                         key={frameDialogue.id}
                                                                         className="absolute p-1 text-white z-[50] pointer-events-none"
                                                                         style={{
                                                                             left: `${(frameDialogue.x / 1280) * 100}%`,
                                                                             top: `${(frameDialogue.y / 720) * 100}%`,
                                                                             transform: 'translate(-50%, -50%)',
                                                                             whiteSpace: 'pre-wrap',
                                                                             textAlign: 'center',
                                                                             minWidth: '20px'
                                                                         }}
                                                                     >
                                                                         <span style={{ 
                                                                              fontSize: `${frameDialogue.fontSize * 0.5}px`, // Scaled down for preview
                                                                              lineHeight: 1.2, 
                                                                              display: 'block',
                                                                              backgroundColor: 'rgba(0,0,0,0.5)',
                                                                              padding: '2px 4px',
                                                                              borderRadius: '2px'
                                                                          }}>
                                                                              {frameDialogue.text || frameDialogue.content}
                                                                          </span>
                                                                     </div>
                                                                 )}
                                                            </div>

                                                            {/* Captions */}
                                                            <div className="space-y-1">
                                                                {config.showAction && frame.action && (
                                                                    <p className="text-[11pt] font-black text-gray-900 leading-tight">
                                                                        {frame.action}
                                                                    </p>
                                                                )}
                                                                {config.showDialogue && frameDialogue && (
                                                                    <p className="text-[10pt] italic text-gray-500 font-medium leading-tight border-l-2 border-gray-200 pl-2">
                                                                        "{frameDialogue.text || frameDialogue.content}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Footer */}
                                            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                                <span>{project.title}</span>
                                                <span>Cineasta Storyboarder</span>
                                            </div>
                                        </div>
                                    );
                                });
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoryboardExportModal;
