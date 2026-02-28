import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import { tripsApi } from "../../services/api";

interface PlaceMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  tripTitle: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  attraction: Colors.common.markerAttraction,
  restaurant: Colors.common.markerRestaurant,
  cafe: Colors.common.markerCafe,
  hotel: Colors.common.markerHotel,
};

const INITIAL_REGION = {
  latitude: 36.5,
  longitude: 127.5,
  latitudeDelta: 5,
  longitudeDelta: 5,
};

export default function MapScreen() {
  const [markers, setMarkers] = useState<PlaceMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<PlaceMarker | null>(null);

  const loadMarkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tripsApi.list();
      const trips = res.data.trips ?? [];
      const allMarkers: PlaceMarker[] = [];

      for (const trip of trips) {
        const days = (trip as any).days ?? [];
        for (const day of days) {
          const places = (day as any).places ?? [];
          for (const place of places) {
            if (place.lat && place.lng) {
              allMarkers.push({
                id: place.id,
                name: place.name,
                lat: place.lat,
                lng: place.lng,
                category: place.category ?? "attraction",
                tripTitle: (trip as any).title ?? "여행",
              });
            }
          }
        }
      }

      setMarkers(allMarkers);
    } catch {
      setMarkers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMarkers(); }, [loadMarkers]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 여행 지도</Text>
        <Text style={styles.headerSub}>
          {markers.length > 0 ? `${markers.length}곳 표시 중` : "저장된 장소가 없습니다"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.young.primary} />
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={INITIAL_REGION}
          showsUserLocation
          showsMyLocationButton
          provider={PROVIDER_GOOGLE}
        >
          {markers.map((m) => (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              title={m.name}
              description={`${m.tripTitle} · ${m.category}`}
              pinColor={CATEGORY_COLORS[m.category] ?? Colors.young.primary}
              onPress={() => setSelectedMarker(m)}
            />
          ))}
        </MapView>
      )}

      {selectedMarker && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View
              style={[styles.infoDot, { backgroundColor: CATEGORY_COLORS[selectedMarker.category] ?? Colors.young.primary }]}
            />
            <Text style={styles.infoTitle}>{selectedMarker.name}</Text>
          </View>
          <Text style={styles.infoSub}>{selectedMarker.tripTitle}</Text>
          <Text style={styles.infoCoord}>
            {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}
          </Text>
          <TouchableOpacity style={styles.infoClose} onPress={() => setSelectedMarker(null)}>
            <Text style={styles.infoCloseText}>닫기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    paddingTop: 60, paddingHorizontal: Spacing.screenPadding, paddingBottom: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: Colors.common.gray100,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.common.black },
  headerSub: { fontSize: 13, color: Colors.common.gray500, marginTop: 4 },
  map: { flex: 1 },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  infoCard: {
    position: "absolute", bottom: 100, left: Spacing.screenPadding, right: Spacing.screenPadding,
    backgroundColor: "#FFF", borderRadius: 20, padding: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoDot: { width: 10, height: 10, borderRadius: 5 },
  infoTitle: { ...Typography.normal.body, fontWeight: "700", color: Colors.common.gray800 },
  infoSub: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 4 },
  infoCoord: { ...Typography.normal.caption, color: Colors.common.gray400, marginTop: 2 },
  infoClose: { marginTop: 12, alignSelf: "flex-end" },
  infoCloseText: { ...Typography.normal.bodySmall, color: Colors.young.primary, fontWeight: "700" },
});
