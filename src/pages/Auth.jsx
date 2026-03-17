import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const AuthPage = ({ type }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const isLogin = type === 'login';

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/projects');
      } else {
        // Register
        if (username.length < 3) throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');

        // Check availability
        const { data: isAvailable, error: checkError } = await supabase
          .rpc('check_username_availability', { username_to_check: username });

        if (checkError) throw checkError;
        if (!isAvailable) throw new Error('El nombre de usuario ya está en uso. Por favor elige otro.');

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        });
        
        if (error) throw error;

        if (data?.user) {
          // Initialize public_profile
          const { error: profileError } = await supabase
            .from('public_profile')
            .insert([
              { 
                user_id: data.user.id, 
                username: username 
              }
            ]);
            
          // We also ensure public.users has the username if it's not automatically synced
          // This might fail if public.users is strictly managed by triggers, but it's worth a try or check
          const { error: usersError } = await supabase
            .from('users')
            .update({ username: username })
            .eq('id', data.user.id);
            
          // Ignore usersError if it's just because the row doesn't exist yet (race condition with trigger)
          if (profileError) console.error('Error creating profile:', profileError);
        }

        alert('Registro exitoso! Por favor verifica tu correo.');
        navigate('/projects');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[20%] right-[20%] w-[400px] h-[400px] bg-purple-200/40 rounded-full blur-[80px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-2xl shadow-purple-100"
      >
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">
          {isLogin ? 'Bienvenido de nuevo' : 'Únete a Cineasta'}
        </h2>
        <p className="text-center text-gray-500 mb-8">
          {isLogin ? 'Ingresa a tu espacio creativo' : 'Comienza a dar vida a tus historias'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all bg-white/50"
                placeholder="usuario123"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all bg-white/50"
              placeholder="tu@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all bg-white/50"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 focus:ring-4 focus:ring-purple-200 transition-all shadow-lg shadow-purple-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {isLogin ? (
            <>
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-purple-600 font-semibold hover:text-purple-800">
                Regístrate gratis
              </Link>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-purple-600 font-semibold hover:text-purple-800">
                Inicia sesión
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
