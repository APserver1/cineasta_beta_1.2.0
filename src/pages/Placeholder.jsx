import { motion } from 'framer-motion';

const Placeholder = ({ title }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
          {title}
        </h1>
        <p className="text-xl text-gray-500 mb-8">
          Esta sección está actualmente en desarrollo. ¡Pronto podrás utilizar esta herramienta!
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-purple-200 to-indigo-200 mx-auto rounded-full" />
      </motion.div>
    </div>
  );
};

export default Placeholder;
