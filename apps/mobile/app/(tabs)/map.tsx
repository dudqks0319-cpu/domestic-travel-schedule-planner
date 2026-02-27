import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.title}>지도</Text>
      <Text style={styles.sub}>곧 만들어질 화면이에요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA"
  },
  emoji: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: Colors.common.gray800 },
  sub: { fontSize: 14, color: Colors.common.gray500, marginTop: 8 }
});
