import React, { useEffect, useState, useCallback } from "react";
import Navbar from "../../components/Navbar";
import axios from "axios";
import {
  CloudRain,
  Wind,
  Waves,
  RefreshCw,
  ExternalLink,
  Thermometer,
  CloudLightning,
  Mountain,
  Newspaper,
  Clock,
  MapPin,
  SlidersHorizontal,
  Droplets,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";

// ===================== LOGO / FAVICON NGUỒN TIN =====================
const SOURCE_LOGOS: Record<string, string> = {
  "VnExpress":    "https://s1.vnecdn.net/vnexpress/restruct/i/v9505/v2_2019/pc/graphics/logo.svg",
  "Tuổi Trẻ":    "https://static.tuoitre.vn/tto/i/favicon.ico",
  "Thanh Niên":  "https://static.thanhnien.vn/v2/App_Themes/Images/favicon.ico",
  "Dân Trí":     "https://icdn.dantri.com.vn/2021/11/16/favicon-1637036641963.png",
  "Nhân Dân":    "https://nhandan.vn/favicon.ico",
  "VietnamNet":  "https://static.vietnamnet.vn/Images/favicon.ico",
  "Báo Tin Tức": "https://baotintuc.vn/favicon.ico",
  "nchmf":       "https://nchmf.gov.vn/favicon.ico",
  "Google News": "https://www.google.com/favicon.ico",
};

// Lấy tên báo thật từ URL bài viết (Google News redirect về báo gốc)
function extractSourceName(url: string, fallback: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const map: Record<string, string> = {
      "vnexpress.net": "VnExpress",
      "tuoitre.vn": "Tuổi Trẻ",
      "thanhnien.vn": "Thanh Niên",
      "dantri.com.vn": "Dân Trí",
      "nhandan.vn": "Nhân Dân",
      "vietnamnet.vn": "VietnamNet",
      "baotintuc.vn": "Báo Tin Tức",
      "nchmf.gov.vn": "nchmf",
      "phongchongthientai.mard.gov.vn": "Phòng chống thiên tai",
      "baomoi.com": "Báo Mới",
      "zingnews.vn": "Zing News",
      "24h.com.vn": "24h",
      "soha.vn": "Soha",
      "laodong.vn": "Lao Động",
      "tienphong.vn": "Tiền Phong",
      "vtv.vn": "VTV",
      "vov.vn": "VOV",
      "qdnd.vn": "QĐND",
    };
    return map[hostname] || hostname;
  } catch {
    return fallback;
  }
}

