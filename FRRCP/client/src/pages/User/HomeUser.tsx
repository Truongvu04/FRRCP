import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Navbar from "../../components/Navbar";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "mapbox-gl-leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertCircle,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Users,
  Info,
  XCircle,
  CloudRain,
  Wind,
  Thermometer,
  Waves,
  Sparkles,
  Siren,
  MapPin,
  Navigation,
  ChevronDown,
  Clock3,
  PhoneCall,
  Truck,
  ArrowRight,
  Search,
  ArrowUpDown,
  ClipboardList,
  CalendarDays,
  User,
  Link as LinkIcon,
  Image as ImageIcon,
  X,
  ChevronRight,
  ChevronLeft,
  Flag,
  Edit3,
  Loader2,
  Phone,
  Home as HomeIcon,
  ShieldCheck,
  Users2,
  BarChart3,
} from "lucide-react";

/* =========================
   CONFIG
========================= */
const API_BASE = "http://localhost:3000";
const RESCUE_POLLING_MS = 5000;
const AI_ADVICE_REFRESH_MS = 60 * 1000; // 1 phút mới gọi lại AI nếu dữ liệu không đổi nhiều
const HOME_TRACKING_STORAGE_KEY = "rescue_tracking_snapshots";

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY as string | undefined;

(mapboxgl as any).setTelemetryEnabled?.(false);

if (GOONG_API_KEY) {
  mapboxgl.accessToken = GOONG_API_KEY;
}

/* =========================
   TYPES
========================= */
interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  trend?: string;
  isRisk?: boolean;
  valueClassName?: string;
}

interface RiskProgressProps {
  label: string;
  percent: number;
  color: string;
}

interface ResourceCardProps {
  icon: React.ReactElement<{ size?: number }>;
  label: string;
  value: string;
  color: string;
}

type ToastType = "success" | "error" | "warning" | "info";

