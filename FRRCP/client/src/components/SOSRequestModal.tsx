import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Waves,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
} from "lucide-react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE = "http://localhost:3000";
const DEFAULT_MAP_CENTER: [number, number] = [16.047079, 108.20623];

type ToastType = "success" | "error" | "warning" | "info";

interface ToastState {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

interface SOSRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (sos: any) => void;
}

type LocationMode = "address" | "coords";

type Province = {
  code: number;
  name: string;
};

type Ward = {
  code: number;
  name: string;
};

const normalizeProvinceLabel = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.startsWith("tỉnh") || lower.startsWith("thành phố")) return name;
  return `Tỉnh ${name}`;
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

  return list.find((province) => {
    const name = normalizeText(province.name);
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

  return list.find((ward) => {
    const name = normalizeText(ward.name);
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
    addr.quarter,
  ]
    .filter(Boolean)
    .join(" ");

  return parts.trim();
};

const isInVietnam = (lat: number, lng: number) => {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 8.55 &&
    lat <= 23.35 &&
    lng >= 102.35 &&
    lng <= 109.48
  );
};

const MiniMapPicker = ({
  center,
  onSelect,
}: {
  center: [number, number];
  onSelect: (lat: number, lng: number) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.setView(center);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [map, center]);

  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
};

function NotificationToast({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
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
    const timer = setTimeout(() => {
      onClose();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.show, toast.duration, onClose]);

  if (!mounted) return null;

  const toastMeta = {
    success: {
      title: "Thành công",
      icon: CheckCircle2,
      border: "border-emerald-200 dark:border-emerald-800",
      iconWrap:
        "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    error: {
      title: "Có lỗi xảy ra",
      icon: XCircle,
      border: "border-red-200 dark:border-red-800",
      iconWrap:
        "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
    },
    warning: {
      title: "Cảnh báo",
      icon: AlertTriangle,
      border: "border-amber-200 dark:border-amber-800",
      iconWrap:
        "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    },
    info: {
      title: "Thông báo",
      icon: Info,
      border: "border-blue-200 dark:border-blue-800",
      iconWrap:
        "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    },
  } as const;

  const meta = toastMeta[toast.type];
  const Icon = meta.icon;

  return createPortal(
    <div className="fixed top-5 inset-x-0 flex justify-center z-[10000] pointer-events-none">
      <div
        className={`pointer-events-auto w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border shadow-2xl overflow-hidden bg-white ${meta.border}`}
        style={{
          animation: `${showAnim ? "slideIn" : "slideOut"} 0.28s ease`,
        }}
      >
        <style>{`
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-20px); }
          }
        `}</style>
        <div className="relative flex items-start gap-3 p-4">
          <div
            className={`w-10 h-10 flex items-center justify-center rounded-full ${meta.iconWrap}`}
          >
            <Icon size={18} />
          </div>

          <div className="flex-1">
            <div className="font-bold text-sm text-slate-900">
              {meta.title}
            </div>
            <div className="text-sm text-slate-600">{toast.message}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const SOSRequestModal: React.FC<SOSRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: 3000,
  });

  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedWardCode, setSelectedWardCode] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [loadingWards, setLoadingWards] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_MAP_CENTER);

  const [locationMode, setLocationMode] = useState<LocationMode>("address");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    victims: 1,
    note: "",
    source_url: "",
    lat: 0,
    lng: 0,
    coords: "",
    address: "",
  });

  const [sosType, setSosType] = useState<"rescue" | "supplies" | "vehicle" | "other" | "">("");
  const [images, setImages] = useState<File[]>([]);
  const [isGettingGPS, setIsGettingGPS] = useState(false);
  const [isFindingAddress, setIsFindingAddress] = useState(false);

  const showToast = (message: string, type: ToastType) => {
    setToast({
      id: Date.now(),
      show: true,
      message,
      type,
      duration: 3000,
    });
  };

  const closeToast = () => {
    setToast((prev) => ({ ...prev, show: false }));
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
            name: item.name,
          }))
        );
      } catch (err) {
        console.error("Không tải được danh sách tỉnh/thành", err);
      } finally {
        setLoadingProvinces(false);
      }
    };

    if (isOpen) {
      fetchProvinces();
    }
  }, [isOpen]);

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
            name: item.name,
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

  const buildFullAddress = () => {
    const province = provinces.find(
      (p) => String(p.code) === selectedProvinceCode
    );
    const ward = wards.find((w) => String(w.code) === selectedWardCode);

    const parts = [
      addressDetail.trim(),
      ward ? normalizeWardLabel(ward.name) : "",
      province ? normalizeProvinceLabel(province.name) : "",
    ].filter(Boolean);

    return parts.join(", ");
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === "phone") {
      let newValue = value.replace(/\D/g, "");
      if (newValue.length === 1 && newValue !== "0") return;
      if (newValue.length > 10) return;
      setForm({ ...form, phone: newValue });
      return;
    }

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

  const fetchWardsByProvinceCode = async (provinceCode: string) => {
    const res = await fetch(
      `https://provinces.open-api.vn/api/v2/p/${provinceCode}?depth=2`
    );
    const data = await res.json();

    return (data.wards || []).map((item: any) => ({
      code: item.code,
      name: item.name,
    })) as Ward[];
  };

  const fillAddressFromLatLng = async (lat: number, lng: number) => {
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

    const matchedProvince = findProvinceByName(provinceName, provinces);

    if (matchedProvince) {
      const matchedProvinceCode = String(matchedProvince.code);
      setSelectedProvinceCode(matchedProvinceCode);

      const fetchedWards = await fetchWardsByProvinceCode(matchedProvinceCode);
      setWards(fetchedWards);

      const matchedWard = findWardByName(wardName, fetchedWards);
      if (matchedWard) {
        setSelectedWardCode(String(matchedWard.code));
      } else {
        setSelectedWardCode("");
      }
    } else {
      setSelectedProvinceCode("");
      setSelectedWardCode("");
      setWards([]);
    }

    setAddressDetail(detail);
    setMapCenter([lat, lng]);
    setForm((prev) => ({
      ...prev,
      lat,
      lng,
      coords: `${lat},${lng}`,
      address: reverseData.display_name || detail || `${lat},${lng}`,
    }));
  };

  const resolveAddressCoords = async (fullAddress: string) => {
    const queries = [
      fullAddress,
      `${fullAddress}, Việt Nam`,
      `${addressDetail}, ${fullAddress}, Việt Nam`,
    ];

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
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        if (isInVietnam(lat, lng)) {
          return { lat, lng };
        }
      }
    }

    return null;
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
      const coords = await resolveAddressCoords(fullAddress);

      if (!coords) {
        showToast("Không tìm được địa chỉ. Vui lòng thử lại.", "warning");
        return;
      }

      const { lat, lng } = coords;

      setMapCenter([lat, lng]);
      setForm((prev) => ({
        ...prev,
        lat,
        lng,
        coords: `${lat},${lng}`,
        address: fullAddress,
      }));

      showToast("Đã xác định vị trí từ địa chỉ.", "success");
    } catch (err) {
      showToast("Lỗi khi xác định địa chỉ.", "error");
    } finally {
      setIsFindingAddress(false);
    }
  };

  useEffect(() => {
    if (locationMode !== "address") return;

    const hasAddressParts =
      Boolean(selectedProvinceCode) &&
      Boolean(selectedWardCode) &&
      Boolean(addressDetail.trim());

    if (!hasAddressParts) return;

    const fullAddress = buildFullAddress();
    const timer = window.setTimeout(async () => {
      try {
        const coords = await resolveAddressCoords(fullAddress);
        if (!coords) return;

        const { lat, lng } = coords;
        setMapCenter([lat, lng]);
        setForm((prev) => ({
          ...prev,
          lat,
          lng,
          coords: `${lat},${lng}`,
          address: fullAddress,
        }));
      } catch (error) {
        console.error(error);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    locationMode,
    selectedProvinceCode,
    selectedWardCode,
    addressDetail,
    provinces,
    wards,
  ]);

  const getGPS = async () => {
    setIsGettingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          setMapCenter([lat, lng]);
          setForm((prev) => ({
            ...prev,
            lat,
            lng,
            coords: `${lat},${lng}`,
          }));
          showToast("Đã lấy GPS thành công.", "success");
        } catch (err) {
          showToast("Lỗi khi xác định vị trí GPS.", "error");
        } finally {
          setIsGettingGPS(false);
        }
      },
      () => {
        showToast("Không lấy được vị trí GPS.", "error");
        setIsGettingGPS(false);
      }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 2);

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    const maxSize = 5 * 1024 * 1024;

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        showToast("Chỉ được chọn ảnh jpg, jpeg, png hoặc webp", "warning");
        return;
      }

      if (file.size > maxSize) {
        showToast("Ảnh tối đa 5MB", "warning");
        return;
      }
    }

    setImages(files);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!form.name.trim()) {
        showToast("Vui lòng nhập họ và tên!", "warning");
        return;
      }

      if (!form.phone.trim()) {
        showToast("Vui lòng nhập số điện thoại!", "warning");
        return;
      }

      const phoneRegex = /^0\d{9}$/;
      if (!phoneRegex.test(form.phone.trim())) {
        showToast("Số điện thoại phải gồm 10 số và bắt đầu bằng 0", "warning");
        return;
      }

      if (!sosType) {
        showToast("Vui lòng chọn loại yêu cầu!", "warning");
        return;
      }

      let lat = form.lat;
      let lng = form.lng;
      let address = buildFullAddress();

      if (locationMode === "address") {
        if (!selectedProvinceCode || !selectedWardCode || !addressDetail.trim()) {
          showToast("Vui lòng điền đầy đủ địa chỉ!", "warning");
          return;
        }
      } else if (locationMode === "coords") {
        const parsed = parseCoords(form.coords);
        if (!parsed) {
          showToast("Tọa độ không hợp lệ!", "warning");
          return;
        }
        lat = parsed.lat;
        lng = parsed.lng;
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showToast("Vị trí không hợp lệ!", "warning");
        return;
      }

      if (!isInVietnam(lat, lng)) {
        showToast("Vị trí phải nằm trong khu vực Việt Nam.", "warning");
        return;
      }

      setLoading(true);

      const token = localStorage.getItem("token");
      if (!token) {
        showToast("Bạn cần đăng nhập!", "warning");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("phone", form.phone);
      formData.append("address", address || `${lat},${lng}`);
      formData.append("lat", String(lat));
      formData.append("lng", String(lng));
      formData.append("victims", String(form.victims));
      formData.append("note", form.note);
      formData.append("source_url", form.source_url);
      formData.append("sos_type", sosType);

      images.forEach((img) => {
        formData.append("images", img);
      });

      const res = await fetch(`${API_BASE}/api/rescues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("username");
          localStorage.removeItem("role");
          localStorage.removeItem("userId");
          showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "warning");
          return;
        }

        showToast(data.message || "Gửi yêu cầu thất bại.", "error");
        return;
      }

      showToast("Gửi yêu cầu SOS thành công!", "success");
      onSuccess?.(data);

      setTimeout(() => {
        resetForm();
        onClose();
      }, 1500);
    } catch (error) {
      showToast("Không thể kết nối server.", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      phone: "",
      victims: 1,
      note: "",
      source_url: "",
      lat: 0,
      lng: 0,
      coords: "",
      address: "",
    });
    setSosType("");
    setImages([]);
    setLocationMode("address");
    setSelectedProvinceCode("");
    setSelectedWardCode("");
    setAddressDetail("");
    setMapCenter(DEFAULT_MAP_CENTER);
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <NotificationToast toast={toast} onClose={closeToast} />

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-red-600 text-white px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Waves size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">GỬI YÊU CẦU CỨU HỘ</h2>
                  <p className="text-xs text-white/90 mt-0.5">
                    Vui lòng cung cấp thông tin chính xác để được hỗ trợ nhanh nhất
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="p-2 hover:bg-white/20 rounded-lg transition disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            {/* 1. Phân loại yêu cầu */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                1. Phân loại yêu cầu: <span className="text-red-500">*</span>
              </h3>

              <div className="flex gap-2 flex-wrap">
                {(["rescue", "supplies", "vehicle", "other"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSosType(type)}
                    className={`px-3 py-2 rounded-lg font-medium border text-xs transition ${
                      sosType === type
                        ? type === "rescue"
                          ? "bg-red-600 text-white border-red-600"
                          : type === "supplies"
                          ? "bg-yellow-500 text-white border-yellow-500"
                          : type === "vehicle"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-600 text-white border-gray-600"
                        : "bg-white text-black border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {type === "rescue"
                      ? "Cần cứu hộ"
                      : type === "supplies"
                      ? "Cần nhu yếu phẩm"
                      : type === "vehicle"
                      ? "Cần cứu hộ xe"
                      : "Yêu cầu khác"}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Thông tin cá nhân */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                2. Thông tin cá nhân: <span className="text-red-500">*</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Họ và tên
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleInput}
                    placeholder="Nhập họ và tên"
                    maxLength={50}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">
                    Số điện thoại
                  </label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleInput}
                    type="tel"
                    placeholder="Ví dụ: 0912345678"
                    maxLength={10}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>

            {/* 3. Vị trí hiện tại */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                3. Vị trí hiện tại: <span className="text-red-500">*</span>
              </h3>

              <div className="flex gap-2 mb-3">
                {(["address", "coords"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLocationMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      locationMode === mode
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {mode === "address" ? "Địa chỉ" : "Tọa độ"}
                  </button>
                ))}
              </div>

              {locationMode === "address" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Tỉnh / Thành phố
                    </label>
                    <select
                      value={selectedProvinceCode}
                      onChange={(e) => {
                        setSelectedProvinceCode(e.target.value);
                        setSelectedWardCode("");
                        setAddressDetail("");
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">
                        {loadingProvinces
                          ? "Đang tải tỉnh/thành..."
                          : "Chọn tỉnh / thành phố"}
                      </option>
                      {provinces.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProvinceCode && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">
                        Phường / Xã
                      </label>
                      <select
                        value={selectedWardCode}
                        onChange={(e) => {
                          setSelectedWardCode(e.target.value);
                          setAddressDetail("");
                        }}
                        disabled={loadingWards}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                      >
                        <option value="">
                          {loadingWards
                            ? "Đang tải phường/xã..."
                            : "Chọn phường / xã"}
                        </option>
                        {wards.map((w) => (
                          <option key={w.code} value={w.code}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedWardCode && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">
                        Địa chỉ chi tiết
                      </label>
                      <input
                        value={addressDetail}
                        onChange={(e) => setAddressDetail(e.target.value)}
                        placeholder="Ví dụ: 123 Đường ABC"
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                  )}

                  {addressDetail && (
                    <div className="bg-slate-50 border rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">
                        Địa chỉ hoàn chỉnh:
                      </div>
                      <div className="text-sm font-medium text-slate-700">
                        {buildFullAddress()}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-slate-200 overflow-hidden h-44 bg-slate-50">
                    <MapContainer
                      center={mapCenter}
                      zoom={15}
                      style={{ height: "100%", width: "100%" }}
                      scrollWheelZoom={false}
                      dragging={true}
                      doubleClickZoom={true}
                      zoomControl={true}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                      />
                      <MiniMapPicker center={mapCenter} onSelect={fillAddressFromLatLng} />
                      {form.lat !== 0 && form.lng !== 0 && (
                        <Marker position={[form.lat, form.lng]} />
                      )}
                    </MapContainer>
                  </div>

                  <div className="text-xs text-slate-500 px-1">
                    Nhấn vào bản đồ để chọn vị trí, địa chỉ sẽ được điền tự động.
                  </div>

                  <button
                    onClick={getCoordsFromAddress}
                    disabled={isFindingAddress || !selectedWardCode}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isFindingAddress && <Loader2 size={16} className="animate-spin" />}
                    Xác định từ địa chỉ
                  </button>

                  <button
                    onClick={getGPS}
                    disabled={isGettingGPS}
                    className="w-full border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGettingGPS && <Loader2 size={16} className="animate-spin" />}
                    Lấy GPS tự động
                  </button>
                </div>
              )}

              {locationMode === "coords" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      Tọa độ (Ví dụ: 21.0285, 105.8542)
                    </label>
                    <input
                      name="coords"
                      value={form.coords}
                      onChange={handleInput}
                      placeholder="Nhập tọa độ"
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <button
                    onClick={() => {
                      const parsed = parseCoords(form.coords);
                      if (!parsed) {
                        showToast("Tọa độ không hợp lệ!", "warning");
                        return;
                      }
                      if (!isInVietnam(parsed.lat, parsed.lng)) {
                        showToast("Vị trí phải nằm trong khu vực Việt Nam.", "warning");
                        return;
                      }
                      setForm((prev) => ({
                        ...prev,
                        lat: parsed.lat,
                        lng: parsed.lng,
                      }));
                      showToast("Đã xác định vị trí.", "success");
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition"
                  >
                    Xác định từ tọa độ
                  </button>
                </div>
              )}
            </div>

            {/* 4. Chi tiết tình hình */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                4. Chi tiết tình hình:
              </h3>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Số lượng người cần cứu
                </label>
                <input
                  name="victims"
                  value={form.victims}
                  onChange={handleInput}
                  type="number"
                  min="1"
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* 5. Hình ảnh */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                5. Hình ảnh (tối đa 2 ảnh):
              </h3>

              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />

                {images.length > 0 && (
                  <div className="flex gap-2">
                    {images.map((file, idx) => (
                      <div key={idx} className="relative w-20 h-20 border rounded-lg overflow-hidden">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`preview-${idx}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 6. Tình trạng hiện tại */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                6. Tình trạng hiện tại:
              </h3>

              <textarea
                name="note"
                value={form.note}
                onChange={handleInput}
                placeholder="Cung cấp thêm chi tiết..."
                className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 resize-none h-20"
              />
            </div>

            {/* 7. Link nguồn */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">
                7. Link nguồn: <span className="text-slate-400">(Tùy chọn)</span>
              </h3>

              <input
                name="source_url"
                value={form.source_url}
                onChange={handleInput}
                type="url"
                placeholder="Ví dụ: https://facebook.com/..."
                className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 flex gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                CẢNH BÁO: Việc cung cấp thông tin sai sự thật có thể bị xử phạt theo quy định pháp luật.
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-6 bg-slate-50 flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 rounded-lg border border-slate-200 font-semibold text-sm hover:bg-slate-100 transition disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Đang gửi..." : "GỬI YÊU CẦU NGAY LẬP TỨC"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default SOSRequestModal;