// ===================== 34 TỈNH THÀNH 2025 (SAU SÁP NHẬP) =====================
const PROVINCES = [
  // I. Vùng trung du và miền núi phía Bắc
  { name: "Tuyên Quang", lat: 21.8236, lon: 105.2141 },         // Hà Giang + Tuyên Quang
  { name: "Cao Bằng", lat: 22.6657, lon: 106.2522 },
  { name: "Lai Châu", lat: 22.3964, lon: 103.4581 },
  { name: "Lào Cai", lat: 22.4656, lon: 103.9753 },             // Lào Cai + Yên Bái
  { name: "Thái Nguyên", lat: 21.5942, lon: 105.8482 },         // Bắc Kạn + Thái Nguyên
  { name: "Điện Biên", lat: 21.3860, lon: 103.0230 },
  { name: "Lạng Sơn", lat: 21.8537, lon: 106.7615 },
  { name: "Sơn La", lat: 21.3267, lon: 103.9144 },
  { name: "Phú Thọ", lat: 21.3989, lon: 105.2306 },             // Hòa Bình + Vĩnh Phúc + Phú Thọ

  // II. Vùng đồng bằng sông Hồng
  { name: "TP. Hà Nội", lat: 21.0245, lon: 105.8412 },
  { name: "TP. Hải Phòng", lat: 20.8449, lon: 106.6881 },       // Hải Dương + TP. Hải Phòng
  { name: "Bắc Ninh", lat: 21.1861, lon: 106.0763 },            // Bắc Giang + Bắc Ninh
  { name: "Quảng Ninh", lat: 21.0064, lon: 107.2925 },
  { name: "Hưng Yên", lat: 20.6464, lon: 106.0511 },            // Thái Bình + Hưng Yên
  { name: "Ninh Bình", lat: 20.2506, lon: 105.9745 },           // Hà Nam + Ninh Bình + Nam Định

  // III. Vùng Bắc Trung Bộ
  { name: "Thanh Hóa", lat: 19.8068, lon: 105.7852 },
  { name: "Nghệ An", lat: 19.2342, lon: 104.9200 },
  { name: "Hà Tĩnh", lat: 18.3559, lon: 105.8877 },
  { name: "Quảng Trị", lat: 16.7403, lon: 107.1854 },           // Quảng Bình + Quảng Trị
  { name: "TP. Huế", lat: 16.4674, lon: 107.5905 },

  // IV. Vùng duyên hải Nam Trung Bộ và Tây Nguyên
  { name: "TP. Đà Nẵng", lat: 16.0544, lon: 108.2022 },         // Quảng Nam + TP. Đà Nẵng
  { name: "Quảng Ngãi", lat: 15.1214, lon: 108.7922 },          // Quảng Ngãi + Kon Tum
  { name: "Gia Lai", lat: 13.9833, lon: 108.0000 },             // Gia Lai + Bình Định
  { name: "Đắk Lắk", lat: 12.7100, lon: 108.2378 },             // Phú Yên + Đắk Lắk
  { name: "Khánh Hòa", lat: 12.2388, lon: 109.1967 },           // Khánh Hòa + Ninh Thuận
  { name: "Lâm Đồng", lat: 11.5645, lon: 108.0717 },            // Đắk Nông + Lâm Đồng + Bình Thuận

  // V. Vùng Đông Nam Bộ
  { name: "Đồng Nai", lat: 11.0686, lon: 107.1676 },            // Bình Phước + Đồng Nai
  { name: "Tây Ninh", lat: 11.3104, lon: 106.0988 },            // Long An + Tây Ninh
  { name: "TP. Hồ Chí Minh", lat: 10.8231, lon: 106.6297 },     // Bình Dương + TPHCM + Bà Rịa - Vũng Tàu

  // VI. Vùng đồng bằng sông Cửu Long
  { name: "Đồng Tháp", lat: 10.5298, lon: 105.6880 },           // Tiền Giang + Đồng Tháp
  { name: "An Giang", lat: 10.5216, lon: 105.1259 },            // Kiên Giang + An Giang
  { name: "Vĩnh Long", lat: 10.1563, lon: 105.9706 },           // Bến Tre + Vĩnh Long + Trà Vinh
  { name: "TP. Cần Thơ", lat: 10.0452, lon: 105.7469 },         // Sóc Trăng + Hậu Giang + TP. Cần Thơ
  { name: "Cà Mau", lat: 9.1769, lon: 105.1524 },               // Bạc Liêu + Cà Mau
];

// ===================== TYPES =====================
type WeatherNews = {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: "bao" | "lu" | "sat_lo" | "nang_han" | "thoi_tiet";
};

type WeatherForecast = {
  time: string;
  temp: number;
  rain: number;
  windSpeed: number;
  weatherCode: number;
};

type CurrentWeather = {
  temp: number;
  windSpeed: number;
  rain: number;
  humidity: number;
  weatherCode: number;
};

// ===================== CONFIG =====================
const CATEGORY_CONFIG = {
  bao: { label: "Bão", icon: CloudLightning, badge: "bg-red-100 text-red-700 border border-red-200", card: "border-l-red-400" },
  lu: { label: "Lũ lụt", icon: Waves, badge: "bg-blue-100 text-blue-700 border border-blue-200", card: "border-l-blue-400" },
  sat_lo: { label: "Sạt lở", icon: Mountain, badge: "bg-orange-100 text-orange-700 border border-orange-200", card: "border-l-orange-400" },
  nang_han: { label: "Nắng hạn", icon: Thermometer, badge: "bg-yellow-100 text-yellow-700 border border-yellow-200", card: "border-l-yellow-400" },
  thoi_tiet: { label: "Thời tiết", icon: CloudRain, badge: "bg-slate-100 text-slate-600 border border-slate-200", card: "border-l-slate-300" },
};

