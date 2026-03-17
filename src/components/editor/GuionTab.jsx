import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { FileText, List, Map as MapIcon, Plus, Trash2, AlignLeft, AlignCenter, Type, MessageSquare, Video, File, Hash, Link as LinkIcon, Unlink, ZoomIn, ZoomOut, Download, MoreVertical, Music } from 'lucide-react';
import ConceptMap from './ConceptMap';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Constants for Script Elements
const ELEMENT_TYPES = {
    SCENE: 'scene',       // Escena (CTRL+1)
    ACTION: 'action',     // Acción (CTRL+2)
    CHARACTER: 'character', // Personaje (CTRL+3)
    PARENTHETICAL: 'parenthetical', // Paréntesis (CTRL+4)
    DIALOGUE: 'dialogue', // Diálogo (CTRL+5)
    SHOT: 'shot',         // Toma (CTRL+6)
    TRANSITION: 'transition', // Texto/Transición (CTRL+7)
    NOTE: 'note',         // Nota (CTRL+8)
    LYRICS: 'lyrics'      // Letras (CTRL+9)
};

const ELEMENT_STYLES = {
    [ELEMENT_TYPES.SCENE]: "uppercase text-left mb-4 mt-6 tracking-wider w-full",
    [ELEMENT_TYPES.ACTION]: "text-left mb-2 w-full",
    [ELEMENT_TYPES.CHARACTER]: "uppercase text-center mt-4 mb-0 mx-auto block w-2/3 tracking-wide",
    [ELEMENT_TYPES.PARENTHETICAL]: "text-center text-sm mb-0 mx-auto block w-[25ch] italic",
    [ELEMENT_TYPES.DIALOGUE]: "text-left mb-2 mx-auto block w-[31ch]",
    [ELEMENT_TYPES.LYRICS]: "text-left mb-2 mx-auto block w-[33ch]",
    [ELEMENT_TYPES.SHOT]: "uppercase text-left font-bold mb-4 mt-4 tracking-wider w-full",
    [ELEMENT_TYPES.TRANSITION]: "uppercase text-right mb-4 mt-4 text-sm w-full",
    [ELEMENT_TYPES.NOTE]: "text-left bg-yellow-100 p-2 text-sm text-gray-600 mb-2 border-l-4 border-yellow-400 italic w-full"
};

const ELEMENT_LABELS = {
    [ELEMENT_TYPES.SCENE]: "Escena (Ctrl+1)",
    [ELEMENT_TYPES.ACTION]: "Acción (Ctrl+2)",
    [ELEMENT_TYPES.CHARACTER]: "Personaje (Ctrl+3)",
    [ELEMENT_TYPES.PARENTHETICAL]: "Paréntesis (Ctrl+4)",
    [ELEMENT_TYPES.DIALOGUE]: "Diálogo (Ctrl+5)",
    [ELEMENT_TYPES.SHOT]: "Toma (Ctrl+6)",
    [ELEMENT_TYPES.TRANSITION]: "Texto (Ctrl+7)",
    [ELEMENT_TYPES.NOTE]: "Nota (Ctrl+8)",
    [ELEMENT_TYPES.LYRICS]: "Letras (Ctrl+9)"
};

