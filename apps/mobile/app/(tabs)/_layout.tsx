import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Theme from "../../constants/Theme";

type VisibleTab = "index" | "search" | "schedule" | "map" | "profile";

type TabMeta = {
  name: VisibleTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

const TAB_META: Record<VisibleTab, TabMeta> = {
  index: { name: "index", label: "홈", icon: "home-outline", iconFocused: "home" },
  search: { name: "search", label: "로컬", icon: "compass-outline", iconFocused: "compass" },
  schedule: { name: "schedule", label: "일정", icon: "calendar-outline", iconFocused: "calendar" },
  map: { name: "map", label: "지도", icon: "map-outline", iconFocused: "map" },
  profile: { name: "profile", label: "프로필", icon: "person-outline", iconFocused: "person" }
};

function TabIcon({ tab, focused }: { tab: TabMeta; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? tab.iconFocused : tab.icon}
        size={23}
        color={focused ? Theme.colors.textPrimary : Theme.colors.textTertiary}
      />
      <Text style={[styles.tabLabel, focused ? styles.tabLabelFocused : null]}>{tab.label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      {(Object.keys(TAB_META) as VisibleTab[]).map((key) => (
        <Tabs.Screen
          key={key}
          name={TAB_META[key].name}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon tab={TAB_META[key]} focused={focused} />
          }}
        />
      ))}

      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="friend" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 84,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderLight,
    ...Theme.shadow.md,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "500",
    color: Theme.colors.textTertiary,
  },
  tabLabelFocused: {
    color: Theme.colors.textPrimary,
    fontWeight: "700",
  }
});
