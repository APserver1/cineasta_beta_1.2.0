import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Editor from './pages/Editor';
import AuthPage from './pages/Auth';
import PublicProfile from './pages/PublicProfile';
import Placeholder from './pages/Placeholder';
import Social from './pages/Social';
import SocialProfile from './pages/SocialProfile';
import SocialPostDetail from './pages/SocialPostDetail';
import SocialPlaceholder from './pages/SocialPlaceholder';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<AuthPage type="login" />} />
        <Route path="register" element={<AuthPage type="register" />} />
        <Route path="projects" element={<Projects />} />
        <Route path="editor/:projectId" element={<Editor />} />
        <Route path="public_profile" element={<PublicProfile />} />
        <Route path="social" element={<Social />} />
        <Route path="social/u/:username" element={<SocialProfile />} />
        <Route path="social/post/:postId" element={<SocialPostDetail />} />
        <Route path="social/explore" element={<SocialPlaceholder title="Explorar" />} />
        <Route path="social/notifications" element={<SocialPlaceholder title="Notificaciones" />} />
        <Route path="social/bookmarks" element={<SocialPlaceholder title="Guardados" />} />
        <Route path="social/messages" element={<SocialPlaceholder title="Mensajes" />} />
        <Route path="settings" element={<Placeholder title="Ajustes" />} />
        <Route path="terms" element={<Placeholder title="Términos y Condiciones" />} />
        <Route path="*" element={<Placeholder title="404 - Página no encontrada" />} />
      </Route>
    </Routes>
  );
}

export default App;
