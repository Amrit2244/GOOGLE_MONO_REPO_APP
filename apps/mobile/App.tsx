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
  {
    id: "weigh-1040",
    slipNo: 1040,
    partyName: "Jaipur Express Highway JV",
    vehicleNumber: "RJ-14-CC-2204",
    itemName: "10mm Blue Metal",
    rate: 480,
    grossWeight: 0,
    tareWeight: 13.9,
    netWeight: 0,
    isComplete: false,
    firstTimestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    secondTimestamp: null,
    tallySynced: false,
  },
  {
    id: "weigh-1039",
    slipNo: 1039,
    partyName: "Apex Infra Projects",
    vehicleNumber: "HR-55-XY-7711",
    itemName: "20mm Aggregate",
    rate: 450,
    grossWeight: 41.2,
    tareWeight: 13.8,
    netWeight: 27.4,
    isComplete: true,
    firstTimestamp: new Date(Date.now() - 260 * 60 * 1000).toISOString(),
    secondTimestamp: new Date(Date.now() - 230 * 60 * 1000).toISOString(),
    tallySynced: true,
  },
];

// Smart default URL detection
function getDefaultApiUrl(): string {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window?.location) {
        if (window.location.port === "3000") return "/api/weighments";
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          return "http://localhost:3000/api/weighments";
        }
        if (window.location.origin) return `${window.location.origin}/api/weighments`;
      }
    } catch {
      // ignore
    }
  }
  // On physical mobile device, default to the user's host IP
  return "http://192.168.68.51:3000/api/weighments";
}

