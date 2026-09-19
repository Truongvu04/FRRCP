import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../../components/Navbar";
import API from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  Package,
  Activity,
  Users,
  Car,
  TrendingUp,
  TrendingDown,
  Phone,
  ShieldCheck,
  Waves,
  Home,
  MapPin,
  Siren,
  BarChart3,
} from "lucide-react";

type ChartMode = "hour" | "day";

type ChartDatum = {
  label: string;
  value: number;
};

type SosRequest = {
  id: number;
  createdAt?: string;
  completedAt?: string;
  time: string;
  address: string;
  coordinate?: string;
  type: "rescue" | "supplies" | "vehicle" | "other";
  status: "pending" | "assigned" | "completed";
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

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY as string | undefined;

const vnProvinceCentroids: Array<{ name: string; lat: number; lng: number }> = [
  { name: "Thành phố Hà Nội", lat: 21.0285, lng: 105.8542 },
  { name: "Thành phố Hải Phòng", lat: 20.8449, lng: 106.6881 },
  { name: "Thành phố Đà Nẵng", lat: 16.0544, lng: 108.2022 },
  { name: "Thành phố Hồ Chí Minh", lat: 10.8231, lng: 106.6297 },
  { name: "Thành phố Cần Thơ", lat: 10.0452, lng: 105.7469 },
  { name: "Thành phố Huế", lat: 16.4637, lng: 107.5909 },
  { name: "Quảng Ninh", lat: 21.0064, lng: 107.2925 },
  { name: "Nghệ An", lat: 19.2342, lng: 104.9200 },
  { name: "Thanh Hóa", lat: 19.8067, lng: 105.7852 },
  { name: "Hà Tĩnh", lat: 18.3559, lng: 105.8877 },
  { name: "Quảng Bình", lat: 17.4689, lng: 106.6223 },
  { name: "Quảng Trị", lat: 16.7403, lng: 107.1855 },
  { name: "Quảng Nam", lat: 15.5394, lng: 108.0191 },
  { name: "Quảng Ngãi", lat: 15.1214, lng: 108.8044 },
  { name: "Bình Định", lat: 13.7829, lng: 109.2196 },
  { name: "Phú Yên", lat: 13.0882, lng: 109.0929 },
  { name: "Khánh Hòa", lat: 12.2585, lng: 109.0526 },
  { name: "Lâm Đồng", lat: 11.5753, lng: 108.1429 },
  { name: "Đắk Lắk", lat: 12.7100, lng: 108.2378 },
  { name: "Gia Lai", lat: 13.8079, lng: 108.1094 },
  { name: "Kon Tum", lat: 14.3497, lng: 108.0005 },
  { name: "Bình Dương", lat: 11.3254, lng: 106.4770 },
  { name: "Đồng Nai", lat: 10.9453, lng: 106.8240 },
  { name: "Bà Rịa - Vũng Tàu", lat: 10.5417, lng: 107.2429 },
  { name: "Bình Thuận", lat: 10.9804, lng: 108.2615 },
  { name: "Ninh Thuận", lat: 11.5653, lng: 108.9886 },
  { name: "Long An", lat: 10.6956, lng: 106.2431 },
  { name: "Tiền Giang", lat: 10.4493, lng: 106.3420 },
  { name: "Bến Tre", lat: 10.2434, lng: 106.3756 },
  { name: "Vĩnh Long", lat: 10.2530, lng: 105.9722 },
  { name: "Đồng Tháp", lat: 10.4938, lng: 105.6882 },
  { name: "An Giang", lat: 10.5216, lng: 105.1259 },
  { name: "Kiên Giang", lat: 10.0125, lng: 105.0809 },
  { name: "Cà Mau", lat: 9.1527, lng: 105.1961 },
  { name: "Bạc Liêu", lat: 9.2940, lng: 105.7244 },
  { name: "Sóc Trăng", lat: 9.6025, lng: 105.9739 },
  { name: "Trà Vinh", lat: 9.8127, lng: 106.2993 },
  { name: "Hậu Giang", lat: 9.7579, lng: 105.6413 },
  { name: "Ninh Bình", lat: 20.2506, lng: 105.9745 },
];

const provinceAliases: Array<{ match: RegExp; name: string }> = [
  { match: /thanh pho ho chi minh|tp\.hcm|tp hcm|ho chi minh|saigon|sai gon|hcm/i, name: "Thành phố Hồ Chí Minh" },
  { match: /thanh pho da nang|da nang/i, name: "Thành phố Đà Nẵng" },
  { match: /thanh pho ha noi|ha noi|hn\b/i, name: "Thành phố Hà Nội" },
  { match: /thanh pho can tho|can tho/i, name: "Thành phố Cần Thơ" },
  { match: /thanh pho hai phong|hai phong/i, name: "Thành phố Hải Phòng" },
  { match: /thanh pho hue|hue|thua thien hue/i, name: "Thành phố Huế" },
  { match: /quang tri/i, name: "Quảng Trị" },
  { match: /nghe an/i, name: "Nghệ An" },
  { match: /gia lai/i, name: "Gia Lai" },
  { match: /ninh binh/i, name: "Ninh Bình" },
  { match: /vinh long/i, name: "Vĩnh Long" },
  { match: /binh duong/i, name: "Bình Dương" },
  { match: /dong nai/i, name: "Đồng Nai" },
  { match: /binh thuan/i, name: "Bình Thuận" },
  { match: /khanh hoa/i, name: "Khánh Hòa" },
  { match: /lam dong/i, name: "Lâm Đồng" },
  { match: /quang nam/i, name: "Quảng Nam" },
  { match: /dak lak|dak lak/i, name: "Đắk Lắk" },
  { match: /tay ninh/i, name: "Tây Ninh" },
  { match: /long an/i, name: "Long An" },
  { match: /an giang/i, name: "An Giang" },
  { match: /kien giang/i, name: "Kiên Giang" },
  { match: /soc trang/i, name: "Sóc Trăng" },
  { match: /tra vinh/i, name: "Trà Vinh" },
  { match: /ben tre/i, name: "Bến Tre" },
  { match: /dong thap/i, name: "Đồng Tháp" },
  { match: /hau giang/i, name: "Hậu Giang" },
  { match: /ca mau/i, name: "Cà Mau" },
  { match: /bac lieu/i, name: "Bạc Liêu" },
  { match: /quang ngai/i, name: "Quảng Ngãi" },
  { match: /binh dinh/i, name: "Bình Định" },
  { match: /phu yen/i, name: "Phú Yên" },
  { match: /thanh hoa/i, name: "Thanh Hóa" },
  { match: /ha tinh/i, name: "Hà Tĩnh" },
];

const normalizeProvinceName = (value?: string | null): string => {
  const raw = (value || "").trim();
  if (!raw) return "Chưa xác định";

  // Numeric-only values are usually broken coordinate fragments, not province names.
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return "Chưa xác định";
  // Full coordinate pair should never be treated as province text.
  if (/^-?\d{1,2}(?:\.\d+)?\s*[,\s]\s*-?\d{1,3}(?:\.\d+)?$/.test(raw)) return "Chưa xác định";

  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/^(t\.?p\.?|tp\.?|thanh pho|tinh)\s+/i, "")
    .trim();

  for (const alias of provinceAliases) {
    if (alias.match.test(raw) || alias.match.test(cleaned)) {
      return alias.name;
    }
  }

  if (/^tp\.?\s*/i.test(raw) || /^thanh pho/i.test(raw)) {
    return `Thành phố ${cleaned}`;
  }

  return cleaned;
};

