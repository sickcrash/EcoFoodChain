import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';

type Options = {
  /** Minimum width returned by the hook. */
  minWidth?: number;
  /** Maximum width returned by the hook. */
  maxWidth?: number;
  /** Horizontal padding to subtract from the available viewport width. */
  horizontalPadding?: number;
};

const DEFAULT_OPTIONS: Required<Options> = {
  minWidth: 320,
  maxWidth: 1200,
  horizontalPadding: 32,
};

/**
 * Computes a responsive content width that mirrors the layout behaviour used on the statistics tab.
 * The hook listens to window/screen changes and clamps the width between the provided bounds.
 */
export function useResponsiveContentWidth(options: Options = {}): number {
  const { minWidth, maxWidth, horizontalPadding } = { ...DEFAULT_OPTIONS, ...options };

  const computeWidth = useCallback(() => {
    const rawWidth = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth
      : Dimensions.get('window').width;

    const availableWidth = Math.max(0, (rawWidth ?? 0) - horizontalPadding);
    return Math.max(minWidth, Math.min(availableWidth, maxWidth));
  }, [horizontalPadding, maxWidth, minWidth]);

  const [contentWidth, setContentWidth] = useState(() => computeWidth());

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onResize = () => setContentWidth(computeWidth());
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const onChange = () => setContentWidth(computeWidth());
    const subscription = Dimensions.addEventListener('change', onChange);

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      } else {
        const legacy = (Dimensions as unknown as { removeEventListener?: (event: string, handler: () => void) => void }).removeEventListener;
        legacy?.('change', onChange);
      }
    };
  }, [computeWidth]);

  return contentWidth;
}

export default useResponsiveContentWidth;
