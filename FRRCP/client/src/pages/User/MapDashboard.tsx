import React, { useState, useEffect, useRef } from 'react';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'mapbox-gl-leaflet';

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY as string | undefined;

const API_BASE = "http://localhost:3000";
const STORAGE_KEY = "rescue_tracking_snapshots";

(mapboxgl as any).setTelemetryEnabled?.(false);

if (GOONG_API_KEY) {
  mapboxgl.accessToken = GOONG_API_KEY;
}

import Navbar from "../../components/Navbar";
import { useAuthModal } from "../../contexts/AuthModalContext";
import {
  Search,
  Navigation,
  Plus,
  Minus,
  Menu,
  X,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  PhoneCall,
  Truck,
  Flag,
  User,
  ClipboardList,
  Image as ImageIcon,
  Link as LinkIcon,
  Activity,
  Clock3,
  Users,
} from 'lucide-react';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import mapIcon from '../../assets/layers.png';
import addressIcon from '../../assets/location.png';
import peopleIcon from '../../assets/people.png';
import timeIcon from '../../assets/time.png';

import thongtindancuIcon from '../../assets/thongtindancu.png';
import vitricuutroIcon from '../../assets/vitricuutro.png';
import tinhtranghientaiIcon from '../../assets/tinhtranghientai.png';
import linknguonIcon from '../../assets/linknguon.png';
import hinhanhIcon from '../../assets/hinhanh.png';

import sosIcon from '../../assets/sos.png';
import sos2Icon from '../../assets/sos2.png';

/* =========================
   LEAFLET ICONS
========================= */
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const createPinIcon = (color: string, symbol: string) =>
  L.divIcon({
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        border: 2px solid white;
      ">
        <div style="
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(45deg);
          color: white;
          font-size: 20px;
          font-weight: 800;
        ">
          ${symbol}
        </div>
      </div>
    `,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34]
  });


const createRescuingIcon = (color: string, symbol: string) =>
  L.divIcon({
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: white;
        border: 3px solid #2563eb;
        box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 800;
        ">
          ${symbol}
        </div>
      </div>
    `,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });

const userBlueDot = L.divIcon({
  html: `
    <div style="
      width:16px;
      height:16px;
      background:#3b82f6;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 0 0 6px rgba(59,130,246,0.3);
    "></div>
  `,
  className: ""
});

const rescueTeamIcon = createRescuingIcon("#2563eb", "⛑");

const createLineInfoLabel = (
  text: string,
  tone: "blue" | "green" = "blue",
  angleDeg: number = 0
) =>
  L.divIcon({
    html: `
      <div style="
        display: inline-block;
        white-space: nowrap;
        padding: 6px 10px;
        border-radius: 999px;
        background: ${tone === "blue" ? "#eff6ff" : "#ecfdf5"};
        color: ${tone === "blue" ? "#1d4ed8" : "#047857"};
        border: 1px solid ${tone === "blue" ? "#bfdbfe" : "#a7f3d0"};
        box-shadow: 0 4px 10px rgba(0,0,0,0.12);
        font-size: 12px;
        font-weight: 700;
        transform: rotate(${angleDeg}deg);
        transform-origin: center center;
      ">
        ${text}
      </div>
    `,
    className: "",
    iconSize: [150, 36],
    iconAnchor: [75, 18]
  });

const redSelectIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [35, 35],
});

const sosLabels: Record<string, React.ReactNode> = {
  rescue: (
    <div className="flex items-center gap-1 justify-center">
      <img src={sosIcon} alt="SOS" className="w-4 h-4" />
      <span>Cần cứu hộ khẩn cấp</span>
    </div>
  ),
  supplies: (
    <div className="flex items-center gap-1 justify-center">
      <img src={sosIcon} alt="SOS" className="w-4 h-4" />
      <span>Cần nhu yếu phẩm</span>
    </div>
  ),
  vehicle: (
    <div className="flex items-center gap-1 justify-center">
      <img src={sosIcon} alt="SOS" className="w-4 h-4" />
      <span>Cần cứu hộ xe</span>
    </div>
  ),
  other: (
    <div className="flex items-center gap-1 justify-center">
      <img src={sosIcon} alt="SOS" className="w-4 h-4" />
      <span>Yêu cầu khác</span>
    </div>
  )
};

L.Marker.prototype.options.icon = DefaultIcon;

/* =========================
   TYPES
========================= */
type Province = {
  code: number;
  name: string;
};

type Ward = {
  code: number;
  name: string;
};

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
};

type StepStatus = {
  currentStep: 1 | 2 | 3 | 4;
  title: string;
  badgeClass: string;
  eta?: string | null;
  distance?: string | null;
};

/* =========================
   UTILS
========================= */
const timeAgo = (iso: string) => {
  const now = new Date();
  const past = new Date(iso);
  const diff = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Chưa có';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Chưa có';

  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const getStatusLabel = (status: string) => {
  if (status === "new") return "Đang chờ cứu hộ";
  if (status === "rescuing") return "Đang được cứu hộ";
  if (status === "cancel") return "Đã hủy";
  if (status === "done") return "Đã hoàn thành";
  return "Không rõ";
};

const getStatusClass = (status: string) => {
  if (status === 'new') return 'bg-amber-50 text-amber-600 border-amber-200';
  if (status === "rescuing") return "bg-blue-50 text-blue-600 border-blue-200";
  if (status === "cancel") return "bg-gray-100 text-gray-600 border-gray-200";
  if (status === "done") return "bg-emerald-50 text-emerald-600 border-emerald-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
};

const getTypeLabel = (type: string) => {
  if (type === "rescue") return "Cần cứu hộ";
  if (type === "supplies") return "Cần nhu yếu phẩm";
  if (type === "vehicle") return "Cần cứu hộ xe";
  if (type === "other") return "Yêu cầu khác";
  return "Yêu cầu khác";
};

const truncateText = (text: string = "", max = 50) => {
  if (!text) return "Không có địa chỉ";
  return text.length > max ? text.slice(0, max) + "..." : text;
};

const normalizeProvinceLabel = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.startsWith("tỉnh") || lower.startsWith("thành phố")) return name;
  return `tỉnh ${name}`;
};

const normalizeWardLabel = (name: string) => {
  const lower = name.toLowerCase();
  if (
    lower.startsWith("phường") ||
    lower.startsWith("xã") ||
    lower.startsWith("thị trấn") ||
    lower.startsWith("đặc khu")
  ) {
    return name;
  }
  return `Phường ${name}`;
};

const normalizeText = (value: string = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const findProvinceByName = (provinceName: string, list: Province[]) => {
  const target = normalizeText(provinceName);

  return list.find((p) => {
    const name = normalizeText(p.name);
    const nameNoPrefix = name
      .replace(/^tinh\s+/, "")
      .replace(/^thanh pho\s+/, "");

    const targetNoPrefix = target
      .replace(/^tinh\s+/, "")
      .replace(/^thanh pho\s+/, "");

    return (
      name === target ||
      nameNoPrefix === targetNoPrefix ||
      name.includes(target) ||
      target.includes(name) ||
      nameNoPrefix.includes(targetNoPrefix) ||
      targetNoPrefix.includes(nameNoPrefix)
    );
  });
};

const findWardByName = (wardName: string, list: Ward[]) => {
  const target = normalizeText(wardName);

  return list.find((w) => {
    const name = normalizeText(w.name);
    const nameNoPrefix = name
      .replace(/^phuong\s+/, "")
      .replace(/^xa\s+/, "")
      .replace(/^thi tran\s+/, "")
      .replace(/^dac khu\s+/, "");

    const targetNoPrefix = target
      .replace(/^phuong\s+/, "")
      .replace(/^xa\s+/, "")
      .replace(/^thi tran\s+/, "")
      .replace(/^dac khu\s+/, "");

    return (
      name === target ||
      nameNoPrefix === targetNoPrefix ||
      name.includes(target) ||
      target.includes(name) ||
      nameNoPrefix.includes(targetNoPrefix) ||
      targetNoPrefix.includes(nameNoPrefix)
    );
  });
};

const buildAddressDetailFromReverse = (addr: any) => {
  const parts = [
    addr.house_number,
    addr.road,
    addr.neighbourhood,
    addr.hamlet,
    addr.village,
    addr.suburb,
    addr.quarter
  ]
    .filter(Boolean)
    .join(" ");

  return parts.trim();
};

const ButtonSpinner = () => (
  <span className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></span>
);

const VIETNAM_PICK_BOUNDS = {
  minLat: 8.55,
  maxLat: 23.35,
  minLng: 102.35,
  maxLng: 109.48
};

const isInVietnam = (lat: number, lng: number) => {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= VIETNAM_PICK_BOUNDS.minLat &&
    lat <= VIETNAM_PICK_BOUNDS.maxLat &&
    lng >= VIETNAM_PICK_BOUNDS.minLng &&
    lng <= VIETNAM_PICK_BOUNDS.maxLng
  );
};

const getVietnamSupportMessage = () =>
  "Vị trí bạn chọn nằm ngoài phạm vi hỗ trợ. Vui lòng chọn trong khu vực Việt Nam.";

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

  if (totalMinutes < 60) {
    return `Khoảng ${totalMinutes} phút`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `Khoảng ${hours} giờ`;
  }

  return `Khoảng ${hours} giờ ${minutes} phút`;
};

