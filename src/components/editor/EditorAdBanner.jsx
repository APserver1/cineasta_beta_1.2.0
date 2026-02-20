import { useEffect, useMemo, useRef, useState } from 'react';

const ADSTERRA_NATIVE_CONTAINER_ID = 'container-20a02c2e254f8f71908f748a0dc22c3d';
const ADSTERRA_NATIVE_SCRIPT_SRC = 'https://pl28698636.effectivegatecpm.com/20a02c2e254f8f71908f748a0dc22c3d/invoke.js';

const EditorAdBanner = ({ height = 120 }) => {
  const hostRef = useRef(null);
  const iframeRef = useRef(null);
  const cleanupObserversRef = useRef(null);
  const [frameKey, setFrameKey] = useState(0);
  const [scale, setScale] = useState(1);
  const lastReloadAtRef = useRef(0);

  useEffect(() => {
    const requestReload = () => {
      const now = Date.now();
      if (now - lastReloadAtRef.current < 250) return;
      lastReloadAtRef.current = now;
      setFrameKey((prev) => prev + 1);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestReload();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', requestReload);
    window.addEventListener('pageshow', requestReload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', requestReload);
      window.removeEventListener('pageshow', requestReload);
    };
  }, []);

  const srcDoc = useMemo(() => {
    const cacheBuster = `${Date.now()}-${frameKey}`;
    const scriptSrc = ADSTERRA_NATIVE_SCRIPT_SRC.includes('?')
      ? `${ADSTERRA_NATIVE_SCRIPT_SRC}&v=${cacheBuster}`
      : `${ADSTERRA_NATIVE_SCRIPT_SRC}?v=${cacheBuster}`;

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; background: #fff; }
      #wrap { width: 100%; overflow: hidden; }
      #${ADSTERRA_NATIVE_CONTAINER_ID} { width: 100%; }
    </style>
  </head>
  <body>
    <div id="wrap">
      <div id="${ADSTERRA_NATIVE_CONTAINER_ID}"></div>
    </div>
    <script async data-cfasync="false" src="${scriptSrc}"></script>
  </body>
</html>`;
  }, [frameKey, height]);

  const handleFrameLoad = () => {
    if (cleanupObserversRef.current) cleanupObserversRef.current();
    cleanupObserversRef.current = null;

    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const body = doc?.body;
    const root = doc?.documentElement;
    if (!iframe || !doc || !body || !root) return;

    const updateScale = () => {
      const curDoc = iframeRef.current?.contentDocument;
      const curBody = curDoc?.body || null;
      const curRoot = curDoc?.documentElement || null;
      const curHost = hostRef.current || null;
      if (!curBody || !curRoot || !curHost) return;

      const contentEl = curDoc.getElementById(ADSTERRA_NATIVE_CONTAINER_ID) || curBody;
      const contentHeight = Math.max(
        contentEl.scrollHeight || 0,
        contentEl.offsetHeight || 0,
        curBody.scrollHeight || 0,
        curBody.offsetHeight || 0,
        curRoot.scrollHeight || 0,
        curRoot.offsetHeight || 0
      );
      const contentWidth = Math.max(
        contentEl.scrollWidth || 0,
        contentEl.offsetWidth || 0,
        curBody.scrollWidth || 0,
        curBody.offsetWidth || 0,
        curRoot.scrollWidth || 0,
        curRoot.offsetWidth || 0
      );

      const hostWidth = curHost.clientWidth || 0;
      if (!contentHeight || !contentWidth || !hostWidth) return;

      const nextScale = Math.min(1, height / contentHeight, hostWidth / contentWidth);
      setScale(nextScale);
    };

    updateScale();

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(updateScale);
    });
    mutationObserver.observe(body, { childList: true, subtree: true, attributes: true });

    const resizeObserver = window.ResizeObserver ? new ResizeObserver(() => updateScale()) : null;
    if (resizeObserver) resizeObserver.observe(body);

    const timers = [
      setTimeout(updateScale, 250),
      setTimeout(updateScale, 700),
      setTimeout(updateScale, 1400),
      setTimeout(updateScale, 2200)
    ];

    const hostResizeObserver = window.ResizeObserver
      ? new ResizeObserver(() => updateScale())
      : null;
    if (hostResizeObserver && hostRef.current) hostResizeObserver.observe(hostRef.current);

    cleanupObserversRef.current = () => {
      mutationObserver.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      if (hostResizeObserver) hostResizeObserver.disconnect();
      timers.forEach((t) => clearTimeout(t));
    };
  };

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white">
      <div ref={hostRef} className="w-full overflow-hidden" style={{ height }}>
        <iframe
          key={frameKey}
          ref={iframeRef}
          title="Editor Ads"
          className="border-0"
          style={{
            width: `${100 / scale}%`,
            height: `${height / scale}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
          referrerPolicy="no-referrer-when-downgrade"
          srcDoc={srcDoc}
          onLoad={handleFrameLoad}
        />
      </div>
    </div>
  );
};

export default EditorAdBanner;
