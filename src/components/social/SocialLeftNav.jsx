import { NavLink } from 'react-router-dom';
import { Bell, Bookmark, Home, Mail, Search, User } from 'lucide-react';

const baseItemClass =
  'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-gray-600 hover:bg-purple-50 hover:text-purple-700 font-medium';

const activeItemClass = 'bg-purple-100 text-purple-800';

const SocialLeftNav = () => {
  const items = [
    { to: '/social', label: 'Inicio', icon: <Home size={20} /> },
    { to: '/social/explore', label: 'Explorar', icon: <Search size={20} /> },
    { to: '/social/notifications', label: 'Notificaciones', icon: <Bell size={20} /> },
    { to: '/social/bookmarks', label: 'Guardados', icon: <Bookmark size={20} /> },
    { to: '/social/messages', label: 'Mensajes', icon: <Mail size={20} /> },
    { to: '/public_profile', label: 'Perfil', icon: <User size={20} /> },
  ];

  return (
    <div className="h-full flex flex-col p-2">
      <div className="mb-4 px-4 py-2">
        <div className="text-xl font-bold tracking-tight text-purple-800">Social</div>
        <div className="text-xs text-purple-600 font-medium uppercase tracking-wider">Cineasta</div>
      </div>

      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${baseItemClass} ${isActive ? activeItemClass : ''}`
            }
            end={item.to === '/social'}
          >
            <span className="">{item.icon}</span>
            <span className="">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 px-2">
        <a
          href="/social#composer"
          className="block w-full text-center bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transition-all text-white font-bold rounded-full py-3"
        >
          Postear
        </a>
      </div>

      <div className="mt-auto px-4 pb-4 pt-6 text-xs text-gray-400">
        <div className="leading-relaxed">
          Ideas rápidas, avances y feedback.
        </div>
      </div>
    </div>
  );
};

export default SocialLeftNav;

