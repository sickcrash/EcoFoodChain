import { ReactPortal, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const usePortal = (): {
  createPortal: (children: React.ReactNode) => ReactPortal | null;
} => {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null
  );

  useEffect(() => {
    const container = document.createElement('div');
    container.id = 'portal-root';

    if (container) {
      document.getElementById('portal-root')?.appendChild(container);
      setPortalContainer(container);
    }

    return () => {
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  }, []);

  const createPortal = (children: React.ReactNode): ReactPortal | null => {
    if (portalContainer) {
      return ReactDOM.createPortal(children, portalContainer);
    } else {
      return null;
    }
  };

  return { createPortal };
};

export default usePortal;
