import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";

function TabIcon({
  emoji,
  label,
  focused
}: {
  emoji: string;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
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
        tabBarShowLabel: false
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="홈" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" label="검색" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="➕" label="새일정" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" label="지도" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="MY" focused={focused} />
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 85,
    paddingTop: 8,
    paddingBottom: 25,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: Colors.common.gray100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center"
  },
  tabEmoji: {
    fontSize: 24,
    opacity: 0.5
  },
  tabEmojiActive: {
    opacity: 1
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    color: Colors.common.gray400,
    fontWeight: "500"
  },
  tabLabelActive: {
    color: Colors.young.primary,
    fontWeight: "700"
  }
});
