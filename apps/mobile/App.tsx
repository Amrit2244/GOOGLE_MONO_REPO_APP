import React, { useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";

export type Weighment = {
  id: string;
  slipNo: number;
  partyName: string;
  vehicleNumber: string;
  itemName: string;
  rate?: number;
  grossWeight?: number;
  tareWeight?: number;
  netWeight: number;
  isComplete: boolean;
  firstTimestamp: string;
  secondTimestamp?: string | null;
  tallySynced?: boolean;
};

// Fallback operational slips if local network API is unreachable
const FALLBACK_SLIPS: Weighment[] = [
  {
    id: "weigh-1045",
    slipNo: 1045,
    partyName: "Shree Ram Construction Ltd",
    vehicleNumber: "RJ-14-GA-8821",
    itemName: "10mm Blue Metal",
    rate: 480,
    grossWeight: 44.85,
    tareWeight: 14.2,
    netWeight: 30.65,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    secondTimestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    tallySynced: false,
  },
  {
    id: "weigh-1044",
    slipNo: 1044,
    partyName: "Apex Infra Projects",
    vehicleNumber: "DL-1L-AA-3490",
    itemName: "20mm Aggregate",
    rate: 450,
    grossWeight: 39.4,
    tareWeight: 13.1,
    netWeight: 26.3,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    secondTimestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    tallySynced: true,
  },
  {
    id: "weigh-1043",
    slipNo: 1043,
    partyName: "National Highway Authority (NHAI)",
    vehicleNumber: "HR-26-BR-9012",
    itemName: "GSB Grade-1",
    rate: 340,
    grossWeight: 52.1,
    tareWeight: 16.4,
    netWeight: 35.7,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    secondTimestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    tallySynced: true,
  },
  {
    id: "weigh-1042",
    slipNo: 1042,
    partyName: "Balaji Builders & Developers",
    vehicleNumber: "UP-16-BT-4521",
    itemName: "Stone Dust / M-Sand",
    rate: 390,
    grossWeight: 0,
    tareWeight: 12.8,
    netWeight: 0,
    isComplete: false,
    firstTimestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    secondTimestamp: null,
    tallySynced: false,
  },
  {
    id: "weigh-1041",
    slipNo: 1041,
    partyName: "Kundan Stones & Mining",
    vehicleNumber: "RJ-02-GB-1178",
    itemName: "40mm Ballast",
    rate: 410,
    grossWeight: 48.2,
    tareWeight: 15.6,
    netWeight: 32.6,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 200 * 60 * 1000).toISOString(),
    secondTimestamp: new Date(Date.now() - 170 * 60 * 1000).toISOString(),
    tallySynced: false,
  },
];

// Smart default URL detection
function getDefaultApiUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    if (window.location.port === "3000") {
      return "/api/weighments";
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:3000/api/weighments";
    }
    if (window.location.origin && window.location.origin.startsWith("http")) {
      return `${window.location.origin}/api/weighments`;
    }
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000/api/weighments";
  }
  return "http://localhost:3000/api/weighments";
}

