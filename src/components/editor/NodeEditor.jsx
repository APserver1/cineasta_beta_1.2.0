import React, { useState, useEffect } from 'react';
import { Bold, Italic, Underline, Type, Palette, X, Save } from 'lucide-react';

const NodeEditor = ({ node, onUpdate, onClose }) => {
  const [plainText, setPlainText] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [styles, setStyles] = useState({
    fontSize: '16px',
    color: '#000000',
    isBold: false,
    isItalic: false,
    isUnderline: false,
    width: 'auto'
  });

  useEffect(() => {
    if (node) {
      // 1. Restore Styles
      const nodeStyle = node.data.style || {};
      const newStyles = {
        fontSize: nodeStyle.fontSize || '16px',
        color: nodeStyle.color || '#000000',
        isBold: nodeStyle.fontWeight === 'bold',
        isItalic: nodeStyle.fontStyle === 'italic',
        isUnderline: nodeStyle.textDecoration === 'underline',
        width: nodeStyle.width || 'auto'
      };
      setStyles(newStyles);

      // 2. Restore Text
      let initialPlainText = '';
      if (node.data.rawLabel) {
          initialPlainText = node.data.rawLabel;
      } else if (node.data.label) {
          // Fallback: Try to strip HTML if rawLabel missing
          const isHtml = /<span style=/.test(node.data.label);
          if (!isHtml) {
              initialPlainText = node.data.label;
          } else {
              const div = document.createElement('div');
              div.innerHTML = node.data.label;
              initialPlainText = div.innerText;
          }
      }
      setPlainText(initialPlainText);

      // 3. Set HTML Code
      // If we have existing label, use it. If not, generate it.
      setHtmlCode(node.data.label || initialPlainText);
    }
  }, [node]);

  const generateHtml = (text, currentStyles) => {
    const styleString = `
      font-size: ${currentStyles.fontSize};
      color: ${currentStyles.color};
      font-weight: ${currentStyles.isBold ? 'bold' : 'normal'};
      font-style: ${currentStyles.isItalic ? 'italic' : 'normal'};
      text-decoration: ${currentStyles.isUnderline ? 'underline' : 'none'};
    `;
    return `<span style="${styleString.replace(/\n/g, '')}">${text}</span>`;
  };

  const handleStyleChange = (key, value) => {
    const newStyles = { ...styles, [key]: value };
    setStyles(newStyles);
    
    // Regenerate HTML
    const newHtml = generateHtml(plainText, newStyles);
    setHtmlCode(newHtml);
    
    updateNode(plainText, newHtml, newStyles);
  };

  const handlePlainTextChange = (e) => {
    const newText = e.target.value;
    setPlainText(newText);
    
    // Regenerate HTML
    const newHtml = generateHtml(newText, styles);
    setHtmlCode(newHtml);
    
    updateNode(newText, newHtml, styles);
  };

  const handleHtmlCodeChange = (e) => {
    const newHtml = e.target.value;
    setHtmlCode(newHtml);
    
    // Optional: Try to reverse engineer plain text? 
    // For now, we just update the node with the custom HTML.
    // We might lose sync with styles if the user manually edits styles in HTML.
    // Let's just update the node label.
    // And maybe try to extract text for the plain text view.
    const div = document.createElement('div');
    div.innerHTML = newHtml;
    setPlainText(div.innerText);
    
    updateNode(div.innerText, newHtml, styles);
  };

  const updateNode = (pText, hCode, currentStyles) => {
    onUpdate({
      ...node,
      data: {
        ...node.data,
        label: hCode, // Rendered version
        rawLabel: pText, // Plain text for editing
        style: { // Metadata for editor
            fontSize: currentStyles.fontSize,
            color: currentStyles.color,
            fontWeight: currentStyles.isBold ? 'bold' : 'normal',
            fontStyle: currentStyles.isItalic ? 'italic' : 'normal',
            textDecoration: currentStyles.isUnderline ? 'underline' : 'none',
            width: currentStyles.width
        }
      }
    });
  };

  return (
    <div className="bg-white h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-bold text-lg text-gray-800">Editar Nodo</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        
        {/* Style Controls */}
        <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Estilo de Texto</label>
            
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => handleStyleChange('isBold', !styles.isBold)}
                    className={`p-2 rounded border ${styles.isBold ? 'bg-purple-100 border-purple-500 text-purple-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    title="Negrita"
                >
                    <Bold size={18} />
                </button>
                <button
                    onClick={() => handleStyleChange('isItalic', !styles.isItalic)}
                    className={`p-2 rounded border ${styles.isItalic ? 'bg-purple-100 border-purple-500 text-purple-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    title="Cursiva"
                >
                    <Italic size={18} />
                </button>
                <button
                    onClick={() => handleStyleChange('isUnderline', !styles.isUnderline)}
                    className={`p-2 rounded border ${styles.isUnderline ? 'bg-purple-100 border-purple-500 text-purple-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    title="Subrayado"
                >
                    <Underline size={18} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Tamaño</label>
                    <div className="relative">
                        <Type size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                            value={styles.fontSize}
                            onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="12px">Pequeño (12px)</option>
                            <option value="14px">Normal (14px)</option>
                            <option value="16px">Mediano (16px)</option>
                            <option value="18px">Grande (18px)</option>
                            <option value="24px">Título (24px)</option>
                            <option value="32px">Enorme (32px)</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Color</label>
                    <div className="flex items-center gap-2 border border-gray-300 rounded-md p-1.5 px-3">
                        <Palette size={16} className="text-gray-400" />
                        <input
                            type="color"
                            value={styles.color}
                            onChange={(e) => handleStyleChange('color', e.target.value)}
                            className="w-full h-6 bg-transparent cursor-pointer border-none p-0"
                        />
                    </div>
                </div>

                <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                    <label className="block text-xs text-gray-500 mb-2">Ancho del Nodo</label>
                    <div className="flex items-center gap-3">
                         <input
                            type="range"
                            min="150"
                            max="600"
                            step="10"
                            value={styles.width === 'auto' ? 150 : parseInt(styles.width)}
                            onChange={(e) => handleStyleChange('width', `${e.target.value}px`)}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            disabled={styles.width === 'auto'}
                        />
                        <span className="text-xs text-gray-600 w-12 text-right font-mono">
                            {styles.width === 'auto' ? 'Auto' : styles.width}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center">
                        <input 
                            type="checkbox" 
                            id="autoWidth"
                            checked={styles.width === 'auto'}
                            onChange={(e) => handleStyleChange('width', e.target.checked ? 'auto' : '200px')}
                            className="rounded text-purple-600 focus:ring-purple-500 h-3 w-3"
                        />
                        <label htmlFor="autoWidth" className="ml-2 text-xs text-gray-600 cursor-pointer">Ancho Automático</label>
                    </div>
                </div>
            </div>
        </div>

        {/* Plain Text Input (Middle) */}
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Contenido (Solo Texto)</label>
            <textarea
                value={plainText}
                onChange={handlePlainTextChange}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-base font-sans"
                placeholder="Escribe el texto aquí..."
                // Apply styles to this preview too?
                style={{
                    fontSize: styles.fontSize,
                    color: styles.color,
                    fontWeight: styles.isBold ? 'bold' : 'normal',
                    fontStyle: styles.isItalic ? 'italic' : 'normal',
                    textDecoration: styles.isUnderline ? 'underline' : 'none',
                }}
            />
        </div>

        {/* HTML Code Input (Bottom) */}
        <div className="space-y-2 pt-4 border-t border-gray-100">
            <label className="block text-xs font-mono text-gray-500">Código HTML (Avanzado)</label>
            <textarea
                value={htmlCode}
                onChange={handleHtmlCodeChange}
                rows={4}
                className="w-full p-3 border border-gray-200 bg-gray-50 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none text-xs font-mono text-gray-600"
                placeholder="Código HTML generado..."
            />
        </div>
        
        <div className="pt-4 border-t border-gray-100">
             <button 
                onClick={onClose}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
             >
                <Save size={18} />
                Terminar Edición
             </button>
        </div>

      </div>
    </div>
  );
};

export default NodeEditor;
