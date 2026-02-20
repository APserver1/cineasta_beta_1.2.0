const tabBase =
  'flex-1 py-3 text-sm font-semibold transition-colors border-b-2';

const SocialTabs = ({ value, onChange, canUseFollowing }) => {
  return (
    <div className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-purple-100">
      <div className="flex">
        <button
          type="button"
          onClick={() => onChange('forYou')}
          className={`${tabBase} ${
            value === 'forYou'
              ? 'text-gray-900 border-purple-600'
              : 'text-gray-500 border-transparent hover:text-gray-900 hover:bg-purple-50/40'
          }`}
        >
          Para ti
        </button>
        <button
          type="button"
          onClick={() => {
            if (canUseFollowing) onChange('following');
          }}
          className={`${tabBase} ${
            value === 'following'
              ? 'text-gray-900 border-purple-600'
              : 'text-gray-500 border-transparent hover:text-gray-900 hover:bg-purple-50/40'
          } ${canUseFollowing ? '' : 'text-gray-400 cursor-not-allowed hover:bg-transparent hover:text-gray-400'}`}
          title={canUseFollowing ? '' : 'Inicia sesión para ver Siguiendo'}
        >
          Siguiendo
        </button>
      </div>
    </div>
  );
};

export default SocialTabs;