const extractCoordinateFromText = (value?: string | null): { lat: number; lng: number; text: string } | null => {
  const raw = (value || "").trim();
  if (!raw) return null;

  const pairMatch = raw.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!pairMatch) return null;

  const a = Number(pairMatch[1]);
  const b = Number(pairMatch[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    return { lat: a, lng: b, text: `${a}, ${b}` };
  }

  if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
    return { lat: b, lng: a, text: `${b}, ${a}` };
  }

  return null;
};

const getProvinceFromGoongReverse = async (lat: number, lng: number): Promise<string | null> => {
  if (!GOONG_API_KEY) return null;

  try {
    const reverseRes = await fetch(`https://rsapi.goong.io/Geocode?latlng=${lat},${lng}&api_key=${GOONG_API_KEY}`);
    if (!reverseRes.ok) return null;
    const reverseData = await reverseRes.json();
    const firstResult = Array.isArray(reverseData?.results) ? reverseData.results[0] : null;
    const components = Array.isArray(firstResult?.address_components) ? firstResult.address_components : [];

    const level1 = components.find((c: any) => Array.isArray(c?.types) && c.types.includes("administrative_area_level_1"));
    const level2 = components.find((c: any) => Array.isArray(c?.types) && c.types.includes("administrative_area_level_2"));
    const candidate = level1?.long_name || level2?.long_name || "";
    const normalized = normalizeProvinceName(candidate);
    if (normalized && normalized !== "Chưa xác định") return normalized;
    return null;
  } catch {
    return null;
  }
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getNearestProvinceFromCoordinate = (lat: number, lng: number): string => {
  let best = vnProvinceCentroids[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const p of vnProvinceCentroids) {
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d < bestDistance) {
      bestDistance = d;
      best = p;
    }
  }
  return best.name;
};

const inferProvinceName = (item: any): string => {
  const province = normalizeProvinceName(item?.province);
  if (province !== "Chưa xác định") return province;

  const fromAddress = normalizeProvinceName(item?.address || item?.location || item?.detail_address);
  return fromAddress;
};

const getRiskLevel = (totalSos: number): string => {
  if (totalSos < 3) return "Thấp";
  if (totalSos < 6) return "Trung bình";
  if (totalSos < 9) return "Cao";
  return "Cực kỳ cao";
};

