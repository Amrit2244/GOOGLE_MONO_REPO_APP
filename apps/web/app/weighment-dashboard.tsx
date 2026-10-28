"use client";

import { useState, useMemo } from "react";
import type { Weighment } from "@repo/database";

interface WeighmentDashboardProps {
  initialWeighments: Weighment[];
}

export function WeighmentDashboard({ initialWeighments }: WeighmentDashboardProps) {
  const [weighments, setWeighments] = useState<Weighment[]>(initialWeighments);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "complete" | "pending" | "tally_pending">("all");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("all");
  const [selectedSlip, setSelectedSlip] = useState<Weighment | null>(null);
  const [isNewSlipModalOpen, setIsNewSlipModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncingSlipId, setSyncingSlipId] = useState<number | null>(null);

  // New slip form state (Inputs are in QTL)
  const [formData, setFormData] = useState({
    slipNo: "",
    partyName: "",
    vehicleNumber: "",
    itemName: "10mm Blue Metal",
    firstWeightType: "Tare",
    tareWeight: "",
    grossWeight: "",
    rate: "45", // e.g. ₹45/QTL = ₹450/MT
  });

  // Calculate distinct materials
  const materials = useMemo(() => {
    const set = new Set<string>();
    weighments.forEach((w) => {
      if (w.itemName) set.add(w.itemName);
    });
    return Array.from(set);
  }, [weighments]);

  // Real-time filtering
  const filteredWeighments = useMemo(() => {
    return weighments.filter((w) => {
      // Status filter
      if (statusFilter === "complete" && !w.isComplete) return false;
      if (statusFilter === "pending" && w.isComplete) return false;
      if (statusFilter === "tally_pending" && (!w.isComplete || w.tallySynced)) return false;

      // Material filter
      if (selectedMaterial !== "all" && w.itemName !== selectedMaterial) return false;

      // Search query filter (matches Party, Vehicle, Item, or Slip No)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const party = (w.partyName || "").toLowerCase();
        const vehicle = (w.vehicleNumber || "").toLowerCase();
        const item = (w.itemName || "").toLowerCase();
        const slip = String(w.slipNo);

        const match = party.includes(query) || vehicle.includes(query) || item.includes(query) || slip.includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [weighments, statusFilter, selectedMaterial, searchQuery]);

  // Aggregate KPI stats (DB stores MT, UI converts to QTL)
  const stats = useMemo(() => {
    const totalSlips = weighments.length;
    const completedSlips = weighments.filter((w) => w.isComplete);
    const inPlantSlips = weighments.filter((w) => !w.isComplete);
    const tallyPendingSlips = weighments.filter((w) => w.isComplete && !w.tallySynced);
    
    // Sums in Metric Tons (MT)
    const totalNetWeightMT = completedSlips.reduce((acc, curr) => acc + (curr.netWeight || 0), 0);
    const totalGrossWeightMT = completedSlips.reduce((acc, curr) => acc + (curr.grossWeight || 0), 0);

    return {
      totalSlips,
      completedCount: completedSlips.length,
      inPlantCount: inPlantSlips.length,
      tallyPendingCount: tallyPendingSlips.length,
      totalNetWeightQtl: (totalNetWeightMT * 10).toFixed(2), // Convert MT to QTL
      totalNetWeightMT: totalNetWeightMT.toFixed(2),
      totalGrossWeightQtl: (totalGrossWeightMT * 10).toFixed(2), // Convert MT to QTL
    };
  }, [weighments]);

  // Refresh data from API
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/weighments");
      if (res.ok) {
        const data = await res.json();
        setWeighments(data);
      }
    } catch (err) {
      console.error("Failed to refresh weighments:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Sync to Tally ERP
  const handleSyncToTally = async (slipNo: number) => {
    setSyncingSlipId(slipNo);
    try {
      const res = await fetch("/api/tally/mark-synced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slipNo }),
      });
      if (res.ok) {
        setWeighments((prev) =>
          prev.map((w) =>
            w.slipNo === slipNo
              ? {
                  ...w,
                  tallySynced: true,
                  tallySyncedAt: new Date(),
                  tallyVoucherNo: `VCH-${new Date().getFullYear()}-${slipNo}`,
                }
              : w
          )
        );
      }
    } catch (err) {
      console.error("Failed to sync slip with Tally:", err);
    } finally {
      setSyncingSlipId(null);
    }
  };

  // Export to CSV (Converted to QTL)
  const handleExportCSV = () => {
    if (filteredWeighments.length === 0) return;
    const headers = [
      "Slip No",
      "Status",
      "Party Name",
      "Vehicle Number",
      "Item Name",
      "Gross Wt (QTL)",
      "Tare Wt (QTL)",
      "Net Wt (QTL)",
      "Rate per QTL (INR)",
      "Total Amount (INR)",
      "Timestamp",
      "Tally Synced",
    ];

    const rows = filteredWeighments.map((w) => [
      w.slipNo,
      w.isComplete ? "Complete" : "1st Wt Only",
      `"${w.partyName.replace(/"/g, '""')}"`,
      w.vehicleNumber,
      `"${w.itemName.replace(/"/g, '""')}"`,
      ((w.grossWeight || 0) * 10).toFixed(2), // MT to QTL
      ((w.tareWeight || 0) * 10).toFixed(2),  // MT to QTL
      ((w.netWeight || 0) * 10).toFixed(2),   // MT to QTL
      ((w.rate || 0) / 10).toFixed(2),        // Rate/MT to Rate/QTL
      ((w.netWeight || 0) * (w.rate || 0)).toFixed(2),
      new Date(w.firstTimestamp).toISOString(),
      w.tallySynced ? "YES" : "NO",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `weighbridge_slips_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit New Slip (Converts User QTL Input to DB MT)
  const handleCreateSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    const slipNumber = parseInt(formData.slipNo, 10) || Math.floor(1000 + Math.random() * 9000);
    
    // User inputs QTL -> Convert to MT for Database
    const grossInputQtl = parseFloat(formData.grossWeight) || 0;
    const tareInputQtl = parseFloat(formData.tareWeight) || 0;
    const rateInputQtl = parseFloat(formData.rate) || 0;

    const gross = grossInputQtl / 10;
    const tare = tareInputQtl / 10;
    const rate = rateInputQtl * 10;
    
    const isComplete = gross > 0 && tare > 0 && gross > tare;
    const net = isComplete ? gross - tare : 0;

    const payload = {
      slipNo: slipNumber,
      partyName: formData.partyName.trim() || "Cash Customer",
      itemName: formData.itemName,
      vehicleNumber: formData.vehicleNumber.trim().toUpperCase() || "RJ-14-XX-0000",
      rate,
      firstWeightType: formData.firstWeightType,
      grossWeight: gross,
      tareWeight: tare,
      netWeight: net,
      isComplete,
      firstTimestamp: new Date().toISOString(),
      secondTimestamp: isComplete ? new Date().toISOString() : null,
    };

    try {
      const res = await fetch("/api/weighments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const saved = data.weighment;
        setWeighments((prev) => [saved, ...prev.filter((w) => w.slipNo !== saved.slipNo)]);
        setIsNewSlipModalOpen(false);
        setFormData({
          slipNo: "",
          partyName: "",
          vehicleNumber: "",
          itemName: "10mm Blue Metal",
          firstWeightType: "Tare",
          tareWeight: "",
          grossWeight: "",
          rate: "45",
        });
      }
    } catch (err) {
      console.error("Failed to save new weighment slip:", err);
    }
  };

  return (
    <div>
      {/* Top Navbar */}
      <nav className="top-navbar">
        <a href="#" className="brand-zone">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12l4 6-10 12L2 9z"/>
              <path d="M12 21V9"/>
            </svg>
          </div>
          <div>
            <div className="brand-title">SHREE CRUSHER & WEIGHBRIDGE</div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 500, letterSpacing: "0.03em" }}>
              DISPATCH & AUTOMATION CONSOLE
            </div>
          </div>
        </a>

        <div className="nav-links">
          <a href="#dashboard" className="nav-link active">Weighbridge</a>
          <a href="#manifest" className="nav-link">Vehicle Queue</a>
          <a href="#tally" className="nav-link">Tally ERP</a>
          <a href="#rates" className="nav-link">Item Rates</a>
        </div>

        <div className="nav-actions">
          <button onClick={handleRefresh} className="btn btn-secondary btn-sm" title="Refresh records from scale" disabled={isRefreshing}>
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              style={{ width: 14, height: 14 }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isRefreshing ? "Syncing..." : "Live Sync"}</span>
          </button>

          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm" title="Download Excel/CSV Report">
            <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>

          <button onClick={() => setIsNewSlipModalOpen(true)} className="btn btn-primary btn-sm">
            <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Weighment Slip</span>
          </button>
        </div>
      </nav>

      <div className="app-container">
        {/* Page Header */}
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Live Weighbridge Dashboard</h1>
            <p className="page-subtitle">
              Scale load cell feeds, tare-gross deductions, and automated Tally Prime voucher manifests
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8125rem", color: "#64748b" }}>
            <span>Scale Indicator: <strong>Online</strong></span>
            <span>·</span>
            <span>Scale Capacity: <strong>100 MT</strong></span>
          </div>
        </div>

        {/* Operational KPI Strip */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">
              <span>Total Dispatched Net Wt</span>
              <svg width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <div className="kpi-value font-mono tabular-nums">
              {stats.totalNetWeightQtl} <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#64748b" }}>QTL</span>
            </div>
            <div className="kpi-subtext">
              Equivalent to <strong className="font-mono">{stats.totalNetWeightMT} Metric Tonnes</strong>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>In-Plant Vehicles</span>
              <svg width="16" height="16" fill="none" stroke="#d97706" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="1" y="3" width="15" height="13"/>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <div className="kpi-value font-mono tabular-nums" style={{ color: stats.inPlantCount > 0 ? "#b45309" : "#0f172a" }}>
              {stats.inPlantCount} <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#64748b" }}>Vehicles</span>
            </div>
            <div className="kpi-subtext">
              First weight done · Awaiting 2nd weight
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Completed Dispatches</span>
              <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="kpi-value font-mono tabular-nums">
              {stats.completedCount} <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#64748b" }}>Slips</span>
            </div>
            <div className="kpi-subtext">
              Both weights verified & signed
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Tally ERP Sync</span>
              <svg width="16" height="16" fill="none" stroke="#475569" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div className="kpi-value font-mono tabular-nums">
              {stats.tallyPendingCount === 0 ? (
                <span style={{ color: "#059669" }}>100% Synced</span>
              ) : (
                <span style={{ color: "#b45309" }}>{stats.tallyPendingCount} Pending</span>
              )}
            </div>
            <div className="kpi-subtext">
              Auto-posting to Sales & Stock register
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="controls-card">
          <div className="filter-group">
            {/* Status segmented buttons */}
            <div className="segmented-control">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`segmented-btn ${statusFilter === "all" ? "active" : ""}`}
              >
                All Slips ({weighments.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("complete")}
                className={`segmented-btn ${statusFilter === "complete" ? "active" : ""}`}
              >
                Completed ({stats.completedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`segmented-btn ${statusFilter === "pending" ? "active" : ""}`}
              >
                In-Plant ({stats.inPlantCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("tally_pending")}
                className={`segmented-btn ${statusFilter === "tally_pending" ? "active" : ""}`}
              >
                Tally Pending ({stats.tallyPendingCount})
              </button>
            </div>

            {/* Material filter dropdown */}
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="select-input font-medium"
            >
              <option value="all">All Materials ({materials.length})</option>
              {materials.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div className="search-input-wrapper">
            <svg className="icon-search" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search slip #, party, vehicle or material..."
              className="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="search-clear-btn"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Weighments Table Card */}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slip No</th>
                <th>Status</th>
                <th>Party Name</th>
                <th>Vehicle No</th>
                <th>Material Grade</th>
                <th style={{ textAlign: "right" }}>Gross (QTL)</th>
                <th style={{ textAlign: "right" }}>Tare (QTL)</th>
                <th style={{ textAlign: "right" }}>Net Wt (QTL)</th>
                <th>Timestamp</th>
                <th>Tally Sync</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {weighments.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                    No weighment records available. Click &quot;New Weighment Slip&quot; to log a record.
                  </td>
                </tr>
              ) : filteredWeighments.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                    No weighment slips match your filter or search criteria.
                    <div style={{ marginTop: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setStatusFilter("all");
                          setSelectedMaterial("all");
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredWeighments.map((w) => {
                  return (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 700, color: "#0f172a" }} className="font-mono">
                        #{w.slipNo}
                      </td>
                      <td>
                        {w.isComplete ? (
                          <span className="status-badge status-complete">Complete</span>
                        ) : (
                          <span className="status-badge status-pending">1st Wt Only</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: "#1e293b" }}>{w.partyName}</td>
                      <td>
                        <span className="vehicle-plate">{w.vehicleNumber}</span>
                      </td>
                      <td style={{ color: "#334155" }}>{w.itemName}</td>
                      <td className="font-mono tabular-nums" style={{ textAlign: "right", color: "#475569" }}>
                        {w.grossWeight ? (w.grossWeight * 10).toFixed(2) : "--"}
                      </td>
                      <td className="font-mono tabular-nums" style={{ textAlign: "right", color: "#475569" }}>
                        {w.tareWeight ? (w.tareWeight * 10).toFixed(2) : "--"}
                      </td>
                      <td className="font-mono tabular-nums" style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                        {w.isComplete ? (
                          <span>{(w.netWeight * 10).toFixed(2)}</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>Pending</span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {new Date(w.firstTimestamp).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        {w.tallySynced ? (
                          <span className="tally-badge-synced" title={w.tallyVoucherNo || "Synced"}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Synced</span>
                          </span>
                        ) : w.isComplete ? (
                          <button
                            type="button"
                            onClick={() => handleSyncToTally(w.slipNo)}
                            disabled={syncingSlipId === w.slipNo}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.6875rem", padding: "0.2rem 0.45rem" }}
                            title="Push voucher to Tally Prime"
                          >
                            {syncingSlipId === w.slipNo ? "Syncing..." : "Sync Tally"}
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Incomplete</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedSlip(w)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "0.25rem 0.5rem" }}
                        >
                          View Slip
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Receipt Modal */}
      {selectedSlip && (
        <div className="modal-overlay" onClick={() => setSelectedSlip(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Weighbridge Delivery Slip #{selectedSlip.slipNo}</h2>
              <button type="button" onClick={() => setSelectedSlip(null)} className="close-btn">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="slip-receipt">
                <div className="slip-receipt-header">
                  <div className="slip-receipt-title">SHREE BALAJI STONE CRUSHER</div>
                  <div style={{ fontSize: "0.75rem", color: "#475569" }}>
                    NH-48 Mining Zone, Industrial Area, Kotputli, Rajasthan
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                    Govt. Approved Electronic Pitless Weighbridge (100 MT)
                  </div>
                </div>

                <div className="slip-grid">
                  <div>
                    <span style={{ color: "#64748b" }}>Slip Number:</span>{" "}
                    <strong>#{selectedSlip.slipNo}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Status:</span>{" "}
                    <strong>{selectedSlip.isComplete ? "COMPLETE" : "1ST WT ONLY"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Vehicle No:</span>{" "}
                    <strong className="vehicle-plate">{selectedSlip.vehicleNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Material:</span>{" "}
                    <strong>{selectedSlip.itemName}</strong>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ color: "#64748b" }}>Customer / Party:</span>{" "}
                    <strong>{selectedSlip.partyName}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>1st Wt Time:</span>{" "}
                    {new Date(selectedSlip.firstTimestamp).toLocaleString("en-IN")}
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>2nd Wt Time:</span>{" "}
                    {selectedSlip.secondTimestamp
                      ? new Date(selectedSlip.secondTimestamp).toLocaleString("en-IN")
                      : "--"}
                  </div>
                </div>

                <div className="slip-weight-box font-mono">
                  <div className="slip-weight-row">
                    <span>Gross Weight:</span>
                    <span>{selectedSlip.grossWeight ? (selectedSlip.grossWeight * 10).toFixed(2) : "0.00"} QTL</span>
                  </div>
                  <div className="slip-weight-row">
                    <span>Tare (Empty) Weight:</span>
                    <span>{selectedSlip.tareWeight ? (selectedSlip.tareWeight * 10).toFixed(2) : "0.00"} QTL</span>
                  </div>
                  <div className="slip-weight-row slip-net-row">
                    <span>NET MATERIAL WEIGHT:</span>
                    <span>
                      {selectedSlip.isComplete ? `${(selectedSlip.netWeight * 10).toFixed(2)} QTL` : "PENDING 2ND WT"}
                    </span>
                  </div>
                  {selectedSlip.isComplete && (
                    <div style={{ fontSize: "0.75rem", color: "#64748b", textAlign: "right", marginTop: "4px" }}>
                      = {selectedSlip.netWeight.toFixed(3)} Metric Tonnes (MT)
                    </div>
                  )}
                </div>

                {selectedSlip.rate !== undefined && selectedSlip.isComplete && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", padding: "0.5rem 0", borderBottom: "1px dashed #cbd5e1" }}>
                    <span>Billing Rate: ₹{(selectedSlip.rate / 10).toFixed(2)} / QTL</span>
                    <span><strong>Total Amount: ₹{(selectedSlip.netWeight * selectedSlip.rate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #cbd5e1", fontSize: "0.75rem", color: "#475569" }}>
                  <div>
                    <div>____________________</div>
                    <div>Driver Signature</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>____________________</div>
                    <div>Weighbridge Operator</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setSelectedSlip(null)} className="btn btn-secondary">
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Weighment Entry Modal */}
      {isNewSlipModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewSlipModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateSlip}>
              <div className="modal-header">
                <h2 className="modal-title">Record Weighment Slip</h2>
                <button type="button" onClick={() => setIsNewSlipModalOpen(false)} className="close-btn">
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Slip Number</label>
                    <input
                      type="number"
                      required
                      value={formData.slipNo}
                      onChange={(e) => setFormData({ ...formData, slipNo: e.target.value })}
                      placeholder="e.g. 1046"
                      className="form-control font-mono"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vehicle Registration No</label>
                    <input
                      type="text"
                      required
                      value={formData.vehicleNumber}
                      onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                      placeholder="e.g. RJ-14-GA-9912"
                      className="form-control font-mono"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Customer / Party Name</label>
                  <input
                    type="text"
                    required
                    value={formData.partyName}
                    onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                    placeholder="e.g. Shree Ram Infrastructure Ltd"
                    className="form-control"
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Material / Aggregate Grade</label>
                    <select
                      value={formData.itemName}
                      onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                      className="form-control"
                    >
                      <option value="10mm Blue Metal">10mm Blue Metal</option>
                      <option value="20mm Aggregate">20mm Aggregate</option>
                      <option value="40mm Ballast">40mm Ballast</option>
                      <option value="Stone Dust / M-Sand">Stone Dust / M-Sand</option>
                      <option value="GSB Grade-1">GSB Grade-1</option>
                      <option value="WMM (Wet Mix Macadam)">WMM (Wet Mix Macadam)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate per QTL (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      placeholder="45"
                      className="form-control font-mono"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Tare (Empty) Wt (QTL)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.tareWeight}
                      onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })}
                      placeholder="e.g. 135.0"
                      className="form-control font-mono"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gross (Loaded) Wt (QTL)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.grossWeight}
                      onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                      placeholder="e.g. 428.0 (Optional for 1st wt)"
                      className="form-control font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setIsNewSlipModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}