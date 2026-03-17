import SocialLeftNav from './SocialLeftNav';
import SocialRightSidebar from './SocialRightSidebar';

const SocialLayout = ({ children }) => {
  return (
    <div className="h-[calc(100vh-64px)] bg-gray-50 text-gray-900 overflow-hidden">
      <div className="h-full max-w-7xl mx-auto px-4 md:px-6 py-4 grid grid-cols-[80px,minmax(0,1fr)] md:grid-cols-[200px,minmax(0,1fr),260px] lg:grid-cols-[240px,minmax(0,1fr),300px] xl:grid-cols-[260px,minmax(0,1fr),320px] gap-4 lg:gap-6 items-stretch">
        <aside className="hidden md:block">
          <div className="sticky top-[84px]">
            <div className="bg-white rounded-2xl border border-purple-100 shadow-sm">
              <SocialLeftNav />
            </div>
          </div>
        </aside>

        <section className="min-h-0 h-full flex flex-col">{children}</section>

        <aside className="hidden md:block">
          <div className="sticky top-[84px]">
            <SocialRightSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SocialLayout;
