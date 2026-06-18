import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";

type IconName = "home" | "search" | "add-circle" | "map" | "person";
type TabIoniconName =
  | "home"
  | "home-outline"
  | "search"
  | "search-outline"
  | "add-circle"
  | "add-circle-outline"
  | "map"
  | "map-outline"
  | "person"
  | "person-outline";

const TAB_ICONS: Record<IconName, { active: TabIoniconName; inactive: TabIoniconName }> = {
  home: { active: "home", inactive: "home-outline" },
  search: { active: "search", inactive: "search-outline" },
  "add-circle": { active: "add-circle", inactive: "add-circle-outline" },
  map: { active: "map", inactive: "map-outline" },
  person: { active: "person", inactive: "person-outline" }
};

function TabIcon({ icon, label, focused }: { icon: IconName; label: string; focused: boolean }) {
  const iconName = focused ? TAB_ICONS[icon].active : TAB_ICONS[icon].inactive;

  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={iconName}
        size={24}
        color={focused ? Theme.colors.primary : Theme.colors.textTertiary}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="home" label="홈" focused={focused} /> }}
      />
      <Tabs.Screen
        name="search"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="search" label="검색" focused={focused} /> }}
      />
      <Tabs.Screen
        name="create"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="add-circle" label="새일정" focused={focused} /> }}
      />
      <Tabs.Screen
        name="map"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="map" label="지도" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="person" label="MY" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 85, paddingTop: 8, paddingBottom: 25,
    backgroundColor: Theme.colors.surface, borderTopWidth: 0,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 12,
  },
  tabItem: { alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 11, marginTop: 2, color: Theme.colors.textTertiary, fontWeight: "500" },
  tabLabelActive: { color: Theme.colors.primary, fontWeight: "700" },
});
