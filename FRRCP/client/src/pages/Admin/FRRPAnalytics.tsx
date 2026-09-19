import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Navbar from "../../components/Navbar";
import API, { getNotificationsStreamUrl } from "../../services/api";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  Package,
  Car,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  MapPinned,
  X,
  Loader2,
  Phone,
  Waves,
  MapPin,
  Home,
  Users2,
  ClipboardList,
} from "lucide-react";

type ChartMode = "hour" | "day";

type ChartDatum = {
  label: string;
  value: number;
};

type SosRequest = {
  id: number;
  createdAt?: string;
  time: string;
  address: string;
  type: "rescue" | "supplies" | "vehicle" | "other";
  status: "pending" | "assigned" | "completed" | "canceled";
  requester: string;
  phone: string;
  province: string;
  teamId: string;
  rescueTime?: string;
  rescueDurationMin?: number;
};

type Province = {
  code: string;
  name: string;
  totalSos: number;
};

type RescueTeam = {
  id: string;
  name: string;
  totalRescued: number;
  avgResponseTime: string;
  status: "excellent" | "good" | "warning" | "slow";
};

type RequestTypeFilter = "all" | "rescue" | "supplies" | "vehicle" | "other";

const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

const getRiskLevel = (totalSos: number): string => {
  if (totalSos < 3) return "Thấp";
  if (totalSos < 6) return "Trung bình";
  if (totalSos < 9) return "Cao";
  return "Cực kỳ cao";
};

const getRiskColor = (
  totalSos: number
): { bg: string; text: string; bgHex: string; soft: string } => {
  if (totalSos < 3)
    return {
      bg: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      bgHex: "#10b981",
      soft: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    };
  if (totalSos < 6)
    return {
      bg: "bg-yellow-500",
      text: "text-yellow-600 dark:text-yellow-400",
      bgHex: "#eab308",
      soft: "bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/20",
    };
  if (totalSos < 9)
    return {
      bg: "bg-orange-500",
      text: "text-orange-600 dark:text-orange-400",
      bgHex: "#f97316",
      soft: "bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20",
    };
  return {
    bg: "bg-red-600",
    text: "text-red-600 dark:text-red-400",
    bgHex: "#dc2626",
    soft: "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20",
  };
};

const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;

const getWeekdayVi = (d: Date): string => {
  const day = d.getDay();
  if (day === 0) return "Chủ nhật";
  return `Thứ ${day + 1}`;
};

const formatDateKeyToVi = (dateKey: string): string => {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
};

const formatDateKeyWithWeekdayVi = (dateKey: string): string => {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return formatDateKeyToVi(dateKey);
  return `${getWeekdayVi(d)}, ${formatDateKeyToVi(dateKey)}`;
};

const buildRecentDaySeries = (days: number): Array<{ key: string; label: string }> => {
  const output: Array<{ key: string; label: string }> = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);

    const key = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
    const weekdayShort = d.getDay() === 0 ? "CN" : `T${d.getDay() + 1}`;
    const label = `${weekdayShort} ${`${d.getDate()}`.padStart(2, "0")}/${`${d.getMonth() + 1}`.padStart(2, "0")}`;

    output.push({ key, label });
  }

  return output;
};

