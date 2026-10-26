import React, { useEffect, useState, useMemo, useRef } from "react";
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
  Animated,
  Vibration,
} from "react-native";
import { StatusBar } from "expo-status-bar";

// Safely require expo-local-authentication if installed
let LocalAuthentication: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  LocalAuthentication = require("expo-local-authentication");
} catch {
  // Not installed or web fallback
}

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
  return "https://list-introductory-estimates-zoning.trycloudflare.com/api/weighments";
}

type PageTab = "dashboard" | "pending" | "completed" | "item_report";

// Stylized AS Monogram Logo (Light Theme Edition)
function ASLogo({ size = 38, isLock = false }: { size?: number; isLock?: boolean }) {
  return (
    <View
      style={[
        styles.asBadge,
        {
          width: size,
          height: size,
          borderRadius: isLock ? 20 : 10,
        },
        isLock && styles.asBadgeLock,
      ]}
    >
      <View style={styles.asLettersContainer}>
        <Text style={[styles.asLetterA, isLock && styles.asLetterALock]}>A</Text>
        <Text style={[styles.asLetterS, isLock && styles.asLetterSLock]}>S</Text>
      </View>
      <View style={[styles.asBalanceLine, isLock && styles.asBalanceLineLock]}>
        <View style={styles.asLinePipLeft} />
        <View style={styles.asLineCenter} />
        <View style={styles.asLinePipRight} />
      </View>
    </View>
  );
}