export default function App() {
  const [apiUrl, setApiUrl] = useState<string>(() => getDefaultApiUrl());
  const [slips, setSlips] = useState<Weighment[]>(FALLBACK_SLIPS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "complete" | "pending">("all");
  const [selectedSlip, setSelectedSlip] = useState<Weighment | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customIpInput, setCustomIpInput] = useState(apiUrl);

  const fetchSlips = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setSlips(data);
        setIsOfflineMode(false);
      } else {
        setSlips(FALLBACK_SLIPS);
        setIsOfflineMode(false);
      }
    } catch {
      // Gracefully switch to fallback operational slips without crashing or red screens
      setIsOfflineMode(true);
      setSlips((prev) => (prev && prev.length > 0 ? prev : FALLBACK_SLIPS));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSlips();
  }, [apiUrl]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSlips();
  };

  // Filtered weighments
  const filteredSlips = useMemo(() => {
    return slips.filter((item) => {
      if (statusFilter === "complete" && !item.isComplete) return false;
      if (statusFilter === "pending" && item.isComplete) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const party = (item.partyName || "").toLowerCase();
        const vehicle = (item.vehicleNumber || "").toLowerCase();
        const itemType = (item.itemName || "").toLowerCase();
        const slip = String(item.slipNo);
        return party.includes(q) || vehicle.includes(q) || itemType.includes(q) || slip.includes(q);
      }
      return true;
    });
  }, [slips, statusFilter, searchQuery]);

  // Aggregate KPI stats
  const stats = useMemo(() => {
    const completed = slips.filter((s) => s.isComplete);
    const inPlant = slips.filter((s) => !s.isComplete);
    const totalNetWeight = completed.reduce((sum, s) => sum + (s.netWeight || 0), 0);
    return {
      total: slips.length,
      completedCount: completed.length,
      inPlantCount: inPlant.length,
      netWeightQtl: totalNetWeight.toFixed(1),
      netWeightMT: (totalNetWeight / 10).toFixed(1),
    };
  }, [slips]);

  const renderItem = ({ item }: { item: Weighment }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setSelectedSlip(item)}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <View style={styles.slipNumberRow}>
          <Text style={styles.slipNo}>#{item.slipNo}</Text>
          <Text style={styles.slipTime}>
            {new Date(item.firstTimestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <View
          style={[
            styles.badge,
            item.isComplete ? styles.badgeComplete : styles.badgePending,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              item.isComplete ? styles.badgeTextComplete : styles.badgeTextPending,
            ]}
          >
            {item.isComplete ? "COMPLETE" : "1ST WT ONLY"}
          </Text>
        </View>
      </View>

      <Text style={styles.partyName} numberOfLines={1}>
        {item.partyName}
      </Text>

      <View style={styles.detailsRow}>
        <View style={styles.vehiclePlate}>
          <Text style={styles.vehiclePlateText}>{item.vehicleNumber}</Text>
        </View>
        <Text style={styles.itemTag}>{item.itemName}</Text>
      </View>

      <View style={styles.weightRow}>
        <View>
          <Text style={styles.weightLabel}>NET WEIGHT</Text>
          <Text style={styles.weightValue}>
            {item.isComplete ? `${item.netWeight.toFixed(2)} QTL` : "Pending 2nd Wt"}
          </Text>
        </View>

        <View style={styles.viewSlipAction}>
          <Text style={styles.viewSlipText}>View Slip →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Industrial Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.brandSubtitle}>STONE CRUSHER & MINING</Text>
            <Text style={styles.headerTitle}>Weighbridge Monitor</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              setCustomIpInput(apiUrl);
              setIsSettingsOpen(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Offline / Demo Notice Bar */}
        {isOfflineMode && (
          <TouchableOpacity
            style={styles.offlineNotice}
            onPress={() => {
              setCustomIpInput(apiUrl);
              setIsSettingsOpen(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.offlineLeft}>
              <Text style={styles.offlineDot}>●</Text>
              <Text style={styles.offlineText} numberOfLines={1}>
                Using Plant Demo Data (Tap to set Server IP)
              </Text>
            </View>
            <Text style={styles.offlineLink}>Config ⚙</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.container}>
        {/* KPI Strip */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL DISPATCH</Text>
            <Text style={styles.kpiValue}>
              {stats.netWeightQtl} <Text style={styles.kpiUnit}>QTL</Text>
            </Text>
            <Text style={styles.kpiSub}>~{stats.netWeightMT} Tonnes</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>COMPLETED</Text>
            <Text style={[styles.kpiValue, { color: "#059669" }]}>
              {stats.completedCount}
            </Text>
            <Text style={styles.kpiSub}>Dispatched</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>IN-PLANT</Text>
            <Text style={[styles.kpiValue, { color: "#d97706" }]}>
              {stats.inPlantCount}
            </Text>
            <Text style={styles.kpiSub}>1st Wt Pending</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search party, vehicle, slip #..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Segmented Filter Pills */}
        <View style={styles.filterPills}>
          <TouchableOpacity
            style={[
              styles.pill,
              statusFilter === "all" ? styles.pillActive : styles.pillInactive,
            ]}
            onPress={() => setStatusFilter("all")}
          >
            <Text
              style={[
                styles.pillText,
                statusFilter === "all" ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              All Slips ({slips.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pill,
              statusFilter === "complete" ? styles.pillActive : styles.pillInactive,
            ]}
            onPress={() => setStatusFilter("complete")}
          >
            <Text
              style={[
                styles.pillText,
                statusFilter === "complete" ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              Completed ({stats.completedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pill,
              statusFilter === "pending" ? styles.pillActive : styles.pillInactive,
            ]}
            onPress={() => setStatusFilter("pending")}
          >
            <Text
              style={[
                styles.pillText,
                statusFilter === "pending" ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              In-Plant ({stats.inPlantCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Weighments List */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0f172a" />
            <Text style={styles.loadingText}>Connecting to weighbridge scale...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredSlips}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#0f172a"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Weighments Found</Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? `No slips match "${searchQuery}"`
                    : "No weighments logged in this category yet."}
                </Text>
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={() => setSearchQuery("")}
                  >
                    <Text style={styles.resetButtonText}>Clear Search</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>

      {/* Digital Weighbridge Slip Modal */}
      <Modal
        visible={!!selectedSlip}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSlip(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>WEIGHBRIDGE SLIP #{selectedSlip?.slipNo}</Text>
              <TouchableOpacity onPress={() => setSelectedSlip(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedSlip && (
              <ScrollView style={styles.modalBody}>
                {/* Printable Slip Ticket */}
                <View style={styles.slipTicket}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketPlantName}>SHREE BALAJI CRUSHER</Text>
                    <Text style={styles.ticketSub}>Electronic Weighbridge Manifest</Text>
                    <Text style={styles.ticketCapacity}>Capacity: 100 MT | Pitless Scale</Text>
                  </View>

                  <View style={styles.ticketDivider} />

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Slip Number:</Text>
                    <Text style={styles.ticketValueBold}>#{selectedSlip.slipNo}</Text>
                  </View>

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Status:</Text>
                    <Text
                      style={[
                        styles.ticketValueBold,
                        { color: selectedSlip.isComplete ? "#059669" : "#d97706" },
                      ]}
                    >
                      {selectedSlip.isComplete ? "COMPLETE" : "1ST WT ONLY"}
                    </Text>
                  </View>

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Vehicle No:</Text>
                    <Text style={styles.ticketPlate}>{selectedSlip.vehicleNumber}</Text>
                  </View>

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Customer:</Text>
                    <Text style={styles.ticketValue} numberOfLines={2}>
                      {selectedSlip.partyName}
                    </Text>
                  </View>

                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Material:</Text>
                    <Text style={styles.ticketValue}>{selectedSlip.itemName}</Text>
                  </View>

                  <View style={styles.ticketDivider} />

                  {/* Weights Box */}
                  <View style={styles.ticketWeightBox}>
                    <View style={styles.weightLine}>
                      <Text style={styles.weightLabelLine}>Gross Weight:</Text>
                      <Text style={styles.weightValLine}>
                        {selectedSlip.grossWeight ? selectedSlip.grossWeight.toFixed(2) : "0.00"} QTL
                      </Text>
                    </View>

                    <View style={styles.weightLine}>
                      <Text style={styles.weightLabelLine}>Tare (Empty) Wt:</Text>
                      <Text style={styles.weightValLine}>
                        {selectedSlip.tareWeight ? selectedSlip.tareWeight.toFixed(2) : "0.00"} QTL
                      </Text>
                    </View>

                    <View style={[styles.weightLine, styles.netWeightLine]}>
                      <Text style={styles.netWeightLabel}>NET MATERIAL:</Text>
                      <Text style={styles.netWeightVal}>
                        {selectedSlip.isComplete
                          ? `${selectedSlip.netWeight.toFixed(2)} QTL`
                          : "PENDING"}
                      </Text>
                    </View>

                    {selectedSlip.isComplete && (
                      <Text style={styles.tonnesText}>
                        = {(selectedSlip.netWeight / 10).toFixed(2)} Metric Tonnes (MT)
                      </Text>
                    )}
                  </View>

                  {/* Rate / Amount if available */}
                  {selectedSlip.rate && selectedSlip.rate > 0 && selectedSlip.isComplete && (
                    <View style={styles.amountBox}>
                      <Text style={styles.amountLabel}>
                        Rate: ₹{selectedSlip.rate} / QTL
                      </Text>
                      <Text style={styles.amountVal}>
                        Amount: ₹{(selectedSlip.netWeight * selectedSlip.rate).toFixed(0)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.timestampBox}>
                    <Text style={styles.timestampText}>
                      1st Wt: {new Date(selectedSlip.firstTimestamp).toLocaleString()}
                    </Text>
                    {selectedSlip.secondTimestamp && (
                      <Text style={styles.timestampText}>
                        2nd Wt: {new Date(selectedSlip.secondTimestamp).toLocaleString()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.signatureRow}>
                    <Text style={styles.signLine}>Driver Signature</Text>
                    <Text style={styles.signLine}>Operator Signature</Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseButtonFull}
                onPress={() => setSelectedSlip(null)}
              >
                <Text style={styles.modalCloseButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* API Endpoint Configuration Modal */}
      <Modal
        visible={isSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsModalTitle}>Scale Server Connection</Text>
            <Text style={styles.settingsDesc}>
              Select a quick preset or enter your weighbridge server URL:
            </Text>

            {/* Quick Presets */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setCustomIpInput("http://localhost:3000/api/weighments")}
              >
                <Text style={styles.presetChipText}>Localhost:3000</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setCustomIpInput("http://10.0.2.2:3000/api/weighments")}
              >
                <Text style={styles.presetChipText}>Android (10.0.2.2)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setCustomIpInput("/api/weighments")}
              >
                <Text style={styles.presetChipText}>Same Host (/api)</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.settingsInput}
              value={customIpInput}
              onChangeText={setCustomIpInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.x.x:3000/api/weighments"
            />

            <View style={styles.settingsActions}>
              <TouchableOpacity
                style={styles.settingsResetBtn}
                onPress={() => {
                  const def = getDefaultApiUrl();
                  setCustomIpInput(def);
                  setApiUrl(def);
                  setIsSettingsOpen(false);
                }}
              >
                <Text style={styles.settingsResetText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsSaveBtn}
                onPress={() => {
                  setApiUrl(customIpInput.trim());
                  setIsSettingsOpen(false);
                  setLoading(true);
                  fetchSlips();
                }}
              >
                <Text style={styles.settingsSaveText}>Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 40 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  settingsIcon: {
    color: "#ffffff",
    fontSize: 18,
  },
  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(217, 119, 6, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
  },
  offlineLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  offlineDot: {
    color: "#f59e0b",
    fontSize: 10,
    marginRight: 6,
  },
  offlineText: {
    color: "#fef3c7",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  offlineLink: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 6,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  kpiContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  kpiUnit: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  kpiSub: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    height: 42,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "bold",
  },
  filterPills: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  pillInactive: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#ffffff",
  },
  pillTextInactive: {
    color: "#475569",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  slipNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  slipNo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  slipTime: {
    fontSize: 11,
    color: "#64748b",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeComplete: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  badgePending: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeTextComplete: {
    color: "#065f46",
  },
  badgeTextPending: {
    color: "#92400e",
  },
  partyName: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "700",
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  vehiclePlate: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  vehiclePlateText: {
    fontSize: 13,
    color: "#0f172a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  itemTag: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  weightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  weightLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  weightValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#059669",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  viewSlipAction: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
  },
  viewSlipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 13,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  resetButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#0f172a",
    borderRadius: 6,
  },
  resetButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    maxHeight: "88%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "bold",
  },
  modalBody: {
    padding: 14,
  },
  slipTicket: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#94a3b8",
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  ticketHeader: {
    alignItems: "center",
    marginBottom: 8,
  },
  ticketPlantName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  ticketSub: {
    fontSize: 11,
    color: "#475569",
    marginTop: 1,
  },
  ticketCapacity: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
  },
  ticketDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 8,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  ticketLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  ticketValue: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  ticketValueBold: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  ticketPlate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  ticketWeightBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    borderRadius: 6,
    marginVertical: 8,
  },
  weightLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  weightLabelLine: {
    fontSize: 12,
    color: "#475569",
  },
  weightValLine: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  netWeightLine: {
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 6,
    marginTop: 4,
  },
  netWeightLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  netWeightVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#059669",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  tonnesText: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "right",
    marginTop: 2,
  },
  amountBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  amountLabel: {
    fontSize: 12,
    color: "#475569",
  },
  amountVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  timestampBox: {
    marginTop: 8,
    paddingTop: 6,
  },
  timestampText: {
    fontSize: 10,
    color: "#64748b",
    lineHeight: 14,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  signLine: {
    fontSize: 10,
    color: "#64748b",
  },
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  modalCloseButtonFull: {
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  settingsModal: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 18,
  },
  settingsModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  settingsDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 17,
    marginBottom: 10,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  settingsInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 16,
  },
  settingsActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  settingsResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  settingsResetText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  settingsSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#0f172a",
  },
  settingsSaveText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
});
