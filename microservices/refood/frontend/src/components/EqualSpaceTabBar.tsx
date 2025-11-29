import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';

type TabConfig = {
  key: string;
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

interface Props extends BottomTabBarProps {
  allowedKeys: string[];
  config: TabConfig[];
  activeColor: string;
  inactiveColor: string;
  showLabels: boolean;
  backgroundColor?: string;
  borderTopColor?: string;
}

export default function EqualSpaceTabBar({
  state,
  descriptors,
  navigation,
  allowedKeys,
  config,
  activeColor,
  inactiveColor,
  showLabels,
  backgroundColor = '#fff',
  borderTopColor = '#e1e1e1',
}: Props) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter(r => allowedKeys.includes(r.name));

  const iconSize = showLabels ? 30 : 34;
  const paddingTop = Platform.OS === 'web' ? 14 : 12;
  const basePaddingBottom = Platform.OS === 'web' ? 14 : 16;
  const paddingBottom = basePaddingBottom + Math.min(insets.bottom, 10);

  const items = visibleRoutes.map((route, index) => {
    const focused = state.index === state.routes.findIndex(r => r.key === route.key);
    const color = focused ? activeColor : inactiveColor;
    const options = descriptors[route.key]?.options || {};
    const key = route.name;
    const cfg = config.find(c => c.key === key);
    const title = (options.tabBarLabel as string) || cfg?.title || route.name;
    const iconName = (options.tabBarIcon as any)?.name || cfg?.icon || 'circle';

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.item}
        android_ripple={{ color: '#00000010' }}
        accessibilityRole="tab"
        accessibilityLabel={title}
        accessibilityState={{ selected: focused }}
      >
        <MaterialCommunityIcons
          name={cfg?.icon || iconName}
          size={iconSize}
          color={color}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
        {showLabels && <Text style={[styles.label, { color }]} numberOfLines={1}>{title}</Text>}
      </Pressable>
    );
  });

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Navigazione principale"
      style={[
        styles.container,
        { backgroundColor, borderTopColor, paddingTop, paddingBottom }
      ]}
    >
      {items}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    // paddingTop / paddingBottom overridden inline to include safe area
    paddingHorizontal: 0,
    minHeight: 72,
  },
  item: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 12.5,
  },
});