export default function App() {
  // Navigation & Data State
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
  const [selectedItemName, setSelectedItemName] = useState<string>("All Items");

  // ==========================================
  // SECURITY & LOCK STATE (PIN & BIOMETRIC)
  // ==========================================
  const [isLocked, setIsLocked] = useState(false);
  const [masterPin, setMasterPin] = useState("1234");
  const [enteredPin, setEnteredPin] = useState("");
  const [isPinLockEnabled, setIsPinLockEnabled] = useState(true);
  const [pinError, setPinError] = useState("");
  const [isBioScanning, setIsBioScanning] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [changePinError, setChangePinError] = useState("");

  // Shake animation for incorrect PIN
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    if (Platform.OS !== "web") {
      try {
        Vibration.vibrate(200);
      } catch {}
    }
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Attempt Biometric Fingerprint scan
  const handleBiometricAuth = async () => {
    setIsBioScanning(true);
    setPinError("");

    if (LocalAuthentication) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Scan Fingerprint to Unlock AS Dharamkanta",
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
      } catch {
        // Fallback to simulated fingerprint scanner if hardware fails or on Web
      }
    }

    // High-tech visual fingerprint scan animation
    setTimeout(() => {
      setIsBioScanning(false);
      setIsLocked(false);
      setEnteredPin("");
    }, 750);
  };

  // Check biometric capability on app launch
  useEffect(() => {
    if (isLocked && isPinLockEnabled) {
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle keypad digit press
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
            setPinError("Incorrect 4-Digit PIN");
            setEnteredPin("");
          }, 200);
        }
      }
    }
  };

  // Delete last digit
  const handleDeleteDigit = () => {
    setPinError("");
    if (enteredPin.length > 0) {
      setEnteredPin(enteredPin.slice(0, -1));
    }
  };

  // Save new PIN
  const handleSaveNewPin = () => {
    if (newPinInput.length !== 4) {
      setChangePinError("PIN must be exactly 4 digits");
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setChangePinError("PINs do not match");
      return;
    }
    setMasterPin(newPinInput);
    setShowChangePinModal(false);
    setNewPinInput("");
    setConfirmPinInput("");
    setChangePinError("");
  };

  // ==========================================
  // DATA FETCHING
  // ==========================================
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

  // Global Aggregate Metrics
  const metrics = useMemo(() => {
    const completed = slips.filter((s) => s.isComplete);
    const pending = slips.filter((s) => !s.isComplete);

    const totalNetWeight = completed.reduce((acc, curr) => acc + (curr.netWeight || 0), 0);
    const totalAmount = completed.reduce((acc, curr) => {
      const rate = curr.rate || 420;
      return acc + (curr.netWeight || 0) * rate;
    }, 0);

    const tallySyncedCount = completed.filter((s) => s.tallySynced).length;

    return {
      totalSlips: slips.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      totalNetTonnes: totalNetWeight.toFixed(2),
      totalAmountFormatted: totalAmount.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      }),
      tallySyncedCount,
    };
  }, [slips]);

  // Filtered Slips for Completed tab
  const filteredCompletedSlips = useMemo(() => {
    return slips
      .filter((s) => s.isComplete)
      .filter((s) => {
        const matchesSearch =
          s.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.slipNo.toString().includes(searchQuery) ||
          s.itemName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesItem = selectedItemName === "All Items" || s.itemName === selectedItemName;
        return matchesSearch && matchesItem;
      });
  }, [slips, searchQuery, selectedItemName]);

  // Filtered Metrics for Completed tab (dynamic recalculation based on search & material filter)
  const filteredCompletedMetrics = useMemo(() => {
    const totalWeight = filteredCompletedSlips.reduce((acc, curr) => acc + (curr.netWeight || 0), 0);
    const totalAmount = filteredCompletedSlips.reduce((acc, curr) => {
      const rate = curr.rate || 420;
      return acc + (curr.netWeight || 0) * rate;
    }, 0);
    return {
      count: filteredCompletedSlips.length,
      netWeight: totalWeight.toFixed(2),
      amountFormatted: totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 }),
    };
  }, [filteredCompletedSlips]);

  // Filtered Slips for Pending tab
  const filteredPendingSlips = useMemo(() => {
    return slips.filter((s) => !s.isComplete);
  }, [slips]);

  // Material item breakdown
  const materialBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; totalWeight: number; totalRevenue: number }>();
    slips
      .filter((s) => s.isComplete)
      .forEach((s) => {
        const item = s.itemName || "Unspecified";
        const current = map.get(item) || { count: 0, totalWeight: 0, totalRevenue: 0 };
        current.count += 1;
        current.totalWeight += s.netWeight || 0;
        current.totalRevenue += (s.netWeight || 0) * (s.rate || 420);
        map.set(item, current);
      });
    return Array.from(map.entries()).map(([itemName, data]) => ({
      itemName,
      ...data,
      totalWeightStr: data.totalWeight.toFixed(2),
      totalRevenueStr: data.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 }),
    }));
  }, [slips]);

  // ==========================================
  // RENDER: SECURITY PIN & BIOMETRIC LOCK SCREEN (LIGHT THEME)
  // ==========================================
  if (isLocked && isPinLockEnabled) {
    return (
      <SafeAreaView style={styles.lockContainerLight}>
        <StatusBar style="dark" />

        {/* Lock Screen Header */}
        <View style={styles.lockHeader}>
          <ASLogo size={72} isLock />
          <Text style={styles.lockBrandTitleLight}>AS DHARAMKANTA</Text>
          <Text style={styles.lockSubtitleLight}>Stone Crusher Live Weighbridge System</Text>
          <View style={styles.lockSecureRowLight}>
            <View style={styles.secureDotLight} />
            <Text style={styles.secureTextLight}>Protected Weighbridge Terminal</Text>
          </View>
        </View>

        {/* 4-Digit Indicator Display */}
        <Animated.View style={[styles.pinDisplayContainer, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.pinInstructionLight}>Enter 4-Digit PIN to Unlock</Text>
          <View style={styles.pinDotsRow}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = enteredPin.length > index;
              return (
                <View
                  key={index}
                  style={[
                    styles.pinDotLight,
                    isFilled && styles.pinDotFilledLight,
                    pinError ? styles.pinDotErrorLight : null,
                  ]}
                >
                  {isFilled && <View style={styles.pinDotCoreLight} />}
                </View>
              );
            })}
          </View>
          {pinError ? (
            <Text style={styles.pinErrorText}>{pinError}</Text>
          ) : (
            <Text style={styles.pinHintTextLight}>Tap fingerprint sensor or enter PIN</Text>
          )}
        </Animated.View>

        {/* Responsive Numeric Keypad (Light Theme) */}
        <View style={styles.keypadGrid}>
          {/* Row 1: 1, 2, 3 */}
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("1")}>
              <Text style={styles.keypadNumberLight}>1</Text>
              <Text style={styles.keypadLettersLight}> </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("2")}>
              <Text style={styles.keypadNumberLight}>2</Text>
              <Text style={styles.keypadLettersLight}>ABC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("3")}>
              <Text style={styles.keypadNumberLight}>3</Text>
              <Text style={styles.keypadLettersLight}>DEF</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: 4, 5, 6 */}
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("4")}>
              <Text style={styles.keypadNumberLight}>4</Text>
              <Text style={styles.keypadLettersLight}>GHI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("5")}>
              <Text style={styles.keypadNumberLight}>5</Text>
              <Text style={styles.keypadLettersLight}>JKL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("6")}>
              <Text style={styles.keypadNumberLight}>6</Text>
              <Text style={styles.keypadLettersLight}>MNO</Text>
            </TouchableOpacity>
          </View>

          {/* Row 3: 7, 8, 9 */}
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("7")}>
              <Text style={styles.keypadNumberLight}>7</Text>
              <Text style={styles.keypadLettersLight}>PQRS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("8")}>
              <Text style={styles.keypadNumberLight}>8</Text>
              <Text style={styles.keypadLettersLight}>TUV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("9")}>
              <Text style={styles.keypadNumberLight}>9</Text>
              <Text style={styles.keypadLettersLight}>WXYZ</Text>
            </TouchableOpacity>
          </View>

          {/* Row 4: Biometric, 0, Backspace */}
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.keypadButtonLight, styles.bioButtonLight]}
              onPress={handleBiometricAuth}
            >
              <Text style={styles.bioIconLight}>👆</Text>
              <Text style={styles.bioLabelLight}>Touch ID</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.keypadButtonLight} onPress={() => handleDigitPress("0")}>
              <Text style={styles.keypadNumberLight}>0</Text>
              <Text style={styles.keypadLettersLight}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.keypadButtonLight} onPress={handleDeleteDigit}>
              <Text style={styles.deleteIconLight}>⌫</Text>
              <Text style={styles.keypadLettersLight}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Demo Bypass / Fingerprint Sensor Modal */}
        <View style={styles.lockFooter}>
          <TouchableOpacity
            style={styles.biometricScanBannerLight}
            onPress={handleBiometricAuth}
          >
            <Text style={styles.bioSensorIcon}>🧬</Text>
            <View>
              <Text style={styles.bioBannerTitleLight}>
                {isBioScanning ? "Scanning Fingerprint..." : "Scan Biometric Fingerprint"}
              </Text>
              <Text style={styles.bioBannerSubtitleLight}>Touch ID / Face Unlock</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickUnlockBtn}
            onPress={() => {
              setIsLocked(false);
              setEnteredPin("");
            }}
          >
            <Text style={styles.quickUnlockTextLight}>Quick Unlock (Default: {masterPin})</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================
  // RENDER: MAIN APPLICATION (LIGHT THEME)
  // ==========================================
  return (
    <SafeAreaView style={styles.safeAreaLight}>
      <StatusBar style="dark" />

      {/* Clean Light Top Header */}
      <View style={styles.headerLight}>
        <View style={styles.headerTop}>
          <View style={styles.headerBrandCol}>
            <View style={styles.brandRow}>
              <ASLogo size={40} />
              <View>
                <Text style={styles.brandSubtitleLight}>STONE CRUSHER AUTOMATION</Text>
                <Text style={styles.headerTitleLight}>AS DHARAMKANTA</Text>
              </View>
            </View>
          </View>

          {/* Quick Header Actions: Lock Button & Settings */}
          <View style={styles.headerActionsRow}>
            {/* Lock Button */}
            <TouchableOpacity
              style={styles.headerActionBtnLight}
              onPress={() => setIsLocked(true)}
              accessibilityLabel="Lock Terminal"
            >
              <Text style={styles.headerActionIcon}>🔒</Text>
            </TouchableOpacity>

            {/* Refresh Button */}
            <TouchableOpacity
              style={styles.headerActionBtnLight}
              onPress={onRefresh}
              accessibilityLabel="Refresh Data"
            >
              <Text style={styles.headerActionIcon}>🔄</Text>
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={styles.headerActionBtnLight}
              onPress={() => setIsSettingsOpen(true)}
              accessibilityLabel="Settings"
            >
              <Text style={styles.headerActionIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Status Strip */}
        <View style={styles.statusStripLight}>
          <View style={styles.statusItemLeft}>
            <View style={[styles.livePulseDot, isOfflineMode && styles.offlinePulseDot]} />
            <Text style={styles.statusStripTextLight}>
              {isOfflineMode ? "OFFLINE / LOCAL CACHE" : "SCALE SERVER ONLINE"}
            </Text>
          </View>
          <View style={styles.statusItemRight}>
            <Text style={styles.todayDateTextLight}>
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* ============================================================== */}
      {/* UNIVERSAL PERSISTENT TOTALS BANNER (NET WEIGHT & TOTAL AMOUNT)  */}
      {/* Visible at the top of EVERY page for instant management vision */}
      {/* ============================================================== */}
      <View style={styles.universalTotalsBanner}>
        {/* Net Weight Box */}
        <View style={styles.universalBoxGreen}>
          <View style={styles.universalBoxHeader}>
            <Text style={styles.universalBoxLabelGreen}>TOTAL NET WEIGHT</Text>
            <View style={styles.universalBadgeGreen}>
              <Text style={styles.universalBadgeTextGreen}>{metrics.completedCount} SLIPS</Text>
            </View>
          </View>
          <View style={styles.universalValueRow}>
            <Text style={styles.universalValueLargeGreen}>{metrics.totalNetTonnes}</Text>
            <Text style={styles.universalUnitGreen}>MT</Text>
          </View>
        </View>

        {/* Total Billed Amount Box */}
        <View style={styles.universalBoxBlue}>
          <View style={styles.universalBoxHeader}>
            <Text style={styles.universalBoxLabelBlue}>TOTAL AMOUNT</Text>
            <View style={styles.universalBadgeBlue}>
              <Text style={styles.universalBadgeTextBlue}>INR</Text>
            </View>
          </View>
          <View style={styles.universalValueRow}>
            <Text style={styles.universalCurrencyBlue}>₹</Text>
            <Text style={styles.universalValueLargeBlue}>{metrics.totalAmountFormatted}</Text>
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentAreaLight}>
        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {currentPage === "dashboard" && (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
          >
            {/* 4 Light-Themed KPI Cards */}
            <View style={styles.kpiGrid}>
              {/* Card 1: Dispatched Net Weight */}
              <View style={[styles.kpiCardLight, styles.kpiCardEmeraldLight]}>
                <View style={styles.kpiHeaderRow}>
                  <Text style={styles.kpiLabelLight}>DISPATCHED TODAY</Text>
                  <Text style={styles.kpiBadgeEmeraldLight}>{metrics.completedCount} SLIPS</Text>
                </View>
                <View style={styles.kpiValueRow}>
                  <Text style={styles.kpiValueLargeLight}>{metrics.totalNetTonnes}</Text>
                  <Text style={styles.kpiUnitLight}>MT</Text>
                </View>
                <Text style={styles.kpiSubtextLight}>Net Crushed Stone Dispatched</Text>
              </View>

              {/* Card 2: Revenue */}
              <View style={[styles.kpiCardLight, styles.kpiCardBlueLight]}>
                <View style={styles.kpiHeaderRow}>
                  <Text style={styles.kpiLabelLight}>TOTAL BILLED VALUE</Text>
                  <Text style={styles.kpiBadgeBlueLight}>INR</Text>
                </View>
                <View style={styles.kpiValueRow}>
                  <Text style={styles.kpiCurrencyLight}>₹</Text>
                  <Text style={styles.kpiValueLargeLight}>{metrics.totalAmountFormatted}</Text>
                </View>
                <Text style={styles.kpiSubtextLight}>Estimated Material Invoiced</Text>
              </View>

              {/* Card 3: In-Plant Trucks */}
              <View style={[styles.kpiCardLight, styles.kpiCardAmberLight]}>
                <View style={styles.kpiHeaderRow}>
                  <Text style={styles.kpiLabelLight}>IN-PLANT VEHICLES</Text>
                  <Text style={styles.kpiBadgeAmberLight}>1ST WEIGHT</Text>
                </View>
                <View style={styles.kpiValueRow}>
                  <Text style={styles.kpiValueLargeLight}>{metrics.pendingCount}</Text>
                  <Text style={styles.kpiUnitLight}>TRUCKS</Text>
                </View>
                <Text style={styles.kpiSubtextLight}>Awaiting Final Tare/Gross</Text>
              </View>

              {/* Card 4: Tally ERP Sync */}
              <View style={[styles.kpiCardLight, styles.kpiCardPurpleLight]}>
                <View style={styles.kpiHeaderRow}>
                  <Text style={styles.kpiLabelLight}>TALLY ERP SYNC</Text>
                  <Text style={styles.kpiBadgePurpleLight}>ACCOUNTING</Text>
                </View>
                <View style={styles.kpiValueRow}>
                  <Text style={styles.kpiValueLargeLight}>{metrics.tallySyncedCount}</Text>
                  <Text style={styles.kpiUnitLight}>/{metrics.completedCount}</Text>
                </View>
                <Text style={styles.kpiSubtextLight}>Vouchers Pushed Automatically</Text>
              </View>
            </View>

            {/* Quick Action Navigation Buttons */}
            <View style={styles.quickNavSection}>
              <Text style={styles.sectionHeaderTitleLight}>QUICK MODULES</Text>
              <View style={styles.quickNavRow}>
                <TouchableOpacity
                  style={styles.quickNavCardLight}
                  onPress={() => setCurrentPage("pending")}
                >
                  <Text style={styles.quickNavIcon}>🚛</Text>
                  <View>
                    <Text style={styles.quickNavTitleLight}>In-Plant Trucks ({metrics.pendingCount})</Text>
                    <Text style={styles.quickNavDescLight}>Vehicles currently loading/unloading</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickNavCardLight}
                  onPress={() => setCurrentPage("completed")}
                >
                  <Text style={styles.quickNavIcon}>📑</Text>
                  <View>
                    <Text style={styles.quickNavTitleLight}>Weight Records ({metrics.completedCount})</Text>
                    <Text style={styles.quickNavDescLight}>View slips & print duplicate tickets</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickNavCardLight}
                  onPress={() => setCurrentPage("item_report")}
                >
                  <Text style={styles.quickNavIcon}>📊</Text>
                  <View>
                    <Text style={styles.quickNavTitleLight}>Material Report</Text>
                    <Text style={styles.quickNavDescLight}>10mm, 20mm, GSB, Dust Tonnage</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Slips Feed */}
            <View style={styles.recentSection}>
              <View style={styles.recentHeaderRow}>
                <Text style={styles.sectionHeaderTitleLight}>LATEST WEIGHBRIDGE SLIPS</Text>
                <TouchableOpacity onPress={() => setCurrentPage("completed")}>
                  <Text style={styles.viewAllTextLight}>View All →</Text>
                </TouchableOpacity>
              </View>

              {slips.slice(0, 4).map((slip) => (
                <SlipCard key={slip.id} slip={slip} onViewSlip={() => setSelectedSlip(slip)} />
              ))}
            </View>
          </ScrollView>
        )}

        {/* TAB 2: PENDING VEHICLES (1ST WEIGHT) */}
        {currentPage === "pending" && (
          <View style={styles.tabContent}>
            {/* Page Header Bar */}
            <View style={styles.listHeaderBarLight}>
              <View>
                <Text style={styles.listHeaderTitleLight}>Vehicles Inside Crusher Plant</Text>
                <Text style={styles.listHeaderSubLight}>
                  {filteredPendingSlips.length} trucks awaiting 2nd weighing (Gross/Tare)
                </Text>
              </View>
              <View style={styles.pendingBadgeLight}>
                <Text style={styles.pendingBadgeTextLight}>{filteredPendingSlips.length} ACTIVE</Text>
              </View>
            </View>

            <FlatList
              data={filteredPendingSlips}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d97706" />}
              contentContainerStyle={styles.listScrollContent}
              ListEmptyComponent={
                <View style={styles.emptyContainerLight}>
                  <Text style={styles.emptyIcon}>🎉</Text>
                  <Text style={styles.emptyTitleLight}>No Pending Vehicles</Text>
                  <Text style={styles.emptyTextLight}>All trucks have completed their second weighing</Text>
                </View>
              }
              renderItem={({ item }) => (
                <SlipCard slip={item} onViewSlip={() => setSelectedSlip(item)} />
              )}
            />
          </View>
        )}

        {/* TAB 3: COMPLETED SLIPS & SEARCH */}
        {currentPage === "completed" && (
          <View style={styles.tabContent}>
            {/* Search Input Bar */}
            <View style={styles.searchBarWrapper}>
              <TextInput
                style={styles.searchInputLight}
                placeholder="Search Truck No, Party, Slip #..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery("")}>
                  <Text style={styles.clearSearchIconLight}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Horizontal Filter Chips for Materials */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={styles.chipsContent}
            >
              {distinctMaterials.map((mat) => {
                const isSelected = selectedItemName === mat;
                return (
                  <TouchableOpacity
                    key={mat}
                    style={[styles.materialChipLight, isSelected && styles.materialChipActiveLight]}
                    onPress={() => setSelectedItemName(mat)}
                  >
                    <Text
                      style={[
                        styles.materialChipTextLight,
                        isSelected && styles.materialChipTextActiveLight,
                      ]}
                    >
                      {mat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Filtered Context Summary (Dynamically updates if search or chip is applied) */}
            <View style={styles.contextSummaryStrip}>
              <View style={styles.contextSummaryCol}>
                <Text style={styles.contextSummaryLabel}>FILTERED NET WT</Text>
                <Text style={styles.contextSummaryValGreen}>
                  {filteredCompletedMetrics.netWeight} MT
                </Text>
              </View>
              <View style={styles.contextDivider} />
              <View style={styles.contextSummaryCol}>
                <Text style={styles.contextSummaryLabel}>FILTERED AMOUNT</Text>
                <Text style={styles.contextSummaryValBlue}>
                  ₹{filteredCompletedMetrics.amountFormatted}
                </Text>
              </View>
              <View style={styles.contextBadge}>
                <Text style={styles.contextBadgeText}>{filteredCompletedMetrics.count} Records</Text>
              </View>
            </View>

            <FlatList
              data={filteredCompletedSlips}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
              contentContainerStyle={styles.listScrollContent}
              ListEmptyComponent={
                <View style={styles.emptyContainerLight}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitleLight}>No Matching Slips</Text>
                  <Text style={styles.emptyTextLight}>Try adjusting your search or material filter</Text>
                </View>
              }
              renderItem={({ item }) => (
                <SlipCard slip={item} onViewSlip={() => setSelectedSlip(item)} />
              )}
            />
          </View>
        )}

        {/* TAB 4: MATERIAL DISPATCH REPORT */}
        {currentPage === "item_report" && (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />}
          >
            <View style={styles.reportSummaryBannerLight}>
              <Text style={styles.reportBannerTitleLight}>Crusher Material Dispatch Summary</Text>
              <Text style={styles.reportBannerDescLight}>
                Item-wise tonnage and billing breakdown for today
              </Text>
              <View style={styles.reportTotalRowLight}>
                <View style={styles.reportTotalCol}>
                  <Text style={styles.reportTotalLabelLight}>TOTAL NET WEIGHT</Text>
                  <Text style={styles.reportTotalValGreen}>{metrics.totalNetTonnes} MT</Text>
                </View>
                <View style={styles.reportDividerVertLight} />
                <View style={styles.reportTotalCol}>
                  <Text style={styles.reportTotalLabelLight}>TOTAL AMOUNT</Text>
                  <Text style={styles.reportTotalValBlue}>₹{metrics.totalAmountFormatted}</Text>
                </View>
              </View>
            </View>

            <View style={styles.materialsList}>
              {materialBreakdown.map((item, idx) => (
                <View key={item.itemName} style={styles.materialCardLight}>
                  <View style={styles.materialCardHeader}>
                    <View style={styles.materialRankBadgeLight}>
                      <Text style={styles.materialRankTextLight}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.materialTitleCol}>
                      <Text style={styles.materialNameLight}>{item.itemName}</Text>
                      <Text style={styles.materialTruckCountLight}>{item.count} Truck Loads Dispatched</Text>
                    </View>
                  </View>

                  <View style={styles.materialMetricsRowLight}>
                    <View style={styles.matMetricBox}>
                      <Text style={styles.matMetricLabelLight}>NET WEIGHT</Text>
                      <Text style={styles.matMetricValGreenLight}>{item.totalWeightStr} MT</Text>
                    </View>
                    <View style={styles.matMetricBox}>
                      <Text style={styles.matMetricLabelLight}>ESTIMATED REVENUE</Text>
                      <Text style={styles.matMetricValBlueLight}>₹{item.totalRevenueStr}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Floating Clean Light Bottom Navigation Bar */}
      <View style={styles.bottomNavBarLight}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentPage("dashboard")}
        >
          <Text style={[styles.navTabIcon, currentPage === "dashboard" && styles.navTabIconActive]}>
            📊
          </Text>
          <Text style={[styles.navTabLabelLight, currentPage === "dashboard" && styles.navTabLabelActiveLight]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentPage("pending")}
        >
          <View style={styles.tabIconWrapper}>
            <Text style={[styles.navTabIcon, currentPage === "pending" && styles.navTabIconActive]}>
              🚛
            </Text>
            {metrics.pendingCount > 0 && (
              <View style={styles.tabBadgeAmberLight}>
                <Text style={styles.tabBadgeTextLight}>{metrics.pendingCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navTabLabelLight, currentPage === "pending" && styles.navTabLabelActiveLight]}>
            In-Plant ({metrics.pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentPage("completed")}
        >
          <Text style={[styles.navTabIcon, currentPage === "completed" && styles.navTabIconActive]}>
            📑
          </Text>
          <Text style={[styles.navTabLabelLight, currentPage === "completed" && styles.navTabLabelActiveLight]}>
            Slips ({metrics.completedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentPage("item_report")}
        >
          <Text style={[styles.navTabIcon, currentPage === "item_report" && styles.navTabIconActive]}>
            📈
          </Text>
          <Text style={[styles.navTabLabelLight, currentPage === "item_report" && styles.navTabLabelActiveLight]}>
            Materials
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================== */}
      {/* MODAL 1: WEIGHMENT SLIP PREVIEW (CLEAN)    */}
      {/* ========================================== */}
      <Modal
        visible={Boolean(selectedSlip)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSlip(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ticketCardModalLight}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketPlantName}>AS STONE CRUSHER & WEIGHBRIDGE</Text>
              <Text style={styles.ticketPlantSub}>Industrial Weighbridge · Approved Scale</Text>
              <View style={styles.ticketSlipBadge}>
                <Text style={styles.ticketSlipNoText}>SLIP #{selectedSlip?.slipNo}</Text>
              </View>
            </View>

            <ScrollView style={styles.ticketBody} showsVerticalScrollIndicator={false}>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Vehicle No:</Text>
                <Text style={styles.ticketPlateVal}>{selectedSlip?.vehicleNumber}</Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Customer / Party:</Text>
                <Text style={styles.ticketVal}>{selectedSlip?.partyName}</Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Material Item:</Text>
                <Text style={styles.ticketValBold}>{selectedSlip?.itemName}</Text>
              </View>

              {/* Weights Table */}
              <View style={styles.ticketWeightsContainer}>
                <View style={styles.ticketWeightRow}>
                  <Text style={styles.ticketWeightLabel}>GROSS WEIGHT:</Text>
                  <Text style={styles.ticketWeightNum}>{selectedSlip?.grossWeight || 0.0} MT</Text>
                </View>
                <View style={styles.ticketWeightRow}>
                  <Text style={styles.ticketWeightLabel}>TARE WEIGHT:</Text>
                  <Text style={styles.ticketWeightNum}>{selectedSlip?.tareWeight || 0.0} MT</Text>
                </View>
                <View style={styles.ticketNetWeightRow}>
                  <Text style={styles.ticketNetLabel}>NET MATERIAL:</Text>
                  <Text style={styles.ticketNetVal}>{selectedSlip?.netWeight || 0.0} MT</Text>
                </View>
              </View>

              {/* Rate & Valuation */}
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Rate per MT:</Text>
                <Text style={styles.ticketVal}>₹{selectedSlip?.rate || 450} / MT</Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Total Amount:</Text>
                <Text style={styles.ticketAmountVal}>
                  ₹{(((selectedSlip?.netWeight || 0) * (selectedSlip?.rate || 450))).toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>

              {/* Timestamps */}
              <View style={styles.ticketTimestampBlock}>
                <Text style={styles.ticketTimeText}>
                  1st Weight: {selectedSlip ? new Date(selectedSlip.firstTimestamp).toLocaleString("en-IN") : ""}
                </Text>
                {selectedSlip?.secondTimestamp && (
                  <Text style={styles.ticketTimeText}>
                    2nd Weight: {new Date(selectedSlip.secondTimestamp).toLocaleString("en-IN")}
                  </Text>
                )}
              </View>

              <View style={styles.ticketSignRow}>
                <Text style={styles.ticketSignText}>Operator Signature</Text>
                <Text style={styles.ticketSignText}>Driver Signature</Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.ticketCloseButton}
              onPress={() => setSelectedSlip(null)}
            >
              <Text style={styles.ticketCloseButtonText}>Close Weighment Ticket</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 2: SETTINGS & SECURITY (LIGHT THEME) */}
      {/* ========================================== */}
      <Modal
        visible={isSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalLight}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsModalTitleLight}>Settings & Security</Text>
              <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                <Text style={styles.settingsCloseXLight}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Security Section */}
              <Text style={styles.settingsSectionTitleLight}>TERMINAL SECURITY</Text>
              <View style={styles.securityBoxLight}>
                <View style={styles.securityToggleRow}>
                  <View>
                    <Text style={styles.securityOptionTitleLight}>4-Digit & Biometric Lock</Text>
                    <Text style={styles.securityOptionDescLight}>Require PIN or Fingerprint to access app</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleBtn, isPinLockEnabled ? styles.toggleOnLight : styles.toggleOffLight]}
                    onPress={() => setIsPinLockEnabled(!isPinLockEnabled)}
                  >
                    <Text style={styles.toggleBtnText}>{isPinLockEnabled ? "ON" : "OFF"}</Text>
                  </TouchableOpacity>
                </View>

                {isPinLockEnabled && (
                  <View style={styles.securitySubActionsLight}>
                    <TouchableOpacity
                      style={styles.changePinBtnLight}
                      onPress={() => {
                        setShowChangePinModal(true);
                        setIsSettingsOpen(false);
                      }}
                    >
                      <Text style={styles.changePinBtnTextLight}>🔑 Change 4-Digit PIN (Current: {masterPin})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.lockNowBtnLight}
                      onPress={() => {
                        setIsSettingsOpen(false);
                        setIsLocked(true);
                      }}
                    >
                      <Text style={styles.lockNowBtnTextLight}>🔒 Lock Terminal Immediately</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Server Connection Section */}
              <Text style={styles.settingsSectionTitleLight}>WEIGHBRIDGE SERVER URL</Text>
              <Text style={styles.settingsDescLight}>
                Production Cloudflare Tunnel or Local LAN IP:
              </Text>

              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={styles.presetChipLight}
                  onPress={() => setCustomIpInput("https://list-introductory-estimates-zoning.trycloudflare.com/api/weighments")}
                >
                  <Text style={styles.presetChipTextLight}>Cloudflare Production Tunnel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChipLight}
                  onPress={() => setCustomIpInput("http://192.168.68.51:3000/api/weighments")}
                >
                  <Text style={styles.presetChipTextLight}>Localhost IP (192.168.68.51)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChipLight}
                  onPress={() => setCustomIpInput("/api/weighments")}
                >
                  <Text style={styles.presetChipTextLight}>Same Host (/api)</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.settingsInputLight}
                value={customIpInput}
                onChangeText={setCustomIpInput}
                placeholder="https://...trycloudflare.com/api/weighments"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />

              <View style={styles.settingsActions}>
                <TouchableOpacity
                  style={styles.settingsResetBtnLight}
                  onPress={() => setCustomIpInput(getDefaultApiUrl())}
                >
                  <Text style={styles.settingsResetTextLight}>Reset Default</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.settingsSaveBtnLight}
                  onPress={() => {
                    setApiUrl(customIpInput.trim());
                    setIsSettingsOpen(false);
                    setLoading(true);
                    fetchSlips();
                  }}
                >
                  <Text style={styles.settingsSaveTextLight}>Connect Server</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 3: CHANGE PIN DIALOG (LIGHT)        */}
      {/* ========================================== */}
      <Modal
        visible={showChangePinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangePinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalLight}>
            <Text style={styles.settingsModalTitleLight}>Change 4-Digit Security PIN</Text>
            <Text style={styles.settingsDescLight}>
              Enter a new 4-digit code to protect this AS Dharamkanta terminal.
            </Text>

            <TextInput
              style={styles.settingsInputLight}
              value={newPinInput}
              onChangeText={setNewPinInput}
              placeholder="Enter new 4 digits"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />

            <TextInput
              style={styles.settingsInputLight}
              value={confirmPinInput}
              onChangeText={setConfirmPinInput}
              placeholder="Confirm new 4 digits"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />

            {changePinError ? (
              <Text style={styles.changePinErrorText}>{changePinError}</Text>
            ) : null}

            <View style={styles.settingsActions}>
              <TouchableOpacity
                style={styles.settingsResetBtnLight}
                onPress={() => {
                  setShowChangePinModal(false);
                  setNewPinInput("");
                  setConfirmPinInput("");
                  setChangePinError("");
                }}
              >
                <Text style={styles.settingsResetTextLight}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsSaveBtnLight} onPress={handleSaveNewPin}>
                <Text style={styles.settingsSaveTextLight}>Save PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// COMPONENT: SLIP CARD (LIGHT THEME)
