import { useEffect, useState } from 'react';

/**
 * Hook personalizzato che restituisce lo stato corrente di una media query.
 *
 * @param {number} width - La larghezza minima della finestra per la media query.
 * @returns {boolean} True se la larghezza della finestra è maggiore o uguale a `width`, altrimenti false.
 */
export const useMediaQuery = (width: number): boolean => {
  const [isWidth, setIsWidth] = useState(window.innerWidth >= width);

  /**
   * Gestisce l'evento resize della finestra e aggiorna lo stato della media query.
   */
  useEffect(() => {
    const handleResize = (): void => {
      setIsWidth(window.innerWidth >= width);
    };

    // Aggiunge un listener per l'evento resize
    window.addEventListener('resize', handleResize);

    // Rimuove il listener quando il componente viene smontato
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [width]);

  return isWidth;
};
