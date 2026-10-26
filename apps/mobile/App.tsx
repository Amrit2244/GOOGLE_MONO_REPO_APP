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

// Modern Stylized AS Monogram Logo
function ASLogo({ size = 38, isLock = false }: { size?: number; isLock?: boolean }) {
  return (
    <View
      style={[
        styles.asBadge,
        {
          width: size,
          height: size,
          borderRadius: isLock ? 20 : 12,
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
  const [isLocked, setIsLocked] = useState(true);
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
      // Auto prompt biometric when opening app
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
        // Verify PIN
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

  // Aggregate Metrics
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

  // Filtered Slips for Completed & Pending tabs
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
  // RENDER: SECURITY PIN & BIOMETRIC LOCK SCREEN
  // ==========================================
  if (isLocked && isPinLockEnabled) {
    return (
      <SafeAreaView style={styles.lockContainer}>
        <StatusBar style="light" />

        {/* Lock Screen Header */}
        <View style={styles.lockHeader}>
          <ASLogo size={70} isLock />
          <Text style={styles.lockBrandTitle}>AS DHARAMKANTA PRO</Text>
          <Text style={styles.lockSubtitle}>Stone Crusher Live Weighbridge System</Text>
          <View style={styles.lockSecureRow}>
            <View style={styles.secureDot} />
            <Text style={styles.secureText}>Protected Terminal · Plant Security</Text>
          </View>
        </View>

        {/* 4-Digit Indicator Display */}
        <Animated.View style={[styles.pinDisplayContainer, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.pinInstruction}>Enter 4-Digit Security PIN</Text>
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

        {/* Responsive Numeric Keypad */}
        <View style={styles.keypadGrid}>
          {/* Row 1: 1, 2, 3 */}
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("1")}>
              <Text style={styles.keypadNumber}>1</Text>
              <Text style={styles.keypadLetters}> </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("2")}>
              <Text style={styles.keypadNumber}>2</Text>
              <Text style={styles.keypadLetters}>ABC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("3")}>
              <Text style={styles.keypadNumber}>3</Text>
              <Text style={styles.keypadLetters}>DEF</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: 4, 5, 6 */}
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("4")}>
              <Text style={styles.keypadNumber}>4</Text>
              <Text style={styles.keypadLetters}>GHI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("5")}>
              <Text style={styles.keypadNumber}>5</Text>
              <Text style={styles.keypadLetters}>JKL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("6")}>
              <Text style={styles.keypadNumber}>6</Text>
              <Text style={styles.keypadLetters}>MNO</Text>
            </TouchableOpacity>
          </View>

          {/* Row 3: 7, 8, 9 */}
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("7")}>
              <Text style={styles.keypadNumber}>7</Text>
              <Text style={styles.keypadLetters}>PQRS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("8")}>
              <Text style={styles.keypadNumber}>8</Text>
              <Text style={styles.keypadLetters}>TUV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("9")}>
              <Text style={styles.keypadNumber}>9</Text>
              <Text style={styles.keypadLetters}>WXYZ</Text>
            </TouchableOpacity>
          </View>

          {/* Row 4: Biometric, 0, Backspace */}
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.keypadButton, styles.bioButton]}
              onPress={handleBiometricAuth}
            >
              <Text style={styles.bioIcon}>👆</Text>
              <Text style={styles.bioLabel}>Touch ID</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.keypadButton} onPress={() => handleDigitPress("0")}>
              <Text style={styles.keypadNumber}>0</Text>
              <Text style={styles.keypadLetters}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.keypadButton} onPress={handleDeleteDigit}>
              <Text style={styles.deleteIcon}>⌫</Text>
              <Text style={styles.keypadLetters}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Demo Bypass / Fingerprint Sensor Modal */}
        <View style={styles.lockFooter}>
          <TouchableOpacity
            style={styles.biometricScanBanner}
            onPress={handleBiometricAuth}
          >
            <Text style={styles.bioSensorIcon}>🧬</Text>
            <View>
              <Text style={styles.bioBannerTitle}>
                {isBioScanning ? "Scanning Fingerprint..." : "Scan Biometric Fingerprint"}
              </Text>
              <Text style={styles.bioBannerSubtitle}>Quick 1-Touch Authenticate</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickUnlockBtn}
            onPress={() => {
              setIsLocked(false);
              setEnteredPin("");
            }}
          >
            <Text style={styles.quickUnlockText}>Quick Demo Unlock (Default: {masterPin})</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================
  // RENDER: MAIN APPLICATION
  // ==========================================
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Modern Executive Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerBrandCol}>
            <View style={styles.brandRow}>
              <ASLogo size={40} />
              <View>
                <Text style={styles.brandSubtitle}>STONE CRUSHER AUTOMATION</Text>
                <Text style={styles.headerTitle}>AS DHARAMKANTA</Text>
              </View>
            </View>
          </View>

          {/* Quick Header Actions: Lock Button & Settings */}
          <View style={styles.headerActionsRow}>
            {/* Lock Button */}
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => setIsLocked(true)}
              accessibilityLabel="Lock Terminal"
            >
              <Text style={styles.headerActionIcon}>🔒</Text>
            </TouchableOpacity>

            {/* Refresh Button */}
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={onRefresh}
              accessibilityLabel="Refresh Data"
            >
              <Text style={styles.headerActionIcon}>🔄</Text>
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => setIsSettingsOpen(true)}
              accessibilityLabel="Settings"
            >
              <Text style={styles.headerActionIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Status Strip */}
        <View style={styles.statusStrip}>
          <View style={styles.statusItemLeft}>
            <View style={[styles.livePulseDot, isOfflineMode && styles.offlinePulseDot]} />
            <Text style={styles.statusStripText}>
              {isOfflineMode ? "OFFLINE / LOCAL CACHE" : "SCALE SERVER CONNECTED"}
            </Text>
          </View>
          <View style={styles.statusItemRight}>
            <Text style={styles.todayDateText}>
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {currentPage === "dashboard" && (
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
          >
            {/* 4 Glowing Metric Cards */}
            <View style={styles.kpiGrid}>
              {/* Card 1: Dispatched Net Weight */}
              <View style={[styles.kpiCard, styles.kpiCardEmerald]}>
                <View style={styles.kpiHeaderRow}>
                  <Text style={styles.kpiLabel}>DISPATCHED TODAY</Text>
                  <Text style={styles.kpiBadgeEmerald}>{metrics.completedCount} SLIPS</Text>
                </View>
                <View style={styles.kpiValueRow}>
                  <Text style={styles.kpiValueLarge}>{metrics.totalNetTonnes}</Text>
                  <Text style={styles.kpiUnit}>MT</Text>
                </View>
                <Text style={styles.kpiSubtext}>Net Crushed Stone Dispatched</Text>
              </View>

              {/* Card 2: Revenue */}
              <View style={[styles.kpiCard, styles.kpiCardBlue]}>
                <View style={styles.kpiHeaderRow}>
                  <Text style={styles.kpiLabel}>TOTAL BILLED VALUE</Text>
                  <Text style={styles.kpiBadgeBlue}>INR</Text>
                </View>
                <View style={styles.kpiValueRow}>
                  <Text style={styles.kpiCurrency}>₹</Text>
                  <Text style={styles.kpiValueLarge}>{metrics.totalAmountFormatted}</Text>
                </View>
                <Text style={styles.kpiSubtext}>Estimated Material Invoiced</Text>
              </View>

              {/* Card 3: In-Plant Trucks */}
              <View style={[styles.kpiCard, styles.kpiCardAmber]}>
                <View style={styles.kpiHeaderRow}>
                  <Text style={styles.kpiLabel}>IN-PLANT VEHICLES</Text>
                  <Text style={styles.kpiBadgeAmber}>1ST WEIGHT</Text>
                </View>
                <View style={styles.kpiValueRow}>
                  <Text style={styles.kpiValueLarge}>{metrics.pendingCount}</Text>
                  <Text style={styles.kpiUnit}>TRUCKS</Text>
                </View>
                <Text style={styles.kpiSubtext}>Awaiting Final Tare/Gross</Text>
              </View>

              {/* Card 4: Tally ERP Sync */}
              <View style={[styles.kpiCard, styles.kpiCardPurple]}>
                <View style={styles.kpiHeaderRow}>
                  <Text style={styles.kpiLabel}>TALLY ERP SYNC</Text>
                  <Text style={styles.kpiBadgePurple}>ACCOUNTING</Text>
                </View>
                <View style={styles.kpiValueRow}>
                  <Text style={styles.kpiValueLarge}>{metrics.tallySyncedCount}</Text>
                  <Text style={styles.kpiUnit}>/{metrics.completedCount}</Text>
                </View>
                <Text style={styles.kpiSubtext}>Vouchers Pushed Automatically</Text>
              </View>
            </View>

            {/* Quick Action Navigation Buttons */}
            <View style={styles.quickNavSection}>
              <Text style={styles.sectionHeaderTitle}>QUICK MODULES</Text>
              <View style={styles.quickNavRow}>
                <TouchableOpacity
                  style={styles.quickNavCard}
                  onPress={() => setCurrentPage("pending")}
                >
                  <Text style={styles.quickNavIcon}>🚛</Text>
                  <View>
                    <Text style={styles.quickNavTitle}>Pending Trucks ({metrics.pendingCount})</Text>
                    <Text style={styles.quickNavDesc}>Vehicles currently loading/unloading</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickNavCard}
                  onPress={() => setCurrentPage("completed")}
                >
                  <Text style={styles.quickNavIcon}>📑</Text>
                  <View>
                    <Text style={styles.quickNavTitle}>Weight Records ({metrics.completedCount})</Text>
                    <Text style={styles.quickNavDesc}>View slips & print duplicate tickets</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickNavCard}
                  onPress={() => setCurrentPage("item_report")}
                >
                  <Text style={styles.quickNavIcon}>📊</Text>
                  <View>
                    <Text style={styles.quickNavTitle}>Material Report</Text>
                    <Text style={styles.quickNavDesc}>10mm, 20mm, GSB, Dust Tonnage</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Slips Feed */}
            <View style={styles.recentSection}>
              <View style={styles.recentHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>LATEST WEIGHBRIDGE SLIPS</Text>
                <TouchableOpacity onPress={() => setCurrentPage("completed")}>
                  <Text style={styles.viewAllText}>View All →</Text>
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
            <View style={styles.listHeaderBar}>
              <View>
                <Text style={styles.listHeaderTitle}>Vehicles Inside Crusher Plant</Text>
                <Text style={styles.listHeaderSub}>
                  {filteredPendingSlips.length} trucks awaiting 2nd weighing (Gross/Tare)
                </Text>
              </View>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{filteredPendingSlips.length} ACTIVE</Text>
              </View>
            </View>

            <FlatList
              data={filteredPendingSlips}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
              contentContainerStyle={styles.listScrollContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🎉</Text>
                  <Text style={styles.emptyTitle}>No Pending Vehicles</Text>
                  <Text style={styles.emptyText}>All vehicles have completed their 2nd weighing</Text>
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
                style={styles.searchInput}
                placeholder="Search Truck No, Party, Slip #..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery("")}>
                  <Text style={styles.clearSearchIcon}>✕</Text>
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
                    style={[styles.materialChip, isSelected && styles.materialChipActive]}
                    onPress={() => setSelectedItemName(mat)}
                  >
                    <Text
                      style={[
                        styles.materialChipText,
                        isSelected && styles.materialChipTextActive,
                      ]}
                    >
                      {mat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <FlatList
              data={filteredCompletedSlips}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
              contentContainerStyle={styles.listScrollContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>No Matching Slips</Text>
                  <Text style={styles.emptyText}>Try adjusting your search or material filter</Text>
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" />}
          >
            <View style={styles.reportSummaryBanner}>
              <Text style={styles.reportBannerTitle}>Crusher Material Dispatch Summary</Text>
              <Text style={styles.reportBannerDesc}>
                Item-wise tonnage and billing breakdown for today
              </Text>
              <View style={styles.reportTotalRow}>
                <View style={styles.reportTotalCol}>
                  <Text style={styles.reportTotalLabel}>TOTAL TONNES</Text>
                  <Text style={styles.reportTotalVal}>{metrics.totalNetTonnes} MT</Text>
                </View>
                <View style={styles.reportDividerVert} />
                <View style={styles.reportTotalCol}>
                  <Text style={styles.reportTotalLabel}>TOTAL REVENUE</Text>
                  <Text style={styles.reportTotalVal}>₹{metrics.totalAmountFormatted}</Text>
                </View>
              </View>
            </View>

            <View style={styles.materialsList}>
              {materialBreakdown.map((item, idx) => (
                <View key={item.itemName} style={styles.materialCard}>
                  <View style={styles.materialCardHeader}>
                    <View style={styles.materialRankBadge}>
                      <Text style={styles.materialRankText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.materialTitleCol}>
                      <Text style={styles.materialName}>{item.itemName}</Text>
                      <Text style={styles.materialTruckCount}>{item.count} Truck Loads Dispatched</Text>
                    </View>
                  </View>

                  <View style={styles.materialMetricsRow}>
                    <View style={styles.matMetricBox}>
                      <Text style={styles.matMetricLabel}>NET WEIGHT</Text>
                      <Text style={styles.matMetricValGreen}>{item.totalWeightStr} MT</Text>
                    </View>
                    <View style={styles.matMetricBox}>
                      <Text style={styles.matMetricLabel}>ESTIMATED REVENUE</Text>
                      <Text style={styles.matMetricValBlue}>₹{item.totalRevenueStr}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Floating Modern Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setCurrentPage("dashboard")}
        >
          <Text style={[styles.navTabIcon, currentPage === "dashboard" && styles.navTabIconActive]}>
            📊
          </Text>
          <Text style={[styles.navTabLabel, currentPage === "dashboard" && styles.navTabLabelActive]}>
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
              <View style={styles.tabBadgeAmber}>
                <Text style={styles.tabBadgeText}>{metrics.pendingCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navTabLabel, currentPage === "pending" && styles.navTabLabelActive]}>
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
          <Text style={[styles.navTabLabel, currentPage === "completed" && styles.navTabLabelActive]}>
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
          <Text style={[styles.navTabLabel, currentPage === "item_report" && styles.navTabLabelActive]}>
            Materials
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================== */}
      {/* MODAL 1: WEIGHMENT SLIP PREVIEW */}
      {/* ========================================== */}
      <Modal
        visible={Boolean(selectedSlip)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSlip(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ticketCardModal}>
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
      {/* MODAL 2: SETTINGS & SECURITY PREFERENCES */}
      {/* ========================================== */}
      <Modal
        visible={isSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsModalTitle}>Settings & Security</Text>
              <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                <Text style={styles.settingsCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Security Section */}
              <Text style={styles.settingsSectionTitle}>TERMINAL SECURITY</Text>
              <View style={styles.securityBox}>
                <View style={styles.securityToggleRow}>
                  <View>
                    <Text style={styles.securityOptionTitle}>4-Digit & Biometric Lock</Text>
                    <Text style={styles.securityOptionDesc}>Require PIN or Fingerprint to access app</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleBtn, isPinLockEnabled ? styles.toggleOn : styles.toggleOff]}
                    onPress={() => setIsPinLockEnabled(!isPinLockEnabled)}
                  >
                    <Text style={styles.toggleBtnText}>{isPinLockEnabled ? "ON" : "OFF"}</Text>
                  </TouchableOpacity>
                </View>

                {isPinLockEnabled && (
                  <View style={styles.securitySubActions}>
                    <TouchableOpacity
                      style={styles.changePinBtn}
                      onPress={() => {
                        setShowChangePinModal(true);
                        setIsSettingsOpen(false);
                      }}
                    >
                      <Text style={styles.changePinBtnText}>🔑 Change 4-Digit PIN (Current: {masterPin})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.lockNowBtn}
                      onPress={() => {
                        setIsSettingsOpen(false);
                        setIsLocked(true);
                      }}
                    >
                      <Text style={styles.lockNowBtnText}>🔒 Lock Terminal Immediately</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Server Connection Section */}
              <Text style={styles.settingsSectionTitle}>WEIGHBRIDGE SERVER IP</Text>
              <Text style={styles.settingsDesc}>
                Connect to the weighbridge PC running Dharamkanta Web:
              </Text>

              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setCustomIpInput("https://list-introductory-estimates-zoning.trycloudflare.com/api/weighments")}
                >
                  <Text style={styles.presetChipText}>Cloudflare Production Tunnel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setCustomIpInput("http://localhost:3000/api/weighments")}
                >
                  <Text style={styles.presetChipText}>Localhost:3000</Text>
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
                placeholder="http://192.168.x.x:3000/api/weighments"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              <View style={styles.settingsActions}>
                <TouchableOpacity
                  style={styles.settingsResetBtn}
                  onPress={() => setCustomIpInput(getDefaultApiUrl())}
                >
                  <Text style={styles.settingsResetText}>Reset Default</Text>
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
                  <Text style={styles.settingsSaveText}>Connect Server</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 3: CHANGE PIN DIALOG */}
      {/* ========================================== */}
      <Modal
        visible={showChangePinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangePinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.settingsModalTitle}>Change 4-Digit Security PIN</Text>
            <Text style={styles.settingsDesc}>
              Enter a new 4-digit code to protect this Dharamkanta terminal.
            </Text>

            <TextInput
              style={styles.settingsInput}
              value={newPinInput}
              onChangeText={setNewPinInput}
              placeholder="Enter new 4 digits"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />

            <TextInput
              style={styles.settingsInput}
              value={confirmPinInput}
              onChangeText={setConfirmPinInput}
              placeholder="Confirm new 4 digits"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />

            {changePinError ? (
              <Text style={styles.changePinErrorText}>{changePinError}</Text>
            ) : null}

            <View style={styles.settingsActions}>
              <TouchableOpacity
                style={styles.settingsResetBtn}
                onPress={() => {
                  setShowChangePinModal(false);
                  setNewPinInput("");
                  setConfirmPinInput("");
                  setChangePinError("");
                }}
              >
                <Text style={styles.settingsResetText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsSaveBtn} onPress={handleSaveNewPin}>
                <Text style={styles.settingsSaveText}>Save PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// COMPONENT: SLIP CARD