const getRiskColor = (totalSos: number): { bg: string; text: string; bgHex: string } => {
  if (totalSos < 3) return { bg: "bg-emerald-500", text: "text-emerald-500", bgHex: "#10b981" };
  if (totalSos < 6) return { bg: "bg-yellow-500", text: "text-yellow-500", bgHex: "#eab308" };
  if (totalSos < 9) return { bg: "bg-orange-500", text: "text-orange-500", bgHex: "#f97316" };
  return { bg: "bg-red-600", text: "text-red-600", bgHex: "#dc2626" };
};

const toPdfSafeText = (value: string | number | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

const toDateKey = (d: Date): string => `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;

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

const formatHoursFromMinutesVi = (value: number): string => {
  const safe = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  const hours = safe / 60;
  const rounded = Math.round(hours * 10) / 10;

  if (Number.isInteger(rounded)) {
    return `${rounded.toLocaleString("vi-VN")} giờ`;
  }

  return `${rounded.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} giờ`;
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

const drawPdfBarChart = (
  doc: jsPDF,
  {
    x,
    y,
    width,
    height,
    title,
    subtitle,
    data,
    barColor,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    subtitle?: string;
    data: ChartDatum[];
    barColor: [number, number, number];
  },
) => {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 8, 8, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(toPdfSafeText(title), x + 12, y + 18);

  if (subtitle) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(toPdfSafeText(subtitle), x + 12, y + 31);
  }

  const chartX = x + 12;
  const chartY = y + 44;
  const chartW = width - 24;
  const chartH = height - 66;
  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const barGap = 5;
  const barW = Math.max(6, (chartW - barGap * (data.length - 1)) / Math.max(1, data.length));

  doc.setDrawColor(203, 213, 225);
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

  data.forEach((item, idx) => {
    const ratio = maxValue > 0 ? item.value / maxValue : 0;
    const h = Math.max(0, Math.round((chartH - 20) * ratio));
    const bx = chartX + idx * (barW + barGap);
    const by = chartY + chartH - h;

    doc.setFillColor(barColor[0], barColor[1], barColor[2]);
    doc.rect(bx, by, barW, h, "F");

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.text(String(item.value), bx + barW / 2, by - 3, { align: "center" });

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6);
    doc.text(toPdfSafeText(item.label), bx + barW / 2, chartY + chartH + 9, {
      align: "center",
      maxWidth: Math.max(barW + 8, 14),
    });
  });
};

const AnalyticsRescue: React.FC = () => {
  const [sosRequests, setSosRequests] = useState<SosRequest[]>([]);
  const [rescueTeams, setRescueTeams] = useState<RescueTeam[]>([]);
  const [rescuerName, setRescuerName] = useState<string>("");
  const [rescuerStatus, setRescuerStatus] = useState<string>("");
  const currentUserId = Number(localStorage.getItem("userId"));

  const [chartMode, setChartMode] = useState<ChartMode>("hour");
  const [selectedHourDateKey, setSelectedHourDateKey] = useState<string>(() =>
    toDateKey(new Date())
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailModalFilter, setDetailModalFilter] =
    useState<RequestTypeFilter>("all");
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(
    null
  );
  const [showProvinceDetail, setShowProvinceDetail] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");

        if (!token) {
          console.error("Không có token trong localStorage");
          return;
        }

        if (role !== "rescuer" && role !== "admin") {
          console.error("Role không hợp lệ để vào trang này:", role);
          return;
        }

        const [rescuerTasksResponse, rescuersResponse] = await Promise.all([
          API.get("/rescuer/tasks"),
          API.get("/rescuers"),
        ]);

        const tasksData = rescuerTasksResponse.data;
        const rescuersData = rescuersResponse.data;

        if (Array.isArray(rescuersData) && Number.isFinite(currentUserId)) {
          const currentRescuer = rescuersData.find(
            (item: any) => Number(item.user_id) === currentUserId
          );

          if (currentRescuer?.full_name) {
            setRescuerName(String(currentRescuer.full_name));
          }
          if (currentRescuer?.status) {
            setRescuerStatus(String(currentRescuer.status));
          }
        }

        if (Array.isArray(tasksData)) {
          const toType = (value: string): SosRequest["type"] => {
            if (value === "rescue" || value === "supplies" || value === "vehicle") {
              return value;
            }
            return "other";
          };

          const toStatus = (value: string): SosRequest["status"] => {
            if (value === "done" || value === "completed") return "completed";
            if (value === "rescuing" || value === "assigned") return "assigned";
            return "pending";
          };

          const toHm = (value?: string | null): string | undefined => {
            if (!value) return undefined;
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return undefined;
            return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
          };

          const formattedRequests: SosRequest[] = tasksData.map((item: any) => ({
            id: Number(item.id),
            createdAt: item.timeAgo || undefined,
            completedAt: item.status === "done" ? item.received_at || undefined : undefined,
            time: toHm(item.received_at || item.timeAgo) || "00:00",
            address: item.location || "Chưa có địa chỉ",
            type: toType((item.sos_type || "").toString().trim().toLowerCase()),
            status: toStatus((item.status || "").toString().trim().toLowerCase()),
            requester: item.title || "Người dùng",
            phone: item.phone || "",
            province: normalizeProvinceName(item.location),
            teamId: `team-${currentUserId}`,
            rescueTime: "-",
            rescueDurationMin: undefined,
          }));

          setSosRequests(formattedRequests);
        }

        setRescueTeams([
          {
            id: `team-${currentUserId}`,
            name: rescuerName || "Đội cứu hộ",
            totalRescued: 0,
            avgResponseTime: "0m",
            status: "good",
          },
        ]);
      } catch (error: any) {
        console.error(
          "Error fetching analytics data:",
          error?.response?.status,
          error?.response?.data || error
        );
      }
    };

    fetchAnalyticsData();
  }, [currentUserId, rescuerName]);

  const currentTeamRequests = useMemo(() => {
    if (!Number.isFinite(currentUserId)) return [];
    return sosRequests.filter((r) => r.teamId === `team-${currentUserId}`);
  }, [currentUserId, sosRequests]);

  const teamAreaStats = useMemo(() => {
    const areaMap = new Map<string, number>();
    currentTeamRequests.forEach((req) => {
      const area = req.province || "Chưa xác định";
      areaMap.set(area, (areaMap.get(area) || 0) + 1);
    });

    return Array.from(areaMap.entries())
      .map(([name, totalSos]) => ({ code: name, name, totalSos }))
      .sort((a, b) => b.totalSos - a.totalSos);
  }, [currentTeamRequests]);

  const topAreas = useMemo(() => teamAreaStats.slice(0, 4), [teamAreaStats]);

  const selectedHourDateLabel = useMemo(() => {
    return formatDateKeyWithWeekdayVi(selectedHourDateKey);
  }, [selectedHourDateKey]);

  const latestDayRequests = useMemo(() => {
    return currentTeamRequests.filter((r) => {
      if (!r.createdAt) return false;
      const date = new Date(r.createdAt);
      if (Number.isNaN(date.getTime())) return false;
      return toDateKey(date) === selectedHourDateKey;
    });
  }, [currentTeamRequests, selectedHourDateKey]);

  const teamHourlyData = useMemo<ChartDatum[]>(() => {
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

  const teamDailyData = useMemo<ChartDatum[]>(() => {
    const series = buildRecentDaySeries(7);
    const dayMap = new Map<string, number>();

    currentTeamRequests.forEach((req) => {
      const date = req.createdAt ? new Date(req.createdAt) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
        2,
        "0"
      )}-${`${date.getDate()}`.padStart(2, "0")}`;
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    });

    return series.map((d) => ({ label: d.label, value: dayMap.get(d.key) || 0 }));
  }, [currentTeamRequests]);

  const teamProcessDailyData = useMemo<ChartDatum[]>(() => {
    const series = buildRecentDaySeries(7);
    const dayMap = new Map<string, number>();

    currentTeamRequests.forEach((req) => {
      const date = req.completedAt ? new Date(req.completedAt) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
        2,
        "0"
      )}-${`${date.getDate()}`.padStart(2, "0")}`;
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    });

    return series.map((d) => ({ label: d.label, value: dayMap.get(d.key) || 0 }));
  }, [currentTeamRequests]);

  const activeChartData = useMemo(
    () => (chartMode === "hour" ? teamHourlyData : teamDailyData),
    [chartMode, teamHourlyData, teamDailyData]
  );

  const filteredSosRequests = useMemo(() => {
    if (detailModalFilter === "all") return currentTeamRequests;
    return currentTeamRequests.filter((r) => r.type === detailModalFilter);
  }, [currentTeamRequests, detailModalFilter]);

  const provinceDetailRequests = useMemo(() => {
    if (!selectedProvince) return [];
    return currentTeamRequests.filter((r) => r.province === selectedProvince.name);
  }, [selectedProvince, currentTeamRequests]);

  const teamTotalTasks = currentTeamRequests.length;
  const teamCompleted = currentTeamRequests.filter(
    (r) => r.status === "completed"
  ).length;
  const teamInProgress = currentTeamRequests.filter(
    (r) => r.status === "assigned" || r.status === "pending"
  ).length;
  const teamCompletionRate =
    teamTotalTasks > 0 ? Math.round((teamCompleted / teamTotalTasks) * 100) : 0;

  const avgResponseMinutes = (() => {
    const mins = currentTeamRequests
      .map((r) => r.rescueDurationMin)
      .filter((m): m is number => Number.isFinite(m) && (m || 0) > 0);

    if (!mins.length) return 0;
    return Math.round(mins.reduce((sum, m) => sum + m, 0) / mins.length);
  })();

  const activeMemberCount = ["busy", "available"].includes(
    rescuerStatus.toLowerCase()
  )
    ? 1
    : 0;

  const primaryArea = topAreas[0]?.name || "Chưa có dữ liệu";
  const tasksPerDay = teamProcessDailyData.reduce((sum, d) => sum + d.value, 0) / 7;

  const requestTypeCounts = {
    rescue: currentTeamRequests.filter((r) => r.type === "rescue").length,
    supplies: currentTeamRequests.filter((r) => r.type === "supplies").length,
    vehicle: currentTeamRequests.filter((r) => r.type === "vehicle").length,
    other: currentTeamRequests.filter((r) => r.type === "other").length,
  };

  const safePercent = (count: number): number =>
    teamTotalTasks > 0 ? Math.round((count / teamTotalTasks) * 100) : 0;

  const currentTeamName = useMemo(() => {
    const matchedTeam = rescueTeams.find(
      (team) => team.id === `team-${currentUserId}`
    );
    return matchedTeam?.name || rescuerName || "Đội cứu hộ";
  }, [currentUserId, rescueTeams, rescuerName]);

  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const handleExportPdf = () => {
    try {
      setIsExportingPdf(true);
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      const now = new Date();
      const exportedAt = now.toLocaleString("vi-VN");

      doc.setFontSize(14);
      doc.text(
        toPdfSafeText(`BAO CAO PHAN TICH DOI CUU HO - ${currentTeamName}`),
        40,
        40
      );
      doc.setFontSize(9);
      doc.text(toPdfSafeText(`Xuat luc: ${exportedAt}`), 40, 58);
      doc.text(
        toPdfSafeText(
          `Tong nhiem vu doi: ${teamTotalTasks} | Hoan thanh: ${teamCompleted} | Dang xu ly: ${teamInProgress}`
        ),
        40,
        72
      );
      doc.text(
        toPdfSafeText(
          `Ty le hoan thanh: ${teamCompletionRate}% | Phan hoi TB: ${formatHoursFromMinutesVi(
            avgResponseMinutes
          )} | Nhiem vu/ngay: ${tasksPerDay.toFixed(1)}`
        ),
        40,
        86
      );
      doc.text(
        toPdfSafeText(
          `Thanh vien hoat dong: ${activeMemberCount} | Khu vuc chinh: ${primaryArea}`
        ),
        40,
        100
      );

      doc.addPage();
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(toPdfSafeText(`BIEU DO REALTIME - ${currentTeamName}`), 40, 40);
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(
        toPdfSafeText(
          `Bieu do duoc xuat theo dung bo loc va du lieu hien tai tren man hinh luc ${exportedAt}`
        ),
        40,
        56
      );

      drawPdfBarChart(doc, {
        x: 40,
        y: 72,
        width: 760,
        height: 220,
        title: "Biểu đồ nhiệm vụ của đội theo thời gian",
        subtitle:
          chartMode === "hour"
            ? `Khung gio theo ngay da chon: ${selectedHourDateLabel}`
            : "Tong nhiem vu theo ngay (7 ngay gan nhat)",
        data: activeChartData,
        barColor: chartMode === "hour" ? [59, 130, 246] : [239, 68, 68],
      });

      drawPdfBarChart(doc, {
        x: 40,
        y: 312,
        width: 760,
        height: 220,
        title: `Hiệu suất ${currentTeamName}`,
        subtitle: "Nhip do xu ly nhiem vu theo ngay (7 ngay gan nhat)",
        data: teamProcessDailyData,
        barColor: [16, 185, 129],
      });

      doc.addPage();
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(toPdfSafeText(`CHI TIET DU LIEU - ${currentTeamName}`), 40, 40);

      autoTable(doc, {
        startY: 56,
        head: [["Chi so", "Gia tri"]],
        body: [
          ["Tong nhiem vu cua doi", String(teamTotalTasks)],
          ["Hoan thanh", String(teamCompleted)],
          ["Dang xu ly", String(teamInProgress)],
          [
            "Thoi gian phan hoi TB",
            toPdfSafeText(formatHoursFromMinutesVi(avgResponseMinutes)),
          ],
          ["So thanh vien hoat dong", String(activeMemberCount)],
          ["Khu vuc chinh dang xu ly", toPdfSafeText(primaryArea)],
        ],
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: "bold",
        },
        margin: { left: 24, right: 24 },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 14,
        head: [["Loai yeu cau", "So luong", "Ty trong"]],
        body: [
          [
            "Cuu ho khan cap",
            String(requestTypeCounts.rescue),
            `${safePercent(requestTypeCounts.rescue)}%`,
          ],
          [
            "Nhu yeu pham",
            String(requestTypeCounts.supplies),
            `${safePercent(requestTypeCounts.supplies)}%`,
          ],
          [
            "Cuu ho xe",
            String(requestTypeCounts.vehicle),
            `${safePercent(requestTypeCounts.vehicle)}%`,
          ],
          [
            "Yeu cau khac",
            String(requestTypeCounts.other),
            `${safePercent(requestTypeCounts.other)}%`,
          ],
        ],
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: "bold",
        },
        margin: { left: 24, right: 24 },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 14,
        head: [["Khu vuc", "Tong nhiem vu"]],
        body: teamAreaStats
          .slice(0, 8)
          .map((area) => [toPdfSafeText(area.name), String(area.totalSos)]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: "bold",
        },
        margin: { left: 24, right: 24 },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 14,
        head: [["ID", "Thoi gian", "Loai", "Trang thai", "Khu vuc", "Dia chi"]],
        body: currentTeamRequests.slice(0, 50).map((req) => [
          String(req.id),
          toPdfSafeText(req.time),
          toPdfSafeText(req.type),
          toPdfSafeText(req.status),
          toPdfSafeText(req.province || "Chua xac dinh"),
          toPdfSafeText((req.address || "").slice(0, 58)),
        ]),
        styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: "bold",
        },
        margin: { left: 24, right: 24 },
      });

      const fileStamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
      doc.save(`bao-cao-rescue-${fileStamp}.pdf`);
    } catch (error) {
      console.error(error);
      window.alert("Không thể xuất PDF. Vui lòng thử lại.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10 space-y-8">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_24%)]" />
          <div className="relative px-5 md:px-6 py-6 md:py-7 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-slate-200 mb-3">
                <Activity size={14} />
                Phân tích đội cứu hộ
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                TRUNG TÂM PHÂN TÍCH - {currentTeamName.toUpperCase()}
              </h1>

              <p className="mt-2 text-sm md:text-base text-slate-300 leading-6">
                Theo dõi hiệu suất, khu vực hoạt động và các yêu cầu SOS mà đội đang phụ trách.
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <Users size={13} />
                  Thành viên hoạt động: {activeMemberCount}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <CheckCircle2 size={13} />
                  Hoàn thành: {teamCompletionRate}%
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                  <MapPinHidden />
                  Khu vực chính: {primaryArea}
                </span>
              </div>
            </div>

            <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-2">
              <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm transition">
                <Calendar size={16} />
                Hôm nay, {todayLabel}
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:scale-[1.02] transition shadow-md disabled:opacity-60"
              >
                <FileText size={16} />
                {isExportingPdf ? "Đang xuất..." : "Xuất PDF"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <KPICard
            title="Tổng nhiệm vụ của đội"
            value={`${teamTotalTasks}`}
            icon={<AlertTriangle className="text-red-500" />}
            trend={`${teamTotalTasks}`}
            trendUp={true}
            trendLabel="nhiệm vụ đã nhận"
            bgColor="bg-red-50 dark:bg-red-900/20"
          />
          <KPICard
            title="Hoàn thành"
            value={`${teamCompleted}`}
            icon={<CheckCircle2 className="text-emerald-500" />}
            trend={`${teamCompletionRate}%`}
            trendUp={true}
            trendLabel="tỷ lệ hoàn thành"
            bgColor="bg-emerald-50 dark:bg-emerald-900/20"
          />
          <KPICard
            title="Đang xử lý"
            value={`${teamInProgress}`}
            icon={<Users className="text-blue-500" />}
            trend={`${teamInProgress}`}
            trendUp={true}
            trendLabel="nhiệm vụ đang mở"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <KPICard
            title="Thời gian phản hồi TB"
            value={formatHoursFromMinutesVi(avgResponseMinutes)}
            valueClassName="text-2xl"
            icon={<Clock className="text-amber-500" />}
            trend={formatHoursFromMinutesVi(Math.max(0, 15 - avgResponseMinutes))}
            trendUp={false}
            trendLabel="so với mục tiêu 15 phút"
            bgColor="bg-amber-50 dark:bg-amber-900/20"
            customFooter={
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Tính từ lúc tạo SOS đến khi hoàn thành, quy đổi theo giờ.
              </div>
            }
          />
          <KPICard
            title="Số thành viên hoạt động"
            value={`${activeMemberCount}`}
            icon={<Users className="text-indigo-500" />}
            trend={rescuerStatus || "chưa rõ"}
            trendUp={true}
            trendLabel="trạng thái hiện tại"
            bgColor="bg-indigo-50 dark:bg-indigo-900/20"
          />
          <KPICard
            title="Khu vực chính đang xử lý"
            value={primaryArea}
            valueClassName="text-xl"
            icon={<Activity className="text-teal-500" />}
            trend={`${topAreas[0]?.totalSos || 0}`}
            trendUp={true}
            trendLabel="nhiệm vụ tại khu vực chính"
            bgColor="bg-teal-50 dark:bg-teal-900/20"
          />
        </section>

        <section className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Biểu đồ nhiệm vụ của đội theo thời gian</h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {chartMode === "hour"
                    ? `24 giờ của ngày đã chọn (${selectedHourDateLabel})`
                    : "Tổng nhiệm vụ theo 7 ngày gần nhất"}
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
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${chartMode === "hour"
                      ? "font-bold bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    onClick={() => setChartMode("hour")}
                  >
                    Giờ
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${chartMode === "day"
                      ? "font-bold bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
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

          <div className="col-span-12 lg:col-span-4 rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-between gap-3">
              <h3 className="min-w-0 flex-1 text-lg font-bold leading-snug">
                Thống kê phân loại yêu cầu của đội
              </h3>
              <button
                onClick={() => setShowDetailModal(true)}
                className="shrink-0 whitespace-nowrap flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl transition-colors"
              >
                Xem chi tiết
                <ChevronDown size={14} />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-6">
              <DemoRow
                icon={<AlertTriangle className="text-red-500" />}
                label="Cần cứu hộ khẩn cấp"
                sub="Nguy hiểm tính mạng"
                value={`${requestTypeCounts.rescue}`}
                percent={`${safePercent(requestTypeCounts.rescue)}%`}
                pColor="text-red-500"
              />
              <DemoRow
                icon={<Package className="text-amber-500" />}
                label="Cần nhu yếu phẩm"
                sub="Đồ ăn, nước uống"
                value={`${requestTypeCounts.supplies}`}
                percent={`${safePercent(requestTypeCounts.supplies)}%`}
                pColor="text-amber-500"
              />
              <DemoRow
                icon={<Car className="text-blue-500" />}
                label="Cần cứu hộ xe"
                sub="Kẹt xe, chết máy, ngập"
                value={`${requestTypeCounts.vehicle}`}
                percent={`${safePercent(requestTypeCounts.vehicle)}%`}
                pColor="text-blue-500"
              />
              <DemoRow
                icon={<HelpCircle className="text-slate-500" />}
                label="Yêu cầu khác"
                sub="Hỗ trợ khác"
                value={`${requestTypeCounts.other}`}
                percent={`${safePercent(requestTypeCounts.other)}%`}
                pColor="text-slate-500"
              />

              <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
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
                    className="bg-slate-400 dark:bg-slate-600"
                    style={{ width: `${safePercent(requestTypeCounts.other)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <h3 className="text-lg font-bold">Khu vực hoạt động của đội</h3>
            </div>

            <div className="p-5 md:p-6 space-y-4">
              {topAreas.map((province) => {
                const riskLevel = getRiskLevel(province.totalSos);
                const riskColor = getRiskColor(province.totalSos);
                const progressWidth = Math.min(
                  100,
                  (province.totalSos / Math.max(5, topAreas[0]?.totalSos || 5)) * 100
                );

                return (
                  <div key={province.code} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300">
                        {province.name}
                      </span>
                      <span className={riskColor.text}>{province.totalSos} SOS</span>
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
                        className="text-[11px] font-bold px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: riskColor.bgHex }}
                      >
                        {riskLevel}
                      </span>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => setShowProvinceModal(true)}
                className="w-full mt-6 py-3 text-xs font-bold text-blue-600 border border-blue-100 dark:border-slate-700 rounded-2xl hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
              >
                Xem chi tiết khu vực hoạt động
              </button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-lg font-bold">Hiệu suất {currentTeamName}</h3>
              <div className="text-xs font-medium text-slate-400 italic">
                Mục tiêu phản hồi trung bình: &lt; 15 phút
              </div>
            </div>

            <div className="p-5 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatMetricCard
                  title="% hoàn thành"
                  value={`${teamCompletionRate}%`}
                  hint={`${teamCompleted}/${teamTotalTasks || 0} nhiệm vụ`}
                  color="text-emerald-600"
                />
                <StatMetricCard
                  title="Thời gian TB"
                  value={formatHoursFromMinutesVi(avgResponseMinutes)}
                  hint="TB từ lúc tạo SOS đến lúc hoàn thành"
                  color="text-amber-600"
                />
                <StatMetricCard
                  title="Số nhiệm vụ / ngày"
                  value={`${tasksPerDay.toFixed(1)}`}
                  hint="Trung bình 7 ngày gần nhất"
                  color="text-blue-600"
                />
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Nhịp độ xử lý nhiệm vụ theo ngày
                </div>
                <BarTrendChart data={teamProcessDailyData} mode="day" />
              </div>

              <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-blue-600">
                    <Activity size={24} />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Báo cáo tổng kết hiệu suất</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Phân tích chi tiết lộ trình và tài nguyên
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showDetailModal && (
          <ModalFrame
            title="Danh sách yêu cầu SOS"
            onClose={() => setShowDetailModal(false)}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex gap-2 flex-wrap">
              {[
                { key: "all", label: `Tất cả (${currentTeamRequests.length})` },
                {
                  key: "rescue",
                  label: `Cứu hộ khẩn cấp (${currentTeamRequests.filter((r) => r.type === "rescue").length})`,
                },
                {
                  key: "supplies",
                  label: `Nhu yếu phẩm (${currentTeamRequests.filter((r) => r.type === "supplies").length})`,
                },
                {
                  key: "vehicle",
                  label: `Cứu hộ xe (${currentTeamRequests.filter((r) => r.type === "vehicle").length})`,
                },
                {
                  key: "other",
                  label: `Khác (${currentTeamRequests.filter((r) => r.type === "other").length})`,
                },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setDetailModalFilter(item.key as RequestTypeFilter)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors border ${detailModalFilter === item.key
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Thời gian
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Địa chỉ
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Loại
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Người yêu cầu
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Trạng thái
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSosRequests.length > 0 ? (
                      filteredSosRequests.map((req) => {
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
                              : "Hoàn thành";

                        const statusColor =
                          req.status === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : req.status === "assigned"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";

                        return (
                          <tr
                            key={req.id}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <td className="py-3 px-4">{req.time}</td>
                            <td className="py-3 px-4 text-xs max-w-xs truncate">
                              {req.address}
                            </td>
                            <td className="py-3 px-4">{typeLabel}</td>
                            <td className="py-3 px-4 text-xs">{req.requester}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusColor}`}
                              >
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Không có yêu cầu nào
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </ModalFrame>
        )}

        {showProvinceModal && !showProvinceDetail && (
          <ModalFrame
            title="Khu vực hoạt động của đội"
            onClose={() => setShowProvinceModal(false)}
          >
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Khu vực
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Tổng nhiệm vụ
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Mức độ rủi ro
                      </th>
                      <th className="text-center py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamAreaStats.map((province) => {
                      const riskLevel = getRiskLevel(province.totalSos);
                      const riskColor = getRiskColor(province.totalSos);

                      return (
                        <tr
                          key={province.code}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3 px-4">{province.name}</td>
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
                              className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            >
                              <ChevronRight size={20} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </ModalFrame>
        )}

        {showProvinceDetail && selectedProvince && (
          <ModalFrame
            title={selectedProvince.name}
            onClose={() => {
              setShowProvinceModal(false);
              setShowProvinceDetail(false);
              setSelectedProvince(null);
            }}
            showBackButton={true}
            onBack={() => setShowProvinceDetail(false)}
          >
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Thời gian
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Địa chỉ chi tiết
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Loại
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Người yêu cầu
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        Trạng thái
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {provinceDetailRequests.length > 0 ? (
                      provinceDetailRequests.map((req) => {
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
                              : "Hoàn thành";

                        const statusColor =
                          req.status === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : req.status === "assigned"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";

                        return (
                          <tr
                            key={req.id}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <td className="py-3 px-4">{req.time}</td>
                            <td className="py-3 px-4 text-xs max-w-xs">
                              <div className="truncate">{req.address}</div>
                              {req.coordinate ? (
                                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  Tọa độ: {req.coordinate}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-3 px-4">{typeLabel}</td>
                            <td className="py-3 px-4 text-xs">{req.requester}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusColor}`}
                              >
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Không có yêu cầu nào trong khu vực này
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </ModalFrame>
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
                    href="/home"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Home className="h-4 w-4" />
                    Trang chủ
                  </a>
                </li>
                <li>
                  <a
                    href="/map_rescue"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <MapPin className="h-4 w-4" />
                    Bản đồ
                  </a>
                </li>
                <li>
                  <a
                    href="/rescueteamrescue"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Siren className="h-4 w-4" />
                    Đang cứu hộ
                  </a>
                </li>
                <li>
                  <a
                    href="/analyticsrescue"
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

const ModalFrame = ({
  title,
  onClose,
  children,
  showBackButton,
  onBack,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
}) => (
  <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
        <div className="flex items-center gap-3">
          {showBackButton && onBack ? (
            <button
              onClick={onBack}
              className="px-3 py-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors text-sm font-semibold border border-slate-200 dark:border-slate-700"
            >
              ← Quay lại
            </button>
          ) : null}
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 inline-flex items-center justify-center rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

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
                  title={`${item.label}: ${item.value} nhiệm vụ`}
                />

                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center truncate w-full">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {mode === "hour"
          ? "Mỗi cột tương ứng một khung giờ xử lý nhiệm vụ của đội."
          : "Mỗi cột tương ứng một ngày, thể hiện tổng nhiệm vụ đội đã nhận."}
      </p>
    </div>
  );
};

const KPICard = ({
  title,
  value,
  icon,
  trend,
  trendUp,
  trendLabel,
  bgColor,
  customFooter,
  valueClassName,
}: any) => (
  <div className="relative overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
    <div className="flex items-center justify-between mb-2">
      <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
        {title}
      </span>
      <div className={`p-2.5 rounded-2xl ${bgColor}`}>{icon}</div>
    </div>

    <div
      className={`${valueClassName || "text-3xl"} font-black tracking-tight text-slate-900 dark:text-white`}
    >
      {value}
    </div>

    {customFooter ? (
      customFooter
    ) : (
      <div className="mt-2 flex items-center gap-1 text-sm font-bold text-emerald-500">
        {trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {trend}
        <span className="font-normal text-slate-400 ml-1">{trendLabel}</span>
      </div>
    )}
  </div>
);

const StatMetricCard = ({
  title,
  value,
  hint,
  color,
}: {
  title: string;
  value: string;
  hint: string;
  color: string;
}) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4">
    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
      {title}
    </div>
    <div className={`text-2xl font-black mt-1 ${color}`}>{value}</div>
    <div className="text-xs text-slate-400 mt-1">{hint}</div>
  </div>
);

const DemoRow = ({
  icon,
  label,
  sub,
  value,
  percent,
  pColor,
}: any) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
          {label}
        </div>
        <div className="text-[10px] text-slate-400 uppercase tracking-tighter">
          {sub}
        </div>
      </div>
    </div>

    <div className="text-right shrink-0">
      <div className="text-lg font-black text-slate-900 dark:text-white">
        {value}
      </div>
      <div className={`text-xs font-bold ${pColor}`}>{percent}</div>
    </div>
  </div>
);

const MapPinHidden = () => <span className="inline-block w-3 h-3 rounded-full bg-cyan-400" />;

export default AnalyticsRescue;
