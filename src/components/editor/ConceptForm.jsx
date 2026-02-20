import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ConceptForm = ({ data, onChange, readOnly = false }) => {
  const [expandedChar, setExpandedChar] = useState(null);

  const handleChange = (field, value) => {
    if (readOnly) return;
    onChange({ ...data, [field]: value });
  };

  const handleCharacterChange = (index, field, value) => {
    if (readOnly) return;
    const updatedCharacters = data.personajes.map((char, i) => {
      if (i === index) {
        return { ...char, [field]: value };
      }
      return char;
    });
    onChange({ ...data, personajes: updatedCharacters });
  };

  const addCharacter = () => {
    if (readOnly) return;
    const newChar = {
      nombre: '',
      historiaBreve: '',
      arcoPersonaje: '',
      influencias: '',
      personalidad: ''
    };
    onChange({ ...data, personajes: [...data.personajes, newChar] });
    setExpandedChar(data.personajes.length); // Auto expand new char
  };

  const removeCharacter = (index) => {
    if (readOnly) return;
    const newCharacters = data.personajes.filter((_, i) => i !== index);
    onChange({ ...data, personajes: newCharacters });
  };

  const toggleChar = (index) => {
    setExpandedChar(expandedChar === index ? null : index);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Concepto */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Concepto</label>
        <textarea
          value={data.concepto}
          onChange={(e) => handleChange('concepto', e.target.value)}
          readOnly={readOnly}
          className="w-full min-h-[100px] p-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
          placeholder="Describe el concepto general de tu historia..."
        />
      </div>

      {/* Historia Básica */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Historia Básica</label>
        <textarea
          value={data.historiaBasica}
          onChange={(e) => handleChange('historiaBasica', e.target.value)}
          readOnly={readOnly}
          className="w-full min-h-[120px] p-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
          placeholder="Escribe un resumen de la trama principal..."
        />
      </div>

      {/* Tema o Núcleo */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Tema o Núcleo de la Obra</label>
        <textarea
          value={data.tema}
          onChange={(e) => handleChange('tema', e.target.value)}
          readOnly={readOnly}
          className="w-full min-h-[80px] p-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
          placeholder="¿De qué trata realmente tu historia? (Ej: Amor, Venganza, Redención)"
        />
      </div>

      {/* Lista de Personajes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">Lista de Personajes</h3>
          <button
            onClick={addCharacter}
            disabled={readOnly}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-semibold"
          >
            <Plus size={16} />
            Añadir Personaje
          </button>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {data.personajes.map((char, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Character Header */}
                <div 
                  onClick={() => toggleChar(index)}
                  className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <span className="font-semibold text-gray-700">
                    {char.nombre || `Personaje ${index + 1}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCharacter(index); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    {expandedChar === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Character Details */}
                {expandedChar === index && (
                  <div className="p-4 space-y-4 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre</label>
                      <input
                        type="text"
                        value={char.nombre}
                        onChange={(e) => handleCharacterChange(index, 'nombre', e.target.value)}
                        readOnly={readOnly}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-500 outline-none"
                        placeholder="Nombre del personaje"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Historia Breve</label>
                      <textarea
                        value={char.historiaBreve}
                        onChange={(e) => handleCharacterChange(index, 'historiaBreve', e.target.value)}
                        readOnly={readOnly}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-500 outline-none resize-none h-20"
                        placeholder="Backstory resumida..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Arco de Personaje</label>
                        <input
                          type="text"
                          value={char.arcoPersonaje || char.arco || ''}
                          onChange={(e) => handleCharacterChange(index, 'arcoPersonaje', e.target.value)}
                          readOnly={readOnly}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-500 outline-none"
                          placeholder="Evolución..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Personalidad</label>
                        <input
                          type="text"
                          value={char.personalidad}
                          onChange={(e) => handleCharacterChange(index, 'personalidad', e.target.value)}
                          readOnly={readOnly}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-500 outline-none"
                          placeholder="Rasgos clave..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Influencias</label>
                      <input
                        type="text"
                        value={char.influencias}
                        onChange={(e) => handleCharacterChange(index, 'influencias', e.target.value)}
                        readOnly={readOnly}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-500 outline-none"
                        placeholder="Inspiraciones..."
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Sinopsis Corta */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Sinopsis Corta</label>
        <textarea
          value={data.sinopsisCorta || ''}
          onChange={(e) => handleChange('sinopsisCorta', e.target.value)}
          readOnly={readOnly}
          className="w-full min-h-[100px] p-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
          placeholder="Escribe una sinopsis corta..."
        />
      </div>

      {/* Sinopsis Larga */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Sinopsis Larga</label>
        <textarea
          value={data.sinopsisLarga || ''}
          onChange={(e) => handleChange('sinopsisLarga', e.target.value)}
          readOnly={readOnly}
          className="w-full min-h-[150px] p-3 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
          placeholder="Desarrolla la sinopsis detallada..."
        />
      </div>
    </div>
  );
};

export default ConceptForm;
