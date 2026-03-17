import { motion } from 'framer-motion';
import { ArrowRight, Clapperboard, PenTool, Layout as LayoutIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const Home = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-violet-200/40 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div variants={itemVariants} className="inline-block mb-6 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-sm font-semibold tracking-wide uppercase">
            Plataforma Integral de Preproducción
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-8 leading-tight">
            Donde las ideas se convierten en <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Cine</span>.
          </motion.h1>

          <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-600 mb-12 leading-relaxed">
            Esta es una página con el propósito de concentrar todas las herramientas de preproducción para cineastas o guionistas, desde la ideación, pasando por la escritura de guiones y terminando por el Storyboard. Todo esto con el propósito de facilitar el desarrollo de ideas y ser una alternativa gratuita a distintas herramientas para Cineastas independientes.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/register" className="group px-8 py-4 bg-gray-900 text-white rounded-full font-semibold text-lg hover:bg-purple-900 transition-all duration-300 flex items-center gap-2 shadow-xl shadow-purple-900/20">
              Comenzar Ahora
              <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/projects" className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-full font-semibold text-lg hover:bg-gray-50 hover:border-purple-200 transition-all duration-300">
              Ver Proyectos
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="grid md:grid-cols-3 gap-8 mt-24"
        >
          {[
            { icon: <PenTool size={32} />, title: "Escritura de Guiones", desc: "Editor profesional con formato estándar de la industria." },
            { icon: <LayoutIcon size={32} />, title: "Storyboarding", desc: "Visualiza tus planos con herramientas de dibujo intuitivas." },
            { icon: <Clapperboard size={32} />, title: "Gestión de Proyectos", desc: "Organiza rodajes, cast y localizaciones en un solo lugar." }
          ].map((feature, idx) => (
            <div key={idx} className="p-8 rounded-3xl bg-white border border-gray-100 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-200/50 hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