interface ToastState {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

interface NotificationToastProps {
  toast: ToastState;
  onClose: () => void;
}

interface WeatherHour {
  time: string;
  hour: string;
  temperature: number;
  rain: number;
  rainProbability: number;
  windSpeed: number;
  weatherCode: number;
  weatherText: string;
}

interface CurrentWeather {
  time: string;
  temperature: number;
  rain: number;
  rainProbability: number;
  windSpeed: number;
  weatherCode: number;
  weatherText: string;
}

interface WeatherSummary {
  temperature: number;
  rainProbability: number;
  rain: number;
  windSpeed: number;
  riskLabel: string;
  updatedAt: string;
  weatherText?: string;
  current?: CurrentWeather | null;
  hourly12?: WeatherHour[];
}

interface RiskItem {
  label: string;
  percent: number;
  color: string;
}

interface AiAdvice {
  level: "low" | "medium" | "high";
  title: string;
  message: string;
  tips: string[];
  reasons?: string[];
  actionNow?: string;
  confidence?: number;
  source?: "groq" | "rule_fallback" | "local_rule";
  note?: string;
}

interface LocationSourceState {
  source: "browser" | "manual" | "fallback" | "unknown";
  label: string;
  lat: number | null;
  lng: number | null;
}

type GeoPhase = "idle" | "requesting" | "granted" | "denied" | "failed";

interface ProvinceOption {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

interface RescueItem {
  id: number;
  name: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  address: string;
  victims: number;
  note?: string;
  source_url?: string;
  images?: string | string[];
  status: "new" | "rescuing" | "done" | "cancel" | string;
  user_id?: number;
  sos_type?: "rescue" | "supplies" | "vehicle" | "other" | string;
  created_at?: string;
  received_at?: string | null;
  completed_at?: string | null;
  assigned_team?: string | null;
  handled_by?: number | null;
  rescuer_lat?: number | null;
  rescuer_lng?: number | null;
  rescuer_name?: string | null;
  rescuer_phone?: string | null;
}

type RescueStatusFilter = "all" | "new" | "rescuing" | "done";
type RescueTypeFilter = "all" | "rescue" | "supplies" | "vehicle" | "other";

type StepStatus = {
  currentStep: 1 | 2 | 3 | 4;
  title: string;
  badgeClass: string;
  eta?: string | null;
  distance?: string | null;
};

type EditSosType = "rescue" | "supplies" | "vehicle" | "other" | "";

type RescueTeamAction = "receive" | "cancel_receive" | "complete";

type RescueTeamActionState = {
  item: RescueItem;
  action: RescueTeamAction;
};

type AuthSnapshot = {
  token: string;
  currentUserId: number;
  currentUserRole: string;
};

function readAuthSnapshot(): AuthSnapshot {
  return {
    token: localStorage.getItem("token") || "",
    currentUserId: Number(localStorage.getItem("userId") || 0),
    currentUserRole: localStorage.getItem("role") || "",
  };
}

/* =========================
   PROVINCES
========================= */
const PROVINCES: ProvinceOption[] = [
  { code: "ha_noi", name: "Thành phố Hà Nội", lat: 21.0285, lng: 105.8542 },
  { code: "cao_bang", name: "Tỉnh Cao Bằng", lat: 22.6667, lng: 106.25 },
  { code: "tuyen_quang", name: "Tỉnh Tuyên Quang", lat: 21.7767, lng: 105.228 },
  { code: "dien_bien", name: "Tỉnh Điện Biên", lat: 21.386, lng: 103.0167 },
  { code: "lai_chau", name: "Tỉnh Lai Châu", lat: 22.3862, lng: 103.4707 },
  { code: "son_la", name: "Tỉnh Sơn La", lat: 21.3256, lng: 103.9188 },
  { code: "lao_cai", name: "Tỉnh Lào Cai", lat: 21.7168, lng: 104.8986 },
  { code: "thai_nguyen", name: "Tỉnh Thái Nguyên", lat: 21.5942, lng: 105.8482 },
  { code: "lang_son", name: "Tỉnh Lạng Sơn", lat: 21.8537, lng: 106.7615 },
  { code: "quang_ninh", name: "Tỉnh Quảng Ninh", lat: 20.9712, lng: 107.0448 },
  { code: "bac_ninh", name: "Tỉnh Bắc Ninh", lat: 21.281, lng: 106.197 },
  { code: "phu_tho", name: "Tỉnh Phú Thọ", lat: 21.3228, lng: 105.402 },
  { code: "hai_phong", name: "Thành phố Hải Phòng", lat: 20.8449, lng: 106.6881 },
  { code: "hung_yen", name: "Tỉnh Hưng Yên", lat: 20.6464, lng: 106.0511 },
  { code: "ninh_binh", name: "Tỉnh Ninh Bình", lat: 20.2506, lng: 105.9745 },
  { code: "thanh_hoa", name: "Tỉnh Thanh Hóa", lat: 19.8067, lng: 105.7852 },
  { code: "nghe_an", name: "Tỉnh Nghệ An", lat: 19.2342, lng: 104.92 },
  { code: "ha_tinh", name: "Tỉnh Hà Tĩnh", lat: 18.3559, lng: 105.8877 },
  { code: "quang_tri", name: "Tỉnh Quảng Trị", lat: 17.4689, lng: 106.6223 },
  { code: "hue", name: "Thành phố Huế", lat: 16.4637, lng: 107.5909 },
  { code: "da_nang", name: "Thành phố Đà Nẵng", lat: 16.0544, lng: 108.2022 },
  { code: "quang_ngai", name: "Tỉnh Quảng Ngãi", lat: 15.1214, lng: 108.8044 },
  { code: "gia_lai", name: "Tỉnh Gia Lai", lat: 13.7829, lng: 109.2196 },
  { code: "khanh_hoa", name: "Tỉnh Khánh Hòa", lat: 12.2585, lng: 109.0526 },
  { code: "dak_lak", name: "Tỉnh Đắk Lắk", lat: 12.71, lng: 108.2378 },
  { code: "lam_dong", name: "Tỉnh Lâm Đồng", lat: 11.9404, lng: 108.4583 },
  { code: "dong_nai", name: "Tỉnh Đồng Nai", lat: 10.9453, lng: 106.824 },
  { code: "hcm", name: "Thành phố Hồ Chí Minh", lat: 10.8231, lng: 106.6297 },
  { code: "tay_ninh", name: "Tỉnh Tây Ninh", lat: 11.3100, lng: 106.0983 },
  { code: "dong_thap", name: "Tỉnh Đồng Tháp", lat: 10.4591, lng: 105.632 },
  { code: "vinh_long", name: "Tỉnh Vĩnh Long", lat: 10.2537, lng: 105.9722 },
  { code: "an_giang", name: "Tỉnh An Giang", lat: 10.3864, lng: 105.4352 },
  { code: "can_tho", name: "Thành phố Cần Thơ", lat: 10.0452, lng: 105.7469 },
  { code: "ca_mau", name: "Tỉnh Cà Mau", lat: 9.1768, lng: 105.1524 },
];

/* =========================
   TOAST CONFIG
========================= */
const toastMeta = {
  success: {
    title: "Thành công",
    icon: CheckCircle2,
    border: "border-emerald-200 dark:border-emerald-800",
    iconWrap:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    line: "bg-emerald-500",
  },
  error: {
    title: "Có lỗi xảy ra",
    icon: XCircle,
    border: "border-red-200 dark:border-red-800",
    iconWrap:
      "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
    line: "bg-red-500",
  },
  warning: {
    title: "Cảnh báo",
    icon: AlertTriangle,
    border: "border-amber-200 dark:border-amber-800",
    iconWrap:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    line: "bg-amber-500",
  },
  info: {
    title: "Thông báo",
    icon: Info,
    border: "border-blue-200 dark:border-blue-800",
    iconWrap:
      "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    line: "bg-blue-500",
  },
} as const;

/* =========================
   HELPERS
========================= */
const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

const PaginationButton = ({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "min-w-9 h-9 px-3 flex items-center justify-center rounded-xl border text-sm font-semibold transition",
      active
        ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
      disabled &&
      "opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-slate-900"
    )}
  >
    {label || icon}
  </button>
);

function generateAdvice(weather: WeatherSummary): AiAdvice {
  const { rainProbability, rain, windSpeed } = weather;

  if (rainProbability >= 70 || rain >= 10) {
    return {
      level: "high",
      title: "Cần chú ý cao trong 6 giờ tới",
      message:
        "Khả năng mưa lớn tương đối cao, có thể gây ngập cục bộ tại khu vực trũng thấp và làm việc di chuyển khó khăn hơn.",
      tips: [
        "Hạn chế đi qua đường thấp, ven sông hoặc khu vực nước chảy xiết.",
        "Chuẩn bị pin dự phòng, nước uống và đèn pin.",
        "Nếu nước dâng nhanh hoặc có người mắc kẹt, hãy gửi SOS sớm.",
      ],
    };
  }

  if (rainProbability >= 40 || windSpeed >= 25) {
    return {
      level: "medium",
      title: "Nên theo dõi thời tiết sát hơn",
      message:
        "Khu vực có khả năng xuất hiện mưa vừa hoặc gió mạnh trong vài giờ tới. Nên chủ động theo dõi thay đổi thời tiết.",
      tips: [
        "Giữ điện thoại luôn có pin và tín hiệu liên lạc.",
        "Hạn chế đi xa nếu không thực sự cần thiết.",
        "Chuẩn bị sẵn áo mưa, vật dụng thiết yếu và giấy tờ quan trọng.",
      ],
    };
  }

  return {
    level: "low",
    title: "Tình hình hiện tại tương đối ổn định",
    message:
      "Chưa ghi nhận dấu hiệu thời tiết nguy hiểm rõ rệt trong ngắn hạn, nhưng bạn vẫn nên theo dõi cập nhật định kỳ.",
    tips: [
      "Theo dõi dự báo thời tiết thường xuyên.",
      "Chuẩn bị sẵn vật dụng cần thiết phòng trường hợp thời tiết xấu.",
      "Giữ liên lạc với người thân khi có mưa lớn kéo dài.",
    ],
  };
}

function getAdviceTone(level: AiAdvice["level"]) {
  switch (level) {
    case "high":
      return {
        wrap: "border-red-100 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10",
        title: "text-red-700 dark:text-red-300",
        dot: "bg-red-500",
      };
    case "medium":
      return {
        wrap: "border-amber-100 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10",
        title: "text-amber-700 dark:text-amber-300",
        dot: "bg-amber-500",
      };
    default:
      return {
        wrap: "border-emerald-100 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/10",
        title: "text-emerald-700 dark:text-emerald-300",
        dot: "bg-emerald-500",
      };
  }
}

function formatLocationLabel(
  locationState: LocationSourceState,
  geoPhase: GeoPhase
): string {
  if (geoPhase === "requesting") {
    return "Đang chờ bạn cấp quyền vị trí từ trình duyệt...";
  }

  if (locationState.source === "browser") {
    return `GPS của bạn • ${locationState.lat?.toFixed(4)}, ${locationState.lng?.toFixed(4)}`;
  }

  if (locationState.source === "manual") {
    return `Đã chọn thủ công • ${locationState.label}`;
  }

  if (locationState.source === "fallback") {
    return `Mặc định • ${locationState.label}`;
  }

  return "Đang xác định vị trí...";
}

function getCurrentPositionAsync(
  options?: PositionOptions
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Trình duyệt không hỗ trợ geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function timeAgo(input?: string | null): string {
  if (!input) return "Không rõ";
  const date = new Date(input);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (Number.isNaN(date.getTime())) return "Không rõ";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;

  return date.toLocaleString("vi-VN");
}

function formatDateTime(input?: string | null): string {
  if (!input) return "Chưa có";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Chưa có";

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getSosTypeLabel(type?: string) {
  switch ((type || "").toLowerCase()) {
    case "rescue":
      return "Cần cứu hộ khẩn cấp";
    case "supplies":
      return "Cần nhu yếu phẩm";
    case "vehicle":
      return "Cần cứu hộ xe";
    default:
      return "Yêu cầu khác";
  }
}

function formatDateOnly(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN");
}

function formatRangeDisplay(start?: string, end?: string) {
  if (!start && !end) return "Chọn khoảng ngày";
  if (start && !end) return `${formatDateOnly(start)} → Chọn ngày cuối`;
  if (!start && end) return `Chọn ngày đầu → ${formatDateOnly(end)}`;
  return `${formatDateOnly(start)} - ${formatDateOnly(end)}`;
}

function getSosTypeFilterLabel(value: RescueTypeFilter) {
  switch (value) {
    case "rescue":
      return "Cần cứu hộ khẩn cấp";
    case "supplies":
      return "Cần nhu yếu phẩm";
    case "vehicle":
      return "Cần cứu hộ xe";
    case "other":
      return "Yêu cầu khác";
    default:
      return "Tất cả loại yêu cầu";
  }
}

function getWeatherIconText(code?: number) {
  const c = Number(code || 0);

  if (c >= 95) return "⛈️";
  if (c >= 80) return "🌧️";
  if (c >= 61) return "🌧️";
  if (c >= 51) return "🌦️";
  if (c >= 45) return "🌫️";
  if (c >= 3) return "☁️";
  if (c >= 1) return "🌤️";
  return "☀️";
}

function formatWeatherHourLabel(time?: string, index?: number) {
  const date = new Date(time || "");

  if (Number.isNaN(date.getTime())) {
    return index === 0 ? "Giờ tới" : `+${(index || 0) + 1}h`;
  }

  return `${String(date.getHours()).padStart(2, "0")}h`;
}

function getFutureHourlyForecast(hourly?: WeatherHour[], limit = 12) {
  const list = Array.isArray(hourly) ? hourly : [];
  const nowTs = Date.now();

  const futureList = list.filter((item) => {
    const date = new Date(item.time || "");
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() > nowTs;
  });

  if (futureList.length > 0) {
    return futureList.slice(0, limit);
  }

  return list.slice(1, limit + 1);
}

function getTemperatureTone(temp: number) {
  if (temp >= 35) {
    return {
      card: "bg-gradient-to-br from-red-500 via-rose-600 to-slate-950 border-red-200 dark:border-red-900/40",
      chip: "bg-red-500/20 text-red-50 border-red-200/30",
      bar: "bg-red-300",
      label: "Rất nóng",
    };
  }

  if (temp >= 30) {
    return {
      card: "bg-gradient-to-br from-orange-500 via-amber-600 to-slate-950 border-orange-200 dark:border-orange-900/40",
      chip: "bg-orange-500/20 text-orange-50 border-orange-200/30",
      bar: "bg-orange-300",
      label: "Nóng",
    };
  }

  if (temp >= 24) {
    return {
      card: "bg-gradient-to-br from-emerald-500 via-sky-600 to-slate-950 border-emerald-200 dark:border-emerald-900/40",
      chip: "bg-emerald-500/20 text-emerald-50 border-emerald-200/30",
      bar: "bg-emerald-300",
      label: "Dễ chịu",
    };
  }

  if (temp >= 18) {
    return {
      card: "bg-gradient-to-br from-sky-500 via-blue-600 to-slate-950 border-sky-200 dark:border-sky-900/40",
      chip: "bg-sky-500/20 text-sky-50 border-sky-200/30",
      bar: "bg-sky-300",
      label: "Mát",
    };
  }

  return {
    card: "bg-gradient-to-br from-cyan-500 via-blue-700 to-slate-950 border-cyan-200 dark:border-cyan-900/40",
    chip: "bg-cyan-500/20 text-cyan-50 border-cyan-200/30",
    bar: "bg-cyan-300",
    label: "Lạnh",
  };
}

const toRad = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const estimateArrivalFromDistance = (distanceKm: number, sosType?: string) => {
  let avgSpeedKmH = 35;

  if (sosType === "vehicle") avgSpeedKmH = 40;
  else if (sosType === "supplies") avgSpeedKmH = 30;
  else if (sosType === "rescue") avgSpeedKmH = 35;
  else avgSpeedKmH = 30;

  const totalMinutes = Math.max(1, Math.round((distanceKm / avgSpeedKmH) * 60));

  if (totalMinutes < 60) return `Khoảng ${totalMinutes} phút`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) return `Khoảng ${hours} giờ`;
  return `Khoảng ${hours} giờ ${minutes} phút`;
};

const getTrackingInfo = (item?: RescueItem | null) => {
  if (!item) return null;

  const rescueLat = Number(item.rescuer_lat);
  const rescueLng = Number(item.rescuer_lng);
  const sosLat = Number(item.lat);
  const sosLng = Number(item.lng);

  const hasValidCoords =
    Number.isFinite(rescueLat) &&
    Number.isFinite(rescueLng) &&
    Number.isFinite(sosLat) &&
    Number.isFinite(sosLng);

  if (!hasValidCoords) return null;

  const distanceKm = calculateDistanceKm(rescueLat, rescueLng, sosLat, sosLng);

  return {
    distanceKm,
    distanceText:
      distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`,
    etaText: estimateArrivalFromDistance(distanceKm, item.sos_type),
  };
};

const getStepStatus = (item: RescueItem): StepStatus => {
  const tracking = getTrackingInfo(item);

  if (item.status === "cancel") {
    return {
      currentStep: 1,
      title: "Đã hủy",
      badgeClass:
        "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30",
      eta: null,
      distance: null,
    };
  }

  if (item.status === "done") {
    return {
      currentStep: 4,
      title: "Hoàn thành",
      badgeClass:
        "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30",
      eta: null,
      distance: null,
    };
  }

  if (item.status === "rescuing") {
    const moved = hasRescuerMoved(item);

    if (moved) {
      return {
        currentStep: 3,
        title: "Đang đến",
        badgeClass:
          "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30",
        eta: tracking?.etaText || null,
        distance: tracking?.distanceText || null,
      };
    }

    return {
      currentStep: 2,
      title: "Tiếp nhận",
      badgeClass:
        "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30",
      eta: tracking?.etaText || null,
      distance: tracking?.distanceText || null,
    };
  }

  return {
    currentStep: 1,
    title: "Chờ tiếp nhận",
    badgeClass:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30",
    eta: null,
    distance: null,
  };
};

function getSnapshotStore(): Record<string, { lat: number | null; lng: number | null }> {
  try {
    const raw = localStorage.getItem(HOME_TRACKING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSnapshotStore(
  data: Record<string, { lat: number | null; lng: number | null }>
) {
  localStorage.setItem(HOME_TRACKING_STORAGE_KEY, JSON.stringify(data));
}

function hasRescuerMoved(item: RescueItem) {
  if ((item.status || "").toLowerCase() !== "rescuing" || !item.handled_by) {
    return false;
  }

  const rescueLat = Number(item.rescuer_lat);
  const rescueLng = Number(item.rescuer_lng);

  if (!Number.isFinite(rescueLat) || !Number.isFinite(rescueLng)) {
    return false;
  }

  const store = getSnapshotStore();
  const key = String(item.id);

  if (!store[key]) {
    store[key] = { lat: rescueLat, lng: rescueLng };
    saveSnapshotStore(store);
    return false;
  }

  const base = store[key];
  const moved =
    base.lat !== null &&
    base.lng !== null &&
    (Math.abs(rescueLat - base.lat) > 0.00001 ||
      Math.abs(rescueLng - base.lng) > 0.00001);

  return moved;
}

function getStatusMeta(itemOrStatus?: RescueItem | string) {
  const isItem = typeof itemOrStatus === "object" && itemOrStatus !== null;
  const normalized = (
    isItem ? itemOrStatus.status : itemOrStatus || ""
  ).toLowerCase();

  if (normalized === "new") {
    return {
      label: "Chờ tiếp nhận",
      dot: "bg-amber-500",
      pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      progress: "w-1/4",
    };
  }

  if (normalized === "rescuing") {
    const moved = isItem ? hasRescuerMoved(itemOrStatus as RescueItem) : false;

    if (moved) {
      return {
        label: "Đang đến",
        dot: "bg-blue-500",
        pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        progress: "w-2/3",
      };
    }

    return {
      label: "Tiếp nhận",
      dot: "bg-blue-500",
      pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      progress: "w-1/2",
    };
  }

  if (normalized === "done") {
    return {
      label: "Đã hoàn thành",
      dot: "bg-emerald-500",
      pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      progress: "w-full",
    };
  }

  if (normalized === "cancel") {
    return {
      label: "Đã hủy",
      dot: "bg-rose-500",
      pill: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
      progress: "w-full",
    };
  }

  return {
    label: "Không rõ",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
    progress: "w-1/3",
  };
}

function normalizeImages(images?: string | string[]) {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isVisibleOnHome(item: RescueItem) {
  const status = (item.status || "").toLowerCase();
  return status !== "done" && status !== "cancel";
}

function isOwnRescue(item?: RescueItem | null, currentUserId?: number) {
  if (!item || !currentUserId) return false;
  return Number(item.user_id) === Number(currentUserId);
}

function canEditOwnRescue(item?: RescueItem | null, currentUserId?: number) {
  if (!isOwnRescue(item, currentUserId)) return false;
  const status = String(item?.status || "").toLowerCase();
  return status !== "done" && status !== "cancel";
}

function canCancelOwnRescue(item?: RescueItem | null, currentUserId?: number) {
  if (!isOwnRescue(item, currentUserId)) return false;
  const status = String(item?.status || "").toLowerCase();
  return status === "new" && !item?.assigned_team && !item?.handled_by;
}

function isRescueTeamRole(role?: string) {
  return ["rescuer", "rescue"].includes(String(role || "").toLowerCase());
}

function isAdminRole(role?: string) {
  return String(role || "").toLowerCase() === "admin";
}

function canReceiveRescueRequest(item?: RescueItem | null, currentUserRole?: string) {
  if (!item || !isRescueTeamRole(currentUserRole)) return false;
  return String(item.status || "").toLowerCase() === "new";
}

function canManageReceivedRescue(
  item?: RescueItem | null,
  currentUserId?: number,
  currentUserRole?: string
) {
  if (!item) return false;

  const status = String(item.status || "").toLowerCase();
  if (status !== "rescuing") return false;

  if (isAdminRole(currentUserRole)) return true;

  if (!currentUserId || !isRescueTeamRole(currentUserRole)) return false;
  return Number(item.handled_by) === Number(currentUserId);
}

function canCancelRescueRequest(
  item?: RescueItem | null,
  currentUserId?: number,
  currentUserRole?: string
) {
  if (!item) return false;

  const status = String(item.status || "").toLowerCase();

  if (isAdminRole(currentUserRole)) {
    return status === "new" && !item.assigned_team && !item.handled_by;
  }

  return canCancelOwnRescue(item, currentUserId);
}

function getRescueTeamActionText(action: RescueTeamAction) {
  switch (action) {
    case "receive":
      return {
        title: "Xác nhận nhận yêu cầu",
        desc: "Yêu cầu này sẽ được chuyển sang trạng thái đang cứu hộ.",
        question: "Bạn có chắc muốn nhận yêu cầu cứu hộ này không?",
        confirmLabel: "Xác nhận nhận",
        loadingLabel: "Đang nhận...",
        tone: "red" as const,
        nextStatus: "rescuing" as const,
      };
    case "cancel_receive":
      return {
        title: "Xác nhận hủy nhận yêu cầu",
        desc: "Yêu cầu này sẽ được chuyển lại trạng thái chờ tiếp nhận.",
        question: "Bạn có chắc muốn hủy nhận yêu cầu này không?",
        confirmLabel: "Xác nhận hủy",
        loadingLabel: "Đang hủy...",
        tone: "amber" as const,
        nextStatus: "new" as const,
      };
    default:
      return {
        title: "Xác nhận hoàn thành",
        desc: "Yêu cầu này sẽ được đánh dấu là đã hoàn thành.",
        question: "Bạn có chắc yêu cầu cứu hộ này đã hoàn thành không?",
        confirmLabel: "Xác nhận hoàn thành",
        loadingLabel: "Đang hoàn thành...",
        tone: "emerald" as const,
        nextStatus: "done" as const,
      };
  }
}

function parseCoords(text: string) {
  const parts = text.trim().split(/[ ,]+/);
  if (parts.length < 2) return null;

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

const miniMapMarkerIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

function isInVietnam(lat: number, lng: number) {
  return lat >= 8.55 && lat <= 23.35 && lng >= 102.35 && lng <= 109.48;
}

function hasDirectionInfo(item?: RescueItem | null) {
  if (!item) return false;

  const lat = Number(item.lat);
  const lng = Number(item.lng);

  return (
    (Number.isFinite(lat) && Number.isFinite(lng)) ||
    Boolean(item.address?.trim())
  );
}

const FlyToMiniMapLocation = ({ position }: { position: [number, number] }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.2 });
    }
  }, [position, map]);

  return null;
};

const MiniMapFixSize = () => {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

const MiniMapSelectLocation = ({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const handleClick = (e: any) => {
      const { lat, lng } = e.latlng;
      onSelect(lat, lng);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, onSelect]);

  return null;
};

const GoongStyleLayer = ({ enabled }: { enabled: boolean }) => {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!GOONG_API_KEY || !enabled) return;

    try {
      const styleUrl = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_API_KEY}`;
      const createLayer = (L as any).mapboxGL;

      if (typeof createLayer !== "function") {
        console.error("mapboxGL function không khả dụng");
        return;
      }

      if (!layerRef.current) {
        layerRef.current = createLayer({
          style: styleUrl,
          accessToken: GOONG_API_KEY,
          mapboxgl,
          attribution: "&copy; GOONG Map",
        });
      }

      if (!map.hasLayer(layerRef.current)) {
        layerRef.current.addTo(map);
      }
    } catch (error) {
      console.error("Error adding Goong layer:", error);
    }

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [enabled, map]);

  return null;
};

/* =========================
   TOAST
========================= */
const NotificationToast: React.FC<NotificationToastProps> = ({
  toast,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const [showAnim, setShowAnim] = useState(false);

  useEffect(() => {
    if (toast.show) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShowAnim(true));
      return () => cancelAnimationFrame(raf);
    }

    setShowAnim(false);
    const timer = setTimeout(() => setMounted(false), 280);
    return () => clearTimeout(timer);
  }, [toast.show, toast.id]);

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(onClose, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.show, toast.duration, onClose]);

  if (!mounted) return null;

  const meta = toastMeta[toast.type];
  const Icon = meta.icon;

  return createPortal(
    <>
      <style>{`
        @keyframes toastIn {
          0% { opacity: 0; transform: translateY(-20px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastOut {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-15px); }
        }
        @keyframes shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>

      <div className="fixed top-5 inset-x-0 flex justify-center z-[20000] pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto w-[360px] rounded-2xl border shadow-2xl overflow-hidden bg-white dark:bg-slate-900",
            meta.border
          )}
          style={{
            animation: `${showAnim ? "toastIn" : "toastOut"} 0.28s ease`,
          }}
        >
          <div className="relative flex items-start gap-3 p-4">
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                meta.iconWrap
              )}
            >
              <Icon size={18} />
            </div>

            <div className="flex-1">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {meta.title}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {toast.message}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Tự đóng sau {Math.ceil(toast.duration / 1000)}s
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          <div className="h-1 bg-slate-100 dark:bg-slate-800">
            <div
              key={toast.id}
              className={meta.line}
              style={{
                height: "100%",
                transformOrigin: "left",
                animation: `shrink ${toast.duration}ms linear forwards`,
              }}
            />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

/* =========================
   MAIN
========================= */
const Home: React.FC = () => {

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: 4500,
  });

  const [weather, setWeather] = useState<WeatherSummary>({
    temperature: 0,
    rainProbability: 0,
    rain: 0,
    windSpeed: 0,
    riskLabel: "Đang cập nhật",
    updatedAt: "",
    weatherText: "",
    current: null,
    hourly12: [],
  });

  const [rescues, setRescues] = useState<RescueItem[]>([]);
  const [rescuesLoading, setRescuesLoading] = useState(true);

  const [weatherLoading, setWeatherLoading] = useState(true);
  const [geoPhase, setGeoPhase] = useState<GeoPhase>("idle");
  const [showManualSelector, setShowManualSelector] = useState(false);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("da_nang");

  const [locationState, setLocationState] = useState<LocationSourceState>({
    source: "unknown",
    label: "Đang xác định vị trí...",
    lat: null,
    lng: null,
  });

  const [showAllModal, setShowAllModal] = useState(false);
  const [selectedRescue, setSelectedRescue] = useState<RescueItem | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<RescueStatusFilter>("all");
  const [sosTypeFilter, setSosTypeFilter] =
    useState<RescueTypeFilter>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [datePickerStep, setDatePickerStep] = useState<"start" | "end">("start");
  const dateRangePickerRef = useRef<HTMLDivElement | null>(null);

  const [showSosTypeDropdown, setShowSosTypeDropdown] = useState(false);
  const sosTypeDropdownRef = useRef<HTMLDivElement | null>(null);

  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [pendingCancelItem, setPendingCancelItem] = useState<RescueItem | null>(null);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);

  const [pendingRescueTeamAction, setPendingRescueTeamAction] =
    useState<RescueTeamActionState | null>(null);
  const [submittingRescueTeamAction, setSubmittingRescueTeamAction] = useState(false);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editImages, setEditImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [editSosType, setEditSosType] = useState<EditSosType>("");

  const [updateModalSource, setUpdateModalSource] = useState<"list" | "detail" | null>(null);

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    coords: "",
    victims: 1,
    note: "",
    source_url: "",
  });

  const [showConfirmCloseUpdateModal, setShowConfirmCloseUpdateModal] = useState(false);

  const [editLocationMode, setEditLocationMode] = useState<"address" | "coords">("address");
  const [editSelectedProvinceCode, setEditSelectedProvinceCode] = useState("");
  const [editSelectedWardCode, setEditSelectedWardCode] = useState("");
  const [editAddressDetail, setEditAddressDetail] = useState("");

  const [editLoadingProvinces, setEditLoadingProvinces] = useState(false);
  const [editLoadingWards, setEditLoadingWards] = useState(false);
  const [editProvinces, setEditProvinces] = useState<Array<{ code: string; name: string }>>([]);
  const [editWards, setEditWards] = useState<Array<{ code: string; name: string }>>([]);

  const [editIsFindingAddress, setEditIsFindingAddress] = useState(false);
  const [editIsGettingGPS, setEditIsGettingGPS] = useState(false);
  const [editIsFindingCoords, setEditIsFindingCoords] = useState(false);

  const [editMapPosition, setEditMapPosition] = useState<[number, number]>([16.0544, 108.2022]);
  const [editMapType] = useState<"default" | "satellite">("default");

  const [auth, setAuth] = useState<AuthSnapshot>(() => readAuthSnapshot());

  const currentUserId = auth.currentUserId;
  const currentUserRole = auth.currentUserRole;
  const token = auth.token;
  const rescueTeamActionLoadingId = submittingRescueTeamAction
    ? pendingRescueTeamAction?.item.id ?? null
    : null;

  const currentWeatherForRisk = useMemo<WeatherSummary>(() => {
    const current = weather.current;

    return {
      ...weather,
      temperature: Number(current?.temperature ?? weather.temperature ?? 0),
      rainProbability: Number(
        current?.rainProbability ?? weather.rainProbability ?? 0
      ),
      rain: Number(current?.rain ?? weather.rain ?? 0),
      windSpeed: Number(current?.windSpeed ?? weather.windSpeed ?? 0),
      weatherText: current?.weatherText || weather.weatherText || "",
    };
  }, [weather]);

  const riskStats: RiskItem[] = useMemo(() => {
    const floodRisk = Math.min(
      100,
      Math.round(
        currentWeatherForRisk.rainProbability * 0.5 +
        currentWeatherForRisk.rain * 2
      )
    );

    const landslideRisk = Math.min(
      100,
      Math.round(
        currentWeatherForRisk.rainProbability * 0.35 +
        currentWeatherForRisk.rain * 1.5
      )
    );

    const isolationRisk = Math.min(
      100,
      Math.round(
        currentWeatherForRisk.rainProbability * 0.25 +
        currentWeatherForRisk.windSpeed * 1.2
      )
    );

    return [
      { label: "Ngập lụt sâu (>2m)", percent: floodRisk, color: "bg-red-500" },
      { label: "Sạt lở đất", percent: landslideRisk, color: "bg-amber-500" },
      { label: "Cô lập hoàn toàn", percent: isolationRisk, color: "bg-blue-500" },
    ];
  }, [currentWeatherForRisk]);

  const visibleHomeRescues = useMemo(() => {
    return rescues.filter(isVisibleOnHome);
  }, [rescues]);

  const stats = useMemo(() => {
    const now = Date.now();

    const sosLastHour = visibleHomeRescues.filter((item) => {
      if (!item.created_at) return false;
      const created = new Date(item.created_at).getTime();
      if (Number.isNaN(created)) return false;
      return now - created <= 60 * 60 * 1000;
    }).length;

    const waiting = visibleHomeRescues.filter((item) => {
      const meta = getStatusMeta(item);
      return meta.label === "Chờ tiếp nhận";
    }).length;

    const rescuing = visibleHomeRescues.filter((item) => {
      const meta = getStatusMeta(item);
      return meta.label === "Tiếp nhận" || meta.label === "Đang đến";
    }).length;

    return {
      sosLastHour,
      waiting,
      rescuing,
    };
  }, [visibleHomeRescues]);

  const fallbackAiAdvice = useMemo<AiAdvice>(() => {
    return {
      ...generateAdvice(currentWeatherForRisk),
      source: "local_rule",
    };
  }, [currentWeatherForRisk]);

  const [aiAdvice, setAiAdvice] = useState<AiAdvice>(fallbackAiAdvice);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);

  const aiAdviceLastFetchRef = useRef(0);
  const aiAdviceSignatureRef = useRef("");
  const aiAdviceAbortRef = useRef<AbortController | null>(null);

  const aiAdvicePayload = useMemo(() => {
    return {
      location: {
        source: locationState.source,
        label: locationState.label,
        lat: locationState.lat,
        lng: locationState.lng,
      },
      weather: {
        temperature: currentWeatherForRisk.temperature,
        rainProbability: currentWeatherForRisk.rainProbability,
        rain: currentWeatherForRisk.rain,
        windSpeed: currentWeatherForRisk.windSpeed,
        weatherText: currentWeatherForRisk.weatherText,
        riskLabel: currentWeatherForRisk.riskLabel,
        updatedAt: currentWeatherForRisk.updatedAt,
        hourly12: currentWeatherForRisk.hourly12 || [],
      },
      stats,
    };
  }, [
    locationState.source,
    locationState.label,
    locationState.lat,
    locationState.lng,
    currentWeatherForRisk.temperature,
    currentWeatherForRisk.rainProbability,
    currentWeatherForRisk.rain,
    currentWeatherForRisk.windSpeed,
    currentWeatherForRisk.weatherText,
    currentWeatherForRisk.riskLabel,
    currentWeatherForRisk.updatedAt,
    currentWeatherForRisk.hourly12,
    stats,
  ]);

  const aiAdviceSignature = useMemo(() => {
    return JSON.stringify({
      location: {
        source: locationState.source,
        label: locationState.label,
        lat:
          locationState.lat === null || locationState.lat === undefined
            ? null
            : Number(locationState.lat.toFixed(4)),
        lng:
          locationState.lng === null || locationState.lng === undefined
            ? null
            : Number(locationState.lng.toFixed(4)),
      },
      weather: {
        temperature: Math.round(currentWeatherForRisk.temperature),
        rainProbability: Math.round(currentWeatherForRisk.rainProbability),
        rain: Number(currentWeatherForRisk.rain.toFixed(1)),
        windSpeed: Math.round(currentWeatherForRisk.windSpeed),
        weatherText: currentWeatherForRisk.weatherText,
        riskLabel: currentWeatherForRisk.riskLabel,
      },
      stats: {
        sosLastHour: stats.sosLastHour,
        waiting: stats.waiting,
        rescuing: stats.rescuing,
      },
    });
  }, [
    locationState.source,
    locationState.label,
    locationState.lat,
    locationState.lng,
    currentWeatherForRisk.temperature,
    currentWeatherForRisk.rainProbability,
    currentWeatherForRisk.rain,
    currentWeatherForRisk.windSpeed,
    currentWeatherForRisk.weatherText,
    currentWeatherForRisk.riskLabel,
    stats.sosLastHour,
    stats.waiting,
    stats.rescuing,
  ]);

  useEffect(() => {
    if (weatherLoading || geoPhase === "requesting") {
      return;
    }

    const nowMs = Date.now();
    const isSameData = aiAdviceSignatureRef.current === aiAdviceSignature;
    const isStillFresh =
      nowMs - aiAdviceLastFetchRef.current < AI_ADVICE_REFRESH_MS;

    // Nếu dữ liệu không đổi và chưa quá 1 phút thì không gọi Groq lại
    if (isSameData && isStillFresh) {
      return;
    }

    aiAdviceAbortRef.current?.abort();

    const controller = new AbortController();
    aiAdviceAbortRef.current = controller;

    const fetchAiAdvice = async () => {
      setAiAdviceLoading(true);

      try {
        const res = await fetch(`${API_BASE}/api/ai/safety-advice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify(aiAdvicePayload),
        });

        if (!res.ok) {
          throw new Error("Không gọi được API Groq AI gợi ý an toàn");
        }

        const data = await res.json();

        const safeLevel =
          data.level === "high" || data.level === "medium" || data.level === "low"
            ? data.level
            : fallbackAiAdvice.level;

        setAiAdvice({
          level: safeLevel,
          title: data.title || fallbackAiAdvice.title,
          message: data.message || fallbackAiAdvice.message,
          tips:
            Array.isArray(data.tips) && data.tips.length > 0
              ? data.tips.slice(0, 3)
              : fallbackAiAdvice.tips,
          reasons: Array.isArray(data.reasons) ? data.reasons.slice(0, 3) : [],
          actionNow: data.actionNow || "",
          confidence: Number(data.confidence || 0),
          source: data.source || "rule_fallback",
          note: data.note || "",
        });

        aiAdviceSignatureRef.current = aiAdviceSignature;
        aiAdviceLastFetchRef.current = Date.now();
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("fetchAiAdvice error:", error);

          setAiAdvice({
            ...fallbackAiAdvice,
            source: "local_rule",
            note: "Không gọi được Groq AI, hệ thống đang dùng gợi ý dự phòng.",
          });

          aiAdviceSignatureRef.current = aiAdviceSignature;
          aiAdviceLastFetchRef.current = Date.now();
        }
      } finally {
        if (!controller.signal.aborted) {
          setAiAdviceLoading(false);
        }
      }
    };

    fetchAiAdvice();

    return () => controller.abort();
  }, [
    aiAdvicePayload,
    aiAdviceSignature,
    fallbackAiAdvice,
    weatherLoading,
    geoPhase,
  ]);

  const recentRescues = useMemo(() => {
    return [...visibleHomeRescues]
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [visibleHomeRescues]);

  const allStatusCounts = useMemo(() => {
    return {
      all: rescues.length,
      new: rescues.filter((item) => item.status === "new").length,
      rescuing: rescues.filter((item) => item.status === "rescuing").length,
      done: rescues.filter((item) => item.status === "done").length,
      cancel: rescues.filter((item) => item.status === "cancel").length,
    };
  }, [rescues]);

  const modalBaseRescues = useMemo(() => {
    let list = isAdminRole(currentUserRole)
      ? rescues.filter((item) => {
        const status = String(item.status || "").toLowerCase();
        return status !== "cancel";
      })
      : rescues.filter(isVisibleOnHome);

    const keyword = searchTerm.trim().toLowerCase();
    if (keyword) {
      list = list.filter((item) => {
        const blob = [
          `#SOS-${item.id}`,
          String(item.id),
          item.name,
          item.phone,
          item.address,
          getSosTypeLabel(item.sos_type),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return blob.includes(keyword);
      });
    }

    if (sosTypeFilter !== "all") {
      list = list.filter(
        (item) => (item.sos_type || "").toLowerCase() === sosTypeFilter
      );
    }

    if (dateRange.start || dateRange.end) {
      list = list.filter((item) => {
        if (!item.created_at) return false;

        const created = new Date(item.created_at);
        if (Number.isNaN(created.getTime())) return false;

        if (dateRange.start) {
          const start = new Date(dateRange.start);
          start.setHours(0, 0, 0, 0);
          if (created < start) return false;
        }

        if (dateRange.end) {
          const end = new Date(dateRange.end);
          end.setHours(23, 59, 59, 999);
          if (created > end) return false;
        }

        return true;
      });
    }

    return list;
  }, [rescues, searchTerm, sosTypeFilter, dateRange, currentUserRole]);

  const modalRescues = useMemo(() => {
    let list = [...modalBaseRescues];

    if (statusFilter !== "all") {
      list = list.filter(
        (item) => (item.status || "").toLowerCase() === statusFilter
      );
    }

    list.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : a.id;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : b.id;
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [modalBaseRescues, statusFilter, sortOrder]);

  const modalStatusCounts = useMemo(() => {
    return {
      all: modalBaseRescues.length,
      new: modalBaseRescues.filter(
        (item) => (item.status || "").toLowerCase() === "new"
      ).length,
      rescuing: modalBaseRescues.filter(
        (item) => (item.status || "").toLowerCase() === "rescuing"
      ).length,
      done: modalBaseRescues.filter(
        (item) => (item.status || "").toLowerCase() === "done"
      ).length,
    };
  }, [modalBaseRescues]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    sosTypeFilter,
    sortOrder,
    dateRange.start,
    dateRange.end,
    showAllModal,
  ]);

  const totalPages = Math.max(1, Math.ceil(modalRescues.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;

  const paginatedModalRescues = modalRescues.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const fromRecord = modalRescues.length === 0 ? 0 : startIndex + 1;
  const toRecord =
    modalRescues.length === 0
      ? 0
      : Math.min(startIndex + itemsPerPage, modalRescues.length);

  const openDateRangePicker = () => {
    setShowSosTypeDropdown(false);

    setShowDateRangePicker((prev) => {
      if (prev) return false;
      setDatePickerStep(dateRange.start ? "end" : "start");
      return true;
    });
  };

  const clearDateRange = () => {
    setDateRange({ start: "", end: "" });
    setDatePickerStep("start");
  };

  const handleOpenAllRescues = () => {
    setShowAllModal(true);
  };

  const handleSelectRangeDate = (value: string) => {
    if (!value) return;

    if (datePickerStep === "start") {
      setDateRange({ start: value, end: "" });
      setDatePickerStep("end");
      return;
    }

    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = new Date(value);

    if (startDate && endDate < startDate) {
      setDateRange({ start: value, end: dateRange.start });
    } else {
      setDateRange((prev) => ({ ...prev, end: value }));
    }

    setShowDateRangePicker(false);
    setDatePickerStep("start");
  };

  const showToast = (
    message: string,
    type: ToastType = "info",
    duration = 3000
  ) => {
    setToast({
      id: Date.now(),
      show: true,
      message,
      type,
      duration,
    });
  };

  const openDirections = (item: RescueItem) => {
    const lat = Number(item.lat);
    const lng = Number(item.lng);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        "_blank"
      );
      return;
    }

    const address = item.address?.trim();

    if (address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        "_blank"
      );
      return;
    }

    showToast("Không có thông tin vị trí để chỉ đường.", "error");
  };

  const syncAuthState = (shouldRefreshRescues = true) => {
    setAuth(readAuthSnapshot());

    if (shouldRefreshRescues) {
      fetchRescues(true);
    }
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "token" || e.key === "userId" || e.key === "role" || e.key === null) {
        syncAuthState(true);
      }
    };

    const handleAuthChanged = () => {
      syncAuthState(true);
    };

    const handleFocus = () => {
      syncAuthState(true);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("auth-changed", handleAuthChanged as EventListener);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("auth-changed", handleAuthChanged as EventListener);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setShowUpdateModal(false);
      setShowCancelConfirmModal(false);
      setPendingCancelItem(null);
      setPendingRescueTeamAction(null);
    }
  }, [token]);


  useEffect(() => {
    const forcedLogoutMessage = sessionStorage.getItem("forced_logout_message");
    if (!forcedLogoutMessage) return;

    showToast(forcedLogoutMessage, "warning", 4500);
    sessionStorage.removeItem("forced_logout_message");
  }, []);

  const fetchRescues = async (silent = false) => {
    try {
      if (!silent) setRescuesLoading(true);

      const res = await fetch(`${API_BASE}/api/rescues`);
      if (!res.ok) throw new Error("Không lấy được dữ liệu SOS");

      const data = await res.json();
      setRescues(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("fetchRescues error:", error);
      if (!silent) {
        showToast("Không lấy được danh sách SOS gần đây.", "error", 3500);
      }
    } finally {
      if (!silent) setRescuesLoading(false);
    }
  };

  const fetchWeatherByCoords = async (lat: number, lng: number) => {
    setWeatherLoading(true);

    try {
      const weatherRes = await fetch(
        `${API_BASE}/api/weather?lat=${lat}&lng=${lng}`
      );

      if (!weatherRes.ok) {
        throw new Error("Không lấy được dữ liệu thời tiết");
      }

      const weatherData = await weatherRes.json();

      setWeather({
        temperature: Number(weatherData.temperature ?? weatherData.current?.temperature ?? 0),
        rainProbability: Number(
          weatherData.rainProbability ?? weatherData.current?.rainProbability ?? 0
        ),
        rain: Number(weatherData.rain ?? weatherData.current?.rain ?? 0),
        windSpeed: Number(weatherData.windSpeed ?? weatherData.current?.windSpeed ?? 0),
        riskLabel: weatherData.riskLabel || "Đang cập nhật",
        updatedAt: weatherData.updatedAt || "",
        weatherText:
          weatherData.weatherText ||
          weatherData.current?.weatherText ||
          "",
        current: weatherData.current || null,
        hourly12: Array.isArray(weatherData.hourly12)
          ? weatherData.hourly12
          : [],
      });
    } catch (error) {
      console.error("fetchWeatherByCoords error:", error);

      setWeather({
        temperature: 0,
        rainProbability: 0,
        rain: 0,
        windSpeed: 0,
        riskLabel: "Không lấy được dữ liệu",
        updatedAt: new Date().toLocaleString("vi-VN"),
        weatherText: "",
        current: null,
        hourly12: [],
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  const persistUserLocationIfLoggedIn = async (lat: number, lng: number) => {
    try {
      const tokenLocal = localStorage.getItem("token");
      if (!tokenLocal) return;

      await fetch(`${API_BASE}/api/user/location`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenLocal}`,
        },
        body: JSON.stringify({ lat, lng }),
      });
    } catch (error) {
      console.error("persistUserLocationIfLoggedIn error:", error);
    }
  };

  const refreshWeatherNow = async () => {
    if (
      locationState.lat === null ||
      locationState.lng === null ||
      !Number.isFinite(locationState.lat) ||
      !Number.isFinite(locationState.lng)
    ) {
      showToast("Chưa có tọa độ để cập nhật dự báo.", "warning");
      return;
    }

    await fetchWeatherByCoords(locationState.lat, locationState.lng);
    showToast("Đã cập nhật lại dự báo thời tiết.", "success", 2500);
  };

  const applyManualProvince = async (provinceCode: string) => {
    const selected = PROVINCES.find((item) => item.code === provinceCode);
    if (!selected) return;

    setSelectedProvinceCode(provinceCode);
    setLocationState({
      source: "manual",
      label: selected.name,
      lat: selected.lat,
      lng: selected.lng,
    });

    await fetchWeatherByCoords(selected.lat, selected.lng);
  };

  const syncRescuerLocationOnce = async () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const tokenLocal = localStorage.getItem("token");
          if (!tokenLocal) return;

          await fetch(`${API_BASE}/api/rescuer/location`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenLocal}`,
            },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
        } catch (error) {
          console.error("syncRescuerLocationOnce error:", error);
        }
      },
      (error) => {
        console.error("Không lấy được GPS đội cứu hộ:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      }
    );
  };

  const openRescueTeamActionConfirm = (item: RescueItem, action: RescueTeamAction) => {
    if (!token) {
      showToast("Bạn cần đăng nhập để thao tác yêu cầu cứu hộ.", "warning");
      return;
    }

    if (!isRescueTeamRole(currentUserRole) && !isAdminRole(currentUserRole)) {
      showToast("Bạn không có quyền thực hiện thao tác này.", "warning");
      return;
    }

    if (action === "receive" && !canReceiveRescueRequest(item, currentUserRole)) {
      showToast("Yêu cầu này không còn ở trạng thái chờ tiếp nhận.", "warning");
      return;
    }

    if (
      action !== "receive" &&
      !canManageReceivedRescue(item, currentUserId, currentUserRole)
    ) {
      showToast(
        isAdminRole(currentUserRole)
          ? "Chỉ có thể hủy nhận hoặc hoàn thành khi yêu cầu đã có đội tiếp nhận."
          : "Chỉ đội đã nhận yêu cầu này mới có thể hủy nhận hoặc hoàn thành.",
        "warning"
      );
      return;
    }

    setPendingRescueTeamAction({ item, action });
  };

  const handleConfirmRescueTeamAction = async () => {
    if (!pendingRescueTeamAction) return;

    const { item, action } = pendingRescueTeamAction;
    const meta = getRescueTeamActionText(action);

    if (!token) {
      showToast("Bạn cần đăng nhập để thao tác yêu cầu cứu hộ.", "warning");
      return;
    }

    try {
      setSubmittingRescueTeamAction(true);

      const res = await fetch(`${API_BASE}/api/rescues/${item.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: meta.nextStatus }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMessage = data?.message || "Không thể cập nhật trạng thái yêu cầu.";
        showToast(errorMessage, res.status === 409 ? "warning" : "error");
        return;
      }

      const updatedItem: RescueItem = data?.rescue || data?.data || data;

      setRescues((prev) =>
        prev.map((rescue) =>
          Number(rescue.id) === Number(item.id) ? { ...rescue, ...updatedItem } : rescue
        )
      );

      setSelectedRescue((prev) =>
        prev && Number(prev.id) === Number(item.id) ? { ...prev, ...updatedItem } : prev
      );

      await fetchRescues(true);

      if (action === "receive") {
        syncRescuerLocationOnce();
        showToast("Đã nhận yêu cầu cứu hộ.", "success");
      } else if (action === "cancel_receive") {
        showToast("Đã hủy nhận yêu cầu.", "success");
      } else {
        showToast("Đã hoàn thành yêu cầu cứu hộ.", "success");
        setSelectedRescue(null);
      }

      setPendingRescueTeamAction(null);
    } catch (error) {
      console.error("handleConfirmRescueTeamAction error:", error);
      showToast("Không thể kết nối server.", "error");
    } finally {
      setSubmittingRescueTeamAction(false);
    }
  };

  const openUpdateModal = (item: RescueItem, source: "list" | "detail" = "list") => {
    if (!canEditOwnRescue(item, currentUserId)) {
      showToast("Bạn không thể cập nhật yêu cầu này.", "warning");
      return;
    }

    const images = normalizeImages(item.images);

    setSelectedRescue(item);
    setUpdateModalSource(source);
    setEditSosType((item.sos_type as EditSosType) || "");
    setEditForm({
      name: item.name || "",
      phone: item.phone || "",
      address: item.address || "",
      coords:
        Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))
          ? `${item.lat}, ${item.lng}`
          : "",
      victims: item.victims || 1,
      note: item.note || "",
      source_url: item.source_url || "",
    });

    setExistingImages(images);
    setEditImages([]);
    setEditLocationMode("address");
    setEditSelectedProvinceCode("");
    setEditSelectedWardCode("");
    setEditAddressDetail("");
    setShowConfirmCloseUpdateModal(false);

    setEditMapPosition([
      Number(item.lat) || 16.0544,
      Number(item.lng) || 108.2022,
    ]);

    setShowUpdateModal(true);
  };

  const openCancelConfirm = (item: RescueItem) => {
    if (!canCancelRescueRequest(item, currentUserId, currentUserRole)) {
      showToast(
        isAdminRole(currentUserRole)
          ? "Admin chỉ có thể hủy yêu cầu khi chưa có đội nào nhận."
          : "Chỉ có thể hủy khi yêu cầu là của bạn và chưa có đội nào nhận.",
        "warning"
      );
      return;
    }

    setPendingCancelItem(item);
    setShowCancelConfirmModal(true);
  };

  const handleEditInput = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const onlyDigits = value.replace(/\D/g, "").slice(0, 10);
      setEditForm((prev) => ({ ...prev, phone: onlyDigits }));
      return;
    }

    if (name === "victims") {
      setEditForm((prev) => ({
        ...prev,
        victims: Math.max(1, Number(value) || 1),
      }));
      return;
    }

    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const buildEditFullAddress = () => {
    const provinceName =
      editProvinces.find((p) => String(p.code) === String(editSelectedProvinceCode))?.name || "";
    const wardName =
      editWards.find((w) => String(w.code) === String(editSelectedWardCode))?.name || "";

    return [editAddressDetail.trim(), wardName, provinceName]
      .filter(Boolean)
      .join(", ");
  };

  const handleCloseUpdateModal = () => {
    if (updating) return;

    if (!selectedRescue) {
      setShowUpdateModal(false);
      setUpdateModalSource(null);
      return;
    }

    const originalImages = normalizeImages(selectedRescue.images);
    const originalCoords =
      Number.isFinite(Number(selectedRescue.lat)) &&
        Number.isFinite(Number(selectedRescue.lng))
        ? `${selectedRescue.lat}, ${selectedRescue.lng}`
        : "";

    const changed =
      editForm.name !== (selectedRescue.name || "") ||
      editForm.phone !== (selectedRescue.phone || "") ||
      editForm.address !== (selectedRescue.address || "") ||
      editForm.coords !== originalCoords ||
      editForm.victims !== (selectedRescue.victims || 1) ||
      editForm.note !== (selectedRescue.note || "") ||
      editForm.source_url !== (selectedRescue.source_url || "") ||
      editSosType !== ((selectedRescue.sos_type as EditSosType) || "") ||
      JSON.stringify(existingImages) !== JSON.stringify(originalImages) ||
      editImages.length > 0;

    if (changed) {
      setShowConfirmCloseUpdateModal(true);
      return;
    }

    setShowUpdateModal(false);

    if (updateModalSource === "list") {
      setSelectedRescue(null);
    }

    setUpdateModalSource(null);
  };

  const getEditGPS = async () => {
    try {
      setEditIsGettingGPS(true);

      const position = await getCurrentPositionAsync({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (!isInVietnam(lat, lng)) {
        showToast("Vị trí phải nằm trong khu vực Việt Nam.", "warning");
        return;
      }

      setEditMapPosition([lat, lng]);
      setEditForm((prev) => ({
        ...prev,
        coords: `${lat}, ${lng}`,
      }));

      showToast("Đã lấy GPS thành công.", "success");
    } catch (error) {
      console.error("getEditGPS error:", error);
      showToast("Không lấy được GPS.", "error");
    } finally {
      setEditIsGettingGPS(false);
    }
  };

  const getEditCoordsFromAddress = async () => {
    const fullAddress = buildEditFullAddress();

    if (!fullAddress) {
      showToast("Vui lòng nhập đủ tỉnh/thành, phường/xã và địa chỉ chi tiết.", "warning");
      return;
    }

    try {
      setEditIsFindingAddress(true);

      const query = encodeURIComponent(fullAddress);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}`
      );
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        showToast("Không tìm thấy tọa độ từ địa chỉ.", "warning");
        return;
      }

      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showToast("Không xác định được tọa độ.", "warning");
        return;
      }

      if (!isInVietnam(lat, lng)) {
        showToast("Vị trí phải nằm trong khu vực Việt Nam.", "warning");
        return;
      }

      setEditForm((prev) => ({
        ...prev,
        address: fullAddress,
        coords: `${lat}, ${lng}`,
      }));

      setEditMapPosition([lat, lng]);
      showToast("Đã xác định tọa độ từ địa chỉ.", "success");
    } catch (error) {
      console.error("getEditCoordsFromAddress error:", error);
      showToast("Lỗi khi xác định từ địa chỉ.", "error");
    } finally {
      setEditIsFindingAddress(false);
    }
  };

  const handleGetAddressFromCoords = async () => {
    const coords = parseCoords(editForm.coords);

    if (!coords) {
      showToast("Tọa độ không hợp lệ.", "warning");
      return;
    }

    try {
      setEditIsFindingCoords(true);

      if (!isInVietnam(coords.lat, coords.lng)) {
        showToast("Vị trí phải nằm trong khu vực Việt Nam.", "warning");
        return;
      }

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`
      );
      const data = await res.json();

      setEditMapPosition([coords.lat, coords.lng]);
      setEditForm((prev) => ({
        ...prev,
        address: data?.display_name || prev.address,
      }));

      showToast("Đã xác định địa chỉ từ tọa độ.", "success");
    } catch (error) {
      console.error("handleGetAddressFromCoords error:", error);
      setEditMapPosition([coords.lat, coords.lng]);
      showToast("Không lấy được địa chỉ từ tọa độ.", "warning");
    } finally {
      setEditIsFindingCoords(false);
    }
  };

  const fillEditAddressFromLatLng = async (lat: number, lng: number) => {
    setEditMapPosition([lat, lng]);
    setEditForm((prev) => ({
      ...prev,
      coords: `${lat}, ${lng}`,
    }));

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();

      setEditForm((prev) => ({
        ...prev,
        address: data?.display_name || prev.address,
      }));
    } catch (error) {
      console.error("fillEditAddressFromLatLng error:", error);
    }
  };

  const handleCancelOwnRescue = async (item: RescueItem) => {
    if (!token) {
      showToast("Bạn cần đăng nhập để hủy yêu cầu.", "warning");
      return;
    }

    if (!canCancelRescueRequest(item, currentUserId, currentUserRole)) {
      showToast(
        isAdminRole(currentUserRole)
          ? "Admin chỉ có thể hủy yêu cầu khi chưa có đội nào nhận."
          : "Chỉ có thể hủy khi yêu cầu là của bạn và chưa có đội nào nhận.",
        "warning"
      );
      return;
    }

    try {
      setCancellingId(item.id);

      const isAdmin = isAdminRole(currentUserRole);

      const res = await fetch(
        isAdmin
          ? `${API_BASE}/api/rescues/${item.id}/status`
          : `${API_BASE}/api/rescues/${item.id}/cancel`,
        {
          method: isAdmin ? "PATCH" : "PUT",
          headers: isAdmin
            ? {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            }
            : {
              Authorization: `Bearer ${token}`,
            },
          body: isAdmin
            ? JSON.stringify({
              status: "cancel",
              reason: "Admin hủy yêu cầu từ trang chủ",
            })
            : undefined,
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || "Hủy yêu cầu thất bại.", "error");
        return;
      }

      showToast("Đã hủy yêu cầu thành công.", "success");
      setShowCancelConfirmModal(false);
      setPendingCancelItem(null);
      setSelectedRescue(null);
      await fetchRescues(true);
    } catch (error) {
      console.error("handleCancelOwnRescue error:", error);
      showToast("Có lỗi khi hủy yêu cầu.", "error");
    } finally {
      setCancellingId(null);
    }
  };

  const handleUpdateRescue = async () => {
    if (!selectedRescue) return;

    const phoneRegex = /^(0|\+84)[0-9]{9}$/;

    if (!token) {
      showToast("Bạn cần đăng nhập để cập nhật yêu cầu.", "warning");
      return;
    }

    if (!editForm.name.trim()) {
      showToast("Vui lòng nhập họ và tên.", "warning");
      return;
    }

    if (!editForm.phone.trim()) {
      showToast("Vui lòng nhập số điện thoại.", "warning");
      return;
    }

    if (!phoneRegex.test(editForm.phone.trim())) {
      showToast("Số điện thoại không hợp lệ.", "warning");
      return;
    }

    if (!editForm.address.trim()) {
      showToast("Vui lòng nhập địa chỉ.", "warning");
      return;
    }

    if (editForm.victims < 1) {
      showToast("Số người cần hỗ trợ phải lớn hơn hoặc bằng 1.", "warning");
      return;
    }

    if (!editSosType) {
      showToast("Vui lòng chọn loại yêu cầu.", "warning");
      return;
    }

    const coords = parseCoords(editForm.coords);
    let lat: number | null = selectedRescue.lat ?? null;
    let lng: number | null = selectedRescue.lng ?? null;

    if (editForm.coords.trim()) {
      if (!coords) {
        showToast("Tọa độ không hợp lệ. Dùng dạng: 16.0544, 108.2022", "warning");
        return;
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    try {
      setUpdating(true);

      const formData = new FormData();
      formData.append("name", editForm.name.trim());
      formData.append("phone", editForm.phone.trim());
      formData.append("address", editForm.address.trim());
      formData.append("lat", lat !== null ? String(lat) : "");
      formData.append("lng", lng !== null ? String(lng) : "");
      formData.append("victims", String(editForm.victims));
      formData.append("note", editForm.note.trim());
      formData.append("source_url", editForm.source_url.trim());
      formData.append("sos_type", editSosType);
      formData.append("existingImages", JSON.stringify(existingImages));

      editImages.forEach((img) => {
        formData.append("images", img);
      });

      const res = await fetch(`${API_BASE}/api/rescues/${selectedRescue.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || "Cập nhật yêu cầu thất bại.", "error");
        return;
      }

      await fetchRescues(true);

      const updatedItem =
        data?.rescue ||
        data?.data ||
        {
          ...selectedRescue,
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          address: editForm.address.trim(),
          lat,
          lng,
          victims: editForm.victims,
          note: editForm.note.trim(),
          source_url: editForm.source_url.trim(),
          sos_type: editSosType,
          images: existingImages,
        };

      setSelectedRescue(updatedItem);
      setShowUpdateModal(false);

      if (updateModalSource === "list") {
        setSelectedRescue(null);
      }

      setUpdateModalSource(null);
      showToast("Cập nhật yêu cầu thành công.", "success");
    } catch (error) {
      console.error("handleUpdateRescue error:", error);
      showToast("Lỗi server khi cập nhật yêu cầu.", "error");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchRescues(false);

    const interval = setInterval(() => {
      fetchRescues(true);
    }, RESCUE_POLLING_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadEditProvinces = async () => {
      try {
        setEditLoadingProvinces(true);

        const res = await fetch("https://provinces.open-api.vn/api/v2/p/");
        const data = await res.json();

        setEditProvinces(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("loadEditProvinces error:", error);
        setEditProvinces([]);
      } finally {
        setEditLoadingProvinces(false);
      }
    };

    loadEditProvinces();
  }, []);

  useEffect(() => {
    const loadEditWards = async () => {
      if (!editSelectedProvinceCode) {
        setEditWards([]);
        return;
      }

      try {
        setEditLoadingWards(true);

        const res = await fetch(
          `https://provinces.open-api.vn/api/v2/p/${editSelectedProvinceCode}?depth=2`
        );
        const data = await res.json();

        setEditWards(Array.isArray(data?.wards) ? data.wards : []);
      } catch (error) {
        console.error("loadEditWards error:", error);
        setEditWards([]);
      } finally {
        setEditLoadingWards(false);
      }
    };

    loadEditWards();
  }, [editSelectedProvinceCode]);

  useEffect(() => {
    const initLocationAndWeather = async () => {
      try {
        setGeoPhase("requesting");

        const position = await getCurrentPositionAsync({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setGeoPhase("granted");
        setShowManualSelector(false);

        setLocationState({
          source: "browser",
          label: "GPS của bạn",
          lat,
          lng,
        });

        await persistUserLocationIfLoggedIn(lat, lng);
        await fetchWeatherByCoords(lat, lng);
      } catch (geoError: any) {
        console.error("Geolocation error:", geoError);

        const denied =
          geoError?.code === 1 ||
          String(geoError?.message || "").toLowerCase().includes("denied");

        setGeoPhase(denied ? "denied" : "failed");
        setShowManualSelector(true);

        const defaultProvince = PROVINCES.find((p) => p.code === "da_nang")!;
        setLocationState({
          source: "fallback",
          label: defaultProvince.name,
          lat: defaultProvince.lat,
          lng: defaultProvince.lng,
        });

        await fetchWeatherByCoords(defaultProvince.lat, defaultProvince.lng);

        showToast(
          denied
            ? "Bạn chưa cấp quyền vị trí. Hãy chọn tỉnh/thành để xem thời tiết."
            : "Không lấy được GPS. Hãy chọn tỉnh/thành để xem thời tiết.",
          "warning",
          4200
        );
      }
    };

    initLocationAndWeather();
  }, []);

  useEffect(() => {
    if (
      !showAllModal &&
      !selectedRescue &&
      !showUpdateModal &&
      !showCancelConfirmModal &&
      !pendingRescueTeamAction
    ) {
      return;
    }

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, [showAllModal, selectedRescue, showUpdateModal, showCancelConfirmModal, pendingRescueTeamAction]);

  useEffect(() => {
    if (!selectedRescue) return;
    const latest = rescues.find((r) => r.id === selectedRescue.id);
    if (latest) setSelectedRescue(latest);
  }, [rescues, selectedRescue?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        showDateRangePicker &&
        dateRangePickerRef.current &&
        !dateRangePickerRef.current.contains(target)
      ) {
        setShowDateRangePicker(false);
        setDatePickerStep("start");
      }

      if (
        showSosTypeDropdown &&
        sosTypeDropdownRef.current &&
        !sosTypeDropdownRef.current.contains(target)
      ) {
        setShowSosTypeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDateRangePicker, showSosTypeDropdown]);

  const handleCloseToast = () => {
    setToast((prev) => ({ ...prev, show: false }));
  };

  const adviceTone = getAdviceTone(aiAdvice.level);
  const now = new Date().toLocaleString("vi-VN");

  const footerQuickLinks = useMemo(() => {
    if (isAdminRole(currentUserRole)) {
      return [
        {
          href: "/home",
          label: "Trang chủ",
          icon: <HomeIcon className="h-4 w-4" />,
        },
        {
          href: "/map_admin",
          label: "Bản đồ",
          icon: <MapPin className="h-4 w-4" />,
        },
        {
          href: "/rescueteamadmin",
          label: "Quản lý Đội cứu hộ",
          icon: <Users2 className="h-4 w-4" />,
        },
        {
          href: "/requestsosadmin",
          label: "Quản lý Dân cư",
          icon: <ClipboardList className="h-4 w-4" />,
        },
        {
          href: "/analytics",
          label: "Phân tích dữ liệu",
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          href: "/about",
          label: "Hướng dẫn an toàn",
          icon: <Info className="h-4 w-4" />,
        },
      ];
    }

    if (isRescueTeamRole(currentUserRole)) {
      return [
        {
          href: "/home",
          label: "Trang chủ",
          icon: <HomeIcon className="h-4 w-4" />,
        },
        {
          href: "/map_rescue",
          label: "Bản đồ",
          icon: <MapPin className="h-4 w-4" />,
        },
        {
          href: "/rescueteamrescue",
          label: "Đang cứu hộ",
          icon: <Siren className="h-4 w-4" />,
        },
        {
          href: "/analyticsrescue",
          label: "Phân tích dữ liệu",
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          href: "/about",
          label: "Hướng dẫn an toàn",
          icon: <Info className="h-4 w-4" />,
        },
      ];
    }

    return [
      {
        href: "/home",
        label: "Trang chủ",
        icon: <HomeIcon className="h-4 w-4" />,
      },
      {
        href: "/map",
        label: "Bản đồ",
        icon: <MapPin className="h-4 w-4" />,
      },
      {
        href: "/rescueteam_user",
        label: "Yêu cầu của tôi",
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        href: "/about",
        label: "Hướng dẫn an toàn",
        icon: <Info className="h-4 w-4" />,
      },
    ];
  }, [currentUserRole]);

  return (
    <div className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen font-sans transition-colors duration-300">
      <NotificationToast toast={toast} onClose={handleCloseToast} />

      <Navbar />

      <main className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10 space-y-8">
        <div className="relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-lg">
          <div className="relative px-6 md:px-8 py-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_30%)]" />
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-blue-100">
                  <Siren size={14} />
                  Cảnh báo & hỗ trợ người dân
                </div>

                <h1 className="mt-4 text-2xl md:text-3xl font-black tracking-tight">
                  Trung tâm hỗ trợ khẩn cấp
                </h1>

                <p className="mt-2 text-sm md:text-base text-slate-200 max-w-3xl">
                  Theo dõi tình hình SOS toàn hệ thống, dự báo thời tiết khu vực và
                  nhận gợi ý an toàn để chủ động ứng phó.
                </p>

                <p className="mt-2 text-xs md:text-sm text-slate-300 flex items-center gap-2">
                  <MapPin size={14} />
                  {formatLocationLabel(locationState, geoPhase)}
                </p>

                {showManualSelector && geoPhase !== "requesting" && (
                  <div className="mt-3 max-w-md">
                    <label className="block text-xs text-slate-300 mb-2">
                      Chọn tỉnh/thành khi bạn không cấp quyền vị trí
                    </label>
                    <div className="relative">
                      <select
                        value={selectedProvinceCode}
                        onChange={(e) => applyManualProvince(e.target.value)}
                        className="w-full appearance-none rounded-2xl bg-white/10 border border-white/15 px-4 py-3 pr-10 text-sm text-white outline-none focus:border-blue-400"
                      >
                        {PROVINCES.map((province) => (
                          <option
                            key={province.code}
                            value={province.code}
                            className="text-slate-900"
                          >
                            {province.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <div className="inline-flex items-center gap-2 rounded-full bg-red-500/15 text-red-200 border border-red-400/20 px-3 py-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    {weather.riskLabel}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-slate-200">
                    <CloudRain size={14} />
                    Mưa: {Math.round(currentWeatherForRisk.rainProbability)}%
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-slate-200">
                    <Wind size={14} />
                    Gió: {Math.round(currentWeatherForRisk.windSpeed)} km/h
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:min-w-[260px]">
                <button
                  onClick={refreshWeatherNow}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm transition"
                >
                  <RefreshCw size={16} />
                  Cập nhật
                </button>

                <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-slate-200">
                  <p className="font-semibold text-white">Cập nhật thời tiết lần cuối</p>
                  <p className="mt-1">{weather.updatedAt || now}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-8">
          <StatCard
            icon={<AlertCircle className="text-red-600" />}
            title="SOS mới 1 giờ qua"
            value={String(stats.sosLastHour)}
            trend={
              stats.sosLastHour > 0
                ? `${stats.sosLastHour} yêu cầu mới`
                : "Không có yêu cầu mới"
            }
          />

          <StatCard
            icon={<RefreshCw className="text-amber-600" />}
            title="Chờ tiếp nhận"
            value={String(stats.waiting)}
            trend={stats.waiting > 0 ? "Cần theo dõi" : "Đã ổn định"}
          />

          <StatCard
            icon={<Activity className="text-blue-600" />}
            title="Đang cứu hộ"
            value={String(stats.rescuing)}
            trend={
              stats.rescuing > 0 ? "Đã tiếp nhận hoặc đang di chuyển" : "Không có ca xử lý"
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 self-start space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-4 bg-white dark:bg-slate-900">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div>
                    <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
                      Yêu cầu SOS gần đây
                    </h2>
                  </div>

                  <button
                    onClick={handleOpenAllRescues}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-sm font-semibold transition"
                  >
                    Xem tất cả
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-5 bg-slate-50/70 dark:bg-[#14171e]">
                {rescuesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                      />
                    ))}
                  </div>
                ) : recentRescues.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                      <ClipboardList size={24} />
                    </div>
                    <h3 className="mt-4 text-lg font-black text-slate-800 dark:text-white">
                      Không có yêu cầu phù hợp
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Hiện chưa có yêu cầu SOS đang hoạt động.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentRescues.map((item) => (
                      <RecentSOSRow
                        key={item.id}
                        item={item}
                        currentUserId={currentUserId}
                        currentUserRole={currentUserRole}
                        cancelling={cancellingId === item.id}
                        rescueTeamActionLoadingId={rescueTeamActionLoadingId}
                        onViewDetail={() => setSelectedRescue(item)}
                        onEditRequest={(item) => openUpdateModal(item, "list")}
                        onCancelRequest={openCancelConfirm}
                        onReceiveRequest={(item) => openRescueTeamActionConfirm(item, "receive")}
                        onCancelReceiveRequest={(item) => openRescueTeamActionConfirm(item, "cancel_receive")}
                        onCompleteRequest={(item) => openRescueTeamActionConfirm(item, "complete")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="text-violet-600" size={20} />
                  <h2 className="font-bold text-lg">AI gợi ý an toàn</h2>

                  <span className="rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200 px-2.5 py-1 text-xs font-bold">
                    {aiAdviceLoading
                      ? "Groq AI đang phân tích..."
                      : aiAdvice.source === "groq"
                        ? "Groq AI"
                        : "Dự phòng"}
                  </span>
                </div>

                <div className="inline-flex items-center gap-2 text-sm">
                  <span className={cn("w-2.5 h-2.5 rounded-full", adviceTone.dot)} />
                  <span className="text-slate-500 dark:text-slate-400">
                    Phân tích từ thời tiết và mức rủi ro hiện tại
                  </span>
                </div>
              </div>

              <div className={cn("rounded-2xl border p-5", adviceTone.wrap)}>
                <h3 className={cn("font-bold text-lg", adviceTone.title)}>
                  {aiAdvice.title}
                </h3>

                <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                  {aiAdvice.message}
                </p>

                {aiAdvice.note && aiAdvice.source !== "groq" && (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
                    {aiAdvice.note}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {aiAdvice.tips.map((tip, index) => (
                    <div
                      key={index}
                      className="rounded-xl bg-white/70 dark:bg-slate-900/40 border border-white/60 dark:border-slate-800 p-4 text-sm text-slate-700 dark:text-slate-300"
                    >
                      • {tip}
                    </div>
                  ))}
                </div>

                {aiAdvice.actionNow && (
                  <div className="mt-4 rounded-xl bg-white/70 dark:bg-slate-900/40 border border-white/60 dark:border-slate-800 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                      Việc nên làm ngay
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {aiAdvice.actionNow}
                    </p>
                  </div>
                )}

                {aiAdvice.reasons && aiAdvice.reasons.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2">
                      Lý do AI đánh giá
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {aiAdvice.reasons.map((reason, index) => (
                        <div
                          key={index}
                          className="rounded-xl bg-white/70 dark:bg-slate-900/40 border border-white/60 dark:border-slate-800 p-3 text-sm text-slate-700 dark:text-slate-300"
                        >
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 self-start">
            <WeatherNowPanel
              weather={weather}
              weatherLoading={weatherLoading}
              geoPhase={geoPhase}
              now={now}
              locationState={locationState}
            />

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 mb-6">
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  Đánh giá nhanh
                </p>
                <p className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
                  {weather.riskLabel}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Cập nhật: {weather.updatedAt || now}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-base mb-4">Ước tính rủi ro theo thời tiết</h3>
                <div className="space-y-5">
                  {riskStats.map((item) => (
                    <RiskProgress
                      key={item.label}
                      label={item.label}
                      percent={item.percent}
                      color={item.color}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-start space-x-3 border border-slate-100 dark:border-slate-800">
                <Info className="text-amber-500 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Chỉ số này là ước tính nhanh từ mưa, xác suất mưa và gió; không thay thế cảnh báo chính thức.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
                {footerQuickLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="flex items-center gap-2 transition hover:text-blue-600"
                    >
                      {link.icon}
                      {link.label}
                    </a>
                  </li>
                ))}
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

      {showAllModal && (
        <AllRescuesModal
          items={paginatedModalRescues}
          totalItems={modalRescues.length}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          fromRecord={fromRecord}
          toRecord={toRecord}
          onPageChange={setCurrentPage}
          allCount={modalStatusCounts.all}
          newCount={modalStatusCounts.new}
          rescuingCount={modalStatusCounts.rescuing}
          doneCount={modalStatusCounts.done}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sosTypeFilter={sosTypeFilter}
          onSosTypeFilterChange={setSosTypeFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          showDateRangePicker={showDateRangePicker}
          onShowDateRangePickerChange={setShowDateRangePicker}
          datePickerStep={datePickerStep}
          onDatePickerStepChange={setDatePickerStep}
          onOpenDateRangePicker={openDateRangePicker}
          onClearDateRange={clearDateRange}
          onSelectRangeDate={handleSelectRangeDate}
          showSosTypeDropdown={showSosTypeDropdown}
          onShowSosTypeDropdownChange={setShowSosTypeDropdown}
          dateRangePickerRef={dateRangePickerRef}
          sosTypeDropdownRef={sosTypeDropdownRef}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          cancellingId={cancellingId}
          rescueTeamActionLoadingId={rescueTeamActionLoadingId}
          onClose={() => setShowAllModal(false)}
          onViewDetail={(item) => {
            setSelectedRescue(item);
          }}
          onEditRequest={(item) => openUpdateModal(item, "list")}
          onCancelRequest={openCancelConfirm}
          onReceiveRequest={(item) => openRescueTeamActionConfirm(item, "receive")}
          onCancelReceiveRequest={(item) => openRescueTeamActionConfirm(item, "cancel_receive")}
          onCompleteRequest={(item) => openRescueTeamActionConfirm(item, "complete")}
        />
      )}

      {selectedRescue && !showUpdateModal && (
        <RescueDetailModal
          item={selectedRescue}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          cancelling={cancellingId === selectedRescue.id}
          rescueTeamActionLoadingId={rescueTeamActionLoadingId}
          onClose={() => setSelectedRescue(null)}
          onPreviewImage={(src) => setPreviewImg(src)}
          onOpenDirections={openDirections}
          onEditRequest={(item) => openUpdateModal(item, "detail")}
          onCancelRequest={openCancelConfirm}
          onReceiveRequest={(item) => openRescueTeamActionConfirm(item, "receive")}
          onCancelReceiveRequest={(item) => openRescueTeamActionConfirm(item, "cancel_receive")}
          onCompleteRequest={(item) => openRescueTeamActionConfirm(item, "complete")}
        />
      )}

      {showUpdateModal && selectedRescue && (
        <div
          className="fixed inset-0 z-[11500] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] p-2 md:p-3"
          onClick={handleCloseUpdateModal}
        >
          <div
            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-[560px] max-w-[95vw] rounded-xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-blue-600 text-white text-center py-6 relative">
              <h3 className="font-bold text-xl">CẬP NHẬT THÔNG TIN YÊU CẦU</h3>
              <p className="text-xs opacity-90 mt-1">
                Vui lòng cập nhật đầy đủ thông tin để đội cứu hộ hỗ trợ chính xác hơn
              </p>
              <button
                onClick={handleCloseUpdateModal}
                disabled={updating}
                className="absolute top-4 right-4 hover:bg-slate-100 hover:text-slate-700 rounded-full p-1 transition"
              >
                <X />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-900 dark:text-slate-100">
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-2 text-sm">
                  1. Phân loại yêu cầu: <span className="text-red-500">*</span>
                </h3>

                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEditSosType("rescue")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "rescue"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white dark:bg-slate-800 text-black dark:text-white border-gray-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      }`}
                  >
                    Cần cứu hộ
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("supplies")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "supplies"
                      ? "bg-yellow-500 text-white border-yellow-500"
                      : "bg-white dark:bg-slate-800 text-black dark:text-white border-gray-300 dark:border-slate-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                      }`}
                  >
                    Cần nhu yếu phẩm
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("vehicle")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "vehicle"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-slate-800 text-black dark:text-white border-gray-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      }`}
                  >
                    Cần cứu hộ xe
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("other")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "other"
                      ? "bg-gray-600 text-white border-gray-600"
                      : "bg-white dark:bg-slate-800 text-black dark:text-white border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700"
                      }`}
                  >
                    Yêu cầu khác
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
                  2. Thông tin cá nhân: <span className="text-red-500">*</span>
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Họ và tên
                    </label>
                    <input
                      name="name"
                      value={editForm.name}
                      onChange={handleEditInput}
                      placeholder="Nhập họ và tên"
                      className="mt-1 border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Số điện thoại
                    </label>
                    <input
                      name="phone"
                      value={editForm.phone}
                      onChange={handleEditInput}
                      placeholder="Ví dụ: 0912345678"
                      className="mt-1 border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-slate-700 dark:text-slate-200">
                  3. Vị trí hiện tại: <span className="text-red-500">*</span>
                </h3>

                <div
                  className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 text-xs mb-3"
                  style={{ width: "129px" }}
                >
                  <button
                    type="button"
                    onClick={() => setEditLocationMode("address")}
                    className={`px-3 py-1 rounded-md ${editLocationMode === "address"
                      ? "bg-white dark:bg-slate-700 shadow"
                      : ""
                      }`}
                  >
                    Địa chỉ
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditLocationMode("coords")}
                    className={`px-3 py-1 rounded-md ${editLocationMode === "coords"
                      ? "bg-white dark:bg-slate-700 shadow"
                      : ""
                      }`}
                  >
                    Tọa độ
                  </button>
                </div>

                {editLocationMode === "address" && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Tỉnh / Thành phố
                        </label>
                        <select
                          value={editSelectedProvinceCode}
                          onChange={(e) => {
                            setEditSelectedProvinceCode(e.target.value);
                            setEditSelectedWardCode("");
                            setEditForm((prev) => ({ ...prev, address: "" }));
                          }}
                          className="mt-1 border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full bg-white dark:bg-slate-800"
                        >
                          <option value="">
                            {editLoadingProvinces
                              ? "Đang tải tỉnh/thành..."
                              : "Chọn tỉnh / thành phố"}
                          </option>
                          {editProvinces.map((province) => (
                            <option key={province.code} value={province.code}>
                              {province.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Phường / Xã
                        </label>
                        <select
                          value={editSelectedWardCode}
                          onChange={(e) => {
                            setEditSelectedWardCode(e.target.value);
                            setEditForm((prev) => ({ ...prev, address: "" }));
                          }}
                          disabled={!editSelectedProvinceCode || editLoadingWards}
                          className="mt-1 border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full bg-white dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                        >
                          <option value="">
                            {!editSelectedProvinceCode
                              ? "Chọn tỉnh/thành trước"
                              : editLoadingWards
                                ? "Đang tải phường/xã..."
                                : "Chọn phường / xã"}
                          </option>
                          {editWards.map((ward) => (
                            <option key={ward.code} value={ward.code}>
                              {ward.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Địa chỉ chi tiết
                        </label>
                        <input
                          value={editAddressDetail}
                          onChange={(e) => {
                            setEditAddressDetail(e.target.value);
                            setEditForm((prev) => ({ ...prev, address: "" }));
                          }}
                          disabled={!editSelectedWardCode}
                          placeholder="Ví dụ: 8/8 Phan Văn Trị"
                          className="mt-1 border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full bg-white dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                        />
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 border rounded-lg p-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                          Địa chỉ hoàn chỉnh:
                        </div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {buildEditFullAddress() || editForm.address || "Chưa có địa chỉ"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={getEditCoordsFromAddress}
                      disabled={editIsFindingAddress || editIsGettingGPS}
                      className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {editIsFindingAddress
                        ? "Đang xác định địa chỉ..."
                        : "Xác định từ địa chỉ"}
                    </button>

                    <button
                      type="button"
                      onClick={getEditGPS}
                      disabled={editIsGettingGPS || editIsFindingAddress}
                      className="mt-2 w-full border border-dashed bg-slate-100 dark:bg-slate-800 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {editIsGettingGPS ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                          <span>Đang lấy GPS...</span>
                        </>
                      ) : (
                        <>
                          <MapPin size={16} />
                          <span>Lấy GPS tự động</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {editLocationMode === "coords" && (
                  <>
                    <input
                      name="coords"
                      value={editForm.coords}
                      onChange={handleEditInput}
                      placeholder="VD: 21.0285, 105.8542"
                      className="border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full bg-white dark:bg-slate-800"
                    />

                    <button
                      type="button"
                      onClick={handleGetAddressFromCoords}
                      disabled={editIsFindingCoords}
                      className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {editIsFindingCoords
                        ? "Đang xác định từ tọa độ..."
                        : "Xác định từ tọa độ"}
                    </button>
                  </>
                )}

                <div className="mt-4">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-2">
                    Chọn nhanh trên bản đồ
                  </label>

                  <div className="rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700">
                    <div className="h-[260px] w-full">
                      <MapContainer
                        center={editMapPosition}
                        zoom={15}
                        scrollWheelZoom={true}
                        zoomControl={false}
                        attributionControl={false}
                        className="h-full w-full"
                        minZoom={4}
                        maxZoom={18}
                        maxBounds={[
                          [7.0, 101.0],
                          [24.5, 110.5],
                        ]}
                        maxBoundsViscosity={1.0}
                      >
                        {editMapType === "default" ? (
                          <GoongStyleLayer enabled />
                        ) : (
                          <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            attribution="&copy; Esri"
                          />
                        )}

                        <MiniMapFixSize />
                        <FlyToMiniMapLocation position={editMapPosition} />

                        <MiniMapSelectLocation
                          onSelect={async (lat, lng) => {
                            if (!isInVietnam(lat, lng)) {
                              showToast("Vị trí phải nằm trong khu vực Việt Nam.", "warning");
                              return;
                            }

                            setEditMapPosition([lat, lng]);

                            try {
                              await fillEditAddressFromLatLng(lat, lng);
                              showToast("Đã chọn vị trí trên bản đồ.", "success");
                            } catch (err) {
                              console.error("Lỗi chọn vị trí trên map:", err);
                              setEditForm((prev) => ({
                                ...prev,
                                coords: `${lat},${lng}`,
                              }));
                              setEditMapPosition([lat, lng]);
                              showToast(
                                "Đã chọn vị trí nhưng chưa lấy được địa chỉ.",
                                "warning"
                              );
                            }
                          }}
                        />

                        <Marker position={editMapPosition} icon={miniMapMarkerIcon} />
                      </MapContainer>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                      Chỉ hiển thị khu vực Việt Nam. Nhấn trực tiếp lên bản đồ để chọn vị trí mới.
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Tọa độ đang chọn: {editMapPosition[0]}, {editMapPosition[1]}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-slate-700 dark:text-slate-200">
                  4. Chi tiết tình hình:
                </h3>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Số lượng người cần cứu
                  </label>
                  <input
                    name="victims"
                    value={editForm.victims}
                    onChange={handleEditInput}
                    type="number"
                    min="1"
                    className="mt-1 border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                  Hình ảnh (tối đa 2 ảnh)
                </label>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (!e.target.files) return;
                    const filesArray = Array.from(e.target.files).slice(0, 2);
                    setEditImages(filesArray);
                  }}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />

                <div className="flex gap-2 mt-2 flex-wrap">
                  {existingImages.map((img, idx) => (
                    <div
                      key={`old-${idx}`}
                      className="relative w-20 h-20 border rounded-lg overflow-hidden"
                    >
                      <img
                        src={`${API_BASE}${img}`}
                        alt="existing"
                        className="w-full h-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setExistingImages(existingImages.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1 right-1 bg-white rounded-full text-red-500 p-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {editImages.map((file, idx) => (
                    <div
                      key={`new-${idx}`}
                      className="relative w-20 h-20 border rounded-lg overflow-hidden"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setEditImages(editImages.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1 right-1 bg-white rounded-full text-red-500 p-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-slate-700 dark:text-slate-200">
                  5. Tình trạng hiện tại:
                </h3>
                <textarea
                  name="note"
                  value={editForm.note}
                  onChange={handleEditInput}
                  placeholder="Cung cấp thêm chi tiết..."
                  className="border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full h-24 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-slate-700 dark:text-slate-200">
                  6. Link nguồn: <span className="text-slate-400">(Tùy chọn)</span>
                </h3>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Link bài đăng / nguồn thông tin
                  </label>

                  <input
                    name="source_url"
                    value={editForm.source_url}
                    onChange={handleEditInput}
                    type="url"
                    placeholder="Ví dụ: https://facebook.com/..."
                    className="mt-1 border border-slate-300 dark:border-slate-700 rounded-lg p-2 w-full bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCloseUpdateModal}
                  disabled={updating}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-lg font-bold transition"
                >
                  Hủy
                </button>

                <button
                  onClick={handleUpdateRescue}
                  disabled={updating}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow transition disabled:opacity-70"
                >
                  {updating ? "Đang lưu..." : "Lưu cập nhật"}
                </button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 flex gap-2">
                <AlertTriangle size={16} />
                Cảnh báo: Hãy cập nhật thông tin chính xác để đội cứu hộ hỗ trợ nhanh nhất.
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmCloseUpdateModal && (
        <div className="fixed inset-0 z-[11600] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px]">
          <div
            className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] px-6 py-5 text-white">
              <h3 className="text-lg font-bold">Xác nhận đóng form</h3>
              <p className="mt-1 text-sm text-slate-200">
                Bạn đã thay đổi thông tin. Nếu đóng bây giờ, dữ liệu chưa lưu sẽ bị mất.
              </p>
            </div>

            <div className="px-6 py-5">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle size={18} className="mt-0.5 text-amber-600" />
                <p className="text-sm leading-6 text-slate-700">
                  Bạn có chắc muốn đóng form cập nhật không?
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmCloseUpdateModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Quay lại
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmCloseUpdateModal(false);
                    setShowUpdateModal(false);

                    if (updateModalSource === "list") {
                      setSelectedRescue(null);
                    }

                    setUpdateModalSource(null);
                    showToast("Đã đóng form cập nhật.", "info");
                  }}
                  className="rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Đóng form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingRescueTeamAction && (
        <RescueTeamActionConfirmModal
          actionState={pendingRescueTeamAction}
          submitting={submittingRescueTeamAction}
          onBack={() => {
            if (!submittingRescueTeamAction) {
              setPendingRescueTeamAction(null);
            }
          }}
          onConfirm={handleConfirmRescueTeamAction}
        />
      )}

      {showCancelConfirmModal && pendingCancelItem && (
        <CancelConfirmModal
          item={pendingCancelItem}
          cancelling={cancellingId === pendingCancelItem.id}
          onBack={() => {
            if (cancellingId !== pendingCancelItem.id) {
              setShowCancelConfirmModal(false);
              setPendingCancelItem(null);
            }
          }}
          onConfirm={() => handleCancelOwnRescue(pendingCancelItem)}
        />
      )}

      {previewImg && (
        <div
          className="fixed inset-0 z-[12000] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <img
            src={previewImg}
            alt="Preview"
            className="max-w-[90%] max-h-[90%] rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

/* =========================
   SUB COMPONENTS
========================= */
const StatCard: React.FC<StatCardProps> = ({
  icon,
  title,
  value,
  trend,
  isRisk,
  valueClassName,
}) => (
  <div
    className={cn(
      "bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all",
      isRisk && "border-l-4 border-l-red-500"
    )}
  >
    <div className="flex items-center justify-between mb-4 gap-3">
      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">{icon}</div>
      {trend && (
        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 rounded-xl text-right">
          {trend}
        </span>
      )}
    </div>

    <h3
      className={cn(
        "text-sm",
        isRisk
          ? "text-red-500 font-bold"
          : "font-medium text-slate-500 dark:text-slate-400"
      )}
    >
      {title}
    </h3>

    <p
      className={cn(
        "font-bold mt-2 text-4xl leading-none",
        isRisk && "text-red-600 dark:text-red-400",
        valueClassName
      )}
    >
      {value}
    </p>
  </div>
);

const RecentSOSRow: React.FC<{
  item: RescueItem;
  currentUserId: number;
  currentUserRole: string;
  cancelling?: boolean;
  rescueTeamActionLoadingId?: number | null;
  onViewDetail: () => void;
  onEditRequest: (item: RescueItem) => void;
  onCancelRequest: (item: RescueItem) => void;
  onReceiveRequest: (item: RescueItem) => void;
  onCancelReceiveRequest: (item: RescueItem) => void;
  onCompleteRequest: (item: RescueItem) => void;
}> = ({
  item,
  currentUserId,
  currentUserRole,
  cancelling = false,
  rescueTeamActionLoadingId = null,
  onViewDetail,
  onEditRequest,
  onCancelRequest,
  onReceiveRequest,
  onCancelReceiveRequest,
  onCompleteRequest,
}) => {
    const statusMeta = getStatusMeta(item);
    const isRescuer = isRescueTeamRole(currentUserRole);
    const isAdmin = isAdminRole(currentUserRole);
    const canEdit = !isRescuer && !isAdmin && canEditOwnRescue(item, currentUserId);
    const canCancel = canCancelRescueRequest(item, currentUserId, currentUserRole);
    const canReceive = canReceiveRescueRequest(item, currentUserRole);
    const canManageReceived = canManageReceivedRescue(item, currentUserId, currentUserRole);
    const rescueActionLoading = rescueTeamActionLoadingId === item.id;

    return (
      <div className="group relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className={`absolute left-0 top-0 h-full w-1 ${statusMeta.dot}`} />

        <div className="p-4 md:p-4.5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-900 px-2.5 py-1 text-[10px] font-black tracking-[0.18em]">
                  #SOS-{item.id}
                </span>

                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                    statusMeta.pill
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", statusMeta.dot)} />
                  {statusMeta.label}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                  {getSosTypeLabel(item.sos_type)}
                </span>
              </div>

              <div className="mt-3 rounded-[18px] px-3 py-3 bg-gray-100 dark:bg-gray-950/50">
                <h3 className="text-sm md:text-[15px] font-black text-slate-900 dark:text-white line-clamp-2">
                  {item.address || "Không có địa chỉ"}
                </h3>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <User size={13} />
                    {item.name || "Chưa có tên"}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <PhoneCall size={13} />
                    {item.phone || "Chưa có số điện thoại"}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Users size={13} />
                    {item.victims || 1} người
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={13} />
                    {formatDateTime(item.created_at)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.assigned_team && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Đội phụ trách: {item.assigned_team}
                  </span>
                )}
              </div>
            </div>

            <div className="xl:w-auto shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-1.5 xl:min-w-[132px]">
                <button
                  onClick={onViewDetail}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  Chi tiết
                  <ChevronRight size={12} />
                </button>

                {canReceive && (
                  <button
                    onClick={() => onReceiveRequest(item)}
                    disabled={rescueActionLoading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-red-700 disabled:opacity-70"
                  >
                    {rescueActionLoading && <Loader2 size={12} className="animate-spin" />}
                    Nhận yêu cầu
                  </button>
                )}

                {canManageReceived && (
                  <>
                    <button
                      onClick={() => onCancelReceiveRequest(item)}
                      disabled={rescueActionLoading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-70"
                    >
                      {rescueActionLoading && <Loader2 size={12} className="animate-spin" />}
                      Hủy nhận
                    </button>

                    <button
                      onClick={() => onCompleteRequest(item)}
                      disabled={rescueActionLoading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-emerald-700 disabled:opacity-70"
                    >
                      <CheckCircle2 size={12} />
                      Hoàn thành
                    </button>
                  </>
                )}

                {canEdit && (
                  <button
                    onClick={() => onEditRequest(item)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Edit3 size={12} />
                    Cập nhật
                  </button>
                )}

                {canCancel && (
                  <button
                    onClick={() => onCancelRequest(item)}
                    disabled={cancelling}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-red-700 disabled:opacity-70"
                  >
                    <XCircle size={12} />
                    {cancelling ? "Đang hủy..." : "Hủy yêu cầu"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

const AllRescuesModal: React.FC<{
  items: RescueItem[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  fromRecord: number;
  toRecord: number;
  onPageChange: React.Dispatch<React.SetStateAction<number>>;
  allCount: number;
  newCount: number;
  rescuingCount: number;
  doneCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: RescueStatusFilter;
  onStatusFilterChange: (value: RescueStatusFilter) => void;
  sosTypeFilter: RescueTypeFilter;
  onSosTypeFilterChange: (value: RescueTypeFilter) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (value: { start: string; end: string }) => void;
  showDateRangePicker: boolean;
  onShowDateRangePickerChange: (value: boolean) => void;
  datePickerStep: "start" | "end";
  onDatePickerStepChange: (value: "start" | "end") => void;
  onOpenDateRangePicker: () => void;
  onClearDateRange: () => void;
  onSelectRangeDate: (value: string) => void;
  showSosTypeDropdown: boolean;
  onShowSosTypeDropdownChange: (value: boolean) => void;
  dateRangePickerRef: React.RefObject<HTMLDivElement | null>;
  sosTypeDropdownRef: React.RefObject<HTMLDivElement | null>;
  sortOrder: "newest" | "oldest";
  onSortOrderChange: (value: "newest" | "oldest") => void;
  currentUserId: number;
  currentUserRole: string;
  cancellingId: number | null;
  rescueTeamActionLoadingId?: number | null;
  onClose: () => void;
  onViewDetail: (item: RescueItem) => void;
  onEditRequest: (item: RescueItem) => void;
  onCancelRequest: (item: RescueItem) => void;
  onReceiveRequest: (item: RescueItem) => void;
  onCancelReceiveRequest: (item: RescueItem) => void;
  onCompleteRequest: (item: RescueItem) => void;
}> = ({
  items,
  totalItems,
  currentPage,
  totalPages,
  fromRecord,
  toRecord,
  onPageChange,
  allCount,
  newCount,
  rescuingCount,
  doneCount,
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  sosTypeFilter,
  onSosTypeFilterChange,
  dateRange,
  onDateRangeChange,
  showDateRangePicker,
  onShowDateRangePickerChange,
  datePickerStep,
  onDatePickerStepChange,
  onOpenDateRangePicker,
  onClearDateRange,
  onSelectRangeDate,
  showSosTypeDropdown,
  onShowSosTypeDropdownChange,
  dateRangePickerRef,
  sosTypeDropdownRef,
  sortOrder,
  onSortOrderChange,
  currentUserId,
  currentUserRole,
  cancellingId,
  rescueTeamActionLoadingId = null,
  onClose,
  onViewDetail,
  onEditRequest,
  onCancelRequest,
  onReceiveRequest,
  onCancelReceiveRequest,
  onCompleteRequest,
}) => {
    const safeCurrentPage = Math.min(currentPage, totalPages);

    return createPortal(
      <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] p-2 md:p-3">
        <div className="absolute inset-0" onClick={onClose} />

        <div
          className="relative w-full max-w-6xl max-h-[90vh] min-h-0 overflow-hidden rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-[0_24px_70px_rgba(15,23,42,0.32)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-30 shrink-0 relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white px-4 md:px-5 py-4 md:py-4.5 border-b border-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-2.5 py-1 text-[10px] text-slate-200">
                  <ClipboardList size={12} />
                  Danh sách tổng hợp
                </div>

                <h3 className="mt-2.5 text-base md:text-lg font-black uppercase tracking-tight">
                  Tất cả yêu cầu SOS
                </h3>

                <p className="mt-1 text-xs text-slate-300">
                  Tìm kiếm và lọc nhanh các yêu cầu đang hiển thị
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-full p-2 text-white transition hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 dark:border-white/5 px-4 md:px-6 py-4 bg-white dark:bg-slate-900">
            <style>{`
            @keyframes fadeInDropdown {
              from {
                opacity: 0;
                transform: translateY(6px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 items-center">
                <div className="relative">
                  <Search
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    placeholder="Tìm theo ID, tên người gửi, địa chỉ, số điện thoại..."
                    className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-11 pr-4 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[180px_1fr_1fr_auto] gap-3 items-center">
                <button
                  type="button"
                  onClick={() =>
                    onSortOrderChange(sortOrder === "newest" ? "oldest" : "newest")
                  }
                  className="inline-flex h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <ArrowUpDown size={16} />
                  {sortOrder === "newest" ? "Mới nhất trước" : "Cũ nhất trước"}
                </button>

                <div className="relative" ref={sosTypeDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      onShowSosTypeDropdownChange(!showSosTypeDropdown);
                      onShowDateRangePickerChange(false);
                    }}
                    className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-4 pr-11 text-left text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center transition"
                  >
                    <span className="truncate">{getSosTypeFilterLabel(sosTypeFilter)}</span>
                    <ChevronRight
                      size={16}
                      className={cn(
                        "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200",
                        showSosTypeDropdown ? "rotate-[-90deg]" : "rotate-90"
                      )}
                    />
                  </button>

                  {showSosTypeDropdown && (
                    <div
                      className="absolute z-40 mt-2 w-full min-w-[260px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl"
                      style={{ animation: "fadeInDropdown 0.18s ease" }}
                    >
                      {[
                        { value: "all", label: "Tất cả loại yêu cầu" },
                        { value: "rescue", label: "Cần cứu hộ khẩn cấp" },
                        { value: "supplies", label: "Cần nhu yếu phẩm" },
                        { value: "vehicle", label: "Cần cứu hộ xe" },
                        { value: "other", label: "Yêu cầu khác" },
                      ].map((option) => {
                        const active = sosTypeFilter === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              onSosTypeFilterChange(option.value as RescueTypeFilter);
                              onShowSosTypeDropdownChange(false);
                            }}
                            className={cn(
                              "w-full rounded-xl px-3 py-2.5 text-left text-sm transition",
                              active
                                ? "bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative" ref={dateRangePickerRef}>
                  <button
                    type="button"
                    onClick={onOpenDateRangePicker}
                    className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-4 pr-11 text-left text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 inline-flex items-center transition"
                  >
                    <span className="truncate">
                      {formatRangeDisplay(dateRange.start, dateRange.end)}
                    </span>
                    <ChevronRight
                      size={16}
                      className={cn(
                        "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform duration-200",
                        showDateRangePicker ? "rotate-[-90deg]" : "rotate-90"
                      )}
                    />
                  </button>

                  {showDateRangePicker && (
                    <div
                      className="absolute z-40 mt-2 w-full min-w-[290px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl"
                      style={{ animation: "fadeInDropdown 0.18s ease" }}
                    >
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          Lọc theo khoảng ngày
                        </p>
                        <h4 className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                          {datePickerStep === "start"
                            ? "Chọn ngày bắt đầu"
                            : "Chọn ngày kết thúc"}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {datePickerStep === "start"
                            ? "Bước 1/2: Chọn ngày đầu"
                            : `Bước 2/2: Từ ${formatDateOnly(dateRange.start)}, chọn ngày cuối`}
                        </p>
                      </div>

                      <div className="mt-4">
                        <input
                          type="date"
                          value={datePickerStep === "start" ? dateRange.start : dateRange.end}
                          min={datePickerStep === "end" && dateRange.start ? dateRange.start : undefined}
                          onChange={(e) => onSelectRangeDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500 dark:text-slate-400">Ngày đầu:</span>
                          <span className="font-semibold text-slate-800 dark:text-white">
                            {dateRange.start ? formatDateOnly(dateRange.start) : "Chưa chọn"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-slate-500 dark:text-slate-400">Ngày cuối:</span>
                          <span className="font-semibold text-slate-800 dark:text-white">
                            {dateRange.end ? formatDateOnly(dateRange.end) : "Chưa chọn"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2">
                        {datePickerStep === "end" && (
                          <button
                            type="button"
                            onClick={onClearDateRange}
                            className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            Chọn lại ngày
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    onSearchTermChange("");
                    onStatusFilterChange("all");
                    onSosTypeFilterChange("all");
                    onDateRangeChange({ start: "", end: "" });
                    onSortOrderChange("newest");
                    onShowDateRangePickerChange(false);
                    onShowSosTypeDropdownChange(false);
                    onDatePickerStepChange("start");
                  }}
                  className="inline-flex h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <RefreshCw size={16} />
                  Đặt lại
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="rounded-[28px] border border-slate-200 bg-slate-100/90 p-1.5 dark:border-slate-700 dark:bg-slate-800/80">
                  <div
                    className={cn(
                      "grid gap-1.5",
                      isAdminRole(currentUserRole)
                        ? "grid-cols-2 lg:grid-cols-4"
                        : "grid-cols-3"
                    )}
                  >
                    {[
                      {
                        value: "all",
                        label: `Tất cả (${allCount})`,
                      },
                      {
                        value: "new",
                        label: `Đang chờ (${newCount})`,
                      },
                      {
                        value: "rescuing",
                        label: `Đang được cứu hộ (${rescuingCount})`,
                      },
                      ...(isAdminRole(currentUserRole)
                        ? [
                          {
                            value: "done",
                            label: `Đã hoàn thành (${doneCount})`,
                          },
                        ]
                        : []),
                    ].map((tab) => {
                      const active = statusFilter === tab.value;

                      return (
                        <button
                          key={tab.value}
                          type="button"
                          onClick={() => onStatusFilterChange(tab.value as RescueStatusFilter)}
                          className={cn(
                            "w-full inline-flex min-h-[40px] items-center justify-center rounded-2xl px-3 py-2.5 text-xs md:text-sm font-bold text-center transition",
                            active
                              ? "bg-slate-950 text-white shadow-[0_6px_20px_rgba(15,23,42,0.18)] dark:bg-slate-950"
                              : "bg-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-white"
                          )}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 bg-slate-50 dark:bg-[#14171e]">
            {items.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                  <ClipboardList size={24} />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-800 dark:text-white">
                  Không có yêu cầu phù hợp
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Hãy thử thay đổi bộ lọc để xem thêm dữ liệu.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {items.map((item) => (
                    <RecentSOSRow
                      key={item.id}
                      item={item}
                      currentUserId={currentUserId}
                      currentUserRole={currentUserRole}
                      cancelling={cancellingId === item.id}
                      rescueTeamActionLoadingId={rescueTeamActionLoadingId}
                      onViewDetail={() => onViewDetail(item)}
                      onEditRequest={onEditRequest}
                      onCancelRequest={onCancelRequest}
                      onReceiveRequest={onReceiveRequest}
                      onCancelReceiveRequest={onCancelReceiveRequest}
                      onCompleteRequest={onCompleteRequest}
                    />
                  ))}
                </div>

                <div className="mt-5 px-1 pt-4 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Hiển thị <span className="font-semibold">{fromRecord}</span> -{" "}
                    <span className="font-semibold">{toRecord}</span> trong tổng số{" "}
                    <span className="font-semibold">{totalItems}</span> bản ghi
                  </p>

                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <PaginationButton
                      icon={<ChevronLeft size={16} />}
                      disabled={safeCurrentPage === 1}
                      onClick={() => onPageChange((prev) => Math.max(prev - 1, 1))}
                    />

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .slice(
                        Math.max(0, safeCurrentPage - 3),
                        Math.max(0, safeCurrentPage - 3) + 5
                      )
                      .map((page) => (
                        <PaginationButton
                          key={page}
                          label={String(page)}
                          active={safeCurrentPage === page}
                          onClick={() => onPageChange(page)}
                        />
                      ))}

                    <PaginationButton
                      icon={<ChevronRight size={16} />}
                      disabled={safeCurrentPage === totalPages}
                      onClick={() =>
                        onPageChange((prev) => Math.min(prev + 1, totalPages))
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  };

const RescueDetailModal: React.FC<{
  item: RescueItem;
  currentUserId: number;
  currentUserRole: string;
  cancelling?: boolean;
  rescueTeamActionLoadingId?: number | null;
  onClose: () => void;
  onPreviewImage: (src: string) => void;
  onOpenDirections: (item: RescueItem) => void;
  onEditRequest: (item: RescueItem) => void;
  onCancelRequest: (item: RescueItem) => void;
  onReceiveRequest: (item: RescueItem) => void;
  onCancelReceiveRequest: (item: RescueItem) => void;
  onCompleteRequest: (item: RescueItem) => void;
}> = ({
  item,
  currentUserId,
  currentUserRole,
  cancelling = false,
  rescueTeamActionLoadingId = null,
  onClose,
  onPreviewImage,
  onOpenDirections,
  onEditRequest,
  onCancelRequest,
  onReceiveRequest,
  onCancelReceiveRequest,
  onCompleteRequest,
}) => {
    const statusMeta = getStatusMeta(item);
    const selectedStep = getStepStatus(item);
    const trackingInfo = getTrackingInfo(item);
    const images = normalizeImages(item.images);

    const isRescuer = isRescueTeamRole(currentUserRole);
    const isAdmin = isAdminRole(currentUserRole);
    const canEdit = !isRescuer && !isAdmin && canEditOwnRescue(item, currentUserId);
    const canCancel = canCancelRescueRequest(item, currentUserId, currentUserRole);
    const canReceive = canReceiveRescueRequest(item, currentUserRole);
    const canManageReceived = canManageReceivedRescue(item, currentUserId, currentUserRole);
    const rescueActionLoading = rescueTeamActionLoadingId === item.id;
    const isOwnItem = isOwnRescue(item, currentUserId);

    return createPortal(
      <div
        className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] p-2 md:p-3"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl max-h-[90vh] min-h-0 overflow-hidden rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-[0_24px_70px_rgba(15,23,42,0.32)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-30 shrink-0 relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white px-4 md:px-5 py-4 md:py-4.5 border-b border-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-2.5 py-1 text-[10px] text-slate-200">
                  <Activity size={12} />
                  Trạng thái chi tiết
                </div>

                <h3 className="mt-2.5 text-base md:text-lg font-black uppercase tracking-tight">
                  Chi tiết yêu cầu SOS
                </h3>
                <p className="mt-1 text-xs text-slate-300 font-mono">
                  Mã yêu cầu: #SOS-{item.id}
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-full p-2 text-white transition hover:bg-white/10"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 xl:p-4.5 space-y-4 bg-slate-50 dark:bg-[#14171e]">
            <section className="rounded-[20px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-4 md:p-4.5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Trình trạng cứu hộ
                  </h2>
                </div>

                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold",
                    selectedStep.badgeClass
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", statusMeta.dot)} />
                  {selectedStep.title}
                </span>
              </div>

              <div className="rounded-[18px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/50 p-4 md:p-5">
                <div className="relative">
                  <div className="absolute left-0 right-0 top-6 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />

                  <div
                    className="absolute left-0 top-6 h-1 rounded-full bg-blue-600 transition-all duration-500"
                    style={{
                      width:
                        selectedStep.currentStep === 1
                          ? "12.5%"
                          : selectedStep.currentStep === 2
                            ? "39%"
                            : selectedStep.currentStep === 3
                              ? "68%"
                              : "100%",
                    }}
                  />

                  <div className="relative grid grid-cols-4 gap-3">
                    <Step
                      icon={<CheckCircle2 size={14} />}
                      label="Gửi yêu cầu"
                      active
                      done={selectedStep.currentStep > 1}
                      current={selectedStep.currentStep === 1}
                      time={formatDateTime(item.created_at)}
                      compact
                    />

                    <Step
                      icon={<ClipboardList size={14} />}
                      label="Tiếp nhận"
                      active={selectedStep.currentStep >= 2}
                      done={selectedStep.currentStep > 2}
                      current={selectedStep.currentStep === 2}
                      time={formatDateTime(item.received_at)}
                      compact
                    />

                    <Step
                      icon={<Truck size={14} />}
                      label="Đang đến"
                      active={selectedStep.currentStep >= 3}
                      done={selectedStep.currentStep > 3}
                      current={selectedStep.currentStep === 3}
                      time={
                        item.status === "done" || item.status === "cancel"
                          ? ""
                          : item.status === "rescuing" &&
                            selectedStep.currentStep === 3
                            ? trackingInfo?.etaText
                              ? `Dự kiến: ${trackingInfo.etaText}`
                              : "Đang di chuyển"
                            : ""
                      }
                      compact
                    />

                    <Step
                      icon={<Flag size={14} />}
                      label="Hoàn thành"
                      active={selectedStep.currentStep >= 4}
                      done={selectedStep.currentStep >= 4}
                      current={selectedStep.currentStep === 4}
                      time={formatDateTime(item.completed_at)}
                      compact
                    />
                  </div>
                </div>

                {item.status === "cancel" ? (
                  <StatusBanner
                    tone="red"
                    icon={<XCircle size={20} />}
                    title="Yêu cầu đã bị hủy"
                    desc={
                      isOwnItem
                        ? "Yêu cầu của bạn đã được hủy nên sẽ không tiếp tục xử lý cứu hộ."
                        : "Yêu cầu này đã được hủy nên sẽ không tiếp tục xử lý cứu hộ."
                    }
                    compact
                  />
                ) : item.status === "done" ? (
                  <StatusBanner
                    tone="emerald"
                    icon={<CheckCircle2 size={20} />}
                    title="Yêu cầu đã hoàn thành"
                    desc={`${isOwnItem ? "Yêu cầu của bạn" : "Yêu cầu này"
                      } đã được xử lý xong${item.completed_at ? ` vào lúc ${formatDateTime(item.completed_at)}` : ""
                      }.`}
                    compact
                  />
                ) : selectedStep.currentStep === 1 ? (
                  <StatusBanner
                    tone="amber"
                    icon={<Clock3 size={20} />}
                    title="Đang chờ đội cứu hộ nhận yêu cầu"
                    desc={
                      isOwnItem
                        ? "Yêu cầu của bạn đã được gửi thành công và đang chờ tiếp nhận."
                        : "Yêu cầu này đã được gửi thành công và đang chờ tiếp nhận."
                    }
                    compact
                  />
                ) : (
                  <StatusBanner
                    tone="blue"
                    icon={<MapPin size={20} />}
                    title={
                      selectedStep.currentStep === 3
                        ? "Vị trí đội cứu hộ"
                        : "Yêu cầu đã được tiếp nhận"
                    }
                    desc={
                      selectedStep.currentStep === 3
                        ? trackingInfo
                          ? `Đội cứu hộ còn cách ${isOwnItem ? "bạn" : "vị trí yêu cầu"
                          } ${trackingInfo.distanceText} - Dự kiến ${trackingInfo.etaText}.`
                          : isOwnItem
                            ? "Đội cứu hộ đang di chuyển đến vị trí của bạn."
                            : "Đội cứu hộ đang di chuyển đến vị trí yêu cầu."
                        : isOwnItem
                          ? "Đội cứu hộ đã tiếp nhận yêu cầu của bạn và đang chuẩn bị hỗ trợ."
                          : "Đội cứu hộ đã tiếp nhận yêu cầu này và đang chuẩn bị hỗ trợ."
                    }
                    compact
                  />
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-4">
              <section className="rounded-[20px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-4 md:p-4.5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                    <Info size={16} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Chi tiết yêu cầu
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Thông tin đầy đủ của yêu cầu SOS
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DetailCard
                    label="Mã yêu cầu"
                    value={`#SOS-${item.id}`}
                    compact
                  />
                  <DetailCard
                    label="Loại yêu cầu"
                    value={getSosTypeLabel(item.sos_type)}
                    compact
                  />
                  <DetailCard
                    label="Vị trí cứu trợ"
                    value={item.address || "Chưa có"}
                    full
                    compact
                  />
                  <DetailCard
                    label="Tọa độ"
                    value={`${item.lat}, ${item.lng}`}
                    full
                    compact
                  />
                  <DetailCard
                    label="Mô tả tình trạng"
                    value={item.note || "Chưa có mô tả"}
                    full
                    italic
                    compact
                  />
                </div>

                {images.length > 0 && (
                  <div className="mt-5">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon size={16} />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Hình ảnh hiện trường
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {images.map((img, idx) => {
                        const src = img.startsWith("http")
                          ? img
                          : `${API_BASE}${img}`;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onPreviewImage(src)}
                            className="group relative overflow-hidden rounded-[16px] border border-slate-200 dark:border-white/10"
                          >
                            <img
                              src={src}
                              alt={`Ảnh hiện trường ${idx + 1}`}
                              className="h-28 md:h-32 w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {item.source_url && (
                  <div className="mt-5 rounded-[18px] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon size={16} />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Link nguồn
                      </h3>
                    </div>

                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-xs md:text-sm font-semibold text-blue-600 underline dark:text-blue-400"
                    >
                      {item.source_url}
                    </a>
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="rounded-[20px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-4 md:p-4.5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                      <User size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
                        Người gửi yêu cầu
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Thông tin người cần hỗ trợ
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <DetailRow
                      icon={<User size={14} />}
                      label="Họ tên"
                      value={item.name || "Chưa có"}
                      compact
                    />
                    <DetailRow
                      icon={<PhoneCall size={14} />}
                      label="Số điện thoại"
                      value={item.phone || "Chưa có"}
                      compact
                    />
                    <DetailRow
                      icon={<Users size={14} />}
                      label="Số người cần hỗ trợ"
                      value={`${item.victims || 1} người`}
                      compact
                    />
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-4 md:p-4.5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                      <Users size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
                        Đội cứu hộ phụ trách
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Thông tin hỗ trợ trực tiếp
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 p-3.5">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {item.assigned_team || "Chưa có đội nhận"}
                    </p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      SĐT: {item.rescuer_phone || "Chưa có"}
                    </p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {/* USER: giữ nguyên nút liên hệ đội cứu hộ */}
                    {!isRescuer && !isAdmin && (
                      item.rescuer_phone ? (
                        <a
                          href={`tel:${item.rescuer_phone}`}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                        >
                          <PhoneCall size={14} />
                          Liên hệ đội cứu hộ
                        </a>
                      ) : (
                        <button
                          disabled
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        >
                          <PhoneCall size={14} />
                          Chưa có số liên hệ
                        </button>
                      )
                    )}

                    {/* RESCUER: đổi thành nút chỉ đường tới hiện trường */}
                    {isRescuer && !isAdmin && (
                      hasDirectionInfo(item) ? (
                        <button
                          onClick={() => onOpenDirections(item)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-blue-700"
                        >
                          <Navigation size={14} />
                          Chỉ đường tới hiện trường
                        </button>
                      ) : (
                        <button
                          disabled
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        >
                          <Navigation size={14} />
                          Chưa có vị trí
                        </button>
                      )
                    )}

                    {/* ADMIN: hiện cả liên hệ đội cứu hộ và chỉ đường */}
                    {isAdmin && (
                      <>
                        {item.rescuer_phone ? (
                          <a
                            href={`tel:${item.rescuer_phone}`}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                          >
                            <PhoneCall size={14} />
                            Liên hệ đội cứu hộ
                          </a>
                        ) : (
                          <button
                            disabled
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 cursor-not-allowed"
                          >
                            <PhoneCall size={14} />
                            Chưa có số liên hệ
                          </button>
                        )}

                        {hasDirectionInfo(item) ? (
                          <button
                            onClick={() => onOpenDirections(item)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-blue-700"
                          >
                            <Navigation size={14} />
                            Chỉ đường tới hiện trường
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 cursor-not-allowed"
                          >
                            <Navigation size={14} />
                            Chưa có vị trí
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 dark:border-white/5 p-3 md:p-4 bg-white dark:bg-slate-900">
            <div className="flex flex-col md:flex-row gap-2 md:justify-end">
              {canReceive && (
                <button
                  onClick={() => onReceiveRequest(item)}
                  disabled={rescueActionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                >
                  {rescueActionLoading && <Loader2 size={14} className="animate-spin" />}
                  Nhận yêu cầu
                </button>
              )}

              {canManageReceived && (
                <>
                  <button
                    onClick={() => onCancelReceiveRequest(item)}
                    disabled={rescueActionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-70"
                  >
                    {rescueActionLoading && <Loader2 size={14} className="animate-spin" />}
                    Hủy nhận yêu cầu
                  </button>

                  <button
                    onClick={() => onCompleteRequest(item)}
                    disabled={rescueActionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                  >
                    <CheckCircle2 size={14} />
                    Hoàn thành
                  </button>
                </>
              )}

              {canEdit && (
                <button
                  onClick={() => onEditRequest(item)}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cập nhật
                </button>
              )}

              {canCancel && (
                <button
                  onClick={() => onCancelRequest(item)}
                  disabled={cancelling}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                >
                  {cancelling ? "Đang hủy..." : "Hủy yêu cầu"}
                </button>
              )}

              <button
                onClick={onClose}
                className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

const RescueTeamActionConfirmModal: React.FC<{
  actionState: RescueTeamActionState;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}> = ({ actionState, submitting, onBack, onConfirm }) => {
  const meta = getRescueTeamActionText(actionState.action);
  const item = actionState.item;

  const toneClass = {
    red: {
      iconWrap: "bg-red-100 text-red-600",
      button: "bg-red-600 hover:bg-red-700",
    },
    amber: {
      iconWrap: "bg-amber-100 text-amber-600",
      button: "bg-amber-500 hover:bg-amber-600",
    },
    emerald: {
      iconWrap: "bg-emerald-100 text-emerald-600",
      button: "bg-emerald-600 hover:bg-emerald-700",
    },
  }[meta.tone];

  return createPortal(
    <div
      className="fixed inset-0 z-[11600] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-3"
      onClick={onBack}
    >
      <div
        className="w-[460px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0F172A] px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", toneClass.iconWrap)}>
              {meta.tone === "emerald" ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <h3 className="text-lg font-bold">{meta.title}</h3>
              <p className="mt-1 text-sm text-slate-200">{meta.desc}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-2">
            <p>
              <span className="text-slate-500">Mã yêu cầu: </span>
              <span className="font-bold text-slate-900">#SOS-{item.id}</span>
            </p>
            <p>
              <span className="text-slate-500">Người cần hỗ trợ: </span>
              <span className="font-bold text-slate-900">{item.name || "Không có"}</span>
            </p>
            <p>
              <span className="text-slate-500">Địa chỉ: </span>
              <span className="font-bold text-slate-900">{item.address || "Không có"}</span>
            </p>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={18} className="mt-0.5 text-amber-600 shrink-0" />
            <p className="text-sm leading-6 text-slate-700">{meta.question}</p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
            >
              Quay lại
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-70",
                toneClass.button
              )}
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? meta.loadingLabel : meta.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const CancelConfirmModal: React.FC<{
  item: RescueItem;
  cancelling: boolean;
  onBack: () => void;
  onConfirm: () => void;
}> = ({ item, cancelling, onBack, onConfirm }) => {
  return createPortal(
    <div
      className="fixed inset-0 z-[11600] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-3"
      onClick={onBack}
    >
      <div
        className="w-[460px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0F172A] px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <AlertTriangle size={22} />
            </div>

            <div>
              <h3 className="text-lg font-bold">Xác nhận hủy yêu cầu</h3>
              <p className="mt-1 text-sm text-slate-200">
                Yêu cầu SOS sẽ bị hủy và không tiếp tục xử lý cứu hộ.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-2">
            <p>
              <span className="text-slate-500">Mã yêu cầu: </span>
              <span className="font-bold text-slate-900">#SOS-{item.id}</span>
            </p>

            <p>
              <span className="text-slate-500">Người cần hỗ trợ: </span>
              <span className="font-bold text-slate-900">
                {item.name || "Không có"}
              </span>
            </p>

            <p>
              <span className="text-slate-500">Địa chỉ: </span>
              <span className="font-bold text-slate-900">
                {item.address || "Không có"}
              </span>
            </p>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 text-amber-600 shrink-0"
            />
            <p className="text-sm leading-6 text-slate-700">
              Bạn có chắc muốn hủy yêu cầu cứu hộ này không?
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={cancelling}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
            >
              Quay lại
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-70"
            >
              {cancelling && <Loader2 size={16} className="animate-spin" />}
              {cancelling ? "Đang hủy..." : "Xác nhận hủy"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const InputField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  full?: boolean;
  placeholder?: string;
  type?: string;
  min?: number;
}> = ({ label, name, value, onChange, full, placeholder, type = "text", min }) => (
  <div className={full ? "md:col-span-2" : ""}>
    <label className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
      {label}
    </label>
    <input
      type={type}
      min={min}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full h-[48px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-sm outline-none transition focus:border-blue-500"
    />
  </div>
);

const StatusBanner = ({
  tone,
  icon,
  title,
  desc,
  compact = false,
}: {
  tone: "red" | "emerald" | "amber" | "blue";
  icon: React.ReactNode;
  title: string;
  desc: string;
  compact?: boolean;
}) => {
  const toneMap = {
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300",
  };

  return (
    <div
      className={`mt-5 rounded-[18px] border ${compact ? "p-3.5 md:p-4 gap-3" : "p-4 md:p-5 gap-4"
        } flex items-start ${toneMap[tone]}`}
    >
      <div
        className={`flex ${compact ? "h-10 w-10" : "h-12 w-12"
          } shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-sm`}
      >
        {icon}
      </div>
      <div>
        <p className={`${compact ? "text-xs" : "text-sm"} font-black uppercase tracking-tight`}>
          {title}
        </p>
        <p className={`mt-1 ${compact ? "text-xs leading-5" : "text-sm leading-6"} font-semibold`}>
          {desc}
        </p>
      </div>
    </div>
  );
};

const Step = ({
  icon,
  label,
  active,
  done,
  current,
  time,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  done?: boolean;
  current?: boolean;
  time?: string;
  compact?: boolean;
}) => {
  const iconWrapClass = current
    ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] ring-4 ring-blue-100 dark:ring-blue-900/30"
    : done || active
      ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40"
      : "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700";

  const labelClass =
    current || active || done
      ? "text-slate-900 dark:text-white"
      : "text-slate-400 dark:text-slate-500";

  const timeClass =
    current || active || done
      ? "text-slate-500 dark:text-slate-400"
      : "text-slate-400 dark:text-slate-600";

  return (
    <>
      <style>
        {`
          @keyframes squareFloatHome {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-3px);
            }
          }

          @keyframes squareWaveHome {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            70% {
              transform: scale(1.6);
              opacity: 0;
            }
            100% {
              transform: scale(1.6);
              opacity: 0;
            }
          }
        `}
      </style>

      <div className="relative z-10 flex flex-col items-center text-center min-w-0 flex-1">
        <div className="relative">
          {current && (
            <>
              <span
                className={cn(
                  "absolute inset-0 rounded-2xl bg-blue-400/30",
                  compact ? "scale-[1.18]" : "scale-[1.22]"
                )}
                style={{
                  animation: "squareWaveHome 1.7s ease-out infinite",
                }}
              />

              <span
                className={cn(
                  "absolute inset-0 rounded-2xl border border-blue-300/60 dark:border-blue-400/50",
                  compact ? "scale-[1.28]" : "scale-[1.34]"
                )}
                style={{
                  animation: "squareWaveHome 1.7s ease-out infinite 0.35s",
                }}
              />
            </>
          )}

          <div
            className={cn(
              "relative overflow-hidden flex items-center justify-center rounded-2xl transition-all",
              compact ? "h-12 w-12" : "h-14 w-14",
              iconWrapClass
            )}
            style={
              current
                ? {
                  animation: "squareFloatHome 1.8s ease-in-out infinite",
                }
                : undefined
            }
          >
            <span className="relative z-10">{icon}</span>
          </div>
        </div>

        <p
          className={cn(
            "mt-3 font-black uppercase tracking-tight leading-tight",
            compact ? "text-[11px]" : "text-xs md:text-sm",
            labelClass
          )}
        >
          {label}
        </p>

        <p
          className={cn(
            "mt-1 font-semibold leading-tight",
            compact ? "text-[11px]" : "text-[11px] md:text-xs",
            timeClass
          )}
        >
          {time || "Chưa có"}
        </p>
      </div>
    </>
  );
};

const DetailCard = ({
  label,
  value,
  italic,
  full,
  compact = false,
}: {
  label: string;
  value: string;
  italic?: boolean;
  full?: boolean;
  compact?: boolean;
}) => (
  <div
    className={`rounded-[18px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 ${compact ? "p-3.5" : "p-4"
      } ${full ? "md:col-span-2" : ""}`}
  >
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
      {label}
    </p>
    <p
      className={`mt-1.5 ${compact ? "text-[13px] leading-5" : "text-sm leading-6"
        } font-bold ${italic
          ? "italic text-slate-600 dark:text-slate-300"
          : "text-slate-800 dark:text-slate-100"
        }`}
    >
      {value}
    </p>
  </div>
);

const DetailRow = ({
  icon,
  label,
  value,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}) => (
  <div className="flex items-start gap-2.5">
    <div className="mt-0.5 text-blue-600 dark:text-blue-400">{icon}</div>
    <div>
      <p className={`${compact ? "text-[10px]" : "text-[10px]"} font-black uppercase tracking-wider text-slate-400 dark:text-slate-500`}>
        {label}
      </p>
      <p className={`${compact ? "text-[13px]" : "text-[13px]"} font-bold text-slate-800 dark:text-slate-100 break-all`}>
        {value}
      </p>
    </div>
  </div>
);

const RiskProgress: React.FC<RiskProgressProps> = ({ label, percent, color }) => (
  <div>
    <div className="flex justify-between text-sm mb-2 gap-3">
      <span className="font-medium">{label}</span>
      <span className="font-bold whitespace-nowrap">{percent}%</span>
    </div>
    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
      <div
        className={`${color} h-full transition-all duration-1000`}
        style={{ width: `${percent}%` }}
      />
    </div>
  </div>
);

const ResourceCard: React.FC<ResourceCardProps> = ({ icon, label, value, color }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center space-x-4">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
      {React.cloneElement(icon, { size: 24 })}
    </div>
    <div>
      <h4 className="text-xs text-slate-500 uppercase font-bold tracking-wider">
        {label}
      </h4>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
);

const WeatherMetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
    <p className="text-lg font-bold">{value}</p>
  </div>
);

function buildSelectableForecastHours(weather: WeatherSummary, limit = 12): WeatherHour[] {
  const raw = Array.isArray(weather.hourly12) ? weather.hourly12 : [];

  const validHourly = raw
    .filter((item) => item && item.time)
    .map((item, index) => ({
      ...item,
      hour: item.hour || formatWeatherHourLabel(item.time, index),
      temperature: Number(item.temperature ?? 0),
      rain: Number(item.rain ?? 0),
      rainProbability: Number(item.rainProbability ?? 0),
      windSpeed: Number(item.windSpeed ?? 0),
      weatherCode: Number(item.weatherCode ?? 0),
      weatherText: item.weatherText || "Đang cập nhật",
    }));

  // Nếu API có hourly12 thì dùng dữ liệu thật
  if (validHourly.length > 0) {
    return validHourly.slice(0, limit);
  }

  // Nếu không có hourly12, tạo danh sách giờ giả lập từ current
  // để UI vẫn cho chọn giờ và đổ vào "Chỉ số hiện tại"
  const current = weather.current;

  if (!current) return [];

  return Array.from({ length: limit }, (_, index) => {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + index + 1);

    return {
      time: date.toISOString(),
      hour: `${String(date.getHours()).padStart(2, "0")}h`,
      temperature: Number(current.temperature ?? weather.temperature ?? 0),
      rain: Number(current.rain ?? weather.rain ?? 0),
      rainProbability: Number(current.rainProbability ?? weather.rainProbability ?? 0),
      windSpeed: Number(current.windSpeed ?? weather.windSpeed ?? 0),
      weatherCode: Number(current.weatherCode ?? 0),
      weatherText: current.weatherText || weather.weatherText || "Dữ liệu tạm thời",
    };
  });
}

const WeatherNowPanel: React.FC<{
  weather: WeatherSummary;
  weatherLoading: boolean;
  geoPhase: GeoPhase;
  now: string;
  locationState: LocationSourceState;
}> = ({ weather, weatherLoading, geoPhase, now, locationState }) => {
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);

  const current = weather.current;

  const currentTemp = Number(current?.temperature ?? weather.temperature ?? 0);
  const currentRain = Number(current?.rain ?? weather.rain ?? 0);
  const currentRainProbability = Number(
    current?.rainProbability ?? weather.rainProbability ?? 0
  );
  const currentWind = Number(current?.windSpeed ?? weather.windSpeed ?? 0);
  const currentText =
    current?.weatherText || weather.weatherText || "Đang cập nhật";
  const currentCode = current?.weatherCode ?? 0;

  const forecastHours = useMemo(() => {
    return buildSelectableForecastHours(weather, 12);
  }, [weather]);

  useEffect(() => {
    setSelectedHourIndex(0);
  }, [weather.updatedAt, locationState.lat, locationState.lng]);

  useEffect(() => {
    if (selectedHourIndex > forecastHours.length - 1) {
      setSelectedHourIndex(0);
    }
  }, [forecastHours.length, selectedHourIndex]);

  const selectedHour = forecastHours[selectedHourIndex] || null;

  const metricTemp = selectedHour
    ? Number(selectedHour.temperature ?? 0)
    : currentTemp;

  const metricRainProbability = selectedHour
    ? Number(selectedHour.rainProbability ?? 0)
    : currentRainProbability;

  const metricRain = selectedHour ? Number(selectedHour.rain ?? 0) : currentRain;

  const metricWind = selectedHour
    ? Number(selectedHour.windSpeed ?? 0)
    : currentWind;

  const metricTitle = selectedHour
    ? `Chỉ số tại ${formatWeatherHourLabel(selectedHour.time, selectedHourIndex)}`
    : "Chỉ số hiện tại";

  const tempTone = getTemperatureTone(currentTemp);

  const tempPercent = Math.min(
    100,
    Math.max(0, Math.round(((currentTemp - 10) / 30) * 100))
  );

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <CloudRain className="text-sky-600" size={20} />
          <div>
            <h2 className="font-bold text-lg">Thời tiết hiện tại</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {weatherLoading
                ? geoPhase === "requesting"
                  ? "Đang chờ quyền vị trí từ trình duyệt..."
                  : "Đang tải dữ liệu thời tiết..."
                : `${currentText}`}
            </p>
          </div>
        </div>

        <div className="text-3xl leading-none">
          {getWeatherIconText(currentCode)}
        </div>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[28px] border p-5 text-white shadow-lg transition-all duration-500",
          tempTone.card
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_28%)]" />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 max-w-[200px] whitespace-normal break-words text-sm font-semibold uppercase tracking-[0.16em] leading-6 text-white/85">
              {locationState.label || "Vị trí hiện tại"}
            </p>

            <span
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                tempTone.chip
              )}
            >
              {tempTone.label}
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-6xl font-black leading-none">
                {Math.round(currentTemp)}°
              </div>

              <p className="mt-2 text-sm font-semibold text-white/85">
                {currentText}
              </p>
            </div>

            <div className="text-right text-xs text-white/85">
              <p>Mưa: {Math.round(currentRainProbability)}%</p>
              <p>Lượng mưa: {currentRain} mm</p>
              <p>Gió: {currentWind} km/h</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
              <span>Thang nhiệt độ</span>
              <span>{Math.round(currentTemp)}°C</span>
            </div>

            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  tempTone.bar
                )}
                style={{ width: `${tempPercent}%` }}
              />
            </div>

            <div className="mt-1 flex justify-between text-[10px] text-white/65">
              <span>Lạnh</span>
              <span>Dễ chịu</span>
              <span>Nóng</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Dự báo theo giờ
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Bắt đầu từ giờ kế tiếp, tối đa 12 giờ
            </p>
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {weather.updatedAt || now}
          </span>
        </div>

        {forecastHours.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-sm text-slate-500 dark:text-slate-400">
            Không có dữ liệu thời tiết để hiển thị.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {forecastHours.map((item, index) => {
              const active = selectedHourIndex === index;

              return (
                <button
                  key={`${item.time}-${index}`}
                  type="button"
                  onClick={() => setSelectedHourIndex(index)}
                  className={cn(
                    "min-w-[90px] rounded-2xl border p-3 text-center transition-all",
                    active
                      ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900"
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px] font-black",
                      active
                        ? "text-white"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {item.hour || formatWeatherHourLabel(item.time, index)}
                  </p>

                  <div className="my-2 text-2xl">
                    {getWeatherIconText(item.weatherCode)}
                  </div>

                  <p className="text-lg font-black">
                    {Math.round(item.temperature)}°
                  </p>

                  <p
                    className={cn(
                      "mt-1 text-[11px] font-semibold",
                      active ? "text-blue-50" : "text-blue-600 dark:text-blue-400"
                    )}
                  >
                    Mưa {Math.round(item.rainProbability)}%
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              {metricTitle}
            </p>
            {selectedHour?.weatherText && (
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {selectedHour.weatherText}
              </p>
            )}
          </div>

          {selectedHour && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              Đã chọn
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <WeatherMetricCard
            icon={<Thermometer size={18} className="text-orange-500" />}
            label="Nhiệt độ"
            value={`${Math.round(metricTemp)}°C`}
          />

          <WeatherMetricCard
            icon={<CloudRain size={18} className="text-blue-500" />}
            label="Xác suất mưa"
            value={`${Math.round(metricRainProbability)}%`}
          />

          <WeatherMetricCard
            icon={<Waves size={18} className="text-cyan-500" />}
            label="Lượng mưa"
            value={`${metricRain} mm`}
          />

          <WeatherMetricCard
            icon={<Wind size={18} className="text-slate-500" />}
            label="Gió"
            value={`${metricWind} km/h`}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;