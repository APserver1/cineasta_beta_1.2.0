import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Home, FolderKanban, Users, Settings, FileText, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const menuItems = [
    { name: 'Home', path: '/', icon: <Home size={20} /> },
    { name: 'Proyectos', path: '/projects', icon: <FolderKanban size={20} /> },
    { name: 'Social', path: '/social', icon: <Users size={20} /> },
    { name: 'Ajustes', path: '/settings', icon: <Settings size={20} /> },
    { name: 'Términos y Condiciones', path: '/terms', icon: <FileText size={20} /> },
  ];

  const sidebarVariants = {
    closed: { x: '-100%', transition: { type: 'spring', stiffness: 300, damping: 30 } },
    open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-[90]"
          />
          
          {/* Drawer */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={sidebarVariants}
            className="fixed top-0 left-0 h-full w-64 bg-white/90 backdrop-blur-md shadow-2xl z-[100] flex flex-col border-r border-purple-100"
          >
            <div className="p-4 flex justify-between items-center border-b border-purple-100">
              <h2 className="text-xl font-bold text-purple-800 tracking-tighter">CINEASTA</h2>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-purple-100 transition-colors">
                <X size={24} className="text-purple-800" />
              </button>
            </div>

            <nav className="flex-1 py-6 px-4 space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    location.pathname === item.path
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                      : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
            </nav>

            {user && (
              <div className="p-4 border-t border-purple-100">
                <button
                  onClick={() => {
                    signOut();
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Cerrar Sesión</span>
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