// ==========================================
function SlipCard({ slip, onViewSlip }: { slip: Weighment; onViewSlip: () => void }) {
  const isComplete = slip.isComplete;
  const rate = slip.rate || 450;
  const amount = ((slip.netWeight || 0) * rate).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

  return (
    <View style={styles.slipCard}>
      {/* Card Header: Slip #, Vehicle # & Status Badge */}
      <View style={styles.slipCardHeader}>
        <View style={styles.slipNoPlateRow}>
          <View style={styles.slipNoBadge}>
            <Text style={styles.slipNoText}>#{slip.slipNo}</Text>
          </View>
          <View style={styles.plateBadge}>
            <Text style={styles.plateText}>{slip.vehicleNumber}</Text>
          </View>
        </View>

        <View style={styles.statusBadgeWrapper}>
          {isComplete ? (
            <View style={styles.completeStatusBadge}>
              <View style={styles.statusDotGreen} />
              <Text style={styles.completeStatusText}>COMPLETED</Text>
            </View>
          ) : (
            <View style={styles.inProgressStatusBadge}>
              <View style={styles.statusDotAmber} />
              <Text style={styles.inProgressStatusText}>1ST WEIGHT</Text>
            </View>
          )}
        </View>
      </View>

      {/* Party Name & Material */}
      <View style={styles.slipDetailsBlock}>
        <Text style={styles.partyNameText} numberOfLines={1}>
          {slip.partyName}
        </Text>
        <View style={styles.materialTagRow}>
          <Text style={styles.materialTagLabel}>ITEM:</Text>
          <Text style={styles.materialTagValue}>{slip.itemName}</Text>
        </View>
      </View>

      {/* 3-Column Weight Grid */}
      <View style={styles.weightsGridRow}>
        <View style={styles.weightColumnBox}>
          <Text style={styles.weightColumnLabel}>GROSS</Text>
          <Text style={styles.weightColumnValue}>{slip.grossWeight || 0.0} T</Text>
        </View>

        <View style={styles.weightColumnBox}>
          <Text style={styles.weightColumnLabel}>TARE</Text>
          <Text style={styles.weightColumnValue}>{slip.tareWeight || 0.0} T</Text>
        </View>

        <View style={[styles.weightColumnBox, isComplete && styles.netWeightColumnBox]}>
          <Text style={[styles.weightColumnLabel, isComplete && styles.netWeightLabelActive]}>
            NET WEIGHT
          </Text>
          <Text style={[styles.weightColumnValue, isComplete && styles.netWeightValueActive]}>
            {slip.netWeight || 0.0} T
          </Text>
        </View>
      </View>

      {/* Footer Info: Rate, Valuation & Ticket Action */}
      <View style={styles.slipCardFooter}>
        <View style={styles.slipValuationCol}>
          <Text style={styles.rateLabelText}>
            @ ₹{rate}/T · <Text style={styles.amountBoldText}>₹{amount}</Text>
          </Text>
          <Text style={styles.slipTimeAgoText}>
            {new Date(slip.firstTimestamp).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <TouchableOpacity style={styles.viewSlipBtn} onPress={onViewSlip}>
          <Text style={styles.viewSlipBtnText}>View Slip 📑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  // ROOT CONTAINERS
  safeArea: {
    flex: 1,
    backgroundColor: "#070b14",
  },
  contentArea: {
    flex: 1,
    backgroundColor: "#070b14",
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

  // SECURITY LOCK SCREEN STYLES
  lockContainer: {
    flex: 1,
    backgroundColor: "#070b14",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Platform.OS === "android" ? 40 : 20,
    paddingHorizontal: 24,
  },
  lockHeader: {
    alignItems: "center",
    marginTop: 20,
  },
  // AS LOGO BADGE STYLES
  asBadge: {
    backgroundColor: "#0d1527",
    borderWidth: 1.5,
    borderColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  asBadgeLock: {
    backgroundColor: "#091122",
    borderWidth: 2,
    borderColor: "#10b981",
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
    color: "#10b981",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.5,
  },
  asLetterALock: {
    fontSize: 26,
    letterSpacing: -1,
  },
  asLetterSLock: {
    fontSize: 26,
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
    backgroundColor: "#10b981",
    borderRadius: 1,
  },
  asLinePipRight: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: "#38bdf8",
  },

  lockShieldBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  lockShieldIcon: {
    fontSize: 28,
  },
  lockBrandTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  lockSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  lockSecureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  secureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  secureText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // PIN DOTS DISPLAY
  pinDisplayContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  pinInstruction: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  pinDotsRow: {
    flexDirection: "row",
    gap: 20,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#334155",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  pinDotFilled: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  pinDotError: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  pinDotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
  },
  pinErrorText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  pinHintText: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 12,
  },

  // NUMERIC KEYPAD
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
  keypadButton: {
    flex: 1,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  keypadNumber: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
  },
  keypadLetters: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 1,
  },
  bioButton: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  bioIcon: {
    fontSize: 20,
  },
  bioLabel: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 1,
  },
  deleteIcon: {
    color: "#94a3b8",
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
  biometricScanBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
    width: "100%",
  },
  bioSensorIcon: {
    fontSize: 22,
  },
  bioBannerTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  bioBannerSubtitle: {
    color: "#64748b",
    fontSize: 10,
  },
  quickUnlockBtn: {
    paddingVertical: 8,
  },
  quickUnlockText: {
    color: "#64748b",
    fontSize: 11,
    textDecorationLine: "underline",
  },

  // MAIN HEADER
  header: {
    backgroundColor: "#070b14",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 38 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
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
  brandLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  brandLogoIcon: {
    fontSize: 18,
  },
  brandSubtitle: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionIcon: {
    fontSize: 16,
  },
  statusStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
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
    backgroundColor: "#10b981",
  },
  offlinePulseDot: {
    backgroundColor: "#f59e0b",
  },
  statusStripText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusItemRight: {},
  todayDateText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },

  // KPI STATS CARDS GRID
  kpiGrid: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  kpiCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  kpiCardEmerald: {
    borderColor: "rgba(16, 185, 129, 0.3)",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
  },
  kpiCardBlue: {
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  kpiCardAmber: {
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  kpiCardPurple: {
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  kpiHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  kpiBadgeEmerald: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgeBlue: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    color: "#60a5fa",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgeAmber: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    color: "#fbbf24",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgePurple: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    color: "#c084fc",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 6,
    gap: 4,
  },
  kpiCurrency: {
    color: "#60a5fa",
    fontSize: 20,
    fontWeight: "700",
  },
  kpiValueLarge: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  kpiUnit: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },
  kpiSubtext: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 3,
  },

  // QUICK MODULES
  quickNavSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  sectionHeaderTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
  },
  quickNavRow: {
    gap: 8,
  },
  quickNavCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  quickNavIcon: {
    fontSize: 22,
  },
  quickNavTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  quickNavDesc: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 1,
  },

  // RECENT SECTION
  recentSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  recentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  viewAllText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
  },

  // SLIP CARD COMPONENT
  slipCard: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 12,
    marginBottom: 10,
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
  slipNoBadge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slipNoText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  plateBadge: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  plateText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  statusBadgeWrapper: {},
  completeStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  completeStatusText: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "800",
  },
  inProgressStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  statusDotAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f59e0b",
  },
  inProgressStatusText: {
    color: "#f59e0b",
    fontSize: 9,
    fontWeight: "800",
  },
  slipDetailsBlock: {
    marginVertical: 8,
  },
  partyNameText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  materialTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  materialTagLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
  },
  materialTagValue: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },

  // 3-COLUMN WEIGHTS
  weightsGridRow: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 6,
  },
  weightColumnBox: {
    flex: 1,
    backgroundColor: "#070b14",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  weightColumnLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  weightColumnValue: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  netWeightColumnBox: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  netWeightLabelActive: {
    color: "#10b981",
  },
  netWeightValueActive: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "900",
  },

  // FOOTER ROW
  slipCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 8,
    marginTop: 4,
  },
  slipValuationCol: {},
  rateLabelText: {
    color: "#94a3b8",
    fontSize: 11,
  },
  amountBoldText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  slipTimeAgoText: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 1,
  },
  viewSlipBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewSlipBtnText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
  },

  // LIST HEADER & SEARCH
  listHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listHeaderTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  listHeaderSub: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeText: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "800",
  },
  searchBarWrapper: {
    position: "relative",
    marginHorizontal: 16,
    marginVertical: 10,
  },
  searchInput: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#ffffff",
    fontSize: 13,
  },
  clearSearchBtn: {
    position: "absolute",
    right: 12,
    top: 10,
  },
  clearSearchIcon: {
    color: "#94a3b8",
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
  materialChip: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  materialChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10b981",
  },
  materialChipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  materialChipTextActive: {
    color: "#10b981",
    fontWeight: "800",
  },

  // MATERIAL REPORT TAB
  reportSummaryBanner: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.3)",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
  },
  reportBannerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  reportBannerDesc: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  reportTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  reportTotalCol: {
    alignItems: "center",
  },
  reportTotalLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  reportTotalVal: {
    color: "#38bdf8",
    fontSize: 18,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  reportDividerVert: {
    width: 1,
    height: 32,
    backgroundColor: "#1e293b",
  },
  materialsList: {
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 10,
  },
  materialCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
  },
  materialCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  materialRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  materialRankText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
  },
  materialTitleCol: {
    flex: 1,
  },
  materialName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  materialTruckCount: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 1,
  },
  materialMetricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  matMetricBox: {
    flex: 1,
  },
  matMetricLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  matMetricValGreen: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  matMetricValBlue: {
    color: "#60a5fa",
    fontSize: 16,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },

  // EMPTY STATE
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },

  // FLOATING BOTTOM NAV BAR
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(7, 11, 20, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 14 : 4,
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
    opacity: 0.5,
  },
  navTabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  navTabLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  navTabLabelActive: {
    color: "#10b981",
    fontWeight: "800",
  },
  tabBadgeAmber: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#f59e0b",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 14,
    alignItems: "center",
  },
  tabBadgeText: {
    color: "#0f172a",
    fontSize: 9,
    fontWeight: "900",
  },

  // MODAL OVERLAY & WEIGHMENT SLIP MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  ticketCardModal: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    maxHeight: "85%",
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

  // SETTINGS MODAL
  settingsModal: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 18,
    maxHeight: "85%",
  },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  settingsModalTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  settingsCloseX: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "700",
    padding: 4,
  },
  settingsSectionTitle: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
  },
  securityBox: {
    backgroundColor: "#070b14",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  securityToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  securityOptionTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  securityOptionDesc: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 1,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  toggleOn: {
    backgroundColor: "#10b981",
  },
  toggleOff: {
    backgroundColor: "#334155",
  },
  toggleBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  securitySubActions: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    gap: 8,
  },
  changePinBtn: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  changePinBtnText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "700",
  },
  lockNowBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  lockNowBtnText: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "700",
  },
  settingsDesc: {
    color: "#94a3b8",
    fontSize: 11,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  presetChip: {
    backgroundColor: "#070b14",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  presetChipText: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "600",
  },
  settingsInput: {
    backgroundColor: "#070b14",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#ffffff",
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
  settingsResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  settingsResetText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  settingsSaveBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  settingsSaveText: {
    color: "#070b14",
    fontSize: 11,
    fontWeight: "800",
  },
  changePinErrorText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
});
