import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Marker } from "react-native-maps";

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
  hotel: Colors.common.markerHotel
};

const INITIAL_REGION = {
  latitude: 36.5,
  longitude: 127.5,
  latitudeDelta: 5,
  longitudeDelta: 5
};

export default function TabMapViewNative() {
  const [markers, setMarkers] = useState<PlaceMarker[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMarkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tripsApi.list();
      const trips = res.data.trips ?? [];
      const allMarkers: PlaceMarker[] = [];

      for (const trip of trips) {
        const days = (trip as { days?: Array<{ places?: Array<Record<string, unknown>> }> }).days ?? [];
        for (const day of days) {
          const places = day.places ?? [];
          for (const place of places) {
            if (typeof place.lat === "number" && typeof place.lng === "number") {
              allMarkers.push({
                id: String(place.id ?? `${trip.id}-${place.name}`),
                name: String(place.name ?? "장소"),
                lat: place.lat,
                lng: place.lng,
                category: String(place.category ?? "attraction"),
                tripTitle: String((trip as { title?: string }).title ?? "여행")
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

  useEffect(() => {
    void loadMarkers();
  }, [loadMarkers]);

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
        <MapView style={styles.map} initialRegion={INITIAL_REGION} showsUserLocation showsMyLocationButton>
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.lat, longitude: marker.lng }}
              title={marker.name}
              description={`${marker.tripTitle} · ${marker.category}`}
              pinColor={CATEGORY_COLORS[marker.category] ?? Colors.young.primary}
            />
          ))}
        </MapView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: Colors.common.gray100
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.common.black },
  headerSub: { ...Typography.normal.caption, color: Colors.common.gray500, marginTop: 4 },
  map: { flex: 1 },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" }
});
