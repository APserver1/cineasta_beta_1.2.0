import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ConceptMap from './ConceptMap';
import { Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AutoResizeTextarea = ({ value, onChange, onFocus, onKeyDown, readOnly, placeholder, className, autoFocus, inputRef }) => {
    const textareaRef = useRef(null);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const setRefs = (el) => {
        textareaRef.current = el;
        if (inputRef) {
            if (typeof inputRef === 'function') inputRef(el);
            else inputRef.current = el;
        }
    };

    return (
        <textarea
            ref={setRefs}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            readOnly={readOnly}
            className={className}
            placeholder={placeholder}
            rows={1}
            autoFocus={autoFocus}
        />
    );
};

const EscaletaTab = ({ project, onUpdateProject, readOnly = false }) => {
  const [scenes, setScenes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lastAddedId, setLastAddedId] = useState(null);
  const isFirstLoad = useRef(true);

  // Load initial data
  useEffect(() => {
    // Only set scenes from project if it's the first load or if scenes is empty
    // This prevents overwriting local state if project prop updates but we have unsaved changes
    if (isFirstLoad.current) {
        if (project?.escaleta_data && project.escaleta_data.length > 0) {
            setScenes(project.escaleta_data);
        } else {
            // Initialize with one empty scene if none exists
            setScenes([{ id: Date.now(), number: 1, description: '' }]);
        }
        isFirstLoad.current = false;
    }
  }, [project]);

  // Auto-save debouncer
  useEffect(() => {
    if (isFirstLoad.current) return; // Don't save on initial load

    const timer = setTimeout(() => {
      if (project && !readOnly) {
        saveData();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [scenes]);

  const saveData = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('proyectos_cineasta')
        .update({ escaleta_data: scenes })
        .eq('id', project.id);

      if (error) throw error;
      
      // Notify parent to update local state
      if (onUpdateProject) {
          onUpdateProject({ escaleta_data: scenes });
      }

    } catch (error) {
      console.error('Error saving escaleta data:', error);
    } finally {
      setSaving(false);
    }
  };

  const addScene = (index = null) => {
    if (readOnly) return;
    const newScene = {
      id: Date.now(),
      number: 0, // Placeholder, will be recalculated
      description: ''
    };

    let newScenes = [];
    if (index !== null) {
        // Insert at specific index (after the current scene)
        newScenes = [
            ...scenes.slice(0, index + 1),
            newScene,
            ...scenes.slice(index + 1)
        ];
    } else {
        // Append to end
        newScenes = [...scenes, newScene];
    }

    // Re-number all scenes
    const reorderedScenes = newScenes.map((scene, idx) => ({
        ...scene,
        number: idx + 1
    }));

    setScenes(reorderedScenes);
    setLastAddedId(newScene.id);
  };

  const updateScene = (id, newDescription) => {
    if (readOnly) return;
    setScenes(scenes.map(scene => 
      scene.id === id ? { ...scene, description: newDescription } : scene
    ));
  };

  const deleteScene = (id) => {
      if (readOnly) return;
      const newScenes = scenes.filter(s => s.id !== id);
      // Re-number scenes
      const reorderedScenes = newScenes.map((scene, index) => ({
          ...scene,
          number: index + 1
      }));
      setScenes(reorderedScenes);
  };

  const scrollRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const latestLastStateRef = useRef(project?.last_state || {});
  const scrollRestoredRef = useRef(false);
  const sceneRefs = useRef(new Map());

  useEffect(() => {
    if (lastAddedId && sceneRefs.current.has(lastAddedId)) {
      const el = sceneRefs.current.get(lastAddedId);
      if (el) {
        // Wait for layout update
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [lastAddedId, scenes]);

  useEffect(() => {
      latestLastStateRef.current = project?.last_state || {};
  }, [project?.last_state]);

  // Restore scroll position logic
  useEffect(() => {
      // If already restored or no saved position, skip
      if (scrollRestoredRef.current) return;
      
      const savedScroll = project?.last_state?.escaletaScroll;
      if (!savedScroll || !scrollRef.current) return;

      // Only attempt restore if we have scenes rendered
      if (scenes.length === 0) return;

      // Wait a bit for layout/height adjustments
      const timer = setTimeout(() => {
          if (scrollRef.current) {
              scrollRef.current.scrollTop = savedScroll;
              // Check if we managed to scroll at least partially to the target
              // This helps confirm the content was indeed ready
              if (scrollRef.current.scrollTop > 0 || savedScroll === 0) {
                  scrollRestoredRef.current = true;
              }
          }
      }, 100);

      return () => clearTimeout(timer);
  }, [project?.last_state, scenes]); // Retry when scenes load

  const handleScroll = (e) => {
      if (readOnly) return;
      
      const scrollTop = e.target.scrollTop;
      
      if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(async () => {
          const newState = {
              ...(latestLastStateRef.current || {}),
              escaletaScroll: scrollTop
          };
          
          // Update parent state (memory)
          if (onUpdateProject) {
              onUpdateProject({ last_state: newState });
          }

          // Save to DB (persistence)
          try {
              await supabase
                  .from('proyectos_cineasta')
                  .update({ last_state: newState })
                  .eq('id', project.id);
          } catch (error) {
              console.error('Error saving scroll position:', error);
          }
      }, 800);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-1 min-h-0">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          data-pins-surface="escaleta"
          data-pins-type="scroll"
          className="w-1/2 min-h-0 overflow-y-auto bg-gray-50 p-8 border-r border-gray-200"
        >
          <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Escaleta</h2>
                  {saving && <span className="text-xs text-gray-400 animate-pulse">Guardando...</span>}
              </div>

              <div className="space-y-6">
                  <AnimatePresence>
                      {scenes.map((scene, index) => (
                          <motion.div 
                              key={scene.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="relative"
                          >
                              <div className="flex flex-col group/scene">
                                  <div className="flex items-center">
                                      <div className="bg-white border-2 border-black border-b-0 px-4 py-1 font-bold text-sm tracking-wide uppercase select-none min-w-[120px] text-center rounded-t-lg z-10 relative top-[2px]">
                                          ESCENA {scene.number}
                                      </div>
                                      <div className="flex-1 border-b-2 border-black h-[2px] relative top-[1px]"></div>
                                  </div>
                                  
                                  <div className="bg-white border-2 border-black p-4 shadow-sm min-h-[120px] relative transition-shadow hover:shadow-md">
                                    <AutoResizeTextarea 
                                        value={scene.description}
                                        onChange={(e) => updateScene(scene.id, e.target.value)}
                                        readOnly={readOnly}
                                        inputRef={(el) => {
                                            if (el) sceneRefs.current.set(scene.id, el);
                                            else sceneRefs.current.delete(scene.id);
                                        }}
                                        onFocus={(e) => {
                                            // Scroll to scene when focused (delay to allow keyboard to pop up on mobile or layout adjustments)
                                            setTimeout(() => {
                                                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }, 100);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                addScene(index);
                                                return;
                                            }

                                            const textarea = e.target;
                                            const { selectionStart, selectionEnd, value } = textarea;
                                            const isAtStart = selectionStart === 0 && selectionEnd === 0;
                                            const isAtEnd = selectionStart === value.length && selectionEnd === value.length;

                                            // Previous Scene (Up or Left at start)
                                            if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && isAtStart) {
                                                if (index > 0) {
                                                    e.preventDefault();
                                                    const prevScene = scenes[index - 1];
                                                    const prevEl = sceneRefs.current.get(prevScene.id);
                                                    if (prevEl) {
                                                        prevEl.focus();
                                                        // Set cursor to end
                                                        prevEl.setSelectionRange(prevEl.value.length, prevEl.value.length);
                                                    }
                                                }
                                            }

                                            // Next Scene (Down or Right at end)
                                            if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && isAtEnd) {
                                                if (index < scenes.length - 1) {
                                                    e.preventDefault();
                                                    const nextScene = scenes[index + 1];
                                                    const nextEl = sceneRefs.current.get(nextScene.id);
                                                    if (nextEl) {
                                                        nextEl.focus();
                                                        // Set cursor to start
                                                        nextEl.setSelectionRange(0, 0);
                                                    }
                                                }
                                            }
                                        }}
                                        className="w-full min-h-[100px] resize-none outline-none text-gray-700 bg-transparent text-lg leading-relaxed overflow-hidden"
                                        placeholder="Describe lo que sucede en esta escena..."
                                        autoFocus={scene.id === lastAddedId}
                                    />
                                    
                                    <button 
                                          onClick={() => deleteScene(scene.id)}
                                          disabled={readOnly}
                                          className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover/scene:opacity-100"
                                          title="Eliminar escena"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  </div>

                                  <div className="h-6 w-full flex items-center justify-center cursor-pointer group/insert py-4 z-20 mt-2"
                                       onClick={() => addScene(index)}
                                  >
                                      <div className="w-full h-[1px] bg-gray-200 group-hover/insert:bg-purple-400 transition-colors"></div>
                                      <div className="absolute bg-white border border-gray-200 group-hover/insert:border-purple-400 text-gray-400 group-hover/insert:text-purple-600 rounded-full p-1 shadow-sm transition-all transform group-hover/insert:scale-110">
                                          <Plus size={16} />
                                      </div>
                                  </div>
                              </div>
                          </motion.div>
                      ))}
                  </AnimatePresence>

                  <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={addScene}
                      disabled={readOnly}
                      className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-500 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                  >
                      <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                              <Plus size={24} />
                          </div>
                          <span className="font-medium">Añadir Escena</span>
                      </div>
                  </motion.button>
              </div>
          </div>
        </div>

        <div className="w-1/2 min-h-0 bg-gray-100 relative">
          <div className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-gray-500 border border-gray-200 shadow-sm">
              Vista de Referencia
          </div>
          <ConceptMap 
            formData={project.concepto_data || {}} 
            projectTitle={project.title} 
            readOnly={true}
          />
        </div>
      </div>
    </div>
  );
};

export default EscaletaTab;