const FRRPAnalytics: React.FC = () => {
  const [sosRequests, setSosRequests] = useState<SosRequest[]>([]);
  const [vietnamProvinces, setVietnamProvinces] = useState<Province[]>([]);
  const [rescueTeams, setRescueTeams] = useState<RescueTeam[]>([]);

  const [chartMode, setChartMode] = useState<ChartMode>("hour");
  const [selectedHourDateKey, setSelectedHourDateKey] = useState<string>(() =>
    toDateKey(new Date())
  );

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailModalFilter, setDetailModalFilter] =
    useState<RequestTypeFilter>("all");
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [showProvinceDetail, setShowProvinceDetail] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<RescueTeam | null>(null);
  const [showTeamDetail, setShowTeamDetail] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const realtimeReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const fetchAnalyticsData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);

      const [requestsResponse, teamsResponse] = await Promise.all([
        API.get("/analytics/sos-requests"),
        API.get("/analytics/rescue-teams"),
      ]);

      const requestsData = requestsResponse.data;
      const teamsData = teamsResponse.data;

      if (Array.isArray(requestsData)) {
        const toType = (value: string): SosRequest["type"] => {
          if (
            value === "rescue" ||
            value === "supplies" ||
            value === "vehicle"
          )
            return value;
          return "other";
        };

        const toStatus = (value: string): SosRequest["status"] => {
          if (value === "cancel" || value === "canceled" || value === "cancelled")
            return "canceled";
          if (value === "done" || value === "completed") return "completed";
          if (value === "rescuing" || value === "assigned") return "assigned";
          return "pending";
        };

        const toHm = (value?: string | null): string | undefined => {
          if (!value) return undefined;
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) return undefined;
          return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(
            2,
            "0"
          )}`;
        };

        const toDurationMin = (
          start?: string | null,
          end?: string | null
        ): number | undefined => {
          if (!start || !end) return undefined;
          const s = new Date(start).getTime();
          const e = new Date(end).getTime();
          if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return undefined;
          return Math.floor((e - s) / 60000);
        };

        const formattedRequests: SosRequest[] = requestsData.map((item: any) => {
          const durationMin = toDurationMin(item.created_at, item.completed_at);
          return {
            id: Number(item.id),
            createdAt: item.created_at || undefined,
            time: toHm(item.created_at) || "00:00",
            address: item.address || "Chưa có địa chỉ",
            type: toType((item.sos_type || "").toString().trim().toLowerCase()),
            status: toStatus((item.status || "").toString().trim().toLowerCase()),
            requester: item.name || "Người dùng",
            phone: item.phone || "",
            province: item.province || "Chưa xác định",
            teamId: item.handled_by ? `team-${item.handled_by}` : "team-unassigned",
            rescueTime: durationMin !== undefined ? `${durationMin} phút` : "-",
            rescueDurationMin: durationMin,
          };
        });

        setSosRequests(formattedRequests);

        const activeRequests = formattedRequests.filter(
          (req) => req.status !== "canceled"
        );
        const provinceMap = new Map<string, number>();

        activeRequests.forEach((req) => {
          const current = provinceMap.get(req.province) || 0;
          provinceMap.set(req.province, current + 1);
        });

        const formattedProvinces = Array.from(provinceMap)
          .map(([name, totalSos]) => ({ code: "UN", name, totalSos }))
          .sort((a, b) => b.totalSos - a.totalSos);

        setVietnamProvinces(formattedProvinces);
      }

      if (Array.isArray(teamsData)) {
        const formattedTeams: RescueTeam[] = teamsData.map(
          (item: any, idx: number) => ({
            id: `team-${item.team_id}`,
            name: item.team_name || `Đội ${idx + 1}`,
            totalRescued: Number(item.totalRescued) || 0,
            avgResponseTime: `${Math.round(Number(item.avgResponseTime) || 0)} phút`,
            status: ((Number(item.avgResponseTime) || 0) > 20
              ? "slow"
              : (Number(item.avgResponseTime) || 0) > 12
                ? "warning"
                : (Number(item.avgResponseTime) || 0) > 8
                  ? "good"
                  : "excellent") as "excellent" | "good" | "warning" | "slow",
          })
        );

        setRescueTeams(formattedTeams);
      }
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      if (silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData(false);

    const token = localStorage.getItem("token");
    if (!token) return;

    let isMounted = true;
    let stream: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const scheduleReload = () => {
      if (realtimeReloadTimerRef.current) {
        clearTimeout(realtimeReloadTimerRef.current);
      }

      realtimeReloadTimerRef.current = setTimeout(() => {
        if (isMounted) {
          fetchAnalyticsData(true);
        }
      }, 250);
    };

    const startRealtime = () => {
      stream = new EventSource(getNotificationsStreamUrl());

      stream.addEventListener("notification", (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as {
            event_type?: string;
          };
          const eventType = String(payload?.event_type || "")
            .trim()
            .toLowerCase();

          if (
            [
              "sos_created",
              "sos_updated",
              "sos_assigned",
              "sos_returned",
              "sos_completed",
              "sos_canceled_by_user",
              "sos_failed",
            ].includes(eventType)
          ) {
            scheduleReload();
          }
        } catch {
          //
        }
      });

      stream.onerror = () => {
        if (stream) stream.close();
        if (!isMounted) return;
        reconnectTimer = setTimeout(() => {
          if (isMounted) startRealtime();
        }, 2000);
      };
    };

    startRealtime();

    pollTimer = setInterval(() => {
      if (isMounted) fetchAnalyticsData(true);
    }, 5000);

    return () => {
      isMounted = false;
      if (stream) stream.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (realtimeReloadTimerRef.current) {
        clearTimeout(realtimeReloadTimerRef.current);
        realtimeReloadTimerRef.current = null;
      }
    };
  }, [fetchAnalyticsData]);

  const activeSosRequests = useMemo(
    () => sosRequests.filter((r) => r.status !== "canceled"),
    [sosRequests]
  );

  const selectedHourDateLabel = useMemo(() => {
    return formatDateKeyWithWeekdayVi(selectedHourDateKey);
  }, [selectedHourDateKey]);

  const latestDayRequests = useMemo(() => {
    return activeSosRequests.filter((r) => {
      if (!r.createdAt) return false;
      const date = new Date(r.createdAt);
      if (Number.isNaN(date.getTime())) return false;
      return toDateKey(date) === selectedHourDateKey;
    });
  }, [activeSosRequests, selectedHourDateKey]);

  const hourlyChartData = useMemo<ChartDatum[]>(() => {
    const hourlyMap = new Map<number, number>();

    latestDayRequests.forEach((req) => {
      const date = req.createdAt ? new Date(req.createdAt) : null;

      if (date && !Number.isNaN(date.getTime())) {
        const hour = date.getHours();
        const bucket = hour - (hour % 2);
        hourlyMap.set(bucket, (hourlyMap.get(bucket) || 0) + 1);
        return;
      }

      const parsedHour = Number((req.time || "00:00").slice(0, 2));
      if (!Number.isNaN(parsedHour)) {
        const bucket = parsedHour - (parsedHour % 2);
        hourlyMap.set(bucket, (hourlyMap.get(bucket) || 0) + 1);
      }
    });

    const labels = [
      "00:00",
      "02:00",
      "04:00",
      "06:00",
      "08:00",
      "10:00",
      "12:00",
      "14:00",
      "16:00",
      "18:00",
      "20:00",
      "22:00",
    ];

    return labels.map((label) => ({
      label,
      value: hourlyMap.get(Number(label.slice(0, 2))) || 0,
    }));
  }, [latestDayRequests]);

  const dailyChartData = useMemo<ChartDatum[]>(() => {
    const series = buildRecentDaySeries(7);
    const dayMap = new Map<string, number>();

    activeSosRequests.forEach((req) => {
      const date = req.createdAt ? new Date(req.createdAt) : null;
      if (!date || Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
        2,
        "0"
      )}-${`${date.getDate()}`.padStart(2, "0")}`;

      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    });

    return series.map((d) => ({
      label: d.label,
      value: dayMap.get(d.key) || 0,
    }));
  }, [activeSosRequests]);

  const activeChartData = useMemo(() => {
    return chartMode === "hour" ? hourlyChartData : dailyChartData;
  }, [chartMode, hourlyChartData, dailyChartData]);

  const sortedProvinces = useMemo(() => {
    return [...vietnamProvinces].sort((a, b) => b.totalSos - a.totalSos);
  }, [vietnamProvinces]);

  const topProvinces = useMemo(() => {
    return sortedProvinces.slice(0, 4);
  }, [sortedProvinces]);

  const filteredSosRequests = useMemo(() => {
    if (detailModalFilter === "all") return sosRequests;
    return sosRequests.filter((r) => r.type === detailModalFilter);
  }, [detailModalFilter, sosRequests]);

  const provinceDetailRequests = useMemo(() => {
    if (!selectedProvince) return [];
    return sosRequests.filter((r) => r.province === selectedProvince.name);
  }, [selectedProvince, sosRequests]);

  const teamDetailRequests = useMemo(() => {
    if (!selectedTeam) return [];
    return sosRequests.filter(
      (r) => r.teamId === selectedTeam.id && r.status === "completed"
    );
  }, [selectedTeam, sosRequests]);

  const totalSos = activeSosRequests.length;
  const completedSos = sosRequests.filter((r) => r.status === "completed").length;
  const completionRate = totalSos > 0 ? Math.round((completedSos / totalSos) * 100) : 0;
  const activeTeams = rescueTeams.length;

  const validTeamAvgMinutes = rescueTeams
    .map((t) => {
      const matched = t.avgResponseTime.match(/\d+/);
      return matched ? Number(matched[0]) : 0;
    })
    .filter((m) => Number.isFinite(m) && m > 0);

  const avgResponseMinutes = validTeamAvgMinutes.length
    ? Math.round(
      validTeamAvgMinutes.reduce((sum, m) => sum + m, 0) /
      validTeamAvgMinutes.length
    )
    : 0;

  const requestTypeCounts = {
    rescue: activeSosRequests.filter((r) => r.type === "rescue").length,
    supplies: activeSosRequests.filter((r) => r.type === "supplies").length,
    vehicle: activeSosRequests.filter((r) => r.type === "vehicle").length,
    other: activeSosRequests.filter((r) => r.type === "other").length,
  };

  const safePercent = (count: number): number =>
    totalSos > 0 ? Math.round((count / totalSos) * 100) : 0;

  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);

      const response = await API.get("/analytics/export-pdf", {
        responseType: "blob",
      });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bao-cao-sos-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      window.alert("Không thể xuất PDF. Vui lòng thử lại.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10 space-y-8">
        <section className="relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_24%)]" />

          <div className="relative px-5 md:px-6 py-5 md:py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-slate-200 mb-3">
                <BarChart3 size={14} />
                Phân tích dữ liệu cứu hộ
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                PHÂN TÍCH DỮ LIỆU
              </h1>

              <p className="mt-2 text-sm md:text-base text-slate-300 leading-6">
                Theo dõi tổng quan SOS, hiệu suất đội cứu hộ, phân bố yêu cầu và
                mức độ rủi ro theo thời gian thực.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <Activity size={13} />
                  Cập nhật thời gian thực
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <ShieldCheck size={13} />
                  Dữ liệu điều phối SOS
                </span>
              </div>
            </div>

            <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => fetchAnalyticsData(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm transition"
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
                Làm mới
              </button>

              <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm transition">
                <Calendar size={16} />
                Hôm nay, {todayLabel}
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:scale-[1.02] transition shadow-md disabled:opacity-60"
              >
                {isExportingPdf ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                {isExportingPdf ? "Đang xuất..." : "Xuất PDF"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            title="Tổng yêu cầu SOS"
            value={`${totalSos}`}
            subText="Yêu cầu đang hoạt động"
            icon={<Activity size={20} />}
            accent="red"
            trend="5.2%"
            trendUp
            trendLabel="so với hôm qua"
          />

          <KPICard
            title="Cứu hộ thành công"
            value={`${completedSos}`}
            subText="Hoàn thành trong ngày"
            icon={<CheckCircle2 size={20} />}
            accent="emerald"
            trend={`${completionRate}%`}
            trendUp
            trendLabel="tỷ lệ hoàn thành"
          />

          <KPICard
            title="Đội đang hoạt động"
            value={`${activeTeams}`}
            subText="Đội có dữ liệu hiện tại"
            icon={<Users size={20} />}
            accent="blue"
            customFooter={
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {activeTeams} đội cứu hộ khả dụng
              </div>
            }
          />

          <KPICard
            title="Thời gian tiếp nhận TB"
            value={`${avgResponseMinutes} phút`}
            subText="Thời gian phản hồi trung bình"
            icon={<Clock size={20} />}
            accent="amber"
            trend="2:15"
            trendUp={false}
            trendLabel="nhanh hơn trước"
          />
        </section>

        <section className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Biểu đồ SOS theo thời gian
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {chartMode === "hour"
                    ? `24 giờ của ngày đã chọn (${selectedHourDateLabel})`
                    : "Tổng số yêu cầu SOS theo 7 ngày gần nhất"}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {chartMode === "hour" ? (
                  <input
                    type="date"
                    value={selectedHourDateKey}
                    onChange={(e) =>
                      setSelectedHourDateKey(e.target.value || toDateKey(new Date()))
                    }
                    className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                    aria-label="Chọn ngày cho biểu đồ giờ"
                  />
                ) : null}

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition",
                      chartMode === "hour"
                        ? "font-bold bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                        : "font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                    onClick={() => setChartMode("hour")}
                  >
                    Giờ
                  </button>
                  <button
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition",
                      chartMode === "day"
                        ? "font-bold bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                        : "font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                    onClick={() => setChartMode("day")}
                  >
                    Ngày
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-6">
              <BarTrendChart data={activeChartData} mode={chartMode} />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-[28px] shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Phân loại yêu cầu
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Tỷ lệ từng nhóm SOS
                </p>
              </div>

              <button
                onClick={() => setShowDetailModal(true)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition"
              >
                Xem chi tiết
                <ChevronDown size={14} />
              </button>
            </div>

            <div className="space-y-5">
              <DemoRow
                icon={<AlertTriangle className="text-red-500" />}
                label="Cần cứu hộ khẩn cấp"
                sub="Nguy hiểm tính mạng"
                value={`${requestTypeCounts.rescue}`}
                percent={`${safePercent(requestTypeCounts.rescue)}%`}
                pColor="text-red-500 dark:text-red-400"
              />
              <DemoRow
                icon={<Package className="text-amber-500" />}
                label="Cần nhu yếu phẩm"
                sub="Đồ ăn, nước uống"
                value={`${requestTypeCounts.supplies}`}
                percent={`${safePercent(requestTypeCounts.supplies)}%`}
                pColor="text-amber-500 dark:text-amber-400"
              />
              <DemoRow
                icon={<Car className="text-blue-500" />}
                label="Cần cứu hộ xe"
                sub="Kẹt xe, chết máy"
                value={`${requestTypeCounts.vehicle}`}
                percent={`${safePercent(requestTypeCounts.vehicle)}%`}
                pColor="text-blue-500 dark:text-blue-400"
              />
              <DemoRow
                icon={<HelpCircle className="text-slate-500" />}
                label="Yêu cầu khác"
                sub="Hỗ trợ khác"
                value={`${requestTypeCounts.other}`}
                percent={`${safePercent(requestTypeCounts.other)}%`}
                pColor="text-slate-500 dark:text-slate-400"
              />
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <div
                  className="bg-red-500"
                  style={{ width: `${safePercent(requestTypeCounts.rescue)}%` }}
                />
                <div
                  className="bg-amber-500"
                  style={{ width: `${safePercent(requestTypeCounts.supplies)}%` }}
                />
                <div
                  className="bg-blue-500"
                  style={{ width: `${safePercent(requestTypeCounts.vehicle)}%` }}
                />
                <div
                  className="bg-slate-400 dark:bg-slate-500"
                  style={{ width: `${safePercent(requestTypeCounts.other)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-[28px] shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <MapPinned size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  SOS theo tỉnh thành
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Khu vực có rủi ro cao
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {topProvinces.map((province) => {
                const riskLevel = getRiskLevel(province.totalSos);
                const riskColor = getRiskColor(province.totalSos);
                const progressWidth = Math.min((province.totalSos / 15) * 100, 100);

                return (
                  <div key={province.code} className="space-y-2">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {province.name}
                      </span>
                      <span className={cn("text-sm font-bold", riskColor.text)}>
                        {province.totalSos} SOS
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${progressWidth}%`,
                            backgroundColor: riskColor.bgHex,
                          }}
                          className="h-full transition-all"
                        />
                      </div>
                      <span
                        className="text-[11px] font-bold px-2 py-1 rounded-lg text-white"
                        style={{ backgroundColor: riskColor.bgHex }}
                      >
                        {riskLevel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowProvinceModal(true)}
              className="w-full mt-8 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
            >
              Xem chi tiết các tỉnh thành
            </button>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-[28px] shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Hiệu suất đội cứu hộ
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Mục tiêu phản hồi dưới 15 phút
                </p>
              </div>

              <button
                onClick={() => setShowTeamModal(true)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl transition"
              >
                Xem chi tiết
                <ChevronDown size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {rescueTeams.map((team) => {
                const matched = team.avgResponseTime.match(/\d+/);
                const avgMin = matched ? Number(matched[0]) : 0;
                const width = `${Math.min(
                  95,
                  Math.max(25, Math.round((avgMin / 25) * 100))
                )}%`;
                const statusText =
                  team.status === "excellent"
                    ? "XUẤT SẮC"
                    : team.status === "good"
                      ? "TỐT"
                      : team.status === "warning"
                        ? "CẦN CẢI THIỆN"
                        : "CHẬM";
                const color =
                  team.status === "excellent"
                    ? "bg-emerald-500"
                    : team.status === "good"
                      ? "bg-blue-600"
                      : team.status === "warning"
                        ? "bg-amber-500"
                        : "bg-red-500";

                return (
                  <TeamBar
                    key={team.id}
                    name={team.name}
                    time={team.avgResponseTime}
                    status={statusText}
                    width={width}
                    color={color}
                  />
                );
              })}
            </div>

            <div className="mt-10 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700">
                  <Activity size={24} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Báo cáo tổng kết hiệu suất
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Phân tích chi tiết thời gian phản hồi và số ca hoàn thành
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showDetailModal && (
          <BaseModal
            title="Danh sách yêu cầu SOS"
            onClose={() => setShowDetailModal(false)}
            maxWidth="max-w-5xl"
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex gap-2 flex-wrap">
              <FilterButton
                active={detailModalFilter === "all"}
                onClick={() => setDetailModalFilter("all")}
              >
                Tất cả ({sosRequests.length})
              </FilterButton>

              <FilterButton
                active={detailModalFilter === "rescue"}
                onClick={() => setDetailModalFilter("rescue")}
                color="red"
                icon={<AlertTriangle size={16} />}
              >
                Cứu hộ khẩn cấp (
                {sosRequests.filter((r) => r.type === "rescue").length})
              </FilterButton>

              <FilterButton
                active={detailModalFilter === "supplies"}
                onClick={() => setDetailModalFilter("supplies")}
                color="amber"
                icon={<Package size={16} />}
              >
                Nhu yếu phẩm (
                {sosRequests.filter((r) => r.type === "supplies").length})
              </FilterButton>

              <FilterButton
                active={detailModalFilter === "vehicle"}
                onClick={() => setDetailModalFilter("vehicle")}
                color="blue"
                icon={<Car size={16} />}
              >
                Cứu hộ xe (
                {sosRequests.filter((r) => r.type === "vehicle").length})
              </FilterButton>

              <FilterButton
                active={detailModalFilter === "other"}
                onClick={() => setDetailModalFilter("other")}
                color="slate"
                icon={<HelpCircle size={16} />}
              >
                Khác ({sosRequests.filter((r) => r.type === "other").length})
              </FilterButton>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <DataTable
                headers={[
                  "Thời gian",
                  "Địa chỉ",
                  "Loại",
                  "Người yêu cầu",
                  "Trạng thái",
                ]}
                emptyText="Không có yêu cầu nào"
              >
                {filteredSosRequests.map((req) => {
                  const typeLabel =
                    req.type === "rescue"
                      ? "Cứu hộ khẩn cấp"
                      : req.type === "supplies"
                        ? "Nhu yếu phẩm"
                        : req.type === "vehicle"
                          ? "Cứu hộ xe"
                          : "Khác";

                  const statusLabel =
                    req.status === "pending"
                      ? "Chờ xử lý"
                      : req.status === "assigned"
                        ? "Đang cứu hộ"
                        : req.status === "canceled"
                          ? "Đã hủy"
                          : "Hoàn thành";

                  const statusColor =
                    req.status === "pending"
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                      : req.status === "assigned"
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                        : req.status === "canceled"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";

                  return (
                    <tr
                      key={req.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4">{req.time}</td>
                      <td className="py-3 px-4 text-xs max-w-xs truncate">
                        {req.address}
                      </td>
                      <td className="py-3 px-4">{typeLabel}</td>
                      <td className="py-3 px-4 text-xs">{req.requester}</td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold border",
                            statusColor
                          )}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            </div>
          </BaseModal>
        )}

        {showProvinceModal && !showProvinceDetail && (
          <BaseModal
            title="Danh sách tỉnh thành"
            onClose={() => setShowProvinceModal(false)}
            maxWidth="max-w-5xl"
          >
            <div className="flex-1 overflow-y-auto p-6">
              <DataTable
                headers={["Tỉnh thành", "Tổng SOS", "Mức độ rủi ro", ""]}
                emptyText="Không có dữ liệu tỉnh thành"
              >
                {sortedProvinces.map((province) => {
                  const riskLevel = getRiskLevel(province.totalSos);
                  const riskColor = getRiskColor(province.totalSos);

                  return (
                    <tr
                      key={`${province.code}-${province.name}`}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4 font-medium">{province.name}</td>
                      <td className="py-3 px-4 font-semibold">
                        {province.totalSos}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: riskColor.bgHex }}
                        >
                          {riskLevel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedProvince(province);
                            setShowProvinceDetail(true);
                          }}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            </div>
          </BaseModal>
        )}

        {showProvinceDetail && selectedProvince && (
          <BaseModal
            title={selectedProvince.name}
            onClose={() => {
              setShowProvinceModal(false);
              setShowProvinceDetail(false);
              setSelectedProvince(null);
            }}
            maxWidth="max-w-5xl"
            backAction={() => setShowProvinceDetail(false)}
          >
            <div className="flex-1 overflow-y-auto p-6">
              <DataTable
                headers={[
                  "Thời gian",
                  "Địa chỉ",
                  "Loại",
                  "Người yêu cầu",
                  "Trạng thái",
                ]}
                emptyText="Không có yêu cầu nào"
              >
                {provinceDetailRequests.map((req) => {
                  const typeLabel =
                    req.type === "rescue"
                      ? "Cứu hộ khẩn cấp"
                      : req.type === "supplies"
                        ? "Nhu yếu phẩm"
                        : req.type === "vehicle"
                          ? "Cứu hộ xe"
                          : "Khác";

                  const statusLabel =
                    req.status === "pending"
                      ? "Chờ xử lý"
                      : req.status === "assigned"
                        ? "Đang cứu hộ"
                        : req.status === "canceled"
                          ? "Đã hủy"
                          : "Hoàn thành";

                  const statusColor =
                    req.status === "pending"
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                      : req.status === "assigned"
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                        : req.status === "canceled"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";

                  return (
                    <tr
                      key={req.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4">{req.time}</td>
                      <td className="py-3 px-4 text-xs max-w-xs truncate">
                        {req.address}
                      </td>
                      <td className="py-3 px-4">{typeLabel}</td>
                      <td className="py-3 px-4 text-xs">{req.requester}</td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold border",
                            statusColor
                          )}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            </div>
          </BaseModal>
        )}

        {showTeamModal && !showTeamDetail && (
          <BaseModal
            title="Danh sách đội cứu hộ"
            onClose={() => setShowTeamModal(false)}
            maxWidth="max-w-5xl"
          >
            <div className="flex-1 overflow-y-auto p-6">
              <DataTable
                headers={["Tên đội", "Tổng hoàn thành", "Thời gian TB", ""]}
                emptyText="Không có dữ liệu đội cứu hộ"
              >
                {rescueTeams.map((team) => (
                  <tr
                    key={team.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-4 font-semibold">{team.name}</td>
                    <td className="py-3 px-4">{team.totalRescued} SOS</td>
                    <td className="py-3 px-4">{team.avgResponseTime}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedTeam(team);
                          setShowTeamDetail(true);
                        }}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </BaseModal>
        )}

        {showTeamDetail && selectedTeam && (
          <BaseModal
            title={selectedTeam.name}
            onClose={() => {
              setShowTeamModal(false);
              setShowTeamDetail(false);
              setSelectedTeam(null);
            }}
            maxWidth="max-w-5xl"
            backAction={() => setShowTeamDetail(false)}
          >
            <div className="flex-1 overflow-y-auto p-6">
              <DataTable
                headers={["Mã SOS", "Địa chỉ", "Loại", "Thời lượng cứu hộ"]}
                emptyText="Chưa có yêu cầu hoàn thành"
              >
                {teamDetailRequests.map((req) => {
                  const typeLabel =
                    req.type === "rescue"
                      ? "Cứu hộ khẩn cấp"
                      : req.type === "supplies"
                        ? "Nhu yếu phẩm"
                        : req.type === "vehicle"
                          ? "Cứu hộ xe"
                          : "Khác";

                  return (
                    <tr
                      key={req.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4 font-semibold text-blue-600 dark:text-blue-400">
                        SOS#{req.id}
                      </td>
                      <td className="py-3 px-4 text-xs max-w-xs truncate">
                        {req.address}
                      </td>
                      <td className="py-3 px-4">{typeLabel}</td>
                      <td className="py-3 px-4 font-semibold">
                        {req.rescueTime || "-"}
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            </div>
          </BaseModal>
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
                  <Waves className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    FRRP System
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Flood Rescue Response Platform
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Hệ thống hỗ trợ cứu hộ thiên tai, tiếp nhận SOS khẩn cấp và điều
                phối đội cứu hộ nhanh chóng, chính xác và an toàn.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Liên kết nhanh
              </h4>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <a
                    href="/homeadmin"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Home className="h-4 w-4" />
                    Trang chủ
                  </a>
                </li>
                <li>
                  <a
                    href="/map_admin"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <MapPin className="h-4 w-4" />
                    Bản đồ
                  </a>
                </li>
                <li>
                  <a
                    href="/rescueteamadmin"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Users2 className="h-4 w-4" />
                    Quản lý Đội cứu hộ
                  </a>
                </li>
                <li>
                  <a
                    href="/requestsosadmin"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Quản lý Dân cư
                  </a>
                </li>
                <li>
                  <a
                    href="/analytics"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Phân tích dữ liệu
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Hỗ trợ khẩn cấp
              </h4>

              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-red-500" />
                  Hotline cứu nạn: <span className="font-bold">112</span>
                </p>

                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  Quản trị hệ thống: <span className="font-bold">0888 100 204</span>
                </p>

                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Cấp tài khoản đội cứu hộ qua Admin
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            © {new Date().getFullYear()} FRRP System. All rights reserved.
            <br />
            Developed for Flood Emergency Rescue Coordination.
          </div>
        </div>
      </footer>
    </div>
  );
};

const BarTrendChart = ({
  data,
  mode,
}: {
  data: ChartDatum[];
  mode: ChartMode;
}) => {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div>
      <div className="h-72 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4">
        <div className="h-full flex items-end gap-2">
          {data.map((item) => {
            const ratio = item.value / maxValue;
            const barHeight = Math.max(8, Math.round(ratio * 220));

            return (
              <div
                key={item.label}
                className="flex-1 min-w-0 flex flex-col items-center justify-end gap-2"
              >
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {item.value}
                </span>

                <div
                  className={`w-full rounded-t-xl transition-all duration-500 ${mode === "hour"
                    ? "bg-gradient-to-t from-blue-600 to-cyan-400"
                    : "bg-gradient-to-t from-rose-600 to-orange-400"
                    }`}
                  style={{ height: `${barHeight}px` }}
                  title={`${item.label}: ${item.value} SOS`}
                />

                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide text-center truncate w-full">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {mode === "hour"
          ? "Mỗi cột tương ứng một khung giờ trong ngày đã chọn."
          : "Mỗi cột tương ứng tổng số SOS theo 7 ngày gần nhất."}
      </p>
    </div>
  );
};

const KPI_THEMES = {
  red: {
    box: "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  },
  emerald: {
    box: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  blue: {
    box: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
  amber: {
    box: "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  },
};

const KPICard = ({
  title,
  value,
  subText,
  icon,
  trend,
  trendUp,
  trendLabel,
  accent,
  customFooter,
}: any) => {
  const theme = KPI_THEMES[accent as keyof typeof KPI_THEMES];

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          {title}
        </span>
        <div className={cn("p-3 rounded-2xl", theme.box)}>{icon}</div>
      </div>

      <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>

      <p className="mt-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
        {subText}
      </p>

      {customFooter ? (
        customFooter
      ) : (
        <div
          className={cn(
            "mt-3 flex items-center gap-1 text-sm font-bold",
            trendUp ? "text-emerald-500 dark:text-emerald-400" : "text-blue-500 dark:text-blue-400"
          )}
        >
          {trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend}
          <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
};

const DemoRow = ({ icon, label, sub, value, percent, pColor }: any) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {sub}
        </div>
      </div>
    </div>
    <div className="text-right">
      <div className="text-lg font-black text-slate-900 dark:text-white">{value}</div>
      <div className={cn("text-xs font-bold", pColor)}>{percent}</div>
    </div>
  </div>
);

const TeamBar = ({ name, time, status, width, color }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm font-bold">
      <span className="text-slate-700 dark:text-slate-300">{name}</span>
      <span className="text-slate-900 dark:text-white">{time}</span>
    </div>

    <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden flex border border-slate-200 dark:border-slate-700">
      <div
        className={`h-full ${color} flex items-center px-3 text-[10px] text-white font-black tracking-widest whitespace-nowrap`}
        style={{ width }}
      >
        {status}
      </div>
    </div>
  </div>
);

const BaseModal = ({
  title,
  onClose,
  children,
  maxWidth = "max-w-4xl",
  backAction,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  backAction?: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4">
      <div
        className={cn(
          "bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800",
          maxWidth
        )}
      >
        <div className="px-6 md:px-7 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {backAction && (
                <button
                  onClick={backAction}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition text-sm"
                >
                  ← Quay lại
                </button>
              )}
              <div>
                <h3 className="font-bold text-xl">{title}</h3>
                <p className="text-sm text-slate-200 mt-1">
                  Xem thông tin chi tiết trong hệ thống FRRP
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition flex items-center justify-center"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};

const FilterButton = ({
  active,
  onClick,
  children,
  icon,
  color = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  color?: "default" | "red" | "amber" | "blue" | "slate";
}) => {
  const colorClass =
    color === "red"
      ? active
        ? "bg-red-500 text-white border-red-500"
        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20"
      : color === "amber"
        ? active
          ? "bg-amber-500 text-white border-amber-500"
          : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 dark:hover:bg-amber-500/20"
        : color === "blue"
          ? active
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/20"
          : color === "slate"
            ? active
              ? "bg-slate-700 text-white border-slate-700"
              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
            : active
              ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800";

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-xl font-semibold text-sm transition inline-flex items-center gap-2 border",
        colorClass
      )}
    >
      {icon}
      {children}
    </button>
  );
};

const DataTable = ({
  headers,
  children,
  emptyText,
}: {
  headers: string[];
  children: React.ReactNode;
  emptyText: string;
}) => {
  const hasRows = React.Children.count(children) > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={cn(
                  "py-3 px-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs",
                  idx === headers.length - 1 ? "text-center" : "text-left"
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {hasRows ? (
            children
          ) : (
            <tr>
              <td
                colSpan={headers.length}
                className="py-10 text-center text-slate-500 dark:text-slate-400"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FRRPAnalytics;