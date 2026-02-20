import { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Handle, 
  Position,
  Panel,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Image as ImageIcon, Type, Link as LinkIcon, StickyNote, Bold, Trash2, Edit, Unlink } from 'lucide-react';

// Helper for Omni-directional handles (Source + Target on all 4 sides)
const NodeHandles = ({ className }) => {
  return (
    <>
      {/* Top */}
      <Handle type="target" position={Position.Top} id="top-target" className={className} />
      <Handle type="source" position={Position.Top} id="top-source" className={className} />
      
      {/* Right */}
      <Handle type="target" position={Position.Right} id="right-target" className={className} />
      <Handle type="source" position={Position.Right} id="right-source" className={className} />
      
      {/* Bottom */}
      <Handle type="target" position={Position.Bottom} id="bottom-target" className={className} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={className} />
      
      {/* Left */}
      <Handle type="target" position={Position.Left} id="left-target" className={className} />
      <Handle type="source" position={Position.Left} id="left-source" className={className} />
    </>
  );
};

// Custom Node Component for consistent styling
const CustomNode = ({ data, isRoot }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const contentRef = useRef(null);

  // Sync internal text state when data.label changes (from external editor)
  useEffect(() => {
    setText(data.label);
  }, [data.label]);

  const handleDoubleClick = () => {
    // Only enable editing if there is an onChange handler (mostly user nodes)
    // Or if we want to support it for all, we need to ensure onChange is passed.
    if (data.readOnly) return;
    
    if (data.onChange) {
        setIsEditing(true);
        setTimeout(() => {
            if (contentRef.current) {
              contentRef.current.focus();
            }
        }, 50);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
        setIsEditing(false);
        const newText = contentRef.current ? contentRef.current.innerText : text;
        setText(newText);
        if (data.onChange) data.onChange(newText);
    }, 200);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        contentRef.current.blur();
    }
  };

  return (
    <div 
      className={`px-4 py-3 rounded-lg border-2 shadow-lg min-w-[150px] text-center bg-white ${
      isRoot ? 'border-purple-600 bg-purple-50' : 'border-gray-300'
      } transition-all duration-200 hover:shadow-xl relative group/node`}
      style={{ 
          width: data.style?.width && data.style.width !== 'auto' ? data.style.width : undefined,
          maxWidth: data.style?.width && data.style.width !== 'auto' ? 'none' : '300px'
      }}
      onDoubleClick={handleDoubleClick}
    >
      <NodeHandles className="w-3 h-3 bg-gray-400" />
      
      <div 
        ref={contentRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        dangerouslySetInnerHTML={{ __html: isEditing ? text : data.label }}
        className={`font-bold mb-1 break-words outline-none ${isRoot ? 'text-purple-700' : 'text-gray-700'} ${isEditing ? 'cursor-text' : 'cursor-default'}`}
      />
      {data.content && (
        <div className="text-xs text-gray-500 whitespace-pre-wrap text-left">
          {data.content}
        </div>
      )}
    </div>
  );
};

