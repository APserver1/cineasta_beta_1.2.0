import SocialLayout from '../components/social/SocialLayout';

const SocialPlaceholder = ({ title }) => {
  return (
    <SocialLayout>
      <div className="h-full glass border border-purple-100 rounded-2xl overflow-hidden shadow-lg shadow-purple-100 flex flex-col">
        <div className="px-4 py-3 border-b border-purple-100 bg-white/40">
          <div className="text-lg font-semibold tracking-tight text-gray-900">{title}</div>
        </div>
        <div className="p-8 text-gray-600">
          <div className="text-gray-900 font-semibold">Próximamente</div>
          <div className="mt-1">Esta sección se habilitará en próximas versiones.</div>
        </div>
      </div>
    </SocialLayout>
  );
};

export default SocialPlaceholder;
