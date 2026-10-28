import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  Animated,
  Vibration,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { Audio } from "expo-av";

let LocalAuthentication: any = null;
try {
  LocalAuthentication = require("expo-local-authentication");
} catch {}

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

function getDefaultApiUrl(): string {
  return "https://list-introductory-estimates-zoning.trycloudflare.com/api/weighments";
}

type PageTab = "dashboard" | "pending" | "completed" | "item_report";

function ASLogo({
  size = 38,
  isLock = false,
}: {
  size?: number;
  isLock?: boolean;
}) {
  return (
    <View
      style={[
        styles.asBadge,
        { width: size, height: size, borderRadius: isLock ? 20 : 12 },
        isLock && styles.asBadgeLock,
      ]}
    >
      <View style={styles.asLettersContainer}>
        <Text style={[styles.asLetterA, isLock && styles.asLetterALock]}>
          A
        </Text>
        <Text style={[styles.asLetterS, isLock && styles.asLetterSLock]}>
          S
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageTab>("dashboard");
  const [apiUrl, setApiUrl] = useState<string>(() => getDefaultApiUrl());
  const [slips, setSlips] = useState<Weighment[]>([]);
  const prevSlipsCount = useRef({ pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  // Security State
  const [isLocked, setIsLocked] = useState(true);
  const [masterPin, setMasterPin] = useState("1234");
  const [enteredPin, setEnteredPin] = useState("");
  const [isPinLockEnabled, setIsPinLockEnabled] = useState(true);
  const [pinError, setPinError] = useState("");
  const [isBioScanning, setIsBioScanning] = useState(false);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlip, setSelectedSlip] = useState<Weighment | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customIpInput, setCustomIpInput] = useState(apiUrl);
  const [selectedItemName, setSelectedItemName] = useState<string>("All Items");
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // 1. OTA Internet Update Checker
  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Updates.reloadAsync();
        }
      } catch (error) {
        console.log("No OTA updates available or running in dev mode.");
      }
    }
    if (Platform.OS !== "web") checkForUpdates();
  }, []);

  const triggerShake = () => {
    if (Platform.OS !== "web") {
      try {
        Vibration.vibrate(200);
      } catch {}
    }
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const showNotification = (message: string) => {
    setToastMessage(message);
    Animated.timing(toastAnim, {
      toValue: 50,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setToastMessage(null));
    }, 3500);
  };

  const playBeepSound = async () => {
    try {
      Vibration.vibrate([0, 200, 100, 200]);
      const { sound } = await Audio.Sound.createAsync(
        require("./assets/beep.mp3"),
      );
      await sound.playAsync();
    } catch (e) {
      console.log("Add beep.mp3 to assets to hear sound.");
    }
  };

  // 2. FIXED Biometric Authentication Bug
  const handleBiometricAuth = async () => {
    setIsBioScanning(true);
    setPinError("");
    if (LocalAuthentication) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Scan Fingerprint to Unlock Dharamkanta Pro",
            cancelLabel: "Use 4-Digit PIN",
            fallbackLabel: "Enter PIN",
            disableDeviceFallback: false,
          });
          if (result.success) {
            setIsLocked(false);
            setEnteredPin("");
            setIsBioScanning(false);
            return;
          }
        }
      } catch {}
    }
    // Bug Fix: Previously this forced an unlock on failure. Now it remains locked.
    setIsBioScanning(false);
    triggerShake();
    setPinError("Biometric Failed. Use PIN.");
  };

  useEffect(() => {
    if (isLocked && isPinLockEnabled) {
      const timer = setTimeout(() => handleBiometricAuth(), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDigitPress = (digit: string) => {
    setPinError("");
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + digit;
      setEnteredPin(nextPin);
      if (nextPin.length === 4) {
        if (nextPin === masterPin) {
          setTimeout(() => {
            setIsLocked(false);
            setEnteredPin("");
          }, 150);
        } else {
          setTimeout(() => {
            triggerShake();
            setPinError("Incorrect PIN");
            setEnteredPin("");
          }, 200);
        }
      }
    }
  };

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

      if (Array.isArray(data)) {
        setSlips(data);
        setIsOfflineMode(false);

        // 3. Detect New Weighments & Trigger Notifications
        const newPending = data.filter((s: Weighment) => !s.isComplete).length;
        const newCompleted = data.filter((s: Weighment) => s.isComplete).length;

        if (
          prevSlipsCount.current.pending > 0 ||
          prevSlipsCount.current.completed > 0
        ) {
          if (newPending > prevSlipsCount.current.pending) {
            playBeepSound();
            showNotification("🚨 New Vehicle Entered: 1st Weight Captured");
          } else if (newCompleted > prevSlipsCount.current.completed) {
            playBeepSound();
            showNotification("✅ Slip Completed: 2nd Weight Saved");
          }
        }
        prevSlipsCount.current = {
          pending: newPending,
          completed: newCompleted,
        };
      }
    } catch {
      setIsOfflineMode(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSlips();
    const interval = setInterval(fetchSlips, 10000);
    return () => clearInterval(interval);
  }, [apiUrl]);
  const onRefresh = () => {
    setRefreshing(true);
    fetchSlips();
  };

  const distinctMaterials = useMemo(() => {
    const set = new Set<string>();
    slips.forEach((s) => {
      if (s.itemName) set.add(s.itemName);
    });
    return ["All Items", ...Array.from(set)];
  }, [slips]);

  const metrics = useMemo(() => {
    const completed = slips.filter((s) => s.isComplete);
    const pending = slips.filter((s) => !s.isComplete);
    const totalNetWeight = completed.reduce(
      (acc, curr) => acc + (curr.netWeight || 0),
      0,
    );
    const totalAmount = completed.reduce(
      (acc, curr) => acc + (curr.netWeight || 0) * (curr.rate || 420),
      0,
    );
    return {
      totalSlips: slips.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      totalNetQuintals: (totalNetWeight * 10).toFixed(2),
      totalAmountFormatted: totalAmount.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      }),
    };
  }, [slips]);

  const filteredCompletedSlips = useMemo(() => {
    return slips
      .filter((s) => s.isComplete)
      .filter((s) => {
        const matchesSearch =
          s.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.slipNo.toString().includes(searchQuery);
        const matchesItem =
          selectedItemName === "All Items" || s.itemName === selectedItemName;
        return matchesSearch && matchesItem;
      });
  }, [slips, searchQuery, selectedItemName]);

  const filteredPendingSlips = useMemo(
    () => slips.filter((s) => !s.isComplete),
    [slips],
  );

  if (isLocked && isPinLockEnabled) {
    return (
      <SafeAreaView style={styles.lockContainer}>
        <StatusBar style="light" />
        <View style={styles.lockHeader}>
          <ASLogo size={70} isLock />
          <Text style={styles.lockBrandTitle}>AS DHARAMKANTA</Text>
          <Text style={styles.lockSubtitle}>
            Protected Terminal Authentication
          </Text>
        </View>

        <Animated.View
          style={[
            styles.pinDisplayContainer,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          <Text style={styles.pinInstruction}>Enter Security PIN</Text>
          <View style={styles.pinDotsRow}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = enteredPin.length > index;
              return (
                <View
                  key={index}
                  style={[
                    styles.pinDot,
                    isFilled && styles.pinDotFilled,
                    pinError ? styles.pinDotError : null,
                  ]}
                >
                  {isFilled && <View style={styles.pinDotCore} />}
                </View>
              );
            })}
          </View>
          {pinError ? (
            <Text style={styles.pinErrorText}>{pinError}</Text>
          ) : (
            <Text style={styles.pinHintText}>Tap fingerprint or enter PIN</Text>
          )}
        </Animated.View>

        <View style={styles.keypadGrid}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
          ].map((row, i) => (
            <View key={i} style={styles.keypadRow}>
              {row.map((digit) => (
                <TouchableOpacity
                  key={digit}
                  style={styles.keypadButton}
                  onPress={() => handleDigitPress(digit)}
                >
                  <Text style={styles.keypadNumber}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.keypadButton, styles.bioButton]}
              onPress={handleBiometricAuth}
            >
              <Text style={styles.bioIcon}>👆</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keypadButton}
              onPress={() => handleDigitPress("0")}
            >
              <Text style={styles.keypadNumber}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keypadButton}
              onPress={() => setEnteredPin(enteredPin.slice(0, -1))}
            >
              <Text style={styles.deleteIcon}>⌫</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={styles.quickUnlockBtn}
          onPress={() => {
            setIsLocked(false);
            setEnteredPin("");
          }}
        >
          <Text style={styles.quickUnlockText}>Quick Unlock (Dev)</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Dynamic Toast Notification */}
      <Animated.View
        style={[
          styles.toastContainer,
          { transform: [{ translateY: toastAnim }] },
        ]}
      >
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <ASLogo size={40} />
            <View>
              <Text style={styles.brandSubtitle}>STONE CRUSHER AUTOMATION</Text>
              <Text style={styles.headerTitle}>DHARAMKANTA PRO</Text>
            </View>
          </View>
          <View style={styles.headerActionsRow}>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => setIsLocked(true)}
            >
              <Text style={styles.headerActionIcon}>🔒</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => setIsSettingsOpen(true)}
            >
              <Text style={styles.headerActionIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.statusStrip}>
          <View style={styles.statusItemLeft}>
            <View
              style={[
                styles.livePulseDot,
                isOfflineMode && styles.offlinePulseDot,
              ]}
            />
            <Text style={styles.statusStripText}>
              {isOfflineMode ? "OFFLINE / LOCAL" : "LIVE CONNECTED"}
            </Text>
          </View>
          <Text style={styles.todayDateText}>
            {new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
      </View>

      <View style={styles.contentArea}>
        {currentPage === "dashboard" && (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#00E676"
              />
            }
          >
            <View style={styles.globalTotalsBar}>
              <View style={styles.globalTotalItem}>
                <Text style={styles.globalTotalLabel}>TODAY'S NET WEIGHT</Text>
                <Text style={styles.globalTotalValue}>
                  {metrics.totalNetQuintals} Qtl
                </Text>
              </View>
              <View style={styles.globalTotalDivider} />
              <View style={styles.globalTotalItem}>
                <Text style={styles.globalTotalLabel}>ESTIMATED REVENUE</Text>
                <Text style={styles.globalTotalValue}>
                  ₹{metrics.totalAmountFormatted}
                </Text>
              </View>
            </View>

            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { borderColor: "#00E676" }]}>
                <Text style={styles.kpiLabel}>DISPATCHED SLIPS</Text>
                <Text style={styles.kpiValueLarge}>
                  {metrics.completedCount}
                </Text>
              </View>
              <View style={[styles.kpiCard, { borderColor: "#4DA8DA" }]}>
                <Text style={styles.kpiLabel}>PENDING TRUCKS</Text>
                <Text style={styles.kpiValueLarge}>{metrics.pendingCount}</Text>
              </View>
            </View>

            <View style={styles.recentSection}>
              <Text style={styles.sectionHeaderTitle}>RECENT SLIPS</Text>
              {slips.length === 0 ? (
                <Text style={styles.emptyText}>No weighment data found.</Text>
              ) : (
                slips
                  .slice(0, 4)
                  .map((slip) => (
                    <SlipCard
                      key={slip.id}
                      slip={slip}
                      onViewSlip={() => setSelectedSlip(slip)}
                    />
                  ))
              )}
            </View>
          </ScrollView>
        )}

        {currentPage === "pending" && (
          <View style={styles.tabContent}>
            <FlatList
              data={filteredPendingSlips}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#4DA8DA"
                />
              }
              contentContainerStyle={styles.listScrollContent}
              renderItem={({ item }) => (
                <SlipCard
                  slip={item}
                  onViewSlip={() => setSelectedSlip(item)}
                />
              )}
            />
          </View>
        )}

        {currentPage === "completed" && (
          <View style={styles.tabContent}>
            <View style={styles.searchBarWrapper}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search Truck, Party, Slip..."
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <FlatList
              data={filteredCompletedSlips}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#00E676"
                />
              }
              contentContainerStyle={styles.listScrollContent}
              renderItem={({ item }) => (
                <SlipCard
                  slip={item}
                  onViewSlip={() => setSelectedSlip(item)}
                />
              )}
            />
          </View>
        )}
      </View>

      <View style={styles.bottomNavBar}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentPage("dashboard")}
        >
          <Text
            style={[
              styles.navTabIcon,
              currentPage === "dashboard" && styles.navTabIconActive,
            ]}
          >
            📊
          </Text>
          <Text
            style={[
              styles.navTabLabel,
              currentPage === "dashboard" && styles.navTabLabelActive,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentPage("pending")}
        >
          <View style={styles.tabIconWrapper}>
            <Text
              style={[
                styles.navTabIcon,
                currentPage === "pending" && styles.navTabIconActive,
              ]}
            >
              🚛
            </Text>
            {metrics.pendingCount > 0 && (
              <View style={styles.tabBadgeAmber}>
                <Text style={styles.tabBadgeText}>{metrics.pendingCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.navTabLabel,
              currentPage === "pending" && styles.navTabLabelActive,
            ]}
          >
            In-Plant
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentPage("completed")}
        >
          <Text
            style={[
              styles.navTabIcon,
              currentPage === "completed" && styles.navTabIconActive,
            ]}
          >
            📑
          </Text>
          <Text
            style={[
              styles.navTabLabel,
              currentPage === "completed" && styles.navTabLabelActive,
            ]}
          >
            Slips
          </Text>
        </TouchableOpacity>
      </View>

      {/* Ticket Preview Modal */}
      {selectedSlip && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedSlip(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.ticketCardModal}>
              <Text style={styles.ticketPlantName}>AS STONE CRUSHER</Text>
              <View style={styles.ticketSlipBadge}>
                <Text style={styles.ticketSlipNoText}>
                  SLIP #{selectedSlip.slipNo}
                </Text>
              </View>
              <View style={styles.ticketBody}>
                <Text style={styles.ticketValBold}>
                  {selectedSlip.vehicleNumber}
                </Text>
                <Text style={styles.ticketLabel}>{selectedSlip.partyName}</Text>
                <View style={styles.ticketWeightsContainer}>
                  <Text style={styles.ticketWeightNum}>
                    Gross: {((selectedSlip.grossWeight || 0) * 10).toFixed(1)}{" "}
                    Qtl
                  </Text>
                  <Text style={styles.ticketWeightNum}>
                    Tare: {((selectedSlip.tareWeight || 0) * 10).toFixed(1)} Qtl
                  </Text>
                  <Text style={styles.ticketNetVal}>
                    NET: {((selectedSlip.netWeight || 0) * 10).toFixed(1)} Qtl
                  </Text>
                </View>
                <Text style={styles.ticketAmountVal}>
                  Amount: ₹
                  {(
                    (selectedSlip.netWeight || 0) * (selectedSlip.rate || 450)
                  ).toLocaleString("en-IN")}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.ticketCloseButton}
                onPress={() => setSelectedSlip(null)}
              >
                <Text style={styles.ticketCloseButtonText}>Close Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Settings Modal */}
      <Modal
        visible={isSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsModalTitle}>System Configuration</Text>
            <Text style={styles.settingsDesc}>Server API Tunnel Address:</Text>
            <TextInput
              style={styles.settingsInput}
              value={customIpInput}
              onChangeText={setCustomIpInput}
            />
            <TouchableOpacity
              style={styles.settingsSaveBtn}
              onPress={() => {
                setApiUrl(customIpInput.trim());
                setIsSettingsOpen(false);
              }}
            >
              <Text style={styles.settingsSaveText}>Save & Connect</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsResetBtn}
              onPress={() => setIsSettingsOpen(false)}
            >
              <Text style={styles.settingsResetText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SlipCard({
  slip,
  onViewSlip,
}: {
  slip: Weighment;
  onViewSlip: () => void;
}) {
  const amount = ((slip.netWeight || 0) * (slip.rate || 450)).toLocaleString(
    "en-IN",
    { maximumFractionDigits: 0 },
  );
  return (
    <View style={styles.slipCard}>
      <View style={styles.slipCardHeader}>
        <View style={styles.slipNoPlateRow}>
          <Text style={styles.slipNoText}>#{slip.slipNo}</Text>
          <Text style={styles.plateText}>{slip.vehicleNumber}</Text>
        </View>
        {slip.isComplete ? (
          <Text style={styles.completeStatusText}>COMPLETED</Text>
        ) : (
          <Text style={styles.inProgressStatusText}>1ST WEIGHT</Text>
        )}
      </View>
      <Text style={styles.partyNameText}>
        {slip.partyName} ({slip.itemName})
      </Text>
      <View style={styles.weightsGridRow}>
        <Text style={styles.weightColumnValue}>
          {((slip.netWeight || 0) * 10).toFixed(1)} Qtl
        </Text>
        <Text style={styles.amountBoldText}>₹{amount}</Text>
      </View>
      <TouchableOpacity style={styles.viewSlipBtn} onPress={onViewSlip}>
        <Text style={styles.viewSlipBtnText}>Preview Slip</Text>
      </TouchableOpacity>
    </View>
  );
}

// 4. Sleek Dark Mode Styling (Matching your Python Dashboard)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#121212" },
  contentArea: { flex: 1, backgroundColor: "#121212" },
  tabContent: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 90, paddingTop: 10 },
  listScrollContent: { paddingBottom: 90, paddingTop: 10 },

  // Toast Notification
  toastContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "#00E676",
    padding: 16,
    borderRadius: 8,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    elevation: 6,
  },
  toastText: {
    color: "#121212",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 14,
  },

  // Lock Screen (Dark)
  lockContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 40,
  },
  lockHeader: { alignItems: "center", marginTop: 20 },
  asBadge: {
    backgroundColor: "#1E1E1E",
    borderWidth: 2,
    borderColor: "#00E676",
    alignItems: "center",
    justifyContent: "center",
  },
  asBadgeLock: { marginBottom: 14, shadowColor: "#00E676", elevation: 4 },
  asLettersContainer: { flexDirection: "row" },
  asLetterA: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  asLetterS: { color: "#00E676", fontWeight: "900", fontSize: 16 },
  asLetterALock: { fontSize: 26 },
  asLetterSLock: { fontSize: 26 },
  lockBrandTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  lockSubtitle: { color: "#888888", fontSize: 12, marginTop: 4 },
  pinDisplayContainer: { alignItems: "center", marginVertical: 10 },
  pinInstruction: {
    color: "#AAAAAA",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  pinDotsRow: { flexDirection: "row", gap: 20 },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#333",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  pinDotFilled: {
    borderColor: "#00E676",
    backgroundColor: "rgba(0, 230, 118, 0.15)",
  },
  pinDotError: {
    borderColor: "#F44336",
    backgroundColor: "rgba(244, 67, 54, 0.15)",
  },
  pinDotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00E676",
  },
  pinErrorText: {
    color: "#F44336",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  pinHintText: { color: "#888", fontSize: 11, marginTop: 12 },
  keypadGrid: { width: "100%", maxWidth: 320, gap: 16 },
  keypadRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  keypadButton: {
    flex: 1,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  keypadNumber: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  bioButton: {
    backgroundColor: "rgba(0, 230, 118, 0.1)",
    borderColor: "#00E676",
  },
  bioIcon: { fontSize: 20 },
  deleteIcon: { color: "#888", fontSize: 20, fontWeight: "700" },
  quickUnlockBtn: { paddingVertical: 10, marginBottom: 20 },
  quickUnlockText: {
    color: "#888",
    fontSize: 12,
    textDecorationLine: "underline",
  },

  // Dashboard Header (Dark)
  header: {
    backgroundColor: "#1E1E1E",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 48 : 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandSubtitle: {
    color: "#00E676",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  headerTitle: { color: "#FFF", fontSize: 18, fontWeight: "900" },
  headerActionsRow: { flexDirection: "row", gap: 8 },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#2D2D2D",
    borderWidth: 1,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionIcon: { fontSize: 16 },
  statusStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    paddingBottom: 12,
  },
  statusItemLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00E676",
  },
  offlinePulseDot: { backgroundColor: "#F44336" },
  statusStripText: { color: "#AAA", fontSize: 10, fontWeight: "700" },
  todayDateText: { color: "#AAA", fontSize: 10, fontWeight: "600" },

  // Dashboard Cards
  globalTotalsBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#00E676",
    borderRadius: 12,
    paddingVertical: 16,
    marginVertical: 16,
  },
  globalTotalItem: { alignItems: "center" },
  globalTotalLabel: {
    color: "#121212",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  globalTotalValue: {
    color: "#121212",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  globalTotalDivider: { width: 2, backgroundColor: "#00C853" },
  kpiGrid: { flexDirection: "row", gap: 12, marginBottom: 20 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  kpiLabel: { color: "#AAA", fontSize: 10, fontWeight: "800", marginBottom: 8 },
  kpiValueLarge: { color: "#FFF", fontSize: 28, fontWeight: "900" },
  recentSection: { marginTop: 10, marginBottom: 20 }, // <--- ADD THIS LINE HERE
  sectionHeaderTitle: {
    color: "#888",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 12,
  },
  // Slips (Dark)
  slipCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    padding: 16,
    marginBottom: 12,
  },
  slipCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  slipNoPlateRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  slipNoText: { color: "#4DA8DA", fontSize: 14, fontWeight: "900" },
  plateText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  completeStatusText: { color: "#00E676", fontSize: 10, fontWeight: "900" },
  inProgressStatusText: { color: "#FF9800", fontSize: 10, fontWeight: "900" },
  partyNameText: { color: "#CCC", fontSize: 13, marginBottom: 12 },
  weightsGridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2D2D2D",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  weightColumnValue: { color: "#00E676", fontSize: 16, fontWeight: "900" },
  amountBoldText: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  viewSlipBtn: {
    backgroundColor: "#4DA8DA",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  viewSlipBtnText: { color: "#121212", fontSize: 12, fontWeight: "900" },
  searchBarWrapper: { marginBottom: 16 },
  searchInput: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 12,
    color: "#FFF",
  },
  emptyText: { color: "#888", textAlign: "center", marginTop: 20 },

  // Modals & Bottom Nav (Dark)
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: "#1E1E1E",
    borderTopWidth: 1,
    borderTopColor: "#333",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 14 : 0,
  },
  navTab: { alignItems: "center", justifyContent: "center" },
  tabIconWrapper: { position: "relative" },
  navTabIcon: { fontSize: 20, opacity: 0.5 },
  navTabIconActive: { opacity: 1 },
  navTabLabel: { color: "#888", fontSize: 10, fontWeight: "600", marginTop: 4 },
  navTabLabelActive: { color: "#4DA8DA", fontWeight: "800" },
  tabBadgeAmber: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#FF9800",
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: "#121212", fontSize: 9, fontWeight: "900" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  ticketCardModal: {
    width: "100%",
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  ticketPlantName: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
  },
  ticketSlipBadge: {
    backgroundColor: "#2D2D2D",
    padding: 8,
    borderRadius: 6,
    alignSelf: "center",
    marginBottom: 16,
  },
  ticketSlipNoText: { color: "#4DA8DA", fontWeight: "900" },
  ticketBody: { gap: 8, marginBottom: 20 },
  ticketValBold: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  ticketLabel: { color: "#CCC", fontSize: 14 },
  ticketWeightsContainer: {
    backgroundColor: "#2D2D2D",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  ticketWeightNum: { color: "#AAA", fontSize: 14, marginBottom: 4 },
  ticketNetVal: {
    color: "#00E676",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
  },
  ticketAmountVal: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  ticketCloseButton: {
    backgroundColor: "#4DA8DA",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  ticketCloseButtonText: { color: "#121212", fontWeight: "900" },
  settingsModal: {
    width: "100%",
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  settingsModalTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  settingsDesc: { color: "#888", fontSize: 12, marginBottom: 12 },
  settingsInput: {
    backgroundColor: "#2D2D2D",
    color: "#FFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  settingsSaveBtn: {
    backgroundColor: "#00E676",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  settingsSaveText: { color: "#121212", fontWeight: "900" },
  settingsResetBtn: { padding: 12, alignItems: "center" },
  settingsResetText: { color: "#AAA", fontWeight: "700" },
});