const getRescueTrackingInfo = (item: any) => {
  const rescueLat = Number(item?.rescuer_lat);
  const rescueLng = Number(item?.rescuer_lng);
  const sosLat = Number(item?.lat);
  const sosLng = Number(item?.lng);

  const hasValidCoords =
    Number.isFinite(rescueLat) &&
    Number.isFinite(rescueLng) &&
    Number.isFinite(sosLat) &&
    Number.isFinite(sosLng);

  if (!hasValidCoords) {
    return null;
  }

  const distanceKm = calculateDistanceKm(rescueLat, rescueLng, sosLat, sosLng);

  return {
    distanceKm,
    distanceText:
      distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`,
    etaText: estimateArrivalFromDistance(distanceKm, item?.sos_type)
  };
};

const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

const parseImages = (images: any): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) return images;

  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getSosTypeLabel = (type?: string) => {
  switch (type) {
    case "rescue":
      return "Cần cứu hộ khẩn cấp";
    case "supplies":
      return "Cần nhu yếu phẩm";
    case "vehicle":
      return "Cần cứu hộ xe";
    default:
      return "Yêu cầu khác";
  }
};

const getSnapshotStore = (): Record<
  string,
  { lat: number | null; lng: number | null }
> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveSnapshotStore = (
  data: Record<string, { lat: number | null; lng: number | null }>
) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const hasRescuerMoved = (item: any) => {
  if (item.status !== "rescuing" || !item.handled_by) return false;

  const store = getSnapshotStore();
  const key = String(item.id);

  const currentLat = Number(item.rescuer_lat);
  const currentLng = Number(item.rescuer_lng);

  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
    return false;
  }

  if (!store[key]) {
    store[key] = { lat: currentLat, lng: currentLng };
    saveSnapshotStore(store);
    return false;
  }

  const base = store[key];
  const moved =
    base.lat !== null &&
    base.lng !== null &&
    (Math.abs(currentLat - base.lat) > 0.00001 ||
      Math.abs(currentLng - base.lng) > 0.00001);

  return moved;
};

const getStepStatus = (item: any): StepStatus => {
  const tracking = getRescueTrackingInfo(item);

  if (item.status === "cancel") {
    return {
      currentStep: 1,
      title: "Đã hủy",
      badgeClass:
        "bg-red-100 text-red-700 border border-red-200",
      eta: null,
      distance: null,
    };
  }

  if (item.status === "done") {
    return {
      currentStep: 4,
      title: "Hoàn thành",
      badgeClass:
        "bg-emerald-100 text-emerald-700 border border-emerald-200",
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
          "bg-blue-100 text-blue-700 border border-blue-200",
        eta: tracking?.etaText || null,
        distance: tracking?.distanceText || null,
      };
    }

    return {
      currentStep: 2,
      title: "Tiếp nhận",
      badgeClass:
        "bg-blue-100 text-blue-700 border border-blue-200",
      eta: tracking?.etaText || null,
      distance: tracking?.distanceText || null,
    };
  }

  return {
    currentStep: 1,
    title: "Chờ tiếp nhận",
    badgeClass:
      "bg-amber-100 text-amber-700 border border-amber-200",
    eta: null,
    distance: null,
  };
};

const getStepDotClass = (status?: string) => {
  switch ((status || "").toLowerCase()) {
    case "new":
      return "bg-amber-500";
    case "rescuing":
      return "bg-blue-500";
    case "done":
      return "bg-emerald-500";
    case "cancel":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
};

const miniMapMarkerIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

/* =========================
   UI COMPONENTS
========================= */
const toastMeta = {
  success: {
    title: "Thành công",
    icon: CheckCircle2,
    border: "border-emerald-200",
    iconWrap: "bg-emerald-100 text-emerald-600",
    line: "bg-emerald-500"
  },
  error: {
    title: "Có lỗi xảy ra",
    icon: XCircle,
    border: "border-red-200",
    iconWrap: "bg-red-100 text-red-600",
    line: "bg-red-500"
  },
  warning: {
    title: "Cảnh báo",
    icon: AlertTriangle,
    border: "border-amber-200",
    iconWrap: "bg-amber-100 text-amber-600",
    line: "bg-amber-500"
  },
  info: {
    title: "Thông báo",
    icon: Info,
    border: "border-blue-200",
    iconWrap: "bg-blue-100 text-blue-600",
    line: "bg-blue-500"
  }
} as const;

const NotificationToast = ({
  toast,
  onClose
}: {
  toast: ToastState;
  onClose: () => void;
}) => {
  const [mounted, setMounted] = useState(false);
  const [showAnim, setShowAnim] = useState(false);

  useEffect(() => {
    if (toast.show) {
      setMounted(true);
      setShowAnim(false);

      const raf = requestAnimationFrame(() => {
        setShowAnim(true);
      });

      return () => cancelAnimationFrame(raf);
    }

    setShowAnim(false);

    const timer = setTimeout(() => {
      setMounted(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [toast.show, toast.id]);

  if (!mounted) return null;

  const meta = toastMeta[toast.type];
  const Icon = meta.icon;

  return (
    <>
      <style>
        {`
          @keyframes toastIn {
            0% {
              opacity: 0;
              transform: translateY(-22px) scale(0.96);
            }
            60% {
              opacity: 1;
              transform: translateY(4px) scale(1.01);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes toastOut {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-18px) scale(0.98);
            }
          }

          @keyframes toastProgressShrink {
            from {
              transform: scaleX(1);
            }
            to {
              transform: scaleX(0);
            }
          }
        `}
      </style>

      <div className="fixed top-5 inset-x-0 z-[9000] flex justify-center px-3 pointer-events-none">
        <div
          key={toast.id}
          className={`pointer-events-auto inline-block w-fit max-w-[85vw] min-w-[300px] overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur ${meta.border}`}
          style={{
            animation: `${showAnim ? "toastIn" : "toastOut"} 0.28s ease forwards`,
          }}
        >
          <div className="flex items-start gap-3 px-4 py-4">
            <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.iconWrap}`}>
              <Icon size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-800">{meta.title}</div>
              <p className="mt-0.5 text-sm text-slate-600 break-words">{toast.message}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                Tự đóng sau {Math.ceil(toast.duration / 1000)} giây
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          <div className="h-1 w-full bg-slate-100 overflow-hidden">
            <div
              key={`progress-${toast.id}`}
              className={meta.line}
              style={{
                width: "100%",
                height: "100%",
                transformOrigin: "left",
                animationName: "toastProgressShrink",
                animationDuration: `${toast.duration}ms`,
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};



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
    red: "border-red-200 bg-red-50 text-red-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div
      className={`mt-5 rounded-[18px] border ${compact ? "p-3.5 md:p-4 gap-3" : "p-4 md:p-5 gap-4"} flex items-start ${toneMap[tone]}`}
    >
      <div
        className={`flex ${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm`}
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
    className={`rounded-[18px] border border-slate-200 bg-slate-50 ${compact ? "p-3.5" : "p-4"} ${full ? "md:col-span-2" : ""}`}
  >
    <p className={`${compact ? "text-[11px]" : "text-[11px]"} font-black uppercase tracking-[0.16em] text-slate-400`}>
      {label}
    </p>
    <p
      className={`mt-1.5 ${compact ? "text-[13px] leading-5" : "text-sm leading-6"} font-bold ${italic ? "italic text-slate-600" : "text-slate-800"}`}
    >
      {value}
    </p>
  </div>
);

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
    ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] ring-4 ring-blue-100"
    : done || active
      ? "bg-blue-50 text-blue-600 border border-blue-200"
      : "bg-slate-100 text-slate-400 border border-slate-200";

  const labelClass = current || active || done ? "text-slate-900" : "text-slate-400";
  const timeClass = current || active || done ? "text-slate-500" : "text-slate-400";

  return (
    <>
      <style>
        {`
          @keyframes squareFloat {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-3px);
            }
          }

          @keyframes squareWave {
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
                style={{ animation: "squareWave 1.7s ease-out infinite" }}
              />
              <span
                className={cn(
                  "absolute inset-0 rounded-2xl border border-blue-300/60",
                  compact ? "scale-[1.28]" : "scale-[1.34]"
                )}
                style={{ animation: "squareWave 1.7s ease-out infinite 0.35s" }}
              />
            </>
          )}

          <div
            className={cn(
              "relative overflow-hidden flex items-center justify-center rounded-2xl transition-all",
              compact ? "h-12 w-12" : "h-14 w-14",
              iconWrapClass
            )}
            style={current ? { animation: "squareFloat 1.8s ease-in-out infinite" } : undefined}
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
    <div className="mt-0.5 text-blue-600">{icon}</div>
    <div>
      <p className={`${compact ? "text-[10px]" : "text-[10px]"} font-black uppercase tracking-wider text-slate-400`}>
        {label}
      </p>
      <p className={`${compact ? "text-[13px]" : "text-[13px]"} font-bold text-slate-800 break-all`}>
        {value}
      </p>
    </div>
  </div>
);

type ConfirmActionTone = "red" | "amber" | "emerald" | "slate";

const ConfirmActionModal = ({
  open,
  item,
  tone = "slate",
  title,
  description = "Vui lòng xác nhận thao tác này.",
  message,
  confirmText,
  loadingText,
  cancelText,
  onConfirm,
  onCancel,
  loading = false,
}: {
  open: boolean;
  item?: any | null;
  tone?: ConfirmActionTone;
  title: string;
  description?: string;
  message: string;
  confirmText: string;
  loadingText?: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) => {
  if (!open) return null;

  const toneClass: Record<
    ConfirmActionTone,
    {
      iconWrap: string;
      button: string;
    }
  > = {
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
    slate: {
      iconWrap: "bg-slate-100 text-slate-700",
      button: "bg-[#0F172A] hover:bg-slate-800",
    },
  };

  const Icon = tone === "emerald" ? CheckCircle2 : AlertTriangle;
  const activeTone = toneClass[tone];

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-3"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-[460px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0F172A] px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                activeTone.iconWrap
              )}
            >
              <Icon size={22} />
            </div>

            <div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-1 text-sm text-slate-200">{description}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {item && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-2">
              <p>
                <span className="text-slate-500">Mã yêu cầu: </span>
                <span className="font-bold text-slate-900">
                  #SOS-{item?.id || "---"}
                </span>
              </p>

              <p>
                <span className="text-slate-500">Người cần hỗ trợ: </span>
                <span className="font-bold text-slate-900">
                  {item?.name || "Không có"}
                </span>
              </p>

              <p>
                <span className="text-slate-500">Địa chỉ: </span>
                <span className="font-bold text-slate-900">
                  {item?.address || "Không có"}
                </span>
              </p>
            </div>
          )}

          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3",
              item ? "mt-4" : ""
            )}
          >
            <AlertTriangle
              size={18}
              className="mt-0.5 text-amber-600 shrink-0"
            />
            <p className="text-sm leading-6 text-slate-700">{message}</p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-70",
                activeTone.button
              )}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? loadingText || confirmText : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================
   MAP HELPERS
========================= */
const MapController = ({ zoomAction }: { zoomAction: 'in' | 'out' }) => {
  const map = useMap();

  const handleZoom = () => {
    if (zoomAction === 'in') map.zoomIn();
    else map.zoomOut();
  };

  return (
    <button
      onClick={handleZoom}
      className="p-2 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50 text-slate-600 transition"
    >
      {zoomAction === 'in' ? <Plus size={20} /> : <Minus size={20} />}
    </button>
  );
};

const FlyToLocation = ({ position }: { position: [number, number] }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.5 });
    }
  }, [position, map]);

  return null;
};

const MapViewportTracker = ({
  onBoundsChange
}: {
  onBoundsChange: (bounds: L.LatLngBounds) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const updateViewport = () => {
      onBoundsChange(map.getBounds());
    };

    updateViewport();

    map.on("moveend", updateViewport);
    map.on("zoomend", updateViewport);

    return () => {
      map.off("moveend", updateViewport);
      map.off("zoomend", updateViewport);
    };
  }, [map, onBoundsChange]);

  return null;
};

const getMarkerIcon = (type: string, status: string) => {
  const isRescuing = status === "rescuing";

  if (type === "rescue") {
    return isRescuing
      ? createRescuingIcon("#ef4444", "!")
      : createPinIcon("#ef4444", "!");
  }

  if (type === "supplies") {
    return isRescuing
      ? createRescuingIcon("#f59e0b", "📦")
      : createPinIcon("#f59e0b", "📦");
  }

  if (type === "vehicle") {
    return isRescuing
      ? createRescuingIcon("#3b82f6", "🚗")
      : createPinIcon("#3b82f6", "🚗");
  }

  return isRescuing
    ? createRescuingIcon("#6b7280", "?")
    : createPinIcon("#6b7280", "?");
};

const AnimatedDots = () => {
  return (
    <>
      <style>
        {`
          @keyframes statusDotsPulse {
            0%, 80%, 100% {
              opacity: 0.25;
              transform: translateY(0);
            }
            40% {
              opacity: 1;
              transform: translateY(-1px);
            }
          }
        `}
      </style>

      <span className="inline-flex items-center gap-1 ml-1">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          style={{ animation: 'statusDotsPulse 1.2s infinite ease-in-out' }}
        />
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          style={{ animation: 'statusDotsPulse 1.2s infinite ease-in-out 0.2s' }}
        />
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          style={{ animation: 'statusDotsPulse 1.2s infinite ease-in-out 0.4s' }}
        />
      </span>
    </>
  );
};

const AnimatedRescueLineStyle = () => {
  return (
    <style>
      {`
        @keyframes rescueDashMove {
          to {
            stroke-dashoffset: -16;
          }
        }

        .rescue-route-base {
          stroke: #93c5fd;
          stroke-width: 8;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: 0.35;
        }

        .rescue-route-animated {
          stroke: #2563eb;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 10 10;
          animation: rescueDashMove 0.9s linear infinite;
        }
      `}
    </style>
  );
};


const StatusBadge = ({ status }: { status: string }) => {
  const isActiveStatus = status === "new" || status === "rescuing";

  return (
    <div
      className={`inline-flex items-center justify-center h-full min-h-[52px] px-3 py-1.5 rounded-full border font-semibold text-xs ${getStatusClass(status)}`}
    >
      <span>{getStatusLabel(status)}</span>
      {isActiveStatus && <AnimatedDots />}
    </div>
  );
};

const SelectLocationOnMap = ({
  onSelect,
  onInvalidSelect
}: {
  onSelect: (lat: number, lng: number) => void;
  onInvalidSelect: () => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const handleClick = (e: any) => {
      const { lat, lng } = e.latlng;

      if (!isInVietnam(lat, lng)) {
        onInvalidSelect();
        return;
      }

      onSelect(lat, lng);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, onSelect, onInvalidSelect]);

  return null;
};


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

      if (typeof createLayer !== 'function') {
        console.error('mapboxGL function không khả dụng - kiểm tra mapbox-gl-leaflet');
        return;
      }

      if (!layerRef.current) {
        layerRef.current = createLayer({
          style: styleUrl,
          accessToken: GOONG_API_KEY,
          mapboxgl,
          attribution: '&copy; GOONG Map'
        });
      }

      if (!map.hasLayer(layerRef.current)) {
        layerRef.current.addTo(map);
      }
    } catch (error) {
      console.error('Error adding Goong layer:', error);
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
   MAIN COMPONENT
========================= */
const MapDashboard: React.FC = () => {
  const { setAuthMode, setOpenLogin } = useAuthModal();
  const [mapType, setMapType] = useState<'default' | 'satellite'>('default');
  const [sosType, setSosType] = useState<"rescue" | "supplies" | "vehicle" | "other" | "">("");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSOSForm, setShowSOSForm] = useState(false);

  const [selectingOnMap, setSelectingOnMap] = useState(false);
  const [tempLocation, setTempLocation] = useState<[number, number] | null>(null);
  const [flyToUser, setFlyToUser] = useState<[number, number] | null>(null);

  const [confirmPopup, setConfirmPopup] = useState(false);
  const [locationMode, setLocationMode] = useState<"address" | "coords">("address");

  const [markers, setMarkers] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  const [images, setImages] = useState<File[]>([]);
  const [selectedSOS, setSelectedSOS] = useState<any | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [returnToDetailAfterUpdate, setReturnToDetailAfterUpdate] = useState(false);

  const [editImages, setEditImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [editSosType, setEditSosType] = useState<
    "rescue" | "supplies" | "vehicle" | "other" | ""
  >("");
  const [editLocationMode, setEditLocationMode] = useState<"address" | "coords">("address");
  const [editProvinces, setEditProvinces] = useState<Province[]>([]);
  const [editWards, setEditWards] = useState<Ward[]>([]);
  const [editSelectedProvinceCode, setEditSelectedProvinceCode] = useState<string>("");
  const [editSelectedWardCode, setEditSelectedWardCode] = useState<string>("");
  const [editAddressDetail, setEditAddressDetail] = useState("");
  const [editLoadingWards, setEditLoadingWards] = useState(false);
  const [editIsGettingGPS, setEditIsGettingGPS] = useState(false);
  const [editIsFindingAddress, setEditIsFindingAddress] = useState(false);
  const [editIsFindingCoords, setEditIsFindingCoords] = useState(false);
  const [editMapPosition, setEditMapPosition] = useState<[number, number]>([16.047079, 108.20623]);
  const [initialEditSnapshot, setInitialEditSnapshot] = useState("");
  const [showConfirmCloseUpdateModal, setShowConfirmCloseUpdateModal] = useState(false);
  const [editSnapshotReady, setEditSnapshotReady] = useState(false);
  const didInitUpdateFormRef = useRef(false);
  const didInitReverseRef = useRef(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    coords: "",
    lat: 0,
    lng: 0,
    victims: 1,
    note: "",
    source_url: "",
  });

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>("");
  const [selectedWardCode, setSelectedWardCode] = useState<string>("");

  const [addressDetail, setAddressDetail] = useState("");
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const [isGettingGPS, setIsGettingGPS] = useState(false);
  const [isFindingAddress, setIsFindingAddress] = useState(false);

  const [confirmCloseForm, setConfirmCloseForm] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "rescuing">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "rescue" | "supplies" | "vehicle" | "other">("all");
  const [showMySOSOnly, setShowMySOSOnly] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: 3000
  });
  const toastIdRef = useRef(0);

  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    coords: "",
    lat: 0,
    lng: 0,
    victims: 1,
    note: "",
    source_url: ""
  });

  const showToast = (
    message: string,
    type: ToastType = "info",
    duration: number = 3000
  ) => {
    toastIdRef.current += 1;

    setToast({
      id: toastIdRef.current,
      show: true,
      message,
      type,
      duration,
    });
  };

  const closeToast = () => {
    setToast((prev) => ({
      ...prev,
      show: false
    }));
  };

  useEffect(() => {
    setEditProvinces(provinces);
  }, [provinces]);

  useEffect(() => {
    if (!selectedSOS || showUpdateModal) return;
    const latest = markers.find((m) => m.id === selectedSOS.id);
    if (latest) setSelectedSOS(latest);
  }, [markers, selectedSOS?.id, showUpdateModal]);

  const buildEditFullAddress = () => {
    const province = editProvinces.find((p) => String(p.code) === editSelectedProvinceCode);
    const ward = editWards.find((w) => String(w.code) === editSelectedWardCode);

    const parts = [
      editAddressDetail.trim(),
      ward ? normalizeWardLabel(ward.name) : "",
      province ? normalizeProvinceLabel(province.name) : "",
    ].filter(Boolean);

    return parts.join(", ");
  };

  const buildEditSnapshot = () => {
    return JSON.stringify({
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      address: editForm.address.trim(),
      coords: editForm.coords.trim(),
      lat: Number(editForm.lat) || 0,
      lng: Number(editForm.lng) || 0,
      victims: Number(editForm.victims) || 1,
      note: editForm.note.trim(),
      source_url: editForm.source_url.trim(),
      sos_type: editSosType || "",
      locationMode: editLocationMode,
      provinceCode: editSelectedProvinceCode || "",
      wardCode: editSelectedWardCode || "",
      addressDetail: editAddressDetail.trim(),
      existingImages: [...existingImages].sort(),
      newImages: editImages.map((f) => `${f.name}_${f.size}_${f.lastModified}`).sort(),
    });
  };

  const isEditFormDirty = () => {
    if (!initialEditSnapshot) return false;
    return buildEditSnapshot() !== initialEditSnapshot;
  };

  const handleCloseUpdateModal = () => {
    if (updating) return;

    if (isEditFormDirty()) {
      setShowConfirmCloseUpdateModal(true);
    } else {
      setShowUpdateModal(false);

      if (returnToDetailAfterUpdate) {
        setShowDetailModal(true);
        setReturnToDetailAfterUpdate(false);
      }
    }
  };

  const handleEditInput = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "phone") {
      let newValue = value.replace(/\D/g, "");
      if (newValue.length === 1 && newValue !== "0") return;
      if (newValue.length > 10) return;
      setEditForm((prev) => ({ ...prev, phone: newValue }));
      return;
    }

    if (name === "victims") {
      const num = Math.max(1, Number(value) || 1);
      setEditForm((prev) => ({ ...prev, victims: num }));
      return;
    }

    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const fetchEditWardsByProvinceCode = async (provinceCode: string) => {
    const res = await fetch(`https://provinces.open-api.vn/api/v2/p/${provinceCode}?depth=2`);
    const data = await res.json();
    return (data.wards || []).map((item: any) => ({
      code: item.code,
      name: item.name,
    })) as Ward[];
  };

  const fillEditAddressFromLatLng = async (lat: number, lng: number) => {
    const reverseRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const reverseData = await reverseRes.json();
    const addr = reverseData.address || {};

    const provinceName =
      addr.state ||
      addr.city ||
      addr.province ||
      addr.region ||
      addr.county ||
      addr.municipality ||
      "";

    const wardName =
      addr.suburb ||
      addr.city_district ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.town ||
      addr.village ||
      addr.hamlet ||
      "";

    const detail = buildAddressDetailFromReverse(addr) || reverseData.name || "";

    let matchedProvinceCode = "";
    let matchedWardCode = "";
    let fetchedWards: Ward[] = [];

    const matchedProvince = findProvinceByName(provinceName, editProvinces);

    if (matchedProvince) {
      matchedProvinceCode = String(matchedProvince.code);
      setEditSelectedProvinceCode(matchedProvinceCode);

      fetchedWards = await fetchEditWardsByProvinceCode(matchedProvinceCode);
      setEditWards(fetchedWards);

      const matchedWard = findWardByName(wardName, fetchedWards);
      if (matchedWard) {
        matchedWardCode = String(matchedWard.code);
        setEditSelectedWardCode(matchedWardCode);
      } else {
        setEditSelectedWardCode("");
      }
    } else {
      setEditSelectedProvinceCode("");
      setEditSelectedWardCode("");
      setEditWards([]);
    }

    setEditAddressDetail(detail);

    const finalProvince =
      matchedProvinceCode && matchedProvince
        ? normalizeProvinceLabel(matchedProvince.name)
        : "";

    const finalWard =
      matchedWardCode && fetchedWards.length
        ? normalizeWardLabel(
          fetchedWards.find((w) => String(w.code) === matchedWardCode)?.name || ""
        )
        : "";

    const finalAddress =
      [detail, finalWard, finalProvince].filter(Boolean).join(", ") ||
      reverseData.display_name ||
      "";

    setEditForm((prev) => ({
      ...prev,
      lat,
      lng,
      coords: `${lat},${lng}`,
      address: finalAddress,
    }));

    setEditMapPosition([lat, lng]);

    return finalAddress;
  };

  const getEditGPS = async () => {
    if (!editProvinces.length) {
      showToast("Danh sách tỉnh/thành đang tải, vui lòng thử lại sau.", "warning");
      return;
    }

    setEditIsGettingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          if (!isInVietnam(lat, lng)) {
            showToast("Vị trí phải nằm trong khu vực Việt Nam.", "warning");
            return;
          }

          await fillEditAddressFromLatLng(lat, lng);
          showToast("Đã lấy vị trí GPS.", "success");
        } catch (err) {
          console.error(err);

          setEditForm((prev) => ({
            ...prev,
            lat,
            lng,
            coords: `${lat},${lng}`,
            address: "",
          }));
          setEditMapPosition([lat, lng]);

          showToast("Không thể xác định địa chỉ từ GPS.", "error");
        } finally {
          setEditIsGettingGPS(false);
        }
      },
      () => {
        showToast("Không lấy được vị trí GPS.", "error");
        setEditIsGettingGPS(false);
      }
    );
  };

  const getEditCoordsFromAddress = async () => {
    const fullAddress = buildEditFullAddress();

    if (!editSelectedProvinceCode) {
      showToast("Vui lòng chọn tỉnh/thành.", "warning");
      return;
    }

    if (!editSelectedWardCode) {
      showToast("Vui lòng chọn phường/xã.", "warning");
      return;
    }

    if (!editAddressDetail.trim()) {
      showToast("Vui lòng nhập địa chỉ chi tiết.", "warning");
      return;
    }

    setEditIsFindingAddress(true);

    try {
      const queries = [
        fullAddress,
        `${fullAddress}, Việt Nam`,
        `${editAddressDetail}, ${fullAddress}, Việt Nam`,
      ];

      let found: any = null;

      for (const q of queries) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=vn&q=${encodeURIComponent(q)}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          found = data[0];
          break;
        }
      }

      if (!found) {
        showToast("Không tìm thấy địa chỉ. Vui lòng kiểm tra lại.", "warning");
        return;
      }

      const lat = parseFloat(found.lat);
      const lng = parseFloat(found.lon);

      setEditMapPosition([lat, lng]);
      setEditForm((prev) => ({
        ...prev,
        address: fullAddress,
        lat,
        lng,
        coords: `${lat},${lng}`,
      }));

      showToast("Đã xác định tọa độ từ địa chỉ.", "success");
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi tìm địa chỉ.", "error");
    } finally {
      setEditIsFindingAddress(false);
    }
  };

  const handleGetAddressFromCoords = async () => {
    const parsed = parseCoords(editForm.coords);

    if (!parsed) {
      showToast("Sai tọa độ. Vui lòng nhập đúng định dạng lat, lng.", "warning");
      return;
    }

    if (!isInVietnam(parsed.lat, parsed.lng)) {
      showToast("Vị trí nằm ngoài phạm vi hỗ trợ tại Việt Nam.", "warning");
      return;
    }

    if (!editProvinces.length) {
      showToast("Danh sách tỉnh/thành đang tải, vui lòng thử lại sau.", "warning");
      return;
    }

    setEditIsFindingCoords(true);

    try {
      await fillEditAddressFromLatLng(parsed.lat, parsed.lng);
      showToast("Đã xác định địa chỉ từ tọa độ.", "success");
    } catch (err) {
      console.error("Lỗi khi tìm địa chỉ từ tọa độ:", err);

      setEditForm((prev) => ({
        ...prev,
        lat: parsed.lat,
        lng: parsed.lng,
        coords: `${parsed.lat},${parsed.lng}`,
      }));
      setEditMapPosition([parsed.lat, parsed.lng]);

      showToast("Không thể lấy địa chỉ từ tọa độ.", "error");
    } finally {
      setEditIsFindingCoords(false);
    }
  };

  const handleUpdateRescue = async () => {
    if (!selectedSOS) return;

    if (Number(selectedSOS.user_id) !== Number(currentUserId)) {
      showToast("Bạn chỉ có thể cập nhật yêu cầu do chính mình tạo.", "warning");
      return;
    }

    const token = localStorage.getItem("token") || "";
    const phoneRegex = /^(0|\+84)[0-9]{9}$/;

    if (!editForm.name.trim()) {
      showToast("Vui lòng nhập họ và tên.", "warning");
      return;
    }

    if (!editForm.phone.trim()) {
      showToast("Vui lòng nhập số điện thoại.", "warning");
      return;
    }

    if (!phoneRegex.test(editForm.phone)) {
      showToast("Số điện thoại không hợp lệ.", "warning");
      return;
    }

    if (editForm.victims < 1) {
      showToast("Số người cần hỗ trợ phải lớn hơn hoặc bằng 1.", "warning");
      return;
    }

    try {
      setUpdating(true);

      const formData = new FormData();
      let lat = editForm.lat;
      let lng = editForm.lng;
      let finalAddress = editForm.address;

      if (editLocationMode === "address") {
        if (!editSelectedProvinceCode) {
          showToast("Vui lòng chọn tỉnh/thành.", "warning");
          return;
        }

        if (!editSelectedWardCode) {
          showToast("Vui lòng chọn phường/xã.", "warning");
          return;
        }

        if (!editAddressDetail.trim()) {
          showToast("Vui lòng nhập địa chỉ chi tiết.", "warning");
          return;
        }

        if (!editForm.address.trim()) {
          showToast("Vui lòng xác định từ địa chỉ trước khi cập nhật.", "warning");
          return;
        }
      }

      if (editLocationMode === "coords") {
        const parsed = parseCoords(editForm.coords);

        if (!parsed) {
          showToast("Tọa độ không hợp lệ.", "warning");
          return;
        }

        lat = parsed.lat;
        lng = parsed.lng;
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showToast("Vị trí không hợp lệ.", "warning");
        return;
      }

      if (!isInVietnam(lat, lng)) {
        showToast(getVietnamSupportMessage(), "warning");
        return;
      }

      if (!editSosType) {
        showToast("Vui lòng chọn loại yêu cầu.", "warning");
        return;
      }

      if (!finalAddress?.trim()) {
        finalAddress = buildEditFullAddress() || selectedSOS.address || "";
      }

      formData.append("name", editForm.name);
      formData.append("phone", editForm.phone);
      formData.append("address", finalAddress);
      formData.append("lat", String(lat));
      formData.append("lng", String(lng));
      formData.append("victims", String(editForm.victims));
      formData.append("note", editForm.note);
      formData.append("source_url", editForm.source_url);
      formData.append("sos_type", editSosType);
      formData.append("existingImages", JSON.stringify(existingImages));

      editImages.forEach((img) => {
        formData.append("images", img);
      });

      const res = await fetch(`${API_BASE}/api/rescues/${selectedSOS.id}`, {
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

      const refreshed = await fetch(`${API_BASE}/api/rescues`);
      const refreshedData = await refreshed.json().catch(() => []);

      if (Array.isArray(refreshedData)) {
        setMarkers(refreshedData);
        const updatedItem = refreshedData.find((item: any) => item.id === selectedSOS.id);
        if (updatedItem) {
          setSelectedSOS(updatedItem);
        }
      }

      setShowUpdateModal(false);
      setInitialEditSnapshot("");

      if (returnToDetailAfterUpdate) {
        setShowDetailModal(true);
        setReturnToDetailAfterUpdate(false);
      }

      showToast("Cập nhật yêu cầu thành công.", "success");
    } catch (err) {
      console.error(err);
      showToast("Không thể kết nối server.", "error");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    const fullAddress = buildEditFullAddress();

    setEditForm((prev) => ({
      ...prev,
      address: fullAddress,
    }));
  }, [
    editAddressDetail,
    editSelectedProvinceCode,
    editSelectedWardCode,
    editProvinces,
    editWards,
  ]);

  useEffect(() => {
    const fetchWards = async () => {
      if (!editSelectedProvinceCode) {
        setEditWards([]);
        setEditSelectedWardCode("");
        return;
      }

      try {
        setEditLoadingWards(true);
        const res = await fetch(
          `https://provinces.open-api.vn/api/v2/p/${editSelectedProvinceCode}?depth=2`
        );
        const data = await res.json();

        setEditWards(
          (data.wards || []).map((item: any) => ({
            code: item.code,
            name: item.name,
          }))
        );
      } catch (err) {
        console.error("Không tải được danh sách phường/xã", err);
        setEditWards([]);
        showToast("Không tải được danh sách phường/xã.", "error");
      } finally {
        setEditLoadingWards(false);
      }
    };

    fetchWards();
  }, [editSelectedProvinceCode]);

  useEffect(() => {
    if (!showUpdateModal || !selectedSOS || didInitUpdateFormRef.current) return;

    const lat = Number(selectedSOS.lat);
    const lng = Number(selectedSOS.lng);
    const parsedExistingImages = parseImages(selectedSOS.images);

    setEditSosType(selectedSOS.sos_type || "");
    setEditLocationMode("address");

    setEditSelectedProvinceCode("");
    setEditSelectedWardCode("");
    setEditAddressDetail("");
    setEditWards([]);

    setEditForm({
      name: selectedSOS.name || "",
      phone: selectedSOS.phone || "",
      address: selectedSOS.address || "",
      coords:
        Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : "",
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
      victims: selectedSOS.victims || 1,
      note: selectedSOS.note || "",
      source_url: selectedSOS.source_url || "",
    });

    setEditMapPosition(
      Number.isFinite(lat) && Number.isFinite(lng)
        ? [lat, lng]
        : [16.047079, 108.20623]
    );

    setEditImages([]);
    setExistingImages(parsedExistingImages);
    setShowConfirmCloseUpdateModal(false);
    setInitialEditSnapshot("");
    setEditSnapshotReady(false);

    didInitUpdateFormRef.current = true;
  }, [showUpdateModal, selectedSOS?.id]);

  useEffect(() => {
    if (
      !showUpdateModal ||
      !selectedSOS ||
      !editProvinces.length ||
      didInitReverseRef.current
    ) {
      return;
    }

    const lat = Number(selectedSOS.lat);
    const lng = Number(selectedSOS.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setEditSnapshotReady(true);
      didInitReverseRef.current = true;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await fillEditAddressFromLatLng(lat, lng);

        if (!cancelled) {
          setEditSnapshotReady(true);
          didInitReverseRef.current = true;
        }
      } catch (err) {
        console.error("Không tự fill được địa chỉ từ tọa độ:", err);

        if (!cancelled) {
          setEditSnapshotReady(true);
          didInitReverseRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showUpdateModal, selectedSOS?.id, editProvinces.length]);

  useEffect(() => {
    if (!showUpdateModal) {
      didInitUpdateFormRef.current = false;
      didInitReverseRef.current = false;
      setEditSnapshotReady(false);
      setInitialEditSnapshot("");
    }
  }, [showUpdateModal]);

  useEffect(() => {
    if (!showUpdateModal || !editSnapshotReady || initialEditSnapshot) return;

    const timer = setTimeout(() => {
      setInitialEditSnapshot(buildEditSnapshot());
    }, 0);

    return () => clearTimeout(timer);
  }, [showUpdateModal, editSnapshotReady, initialEditSnapshot]);


  useEffect(() => {
    if (!toast.show) return;

    const timer = setTimeout(() => {
      closeToast();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.show, toast.duration]);

  const handleBoundsChange = React.useCallback((bounds: L.LatLngBounds) => {
    setMapBounds((prev) => {
      if (
        prev &&
        prev.getSouth() === bounds.getSouth() &&
        prev.getWest() === bounds.getWest() &&
        prev.getNorth() === bounds.getNorth() &&
        prev.getEast() === bounds.getEast()
      ) {
        return prev;
      }

      return bounds;
    });
  }, []);

  const currentUserId = Number(localStorage.getItem("userId"));
  const currentUserRole = localStorage.getItem("role") || "";
  const isSelectedSOSOwner =
    !!selectedSOS && Number(selectedSOS.user_id) === Number(currentUserId);

  const updateUserLocation = async (lat: number, lng: number) => {
    try {
      if (currentUserRole !== "user") return;

      const token = localStorage.getItem("token");
      if (!token) return;

      await fetch("http://localhost:3000/api/user/location", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat, lng }),
      });
    } catch (err) {
      console.error("Cập nhật vị trí người dân thất bại:", err);
    }
  };

  const activeMarkers = markers.filter((m) => {
    return m.status !== "cancel" && m.status !== "done";
  });

  const filteredMarkersForList = activeMarkers.filter((m) => {
    const keyword = searchKeyword.trim().toLowerCase();

    const matchKeyword =
      !keyword ||
      (m.name || "").toLowerCase().includes(keyword) ||
      (m.phone || "").toLowerCase().includes(keyword) ||
      (m.address || "").toLowerCase().includes(keyword);

    const matchStatus =
      statusFilter === "all" ? true : m.status === statusFilter;

    const matchType =
      typeFilter === "all" ? true : m.sos_type === typeFilter;

    const matchMine =
      !showMySOSOnly ? true : Number(m.user_id) === currentUserId;

    return matchKeyword && matchStatus && matchType && matchMine;
  });

  const filteredMarkers = !mapBounds
    ? filteredMarkersForList
    : filteredMarkersForList.filter((m) => {
      if (typeof m.lat !== "number" || typeof m.lng !== "number") {
        return false;
      }

      return mapBounds.contains(L.latLng(m.lat, m.lng));
    });

  const mapMarkers = activeMarkers.filter((m) => {
    const matchStatus =
      statusFilter === "all" ? true : m.status === statusFilter;

    const matchType =
      typeFilter === "all" ? true : m.sos_type === typeFilter;

    const matchMine =
      !showMySOSOnly ? true : Number(m.user_id) === currentUserId;

    return matchStatus && matchType && matchMine;
  });

  const fetchWardsByProvinceCode = async (provinceCode: string) => {
    const res = await fetch(
      `https://provinces.open-api.vn/api/v2/p/${provinceCode}?depth=2`
    );
    const data = await res.json();

    return (data.wards || []).map((item: any) => ({
      code: item.code,
      name: item.name
    })) as Ward[];
  };

  const myTrackedRescues = activeMarkers.filter((m) => {
    return (
      showMySOSOnly &&
      Number(m.user_id) === currentUserId &&
      m.status === "rescuing" &&
      Number.isFinite(Number(m.lat)) &&
      Number.isFinite(Number(m.lng)) &&
      Number.isFinite(Number(m.rescuer_lat)) &&
      Number.isFinite(Number(m.rescuer_lng))
    );
  });

  const trackedMarkerTypes = ["rescue", "supplies", "vehicle", "other"] as const;

  const [trackedMarkerIndex, setTrackedMarkerIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrackedMarkerIndex((prev) => (prev + 1) % trackedMarkerTypes.length);
    }, 2000); // 2 giây đổi 1 lần

    return () => clearInterval(interval);
  }, []);

  const getTrackedMarkerStyle = (type?: string) => {
    switch (type) {
      case "rescue":
        return { icon: "!", bgClass: "bg-red-500" };
      case "supplies":
        return { icon: "📦", bgClass: "bg-amber-500" };
      case "vehicle":
        return { icon: "🚗", bgClass: "bg-blue-500" };
      default:
        return { icon: "?", bgClass: "bg-slate-500" };
    }
  };

  const currentTrackedType = trackedMarkerTypes[trackedMarkerIndex];
  const trackedMarker = getTrackedMarkerStyle(currentTrackedType);

  const resetForm = () => {
    setForm({
      name: "",
      phone: "",
      address: "",
      coords: "",
      lat: 0,
      lng: 0,
      victims: 1,
      note: "",
      source_url: ""
    });

    setSosType("");
    setSelectedProvinceCode("");
    setSelectedWardCode("");
    setAddressDetail("");
    setWards([]);
  };

  const isFormDirty = () => {
    return (
      form.name.trim() !== "" ||
      form.phone.trim() !== "" ||
      form.address.trim() !== "" ||
      form.coords.trim() !== "" ||
      form.note.trim() !== "" ||
      form.source_url.trim() !== "" ||
      form.victims !== 1 ||
      images.length > 0 ||
      sosType !== "" ||
      selectedProvinceCode !== "" ||
      selectedWardCode !== "" ||
      addressDetail.trim() !== ""
    );
  };

  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        setLoadingProvinces(true);
        const res = await fetch("https://provinces.open-api.vn/api/v2/p/");
        const data = await res.json();

        setProvinces(
          (Array.isArray(data) ? data : []).map((item: any) => ({
            code: item.code,
            name: item.name
          }))
        );
      } catch (err) {
        console.error("Không tải được danh sách tỉnh/thành", err);
      } finally {
        setLoadingProvinces(false);
      }
    };

    fetchProvinces();
  }, []);

  const buildFullAddress = () => {
    const province = provinces.find(
      (p) => String(p.code) === selectedProvinceCode
    );
    const ward = wards.find((w) => String(w.code) === selectedWardCode);

    const parts = [
      addressDetail.trim(),
      ward ? normalizeWardLabel(ward.name) : "",
      province ? normalizeProvinceLabel(province.name) : ""
    ].filter(Boolean);

    return parts.join(", ");
  };

  useEffect(() => {
    const fullAddress = buildFullAddress();

    setForm((prev) => ({
      ...prev,
      address: fullAddress
    }));
  }, [addressDetail, selectedProvinceCode, selectedWardCode, provinces, wards]);

  useEffect(() => {
    const fetchWards = async () => {
      if (!selectedProvinceCode) {
        setWards([]);
        setSelectedWardCode("");
        return;
      }

      try {
        setLoadingWards(true);
        const res = await fetch(
          `https://provinces.open-api.vn/api/v2/p/${selectedProvinceCode}?depth=2`
        );
        const data = await res.json();

        setWards(
          (data.wards || []).map((item: any) => ({
            code: item.code,
            name: item.name
          }))
        );
      } catch (err) {
        console.error("Không tải được danh sách phường/xã", err);
        setWards([]);
      } finally {
        setLoadingWards(false);
      }
    };

    fetchWards();
  }, [selectedProvinceCode]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setUserLocation([lat, lng]);

        setForm((prev) => ({
          ...prev,
          lat,
          lng,
        }));

        await updateUserLocation(lat, lng);
      },
      (err) => {
        console.log("Không lấy được GPS:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }, []);

  useEffect(() => {
    const fetchSOS = async () => {
      try {
        const res = await fetch("http://localhost:3000/api/rescues");
        const data = await res.json();
        setMarkers(data);
      } catch (err) { }
    };

    fetchSOS();

    const interval = setInterval(fetchSOS, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleInput = (e: { target: { name: any; value: any; }; }) => {
    const { name, value } = e.target;

    // 👉 xử lý riêng cho phone
    if (name === "phone") {
      let newValue = value;

      // 1. chỉ cho số
      newValue = newValue.replace(/\D/g, "");

      // 2. bắt buộc bắt đầu bằng 0
      if (newValue.length === 1 && newValue !== "0") return;

      // 3. tối đa 10 số
      if (newValue.length > 10) return;

      setForm({ ...form, phone: newValue });
      newValue = newValue.replace(/\D/g, "").slice(0, 10);
      return;
    }

    // các field khác giữ nguyên
    setForm({ ...form, [name]: value });
  };

  const parseCoords = (text: string) => {
    const parts = text.trim().split(/[ ,]+/);

    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return { lat, lng };
    }

    return null;
  };

  const fillAddressFromLatLng = async (lat: number, lng: number) => {
    const reverseRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    const reverseData = await reverseRes.json();
    const addr = reverseData.address || {};

    const provinceName =
      addr.state ||
      addr.city ||
      addr.province ||
      addr.region ||
      addr.county ||
      addr.municipality ||
      "";

    const wardName =
      addr.suburb ||
      addr.city_district ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.town ||
      addr.village ||
      addr.hamlet ||
      "";

    const detail =
      buildAddressDetailFromReverse(addr) ||
      reverseData.name ||
      "";

    let matchedProvinceCode = "";
    let matchedWardCode = "";
    let fetchedWards: Ward[] = [];

    const matchedProvince = findProvinceByName(provinceName, provinces);

    if (matchedProvince) {
      matchedProvinceCode = String(matchedProvince.code);
      setSelectedProvinceCode(matchedProvinceCode);

      fetchedWards = await fetchWardsByProvinceCode(matchedProvinceCode);
      setWards(fetchedWards);

      const matchedWard = findWardByName(wardName, fetchedWards);
      if (matchedWard) {
        matchedWardCode = String(matchedWard.code);
        setSelectedWardCode(matchedWardCode);
      } else {
        setSelectedWardCode("");
      }
    } else {
      setSelectedProvinceCode("");
      setSelectedWardCode("");
      setWards([]);
    }

    setAddressDetail(detail);

    const finalProvince =
      matchedProvinceCode && matchedProvince
        ? normalizeProvinceLabel(matchedProvince.name)
        : "";

    const finalWard =
      matchedWardCode && fetchedWards.length
        ? normalizeWardLabel(
          fetchedWards.find((w) => String(w.code) === matchedWardCode)?.name || ""
        )
        : "";

    const finalAddress =
      [detail, finalWard, finalProvince].filter(Boolean).join(", ") ||
      reverseData.display_name ||
      "";

    setForm((prev) => ({
      ...prev,
      lat,
      lng,
      coords: `${lat},${lng}`,
      address: finalAddress
    }));

    return finalAddress;
  };

  const getGPS = async () => {
    if (!provinces.length) {
      showToast("Danh sách tỉnh/thành đang tải, vui lòng thử lại sau vài giây.", "warning");
      return;
    }

    setIsGettingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          setUserLocation([lat, lng]);

          setFlyToUser([lat, lng]);
          setTimeout(() => {
            setFlyToUser(null);
          }, 2000);

          setTempLocation([lat, lng]);

          await updateUserLocation(lat, lng);
          await fillAddressFromLatLng(lat, lng);
        } catch (err) {
          console.error("Lỗi khi reverse GPS:", err);

          setAddressDetail("");

          setForm((prev) => ({
            ...prev,
            lat,
            lng,
            coords: `${lat},${lng}`,
            address: ""
          }));

          showToast("Không thể xác định địa chỉ từ GPS. Vui lòng thử lại.", "error");
        } finally {
          setIsGettingGPS(false);
        }
      },
      (err) => {
        console.log("Không lấy được GPS:", err);
        showToast("Không lấy được vị trí GPS.", "error");
        setIsGettingGPS(false);
      }
    );
  };

  const flyToMyLocationOnly = () => {
    setIsGettingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setUserLocation([lat, lng]);
        setFlyToUser([lat, lng]);

        setTimeout(() => {
          setFlyToUser(null);
        }, 2000);

        setTempLocation(null);
        await updateUserLocation(lat, lng);
        setIsGettingGPS(false);
      },
      (err) => {
        console.log("Không lấy được GPS:", err);
        showToast("Không lấy được vị trí GPS.", "error");
        setIsGettingGPS(false);
      }
    );
  };

  const getCoordsFromAddress = async () => {
    const fullAddress = buildFullAddress();

    if (!selectedProvinceCode) {
      showToast("Vui lòng chọn tỉnh/thành.", "warning");
      return;
    }

    if (!selectedWardCode) {
      showToast("Vui lòng chọn phường/xã.", "warning");
      return;
    }

    if (!addressDetail.trim()) {
      showToast("Vui lòng nhập địa chỉ chi tiết.", "warning");
      return;
    }

    setIsFindingAddress(true);

    try {
      const queries = [
        fullAddress,
        `${fullAddress}, Việt Nam`,
        `${addressDetail}, ${fullAddress}, Việt Nam`
      ];

      let found: any = null;

      for (const q of queries) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=vn&q=${encodeURIComponent(q)}`,
          {
            headers: {
              Accept: "application/json"
            }
          }
        );

        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          found = data[0];
          break;
        }
      }

      if (!found) {
        showToast("Không tìm thấy địa chỉ. Vui lòng kiểm tra lại thông tin.", "warning");
        return;
      }

      const lat = parseFloat(found.lat);
      const lng = parseFloat(found.lon);

      setTempLocation([lat, lng]);
      setFlyToUser([lat, lng]);

      setTimeout(() => {
        setFlyToUser(null);
      }, 2000);

      setForm((prev) => ({
        ...prev,
        address: fullAddress,
        lat,
        lng,
        coords: `${lat},${lng}`
      }));

      showToast("Đã xác định vị trí từ địa chỉ thành công.", "success");
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi tìm địa chỉ.", "error");
    } finally {
      setIsFindingAddress(false);
    }
  };

  const submitSOS = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setAuthMode("login");
      setOpenLogin(true);
      return;
    }

    if (!sosType) {
      showToast("Vui lòng chọn loại yêu cầu SOS.", "warning");
      return;
    }

    if (!form.name.trim()) {
      showToast("Vui lòng nhập họ và tên.", "warning");
      return;
    }

    if (!form.phone.trim()) {
      showToast("Vui lòng nhập số điện thoại.", "warning");
      return;
    }

    const phoneRegex = /^(0|\+84)[0-9]{9}$/;

    if (!phoneRegex.test(form.phone)) {
      showToast("Số điện thoại không hợp lệ.", "warning");
      return;
    }

    if (locationMode === "address") {
      if (!selectedProvinceCode) {
        showToast("Vui lòng chọn tỉnh/thành.", "warning");
        return;
      }

      if (!selectedWardCode) {
        showToast("Vui lòng chọn phường/xã.", "warning");
        return;
      }

      if (!addressDetail.trim()) {
        showToast("Vui lòng nhập địa chỉ chi tiết.", "warning");
        return;
      }

      if (!form.address.trim()) {
        showToast("Vui lòng xác định từ địa chỉ trước khi gửi.", "warning");
        return;
      }
    }

    if (locationMode === "coords" && !form.coords.trim()) {
      showToast("Vui lòng nhập tọa độ.", "warning");
      return;
    }

    let lat = form.lat;
    let lng = form.lng;

    if (locationMode === "coords") {
      const parsed = parseCoords(form.coords);

      if (!parsed) {
        showToast("Tọa độ không hợp lệ.", "warning");
        return;
      }

      lat = parsed.lat;
      lng = parsed.lng;
    }

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      showToast("Tọa độ không hợp lệ.", "warning");
      return;
    }

    if (!isInVietnam(lat, lng)) {
      showToast(getVietnamSupportMessage(), "warning");
      return;
    }

    if (form.victims < 1) {
      showToast("Số người phải lớn hơn hoặc bằng 1.", "warning");
      return;
    }

    try {
      const formData = new FormData();

      formData.append("name", form.name);
      formData.append("phone", form.phone);
      formData.append("address", form.address);
      formData.append("lat", String(lat));
      formData.append("lng", String(lng));
      formData.append("victims", String(form.victims));
      formData.append("note", form.note);
      formData.append("source_url", form.source_url);

      const finalType = ["rescue", "supplies", "vehicle", "other"].includes(sosType)
        ? sosType
        : "other";

      formData.append("sos_type", finalType);

      images.forEach((img) => {
        formData.append("images", img);
      });

      const res = await fetch("http://localhost:3000/api/rescues", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error(data);

        const code = data?.code;
        const message = data?.message || "Gửi yêu cầu thất bại.";

        // Khóa tạm thời: KHÔNG đăng xuất, hiện cảnh báo
        if (code === "ACCOUNT_TEMPORARY_LOCKED" || res.status === 423) {
          showToast(message, "warning");
          return;
        }

        // Tài khoản bị khóa hẳn: đăng xuất
        if (code === "ACCOUNT_INACTIVE") {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          localStorage.removeItem("role");
          localStorage.removeItem("userId");

          showToast(message || "Tài khoản đã bị khóa. Vui lòng đăng nhập lại.", "error");
          return;
        }

        // Token hết hạn / sai token
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          localStorage.removeItem("role");
          localStorage.removeItem("userId");

          showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "warning");
          return;
        }

        showToast(message, "error");
        return;
      }

      setMarkers((prev) => [
        ...prev,
        {
          lat,
          lng,
          name: form.name,
          phone: form.phone,
          victims: form.victims,
          status: "new",
          sos_type: finalType,
          address: form.address,
          note: form.note,
          source_url: form.source_url
        }
      ]);

      resetForm();
      setImages([]);
      setTempLocation(null);
      setSelectingOnMap(false);
      setConfirmPopup(false);
      setShowSOSForm(false);

      showToast("Gửi yêu cầu SOS thành công. Đội cứu hộ sẽ liên hệ sớm nhất.", "success");
    } catch (error) {
      showToast("Không thể kết nối server.", "error");
    }
  };

  const askCancelSOS = (id: number) => {
    const token = localStorage.getItem("token");

    if (!token) {
      showToast("Bạn cần đăng nhập.", "warning");
      return;
    }

    const target = markers.find((m) => Number(m.id) === Number(id));
    if (target && Number(target.user_id) !== Number(currentUserId)) {
      showToast("Bạn chỉ có thể hủy yêu cầu do chính mình tạo.", "warning");
      return;
    }

    setCancelTargetId(id);
  };

  const confirmCancelSOS = async () => {
    if (cancelTargetId === null) return;

    const token = localStorage.getItem("token");

    if (!token) {
      showToast("Bạn cần đăng nhập.", "warning");
      setCancelTargetId(null);
      return;
    }

    try {
      setIsCancelling(true);

      const res = await fetch(`http://localhost:3000/api/rescues/${cancelTargetId}/cancel`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || "Hủy thất bại.", "error");
        return;
      }

      setMarkers((prev) => prev.filter((m) => m.id !== cancelTargetId));
      setSelectedSOS(null);
      setShowDetailModal(false);
      setCancelTargetId(null);

      showToast("Đã hủy yêu cầu SOS.", "success");
    } catch (err) {
      showToast("Lỗi server.", "error");
    } finally {
      setIsCancelling(false);
    }
  };

  const cancelTargetItem =
    cancelTargetId !== null
      ? markers.find((m) => Number(m.id) === Number(cancelTargetId))
      : null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <NotificationToast toast={toast} onClose={closeToast} />

      <ConfirmActionModal
        open={cancelTargetId !== null}
        item={cancelTargetItem}
        tone="red"
        title="Xác nhận hủy yêu cầu"
        description="Yêu cầu SOS sẽ bị hủy và không tiếp tục xử lý cứu hộ."
        message="Bạn có chắc muốn hủy yêu cầu cứu hộ này không?"
        confirmText="Xác nhận hủy"
        loadingText="Đang hủy..."
        cancelText="Quay lại"
        onConfirm={confirmCancelSOS}
        onCancel={() => {
          if (!isCancelling) setCancelTargetId(null);
        }}
        loading={isCancelling}
      />

      <ConfirmActionModal
        open={confirmCloseForm}
        tone="slate"
        title="Xác nhận đóng form"
        description="Thông tin đã nhập sẽ không được lưu nếu bạn đóng form."
        message="Bạn có chắc muốn đóng form? Tất cả thông tin đã nhập sẽ bị mất."
        confirmText="Xác nhận đóng"
        cancelText="Quay lại"
        onConfirm={() => {
          resetForm();
          setImages([]);
          setTempLocation(null);
          setSelectingOnMap(false);

          setShowSOSForm(false);
          setConfirmCloseForm(false);
        }}
        onCancel={() => setConfirmCloseForm(false)}
      />
      <Navbar />

      <main className="flex-1 relative mt-16 flex">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-[1100] p-2 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50"
          >
            <Menu size={22} />
          </button>
        )}

        {/* SIDEBAR */}
        <aside
          className={`absolute top-4 left-4 z-[1000] w-[420px] bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-slate-200 flex flex-col max-h-[calc(100%-32px)] overflow-hidden transition-all duration-300
          ${isSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-[120%] opacity-0"}`}
        >
          <div className="p-5 border-b border-slate-100 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Danh sách điểm SOS
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Theo dõi và điều phối cứu hộ thời gian thực
              </p>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/70">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo tên, SĐT, địa chỉ..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "new" | "rescuing")}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="new">Đang chờ cứu hộ</option>
                <option value="rescuing">Đang được cứu hộ</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">Tất cả loại SOS</option>
                <option value="rescue">Cần cứu hộ</option>
                <option value="supplies">Cần nhu yếu phẩm</option>
                <option value="vehicle">Cần cứu hộ xe</option>
                <option value="other">Yêu cầu khác</option>
              </select>
            </div>

            <button
              onClick={() => {
                setShowMySOSOnly((prev) => !prev);
              }}
              className={`w-full py-2.5 rounded-xl border text-sm font-semibold transition ${showMySOSOnly
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              {showMySOSOnly ? "Đang xem: Yêu cầu của tôi" : "Xem yêu cầu của tôi đã gửi"}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Tổng hiển thị:</span>
              <span className="font-bold text-slate-700">{filteredMarkers.length} yêu cầu</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredMarkers.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500">
                {showMySOSOnly
                  ? 'Bạn chưa gửi yêu cầu nào'
                  : 'Không có yêu cầu SOS phù hợp'}
              </div>
            ) : (
              filteredMarkers.map((m, idx) => {
                const isActive = selectedSOS?.id === m.id;

                return (
                  <button
                    key={m.id || idx}
                    onClick={() => {
                      setSelectedSOS(m);
                      setShowDetailModal(true);
                      setFlyToUser([m.lat, m.lng]);
                      setTimeout(() => setFlyToUser(null), 1500);
                    }}
                    className={`w-full text-left rounded-2xl border p-4 shadow-sm transition-all
                    ${isActive
                        ? "border-blue-400 bg-blue-50 shadow-md"
                        : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md hover:bg-slate-50"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-bold text-slate-800 truncate">
                            {m.name || "Ẩn danh"}
                          </div>

                          <div className={`inline-flex items-center text-[10px] px-2 py-1 rounded-full border font-semibold ${getStatusClass(m.status)}`}>
                            <span>{getStatusLabel(m.status)}</span>
                            {(m.status === 'new' || m.status === 'rescuing')}
                          </div>                        </div>

                        <div className="text-xs text-slate-500">
                          {m.phone || "Không có số điện thoại"}
                        </div>
                      </div>

                      <div className="shrink-0 text-[10px] font-medium text-slate-400">
                        {m.created_at ? timeAgo(m.created_at) : ""}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <img src={peopleIcon} alt="victims" className="w-4 h-4" />
                        <span className="font-medium text-slate-700">{m.victims || 1} người</span>
                      </div>

                      <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <img src={sos2Icon} alt="type" className="w-4 h-4" />
                        <span className="font-medium text-slate-700">{getTypeLabel(m.sos_type)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-start gap-2 text-xs text-slate-600 leading-snug">
                      <img src={addressIcon} alt="address" className="w-4 h-4 mt-0.5" />
                      <span>{truncateText(m.address, 65)}</span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        Nhấn để xem chi tiết
                      </span>

                      <span className="text-xs font-semibold text-blue-600">
                        Mở
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* MAP */}
        <div className="flex-1 relative z-10">
          <MapContainer
            center={userLocation || [16.047079, 108.206230]}
            zoom={userLocation ? 15 : 5}
            zoomControl={false}
            attributionControl={false}
            className="h-full w-full"
            minZoom={5}
            maxZoom={18}
            maxBounds={[
              [7.0, 101.0],
              [24.5, 110.5]
            ]}
            maxBoundsViscosity={1.0}
          >
            {!userLocation && (
              <div className="absolute inset-0 z-[2000] bg-black/40 flex items-center justify-center">
                <div className="bg-white px-6 py-3 rounded-lg shadow text-sm font-medium">
                  📍Đang lấy vị trí của bạn...
                </div>
              </div>
            )}

            {selectingOnMap && (
              <SelectLocationOnMap
                onSelect={(lat, lng) => {
                  setTempLocation([lat, lng]);
                  setConfirmPopup(true);
                }}
                onInvalidSelect={() => {
                  showToast(getVietnamSupportMessage(), "warning");
                }}
              />
            )}

            {flyToUser && <FlyToLocation position={flyToUser} />}
            {tempLocation && <FlyToLocation position={tempLocation} />}
            <MapViewportTracker onBoundsChange={handleBoundsChange} />

            <AnimatedRescueLineStyle />

            {tempLocation && (
              <Marker position={tempLocation} icon={redSelectIcon}>
                <Popup>📍Vị trí đã chọn</Popup>
              </Marker>
            )}

            {mapType === 'default' ? (
              <GoongStyleLayer enabled />
            ) : (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri"
              />
            )}

            {mapType === 'satellite' && (
              <TileLayer
                url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri &mdash; World Boundaries and Places"
              />
            )}

            {userLocation && (
              <Marker position={userLocation} icon={userBlueDot}>
                <Popup>📍Vị trí hiện tại của bạn</Popup>
              </Marker>
            )}

            {mapMarkers.map((m, index) => (
              <Marker
                key={m.id || index}
                position={[m.lat, m.lng]}
                icon={getMarkerIcon(m.sos_type, m.status)}
              >
                <Popup closeButton={false}>
                  <div className="text-sm w-[240px] font-sans">
                    <div
                      className={`relative text-white text-xs font-bold px-3 py-2 rounded-t-lg text-center ${m.sos_type === "rescue"
                        ? "bg-red-600"
                        : m.sos_type === "supplies"
                          ? "bg-yellow-500"
                          : m.sos_type === "vehicle"
                            ? "bg-blue-600"
                            : "bg-gray-600"
                        }`}
                    >
                      {sosLabels[m.sos_type] || (
                        <div className="flex items-center gap-1 justify-center">
                          <img src={sosIcon} alt="SOS" className="w-4 h-4" />
                          <span>SOS KHẨN</span>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          (e.target as HTMLElement).closest(".leaflet-popup")?.remove();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:text-gray-200 text-sm"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="border border-t-0 rounded-b-lg p-3 space-y-2 bg-white">
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex gap-1 items-center">
                          <span className="font-medium text-slate-500">Tên:</span>
                          <span className="font-semibold text-base">{m.name}</span>
                        </div>

                        <div className="flex gap-1 items-center">
                          <span className="font-medium text-slate-500">Sđt:</span>
                          <span className="font-medium text-blue-600">{m.phone}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-red-50 text-red-600 rounded p-2 flex items-center justify-center gap-1 text-center">
                          <img src={peopleIcon} alt="Người" className="w-4 h-4" />
                          <span>{m.victims || 1} người</span>
                        </div>

                        <div className="bg-gray-100 rounded p-2 flex items-center justify-center gap-1 text-center">
                          <img src={timeIcon} alt="Thời gian" className="w-4 h-4" />
                          <span>{timeAgo(m.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center text-xs text-slate-600 leading-snug gap-1">
                        <img src={addressIcon} alt="Map Pin" className="w-4 h-4" />
                        <span>{m.address || "Không có địa chỉ"}</span>
                      </div>

                      <div className="border-t border-slate-200 my-2"></div>
                      <div
                        className={`inline-flex items-center text-xs font-bold ${m.status === "done"
                          ? "text-emerald-600"
                          : m.status === "rescuing"
                            ? "text-blue-600"
                            : m.status === "new"
                              ? "text-amber-500"
                              : "text-slate-500"
                          }`}
                      >
                        <span>{getStatusLabel(m.status)}</span>
                        {(m.status === "new" || m.status === "rescuing") && <AnimatedDots />}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedSOS(m);
                          setShowDetailModal(true);
                          setFlyToUser([m.lat, m.lng]);
                          setTimeout(() => setFlyToUser(null), 1500);
                        }}
                        className="w-full mt-2 bg-gray-100 hover:bg-gray-200 py-2 rounded-md text-xs font-semibold shadow"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {myTrackedRescues.map((m) => {
              const rescuePos: [number, number] = [
                Number(m.rescuer_lat),
                Number(m.rescuer_lng)
              ];

              const sosPos: [number, number] = [
                Number(m.lat),
                Number(m.lng)
              ];

              const trackingInfo = getRescueTrackingInfo(m);

              const midLat = (rescuePos[0] + sosPos[0]) / 2;
              const midLng = (rescuePos[1] + sosPos[1]) / 2;

              const upperLabelPos: [number, number] = [midLat + 0.001, midLng];
              const lowerLabelPos: [number, number] = [midLat - 0.001, midLng];

              return (
                <React.Fragment key={`track-${m.id}`}>
                  <Marker position={rescuePos} icon={rescueTeamIcon}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold text-slate-800">
                          Đội cứu hộ đang di chuyển
                        </div>

                        <div className="text-slate-600 mt-1">
                          {m.rescuer_name || m.assigned_team || "Đội cứu hộ"}
                        </div>

                        <div className="text-xs text-blue-600 mt-1">
                          Đang đến vị trí yêu cầu của bạn
                        </div>
                      </div>
                    </Popup>
                  </Marker>

                  <>
                    <Polyline
                      positions={[rescuePos, sosPos]}
                      pathOptions={{
                        className: "rescue-route-base"
                      }}
                    />

                    <Polyline
                      positions={[rescuePos, sosPos]}
                      pathOptions={{
                        className: "rescue-route-animated"
                      }}
                    />
                  </>

                  {trackingInfo && (
                    <>
                      <Marker
                        position={upperLabelPos}
                        icon={createLineInfoLabel(`Còn ${trackingInfo.distanceText}`, "blue")}
                        interactive={false}
                      />

                      <Marker
                        position={lowerLabelPos}
                        icon={createLineInfoLabel(`${trackingInfo.etaText}`, "green")}
                        interactive={false}
                      />
                    </>
                  )}
                </React.Fragment>
              );
            })}

            <div className="absolute bottom-6 left-6 z-[1000] bg-white/70 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl px-4 py-3 w-[360px]">
              <div className="text-sm font-bold text-slate-800 mb-3">
                CHÚ THÍCH:
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded-full rounded-bl-[4px] rotate-[-45deg] bg-red-500 border-2 border-white shadow-md shrink-0"
                  >
                    <span className="rotate-[45deg] text-[14px] font-black text-white leading-none">
                      !
                    </span>
                  </span>
                  <span className="leading-snug">Cần cứu hộ khẩn cấp</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded-full rounded-bl-[4px] rotate-[-45deg] bg-amber-500 border-2 border-white shadow-md shrink-0"
                  >
                    <span className="rotate-[45deg] text-[14px] font-black text-white leading-none">
                      📦
                    </span>
                  </span>
                  <span className="leading-snug">Cần nhu yếu phẩm</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded-full rounded-bl-[4px] rotate-[-45deg] bg-blue-500 border-2 border-white shadow-md shrink-0"
                  >
                    <span className="rotate-[45deg] text-[14px] font-black text-white leading-none">
                      🚗
                    </span>
                  </span>
                  <span className="leading-snug">Cần cứu hộ xe</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="relative inline-flex items-center justify-center w-6 h-6 rounded-full rounded-bl-[4px] rotate-[-45deg] bg-slate-500 border-2 border-white shadow-md shrink-0"
                  >
                    <span className="rotate-[45deg] text-[14px] font-black text-white leading-none">
                      ?
                    </span>
                  </span>
                  <span className="leading-snug">Yêu cầu khác</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border-[3px] border-blue-600 shadow-md shrink-0">
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[12px] font-bold leading-none tracked-marker-bounce ${trackedMarker.bgClass}`}
                    >
                      {trackedMarker.icon}
                    </span>
                  </span>
                  <span className="leading-snug">Đang được cứu hộ</span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border-[3px] border-blue-600 shadow-md shrink-0">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[12px] leading-none">
                      ⛑
                    </span>
                  </span>
                  <span className="leading-snug">Vị trí đội cứu hộ</span>
                </div>

              </div>
            </div>

            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <MapController zoomAction="in" />
              <MapController zoomAction="out" />

              <button
                onClick={() => setMapType(mapType === 'default' ? 'satellite' : 'default')}
                className="p-2 bg-white border border-slate-200 rounded-lg shadow-md hover:bg-slate-50"
              >
                <img
                  src={mapIcon}
                  alt="Layers"
                  className="w-5 h-5"
                />
              </button>

              <button
                onClick={flyToMyLocationOnly}
                disabled={isGettingGPS}
                className="p-2 bg-white border border-slate-200 rounded-lg shadow-md text-blue-500 hover:bg-blue-50 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGettingGPS ? (
                  <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Navigation size={20} />
                )}
              </button>
            </div>

            {selectingOnMap && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200]">
                <div className="bg-white shadow-lg px-4 py-2 rounded-full flex items-center gap-3 border">
                  <span className="text-sm font-medium text-slate-700">
                    📍Chọn trên bản đồ
                  </span>

                  <button
                    onClick={() => {
                      setSelectingOnMap(false);
                      setTempLocation(null);
                      setConfirmPopup(false);
                    }}
                    className="text-slate-500 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            <div className="absolute bottom-6 right-6 z-[1000]">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-red-500/25 animate-ping"></span>

                <button
                  onClick={() => {
                    const token = localStorage.getItem("token");

                    if (!token) {
                      setAuthMode("login");
                      setOpenLogin(true);
                      return;
                    }

                    setConfirmPopup(false);
                    setShowSOSForm(true);
                  }}
                  className="relative h-14 px-5 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white shadow-xl border-2 border-white flex items-center gap-2 hover:scale-[1.03] active:scale-95 transition-all"
                >
                  <img src={sosIcon} alt="SOS" className="w-5 h-5" />
                  <span className="font-bold text-sm">Gửi SOS</span>
                </button>
              </div>
            </div>
          </MapContainer>
        </div>
      </main>

      {/* SOS FORM */}
      {showSOSForm && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40"
          onClick={() => setShowSOSForm(false)}
        >
          <div
            className="bg-white w-[520px] rounded-xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-600 text-white text-center py-6 relative">
              <h3 className="font-bold text-xl">
                GỬI YÊU CẦU CỨU HỘ KHẨN CẤP
              </h3>
              <p className="text-xs opacity-90 mt-1">
                Vui lòng cung cấp thông tin chính xác để được hỗ trợ nhanh nhất
              </p>
              <button
                onClick={() => {
                  if (isFormDirty()) {
                    setConfirmCloseForm(true);
                  } else {
                    setShowSOSForm(false);
                    resetForm();
                    setImages([]);
                    setTempLocation(null);
                    setSelectingOnMap(false);
                    setConfirmPopup(false);
                  }
                }}
                className="absolute top-4 right-4 hover:bg-slate-100 hover:text-slate-700 rounded-full p-1 transition"
              >
                <X />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              <div>
                <h3 className="font-semibold text-slate-700 mb-2 text-sm">
                  1. Phân loại yêu cầu: <span className="text-red-500">*</span>
                </h3>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSosType("rescue")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${sosType === "rescue"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-black border-gray-300 hover:bg-red-50"
                      }`}
                  >
                    Cần cứu hộ
                  </button>

                  <button
                    onClick={() => setSosType("supplies")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${sosType === "supplies"
                      ? "bg-yellow-500 text-white border-yellow-500"
                      : "bg-white text-black border-gray-300 hover:bg-yellow-50"
                      }`}
                  >
                    Cần nhu yếu phẩm
                  </button>

                  <button
                    onClick={() => setSosType("vehicle")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${sosType === "vehicle"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-black border-gray-300 hover:bg-blue-50"
                      }`}
                  >
                    Cần cứu hộ xe
                  </button>

                  <button
                    onClick={() => setSosType("other")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${sosType === "other"
                      ? "bg-gray-600 text-white border-gray-600"
                      : "bg-white text-black border-gray-300 hover:bg-gray-100"
                      }`}
                  >
                    Yêu cầu khác
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-700 mb-3">
                  2. Thông tin cá nhân: <span className="text-red-500">*</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Họ và tên
                    </label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleInput}
                      placeholder="Nhập họ và tên"
                      className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Số điện thoại
                    </label>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleInput}
                      placeholder="Ví dụ: 0912345678"
                      className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">
                  3. Vị trí hiện tại: <span className="text-red-500">*</span>
                </h3>

                <div className="flex bg-slate-100 rounded-lg p-1 text-xs mb-3" style={{ width: "129px" }}>
                  <button
                    onClick={() => setLocationMode("address")}
                    className={`px-3 py-1 rounded-md ${locationMode === "address" ? "bg-white shadow" : ""}`}
                  >
                    Địa chỉ
                  </button>

                  <button
                    onClick={() => setLocationMode("coords")}
                    className={`px-3 py-1 rounded-md ${locationMode === "coords" ? "bg-white shadow" : ""}`}
                  >
                    Tọa độ
                  </button>
                </div>

                {locationMode === "address" && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">
                          Tỉnh / Thành phố
                        </label>
                        <select
                          value={selectedProvinceCode}
                          onChange={(e) => {
                            setSelectedProvinceCode(e.target.value);
                            setSelectedWardCode("");
                            setForm((prev) => ({
                              ...prev,
                              address: ""
                            }));
                          }}
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full bg-white"
                        >
                          <option value="">
                            {loadingProvinces ? "Đang tải tỉnh/thành..." : "Chọn tỉnh / thành phố"}
                          </option>
                          {provinces.map((province) => (
                            <option key={province.code} value={province.code}>
                              {province.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600">
                          Phường / Xã
                        </label>
                        <select
                          value={selectedWardCode}
                          onChange={(e) => {
                            setSelectedWardCode(e.target.value);
                            setForm((prev) => ({
                              ...prev,
                              address: ""
                            }));
                          }}
                          disabled={!selectedProvinceCode || loadingWards}
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full bg-white disabled:bg-slate-100"
                        >
                          <option value="">
                            {!selectedProvinceCode
                              ? "Chọn tỉnh/thành trước"
                              : loadingWards
                                ? "Đang tải phường/xã..."
                                : "Chọn phường / xã"}
                          </option>
                          {wards.map((ward) => (
                            <option key={ward.code} value={ward.code}>
                              {ward.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600">
                          Địa chỉ chi tiết
                        </label>
                        <input
                          value={addressDetail}
                          onChange={(e) => {
                            setAddressDetail(e.target.value);
                            setForm((prev) => ({
                              ...prev,
                              address: ""
                            }));
                          }}
                          disabled={!selectedWardCode}
                          placeholder="Ví dụ: 123 Đường ABC"
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full disabled:bg-slate-100"
                        />
                      </div>

                      <div className="bg-slate-50 border rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Địa chỉ hoàn chỉnh:</div>
                        <div className="text-sm font-medium text-slate-700">
                          {buildFullAddress() || "Chưa có địa chỉ"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={getCoordsFromAddress}
                      disabled={isFindingAddress || isGettingGPS}
                      className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isFindingAddress ? (
                        <>
                          <ButtonSpinner />
                          <span>Đang xác định địa chỉ...</span>
                        </>
                      ) : (
                        <span>Xác định từ địa chỉ</span>
                      )}
                    </button>

                    <button
                      onClick={getGPS}
                      disabled={isGettingGPS || isFindingAddress}
                      className="mt-2 w-full border border-dashed bg-slate-100 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isGettingGPS ? (
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

                {locationMode === "coords" && (
                  <>
                    <input
                      name="coords"
                      value={form.coords}
                      onChange={handleInput}
                      placeholder="VD: 21.0285, 105.8542"
                      className="border border-slate-300 rounded-lg p-2 w-full"
                    />

                    <button
                      onClick={() => {
                        const parsed = parseCoords(form.coords);

                        if (!parsed) {
                          showToast("Sai tọa độ. Vui lòng nhập đúng định dạng lat, lng.", "warning");
                          return;
                        }

                        if (!isInVietnam(parsed.lat, parsed.lng)) {
                          showToast(getVietnamSupportMessage(), "warning");
                          return;
                        }

                        setTempLocation([parsed.lat, parsed.lng]);
                        setFlyToUser([parsed.lat, parsed.lng]);

                        setTimeout(() => {
                          setFlyToUser(null);
                        }, 2000);

                        setForm((prev) => ({
                          ...prev,
                          lat: parsed.lat,
                          lng: parsed.lng
                        }));

                        showToast("Đã xác định vị trí từ tọa độ.", "success");
                      }}
                      className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg"
                    >
                      Xác định từ tọa độ
                    </button>

                    <button
                      onClick={() => {
                        setShowSOSForm(false);
                        setSelectingOnMap(true);
                      }}
                      className="mt-2 w-full border border-dashed bg-slate-100 py-2 rounded-lg flex items-center justify-center gap-2"
                    >
                      <MapPin size={16} />
                      Chọn trên bản đồ
                    </button>
                  </>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">
                  4. Chi tiết tình hình:
                </h3>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Số lượng người cần cứu
                  </label>

                  <input
                    name="victims"
                    value={form.victims}
                    onChange={handleInput}
                    type="number"
                    min="1"
                    className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Hình ảnh (tối đa 2 ảnh)
                </label>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (!e.target.files) return;
                    const filesArray = Array.from(e.target.files).slice(0, 2);
                    setImages(filesArray);
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />

                <div className="flex gap-2 mt-2">
                  {images.map((file, idx) => (
                    <div key={idx} className="relative w-20 h-20 border rounded-lg overflow-hidden">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setImages(images.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-white rounded-full text-red-500 p-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">
                  5. Tình trạng hiện tại:
                </h3>
                <textarea
                  name="note"
                  value={form.note}
                  onChange={handleInput}
                  placeholder="Cung cấp thêm chi tiết..."
                  className="border border-slate-300 rounded-lg p-2 w-full h-24"
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2">
                  6. Link nguồn: <span className="text-slate-400">(Tùy chọn)</span>
                </h3>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Link bài đăng / nguồn thông tin
                  </label>

                  <input
                    name="source_url"
                    value={form.source_url}
                    onChange={handleInput}
                    type="url"
                    placeholder="Ví dụ: https://facebook.com/..."
                    className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                  />
                </div>
              </div>

              <button
                onClick={submitSOS}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold shadow"
              >
                GỬI YÊU CẦU NGAY LẬP TỨC
              </button>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 flex gap-2">
                <AlertTriangle size={16} />
                CẢNH BÁO: Việc cung cấp thông tin sai sự thật có thể bị xử phạt theo quy định pháp luật.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM LOCATION */}
      {confirmPopup && tempLocation && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]">
          <div className="w-[420px] max-w-[92vw] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Xác nhận vị trí đã chọn</h3>
                  <p className="text-sm text-white/90">Hệ thống sẽ dùng tọa độ này cho yêu cầu SOS</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tọa độ đã chọn
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-700 break-all">
                  {tempLocation[0]}, {tempLocation[1]}
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-600">
                Bạn có muốn dùng vị trí này cho biểu mẫu SOS không?
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setConfirmPopup(false);
                    setTempLocation(null);

                    setForm((prev) => ({
                      ...prev,
                      lat: 0,
                      lng: 0,
                      coords: ""
                    }));
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Hủy
                </button>

                <button
                  onClick={async () => {
                    const [lat, lng] = tempLocation;

                    if (!isInVietnam(lat, lng)) {
                      showToast(getVietnamSupportMessage(), "warning");
                      setConfirmPopup(false);
                      setTempLocation(null);
                      return;
                    }

                    try {
                      await fillAddressFromLatLng(lat, lng);
                      showToast("Đã chọn vị trí và tự động điền địa chỉ.", "success");
                    } catch (err) {
                      console.error("Lỗi khi lấy địa chỉ từ vị trí đã chọn:", err);

                      setForm((prev) => ({
                        ...prev,
                        lat,
                        lng,
                        coords: `${lat},${lng}`,
                        address: ""
                      }));

                      setAddressDetail("");
                      setSelectedProvinceCode("");
                      setSelectedWardCode("");
                      setWards([]);

                      showToast("Đã chọn vị trí nhưng chưa lấy được địa chỉ.", "warning");
                    }

                    setSelectingOnMap(false);
                    setConfirmPopup(false);
                    setShowSOSForm(true);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT SOS */}
      {showDetailModal && selectedSOS && (() => {
        const selectedStep = getStepStatus(selectedSOS);
        const trackingInfo = getRescueTrackingInfo(selectedSOS);
        const isOwnItem = Number(selectedSOS.user_id) === Number(currentUserId);

        return (
          <>
            <div
              className="fixed inset-0 z-[6900] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] p-2 md:p-3"
              onClick={() => setShowDetailModal(false)}
            >
              <div
                className="w-full max-w-4xl max-h-[90vh] min-h-0 overflow-hidden rounded-[24px] bg-white border border-slate-200 shadow-[0_24px_70px_rgba(15,23,42,0.32)] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-30 shrink-0 relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white px-4 md:px-5 py-4 border-b border-white/10">
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
                        Mã yêu cầu: #SOS-{selectedSOS.id}
                      </p>
                    </div>

                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="rounded-full p-2 text-white transition hover:bg-white/10"
                    >
                      <X size={17} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-4 bg-slate-50">
                  <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">
                          Trình trạng cứu hộ
                        </h2>
                      </div>

                      <span
                        className={cn(
                          "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold",
                          selectedStep.badgeClass
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full", getStepDotClass(selectedSOS.status))} />
                        {selectedStep.title}
                      </span>
                    </div>

                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 md:p-5">
                      <div className="relative">
                        <div className="absolute left-0 right-0 top-6 h-1 rounded-full bg-slate-200" />

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
                            time={formatDateTime(selectedSOS.created_at)}
                            compact
                          />

                          <Step
                            icon={<ClipboardList size={14} />}
                            label="Tiếp nhận"
                            active={selectedStep.currentStep >= 2}
                            done={selectedStep.currentStep > 2}
                            current={selectedStep.currentStep === 2}
                            time={formatDateTime(selectedSOS.received_at)}
                            compact
                          />

                          <Step
                            icon={<Truck size={14} />}
                            label="Đang đến"
                            active={selectedStep.currentStep >= 3}
                            done={selectedStep.currentStep > 3}
                            current={selectedStep.currentStep === 3}
                            time={
                              selectedSOS.status === "done" || selectedSOS.status === "cancel"
                                ? ""
                                : selectedSOS.status === "rescuing" && selectedStep.currentStep === 3
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
                            time={formatDateTime(selectedSOS.completed_at)}
                            compact
                          />
                        </div>
                      </div>

                      {selectedSOS.status === "cancel" ? (
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
                      ) : selectedSOS.status === "done" ? (
                        <StatusBanner
                          tone="emerald"
                          icon={<CheckCircle2 size={20} />}
                          title="Yêu cầu đã hoàn thành"
                          desc={`${isOwnItem ? "Yêu cầu của bạn" : "Yêu cầu này"
                            } đã được xử lý xong${selectedSOS.completed_at
                              ? ` vào lúc ${formatDateTime(selectedSOS.completed_at)}`
                              : ""
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
                    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                          <Info size={16} />
                        </div>
                        <div>
                          <h2 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">
                            Chi tiết yêu cầu
                          </h2>
                          <p className="text-xs text-slate-500">
                            Thông tin đầy đủ của yêu cầu SOS
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <DetailCard label="Mã yêu cầu" value={`#SOS-${selectedSOS.id}`} compact />
                        <DetailCard label="Loại yêu cầu" value={getSosTypeLabel(selectedSOS.sos_type)} compact />
                        <DetailCard label="Vị trí cứu trợ" value={selectedSOS.address || "Chưa có"} full compact />
                        <DetailCard label="Tọa độ" value={`${selectedSOS.lat}, ${selectedSOS.lng}`} full compact />
                        <DetailCard label="Mô tả tình trạng" value={selectedSOS.note || "Chưa có mô tả"} full italic compact />
                      </div>

                      {parseImages(selectedSOS.images).length > 0 && (
                        <div className="mt-5">
                          <div className="flex items-center gap-2 mb-3">
                            <ImageIcon size={16} />
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                              Hình ảnh hiện trường
                            </h3>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {parseImages(selectedSOS.images).map((img, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setPreviewImg(`${API_BASE}${img}`)}
                                className="group relative overflow-hidden rounded-[16px] border border-slate-200"
                              >
                                <img
                                  src={`${API_BASE}${img}`}
                                  alt={`Ảnh hiện trường ${idx + 1}`}
                                  className="h-28 md:h-32 w-full object-cover transition duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedSOS.source_url && (
                        <div className="mt-5 rounded-[18px] border border-slate-200 bg-slate-50 p-3.5">
                          <div className="flex items-center gap-2 mb-2">
                            <LinkIcon size={16} />
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                              Link nguồn
                            </h3>
                          </div>

                          <a
                            href={selectedSOS.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-xs md:text-sm font-semibold text-blue-600 underline"
                          >
                            {selectedSOS.source_url}
                          </a>
                        </div>
                      )}
                    </section>

                    <section className="space-y-4">
                      <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                            <User size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm md:text-base font-black text-slate-900">
                              Người gửi yêu cầu
                            </h3>
                            <p className="text-xs text-slate-500">
                              Thông tin người cần hỗ trợ
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <DetailRow icon={<User size={14} />} label="Họ tên" value={selectedSOS.name || "Chưa có"} compact />
                          <DetailRow icon={<PhoneCall size={14} />} label="Số điện thoại" value={selectedSOS.phone || "Chưa có"} compact />
                          <DetailRow icon={<Users size={14} />} label="Số người cần hỗ trợ" value={`${selectedSOS.victims || 1} người`} compact />
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
                            <Users size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm md:text-base font-black text-slate-900">
                              Đội cứu hộ phụ trách
                            </h3>
                            <p className="text-xs text-slate-500">
                              Thông tin hỗ trợ trực tiếp
                            </p>
                          </div>
                        </div>

                        <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3.5">
                          <p className="text-sm font-black text-slate-900">
                            {selectedSOS.assigned_team || "Chưa có đội nhận"}
                          </p>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            SĐT: {selectedSOS.rescuer_phone || "Chưa có"}
                          </p>
                        </div>
                        {selectedSOS.rescuer_phone ? (
                          <a
                            href={`tel:${selectedSOS.rescuer_phone}`}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800"
                          >
                            <PhoneCall size={14} />
                            Liên hệ đội cứu hộ
                          </a>
                        ) : (
                          <button
                            disabled
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500 cursor-not-allowed"
                          >
                            <PhoneCall size={14} />
                            Chưa có số liên hệ
                          </button>
                        )}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-200 p-3 md:p-4 bg-white">
                  <div className="flex flex-col md:flex-row gap-2 md:justify-end">
                    {isSelectedSOSOwner && selectedSOS.status !== "done" && selectedSOS.status !== "cancel" && (
                      <button
                        onClick={() => {
                          setReturnToDetailAfterUpdate(true);
                          setShowDetailModal(false);
                          setShowUpdateModal(true);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50"
                      >
                        Cập nhật
                      </button>
                    )}

                    {isSelectedSOSOwner && selectedSOS.status === "new" && (
                      <button
                        onClick={() => {
                          if (!isCancelling) {
                            askCancelSOS(selectedSOS.id);
                          }
                        }}
                        disabled={isCancelling}
                        className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-70"
                      >
                        Hủy yêu cầu
                      </button>
                    )}

                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="rounded-xl bg-slate-950 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {showUpdateModal && selectedSOS && isSelectedSOSOwner && (
        <div
          className="fixed inset-0 z-[6900] flex items-center justify-center bg-slate-950/60 backdrop-blur-[4px] p-2 md:p-3"
          onClick={handleCloseUpdateModal}
        >
          <div
            className="bg-white text-slate-900 w-[560px] rounded-xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
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

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-900">
              <div>
                <h3 className="font-semibold text-slate-700 mb-2 text-sm">
                  1. Phân loại yêu cầu: <span className="text-red-500">*</span>
                </h3>

                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEditSosType("rescue")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "rescue" ? "bg-red-600 text-white border-red-600" : "bg-white text-black border-gray-300 hover:bg-red-50"}`}
                  >
                    Cần cứu hộ
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("supplies")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "supplies" ? "bg-yellow-500 text-white border-yellow-500" : "bg-white text-black border-gray-300 hover:bg-yellow-50"}`}
                  >
                    Cần nhu yếu phẩm
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("vehicle")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "vehicle" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-black border-gray-300 hover:bg-blue-50"}`}
                  >
                    Cần cứu hộ xe
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSosType("other")}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs ${editSosType === "other" ? "bg-gray-600 text-white border-gray-600" : "bg-white text-black border-gray-300 hover:bg-gray-100"}`}
                  >
                    Yêu cầu khác
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-700 mb-3">
                  2. Thông tin cá nhân: <span className="text-red-500">*</span>
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Họ và tên
                    </label>
                    <input
                      name="name"
                      value={editForm.name}
                      onChange={handleEditInput}
                      placeholder="Nhập họ và tên"
                      className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Số điện thoại
                    </label>
                    <input
                      name="phone"
                      value={editForm.phone}
                      onChange={handleEditInput}
                      placeholder="Ví dụ: 0912345678"
                      className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">
                  3. Vị trí hiện tại: <span className="text-red-500">*</span>
                </h3>

                <div
                  className="flex bg-slate-100 rounded-lg p-1 text-xs mb-3"
                  style={{ width: "129px" }}
                >
                  <button
                    type="button"
                    onClick={() => setEditLocationMode("address")}
                    className={`px-3 py-1 rounded-md ${editLocationMode === "address" ? "bg-white shadow" : ""}`}
                  >
                    Địa chỉ
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditLocationMode("coords")}
                    className={`px-3 py-1 rounded-md ${editLocationMode === "coords" ? "bg-white shadow" : ""}`}
                  >
                    Tọa độ
                  </button>
                </div>

                {editLocationMode === "address" && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">
                          Tỉnh / Thành phố
                        </label>
                        <select
                          value={editSelectedProvinceCode}
                          onChange={(e) => {
                            setEditSelectedProvinceCode(e.target.value);
                            setEditSelectedWardCode("");
                            setEditForm((prev) => ({
                              ...prev,
                              address: "",
                            }));
                          }}
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full bg-white"
                        >
                          <option value="">
                            {loadingProvinces
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
                        <label className="text-xs font-medium text-slate-600">
                          Phường / Xã
                        </label>
                        <select
                          value={editSelectedWardCode}
                          onChange={(e) => {
                            setEditSelectedWardCode(e.target.value);
                            setEditForm((prev) => ({
                              ...prev,
                              address: "",
                            }));
                          }}
                          disabled={!editSelectedProvinceCode || editLoadingWards}
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full bg-white disabled:bg-slate-100"
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
                        <label className="text-xs font-medium text-slate-600">
                          Địa chỉ chi tiết
                        </label>
                        <input
                          value={editAddressDetail}
                          onChange={(e) => {
                            setEditAddressDetail(e.target.value);
                            setEditForm((prev) => ({
                              ...prev,
                              address: "",
                            }));
                          }}
                          disabled={!editSelectedWardCode}
                          placeholder="Ví dụ: 8/8 Phan Văn Trị"
                          className="mt-1 border border-slate-300 rounded-lg p-2 w-full disabled:bg-slate-100"
                        />
                      </div>

                      <div className="bg-slate-50 border rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">
                          Địa chỉ hoàn chỉnh:
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                          {buildEditFullAddress() ||
                            editForm.address ||
                            "Chưa có địa chỉ"}
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
                      className="mt-2 w-full border border-dashed bg-slate-100 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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
                      className="border border-slate-300 rounded-lg p-2 w-full"
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
                  <label className="text-xs font-medium text-slate-600 block mb-2">
                    Chọn nhanh trên bản đồ
                  </label>

                  <div className="rounded-xl overflow-hidden border border-slate-300">
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
                        maxBounds={[[7.0, 101.0], [24.5, 110.5]]}
                        maxBoundsViscosity={1.0}
                      >
                        <GoongStyleLayer enabled />
                        <MiniMapFixSize />
                        <FlyToMiniMapLocation position={editMapPosition} />

                        <MiniMapSelectLocation
                          onSelect={async (lat, lng) => {
                            if (!isInVietnam(lat, lng)) {
                              showToast(
                                "Vị trí phải nằm trong khu vực Việt Nam.",
                                "warning"
                              );
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
                                lat,
                                lng,
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

                    <div className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Chỉ hiển thị khu vực Việt Nam. Nhấn trực tiếp lên bản đồ để
                      chọn vị trí mới.
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Tọa độ đang chọn: {editMapPosition[0]}, {editMapPosition[1]}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">4. Chi tiết tình hình:</h3>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Số lượng người cần cứu
                  </label>
                  <input
                    name="victims"
                    value={editForm.victims}
                    onChange={handleEditInput}
                    type="number"
                    min="1"
                    className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
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
                  className="w-full border border-slate-300 rounded-lg p-2"
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
                <h3 className="font-semibold mb-2">5. Tình trạng hiện tại:</h3>
                <textarea
                  name="note"
                  value={editForm.note}
                  onChange={handleEditInput}
                  placeholder="Cung cấp thêm chi tiết..."
                  className="border border-slate-300 rounded-lg p-2 w-full h-24"
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2">
                  6. Link nguồn:{" "}
                  <span className="text-slate-400">(Tùy chọn)</span>
                </h3>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Link bài đăng / nguồn thông tin
                  </label>

                  <input
                    name="source_url"
                    value={editForm.source_url}
                    onChange={handleEditInput}
                    type="url"
                    placeholder="Ví dụ: https://facebook.com/..."
                    className="mt-1 border border-slate-300 rounded-lg p-2 w-full"
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
                Cảnh báo: Hãy cập nhật thông tin chính xác để đội cứu hộ hỗ trợ
                nhanh nhất.
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmCloseUpdateModal && (
        <div className="fixed inset-0 z-[7100] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px]">
          <div
            className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] px-6 py-5 text-white">
              <h3 className="text-lg font-bold">Xác nhận đóng form</h3>
              <p className="mt-1 text-sm text-slate-200">
                Bạn đã thay đổi thông tin. Nếu đóng bây giờ, dữ liệu chưa lưu sẽ bị
                mất.
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

                    if (returnToDetailAfterUpdate) {
                      setShowDetailModal(true);
                      setReturnToDetailAfterUpdate(false);
                    }

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

      {previewImg && (
        <div
          className="fixed inset-0 z-[7200] bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <img
            src={previewImg}
            alt="Preview"
            className="max-w-[90%] max-h-[90%] rounded-xl shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default MapDashboard;