const TextNode = ({ data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const contentRef = useRef(null);
  // Ref to track current text during editing to avoid re-renders
  const currentTextRef = useRef(data.label);

  useEffect(() => {
      setText(data.label);
      currentTextRef.current = data.label;
  }, [data.label]);

  useEffect(() => {
    if (data.autoFocus && !data.readOnly) {
      setIsEditing(true);
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.focus();
        }
      }, 50);
    }
  }, [data.autoFocus, data.readOnly]);

  const handleDoubleClick = () => {
    if (data.readOnly) return;
    setIsEditing(true);
    setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.focus();
        }
    }, 50);
  };

  const handleBlur = () => {
    // Save changes on blur
    setTimeout(() => {
        setIsEditing(false);
        const newText = contentRef.current ? contentRef.current.innerHTML : text;
        setText(newText);
        if (data.onChange) data.onChange(newText);
    }, 200);
  };

  const toggleBold = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.execCommand('bold');
    if (contentRef.current) contentRef.current.focus();
  };

  return (
    <div 
        className="min-w-[100px] relative group/node"
        style={{ 
            width: data.style?.width && data.style.width !== 'auto' ? data.style.width : undefined,
            maxWidth: data.style?.width && data.style.width !== 'auto' ? 'none' : '400px'
        }}
    >
      <NodeHandles className="w-2 h-2 bg-transparent" />
      
      {isEditing && (
        <div className="absolute -top-12 left-0 bg-white shadow-lg rounded-md flex p-1 z-50 border border-gray-200 gap-1">
           <button 
             onMouseDown={toggleBold}
             className="p-1.5 hover:bg-gray-100 rounded text-gray-700 hover:text-purple-700"
             title="Negrita"
           >
             <Bold size={16} />
           </button>
        </div>
      )}

      <div 
        ref={contentRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onDoubleClick={handleDoubleClick}
        onBlur={handleBlur}
        onInput={(e) => {
            // Update ref but DO NOT trigger re-render
            currentTextRef.current = e.currentTarget.innerHTML;
        }}
        dangerouslySetInnerHTML={{ __html: text }}
        className={`text-gray-800 text-lg font-medium whitespace-pre-wrap outline-none p-2 rounded ${
          isEditing 
            ? 'border-2 border-purple-500 bg-white/80 min-h-[3em]' 
            : 'border-2 border-transparent hover:border-gray-200'
        }`}
      />
    </div>
  );
};