const ScriptElement = ({ element, onChange, onUpdate, onKeyDown, onFocus, autoFocus, usedLocations = [], availableScenes = [], characterSuggestions = [], characterAlternateSuggestion = '', isExporting = false, readOnly = false, registerRef, isSceneBold = false, isCharacterBold = false, isTextBold = true, showSceneNumber = false, sceneNumber = null, isActive = false, extraTopSpacing = false }) => {
    const textareaRef = useRef(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [showLinkMenu, setShowLinkMenu] = useState(false);
    const spacingClass = extraTopSpacing ? 'mt-4' : '';
    const boldClass =
        (element.type === ELEMENT_TYPES.SCENE && isSceneBold) ||
        (element.type === ELEMENT_TYPES.CHARACTER && isCharacterBold) ||
        (element.type === ELEMENT_TYPES.TRANSITION && isTextBold)
            ? 'font-bold'
            : '';

    const handleTextareaRef = (node) => {
        textareaRef.current = node;
        if (registerRef) {
            registerRef(element.id, node);
        }
    };

    useEffect(() => {
        if (autoFocus && textareaRef.current && !isExporting) {
            textareaRef.current.focus();
        }
    }, [autoFocus, isExporting]);

    // Auto-resize
    const adjustHeight = () => {
        if (textareaRef.current && !isExporting) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [element.content, element.type, isExporting]);

    // Handle cursor positioning request
    useEffect(() => {
        if (element.cursorRequest !== undefined && textareaRef.current && !isExporting) {
            textareaRef.current.setSelectionRange(element.cursorRequest, element.cursorRequest);
        }
    }, [element.cursorRequest, element.content, isExporting]);

    // Autocomplete Logic
    useEffect(() => {
        if (isExporting) {
            setShowSuggestions(false);
            return;
        }
        if (element.type === ELEMENT_TYPES.SCENE && isActive) {
            const content = element.content.toUpperCase();
            const PREFIXES = ['INT.', 'EXT.', 'I/E.', 'INT./EXT.'];
            const TIMES = ['DAY', 'NIGHT', 'LATER', 'MORNING', 'CONTINUOUS', 'MOMENTS LATER'];

            let newSuggestions = [];
            let currentQuery = '';
            
            // 1. Prefix Suggestions (Start of line)
            if (!content.includes(' ')) {
                newSuggestions = PREFIXES.filter(p => p.startsWith(content));
                currentQuery = content;
            } 
            // 2. Time Suggestions (After " - ")
            else if (content.includes(' - ')) {
                const parts = content.split(' - ');
                const timeQuery = parts[1] || '';
                // Only suggest if we are seemingly at the end (simple check)
                newSuggestions = TIMES.filter(t => t.startsWith(timeQuery));
                currentQuery = timeQuery;
            }
            // 3. Location Suggestions (After Prefix + Space, no " - " yet)
            else {
                const prefixMatch = content.match(/^(INT\.|EXT\.|I\/E\.|INT\.\/EXT\.)\s+(.*)$/);
                if (prefixMatch) {
                    const locationQuery = prefixMatch[2]; // Can be empty
                    if (!content.includes(' - ')) {
                        newSuggestions = usedLocations.filter(l => l.startsWith(locationQuery));
                        currentQuery = locationQuery;
                    }
                }
            }

            // If the only suggestion matches exactly what the user typed, don't show it (allow Enter to create new line)
            if (newSuggestions.length === 1 && newSuggestions[0] === currentQuery) {
                setShowSuggestions(false);
            } else if (newSuggestions.length > 0) {
                setSuggestions(newSuggestions);
                setShowSuggestions(true);
                setSuggestionIndex(0);
            } else {
                setShowSuggestions(false);
            }
        } else if (element.type === ELEMENT_TYPES.CHARACTER && isActive) {
            const query = element.content.trim().toUpperCase();
            const newSuggestions = (query.length === 0
                ? characterSuggestions
                : characterSuggestions.filter((name) => name.startsWith(query))
            )
                .filter((name) => name !== query)
                .slice(0, 8);

            if (newSuggestions.length > 0) {
                setSuggestions(newSuggestions);
                setShowSuggestions(true);
                setSuggestionIndex(0);
            } else {
                setShowSuggestions(false);
            }
        } else {
            setShowSuggestions(false);
        }
    }, [element.content, element.type, usedLocations, characterSuggestions, isExporting, isActive]);

    const handleChange = (e) => {
        if (readOnly) return;
        // Force uppercase for Scene, Character, Shot, Transition
        let val = e.target.value;
        if ([ELEMENT_TYPES.SCENE, ELEMENT_TYPES.CHARACTER, ELEMENT_TYPES.SHOT, ELEMENT_TYPES.TRANSITION].includes(element.type)) {
            val = val.toUpperCase();
        }
        onChange(element.id, val);
    };

    const handleKeyDownInternal = (e) => {
        if (!readOnly && !isExporting && element.type === ELEMENT_TYPES.CHARACTER && e.key === 'Enter' && element.content.trim() === '' && characterAlternateSuggestion) {
            e.preventDefault();
            e.stopPropagation();
            onChange(element.id, characterAlternateSuggestion.toUpperCase());
            setShowSuggestions(false);
            return;
        }
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSuggestionIndex(prev => (prev + 1) % suggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                applySuggestion(suggestions[suggestionIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowSuggestions(false);
                return;
            }
        }
        onKeyDown(e, element.id);
    };

    const applySuggestion = (text) => {
        if (element.type === ELEMENT_TYPES.CHARACTER) {
            onChange(element.id, text.toUpperCase());
            setShowSuggestions(false);
            return;
        }
        let newContent = element.content.toUpperCase();
        const PREFIXES = ['INT.', 'EXT.', 'I/E.', 'INT./EXT.'];
        const TIMES = ['DAY', 'NIGHT', 'LATER', 'MORNING', 'CONTINUOUS', 'MOMENTS LATER'];
        
        if (PREFIXES.includes(text)) {
            newContent = text + ' ';
        } else if (TIMES.includes(text)) {
            const parts = newContent.split(' - ');
            newContent = parts[0] + ' - ' + text;
        } else {
            // Must be location
            const match = newContent.match(/^(INT\.|EXT\.|I\/E\.|INT\.\/EXT\.)\s+/);
            if (match) {
                newContent = match[0] + text;
            }
        }
        
        onChange(element.id, newContent);
        setShowSuggestions(false);
    };

    // Placeholder logic for Scene Location
    const showLocationPlaceholder = !isExporting && element.type === ELEMENT_TYPES.SCENE && 
                                    /^(INT\.|EXT\.|I\/E\.|INT\.\/EXT\.)\s+$/.test(element.content);

    // Link Scene Logic
    const toggleLinkMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowLinkMenu(!showLinkMenu);
    };

    const linkScene = (sceneId) => {
        if (onUpdate) {
            onUpdate({ linkedSceneId: sceneId });
        }
        setShowLinkMenu(false);
    };

    const unlinkScene = () => {
        if (onUpdate) {
            onUpdate({ linkedSceneId: null });
        }
        setShowLinkMenu(false);
    };

    const isSceneHeader = element.type === ELEMENT_TYPES.SCENE;
    const isValidHeader = isSceneHeader && (/^(INT\.|EXT\.|I\/E\.|INT\.\/EXT\.)/.test(element.content) || element.linkedSceneId);
    
    const linkedScene = availableScenes.find(s => s.id === element.linkedSceneId);

    return (
        <div className="relative group w-full">
            {showSceneNumber && isSceneHeader && typeof sceneNumber === 'number' && (
                <div
                    className="absolute -left-10 top-0 mt-6 text-gray-900 select-none"
                    style={{ fontFamily: '"Courier Prime", "Courier New", Courier, monospace', fontSize: '12pt' }}
                >
                    {sceneNumber}.
                </div>
            )}
            {/* Link Scene UI - Only visible when NOT exporting */}
            {isValidHeader && !isExporting && (
                <div className="absolute right-0 top-0 h-full flex items-center pr-2 z-10">
                    <div className={`${element.linkedSceneId || showLinkMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button 
                            onClick={toggleLinkMenu}
                            className={`p-1 rounded-full transition-all flex items-center gap-1 border ${
                                element.linkedSceneId 
                                ? 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-200' 
                                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-600 shadow-sm'
                            }`}
                            title={element.linkedSceneId ? `Enlazado a Escena ${linkedScene?.number}` : "Enlazar con escena"}
                        >
                            {element.linkedSceneId ? <LinkIcon size={12} /> : <Unlink size={12} />}
                            {element.linkedSceneId && <span className="text-[10px] font-bold">#{linkedScene?.number}</span>}
                        </button>
                    </div>
                    
                    {/* Dropdown */}
                    {showLinkMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden w-56 z-50 max-h-60 overflow-y-auto">
                            {element.linkedSceneId && (
                                <button 
                                    onClick={unlinkScene}
                                    className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-b border-gray-100"
                                >
                                    <Unlink size={12} /> Desvincular
                                </button>
                            )}
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                                Enlazar con Escena
                            </div>
                            {availableScenes.length > 0 ? (
                                availableScenes.map(scene => (
                                    <button
                                        key={scene.id}
                                        onClick={() => linkScene(scene.id)}
                                        className={`w-full text-left px-4 py-2 text-xs hover:bg-purple-50 flex items-center gap-2 border-b border-gray-50 last:border-0 ${
                                            element.linkedSceneId === scene.id ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700'
                                        }`}
                                    >
                                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-full text-[9px] font-bold text-gray-500">
                                            {scene.number}
                                        </span>
                                        <span className="truncate">{scene.description || 'Sin descripción'}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-2 text-xs text-gray-400 italic">No hay escenas disponibles</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {showLocationPlaceholder && (
                <div className={`absolute left-0 top-0 pointer-events-none text-gray-400 opacity-50 ${ELEMENT_STYLES[element.type]}`} style={{ paddingLeft: `${element.content.length}ch` }}>
                    Lugar donde ocurre tu escena...
                </div>
            )}
            
            {/* Conditional Rendering for Export: Use div instead of textarea */}
            {isExporting ? (
                <div 
                    className={`bg-transparent whitespace-pre-wrap ${ELEMENT_STYLES[element.type]} ${spacingClass} ${boldClass}`}
                    style={{
                        fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
                        fontSize: '12pt',
                        lineHeight: '1.2',
                        minHeight: '1.2em'
                    }}
                >
                    {element.content || ' '}
                </div>
            ) : (
                <textarea
                    ref={handleTextareaRef}
                    value={element.content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDownInternal}
                    onFocus={() => onFocus(element.id)}
                    readOnly={readOnly}
                    className={`resize-none outline-none overflow-hidden bg-transparent ${ELEMENT_STYLES[element.type]} ${spacingClass} ${boldClass} ${isActive ? 'bg-purple-50/80 ring-4 ring-purple-50/80 rounded-sm' : ''}`}
                    style={{
                        fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
                        fontSize: '12pt',
                        lineHeight: 'normal'
                    }}
                    placeholder={
                        element.type === ELEMENT_TYPES.NOTE
                            ? "Nota..."
                            : (element.type === ELEMENT_TYPES.CHARACTER && characterAlternateSuggestion && element.content.trim() === '')
                                ? characterAlternateSuggestion.toUpperCase()
                                : ""
                    }
                    rows={1}
                    spellCheck={false}
                />
            )}
            
            {showSuggestions && !isExporting && (
                <ul className={`absolute z-50 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden max-h-48 overflow-y-auto ${element.type === ELEMENT_TYPES.CHARACTER ? 'left-1/2 -translate-x-1/2 w-full max-w-[31ch]' : 'left-0 min-w-[200px]'}`}>
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={suggestion}
                            className={`px-4 py-2 text-sm cursor-pointer font-mono hover:bg-purple-50 ${
                                index === suggestionIndex ? 'bg-purple-100 text-purple-900' : 'text-gray-700'
                            }`}
                            onClick={() => applySuggestion(suggestion)}
                        >
                            {suggestion}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const TitlePage = ({ data, onChange, isExporting = false, readOnly = false }) => {
    return (
        <div className="w-[8.5in] h-[11in] bg-white shadow-lg p-[25mm] relative flex flex-col font-mono overflow-hidden"
             style={{ fontFamily: '"Courier Prime", "Courier New", Courier, monospace' }}>
            {/* Center Content */}
            <div className="flex-1 flex flex-col justify-center items-center gap-12 pt-20">
                {isExporting ? (
                    <div className="w-full text-center uppercase font-bold whitespace-pre-wrap"
                         style={{ fontSize: '18pt', lineHeight: '1.2' }}>
                        {data.title || 'TÍTULO DEL PROYECTO'}
                    </div>
                ) : (
                    <textarea
                        value={data.title || ''}
                        onChange={(e) => onChange({ title: e.target.value })}
                        readOnly={readOnly}
                        className="w-full text-center uppercase font-bold outline-none bg-transparent resize-none overflow-hidden"
                        placeholder="TÍTULO DEL PROYECTO"
                        style={{ fontSize: '18pt', lineHeight: '1.2' }}
                        rows={2}
                        spellCheck={false}
                    />
                )}
                
                <div className="flex flex-col items-center gap-8">
                    <div className="text-[12pt]">Escrito por</div>
                    
                    {isExporting ? (
                        <div className="w-full text-center whitespace-pre-wrap"
                             style={{ fontSize: '14pt' }}>
                            {data.author || 'Nombre del Autor'}
                        </div>
                    ) : (
                        <textarea
                            value={data.author || ''}
                            onChange={(e) => onChange({ author: e.target.value })}
                            readOnly={readOnly}
                            className="w-full text-center outline-none bg-transparent resize-none overflow-hidden"
                            placeholder="Nombre del Autor"
                            style={{ fontSize: '14pt' }}
                            rows={1}
                            spellCheck={false}
                        />
                    )}
                </div>
            </div>

            {/* Bottom Left Content */}
            <div className="absolute bottom-[25mm] left-[25mm] flex flex-col text-left gap-1">
                {isExporting ? (
                    <>
                        <div className="text-[12pt]">{data.company || ' '}</div>
                        <div className="text-[12pt]">{data.email || ' '}</div>
                    </>
                ) : (
                    <>
                        <input
                            value={data.company || ''}
                            onChange={(e) => onChange({ company: e.target.value })}
                            readOnly={readOnly}
                            className="outline-none bg-transparent w-96 text-[12pt]"
                            placeholder="Nombre de Empresa"
                            spellCheck={false}
                        />
                        <input
                            value={data.email || ''}
                            onChange={(e) => onChange({ email: e.target.value })}
                            readOnly={readOnly}
                            className="outline-none bg-transparent w-96 text-[12pt]"
                            placeholder="correo@ejemplo.com"
                            spellCheck={false}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

const GuionTab = ({ project, onUpdateProject, readOnly = false }) => {
  // Data structure: Pages -> Elements
  // Initial State: Title Page + One Script Page
  const [pages, setPages] = useState([
    { 
        id: 'title-page', 
        type: 'title', 
        title: '', 
        author: '', 
        company: '', 
        email: '' 
    },
    { 
        id: Date.now(), 
        elements: [{ id: Date.now() + 1, type: ELEMENT_TYPES.ACTION, content: '' }] 
    }
  ]);
  
  const [activeViewer, setActiveViewer] = useState('tratamiento'); 
  const [saving, setSaving] = useState(false);
  const [activeElementId, setActiveElementId] = useState(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const isFirstLoad = useRef(true);
  const elementRefs = useRef({});
  const pageRefs = useRef({});
  const savedPositionRef = useRef(null);
  const didRestorePositionRef = useRef(false);
  const [isSceneBold, setIsSceneBold] = useState(() => {
      try {
          const saved = localStorage.getItem('cineasta:guion:isSceneBold');
          return saved !== null ? JSON.parse(saved) : false;
      } catch { return false; }
  });
  const [isCharacterBold, setIsCharacterBold] = useState(() => {
      try {
          const saved = localStorage.getItem('cineasta:guion:isCharacterBold');
          return saved !== null ? JSON.parse(saved) : false;
      } catch { return false; }
  });
  const [isTextBold, setIsTextBold] = useState(() => {
      try {
          const saved = localStorage.getItem('cineasta:guion:isTextBold');
          return saved !== null ? JSON.parse(saved) : true;
      } catch { return true; }
  });
  const [showSceneNumbers, setShowSceneNumbers] = useState(() => {
      try {
          const saved = localStorage.getItem('cineasta:guion:showSceneNumbers');
          return saved !== null ? JSON.parse(saved) : false;
      } catch { return false; }
  });
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const nextIdRef = useRef(Date.now());
  const pagesRef = useRef(pages);

  // Persist Editor Preferences
  useEffect(() => {
      try { localStorage.setItem('cineasta:guion:isSceneBold', JSON.stringify(isSceneBold)); } catch {}
  }, [isSceneBold]);

  useEffect(() => {
      try { localStorage.setItem('cineasta:guion:isCharacterBold', JSON.stringify(isCharacterBold)); } catch {}
  }, [isCharacterBold]);

  useEffect(() => {
      try { localStorage.setItem('cineasta:guion:isTextBold', JSON.stringify(isTextBold)); } catch {}
  }, [isTextBold]);

  useEffect(() => {
      try { localStorage.setItem('cineasta:guion:showSceneNumbers', JSON.stringify(showSceneNumbers)); } catch {}
  }, [showSceneNumbers]);

  const activeElementIdRef = useRef(activeElementId);
  const isExportingRef = useRef(isExporting);
  const readOnlyRef = useRef(readOnly);
  const paginationScheduledRef = useRef(false);

  useEffect(() => {
      pagesRef.current = pages;
      let maxId = nextIdRef.current;
      for (const p of pages || []) {
          if (typeof p.id === 'number' && p.id > maxId) maxId = p.id;
          for (const el of p.elements || []) {
              if (typeof el.id === 'number' && el.id > maxId) maxId = el.id;
          }
      }
      nextIdRef.current = maxId;
  }, [pages]);

  useEffect(() => {
      activeElementIdRef.current = activeElementId;
  }, [activeElementId]);

  useEffect(() => {
      isExportingRef.current = isExporting;
  }, [isExporting]);

  useEffect(() => {
      readOnlyRef.current = readOnly;
  }, [readOnly]);

  const generateId = () => {
      nextIdRef.current += 1;
      return nextIdRef.current;
  };

  const lastPositionStorageKey = useMemo(() => {
      if (!project?.id) return '';
      return `cineasta:guion:lastPosition:${project.id}`;
  }, [project?.id]);

  const normalizeCharacterName = (value) => value.trim().replace(/\s+/g, ' ').toUpperCase();

  const characterNamesByRecency = useMemo(() => {
      const lastSeen = new Map();
      let cursor = 0;
      for (const page of pages) {
          if (page.type === 'title') continue;
          for (const el of (page.elements || [])) {
              if (el.type !== ELEMENT_TYPES.CHARACTER) continue;
              const name = normalizeCharacterName(el.content || '');
              if (!name) continue;
              cursor += 1;
              lastSeen.set(name, cursor);
          }
      }
      return [...lastSeen.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name);
  }, [pages]);

  const alternateCharacterSuggestionByElementId = useMemo(() => {
      const map = new Map();
      let sceneRecentDistinct = [];

      for (const page of pages) {
          if (page.type === 'title') continue;
          for (const el of (page.elements || [])) {
              if (el.type === ELEMENT_TYPES.SCENE) {
                  sceneRecentDistinct = [];
                  continue;
              }

              if (el.type === ELEMENT_TYPES.CHARACTER) {
                  map.set(el.id, sceneRecentDistinct.length >= 2 ? sceneRecentDistinct[sceneRecentDistinct.length - 2] : '');

                  const name = normalizeCharacterName(el.content || '');
                  if (!name) continue;

                  const existingIndex = sceneRecentDistinct.indexOf(name);
                  if (existingIndex !== -1) sceneRecentDistinct.splice(existingIndex, 1);
                  sceneRecentDistinct.push(name);
              }
          }
      }

      return map;
  }, [pages]);

  const sceneNumberByElementId = useMemo(() => {
      const map = new Map();
      let count = 0;
      for (const page of pages) {
          if (!page || page.type === 'title') continue;
          for (const el of (page.elements || [])) {
              if (el?.type !== ELEMENT_TYPES.SCENE) continue;
              count += 1;
              map.set(el.id, count);
          }
      }
      return map;
  }, [pages]);

  // Listen for Ctrl key
  useEffect(() => {
      const handleKeyDown = (e) => {
          if (e.key === 'Control') setIsCtrlPressed(true);
      };
      const handleKeyUp = (e) => {
          if (e.key === 'Control') setIsCtrlPressed(false);
      };
      
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, []);

  // Extract used locations for autocomplete
  const usedLocations = useMemo(() => {
      const locations = new Set();
      pages.forEach(p => {
          if (p.elements) {
              p.elements.forEach(el => {
                  if (el.type === ELEMENT_TYPES.SCENE) {
                      // Parse location: "INT. OFFICE - DAY" -> "OFFICE"
                      const match = el.content.match(/^(?:INT\.|EXT\.|I\/E\.|INT\.\/EXT\.)\s+(.*?)(?:\s+-\s+|$)/);
                      if (match && match[1]) {
                          const loc = match[1].trim().toUpperCase();
                          if (loc) locations.add(loc);
                      }
                  }
              });
          }
      });
      return Array.from(locations).sort();
  }, [pages]);

  // Load initial data
  useEffect(() => {
    if (isFirstLoad.current) {
        if (project?.guion_data && project.guion_data.pages && project.guion_data.pages.length > 0) {
            let loadedPages = project.guion_data.pages;
            
            // Check if pages use old string format or new element format
            const firstPage = loadedPages[0];
            if (typeof firstPage.content === 'string') {
                // MIGRATE: Convert string content to single Action element per page
                loadedPages = loadedPages.map(p => ({
                    id: p.id,
                    elements: [{ id: Date.now() + Math.random(), type: ELEMENT_TYPES.ACTION, content: p.content }]
                }));
            }

            // ENSURE TITLE PAGE: If first page is not a title page, insert one
            if (loadedPages[0].type !== 'title') {
                loadedPages = [
                    { 
                        id: 'title-page', 
                        type: 'title', 
                        title: project.title || '', 
                        author: '', 
                        company: '', 
                        email: '' 
                    },
                    ...loadedPages
                ];
            }
            
            setPages(loadedPages);
        }
        isFirstLoad.current = false;
    }
  }, [project]);

  // Save State & Refs
  const isDirtyRef = useRef(false);
  const saveDataRef = useRef(null);

  // Keep latest saveData function in ref for unmount cleanup
  useEffect(() => {
      saveDataRef.current = saveData;
  });

  const registerElementRef = (elementId, node) => {
      if (!node) {
          delete elementRefs.current[elementId];
      } else {
          elementRefs.current[elementId] = node;
      }
  };

  const registerPageRef = (pageId, node) => {
      if (!node) {
          delete pageRefs.current[pageId];
      } else {
          pageRefs.current[pageId] = node;
      }
  };

  const getPageEditorNode = (pageId) => {
      const wrapper = pageRefs.current[pageId];
      if (!wrapper) return null;
      return wrapper.querySelector('.script-page-editor');
  };

  const isPageOverflowing = (pageId) => {
      const node = getPageEditorNode(pageId);
      if (!node) return false;
      return node.scrollHeight - node.clientHeight > 2;
  };

  const getDialogueGroupRange = (elements, endIndex) => {
      if (!elements || endIndex === null || endIndex === undefined) return null;
      if (endIndex < 0 || endIndex >= elements.length) return null;
      const endEl = elements[endIndex];
      if (!endEl) return null;
      if (![ELEMENT_TYPES.CHARACTER, ELEMENT_TYPES.PARENTHETICAL, ELEMENT_TYPES.DIALOGUE].includes(endEl.type)) return null;

      let i = endIndex;
      while (i >= 0 && [ELEMENT_TYPES.DIALOGUE, ELEMENT_TYPES.PARENTHETICAL].includes(elements[i]?.type)) {
          i -= 1;
      }
      if (i < 0) return null;
      if (elements[i]?.type !== ELEMENT_TYPES.CHARACTER) return null;

      const startIndex = i;
      for (let j = startIndex + 1; j <= endIndex; j += 1) {
          if (![ELEMENT_TYPES.PARENTHETICAL, ELEMENT_TYPES.DIALOGUE].includes(elements[j]?.type)) return null;
      }

      return { startIndex, endIndex };
  };

  const schedulePagination = () => {
      if (paginationScheduledRef.current) return;
      paginationScheduledRef.current = true;
      requestAnimationFrame(() => {
          requestAnimationFrame(() => {
              paginationScheduledRef.current = false;
              if (readOnlyRef.current) return;
              if (isExportingRef.current) return;
              const currentPages = pagesRef.current || [];
              if (currentPages.length <= 1) return;

              for (let pageIndex = 0; pageIndex < currentPages.length; pageIndex += 1) {
                  const page = currentPages[pageIndex];
                  if (!page || page.type === 'title') continue;
                  if (!page.elements || page.elements.length === 0) continue;
                  if (!isPageOverflowing(page.id)) continue;

                  const fromPageId = page.id;
                  const toPageExists = currentPages[pageIndex + 1] && currentPages[pageIndex + 1].type !== 'title';
                  const toPageId = toPageExists ? currentPages[pageIndex + 1].id : generateId();

                  const lastElementIndex = page.elements.length - 1;
                  const lastElement = page.elements[lastElementIndex];
                  if (!lastElement) return;

                  const dialogueGroupRange = getDialogueGroupRange(page.elements, lastElementIndex);
                  const moveGroupTogether =
                      dialogueGroupRange &&
                      dialogueGroupRange.startIndex !== dialogueGroupRange.endIndex &&
                      page.elements[dialogueGroupRange.startIndex]?.type === ELEMENT_TYPES.CHARACTER;

                  const canSplit = !moveGroupTogether && [ELEMENT_TYPES.ACTION, ELEMENT_TYPES.DIALOGUE, ELEMENT_TYPES.LYRICS, ELEMENT_TYPES.NOTE].includes(lastElement.type);
                  const textareaNode = elementRefs.current[lastElement.id];

                  if (canSplit && textareaNode && (lastElement.content || '').trim().length > 0) {
                      const fullText = lastElement.content;
                      const originalValue = textareaNode.value;
                      const originalHeight = textareaNode.style.height;

                      const applyTemp = (value) => {
                          textareaNode.value = value;
                          textareaNode.style.height = 'auto';
                          textareaNode.style.height = textareaNode.scrollHeight + 'px';
                      };

                      let low = 0;
                      let high = fullText.length;
                      let best = 0;

                      while (low <= high) {
                          const mid = Math.floor((low + high) / 2);
                          applyTemp(fullText.slice(0, mid));
                          if (!isPageOverflowing(fromPageId)) {
                              best = mid;
                              low = mid + 1;
                          } else {
                              high = mid - 1;
                          }
                      }

                      textareaNode.value = originalValue;
                      textareaNode.style.height = originalHeight || 'auto';
                      textareaNode.style.height = textareaNode.scrollHeight + 'px';

                      const prefixCandidate = fullText.slice(0, best);
                      const lastSpace = Math.max(
                          prefixCandidate.lastIndexOf(' '),
                          prefixCandidate.lastIndexOf('\n'),
                          prefixCandidate.lastIndexOf('\t')
                      );

                      const splitAt = lastSpace > 0 ? lastSpace : (best > 0 && best < fullText.length ? best : 0);

                      if (splitAt > 0) {
                          const prefix = fullText.slice(0, splitAt).replace(/\s+$/, '');
                          const suffix = fullText.slice(splitAt).replace(/^\s+/, '');
                          if (prefix.length > 0 && suffix.length > 0) {
                              const newElementId = generateId();
                              const shouldCreatePage = !toPageExists;

                              setPages((prev) => {
                                  const next = prev.map((p) => ({ ...p, elements: p.elements ? [...p.elements] : p.elements }));
                                  const fromIndex = next.findIndex((p) => p.id === fromPageId);
                                  if (fromIndex === -1) return prev;

                                  if (shouldCreatePage) {
                                      next.splice(fromIndex + 1, 0, { id: toPageId, elements: [] });
                                  }

                                  const toIndex = next.findIndex((p) => p.id === toPageId);
                                  if (toIndex === -1) return prev;

                                  const fromElIndex = next[fromIndex].elements?.findIndex((el) => el.id === lastElement.id) ?? -1;
                                  if (fromElIndex === -1) return prev;

                                  next[fromIndex].elements[fromElIndex] = { ...next[fromIndex].elements[fromElIndex], content: prefix };
                                  next[toIndex].elements = [
                                      { id: newElementId, type: lastElement.type, content: suffix, cursorRequest: suffix.length },
                                      ...(next[toIndex].elements || [])
                                  ];
                                  return next;
                              });

                              if (activeElementIdRef.current === lastElement.id) {
                                  setActiveElementId(newElementId);
                              }

                              return;
                          }
                      }
                  }

                  const shouldCreatePage = !toPageExists;
                  setPages((prev) => {
                      const next = prev.map((p) => ({ ...p, elements: p.elements ? [...p.elements] : p.elements }));
                      const fromIndex = next.findIndex((p) => p.id === fromPageId);
                      if (fromIndex === -1) return prev;

                      const fromElements = next[fromIndex].elements || [];
                      const range = moveGroupTogether ? dialogueGroupRange : null;
                      const moveStartIndex = range ? range.startIndex : fromElements.findIndex((el) => el.id === lastElement.id);
                      if (moveStartIndex === -1) return prev;
                      const moveCount = range ? (range.endIndex - range.startIndex + 1) : 1;

                      const moved = fromElements.splice(moveStartIndex, moveCount);
                      next[fromIndex].elements = fromElements;

                      if (shouldCreatePage) {
                          next.splice(fromIndex + 1, 0, { id: toPageId, elements: [] });
                      }

                      const toIndex = next.findIndex((p) => p.id === toPageId);
                      if (toIndex === -1) return prev;

                      next[toIndex].elements = [...moved, ...(next[toIndex].elements || [])];

                      if (next[fromIndex].elements.length === 0) {
                          next[fromIndex].elements = [{ id: generateId(), type: ELEMENT_TYPES.ACTION, content: '' }];
                      }

                      return next;
                  });

                  return;
              }
          });
      });
  };

  useEffect(() => {
      if (readOnly || isExporting) return;
      schedulePagination();
  }, [pages, readOnly, isExporting]);

  const activePageIndex = useMemo(() => {
      if (!activeElementId) return null;
      for (let i = 0; i < pages.length; i += 1) {
          const p = pages[i];
          if (p.elements?.some((el) => el.id === activeElementId)) return i;
      }
      return null;
  }, [pages, activeElementId]);

  const activePageId = useMemo(() => {
      if (activePageIndex === null) return null;
      return pages[activePageIndex]?.id ?? null;
  }, [pages, activePageIndex]);

  useEffect(() => {
      if (!lastPositionStorageKey) return;
      if (activeElementId === null || activeElementId === undefined) return;
      if (activePageId === null || activePageId === undefined) return;

      try {
          localStorage.setItem(
              lastPositionStorageKey,
              JSON.stringify({
                  pageId: activePageId,
                  pageIndex: activePageIndex,
                  elementId: activeElementId
              })
          );
      } catch {
      }
  }, [lastPositionStorageKey, activeElementId, activePageId, activePageIndex]);

  useEffect(() => {
      if (!lastPositionStorageKey) return;
      try {
          const raw = localStorage.getItem(lastPositionStorageKey);
          if (!raw) {
              savedPositionRef.current = null;
              didRestorePositionRef.current = true;
              return;
          }
          savedPositionRef.current = JSON.parse(raw);
          didRestorePositionRef.current = false;
      } catch {
          savedPositionRef.current = null;
          didRestorePositionRef.current = true;
      }
  }, [lastPositionStorageKey]);

  useEffect(() => {
      if (!lastPositionStorageKey) return;
      if (didRestorePositionRef.current) return;
      if (!pages || pages.length === 0) return;
      if (activeElementId) return;

      const parsed = savedPositionRef.current;
      if (!parsed) {
          didRestorePositionRef.current = true;
          return;
      }

      const savedPageId = parsed?.pageId;
      const savedPageIndex = typeof parsed?.pageIndex === 'number' ? parsed.pageIndex : null;
      const savedElementId = parsed?.elementId;

      let targetPageId = null;
      if (savedPageId && pages.some((p) => p.id === savedPageId)) {
          targetPageId = savedPageId;
      } else if (savedPageIndex !== null && pages[savedPageIndex]?.id) {
          targetPageId = pages[savedPageIndex].id;
      }

      if (!targetPageId) return;

      const attemptRestore = () => {
          pageRefs.current[targetPageId]?.scrollIntoView({ block: 'start' });

          const elementExists =
              savedElementId &&
              pages.some((p) => p.elements?.some((el) => el.id === savedElementId));

          if (elementExists) {
              setActiveElementId(savedElementId);
              didRestorePositionRef.current = true;
              return;
          }

          const targetPage = pages.find((p) => p.id === targetPageId);
          const firstElementId = targetPage?.elements?.[0]?.id;
          if (firstElementId) {
              setActiveElementId(firstElementId);
          }
          didRestorePositionRef.current = true;
      };

      requestAnimationFrame(() => {
          requestAnimationFrame(attemptRestore);
      });
  }, [lastPositionStorageKey, pages, activeElementId]);

  const handlePageClick = (e, page) => {
      if (readOnly || isExporting) return;

      const target = e.target;
      if (target.closest('textarea')) return;
      if (!page.elements || page.elements.length === 0) return;

      const clickY = e.clientY;

      let closestId = null;
      let closestDistance = Infinity;

      page.elements.forEach((el) => {
          const node = elementRefs.current[el.id];
          if (!node) return;
          const rect = node.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const distance = Math.abs(clickY - centerY);
          if (distance < closestDistance) {
              closestDistance = distance;
              closestId = el.id;
          }
      });

      if (!closestId) return;

      setActiveElementId(closestId);

      const focusNode = elementRefs.current[closestId];
      if (focusNode) {
          focusNode.focus();
      }
  };

  // Save on unmount
  useEffect(() => {
      return () => {
          if (isDirtyRef.current && saveDataRef.current) {
              saveDataRef.current();
          }
      };
  }, []);

  // Auto-save debouncer
  useEffect(() => {
    if (isFirstLoad.current) return;

    if (readOnly) return;

    isDirtyRef.current = true;

    const timer = setTimeout(() => {
      if (project) {
        saveData();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [pages]);

  const saveData = async () => {
    if (readOnly) return;
    isDirtyRef.current = false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('proyectos_cineasta')
        .update({ guion_data: { pages } })
        .eq('id', project.id);

      if (error) throw error;
      
      if (onUpdateProject) {
          onUpdateProject({ guion_data: { pages } });
      }

    } catch (error) {
      console.error('Error saving guion data:', error);
    } finally {
      setSaving(false);
    }
  };

  const addPage = () => {
    if (readOnly) return;
    setPages([...pages, { 
        id: Date.now(), 
        elements: [{ id: Date.now() + 1, type: ELEMENT_TYPES.ACTION, content: '' }] 
    }]);
  };

  const deletePage = (id) => {
    if (readOnly) return;
    if (pages.length <= 1) return;
    const pageToDelete = pages.find(p => p.id === id);
    if (pageToDelete?.type === 'title') {
        alert('No se puede eliminar la página de título.');
        return;
    }
    setPages(pages.filter(p => p.id !== id));
  };

  const updateTitlePage = (data) => {
      if (readOnly) return;
      setPages(prev => prev.map(p => p.type === 'title' ? { ...p, ...data } : p));
  };

  // Element Management
  const updateElement = (pageId, elementId, newContent) => {
      if (readOnly) return;
      setPages(prevPages => prevPages.map(page => {
          if (page.id !== pageId || !page.elements) return page;
          return {
              ...page,
              elements: page.elements.map(el => 
                  el.id === elementId ? { ...el, content: newContent, cursorRequest: undefined } : el
              )
          };
      }));
  };

  const updateElementProps = (pageId, elementId, props) => {
      if (readOnly) return;
      setPages(pages.map(page => {
          if (page.id !== pageId || !page.elements) return page;
          return {
              ...page,
              elements: page.elements.map(el => 
                  el.id === elementId ? { ...el, ...props } : el
              )
          };
      }));
  };

  const deleteElement = (pageId, elementId) => {
    if (readOnly) return;
    setPages(pages.map(page => {
      if (page.id !== pageId || !page.elements) return page;
      if (page.elements.length <= 1) return page; // Keep at least one element
      return {
        ...page,
        elements: page.elements.filter(el => el.id !== elementId)
      };
    }));
  };

  const changeElementType = (type) => {
      if (!activeElementId) return;
      
      setPages(pages.map(page => {
          if (!page.elements) return page;
          return {
              ...page,
              elements: page.elements.map(el => 
                  el.id === activeElementId ? { ...el, type: type } : el
              )
          };
      }));
  };

  const addSceneElement = () => {
    const newElement = {
        id: Date.now(),
        type: ELEMENT_TYPES.SCENE,
        content: 'INT. '
    };
    
    setPages(prevPages => {
        let targetPageId = prevPages[prevPages.length - 1].id;
        let activeIndex = -1;

        if (activeElementId) {
            const activePage = prevPages.find(p => p.elements?.some(el => el.id === activeElementId));
            if (activePage) {
                targetPageId = activePage.id;
                activeIndex = activePage.elements.findIndex(el => el.id === activeElementId);
            }
        }
        
        return prevPages.map(p => {
            if (p.id !== targetPageId || !p.elements) return p;
            const newElements = [...p.elements];
            if (activeIndex !== -1) {
                newElements.splice(activeIndex + 1, 0, newElement);
            } else {
                newElements.push(newElement);
            }
            return { ...p, elements: newElements };
        });
    });
    
    setTimeout(() => setActiveElementId(newElement.id), 50);
  };

  const focusScriptElement = (targetElementId, caretPosition) => {
      if (!targetElementId) return;
      setActiveElementId(targetElementId);
      requestAnimationFrame(() => {
          const node = elementRefs.current[targetElementId];
          if (!node) return;
          node.focus();
          const length = (node.value || '').length;
          const pos = caretPosition === 'end' ? length : 0;
          try {
              node.setSelectionRange(pos, pos);
          } catch {
          }
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
  };

  const getAdjacentScriptElementId = (direction, pageId, elementIndex) => {
      const currentPages = pagesRef.current || [];
      const currentPageIndex = currentPages.findIndex((p) => p.id === pageId);
      if (currentPageIndex === -1) return null;

      const currentPage = currentPages[currentPageIndex];
      const currentElements = currentPage?.elements || [];

      if (direction === 'next') {
          if (currentElements[elementIndex + 1]) return currentElements[elementIndex + 1].id;
          for (let i = currentPageIndex + 1; i < currentPages.length; i += 1) {
              const p = currentPages[i];
              if (p?.type === 'title') continue;
              if (p?.elements?.[0]) return p.elements[0].id;
          }
          return null;
      }

      if (currentElements[elementIndex - 1]) return currentElements[elementIndex - 1].id;
      for (let i = currentPageIndex - 1; i >= 0; i -= 1) {
          const p = currentPages[i];
          if (p?.type === 'title') continue;
          const els = p?.elements || [];
          if (els.length > 0) return els[els.length - 1].id;
      }
      return null;
  };

  const handleKeyDown = (e, pageId, elementId, index) => {
      if (!isExportingRef.current) {
          const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
          if (isArrowKey && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
              const node = elementRefs.current[elementId];
              const value = node?.value ?? '';
              const selectionStart = node?.selectionStart;
              const selectionEnd = node?.selectionEnd;

              if (node && selectionStart !== null && selectionStart !== undefined && selectionEnd !== null && selectionEnd !== undefined && selectionStart === selectionEnd) {
                  if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && selectionEnd === value.length) {
                      const nextId = getAdjacentScriptElementId('next', pageId, index);
                      if (nextId) {
                          e.preventDefault();
                          focusScriptElement(nextId, 'start');
                          return;
                      }
                  }

                  if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && selectionStart === 0) {
                      const prevId = getAdjacentScriptElementId('prev', pageId, index);
                      if (prevId) {
                          e.preventDefault();
                          focusScriptElement(prevId, 'end');
                          return;
                      }
                  }
              }
          }
      }

      // Handle Shortcuts CTRL+1..9
      if (e.ctrlKey) {
          const key = e.key;
          if (key >= '1' && key <= '9') {
              e.preventDefault();
              const types = [
                  ELEMENT_TYPES.SCENE, ELEMENT_TYPES.ACTION, ELEMENT_TYPES.CHARACTER, 
                  ELEMENT_TYPES.PARENTHETICAL, ELEMENT_TYPES.DIALOGUE, ELEMENT_TYPES.SHOT, 
                  ELEMENT_TYPES.TRANSITION, ELEMENT_TYPES.NOTE, ELEMENT_TYPES.LYRICS
              ];
              const typeIndex = parseInt(key) - 1;
              if (types[typeIndex]) {
                  changeElementType(types[typeIndex]);
              }
              return;
          }
      }

      // Handle Tab: Cycle types or indent
      if (e.key === 'Tab') {
          e.preventDefault();
          const currentPage = pages.find(p => p.id === pageId);
          const currentElement = currentPage.elements[index];
          
          if (currentElement.type === ELEMENT_TYPES.ACTION) {
              changeElementType(ELEMENT_TYPES.CHARACTER);
          } else if (currentElement.type === ELEMENT_TYPES.CHARACTER) {
              changeElementType(ELEMENT_TYPES.TRANSITION);
          } else if (currentElement.type === ELEMENT_TYPES.TRANSITION) {
              changeElementType(ELEMENT_TYPES.SCENE);
          } else {
              changeElementType(ELEMENT_TYPES.ACTION);
          }
          return;
      }

      // Handle Enter: Create new element
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          
          const currentPage = pages.find(p => p.id === pageId);
          const currentElement = currentPage.elements[index];
          
          // SPECIAL CASE: Empty Dialogue -> Parenthetical
          if (currentElement.type === ELEMENT_TYPES.DIALOGUE && currentElement.content.trim() === '') {
              const updatedElement = {
                  ...currentElement,
                  type: ELEMENT_TYPES.PARENTHETICAL,
                  content: '()',
                  cursorRequest: 1
              };
              
              setPages(pages.map(p => {
                  if (p.id !== pageId || !p.elements) return p;
                  return { ...p, elements: p.elements.map(el => el.id === elementId ? updatedElement : el) };
              }));
              return;
          }

          // SPECIAL CASE: Empty Action -> Scene (if it was an empty action after something else)
          if (currentElement.type === ELEMENT_TYPES.ACTION && currentElement.content.trim() === '') {
              changeElementType(ELEMENT_TYPES.SCENE);
              updateElement(pageId, elementId, 'INT. ');
              return;
          }

          // Logic for next element type
          let nextType = ELEMENT_TYPES.ACTION;
          if (currentElement.type === ELEMENT_TYPES.CHARACTER) nextType = ELEMENT_TYPES.DIALOGUE;
          if (currentElement.type === ELEMENT_TYPES.PARENTHETICAL) nextType = ELEMENT_TYPES.DIALOGUE;
          if (currentElement.type === ELEMENT_TYPES.DIALOGUE) nextType = ELEMENT_TYPES.CHARACTER;
          if (currentElement.type === ELEMENT_TYPES.SCENE) nextType = ELEMENT_TYPES.ACTION;
          if (currentElement.type === ELEMENT_TYPES.LYRICS) nextType = ELEMENT_TYPES.ACTION;
          
          const newElement = {
              id: Date.now(),
              type: nextType,
              content: nextType === ELEMENT_TYPES.SCENE ? 'INT. ' : ''
          };
          
          setPages(pages.map(p => {
              if (p.id !== pageId || !p.elements) return p;
              const newElements = [...p.elements];
              newElements.splice(index + 1, 0, newElement);
              return { ...p, elements: newElements };
          }));
          
          setTimeout(() => setActiveElementId(newElement.id), 50);
      }
      
      // Handle Backspace at start of empty element: Merge or delete
      if (e.key === 'Backspace' && pages.find(p=>p.id===pageId).elements[index].content === '') {
          const currentPage = pages.find(p=>p.id===pageId);
          if (index > 0) {
              e.preventDefault();
              const prevElementId = currentPage.elements[index-1].id;
              setPages(pages.map(p => {
                  if (p.id !== pageId || !p.elements) return p;
                  return { ...p, elements: p.elements.filter(el => el.id !== elementId) };
              }));
              setActiveElementId(prevElementId);
          }
      }
  };

  // Calculate active linked scene
  const highlightedSceneId = useMemo(() => {
      if (!activeElementId) return null;
      
      // Find the page containing the active element
      const activePage = pages.find(p => p.elements?.some(el => el.id === activeElementId));
      if (!activePage || !activePage.elements) return null;

      // Find index of active element
      const activeIndex = activePage.elements.findIndex(el => el.id === activeElementId);
      
      // Look backwards for the nearest SCENE element
      for (let i = activeIndex; i >= 0; i--) {
          const el = activePage.elements[i];
          if (el.type === ELEMENT_TYPES.SCENE) {
              return el.linkedSceneId || null;
          }
      }
      
      // If not found in current page, check previous pages
      const pageIndex = pages.findIndex(p => p.id === activePage.id);
      for (let i = pageIndex - 1; i >= 0; i--) {
          const prevPage = pages[i];
          if (!prevPage.elements) continue;
          
          for (let j = prevPage.elements.length - 1; j >= 0; j--) {
               const el = prevPage.elements[j];
               if (el.type === ELEMENT_TYPES.SCENE) {
                   return el.linkedSceneId || null;
               }
          }
      }

      return null;
  }, [activeElementId, pages]);

  const jumpToLinkedScene = (sceneId) => {
      if (!sceneId) return;

      let targetPageId = null;
      let targetElementId = null;

      for (const page of (pagesRef.current || [])) {
          if (page?.type === 'title') continue;
          for (const el of (page?.elements || [])) {
              if (el?.type !== ELEMENT_TYPES.SCENE) continue;
              if (el?.linkedSceneId !== sceneId) continue;
              targetPageId = page.id;
              targetElementId = el.id;
              break;
          }
          if (targetPageId && targetElementId) break;
      }

      if (!targetPageId || !targetElementId) return;

      pageRefs.current[targetPageId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      requestAnimationFrame(() => {
          elementRefs.current[targetElementId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setActiveElementId(targetElementId);
      });
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  const handleExportPDF = async () => {
    if (isExporting) return;
    
    // 1. Reset zoom to 1 for perfect capture
    const originalZoom = zoom;
    setZoom(1);
    setIsExporting(true);
    
    // Wait for state updates and re-renders
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const pdf = new jsPDF('p', 'mm', 'letter');
    const pageElements = document.querySelectorAll('.script-page-export');
    
    try {
        for (let i = 0; i < pageElements.length; i++) {
            const page = pageElements[i];
            
            // Capture page with html2canvas
            const canvas = await html2canvas(page, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                // Force dimensions to standard A4 ratio to avoid clipping
                width: page.offsetWidth,
                height: page.offsetHeight,
                windowWidth: page.scrollWidth,
                windowHeight: page.scrollHeight,
                onclone: (clonedDoc) => {
                    // Final safety: ensure all textareas are hidden and divs visible in clone
                    const clonedPage = clonedDoc.querySelectorAll('.script-page-export')[i];
                    if (clonedPage) {
                        clonedPage.style.overflow = 'visible';
                        clonedPage.style.transform = 'none';
                    }
                }
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        }
        
        // Save PDF with project title or default name
        const fileName = project?.title 
            ? `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_guion.pdf` 
            : 'guion.pdf';
        pdf.save(fileName);
    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Hubo un error al exportar el PDF. Por favor intenta de nuevo.');
    } finally {
        setIsExporting(false);
        setZoom(originalZoom);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-100 overflow-hidden font-sans">
      <div className="flex flex-1 min-h-0">
        {/* LEFT SIDE: Script Editor (Pages) */}
        <div className="w-1/2 min-h-0 flex flex-col border-r border-gray-300 relative">
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between shadow-sm z-20 sticky top-0">
                 <div className="flex flex-wrap gap-1 items-center">
                    <ToolbarButton 
                        label="Escena" shortcut="1" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.SCENE}
                        onClick={() => changeElementType(ELEMENT_TYPES.SCENE)} 
                        icon={<Hash size={14} />}
                        showShortcut={isCtrlPressed}
                    />
                    <ToolbarButton 
                        label="Acción" shortcut="2" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.ACTION}
                        onClick={() => changeElementType(ELEMENT_TYPES.ACTION)} 
                        icon={<AlignLeft size={14} />}
                        showShortcut={isCtrlPressed}
                    />
                    <ToolbarButton 
                        label="Personaje" shortcut="3" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.CHARACTER}
                        onClick={() => changeElementType(ELEMENT_TYPES.CHARACTER)} 
                        icon={<Type size={14} />}
                        showShortcut={isCtrlPressed}
                    />
                    <ToolbarButton 
                        label="Paréntesis" shortcut="4" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.PARENTHETICAL}
                        onClick={() => changeElementType(ELEMENT_TYPES.PARENTHETICAL)} 
                        icon={<span className="font-mono text-xs">()</span>}
                        showShortcut={isCtrlPressed}
                    />
                    <ToolbarButton 
                        label="Diálogo" shortcut="5" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.DIALOGUE}
                        onClick={() => changeElementType(ELEMENT_TYPES.DIALOGUE)} 
                        icon={<MessageSquare size={14} />}
                        showShortcut={isCtrlPressed}
                    />
                    <ToolbarButton 
                        label="Letras" shortcut="9" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.LYRICS}
                        onClick={() => changeElementType(ELEMENT_TYPES.LYRICS)} 
                        icon={<Music size={14} />}
                        showShortcut={isCtrlPressed}
                    />
                    <ToolbarButton 
                        label="Toma" shortcut="6" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.SHOT}
                        onClick={() => changeElementType(ELEMENT_TYPES.SHOT)} 
                        icon={<Video size={14} />}
                        showShortcut={isCtrlPressed}
                    />
                    <ToolbarButton 
                        label="Texto" shortcut="7" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.TRANSITION}
                        onClick={() => changeElementType(ELEMENT_TYPES.TRANSITION)} 
                        icon={<File size={14} />}
                        showShortcut={isCtrlPressed}
                    />
                    <ToolbarButton 
                        label="Nota" shortcut="8" 
                        active={activeElementId && getElementType(pages, activeElementId) === ELEMENT_TYPES.NOTE}
                        onClick={() => changeElementType(ELEMENT_TYPES.NOTE)} 
                        icon={<span className="font-bold text-xs text-yellow-600">!</span>}
                        showShortcut={isCtrlPressed}
                    />

                    <div className="h-6 w-[1px] bg-gray-300 mx-1"></div>
                    
                    <button 
                        onClick={handleExportPDF} 
                        disabled={isExporting}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all shadow-sm ${
                            isExporting 
                            ? 'bg-gray-100 text-gray-400 cursor-wait' 
                            : 'bg-red-600 text-white hover:bg-red-700 active:transform active:scale-95'
                        }`}
                        title="Exportar guion a PDF profesional"
                    >
                        <Download size={14} />
                        <span>{isExporting ? 'GENERANDO...' : 'EXPORTAR PDF'}</span>
                    </button>

                    {/* Options Menu */}
                    <div className="relative ml-1">
                        <button
                            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                            className={`p-1.5 rounded-lg transition-colors border ${
                                showOptionsMenu
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : 'bg-white text-gray-600 border-transparent hover:bg-gray-100'
                            }`}
                            title="Opciones de Guion"
                        >
                            <MoreVertical size={16} />
                        </button>

                        {showOptionsMenu && (
                            <>
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setShowOptionsMenu(false)}
                                ></div>
                                <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden w-48 z-50">
                                    <button
                                        onClick={() => setIsSceneBold(!isSceneBold)}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 flex items-center justify-between"
                                    >
                                        <span>Negrita en Escenas</span>
                                        <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isSceneBold ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                            {isSceneBold && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setShowSceneNumbers(!showSceneNumbers)}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 flex items-center justify-between border-t border-gray-100"
                                    >
                                        <span>Numero de escena</span>
                                        <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${showSceneNumbers ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                            {showSceneNumbers && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setIsCharacterBold(!isCharacterBold)}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 flex items-center justify-between border-t border-gray-100"
                                    >
                                        <span>Negrita en Personajes</span>
                                        <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isCharacterBold ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                            {isCharacterBold && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setIsTextBold(!isTextBold)}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 flex items-center justify-between border-t border-gray-100"
                                    >
                                        <span>Negrita en Texto</span>
                                        <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isTextBold ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                            {isTextBold && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Future functionality
                                            setShowOptionsMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 border-t border-gray-100"
                                    >
                                        Importar Guion
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                     <div className="flex items-center bg-gray-100 rounded-md mr-2">
                        <button onClick={handleZoomOut} className="p-1.5 hover:bg-gray-200 rounded-l-md text-gray-600" title="Alejar">
                            <ZoomOut size={16} />
                        </button>
                        <button onClick={handleZoomReset} className="px-2 py-1 text-xs font-mono text-gray-600 hover:bg-gray-200 border-x border-gray-200" title="Restablecer Zoom">
                            {Math.round(zoom * 100)}%
                        </button>
                        <button onClick={handleZoomIn} className="p-1.5 hover:bg-gray-200 rounded-r-md text-gray-600" title="Acercar">
                            <ZoomIn size={16} />
                        </button>
                     </div>

                     {saving && <span className="text-xs text-gray-400 animate-pulse ml-2">Guardando...</span>}
                     <button 
                         onClick={addSceneElement} 
                         className="relative p-1.5 hover:bg-gray-100 rounded text-purple-600 flex items-center gap-1 border border-purple-200 px-3 transition-all ml-2" 
                         title="Nueva Escena (Ctrl+1 o Intro en línea vacía)"
                     >
                         <Hash size={16} />
                         <span className="text-[10px] font-bold uppercase">Escena</span>
                         {isCtrlPressed && (
                             <div className="absolute inset-0 bg-purple-700 text-white flex items-center justify-center rounded text-[10px] font-bold z-10 opacity-100 shadow-lg border border-purple-400">
                                 <span className="whitespace-nowrap px-1">CTRL+1</span>
                             </div>
                         )}
                     </button>
                     <button onClick={addPage} className="p-1.5 hover:bg-gray-100 rounded text-purple-600 border border-transparent hover:border-gray-200 px-2 transition-all" title="Nueva Página">
                         <Plus size={20} />
                     </button>
                 </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-200" data-pins-surface="guion" data-pins-type="scroll">
                <div 
                    className="flex flex-col items-center gap-8 pb-20 origin-top"
                    style={{ zoom: zoom }}
                    data-pins-content
                >
                    {pages.map((page, pageIndex) => (
                        <div key={page.id} ref={(node) => registerPageRef(page.id, node)} className="relative group">
                            {/* Page Number */}
                            {!isExporting && (
                                <div className="absolute -left-10 top-0 text-gray-400 font-mono text-sm">
                                    {pageIndex + 1}
                                </div>
                            )}

                            {page.type === 'title' ? (
                                <div className="script-page-export">
                                    <TitlePage 
                                        data={page} 
                                        onChange={updateTitlePage} 
                                        isExporting={isExporting}
                                        readOnly={readOnly}
                                    />
                                </div>
                            ) : (
                                /* A4 Page Container */
                                <div 
                                    className="script-page-export script-page-editor w-[8.5in] h-[11in] bg-white shadow-lg p-[25mm] relative cursor-text overflow-hidden"
                                    onClick={(e) => handlePageClick(e, page)}
                                >
                                    <div className="text-gray-900" style={{ fontFamily: '"Courier Prime", "Courier New", Courier, monospace', fontSize: '12pt' }}>
                                        {page.elements && page.elements.map((element, index) => {
                                            let prevType = null;
                                            if (index > 0) {
                                                prevType = page.elements[index - 1]?.type ?? null;
                                            } else {
                                                for (let i = pageIndex - 1; i >= 0; i -= 1) {
                                                    const p = pages[i];
                                                    if (!p || p.type === 'title') continue;
                                                    const els = p.elements || [];
                                                    if (els.length === 0) continue;
                                                    prevType = els[els.length - 1]?.type ?? null;
                                                    break;
                                                }
                                            }

                                            const extraTopSpacing =
                                                element.type === ELEMENT_TYPES.ACTION &&
                                                prevType === ELEMENT_TYPES.DIALOGUE;

                                            return (
                                                <ScriptElement
                                                    key={element.id}
                                                    element={element}
                                                    onChange={(id, val) => updateElement(page.id, id, val)}
                                                    onUpdate={(props) => updateElementProps(page.id, element.id, props)}
                                                    onKeyDown={(e, id) => handleKeyDown(e, page.id, id, index)}
                                                    onFocus={(id) => setActiveElementId(id)}
                                                    autoFocus={activeElementId === element.id}
                                                    usedLocations={usedLocations}
                                                    availableScenes={project?.escaleta_data || []}
                                                    characterSuggestions={characterNamesByRecency}
                                                    characterAlternateSuggestion={alternateCharacterSuggestionByElementId.get(element.id) || ''}
                                                    isExporting={isExporting}
                                                    readOnly={readOnly}
                                                    registerRef={registerElementRef}
                                                    isSceneBold={isSceneBold}
                                                    isCharacterBold={isCharacterBold}
                                                    isTextBold={isTextBold}
                                                    showSceneNumber={showSceneNumbers}
                                                    sceneNumber={sceneNumberByElementId.get(element.id) ?? null}
                                                    isActive={activeElementId === element.id}
                                                    extraTopSpacing={extraTopSpacing}
                                                />
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Page Footer Number */}
                                    <div className="absolute bottom-8 right-10 text-gray-300 font-mono text-xs select-none">
                                        Pág. {pageIndex + 1}.
                                    </div>
                                </div>
                            )}

                            {/* Delete Page Button */}
                            {!isExporting && pages.length > 1 && page.type !== 'title' && (
                                <button 
                                    onClick={() => deletePage(page.id)}
                                    className="absolute -right-12 top-0 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Eliminar página"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    ))}
                    
                    <button 
                        onClick={addPage}
                        className="mt-4 flex flex-col items-center gap-2 text-gray-400 hover:text-purple-600 transition-colors group"
                    >
                        <div className="p-3 rounded-full border-2 border-dashed border-gray-300 group-hover:border-purple-400">
                            <Plus size={24} />
                        </div>
                        <span className="text-sm font-medium">Añadir Página</span>
                    </button>
                </div>
            </div>
        </div>

        {/* RIGHT SIDE: Viewer (Tratamiento/Escaleta/Concepto) */}
        <div className="w-1/2 min-h-0 flex flex-col bg-gray-50">
            {/* Viewer Switcher Header */}
            <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between shadow-sm z-10">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveViewer('tratamiento')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeViewer === 'tratamiento' 
                            ? 'bg-white text-purple-700 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Tratamiento
                    </button>
                    <button
                        onClick={() => setActiveViewer('escaleta')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeViewer === 'escaleta' 
                            ? 'bg-white text-purple-700 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Escaleta
                    </button>
                    <button
                        onClick={() => setActiveViewer('concepto')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeViewer === 'concepto' 
                            ? 'bg-white text-purple-700 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Mapa Conceptual
                    </button>
                </div>
                <div className="text-xs text-gray-400 px-4 uppercase tracking-wider font-semibold">
                    Visualizador
                </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 overflow-y-auto relative">
                {activeViewer === 'tratamiento' && (
                    <TratamientoViewer project={project} highlightedSceneId={highlightedSceneId} onSceneClick={jumpToLinkedScene} />
                )}
                {activeViewer === 'escaleta' && (
                    <EscaletaViewer project={project} highlightedSceneId={highlightedSceneId} />
                )}
                {activeViewer === 'concepto' && (
                    <div className="h-full w-full">
                         <ConceptMap 
                            formData={project.concepto_data || {}} 
                            projectTitle={project.title}
                            readOnly={true}
                         />
                    </div>
                )}
            </div>
        </div>
      </div>

    </div>
  );
};

const ToolbarButton = ({ label, shortcut, active, onClick, icon, showShortcut }) => (
    <button
        onClick={onClick}
        className={`relative flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors border ${
            active 
            ? 'bg-purple-100 text-purple-700 border-purple-200' 
            : 'bg-white text-gray-600 border-transparent hover:bg-gray-100'
        }`}
        title={`${label} (Ctrl+${shortcut})`}
    >
        {icon}
        <span className="hidden lg:inline">{label}</span>
        <span className={`hidden xl:inline text-[9px] ml-1 ${active ? 'text-purple-400' : 'text-gray-400'}`}>CTRL+{shortcut}</span>
        
        {/* Shortcut Overlay */}
        {showShortcut && (
            <div className="absolute inset-0 bg-purple-700 text-white flex items-center justify-center rounded text-[10px] font-bold z-10 opacity-100 shadow-lg border border-purple-400">
                <span className="whitespace-nowrap px-1">CTRL+{shortcut}</span>
            </div>
        )}
    </button>
);

// Helper to get element type safely
const getElementType = (pages, elementId) => {
    for (const page of pages) {
        const el = page.elements?.find(e => e.id === elementId);
        if (el) return el.type;
    }
    return null;
};

// Sub-component: Tratamiento Viewer (Read-Only)
const TratamientoViewer = ({ project, highlightedSceneId, onSceneClick }) => {
    const scenes = project?.escaleta_data || [];
    const treatments = project?.tratamiento_data || {};
    const refs = useRef({});

    useEffect(() => {
        if (highlightedSceneId && refs.current[highlightedSceneId]) {
            refs.current[highlightedSceneId].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedSceneId]);

    if (scenes.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>No hay escenas creadas para mostrar el tratamiento.</p>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            {scenes.map((scene) => (
                <div 
                    key={scene.id} 
                    ref={el => refs.current[scene.id] = el}
                    onClick={() => onSceneClick?.(scene.id)}
                    className={`bg-white p-6 rounded-xl border transition-all duration-300 cursor-pointer ${
                        highlightedSceneId === scene.id 
                        ? 'border-purple-400 shadow-md ring-2 ring-purple-200' 
                        : 'border-gray-200 shadow-sm'
                    }`}
                >
                    <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                            highlightedSceneId === scene.id ? 'bg-purple-100 text-purple-700' : 'bg-purple-50 text-purple-600'
                        }`}>
                            Escena {scene.number}
                        </span>
                    </div>
                    <div className="prose prose-purple max-w-none">
                        <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {treatments[scene.id] ? (
                                treatments[scene.id]
                            ) : (
                                <span className="text-gray-400 italic text-sm">Sin tratamiento desarrollado.</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Sub-component: Escaleta Viewer (Read-Only)
const EscaletaViewer = ({ project, highlightedSceneId }) => {
    const scenes = project?.escaleta_data || [];
    const refs = useRef({});

    useEffect(() => {
        if (highlightedSceneId && refs.current[highlightedSceneId]) {
            refs.current[highlightedSceneId].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedSceneId]);

    if (scenes.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <List size={48} className="mb-4 opacity-20" />
                <p>No hay escenas en la escaleta.</p>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-4">
            {scenes.map((scene) => (
                <div 
                    key={scene.id} 
                    ref={el => refs.current[scene.id] = el}
                    className={`flex gap-4 group transition-opacity duration-300 ${
                        highlightedSceneId && highlightedSceneId !== scene.id ? 'opacity-50' : 'opacity-100'
                    }`}
                >
                    <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-sm transition-colors ${
                            highlightedSceneId === scene.id 
                            ? 'bg-purple-500 text-white shadow-lg scale-110' 
                            : 'bg-gray-200 text-gray-600 group-hover:bg-purple-100 group-hover:text-purple-600'
                        }`}>
                            {scene.number}
                        </div>
                        <div className="w-[2px] h-full bg-gray-200 my-1 group-last:hidden"></div>
                    </div>
                    <div className="flex-1 pb-6">
                        <div className={`bg-white p-4 rounded-lg border shadow-sm transition-all ${
                            highlightedSceneId === scene.id 
                            ? 'border-purple-400 shadow-md ring-2 ring-purple-100' 
                            : 'border-gray-200 group-hover:shadow-md'
                        }`}>
                            <p className="text-gray-700 whitespace-pre-wrap">{scene.description || 'Sin descripción'}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GuionTab;
