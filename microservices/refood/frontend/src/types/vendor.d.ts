// Temporary shims to quiet missing type declarations for certain Expo packages
declare module 'expo-status-bar' {
  export const StatusBar: any;
  const _default: any;
  export default _default;
}

declare module 'expo-haptics' {
  export const ImpactFeedbackStyle: any;
  export function impactAsync(style?: any): Promise<void>;
}