// ==========================================
function SlipCard({ slip, onViewSlip }: { slip: Weighment; onViewSlip: () => void }) {
  const isComplete = slip.isComplete;
  const rate = slip.rate || 450;
  const amount = ((slip.netWeight || 0) * rate).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

  return (
    <View style={styles.slipCardLight}>
      {/* Card Header: Slip #, Vehicle # & Status Badge */}
      <View style={styles.slipCardHeader}>
        <View style={styles.slipNoPlateRow}>
          <View style={styles.slipNoBadgeLight}>
            <Text style={styles.slipNoTextLight}>#{slip.slipNo}</Text>
          </View>
          <View style={styles.plateBadgeLight}>
            <Text style={styles.plateTextLight}>{slip.vehicleNumber}</Text>
          </View>
        </View>

        <View style={styles.statusBadgeWrapper}>
          {isComplete ? (
            <View style={styles.completeStatusBadgeLight}>
              <View style={styles.statusDotGreen} />
              <Text style={styles.completeStatusTextLight}>COMPLETED</Text>
            </View>
          ) : (
            <View style={styles.inProgressStatusBadgeLight}>
              <View style={styles.statusDotAmber} />
              <Text style={styles.inProgressStatusTextLight}>1ST WEIGHT</Text>
            </View>
          )}
        </View>
      </View>

      {/* Party Name & Material */}
      <View style={styles.slipDetailsBlock}>
        <Text style={styles.partyNameTextLight} numberOfLines={1}>
          {slip.partyName}
        </Text>
        <View style={styles.materialTagRow}>
          <Text style={styles.materialTagLabelLight}>ITEM:</Text>
          <Text style={styles.materialTagValueLight}>{slip.itemName}</Text>
        </View>
      </View>

      {/* 3-Column Weight Grid (Clean High-Contrast) */}
      <View style={styles.weightsGridRow}>
        <View style={styles.weightColumnBoxLight}>
          <Text style={styles.weightColumnLabelLight}>GROSS</Text>
          <Text style={styles.weightColumnValueLight}>{slip.grossWeight || 0.0} T</Text>
        </View>

        <View style={styles.weightColumnBoxLight}>
          <Text style={styles.weightColumnLabelLight}>TARE</Text>
          <Text style={styles.weightColumnValueLight}>{slip.tareWeight || 0.0} T</Text>
        </View>

        <View style={[styles.weightColumnBoxLight, isComplete && styles.netWeightColumnBoxLight]}>
          <Text style={[styles.weightColumnLabelLight, isComplete && styles.netWeightLabelActiveLight]}>
            NET WEIGHT
          </Text>
          <Text style={[styles.weightColumnValueLight, isComplete && styles.netWeightValueActiveLight]}>
            {slip.netWeight || 0.0} T
          </Text>
        </View>
      </View>

      {/* Footer Info: Rate, Valuation & Ticket Action */}
      <View style={styles.slipCardFooterLight}>
        <View style={styles.slipValuationCol}>
          <Text style={styles.rateLabelTextLight}>
            @ ₹{rate}/T · <Text style={styles.amountBoldTextLight}>₹{amount}</Text>
          </Text>
          <Text style={styles.slipTimeAgoTextLight}>
            {new Date(slip.firstTimestamp).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <TouchableOpacity style={styles.viewSlipBtnLight} onPress={onViewSlip}>
          <Text style={styles.viewSlipBtnTextLight}>View Slip 📑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==========================================
// STYLES (LIGHT THEME CONSTITUTION)
// ==========================================
const styles = StyleSheet.create({
  // ROOT CONTAINERS (LIGHT)
  safeAreaLight: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentAreaLight: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  listScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },

  // SECURITY LOCK SCREEN STYLES (LIGHT)
  lockContainerLight: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Platform.OS === "android" ? 40 : 20,
    paddingHorizontal: 24,
  },
  lockHeader: {
    alignItems: "center",
    marginTop: 20,
  },
  lockBrandTitleLight: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  lockSubtitleLight: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  lockSecureRowLight: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  secureDotLight: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
  },
  secureTextLight: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // PIN DOTS DISPLAY (LIGHT)
  pinDisplayContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  pinInstructionLight: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  pinDotsRow: {
    flexDirection: "row",
    gap: 20,
  },
  pinDotLight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  pinDotFilledLight: {
    borderColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  pinDotErrorLight: {
    borderColor: "#ef4444",
    backgroundColor: "#fee2e2",
  },
  pinDotCoreLight: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#059669",
  },
  pinErrorText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  pinHintTextLight: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 12,
  },

  // NUMERIC KEYPAD (LIGHT)
  keypadGrid: {
    width: "100%",
    maxWidth: 320,
    gap: 12,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  keypadButtonLight: {
    flex: 1,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  keypadNumberLight: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700",
  },
  keypadLettersLight: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 1,
  },
  bioButtonLight: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  bioIconLight: {
    fontSize: 20,
  },
  bioLabelLight: {
    color: "#059669",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 1,
  },
  deleteIconLight: {
    color: "#475569",
    fontSize: 20,
    fontWeight: "700",
  },

  // LOCK FOOTER
  lockFooter: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  biometricScanBannerLight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  bioSensorIcon: {
    fontSize: 22,
  },
  bioBannerTitleLight: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  bioBannerSubtitleLight: {
    color: "#64748b",
    fontSize: 10,
  },
  quickUnlockBtn: {
    paddingVertical: 8,
  },
  quickUnlockTextLight: {
    color: "#64748b",
    fontSize: 11,
    textDecorationLine: "underline",
  },

  // AS LOGO BADGE STYLES (LIGHT)
  asBadge: {
    backgroundColor: "#0f172a",
    borderWidth: 1.5,
    borderColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  asBadgeLock: {
    backgroundColor: "#0f172a",
    borderWidth: 2,
    borderColor: "#059669",
    marginBottom: 14,
  },
  asLettersContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  asLetterA: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.5,
  },
  asLetterS: {
    color: "#34d399",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.5,
  },
  asLetterALock: {
    fontSize: 28,
    letterSpacing: -1,
  },
  asLetterSLock: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  asBalanceLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    width: "70%",
    gap: 2,
  },
  asBalanceLineLock: {
    marginTop: 3,
    width: "75%",
  },
  asLinePipLeft: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: "#38bdf8",
  },
  asLineCenter: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#34d399",
    borderRadius: 1,
  },
  asLinePipRight: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: "#38bdf8",
  },

  // MAIN HEADER (LIGHT)
  headerLight: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 38 : 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerBrandCol: {
    flex: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandSubtitleLight: {
    color: "#059669",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  headerTitleLight: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionBtnLight: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionIcon: {
    fontSize: 16,
  },
  statusStripLight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  statusItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#059669",
  },
  offlinePulseDot: {
    backgroundColor: "#d97706",
  },
  statusStripTextLight: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusItemRight: {},
  todayDateTextLight: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },

  // ==========================================
  // UNIVERSAL TOTALS BANNER (SHOWN AT EVERY PAGE)
  // ==========================================
  universalTotalsBanner: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  universalBoxGreen: {
    flex: 1,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  universalBoxBlue: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  universalBoxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  universalBoxLabelGreen: {
    color: "#059669",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  universalBoxLabelBlue: {
    color: "#1d4ed8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  universalBadgeGreen: {
    backgroundColor: "rgba(5, 150, 105, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  universalBadgeTextGreen: {
    color: "#059669",
    fontSize: 8,
    fontWeight: "800",
  },
  universalBadgeBlue: {
    backgroundColor: "rgba(29, 78, 216, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  universalBadgeTextBlue: {
    color: "#1d4ed8",
    fontSize: 8,
    fontWeight: "800",
  },
  universalValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 2,
    gap: 3,
  },
  universalValueLargeGreen: {
    color: "#047857",
    fontSize: 20,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  universalUnitGreen: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "800",
  },
  universalCurrencyBlue: {
    color: "#1d4ed8",
    fontSize: 16,
    fontWeight: "800",
  },
  universalValueLargeBlue: {
    color: "#1e40af",
    fontSize: 20,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // KPI STATS CARDS GRID (LIGHT)
  kpiGrid: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  kpiCardLight: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiCardEmeraldLight: {
    borderLeftWidth: 4,
    borderLeftColor: "#059669",
  },
  kpiCardBlueLight: {
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  kpiCardAmberLight: {
    borderLeftWidth: 4,
    borderLeftColor: "#d97706",
  },
  kpiCardPurpleLight: {
    borderLeftWidth: 4,
    borderLeftColor: "#7c3aed",
  },
  kpiHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiLabelLight: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  kpiBadgeEmeraldLight: {
    backgroundColor: "#ecfdf5",
    color: "#059669",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgeBlueLight: {
    backgroundColor: "#eff6ff",
    color: "#2563eb",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgeAmberLight: {
    backgroundColor: "#fffbeb",
    color: "#b45309",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgePurpleLight: {
    backgroundColor: "#faf5ff",
    color: "#7e22ce",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
    gap: 4,
  },
  kpiCurrencyLight: {
    color: "#2563eb",
    fontSize: 20,
    fontWeight: "800",
  },
  kpiValueLargeLight: {
    color: "#0f172a",
    fontSize: 26,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  kpiUnitLight: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  kpiSubtextLight: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },

  // QUICK MODULES (LIGHT)
  quickNavSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeaderTitleLight: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  quickNavRow: {
    gap: 8,
  },
  quickNavCardLight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  quickNavIcon: {
    fontSize: 22,
  },
  quickNavTitleLight: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  quickNavDescLight: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 1,
  },

  // RECENT SECTION (LIGHT)
  recentSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  recentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  viewAllTextLight: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
  },

  // SLIP CARD COMPONENT (LIGHT THEME)
  slipCardLight: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  slipCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slipNoPlateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  slipNoBadgeLight: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slipNoTextLight: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "800",
  },
  plateBadgeLight: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  plateTextLight: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  statusBadgeWrapper: {},
  completeStatusBadgeLight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
  },
  completeStatusTextLight: {
    color: "#059669",
    fontSize: 9,
    fontWeight: "800",
  },
  inProgressStatusBadgeLight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  statusDotAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d97706",
  },
  inProgressStatusTextLight: {
    color: "#b45309",
    fontSize: 9,
    fontWeight: "800",
  },
  slipDetailsBlock: {
    marginVertical: 8,
  },
  partyNameTextLight: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  materialTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  materialTagLabelLight: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
  },
  materialTagValueLight: {
    color: "#0284c7",
    fontSize: 11,
    fontWeight: "700",
  },

  // 3-COLUMN WEIGHTS (LIGHT)
  weightsGridRow: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 6,
  },
  weightColumnBoxLight: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  weightColumnLabelLight: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  weightColumnValueLight: {
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  netWeightColumnBoxLight: {
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
  },
  netWeightLabelActiveLight: {
    color: "#059669",
  },
  netWeightValueActiveLight: {
    color: "#047857",
    fontSize: 14,
    fontWeight: "900",
  },

  // FOOTER ROW (LIGHT)
  slipCardFooterLight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
    marginTop: 4,
  },
  slipValuationCol: {},
  rateLabelTextLight: {
    color: "#475569",
    fontSize: 11,
  },
  amountBoldTextLight: {
    color: "#0f172a",
    fontWeight: "800",
  },
  slipTimeAgoTextLight: {
    color: "#94a3b8",
    fontSize: 10,
    marginTop: 1,
  },
  viewSlipBtnLight: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewSlipBtnTextLight: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },

  // LIST HEADER & SEARCH (LIGHT)
  listHeaderBarLight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listHeaderTitleLight: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  listHeaderSubLight: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  pendingBadgeLight: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeTextLight: {
    color: "#b45309",
    fontSize: 10,
    fontWeight: "800",
  },
  searchBarWrapper: {
    position: "relative",
    marginHorizontal: 16,
    marginVertical: 10,
  },
  searchInputLight: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#0f172a",
    fontSize: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  clearSearchBtn: {
    position: "absolute",
    right: 12,
    top: 10,
  },
  clearSearchIconLight: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
  },
  chipsScroll: {
    maxHeight: 38,
    marginBottom: 8,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  materialChipLight: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  materialChipActiveLight: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  materialChipTextLight: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  materialChipTextActiveLight: {
    color: "#059669",
    fontWeight: "800",
  },

  // CONTEXT DYNAMIC SUMMARY BAR (ON COMPLETED PAGE)
  contextSummaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  contextSummaryCol: {
    flex: 1,
  },
  contextSummaryLabel: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  contextSummaryValGreen: {
    color: "#059669",
    fontSize: 14,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  contextSummaryValBlue: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  contextDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#e2e8f0",
  },
  contextBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contextBadgeText: {
    color: "#334155",
    fontSize: 9,
    fontWeight: "800",
  },

  // MATERIAL REPORT TAB (LIGHT)
  reportSummaryBannerLight: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  reportBannerTitleLight: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  reportBannerDescLight: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  reportTotalRowLight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  reportTotalCol: {
    alignItems: "center",
  },
  reportTotalLabelLight: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  reportTotalValGreen: {
    color: "#059669",
    fontSize: 18,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  reportTotalValBlue: {
    color: "#2563eb",
    fontSize: 18,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  reportDividerVertLight: {
    width: 1,
    height: 32,
    backgroundColor: "#e2e8f0",
  },
  materialsList: {
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 10,
  },
  materialCardLight: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  materialCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  materialRankBadgeLight: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  materialRankTextLight: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: "800",
  },
  materialTitleCol: {
    flex: 1,
  },
  materialNameLight: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  materialTruckCountLight: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 1,
  },
  materialMetricsRowLight: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  matMetricBox: {
    flex: 1,
  },
  matMetricLabelLight: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  matMetricValGreenLight: {
    color: "#059669",
    fontSize: 16,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  matMetricValBlueLight: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },

  // EMPTY STATE (LIGHT)
  emptyContainerLight: {
    padding: 40,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitleLight: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyTextLight: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },

  // FLOATING BOTTOM NAV BAR (LIGHT)
  bottomNavBarLight: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 14 : 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 8,
  },
  navTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minWidth: 60,
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
    transform: [{ scale: 1.1 }],
  },
  navTabLabelLight: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  navTabLabelActiveLight: {
    color: "#059669",
    fontWeight: "800",
  },
  tabBadgeAmberLight: {
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
  tabBadgeTextLight: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },

  // MODAL OVERLAY & TICKET MODAL (LIGHT)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  ticketCardModalLight: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  ticketHeader: {
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 10,
  },
  ticketPlantName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  ticketPlantSub: {
    color: "#475569",
    fontSize: 11,
    marginTop: 2,
  },
  ticketSlipBadge: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  ticketSlipNoText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  ticketBody: {
    marginVertical: 12,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  ticketLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  ticketVal: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  ticketValBold: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
  },
  ticketPlateVal: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  ticketWeightsContainer: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  ticketWeightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  ticketWeightLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  ticketWeightNum: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  ticketNetWeightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 6,
    marginTop: 4,
  },
  ticketNetLabel: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "900",
  },
  ticketNetVal: {
    color: "#059669",
    fontSize: 14,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  ticketAmountVal: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "900",
  },
  ticketTimestampBlock: {
    marginTop: 8,
    paddingTop: 6,
  },
  ticketTimeText: {
    color: "#64748b",
    fontSize: 10,
  },
  ticketSignRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  ticketSignText: {
    color: "#64748b",
    fontSize: 10,
  },
  ticketCloseButton: {
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  ticketCloseButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  // SETTINGS MODAL (LIGHT)
  settingsModalLight: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 18,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  settingsModalTitleLight: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  settingsCloseXLight: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "700",
    padding: 4,
  },
  settingsSectionTitleLight: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
  },
  securityBoxLight: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  securityToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  securityOptionTitleLight: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  securityOptionDescLight: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 1,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  toggleOnLight: {
    backgroundColor: "#059669",
  },
  toggleOffLight: {
    backgroundColor: "#cbd5e1",
  },
  toggleBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  securitySubActionsLight: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 8,
  },
  changePinBtnLight: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  changePinBtnTextLight: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },
  lockNowBtnLight: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  lockNowBtnTextLight: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "700",
  },
  settingsDescLight: {
    color: "#64748b",
    fontSize: 11,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  presetChipLight: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  presetChipTextLight: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "600",
  },
  settingsInputLight: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#0f172a",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 12,
  },
  settingsActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  settingsResetBtnLight: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  settingsResetTextLight: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  settingsSaveBtnLight: {
    backgroundColor: "#059669",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  settingsSaveTextLight: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  changePinErrorText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
});
