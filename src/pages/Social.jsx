import { useState } from 'react';
import SocialLayout from '../components/social/SocialLayout';
import SocialTabs from '../components/social/SocialTabs';
import SocialComposer from '../components/social/SocialComposer';
import SocialFeed from '../components/social/SocialFeed';
import { useAuth } from '../context/AuthContext';

const Social = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('forYou');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <SocialLayout>
      <div className="h-full glass border border-purple-100 rounded-2xl overflow-hidden shadow-lg shadow-purple-100 flex flex-col">
        <div className="px-4 py-3 border-b border-purple-100 bg-white/40">
          <div className="text-lg font-semibold tracking-tight text-gray-900">Social</div>
        </div>

        <SocialTabs
          value={tab}
          onChange={setTab}
          canUseFollowing={Boolean(user)}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <SocialComposer
            onPosted={() => {
              setRefreshKey((n) => n + 1);
              setTab('forYou');
            }}
          />
          <SocialFeed mode={tab === 'following' ? 'following' : 'forYou'} refreshKey={refreshKey} />
        </div>
      </div>
    </SocialLayout>
  );
};

export default Social;
