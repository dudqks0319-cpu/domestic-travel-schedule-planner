import React, { useEffect, useMemo, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Theme from "../../constants/Theme";
import { fetchTripScheduleStops } from "../../services/trips.service";

type StopItem = {
  id: string;
  time: string;
  title: string;
  duration: string;
  fee: string;
  color: string;
  image: string;
};

const MAP_MARKERS = [
  { top: "18%", left: "64%" },
  { top: "28%", left: "66%" },
  { top: "44%", left: "62%" },
  { top: "58%", left: "47%" },
  { top: "68%", left: "54%" },
  { top: "76%", left: "60%" },
];

export default function ScheduleTabScreen() {
  const router = useRouter();
  const [stops, setStops] = useState<StopItem[]>([]);

  useEffect(() => {
    fetchTripScheduleStops().then((items) => {
      setStops((items ?? []).slice(0, 6));
    });
  }, []);

  const moveDurations = useMemo(() => {
    return stops.map((_, index) => {
      if (index >= stops.length - 1) {
        return "";
      }
      const values = ["차로 25분", "차로 15분", "차로 18분", "차로 12분", "차로 20분"];
      return values[index % values.length];
    });
  }, [stops]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>제주도 여행 일정 ✈</Text>
          <Text style={styles.headerSub}>3박 4일 (3월 15-18일)</Text>
        </View>

        <View style={styles.bodyCard}>
          <View style={styles.mapPane}>
            <View style={styles.mapFrame}>
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1528127269322-539801943592?w=900&q=80" }}
                style={styles.mapImage}
              />
              <View style={styles.mapTint} />
              {stops.map((stop, index) => {
                const markerPos = MAP_MARKERS[index % MAP_MARKERS.length];
                return (
                  <View
                    key={`map-marker-${stop.id}`}
                    style={[
                      styles.mapMarker,
                      { top: markerPos.top as any, left: markerPos.left as any, backgroundColor: stop.color || Theme.colors.primary }
                    ]}
                  >
                    <Text style={styles.mapMarkerText}>{index + 1}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.timelinePane}>
            {stops.map((stop, index) => (
              <View key={stop.id} style={styles.stopWrap}>
                <View style={[styles.stopCard, { borderLeftColor: stop.color || Theme.colors.primary }]}>
                  <Text style={styles.stopTime}>{stop.time}</Text>
                  <View style={styles.stopTitleRow}>
                    <Image source={{ uri: stop.image }} style={styles.stopThumb} />
                    <View style={styles.stopBody}>
                      <Text style={styles.stopTitle} numberOfLines={1}>{stop.title}</Text>
                      <Text style={styles.stopMeta}>{stop.duration}</Text>
                      <Text style={styles.stopMeta}>{stop.fee}</Text>
                    </View>
                  </View>
                </View>

                {index < stops.length - 1 ? (
                  <View style={styles.connectorRow}>
                    <Ionicons name="arrow-down" size={13} color={Theme.colors.textTertiary} />
                    <Text style={styles.connectorText}>{moveDurations[index]}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.routeButton} onPress={() => router.push("/trip/route-map")}>
          <Ionicons name="map-outline" size={18} color="#FFFFFF" />
          <Text style={styles.routeButtonText}>경로 지도 열기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7EEE6" },
  content: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 28,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 540 : "100%",
    alignSelf: "center",
  },
  headerCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#F58671",
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    ...Theme.shadow.sm,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  headerSub: {
    marginTop: 2,
    color: "#FFEDE8",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
  },
  bodyCard: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    ...Theme.shadow.md,
    flexDirection: "row",
    minHeight: 560,
  },
  mapPane: {
    width: "44%",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
    padding: 10,
  },
  mapFrame: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#CFE8FD",
    borderWidth: 1,
    borderColor: "#B7D7F8",
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  mapTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(139, 196, 243, 0.33)",
  },
  mapMarker: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    marginLeft: -12,
    marginTop: -12,
  },
  mapMarkerText: {
    fontSize: 11,
    color: "#FFF",
    fontWeight: "800",
  },
  timelinePane: {
    width: "56%",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  stopWrap: {
    marginBottom: 8,
  },
  stopCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderLeftWidth: 4,
    padding: 10,
    ...Theme.shadow.sm,
  },
  stopTime: {
    fontSize: 14,
    lineHeight: 19,
    color: Theme.colors.textPrimary,
    fontWeight: "800",
    marginBottom: 6,
  },
  stopTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stopThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  stopBody: {
    flex: 1,
    minWidth: 0,
  },
  stopTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: Theme.colors.textPrimary,
    fontWeight: "800",
  },
  stopMeta: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
  connectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  connectorText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    fontWeight: "700",
  },
  routeButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  routeButtonText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
