import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";

// ⚠️ REPLACE THIS IP WITH YOUR COMPUTER's IPv4 ADDRESS
const API_URL = "http://192.168.68.50:3000/api/weighments";

type Weighment = {
  id: string;
  slipNo: number;
  partyName: string;
  vehicleNumber: string;
  itemName: string;
  netWeight: number;
  isComplete: boolean;
  firstTimestamp: string;
};

export default function App() {
  const [slips, setSlips] = useState<Weighment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSlips = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      setSlips(data);
    } catch (error) {
      console.error("Error fetching slips:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSlips();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSlips();
  };

  const renderItem = ({ item }: { item: Weighment }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.slipNo}>Slip #{item.slipNo}</Text>
        <View
          style={[
            styles.badge,
            item.isComplete ? styles.badgeComplete : styles.badgePending,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              item.isComplete
                ? styles.badgeTextComplete
                : styles.badgeTextPending,
            ]}
          >
            {item.isComplete ? "COMPLETE" : "1ST WT"}
          </Text>
        </View>
      </View>
      <Text style={styles.partyName}>{item.partyName}</Text>
      <View style={styles.detailsRow}>
        <Text style={styles.vehicle}>{item.vehicleNumber}</Text>
        <Text style={styles.item}>{item.itemName}</Text>
      </View>
      <View style={styles.weightRow}>
        <Text style={styles.weightLabel}>Net Weight:</Text>
        <Text style={styles.weightValue}>
          {item.isComplete ? `${item.netWeight.toFixed(2)} QTL` : "--"}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Weighments</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : (
        <FlatList
          data={slips}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No slips found.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: {
    backgroundColor: "#1f2937",
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: "center",
  },
  headerTitle: { color: "#ffffff", fontSize: 20, fontWeight: "bold" },
  loader: { marginTop: 50 },
  list: { padding: 16 },
  card: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  slipNo: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeComplete: { backgroundColor: "#d1fae5" },
  badgePending: { backgroundColor: "#fef3c7" },
  badgeText: { fontSize: 10, fontWeight: "bold" },
  badgeTextComplete: { color: "#065f46" },
  badgeTextPending: { color: "#92400e" },
  partyName: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  vehicle: { fontSize: 14, color: "#6b7280", fontFamily: "monospace" },
  item: { fontSize: 14, color: "#6b7280" },
  weightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 12,
  },
  weightLabel: { fontSize: 14, color: "#4b5563" },
  weightValue: { fontSize: 16, fontWeight: "bold", color: "#059669" },
  emptyText: { textAlign: "center", color: "#6b7280", marginTop: 20 },
});