type PageTab = "dashboard" | "pending" | "completed" | "item_report";

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageTab>("dashboard");
  const [apiUrl, setApiUrl] = useState<string>(() => getDefaultApiUrl());
  const [slips, setSlips] = useState<Weighment[]>(FALLBACK_SLIPS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlip, setSelectedSlip] = useState<Weighment | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customIpInput, setCustomIpInput] = useState(apiUrl);

  // Selected item for Page 3
  const [selectedItemName, setSelectedItemName] = useState<string>("All Items");

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

  // Distinct Materials
  const distinctMaterials = useMemo(() => {
    const set = new Set<string>();
    slips.forEach((s) => {
      if (s.itemName) set.add(s.itemName);
    });
    return ["All Items", ...Array.from(set)];
  }, [slips]);

  // Overall Statistics
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

  // 1. Pending Slips (Page 1)
  const pendingSlips = useMemo(() => {
    return slips.filter((s) => !s.isComplete && matchesSearch(s, searchQuery));
  }, [slips, searchQuery]);

  // 2. Completed Slips (Page 2)
  const completedSlips = useMemo(() => {
    return slips.filter((s) => s.isComplete && matchesSearch(s, searchQuery));
  }, [slips, searchQuery]);

  const completedTotalNetWeight = useMemo(() => {
    return completedSlips.reduce((sum, s) => sum + (s.netWeight || 0), 0);
  }, [completedSlips]);

  // 3. Item-Wise Slips (Page 3)
  const itemWiseSlips = useMemo(() => {
    return slips.filter((s) => {
      const matchesItem = selectedItemName === "All Items" || s.itemName === selectedItemName;
      return matchesItem && matchesSearch(s, searchQuery);
    });
  }, [slips, selectedItemName, searchQuery]);

  const itemWiseStats = useMemo(() => {
    const completed = itemWiseSlips.filter((s) => s.isComplete);
    const totalNet = completed.reduce((sum, s) => sum + (s.netWeight || 0), 0);
    return {
      totalVehicles: itemWiseSlips.length,
      completedVehicles: completed.length,
      inPlantVehicles: itemWiseSlips.length - completed.length,
      totalNetWeightQtl: totalNet.toFixed(2),
      totalNetWeightMT: (totalNet / 10).toFixed(2),
    };
  }, [itemWiseSlips]);

  function matchesSearch(item: Weighment, query: string) {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const party = (item.partyName || "").toLowerCase();
    const vehicle = (item.vehicleNumber || "").toLowerCase();
    const itemType = (item.itemName || "").toLowerCase();
    const slip = String(item.slipNo);
    return party.includes(q) || vehicle.includes(q) || itemType.includes(q) || slip.includes(q);
  }

  // Common card renderer
  const renderWeighmentCard = (item: Weighment) => (
    <TouchableOpacity
      key={item.id}
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
          <Text style={styles.weightLabel}>
            {item.isComplete ? "NET MATERIAL WT" : "1ST RECORDED WT"}
          </Text>
          <Text
            style={[
              styles.weightValue,
              { color: item.isComplete ? "#059669" : "#d97706" },
            ]}
          >
            {item.isComplete
              ? `${item.netWeight.toFixed(2)} QTL`
              : `Tare: ${(item.tareWeight || item.grossWeight || 0).toFixed(2)} QTL`}
          </Text>
        </View>

        <View style={styles.viewSlipAction}>
          <Text style={styles.viewSlipText}>Ticket Details →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            {currentPage !== "dashboard" ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setCurrentPage("dashboard");
                }}
                style={styles.backButton}
              >
                <Text style={styles.backButtonArrow}>←</Text>
                <Text style={styles.backButtonText}>Dashboard</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.brandSubtitle}>STONE CRUSHER & MINING</Text>
            )}

            <Text style={styles.headerTitle}>
              {currentPage === "dashboard" && "Weighbridge Operations"}
              {currentPage === "pending" && "Pending Vehicles (1st Wt)"}
              {currentPage === "completed" && "Completed Vehicles"}
              {currentPage === "item_report" && "Item-Wise Weight Report"}
            </Text>
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
                Using Plant Demo Data (Tap ⚙ to connect Server)
              </Text>
            </View>
            <Text style={styles.offlineLink}>Config ⚙</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.container}>
        {/* ===================== PAGE 1: DASHBOARD ===================== */}
        {currentPage === "dashboard" && (
          <ScrollView
            style={styles.pageContent}
            contentContainerStyle={{ paddingBottom: 90 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />
            }
          >
            {/* KPI Strip */}
            <View style={styles.kpiContainer}>
              <TouchableOpacity
                style={styles.kpiCard}
                activeOpacity={0.8}
                onPress={() => setCurrentPage("item_report")}
              >
                <Text style={styles.kpiLabel}>TOTAL DISPATCH</Text>
                <Text style={styles.kpiValue}>
                  {stats.netWeightQtl} <Text style={styles.kpiUnit}>QTL</Text>
                </Text>
                <Text style={styles.kpiSub}>~{stats.netWeightMT} Tonnes →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.kpiCard, styles.kpiCardClickable]}
                activeOpacity={0.8}
                onPress={() => setCurrentPage("completed")}
              >
                <Text style={styles.kpiLabel}>COMPLETED</Text>
                <Text style={[styles.kpiValue, { color: "#059669" }]}>
                  {stats.completedCount}
                </Text>
                <Text style={styles.kpiSub}>View Vehicles →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.kpiCard, styles.kpiCardClickable, { borderColor: "#fde68a" }]}
                activeOpacity={0.8}
                onPress={() => setCurrentPage("pending")}
              >
                <Text style={styles.kpiLabel}>IN-PLANT</Text>
                <Text style={[styles.kpiValue, { color: "#d97706" }]}>
                  {stats.inPlantCount}
                </Text>
                <Text style={styles.kpiSub}>1st Wt Pending →</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Navigation Cards */}
            <View style={styles.quickNavSection}>
              <Text style={styles.sectionHeading}>OPERATIONAL MODULES</Text>

              <TouchableOpacity
                style={styles.navActionCard}
                activeOpacity={0.8}
                onPress={() => setCurrentPage("pending")}
              >
                <View style={[styles.navActionIconBox, { backgroundColor: "#fffbeb" }]}>
                  <Text style={styles.navActionIcon}>⏳</Text>
                </View>
                <View style={styles.navActionTextCol}>
                  <Text style={styles.navActionTitle}>Pending Weighments Queue</Text>
                  <Text style={styles.navActionDesc}>
                    {stats.inPlantCount} vehicles in plant awaiting 2nd weight deduction
                  </Text>
                </View>
                <Text style={styles.navActionBadgeAmber}>{stats.inPlantCount} Active</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navActionCard}
                activeOpacity={0.8}
                onPress={() => setCurrentPage("completed")}
              >
                <View style={[styles.navActionIconBox, { backgroundColor: "#ecfdf5" }]}>
                  <Text style={styles.navActionIcon}>✅</Text>
                </View>
                <View style={styles.navActionTextCol}>
                  <Text style={styles.navActionTitle}>Completed Vehicle Manifest</Text>
                  <Text style={styles.navActionDesc}>
                    {stats.completedCount} vehicles dispatched with {stats.netWeightQtl} QTL net material
                  </Text>
                </View>
                <Text style={styles.navActionBadgeGreen}>{stats.completedCount} Slips</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navActionCard}
                activeOpacity={0.8}
                onPress={() => setCurrentPage("item_report")}
              >
                <View style={[styles.navActionIconBox, { backgroundColor: "#eff6ff" }]}>
                  <Text style={styles.navActionIcon}>📦</Text>
                </View>
                <View style={styles.navActionTextCol}>
                  <Text style={styles.navActionTitle}>Material-Wise Net Weight Report</Text>
                  <Text style={styles.navActionDesc}>
                    Select item to view total net dispatched weight and total vehicles
                  </Text>
                </View>
                <Text style={styles.navActionBadgeBlue}>{distinctMaterials.length - 1} Grades</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Slips Stream */}
            <View style={styles.recentSection}>
              <Text style={styles.sectionHeading}>RECENT SCALE FEEDS</Text>
              {slips.slice(0, 5).map(renderWeighmentCard)}
            </View>
          </ScrollView>
        )}

        {/* ===================== PAGE 2: PENDING WEIGHMENTS ===================== */}
        {currentPage === "pending" && (
          <View style={styles.pageContainer}>
            {/* Search */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search pending vehicle number, party, slip..."
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

            {/* List */}
            <FlatList
              data={pendingSlips}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderWeighmentCard(item)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 110 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No Pending Vehicles</Text>
                  <Text style={styles.emptyText}>
                    All vehicles have completed their 2nd weighment.
                  </Text>
                </View>
              }
            />

            {/* AT LAST: SUMMARY FOOTER FOR PENDING VEHICLES */}
            <View style={styles.bottomSummaryBarAmber}>
              <View style={styles.summaryBarRow}>
                <View>
                  <Text style={styles.summaryBarLabelAmber}>TOTAL PENDING VEHICLES</Text>
                  <Text style={styles.summaryBarSubAmber}>Awaiting 2nd Weight in Plant</Text>
                </View>
                <View style={styles.summaryBarValueBadgeAmber}>
                  <Text style={styles.summaryBarCountAmber}>{pendingSlips.length}</Text>
                  <Text style={styles.summaryBarUnitAmber}>VEHICLES</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ===================== PAGE 3: COMPLETED WEIGHMENTS ===================== */}
        {currentPage === "completed" && (
          <View style={styles.pageContainer}>
            {/* Search */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search completed vehicle number, party, slip..."
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

            {/* List */}
            <FlatList
              data={completedSlips}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderWeighmentCard(item)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 125 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No Completed Slips</Text>
                  <Text style={styles.emptyText}>
                    No completed weighment slips found matching your search.
                  </Text>
                </View>
              }
            />

            {/* AT LAST: SUMMARY FOOTER FOR COMPLETED VEHICLES (VEHICLE COUNT + TOTAL NET WEIGHT) */}
            <View style={styles.bottomSummaryBarGreen}>
              <View style={styles.summaryBarDualRow}>
                <View style={styles.summaryDualCol}>
                  <Text style={styles.summaryBarLabelGreen}>TOTAL VEHICLES</Text>
                  <Text style={styles.summaryBarCountGreen}>
                    {completedSlips.length} <Text style={{ fontSize: 11, fontWeight: "600" }}>Vehicles</Text>
                  </Text>
                </View>

                <View style={styles.summaryDividerVert} />

                <View style={[styles.summaryDualCol, { alignItems: "flex-end" }]}>
                  <Text style={styles.summaryBarLabelGreen}>TOTAL NET WEIGHT</Text>
                  <Text style={styles.summaryBarCountGreen}>
                    {completedTotalNetWeight.toFixed(2)} <Text style={{ fontSize: 11, fontWeight: "600" }}>QTL</Text>
                  </Text>
                  <Text style={styles.summaryBarSubGreen}>
                    {(completedTotalNetWeight / 10).toFixed(2)} Metric Tonnes
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ===================== PAGE 4: ITEM-WISE REPORT ===================== */}
        {currentPage === "item_report" && (
          <View style={styles.pageContainer}>
            {/* Horizontal Item Selector Chips */}
            <View style={styles.itemSelectorContainer}>
              <Text style={styles.itemSelectorLabel}>SELECT MATERIAL GRADE:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.itemChipsScroll}
              >
                {distinctMaterials.map((mat) => {
                  const isSelected = selectedItemName === mat;
                  return (
                    <TouchableOpacity
                      key={mat}
                      onPress={() => setSelectedItemName(mat)}
                      style={[
                        styles.itemChip,
                        isSelected ? styles.itemChipActive : styles.itemChipInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.itemChipText,
                          isSelected ? styles.itemChipTextActive : styles.itemChipTextInactive,
                        ]}
                      >
                        {mat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Search within this item */}
            <View style={[styles.searchContainer, { marginTop: 6 }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={`Search vehicles carrying ${selectedItemName}...`}
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

            {/* List of vehicles with the selected item */}
            <FlatList
              data={itemWiseSlips}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderWeighmentCard(item)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 135 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No Records Found</Text>
                  <Text style={styles.emptyText}>
                    No vehicles found for material &ldquo;{selectedItemName}&rdquo;.
                  </Text>
                </View>
              }
            />

            {/* AT LAST: SUMMARY FOOTER FOR SELECTED ITEM (TOTAL VEHICLES + TOTAL NET WEIGHT) */}
            <View style={styles.bottomSummaryBarBlue}>
              <View style={styles.itemSummaryHeaderRow}>
                <Text style={styles.itemSummaryTitle} numberOfLines={1}>
                  MATERIAL: {selectedItemName.toUpperCase()}
                </Text>
              </View>

              <View style={styles.summaryBarDualRow}>
                <View style={styles.summaryDualCol}>
                  <Text style={styles.summaryBarLabelBlue}>TOTAL VEHICLES</Text>
                  <Text style={styles.summaryBarCountBlue}>
                    {itemWiseStats.totalVehicles}{" "}
                    <Text style={{ fontSize: 11, fontWeight: "600" }}>Vehicles</Text>
                  </Text>
                  <Text style={styles.summaryBarSubBlue}>
                    {itemWiseStats.completedVehicles} Complete · {itemWiseStats.inPlantVehicles} In-Plant
                  </Text>
                </View>

                <View style={styles.summaryDividerVertBlue} />

                <View style={[styles.summaryDualCol, { alignItems: "flex-end" }]}>
                  <Text style={styles.summaryBarLabelBlue}>TOTAL NET WEIGHT</Text>
                  <Text style={styles.summaryBarCountBlue}>
                    {itemWiseStats.totalNetWeightQtl}{" "}
                    <Text style={{ fontSize: 11, fontWeight: "600" }}>QTL</Text>
                  </Text>
                  <Text style={styles.summaryBarSubBlue}>
                    = {itemWiseStats.totalNetWeightMT} Metric Tonnes
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Global Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => {
            setSearchQuery("");
            setCurrentPage("dashboard");
          }}
        >
          <Text style={[styles.navTabIcon, currentPage === "dashboard" && styles.navTabIconActive]}>
            🏠
          </Text>
          <Text
            style={[styles.navTabLabel, currentPage === "dashboard" && styles.navTabLabelActive]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => {
            setSearchQuery("");
            setCurrentPage("pending");
          }}
        >
          <View style={styles.tabIconWrapper}>
            <Text style={[styles.navTabIcon, currentPage === "pending" && styles.navTabIconActive]}>
              ⏳
            </Text>
            {stats.inPlantCount > 0 && (
              <View style={styles.tabBadgeAmber}>
                <Text style={styles.tabBadgeText}>{stats.inPlantCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.navTabLabel, currentPage === "pending" && styles.navTabLabelActive]}
          >
            Pending
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => {
            setSearchQuery("");
            setCurrentPage("completed");
          }}
        >
          <View style={styles.tabIconWrapper}>
            <Text style={[styles.navTabIcon, currentPage === "completed" && styles.navTabIconActive]}>
              ✅
            </Text>
            {stats.completedCount > 0 && (
              <View style={styles.tabBadgeGreen}>
                <Text style={styles.tabBadgeText}>{stats.completedCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.navTabLabel, currentPage === "completed" && styles.navTabLabelActive]}
          >
            Completed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => {
            setSearchQuery("");
            setCurrentPage("item_report");
          }}
        >
          <Text style={[styles.navTabIcon, currentPage === "item_report" && styles.navTabIconActive]}>
            📦
          </Text>
          <Text
            style={[styles.navTabLabel, currentPage === "item_report" && styles.navTabLabelActive]}
          >
            Item Report
          </Text>
        </TouchableOpacity>
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

                  {selectedSlip.rate && selectedSlip.rate > 0 && selectedSlip.isComplete && (
                    <View style={styles.amountBox}>
                      <Text style={styles.amountLabel}>Rate: ₹{selectedSlip.rate} / QTL</Text>
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

      {/* Scale Server Settings Modal */}
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 38 : 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  backButtonArrow: {
    color: "#60a5fa",
    fontSize: 16,
    marginRight: 4,
    fontWeight: "bold",
  },
  backButtonText: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
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
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
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
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 8,
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
  pageContent: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
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
  kpiCardClickable: {
    borderWidth: 1.5,
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
    color: "#2563eb",
    marginTop: 1,
    fontWeight: "600",
  },
  quickNavSection: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  navActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  navActionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  navActionIcon: {
    fontSize: 18,
  },
  navActionTextCol: {
    flex: 1,
  },
  navActionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  navActionDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  navActionBadgeAmber: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  navActionBadgeGreen: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  navActionBadgeBlue: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  recentSection: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
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
  itemSelectorContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  itemSelectorLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  itemChipsScroll: {
    gap: 6,
    paddingBottom: 4,
  },
  itemChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  itemChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  itemChipInactive: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
  },
  itemChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  itemChipTextActive: {
    color: "#ffffff",
  },
  itemChipTextInactive: {
    color: "#475569",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 13,
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
    fontSize: 14,
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
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
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
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  weightValue: {
    fontSize: 15,
    fontWeight: "800",
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
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  // SUMMARY FOOTERS (AT LAST)
  bottomSummaryBarAmber: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    backgroundColor: "#fef3c7",
    borderTopWidth: 2,
    borderTopColor: "#f59e0b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 4,
  },
  summaryBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryBarLabelAmber: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400e",
    letterSpacing: 0.5,
  },
  summaryBarSubAmber: {
    fontSize: 10,
    color: "#b45309",
    marginTop: 1,
  },
  summaryBarValueBadgeAmber: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#fde68a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  summaryBarCountAmber: {
    fontSize: 20,
    fontWeight: "900",
    color: "#78350f",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  summaryBarUnitAmber: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
  },
  bottomSummaryBarGreen: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    backgroundColor: "#ecfdf5",
    borderTopWidth: 2,
    borderTopColor: "#10b981",
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 4,
  },
  summaryBarDualRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryDualCol: {
    flex: 1,
  },
  summaryDividerVert: {
    width: 1,
    height: 36,
    backgroundColor: "#a7f3d0",
    marginHorizontal: 12,
  },
  summaryBarLabelGreen: {
    fontSize: 10,
    fontWeight: "800",
    color: "#065f46",
    letterSpacing: 0.5,
  },
  summaryBarCountGreen: {
    fontSize: 18,
    fontWeight: "900",
    color: "#047857",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 1,
  },
  summaryBarSubGreen: {
    fontSize: 10,
    color: "#065f46",
    marginTop: 1,
  },
  bottomSummaryBarBlue: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    backgroundColor: "#eff6ff",
    borderTopWidth: 2,
    borderTopColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 4,
  },
  itemSummaryHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe",
    paddingBottom: 4,
    marginBottom: 6,
  },
  itemSummaryTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1e40af",
    letterSpacing: 0.5,
  },
  summaryDividerVertBlue: {
    width: 1,
    height: 36,
    backgroundColor: "#bfdbfe",
    marginHorizontal: 12,
  },
  summaryBarLabelBlue: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1e40af",
    letterSpacing: 0.5,
  },
  summaryBarCountBlue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1d4ed8",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 1,
  },
  summaryBarSubBlue: {
    fontSize: 10,
    color: "#2563eb",
    marginTop: 1,
  },
  // BOTTOM NAVIGATION BAR
  bottomNavBar: {
    flexDirection: "row",
    height: 56,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "space-around",
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  tabIconWrapper: {
    position: "relative",
  },
  navTabIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  navTabIconActive: {
    opacity: 1,
  },
  navTabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 2,
  },
  navTabLabelActive: {
    color: "#0f172a",
    fontWeight: "800",
  },
  tabBadgeAmber: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#d97706",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 14,
    alignItems: "center",
  },
  tabBadgeGreen: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#059669",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 14,
    alignItems: "center",
  },
  tabBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "800",
  },
  // MODAL
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
