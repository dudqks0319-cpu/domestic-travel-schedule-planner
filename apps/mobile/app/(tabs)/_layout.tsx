import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "../../constants/Colors";

type IconName = "home" | "search" | "add-circle" | "map" | "person";

function TabIcon({ icon, label, focused }: { icon: IconName; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? icon : (`${icon}-outline` as any)}
        size={24}
        color={focused ? Colors.young.primary : Colors.common.gray400}
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
    backgroundColor: "#FFFFFF", borderTopWidth: 0,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 12,
  },
  tabItem: { alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 11, marginTop: 2, color: Colors.common.gray400, fontWeight: "500" },
  tabLabelActive: { color: Colors.young.primary, fontWeight: "700" },
});
