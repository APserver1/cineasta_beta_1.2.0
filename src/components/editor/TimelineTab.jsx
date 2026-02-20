import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Settings, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

const TimelineTab = ({ project, onUpdateProject, readOnly = false }) => {
    const [events, setEvents] = useState([]);
    const [period, setPeriod] = useState({ start: -10, end: 10 });
    const [distantYears, setDistantYears] = useState([]);
    const [zoom, setZoom] = useState(1); // 1 = Years, higher = more detail
    const [saving, setSaving] = useState(false);
    const containerRef = useRef(null);
    const scrollRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null);
    const isFirstLoad = useRef(true);
    const [isAddingDistant, setIsAddingDistant] = useState(false);
    const [distantYearInput, setDistantYearInput] = useState('');

    const zoomRef = useRef(zoom);
    const periodRef = useRef(period);

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => {
        periodRef.current = period;
    }, [period]);

    // Load initial data
    useEffect(() => {
        const loadInitialData = async () => {
            if (project?.serie_nombre) {
                // Load from series table if it belongs to a series
                try {
                    const { data, error } = await supabase
                        .from('series_cineasta')
                        .select('timeline_data')
                        .eq('serie_nombre', project.serie_nombre)
                        .single();
                    
                    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"

                    if (data?.timeline_data) {
                        setEvents(data.timeline_data.events || []);
                        if (data.timeline_data.period) {
                        setPeriod(data.timeline_data.period);
                        }
                        setDistantYears(data.timeline_data.distantYears || []);
                    }
                } catch (err) {
                    console.error('Error loading series timeline:', err);
                }
            } else if (project?.timeline_data) {
                // Normal project-level loading
                setEvents(project.timeline_data.events || []);
                if (project.timeline_data.period) {
                    setPeriod(project.timeline_data.period);
                }
                setDistantYears(project.timeline_data.distantYears || []);
            }
            isFirstLoad.current = false;
        };

        if (isFirstLoad.current && project) {
            loadInitialData();
        }
    }, [project]);

    // Auto-save
    useEffect(() => {
        if (isFirstLoad.current) return;

        if (readOnly) return;

        const timer = setTimeout(() => {
            saveData();
        }, 1000);

        return () => clearTimeout(timer);
    }, [events, period, distantYears]);

    const saveData = async () => {
        if (readOnly) return;
        setSaving(true);
        try {
            const timelineData = { 
                events, 
                period,
                distantYears
            };

            if (project?.serie_nombre) {
                // Save to series table
                const { error } = await supabase
                    .from('series_cineasta')
                    .upsert({ 
                        serie_nombre: project.serie_nombre,
                        timeline_data: timelineData,
                        user_id: project.user_id
                    });
                if (error) throw error;
            } else {
                // Save to project table
                const { error } = await supabase
                    .from('proyectos_cineasta')
                    .update({ timeline_data: timelineData })
                    .eq('id', project.id);
                if (error) throw error;
            }
            
            if (onUpdateProject) {
                onUpdateProject({ timeline_data: timelineData });
            }
        } catch (error) {
            console.error('Error saving timeline data:', error);
        } finally {
            setSaving(false);
        }
    };

    const BASE_PX_PER_YEAR = 80;
    const pixelsPerYear = BASE_PX_PER_YEAR * zoom;

    const clampZoom = (value) => Math.min(Math.max(0.5, value), 8);

    const normalizeYearInt = (value) => {
        const num = typeof value === 'number' ? value : Number(String(value).trim());
        if (!Number.isFinite(num)) return null;
        return Math.trunc(num);
    };

    const leftDistant = distantYears.filter(y => y < period.start).sort((a, b) => a - b);
    const rightDistant = distantYears.filter(y => y > period.end).sort((a, b) => a - b);
    const DISTANT_TICK_SPACING = 160;
    const JUMP_GAP = 90;
    const BREAK_WIDTH = 36;
    const LEFT_GUTTER = 220;
    const RIGHT_GUTTER = 140;
    const leftBlockWidth = leftDistant.length > 0 ? (leftDistant.length - 1) * DISTANT_TICK_SPACING : 0;
    const rightBlockWidth = rightDistant.length > 0 ? (rightDistant.length - 1) * DISTANT_TICK_SPACING : 0;
    const mainStartX = LEFT_GUTTER + ((leftDistant.length > 0) ? (leftBlockWidth + JUMP_GAP + BREAK_WIDTH + 20) : 0);
    const mainWidth = Math.max(0.001, (period.end - period.start) * pixelsPerYear);
    const rightStartX = (rightDistant.length > 0) ? (mainStartX + mainWidth + JUMP_GAP + BREAK_WIDTH + 20) : 0;
    const timelineWidthPx = (rightDistant.length > 0)
        ? (rightStartX + rightBlockWidth + RIGHT_GUTTER)
        : (mainStartX + mainWidth + RIGHT_GUTTER);

    const getXForYear = (year) => {
        if (year >= period.start && year <= period.end) {
            return mainStartX + (year - period.start) * pixelsPerYear;
        }
        if (year < period.start) {
            const idx = leftDistant.indexOf(year);
            if (idx !== -1) return LEFT_GUTTER + idx * DISTANT_TICK_SPACING;
            if (leftDistant.length > 0) return LEFT_GUTTER;
            return mainStartX;
        }
        const idx = rightDistant.indexOf(year);
        if (idx !== -1) return rightStartX + idx * DISTANT_TICK_SPACING;
        if (rightDistant.length > 0) return rightStartX + rightBlockWidth;
        return mainStartX + mainWidth;
    };

    const setZoomWithAnchor = ({ nextZoom, anchorClientX }) => {
        const scroller = scrollRef.current;
        if (!scroller) {
            setZoom(nextZoom);
            return;
        }

        const rect = scroller.getBoundingClientRect();
        const anchorXInViewport = Math.min(Math.max(anchorClientX - rect.left, 0), rect.width);
        const currentPxPerYear = BASE_PX_PER_YEAR * zoomRef.current;
        const currentScrollLeft = scroller.scrollLeft;
        const anchorYearsFromStart = (currentScrollLeft + anchorXInViewport) / currentPxPerYear;

        setZoom(nextZoom);

        requestAnimationFrame(() => {
            const newPxPerYear = BASE_PX_PER_YEAR * nextZoom;
            const nextScrollLeft = anchorYearsFromStart * newPxPerYear - anchorXInViewport;
            scroller.scrollLeft = Math.max(0, nextScrollLeft);
        });
    };

    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller) return;

        const onWheel = (e) => {
            e.preventDefault();
            const direction = e.deltaY > 0 ? -1 : 1;
            const step = (e.shiftKey ? 0.5 : 0.15) * direction;
            const nextZoom = clampZoom(zoomRef.current + step);
            setZoomWithAnchor({ nextZoom, anchorClientX: e.clientX });
        };

        scroller.addEventListener('wheel', onWheel, { passive: false });
        return () => scroller.removeEventListener('wheel', onWheel);
    }, []);

    const handleTimelineClick = (e) => {
        if (readOnly) return;
        // Only add if clicking directly on the timeline area (not on existing nodes)
        if (e.target.closest('.timeline-node')) return;

        const scroller = scrollRef.current;
        const container = containerRef.current;
        if (!scroller || !container) return;

        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left + scroller.scrollLeft;
        
        if (clickX < mainStartX || clickX > mainStartX + mainWidth) return;

        const year = period.start + ((clickX - mainStartX) / pixelsPerYear);

        const newEvent = {
            id: Date.now(),
            year: year,
            content: 'Nuevo Suceso'
        };

        setEvents([...events, newEvent]);
    };

    const updateEvent = (id, newContent) => {
        if (readOnly) return;
        setEvents(events.map(ev => ev.id === id ? { ...ev, content: newContent } : ev));
    };

    const handleContextMenu = (e, eventId) => {
        if (readOnly) return;
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            eventId
        });
    };

    const deleteEvent = () => {
        if (readOnly) return;
        if (contextMenu) {
            setEvents(events.filter(ev => ev.id !== contextMenu.eventId));
            setContextMenu(null);
        }
    };

    // Calculate positions
    const getPositionPercent = (year) => {
        const totalYears = period.end - period.start;
        return ((year - period.start) / totalYears) * 100;
    };

    const getPositionPx = (year) => {
        return getXForYear(year);
    };

    // Render rulers
    const renderRuler = () => {
        const ticks = [];
        const years = Math.max(0, Math.floor(period.end) - Math.ceil(period.start) + 1);

        const showMonths = zoom >= 3;
        const showDays = zoom >= 6;

        for (const y of leftDistant) {
            const x = getPositionPx(y);
            ticks.push(
                <div
                    key={`d-left-${y}`}
                    className="absolute bottom-0 flex flex-col items-center"
                    style={{ left: `${x}px`, transform: 'translateX(-50%)' }}
                >
                    <div className="h-4 w-px bg-gray-600" />
                    <span className="text-xs text-gray-500 mt-1 select-none">Año {y}</span>
                </div>
            );
        }

        for (let y = Math.ceil(period.start); y <= period.end; y++) {
            const x = getPositionPx(y);
            ticks.push(
                <div
                    key={`y-${y}`}
                    className="absolute bottom-0 flex flex-col items-center"
                    style={{ left: `${x}px`, transform: 'translateX(-50%)' }}
                >
                    <div className="h-4 w-px bg-gray-500" />
                    <span className="text-xs text-gray-500 mt-1 select-none">Año {y}</span>
                </div>
            );

            if (showMonths) {
                for (let m = 1; m < 12; m++) {
                    const mx = x + (m / 12) * pixelsPerYear;
                    ticks.push(
                        <div
                            key={`m-${y}-${m}`}
                            className="absolute bottom-0 flex flex-col items-center opacity-70"
                            style={{ left: `${mx}px`, transform: 'translateX(-50%)' }}
                        >
                            <div className="h-2 w-px bg-gray-400" />
                            {zoom >= 4 && (
                                <span className="text-[10px] text-gray-400 mt-1 select-none">M{m + 1}</span>
                            )}
                        </div>
                    );
                }
            }

            if (showDays) {
                for (let d = 1; d < 30; d += 5) {
                    const dx = x + (d / 30) * pixelsPerYear;
                    ticks.push(
                        <div
                            key={`d-${y}-${d}`}
                            className="absolute bottom-0 flex flex-col items-center opacity-50"
                            style={{ left: `${dx}px`, transform: 'translateX(-50%)' }}
                        >
                            <div className="h-1 w-px bg-gray-300" />
                        </div>
                    );
                }
            }
        }

        for (const y of rightDistant) {
            const x = getPositionPx(y);
            ticks.push(
                <div
                    key={`d-right-${y}`}
                    className="absolute bottom-0 flex flex-col items-center"
                    style={{ left: `${x}px`, transform: 'translateX(-50%)' }}
                >
                    <div className="h-4 w-px bg-gray-600" />
                    <span className="text-xs text-gray-500 mt-1 select-none">Año {y}</span>
                </div>
            );
        }

        if (years === 0) return ticks;
        return ticks;
    };

    const nodeDistancePx = 200;
    const sortedEventsWithX = [...events]
        .map(ev => ({ ev, x: getPositionPx(ev.year) }))
        .sort((a, b) => a.x - b.x);
    const laneById = new Map();
    let lastX = null;
    let toggle = false;
    for (const item of sortedEventsWithX) {
        if (lastX === null || Math.abs(item.x - lastX) > nodeDistancePx) {
            toggle = false;
        } else {
            toggle = !toggle;
        }
        laneById.set(item.ev.id, toggle ? 'down' : 'up');
        lastX = item.x;
    }

    const addDistantYear = () => {
        if (readOnly) return;
        const y = normalizeYearInt(distantYearInput);
        if (y === null) return;
        if (y >= period.start && y <= period.end) return;

        setDistantYears(prev => {
            const next = Array.from(new Set([...prev, y])).sort((a, b) => a - b);
            return next;
        });

        const newEvent = { id: Date.now(), year: y, content: 'Nuevo Suceso' };
        setEvents(prev => [...prev, newEvent]);
        setIsAddingDistant(false);
        setDistantYearInput('');

        requestAnimationFrame(() => {
            const scroller = scrollRef.current;
            if (!scroller) return;
            const x = getXForYear(y);
            scroller.scrollLeft = Math.max(0, x - scroller.clientWidth / 2);
        });
    };

    const zoomOut = () => {
        const scroller = scrollRef.current;
        const rect = scroller?.getBoundingClientRect();
        const anchorClientX = rect ? rect.left + rect.width / 2 : 0;
        setZoomWithAnchor({ nextZoom: clampZoom(zoomRef.current - 0.5), anchorClientX });
    };

    const zoomIn = () => {
        const scroller = scrollRef.current;
        const rect = scroller?.getBoundingClientRect();
        const anchorClientX = rect ? rect.left + rect.width / 2 : 0;
        setZoomWithAnchor({ nextZoom: clampZoom(zoomRef.current + 0.5), anchorClientX });
    };

    return (
        <div className="h-full w-full bg-gray-50 overflow-hidden flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_16rem]" onClick={() => setContextMenu(null)}>
            {/* Main Timeline Area */}
            <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
                <div className="absolute top-4 left-4 z-10 bg-white/80 p-2 rounded shadow backdrop-blur-sm">
                    <h2 className="text-sm font-bold text-gray-700">Línea de Tiempo</h2>
                    <p className="text-xs text-gray-500">Usa la rueda del ratón para zoom</p>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden px-8 pt-20 pb-8" style={{ overscrollBehavior: 'contain' }}>
                    <div
                        ref={containerRef}
                        className="relative h-[420px] select-none cursor-crosshair"
                        onClick={handleTimelineClick}
                        style={{ width: `${timelineWidthPx}px`, minWidth: '100%' }}
                    >
                        {leftDistant.length > 0 && (
                            <>
                                <div
                                    className="absolute top-[62%] h-4 border-2 border-black rounded-full transform -translate-y-1/2 bg-white/50 backdrop-blur-sm shadow-sm pointer-events-none"
                                    style={{ left: `${LEFT_GUTTER}px`, width: `${leftBlockWidth + 40}px` }}
                                />
                                <div
                                    className="absolute top-[62%] transform -translate-y-1/2 pointer-events-none"
                                    style={{ left: `${LEFT_GUTTER + leftBlockWidth + 50}px` }}
                                >
                                    <div className="w-2 h-6 border-l-2 border-black -skew-x-12" />
                                    <div className="w-2 h-6 border-l-2 border-black -skew-x-12 -mt-5 ml-2" />
                                </div>
                            </>
                        )}

                        <div
                            className="absolute top-[62%] h-4 border-2 border-black rounded-full transform -translate-y-1/2 bg-white/50 backdrop-blur-sm shadow-sm pointer-events-none"
                            style={{ left: `${mainStartX}px`, width: `${mainWidth}px` }}
                        />

                        {rightDistant.length > 0 && (
                            <>
                                <div
                                    className="absolute top-[62%] transform -translate-y-1/2 pointer-events-none"
                                    style={{ left: `${mainStartX + mainWidth + 10}px` }}
                                >
                                    <div className="w-2 h-6 border-l-2 border-black -skew-x-12" />
                                    <div className="w-2 h-6 border-l-2 border-black -skew-x-12 -mt-5 ml-2" />
                                </div>
                                <div
                                    className="absolute top-[62%] h-4 border-2 border-black rounded-full transform -translate-y-1/2 bg-white/50 backdrop-blur-sm shadow-sm pointer-events-none"
                                    style={{ left: `${rightStartX - 20}px`, width: `${rightBlockWidth + 60}px` }}
                                />
                            </>
                        )}

                        <div className="absolute top-[62%] left-0 right-0 h-32 transform translate-y-12 pointer-events-none opacity-70">
                            {renderRuler()}
                        </div>

                        {events.map(ev => {
                            const x = getPositionPx(ev.year);
                            if (x < 0 || x > timelineWidthPx) return null;

                            const lane = laneById.get(ev.id) || 'up';

                            return (
                                <div
                                    key={ev.id}
                                    className="absolute top-[62%] flex flex-col items-center group timeline-node"
                                    style={{
                                        left: `${x}px`,
                                        transform: lane === 'up' ? 'translateX(-50%) translateY(-100%)' : 'translateX(-50%)',
                                        marginTop: lane === 'up' ? '-12px' : '12px'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {lane === 'up' ? (
                                        <>
                                            <div className="mb-2 relative">
                                                <textarea
                                                    value={ev.content}
                                                    onChange={(e) => updateEvent(ev.id, e.target.value)}
                                                    onContextMenu={(e) => handleContextMenu(e, ev.id)}
                                                    readOnly={readOnly}
                                                    className="bg-white border border-gray-300 rounded p-2 text-xs shadow-md w-36 resize-none outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all text-center"
                                                    rows={2}
                                                />
                                            </div>
                                            <div className="w-px h-10 bg-black" />
                                            <div className="w-3 h-3 bg-black rounded-full border-2 border-white shadow-sm z-10" />
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-3 h-3 bg-black rounded-full border-2 border-white shadow-sm z-10" />
                                            <div className="w-px h-10 bg-black" />
                                            <div className="mt-2 relative">
                                                <textarea
                                                    value={ev.content}
                                                    onChange={(e) => updateEvent(ev.id, e.target.value)}
                                                    onContextMenu={(e) => handleContextMenu(e, ev.id)}
                                                    readOnly={readOnly}
                                                    className="bg-white border border-gray-300 rounded p-2 text-xs shadow-md w-36 resize-none outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all text-center"
                                                    rows={2}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right Settings Panel */}
            <div className="w-full bg-white border-t border-gray-200 lg:border-t-0 lg:border-l lg:border-gray-200 p-4 flex flex-col gap-6 shadow-lg z-20">
                <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <Settings size={16} />
                        Configuración
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Periodo (Años)</label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <span className="text-[10px] text-gray-400 block">Inicio</span>
                                    <input 
                                        type="number" 
                                        value={period.start}
                                        onChange={(e) => { if (readOnly) return; setPeriod(prev => ({ ...prev, start: parseInt(e.target.value) || 0 })); }}
                                        disabled={readOnly}
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                                <span className="text-gray-400">-</span>
                                <div className="flex-1">
                                    <span className="text-[10px] text-gray-400 block">Fin</span>
                                    <input 
                                        type="number" 
                                        value={period.end}
                                        onChange={(e) => { if (readOnly) return; setPeriod(prev => ({ ...prev, end: parseInt(e.target.value) || 0 })); }}
                                        disabled={readOnly}
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Zoom</label>
                            <div className="flex items-center gap-2 bg-gray-100 rounded p-1">
                                <button onClick={zoomOut} className="p-1 hover:bg-white rounded"><ZoomOut size={14} /></button>
                                <div className="flex-1 text-center text-xs text-gray-600">{Math.round(zoom * 100)}%</div>
                                <button onClick={zoomIn} className="p-1 hover:bg-white rounded"><ZoomIn size={14} /></button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Año distante</label>
                            {isAddingDistant ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={distantYearInput}
                                        onChange={(e) => { if (readOnly) return; setDistantYearInput(e.target.value); }}
                                        disabled={readOnly}
                                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                        placeholder="-10000"
                                        onKeyDown={(e) => {
                                            if (readOnly) return;
                                            if (e.key === 'Enter') addDistantYear();
                                            if (e.key === 'Escape') {
                                                setIsAddingDistant(false);
                                                setDistantYearInput('');
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => { if (readOnly) return; addDistantYear(); }}
                                        disabled={readOnly}
                                        className="px-3 py-1 rounded bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { if (readOnly) return; setIsAddingDistant(true); }}
                                    disabled={readOnly}
                                    className="w-full px-3 py-2 rounded bg-white border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                                >
                                    Añadir Año Distante
                                </button>
                            )}
                            <div className="text-[10px] text-gray-400 mt-2">
                                Ejemplo: -10000 aparecerá como salto “-10000, -10”.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="text-xs text-gray-400">
                        {events.length} sucesos registrados
                    </div>
                    {saving && <div className="text-xs text-purple-500 animate-pulse mt-2">Guardando...</div>}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed bg-white border border-gray-200 shadow-lg rounded py-1 z-50 min-w-[120px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button 
                        onClick={deleteEvent}
                        className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                        <Trash2 size={12} /> Eliminar suceso
                    </button>
                </div>
            )}
        </div>
    );
};

export default TimelineTab;