function getWeatherLabel(code: number) {
  if (code === 0) return "Trời quang";
  if (code <= 3) return "Có mây";
  if (code <= 49) return "Sương mù";
  if (code <= 69) return "Mưa nhỏ";
  if (code <= 82) return "Mưa rào";
  if (code <= 99) return "Giông bão";
  return "Không rõ";
}

function getWeatherGradient(code: number) {
  if (code === 0) return "from-amber-400 to-orange-500";
  if (code <= 3) return "from-slate-400 to-slate-600";
  if (code <= 69) return "from-blue-400 to-blue-600";
  if (code <= 82) return "from-blue-500 to-indigo-700";
  if (code <= 99) return "from-slate-700 to-slate-900";
  return "from-blue-500 to-blue-700";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

// ===================== MAIN COMPONENT =====================
const NewsWeather: React.FC = () => {
  const [news, setNews] = useState<WeatherNews[]>([]);
  const [forecast, setForecast] = useState<WeatherForecast[]>([]);
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState(PROVINCES[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,rain,wind_speed_10m,weather_code&hourly=temperature_2m,rain,wind_speed_10m,weather_code&forecast_days=1&timezone=Asia%2FBangkok`
      );
      const d = res.data;
      setCurrent({
        temp: d.current.temperature_2m,
        windSpeed: d.current.wind_speed_10m,
        rain: d.current.rain,
        humidity: d.current.relative_humidity_2m,
        weatherCode: d.current.weather_code,
      });
      setForecast(
        d.hourly.time.slice(0, 8).map((t: string, i: number) => ({
          time: new Date(t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          temp: d.hourly.temperature_2m[i],
          rain: d.hourly.rain[i],
          windSpeed: d.hourly.wind_speed_10m[i],
          weatherCode: d.hourly.weather_code[i],
        }))
      );
    } catch (e) {
      console.error("Lỗi thời tiết:", e);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await axios.get("http://localhost:3000/api/weather-news");
      if (Array.isArray(res.data) && res.data.length > 0) {
        setNews(res.data);
      } else {
        // Nếu server trả về rỗng thì giữ tin cũ, không xoá
        setNews((prev) => prev.length > 0 ? prev : []);
      }
    } catch {
      // Giữ tin cũ nếu đang có, chỉ dùng fallback khi chưa có tin nào
      setNews((prev) =>
        prev.length > 0
          ? prev
          : [
              { id: "1", title: "Cảnh báo bão số 3 đổ bộ vào miền Trung", description: "Trung tâm Dự báo KTTV Quốc gia phát cảnh báo bão số 3 có thể đổ bộ vào các tỉnh miền Trung trong 48 giờ tới với sức gió cấp 12-13.", url: "https://nchmf.gov.vn", source: "nchmf.gov.vn", publishedAt: new Date(Date.now() - 3600000).toISOString(), category: "bao" },
              { id: "2", title: "Lũ lớn trên sông Hồng đạt báo động 2", description: "Mực nước sông Hồng tại Hà Nội vượt báo động 2, nhiều khu vực ven sông bị ngập.", url: "https://phongchongthientai.mard.gov.vn", source: "phongchongthientai.gov.vn", publishedAt: new Date(Date.now() - 7200000).toISOString(), category: "lu" },
              { id: "3", title: "Sạt lở đất nghiêm trọng tại Quảng Nam", description: "Mưa lớn kéo dài gây sạt lở tại huyện Nam Trà My. Lực lượng cứu hộ đang khẩn trương tìm kiếm nạn nhân.", url: "https://vnexpress.net", source: "VnExpress", publishedAt: new Date(Date.now() - 10800000).toISOString(), category: "sat_lo" },
              { id: "4", title: "Hạn hán kéo dài tại Tây Nguyên, thiếu nước sinh hoạt", description: "Nhiều tỉnh Tây Nguyên đang trải qua đợt hạn hán nghiêm trọng nhất 10 năm.", url: "https://tuoitre.vn", source: "Tuổi Trẻ", publishedAt: new Date(Date.now() - 86400000).toISOString(), category: "nang_han" },
              { id: "5", title: "Dự báo thời tiết cả nước ngày mai", description: "Bắc Bộ mưa rào và giông rải rác. Trung Bộ nắng nóng gay gắt 38-40°C. Nam Bộ chiều tối có mưa dông.", url: "https://nchmf.gov.vn", source: "nchmf.gov.vn", publishedAt: new Date(Date.now() - 1800000).toISOString(), category: "thoi_tiet" },
              { id: "6", title: "Áp thấp nhiệt đới có khả năng mạnh lên thành bão", description: "Áp thấp nhiệt đới trên biển Đông đang có xu hướng mạnh lên. Dự báo 24-48 giờ tới đạt cường độ bão cấp 8.", url: "https://nchmf.gov.vn", source: "nchmf.gov.vn", publishedAt: new Date(Date.now() - 5400000).toISOString(), category: "bao" },
            ]
      );
    } finally {
      setNewsLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

// Tự động định vị khi mở app
useEffect(() => {
  if (!navigator.geolocation) {
    setLocationLoading(false);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      // Tìm tỉnh gần nhất theo khoảng cách Euclidean
      let nearest = PROVINCES[0];
      let minDist = Infinity;
      for (const p of PROVINCES) {
        const dist = Math.pow(p.lat - latitude, 2) + Math.pow(p.lon - longitude, 2);
        if (dist < minDist) { minDist = dist; nearest = p; }
      }
      setSelectedProvince(nearest);
      setLocationLoading(false);
    },
    () => {
      // Từ chối hoặc lỗi → dùng mặc định
      setLocationLoading(false);
    },
    { timeout: 6000 }
  );
}, []);

useEffect(() => {
  if (locationLoading) return; // chờ định vị xong mới fetch
  fetchWeather(selectedProvince.lat, selectedProvince.lon);
  fetchNews();
  const interval = setInterval(() => {
    fetchWeather(selectedProvince.lat, selectedProvince.lon);
    fetchNews();
  }, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [selectedProvince, fetchWeather, fetchNews, locationLoading]);

  const handleSelectProvince = (province: typeof PROVINCES[0]) => {
    setSelectedProvince(province);
    setShowDropdown(false);
    setCurrent(null);
    fetchWeather(province.lat, province.lon);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchWeather(selectedProvince.lat, selectedProvince.lon), fetchNews()]);
    setRefreshing(false);
  };

  const filteredNews = (activeFilter === "all" ? news : news.filter((n) => n.category === activeFilter))
    .slice()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const gradientClass = current ? getWeatherGradient(current.weatherCode) : "from-blue-500 to-blue-700";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" onClick={() => setShowDropdown(false)}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-12">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
              <Newspaper className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                Tin tức thời tiết & Thiên tai
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <Clock size={11} />
                Cập nhật lúc {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  LIVE · 8 nguồn
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition shadow-sm"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        {/* THỜI TIẾT HIỆN TẠI */}
        <div className={`bg-gradient-to-br ${gradientClass} rounded-2xl p-6 mb-6 text-white shadow-lg`}>

          {/* Dropdown chọn tỉnh thành */}
          <div className="flex items-center justify-between mb-5">
            <div
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition px-3 py-1.5 rounded-xl text-sm font-medium"
              >
                <MapPin size={14} />
                {locationLoading ? "Đang định vị..." : selectedProvince.name}
                <ChevronDown size={14} className={`transition-transform ${showDropdown ? "rotate-180" : ""}`} />
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
                  <div className="p-2 max-h-72 overflow-y-auto">
                    <p className="text-xs text-slate-400 px-3 py-2 font-semibold uppercase tracking-wide">
                      34 Tỉnh thành Việt Nam 2025
                    </p>
                    {PROVINCES.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => handleSelectProvince(p)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition flex items-center gap-2 ${
                          selectedProvince.name === p.name
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className="text-sm opacity-70">
              {current ? getWeatherLabel(current.weatherCode) : "Đang tải..."}
            </span>
          </div>

          {/* Thông số thời tiết */}
          {current ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { icon: Thermometer, value: `${current.temp}°C`, label: "Nhiệt độ" },
                  { icon: Wind, value: `${current.windSpeed} km/h`, label: "Tốc độ gió" },
                  { icon: CloudRain, value: `${current.rain} mm`, label: "Lượng mưa" },
                  { icon: Droplets, value: `${current.humidity}%`, label: "Độ ẩm" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 flex items-center gap-3">
                    <item.icon size={22} className="opacity-90 shrink-0" />
                    <div>
                      <div className="text-xl font-bold leading-tight">{item.value}</div>
                      <div className="text-xs opacity-70">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dự báo theo giờ */}
              {forecast.length > 0 && (
                <div className="border-t border-white/20 pt-4">
                  <p className="text-xs opacity-70 mb-3">Dự báo theo giờ</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {forecast.map((f, i) => (
                      <div key={i} className="flex-shrink-0 text-center bg-white/10 hover:bg-white/20 transition rounded-xl px-3 py-2 min-w-[68px]">
                        <div className="text-xs opacity-70">{f.time}</div>
                        <div className="text-lg font-bold my-0.5">{f.temp}°</div>
                        <div className="text-xs opacity-60">{f.rain}mm</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-10 opacity-60">
              <RefreshCw size={24} className="animate-spin mr-3" />
              Đang tải dữ liệu thời tiết...
            </div>
          )}
        </div>

        {/* FILTER */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <SlidersHorizontal size={14} className="text-slate-400" />
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition border ${
              activeFilter === "all"
                ? "bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
            }`}
          >
            Tất cả ({news.length})
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const count = news.filter((n) => n.category === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition border ${
                  activeFilter === key
                    ? "bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* DANH SÁCH TIN TỨC */}
        {newsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 animate-pulse border border-slate-100 dark:border-slate-700">
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full w-1/3 mb-4" />
                <div className="h-5 bg-slate-100 dark:bg-slate-700 rounded-full w-full mb-2" />
                <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full w-5/6 mb-1" />
                <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <Newspaper size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">Không có tin tức nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNews.map((item) => {
              const cfg = CATEGORY_CONFIG[item.category];
              const Icon = cfg.icon;
              return (
                <div
                  key={item.id}
                  className={`group bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 border-l-4 ${cfg.card} hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>
                      <Icon size={11} />
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={11} />
                      {timeAgo(item.publishedAt)}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-snug mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed line-clamp-3 mb-4">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const realSource = extractSourceName(item.url, item.source);
                        const favicon = SOURCE_LOGOS[realSource]
                          || `https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(item.url).hostname; } catch { return ""; } })()}&sz=32`;
                        return (
                          <>
                            <img
                              src={favicon}
                              alt={realSource}
                              className="w-4 h-4 rounded object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <span className="text-xs text-slate-400">{realSource}</span>
                          </>
                        );
                      })()}
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors"
                    >
                      Xem chi tiết <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* NGUỒN CHÍNH THỨC */}
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <ExternalLink size={14} />
            Nguồn tin tức chính thức
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              { name: "Trung tâm Dự báo KTTV", url: "https://nchmf.gov.vn" },
              { name: "Phòng chống thiên tai", url: "https://phongchongthientai.mard.gov.vn" },
              { name: "VnExpress Thời tiết", url: "https://vnexpress.net/thoi-tiet" },
              { name: "Tuổi Trẻ", url: "https://tuoitre.vn" },
            ].map((src) => (
              <a
                key={src.name}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 transition"
              >
                {src.name} <ExternalLink size={11} />
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewsWeather;