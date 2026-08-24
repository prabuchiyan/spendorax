import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import PageLoader from '../components/PageLoader';

const PageLoaderContext = createContext(null);

export function PageLoaderProvider({ children }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState({});
  const countRef = useRef(0);

  const show = useCallback((opts = {}) => {
    countRef.current += 1;
    setOptions(opts);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    if (countRef.current > 0) {
      countRef.current -= 1;
    }

    if (countRef.current <= 0) {
      countRef.current = 0;
      setVisible(false);
      setOptions({});
    }
  }, []);

  return (
    <PageLoaderContext.Provider value={{ visible, show, hide, options }}>
      {children}
      <PageLoader visible={visible} source={options.source} size={options.size || 130} />
    </PageLoaderContext.Provider>
  );
}

export function usePageLoader() {
  const ctx = useContext(PageLoaderContext);
  if (!ctx) throw new Error('usePageLoader must be used within PageLoaderProvider');
  return ctx;
}
