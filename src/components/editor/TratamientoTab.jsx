import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus } from 'lucide-react';

const TratamientoTab = ({ project, onUpdateProject, readOnly = false }) => {
  const [scenes, setScenes] = useState([]);
  const [treatments, setTreatments] = useState({});
  const [saving, setSaving] = useState(false);
  const isFirstLoad = useRef(true);

  // Load initial data
  useEffect(() => {
    if (isFirstLoad.current) {
        if (project?.escaleta_data && project.escaleta_data.length > 0) {
            setScenes(project.escaleta_data);
        } else {
            setScenes([]);
        }
        
        if (project?.tratamiento_data) {
            setTreatments(project.tratamiento_data);
        } else {
            setTreatments({});
        }

        isFirstLoad.current = false;
    }
  }, [project]);

  // Auto-save debouncer for treatments only
  useEffect(() => {
    if (isFirstLoad.current) return;

    const timer = setTimeout(() => {
      if (project && !readOnly) {
        saveTreatments();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [treatments]);

  const saveTreatments = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('proyectos_cineasta')
        .update({ tratamiento_data: treatments })
        .eq('id', project.id);

      if (error) throw error;
      
      if (onUpdateProject) {
          onUpdateProject({ tratamiento_data: treatments });
      }

    } catch (error) {
      console.error('Error saving tratamiento data:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateTreatment = (id, newText) => {
    if (readOnly) return;
    setTreatments(prev => ({
        ...prev,
        [id]: newText
    }));
  };

  const addScene = async (index) => {
    if (readOnly) return;
    const newScene = {
        id: Date.now(),
        number: 0, // Will be recalculated
        description: ''
    };

    const newScenes = [
        ...scenes.slice(0, index + 1),
        newScene,
        ...scenes.slice(index + 1)
    ];

    // Re-number all scenes
    const reorderedScenes = newScenes.map((scene, idx) => ({
        ...scene,
        number: idx + 1
    }));

    setScenes(reorderedScenes);
    
    // Initialize empty treatment for new scene
    const newTreatments = { ...treatments, [newScene.id]: '' };
    setTreatments(newTreatments);

    // Save BOTH escaleta (structure) and tratamiento (content) immediately when structure changes
    setSaving(true);
    try {
        const { error } = await supabase
          .from('proyectos_cineasta')
          .update({ 
              escaleta_data: reorderedScenes,
              tratamiento_data: newTreatments
          })
          .eq('id', project.id);
  
        if (error) throw error;
        
        if (onUpdateProject) {
            onUpdateProject({ 
                escaleta_data: reorderedScenes,
                tratamiento_data: newTreatments
            });
        }
    } catch (error) {
        console.error('Error saving new scene:', error);
    } finally {
        setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-4 md:p-8" data-pins-surface="tratamiento" data-pins-type="scroll">
            <div className="max-w-[1600px] mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Tratamiento</h2>
                    {saving && <span className="text-xs text-gray-400 animate-pulse">Guardando...</span>}
                </div>

                {scenes.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                        <p>No hay escenas en la escaleta.</p>
                        <p className="text-sm mt-2">Ve a la pestaña "Escaleta" para añadir escenas.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="flex gap-6 pb-2 border-b border-gray-200">
                            <div className="w-1/2">
                                <h3 className="font-semibold text-gray-700 uppercase tracking-wider text-sm">Tratamiento (Detallado)</h3>
                            </div>
                            <div className="w-1/2">
                                <h3 className="font-semibold text-gray-500 uppercase tracking-wider text-sm">Escaleta (Referencia)</h3>
                            </div>
                        </div>

                        {scenes.map((scene, index) => (
                            <div key={scene.id} className="relative group">
                                <div className="flex gap-6">
                                    <div className="w-1/2 flex flex-col relative">
                                        <div className="bg-white border-2 border-purple-200 hover:border-purple-400 p-6 rounded-2xl shadow-sm relative transition-all hover:shadow-md flex-1 min-h-[300px]">
                                            <span className="absolute top-4 left-5 text-xs font-bold text-purple-400 tracking-wider uppercase select-none">
                                                ESCENA {scene.number}
                                            </span>
                                            <textarea 
                                                value={treatments[scene.id] || ''}
                                                onChange={(e) => {
                                                    updateTreatment(scene.id, e.target.value);
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                }}
                                                readOnly={readOnly}
                                                className="w-full h-full mt-6 resize-none outline-none text-gray-800 bg-transparent text-lg leading-relaxed overflow-hidden"
                                                placeholder="Desarrolla el tratamiento de esta escena..."
                                            />
                                        </div>
                                    </div>

                                    <div className="w-1/2 flex flex-col opacity-80 hover:opacity-100 transition-opacity">
                                        <div className="flex items-center">
                                            <div className="bg-gray-100 border-2 border-gray-300 border-b-0 px-4 py-1 font-bold text-sm tracking-wide uppercase select-none min-w-[120px] text-center rounded-t-lg z-10 relative top-[2px] text-gray-500">
                                                ESCENA {scene.number}
                                            </div>
                                            <div className="flex-1 border-b-2 border-gray-300 h-[2px] relative top-[1px]"></div>
                                        </div>
                                        <div className="bg-gray-50 border-2 border-gray-300 p-4 rounded-b-lg flex-1">
                                            <div className="text-gray-600 text-lg leading-relaxed whitespace-pre-wrap">
                                                {scene.description || <span className="text-gray-400 italic">Sin descripción en la escaleta.</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-8 w-full flex items-center justify-center cursor-pointer group/insert py-6 relative z-20"
                                        onClick={() => addScene(index)}
                                >
                                    <div className="w-full h-[1px] bg-gray-200 group-hover/insert:bg-purple-400 transition-colors"></div>
                                    <div className="absolute bg-white border border-gray-200 group-hover/insert:border-purple-400 text-gray-400 group-hover/insert:text-purple-600 rounded-full p-1 shadow-sm transition-all transform group-hover/insert:scale-110">
                                        <Plus size={16} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default TratamientoTab;