const ImageNode = ({ data }) => {
  return (
    <div className="rounded-lg overflow-hidden border-2 border-purple-200 shadow-md bg-white relative group/node">
      <NodeHandles className="w-3 h-3 bg-purple-400" />
      
      <img src={data.url} alt="Concept" className="max-w-[200px] max-h-[200px] object-cover block" />
      {data.label && <div className="p-2 text-xs text-center text-gray-600 bg-purple-50">{data.label}</div>}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
  text: TextNode,
  image: ImageNode,
};

const ContextMenu = ({ x, y, type, onEdit, onDelete, onClose }) => {
    useEffect(() => {
        const handleClickOutside = () => onClose();
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [onClose]);

    return (
        <div 
            style={{ top: y, left: x }} 
            className="fixed z-50 bg-white shadow-xl rounded-lg border border-gray-200 py-1 min-w-[150px]"
            onContextMenu={(e) => e.preventDefault()}
        >
            {type === 'node' && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="w-full text-left px-4 py-2 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2 text-sm text-gray-700"
                >
                    <Edit size={14} /> Editar
                </button>
            )}
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 text-sm text-gray-700"
            >
                {type === 'edge' ? (
                    <>
                        <Unlink size={14} /> Desconectar
                    </>
                ) : (
                    <>
                        <Trash2 size={14} /> Eliminar
                    </>
                )}
            </button>
        </div>
    );
};

const ConceptMap = ({ formData, projectTitle, onChange, onEditNode, externalNodeUpdate, readOnly = false, onInit, onViewportChange }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null);

  // Propagate readOnly to nodes
  useEffect(() => {
    setNodes((nds) => nds.map((node) => ({
      ...node,
      data: { ...node.data, readOnly }
    })));
  }, [readOnly, setNodes]);

  // Track previous positions of auto-generated nodes to handle layout shifts
  const prevAutoNodesRef = useRef({});
  const isFirstLoad = useRef(true);
  const edgesRef = useRef(edges);

  // Keep edges ref updated
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Handle external node updates (from NodeEditor)
  useEffect(() => {
      if (externalNodeUpdate) {
          setNodes((nds) => nds.map((n) => {
              if (n.id === externalNodeUpdate.id) {
                  return {
                      ...n,
                      data: { ...n.data, ...externalNodeUpdate.data }
                  };
              }
              return n;
          }));
      }
  }, [externalNodeUpdate, setNodes]);

  // Preserve user node positions map (mainly for auto-generated nodes that were moved)
  const [nodePositions, setNodePositions] = useState({});

  // Initialize nodePositions from formData if available and local is empty
  // FIX: Also update if we are in readOnly mode (Escaleta view) to ensure positions match
  useEffect(() => {
    if (formData.nodePositions) {
        if (Object.keys(nodePositions).length === 0 || readOnly) {
             setNodePositions(formData.nodePositions);
        }
    }
  }, [formData.nodePositions, readOnly]);

  // Helper to save graph state
  const saveGraph = useCallback((currentNodes, currentEdges, currentPositions, immediate = false) => {
    if (!onChange) return;
    
    const userNodes = currentNodes.filter(n => n.id.startsWith('user-'));
    const userEdges = currentEdges.filter(e => e.id.startsWith('e-user-') || e.source.startsWith('user-') || e.target.startsWith('user-'));
    
    let viewport = formData.viewport;
    if (rfInstance) {
      viewport = rfInstance.getViewport();
    }

    onChange({
        customNodes: userNodes,
        customEdges: userEdges,
        nodePositions: currentPositions,
        viewport: viewport
    }, immediate);
  }, [onChange, rfInstance, formData.viewport]);

  const onNodeLabelChange = useCallback((id, newLabel) => {
    setNodes((nds) => {
      const newNodes = nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, label: newLabel } };
        }
        return node;
      });
      // This is usually triggered on blur, so immediate save is good.
      setTimeout(() => saveGraph(newNodes, edgesRef.current, nodePositions, true), 0);
      return newNodes;
    });
  }, [setNodes, saveGraph, nodePositions]); 

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({
        x: event.clientX,
        y: event.clientY,
        data: node,
        type: 'node'
    });
  }, []);

  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    setContextMenu({
        x: event.clientX,
        y: event.clientY,
        data: edge,
        type: 'edge'
    });
  }, []);

  const handleEditFromMenu = () => {
      if (contextMenu && contextMenu.type === 'node' && onEditNode) {
          onEditNode(contextMenu.data);
      }
      setContextMenu(null);
  };

  const handleDeleteFromMenu = () => {
      if (contextMenu) {
        if (contextMenu.type === 'node') {
            const node = contextMenu.data;
            let newNodes = [];
            let newEdges = [];
            
            setNodes((nds) => {
                newNodes = nds.filter((n) => n.id !== node.id);
                return newNodes;
            });
            setEdges((eds) => {
                newEdges = eds.filter((e) => e.source !== node.id && e.target !== node.id);
                return newEdges;
            });
            
            setNodePositions(prev => {
                const newPos = { ...prev };
                delete newPos[node.id];
                // Save after update - immediate save
                setTimeout(() => saveGraph(newNodes, newEdges, newPos, true), 0);
                return newPos;
            });
        } else if (contextMenu.type === 'edge') {
            const edge = contextMenu.data;
            setEdges((eds) => {
                const newEdges = eds.filter((e) => e.id !== edge.id);
                // Immediate save
                setTimeout(() => saveGraph(nodes, newEdges, nodePositions, true), 0);
                return newEdges;
            });
        }
      }
      setContextMenu(null);
  };

  // Auto-generation logic
  useEffect(() => {
    const newNodes = [];
    const newEdges = [];
    let yPos = 50;
    const centerX = 400;

    // Helper to create edge
    const createEdge = (source, target, label = '') => ({
      id: `e-${source}-${target}`,
      source,
      target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      label
    });

    // Helper to get position or default
    const getPos = (id, defaultX, defaultY) => {
      if (nodePositions[id]) {
        return nodePositions[id];
      }
      return { x: defaultX, y: defaultY };
    };

    // Helper to get style if exists
    const getStyle = (id) => {
        if (formData.nodeStyles && formData.nodeStyles[id]) {
            return formData.nodeStyles[id];
        }
        return undefined;
    };

    // 1. Root Node (Project Title)
    const rootId = 'root';
    newNodes.push({
      id: rootId,
      type: 'custom',
      position: getPos(rootId, centerX, yPos),
      data: { 
          label: projectTitle || 'Proyecto Sin Título', 
          isRoot: true,
          style: getStyle(rootId)
      },
      draggable: true,
    });
    if (!nodePositions[rootId]) yPos += 200;

    // 2. Concept Node
    if (formData.concepto) {
      const conceptId = 'concept';
      const pos = getPos(conceptId, centerX, yPos);
      newNodes.push({
        id: conceptId,
        type: 'custom',
        position: pos,
        data: { 
            label: 'Concepto', 
            content: formData.concepto,
            style: getStyle(conceptId)
        },
      });
      newEdges.push(createEdge(rootId, conceptId));
      if (!nodePositions[conceptId]) yPos += 250;

      // 3. Basic Story Node
      if (formData.historiaBasica) {
        const storyId = 'story';
        const storyPos = getPos(storyId, centerX, yPos);
        newNodes.push({
          id: storyId,
          type: 'custom',
          position: storyPos,
          data: { 
              label: 'Historia Básica', 
              content: formData.historiaBasica,
              style: getStyle(storyId)
          },
        });
        newEdges.push(createEdge(conceptId, storyId));

        // 4. Theme Node (Side of Basic Story)
        if (formData.tema) {
          const themeId = 'theme';
          const themePos = getPos(themeId, centerX + 400, yPos);
          newNodes.push({
            id: themeId,
            type: 'custom',
            position: themePos,
            data: { 
                label: 'Tema / Núcleo', 
                content: formData.tema,
                style: getStyle(themeId)
            },
          });
          newEdges.push(createEdge(storyId, themeId));
        }

        // 5. Character Nodes (Children of Basic Story)
        if (formData.personajes && formData.personajes.length > 0) {
          const charYPos = yPos + 300;
          const charSpacing = 350;
          const totalWidth = (formData.personajes.length - 1) * charSpacing;
          let startX = centerX - totalWidth / 2;

          formData.personajes.forEach((char, index) => {
            if (char.nombre) {
              const charId = `char-${index}`;
              const charX = startX + (index * charSpacing);
              const charPos = getPos(charId, charX, charYPos);
              
              // Main Character Node
              newNodes.push({
                id: charId,
                type: 'custom',
                position: charPos,
                data: { 
                  label: char.nombre, 
                  content: char.historiaBreve || 'Sin descripción',
                  style: getStyle(charId)
                },
              });
              newEdges.push(createEdge(storyId, charId));

              // Sub-nodes for Character details
              let subNodeY = charPos.y + 200;
              let subNodeCenterX = charPos.x;
              
              if (char.arcoPersonaje) {
                const arcId = `${charId}-arc`;
                const arcPos = getPos(arcId, subNodeCenterX - 100, subNodeY);
                newNodes.push({
                  id: arcId,
                  type: 'custom',
                  position: arcPos,
                  data: { 
                      label: 'Arco', 
                      content: char.arcoPersonaje,
                      style: getStyle(arcId)
                  },
                  className: '!bg-blue-50 !border-blue-200'
                });
                newEdges.push(createEdge(charId, arcId));
              }

              if (char.personalidad) {
                const persId = `${charId}-pers`;
                const persPos = getPos(persId, subNodeCenterX + 100, subNodeY);
                newNodes.push({
                  id: persId,
                  type: 'custom',
                  position: persPos,
                  data: { 
                      label: 'Personalidad', 
                      content: char.personalidad,
                      style: getStyle(persId)
                  },
                  className: '!bg-green-50 !border-green-200'
                });
                newEdges.push(createEdge(charId, persId));
              }

              if (char.influencias) {
                const inflId = `${charId}-infl`;
                const inflPos = getPos(inflId, subNodeCenterX, subNodeY + 180);
                newNodes.push({
                  id: inflId,
                  type: 'custom',
                  position: inflPos,
                  data: { 
                      label: 'Influencias', 
                      content: char.influencias,
                      style: getStyle(inflId)
                  },
                  className: '!bg-yellow-50 !border-yellow-200'
                });
                newEdges.push(createEdge(charId, inflId));
              }
            }
          });
        }

        // 6. Sinopsis Corta Node (Bottom of Basic Story)
        if (formData.sinopsisCorta) {
            const shortSynId = 'sinopsis-corta';
            const shortSynPos = getPos(shortSynId, centerX, yPos + 700);
            
            newNodes.push({
                id: shortSynId,
                type: 'custom',
                position: shortSynPos,
                data: { 
                    label: 'Sinopsis Corta', 
                    content: formData.sinopsisCorta,
                    style: getStyle(shortSynId)
                },
                className: '!bg-orange-50 !border-orange-200'
            });
            newEdges.push(createEdge(storyId, shortSynId));

            // 7. Sinopsis Larga Node (Bottom of Sinopsis Corta)
            if (formData.sinopsisLarga) {
                const longSynId = 'sinopsis-larga';
                const longSynPos = getPos(longSynId, centerX, shortSynPos.y + 250);
                
                newNodes.push({
                    id: longSynId,
                    type: 'custom',
                    position: longSynPos,
                    data: { 
                        label: 'Sinopsis Larga', 
                        content: formData.sinopsisLarga,
                        style: getStyle(longSynId)
                    },
                    className: '!bg-red-50 !border-red-200'
                });
                newEdges.push(createEdge(shortSynId, longSynId));
            }
        } else if (formData.sinopsisLarga) {
            // If Short Synopsis doesn't exist, connect Long Synopsis to Basic Story
            const longSynId = 'sinopsis-larga';
            const longSynPos = getPos(longSynId, centerX, yPos + 700);
            
            newNodes.push({
                id: longSynId,
                type: 'custom',
                position: longSynPos,
                data: { 
                    label: 'Sinopsis Larga', 
                    content: formData.sinopsisLarga,
                    style: getStyle(longSynId)
                },
                className: '!bg-red-50 !border-red-200'
            });
            newEdges.push(createEdge(storyId, longSynId));
        }
      }
    }

    // Calculate deltas for auto-generated nodes to move connected user nodes
    const deltas = {};
    newNodes.forEach(node => {
        const prev = prevAutoNodesRef.current[node.id];
        if (prev) {
            deltas[node.id] = { x: node.position.x - prev.x, y: node.position.y - prev.y };
        }
        prevAutoNodesRef.current[node.id] = node.position;
    });

    setNodes(prev => {
      const existingUserNodes = prev.filter(n => n.id.startsWith('user-'));
      
      let finalUserNodes = existingUserNodes;
      // Load custom nodes if we have none locally but they exist in formData
      // This handles both initial load and subsequent updates if local state is empty
      if (existingUserNodes.length === 0 && formData.customNodes && formData.customNodes.length > 0) {
          finalUserNodes = formData.customNodes;
      }

      const updatedUserNodes = finalUserNodes.map(uNode => {
          // Find connected edges from auto nodes to this user node
          const connectedEdge = edgesRef.current.find(e => e.target === uNode.id && !e.source.startsWith('user-'));
          
          // Ensure onChange is attached (crucial for reloaded nodes)
          const uNodeWithHandler = {
             ...uNode,
             data: {
                 ...uNode.data,
                 onChange: (val) => onNodeLabelChange(uNode.id, val)
             }
          };

          if (connectedEdge && deltas[connectedEdge.source]) {
              const d = deltas[connectedEdge.source];
              if (d.x !== 0 || d.y !== 0) {
                  return { 
                      ...uNodeWithHandler, 
                      position: { x: uNode.position.x + d.x, y: uNode.position.y + d.y } 
                  };
              }
          }
          return uNodeWithHandler;
      });

      const newNodesWithDrag = newNodes.map(node => {
        return { ...node, draggable: true };
      });

      return [...newNodesWithDrag, ...updatedUserNodes];
    });
    
    setEdges(prev => {
      const existingUserEdges = prev.filter(e => e.id.startsWith('e-user-') || e.source.startsWith('user-') || e.target.startsWith('user-'));
      
      let finalUserEdges = existingUserEdges;
      if (existingUserEdges.length === 0 && formData.customEdges && formData.customEdges.length > 0) {
          finalUserEdges = formData.customEdges;
      }

      return [...newEdges, ...finalUserEdges];
    });

    if (isFirstLoad.current) {
        isFirstLoad.current = false;
    }

  }, [formData, projectTitle, setNodes, setEdges, nodePositions]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => {
        const newEdges = addEdge({ ...params, type: 'smoothstep' }, eds);
        setTimeout(() => saveGraph(nodes, newEdges, nodePositions, true), 0);
        return newEdges;
    }),
    [setEdges, saveGraph, nodes, nodePositions],
  );

  // Toolbar Actions
  const addNode = (type) => {
    const id = `user-${type}-${Date.now()}`;
    const newNode = {
      id,
      type: type === 'connector' ? 'default' : type,
      position: { 
        x: Math.random() * 400 + 200, 
        y: Math.random() * 400 + 200 
      },
      data: { 
        label: type === 'text' ? 'Escribe aquí...' : type === 'image' ? 'Nueva Imagen' : 'Nuevo Nodo' 
      },
    };
    
    if (type === 'image') {
       const url = prompt("URL de la imagen:");
       if (url) newNode.data.url = url;
       else return;
    } else if (type === 'text') {
       newNode.data.label = 'Escribe aquí...';
       newNode.data.autoFocus = true;
       newNode.data.onChange = (val) => onNodeLabelChange(id, val);
    } else {
        // Default/Custom node
        newNode.data.onChange = (val) => onNodeLabelChange(id, val);
    }

    setNodes((nds) => {
        const newNodes = nds.concat(newNode);
        setTimeout(() => saveGraph(newNodes, edges, nodePositions, true), 0);
        return newNodes;
    });
  };

  const onNodeDrag = useCallback(
    (event, node) => {
      // simplified drag handler
    },
    []
  );
  
  const dragRef = useRef(null);
  
  const onNodeDragStart = useCallback((event, node) => {
    dragRef.current = node.position;
  }, []);

  const onNodeDragStop = useCallback((event, node) => {
    let finalPositions = {};
    
    setNodePositions(prev => {
      const newPos = {
        ...prev,
        [node.id]: node.position
      };
      finalPositions = newPos;
      return newPos;
    });
    
    // Save main node move - immediate
    setTimeout(() => saveGraph(nodes, edges, finalPositions, true), 0);

    if (!dragRef.current) return;
    
    const dx = node.position.x - dragRef.current.x;
    const dy = node.position.y - dragRef.current.y;
    
    // Helper to get "Original" position (before drag) to determine hierarchy
    const getOriginalPos = (nId) => {
        if (nId === node.id) return dragRef.current;
        const n = nodes.find(x => x.id === nId);
        return n ? n.position : { x: 0, y: 0 };
    };

    const findDescendants = (nodeId, visited = new Set()) => {
        const descendants = [];
        const currentPos = getOriginalPos(nodeId);
        
        // Find ALL connected edges (bidirectional)
        const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
        
        connectedEdges.forEach(edge => {
          const neighborId = edge.source === nodeId ? edge.target : edge.source;
          
          if (visited.has(neighborId)) return;
          
          const neighborPos = getOriginalPos(neighborId);
          
          // Check hierarchy using ORIGINAL positions
          // If neighbor was below (or level) relative to current node, it follows gravity
          // Use a buffer of -30 to allow side-by-side nodes to move together
          if (neighborPos.y >= currentPos.y - 30) {
              visited.add(neighborId);
              descendants.push(neighborId);
              descendants.push(...findDescendants(neighborId, visited));
          }
        });
        return descendants;
    };

    const descendants = findDescendants(node.id, new Set([node.id]));
    
    if (descendants.length > 0) {
      let descendantUpdates = {};
      
      setNodes((nds) => 
        nds.map((n) => {
          if (descendants.includes(n.id)) {
            const newPos = {
                x: n.position.x + dx,
                y: n.position.y + dy,
            };
            descendantUpdates[n.id] = newPos;
            return {
              ...n,
              position: newPos,
            };
          }
          return n;
        })
      );
      
      setNodePositions(prev => {
          const merged = { ...prev, ...descendantUpdates };
          setTimeout(() => saveGraph(nodes, edges, merged, true), 0);
          return merged;
      });
    }
    
    dragRef.current = null;
  }, [edges, setNodes, saveGraph, nodes]);

  return (
    <div className="w-full h-full relative group">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeDragStart={readOnly ? undefined : onNodeDragStart}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        onNodeContextMenu={readOnly ? undefined : onNodeContextMenu}
        onEdgeContextMenu={readOnly ? undefined : onEdgeContextMenu}
        nodeTypes={nodeTypes}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        fitView={isFirstLoad.current} // Only fit view on first load if no viewport saved?
        // Actually fitView overrides viewport. We should disable fitView if we have a saved viewport.
        // But isFirstLoad is true initially.
        // We'll handle viewport in onInit.
        attributionPosition="bottom-left"
        defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
        onInit={(instance) => {
            setRfInstance(instance);
            if (onInit) onInit(instance); // Propagate instance to parent if needed

            // Restore saved viewport (position and zoom)
            // If in EscaletaTab (readOnly), check if we have a specific saved viewport for it
            if (readOnly && formData.escaletaViewport) {
                const { x, y, zoom } = formData.escaletaViewport;
                instance.setViewport({ x, y, zoom });
            } else if (formData.viewport && !readOnly) {
                // If in ConceptTab (not readOnly), let parent handle restoration or use formData.viewport
                // Actually, parent handles it via onInit if onUpdateProject is used, but for backward compat:
                const { x, y, zoom } = formData.viewport;
                instance.setViewport({ x, y, zoom });
            } else {
                instance.fitView();
            }
        }}
        onMoveEnd={(event, viewport) => {
            if (onViewportChange) {
                onViewportChange(viewport);
            }
            
            if (onChange) {
                if (readOnly) {
                    // Save specific viewport for EscaletaTab
                    onChange({ escaletaViewport: viewport });
                } else {
                    onChange({ viewport });
                }
            }
        }}
        onPaneContextMenu={(event) => event.preventDefault()} // Prevent Chrome menu on canvas
        onClick={() => setContextMenu(null)}
        onPaneClick={() => setContextMenu(null)}
      >
        <Background gap={16} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} className="bg-white border border-gray-200 shadow-sm rounded-lg" />
        <MiniMap 
          nodeColor={(n) => {
            if (n.type === 'custom') return '#8b5cf6';
            return '#e5e7eb';
          }} 
          className="border border-gray-200 shadow-sm rounded-lg"
        />
        
        {/* Context Menu */}
        {!readOnly && contextMenu && (
            <ContextMenu 
                x={contextMenu.x} 
                y={contextMenu.y} 
                type={contextMenu.type}
                onEdit={handleEditFromMenu}
                onDelete={handleDeleteFromMenu}
                onClose={() => setContextMenu(null)}
            />
        )}
        
        {!readOnly && (
            <Panel position="top-left" className="bg-white p-2 rounded-lg shadow-md border border-gray-100 flex gap-2">
              <button onClick={() => addNode('text')} className="p-2 hover:bg-gray-100 rounded-md text-gray-600 tooltip" title="Añadir Texto">
                <Type size={20} />
              </button>
              <button onClick={() => addNode('image')} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Añadir Imagen">
                <ImageIcon size={20} />
              </button>
              <button onClick={() => addNode('custom')} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Añadir Nota">
                <StickyNote size={20} />
              </button>
            </Panel>
        )}
      </ReactFlow>
    </div>
  );
};

export default ConceptMap;
