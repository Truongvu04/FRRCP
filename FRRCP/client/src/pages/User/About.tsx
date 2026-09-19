import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../../components/Navbar";

import {
  Waves,
  Home,
  CheckCircle2,
  AlertTriangle,
  Info,
  Phone,
  Droplets,
  Utensils,
  Bug,
  Download,
  PlayCircle,
  ShieldCheck,
  ArrowRight,
  Siren,
  MapPin,
  ClipboardList,
  HomeIcon,
  Users2,
  BarChart3,
} from "lucide-react";

type PhaseCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: string[];
  accent: "blue" | "red" | "emerald";
  isUrgent?: boolean;
};

type HealthTipProps = {
  icon: React.ReactNode;
  title: string;
  desc: string;
};

const phaseAccentStyles = {
  blue: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    iconWrap:
      "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
    border:
      "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700",
    dot: "bg-blue-500",
  },
  red: {
    badge: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
    iconWrap:
      "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    border:
      "border-red-200 dark:border-red-900/60 hover:border-red-400 dark:hover:border-red-700",
    dot: "bg-red-500",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    iconWrap:
      "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    border:
      "border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700",
    dot: "bg-emerald-500",
  },
} as const;

function isRescueTeamRole(role?: string) {
  return ["rescuer", "rescue"].includes(String(role || "").toLowerCase());
}

function isAdminRole(role?: string) {
  return String(role || "").toLowerCase() === "admin";
}

function readCurrentUserRole() {
  return localStorage.getItem("role") || "";
}

const About: React.FC = () => {

  const [currentUserRole, setCurrentUserRole] = useState(readCurrentUserRole);

  useEffect(() => {
    const syncRole = () => {
      setCurrentUserRole(readCurrentUserRole());
    };

    window.addEventListener("storage", syncRole);
    window.addEventListener("auth-changed", syncRole as EventListener);
    window.addEventListener("focus", syncRole);

    return () => {
      window.removeEventListener("storage", syncRole);
      window.removeEventListener("auth-changed", syncRole as EventListener);
      window.removeEventListener("focus", syncRole);
    };
  }, []);

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

  const phases: PhaseCardProps[] = [
    {
      title: "Trước lũ",
      description: "Chuẩn bị sớm để giảm rủi ro khi thiên tai xảy ra.",
      icon: <Home className="w-6 h-6" />,
      accent: "blue",
      items: [
        "Chuẩn bị túi khẩn cấp và giấy tờ quan trọng",
        "Kê cao đồ điện tử, thực phẩm và thuốc men",
        "Theo dõi cảnh báo thời tiết, mực nước",
        "Xác định lộ trình sơ tán an toàn",
      ],
    },
    {
      title: "Trong lũ",
      description: "Ưu tiên giữ an toàn tính mạng cho bản thân và gia đình.",
      icon: <Waves className="w-6 h-6" />,
      accent: "red",
      isUrgent: true,
      items: [
        "Ngắt điện, gas nếu có thể thực hiện an toàn",
        "Di chuyển lên nơi cao, tránh vùng nước xiết",
        "Không đi qua cầu tràn hoặc khu vực ngập sâu",
        "Gửi yêu cầu SOS qua FRRP khi cần hỗ trợ",
      ],
    },
    {
      title: "Sau lũ",
      description: "Cẩn trọng với nguy cơ chập điện, ô nhiễm và dịch bệnh.",
      icon: <Info className="w-6 h-6" />,
      accent: "emerald",
      items: [
        "Chỉ quay lại khi có thông báo an toàn",
        "Kiểm tra điện, nước và kết cấu nhà ở",
        "Khử trùng nguồn nước sinh hoạt",
        "Theo dõi sức khỏe và vệ sinh môi trường",
      ],
    },
  ];

  const hotlineData = [
    { number: "112", label: "Cứu nạn khẩn cấp" },
    { number: "113", label: "Công an" },
    { number: "114", label: "Cứu hỏa - cứu nạn" },
    { number: "115", label: "Cấp cứu y tế" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_22%),radial-gradient(circle_at_bottom_center,_rgba(37,99,235,0.18),_transparent_30%)]" />
          <div className="absolute inset-0 opacity-20">
            <div className="absolute left-0 top-0 h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
          </div>

          <div className="relative z-10 grid gap-10 px-6 py-10 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-12 lg:py-14">
            <div className="flex flex-col justify-center">
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
                <ShieldCheck className="h-4 w-4" />
                Cổng thông tin an toàn cộng đồng
              </div>

              <h1 className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                Hướng dẫn an toàn mùa lũ
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Trang bị kiến thức cần thiết để bảo vệ bản thân, gia đình và
                cộng đồng trước, trong và sau thiên tai. Chủ động chuẩn bị sẽ
                giúp giảm thiểu thiệt hại và tăng khả năng ứng phó khi khẩn cấp.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-semibold text-slate-900 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-100">
                  <Download className="h-5 w-5" />
                  Tải cẩm nang PDF
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>

                <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/10">
                  <PlayCircle className="h-5 w-5" />
                  Xem video hướng dẫn
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
                  Cảnh báo sớm
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
                  Kỹ năng sơ tán
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
                  Hướng dẫn sức khỏe
                </span>
              </div>
            </div>

            <div className="grid gap-4 self-stretch">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-md">
                <div className="mb-3 inline-flex rounded-2xl bg-blue-500/15 p-3 text-blue-300">
                  <Siren className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Khi tình huống khẩn cấp xảy ra
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Giữ bình tĩnh, ưu tiên an toàn tính mạng, liên hệ cứu hộ và gửi
                  SOS ngay khi cần hỗ trợ.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-md">
                <div className="mb-3 inline-flex rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
                  <Waves className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Luôn theo dõi mực nước và cảnh báo
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Không chờ đến khi ngập sâu mới di chuyển. Chủ động sơ tán sớm
                  giúp giảm rủi ro đáng kể.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 p-5 backdrop-blur-md">
                <p className="text-sm font-medium text-blue-100">
                  Mẹo quan trọng:
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-100">
                  Sạc đầy điện thoại, chuẩn bị đèn pin, pin dự phòng, thuốc men
                  và nước sạch trước khi mưa lớn kéo dài.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Hướng dẫn theo giai đoạn
              </p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                Cần làm gì trong từng thời điểm?
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {phases.map((phase) => (
              <PhaseCard key={phase.title} {...phase} />
            ))}
          </div>
        </section>

        <section className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-8 text-white shadow-xl dark:border-slate-800">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.22),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.18),_transparent_26%)]" />
            <div className="relative z-10">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-300">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">
                    Liên hệ khẩn cấp
                  </p>
                  <h3 className="text-2xl font-black">Hotlines cứu hộ</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {hotlineData.map((item) => (
                  <div
                    key={item.number}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10"
                  >
                    <p className="text-sm text-slate-300">{item.label}</p>
                    <div className="mt-2 text-4xl font-black tracking-wide">
                      {item.number}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-sm leading-6 text-slate-300">
                Hãy gọi ngay khi có người gặp nạn, bị thương, mắc kẹt hoặc cần
                hỗ trợ cứu hộ khẩn cấp.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600 dark:text-amber-300">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                  Sức khỏe & vệ sinh
                </p>
                <h3 className="text-2xl font-black">
                  Phòng tránh rủi ro sau ngập lụt
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              <HealthTip
                icon={<Droplets className="h-5 w-5" />}
                title="Nguồn nước"
                desc="Đun sôi hoặc xử lý nước trước khi uống để hạn chế nguy cơ nhiễm khuẩn."
              />
              <HealthTip
                icon={<Utensils className="h-5 w-5" />}
                title="Thực phẩm"
                desc="Ưu tiên đồ ăn nấu chín, tránh thực phẩm đã ngâm nước hoặc có dấu hiệu hư hỏng."
              />
              <HealthTip
                icon={<Bug className="h-5 w-5" />}
                title="Dịch bệnh"
                desc="Cảnh giác với tiêu chảy, bệnh da liễu, sốt xuất huyết và vệ sinh môi trường sống sạch sẽ."
              />
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                Sau khi nước rút, nên vệ sinh nhà cửa, khử khuẩn bề mặt, xử lý
                rác thải đúng cách và theo dõi sức khỏe của trẻ nhỏ, người già.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="rounded-[28px] border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-6 shadow-sm dark:border-blue-900/40 dark:from-blue-950/40 dark:to-cyan-950/30">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Thông tin cấp tài khoản đội cứu hộ
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Tài khoản dành cho{" "}
                  <span className="font-semibold">đội cứu hộ</span> không hỗ trợ
                  tự đăng ký trên hệ thống. Để được cấp tài khoản và phân quyền
                  truy cập, vui lòng liên hệ{" "}
                  <span className="font-semibold">quản trị viên</span>.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="tel:0888100204"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Phone className="h-4 w-4" />
                    Liên hệ quản trị viên
                  </a>

                  <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    Admin sẽ xác minh và cấp quyền phù hợp
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
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
    </div>
  );
};

const PhaseCard: React.FC<PhaseCardProps> = ({
  title,
  description,
  icon,
  items,
  accent,
  isUrgent = false,
}) => {
  const styles = phaseAccentStyles[accent];

  return (
    <div
      className={`group rounded-[28px] border bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-slate-900 ${styles.border}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div
          className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${styles.iconWrap}`}
        >
          {icon}
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${styles.badge}`}
        >
          {isUrgent ? "Ưu tiên cao" : "Khuyến nghị"}
        </span>
      </div>

      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <div className="pt-1">
              {isUrgent ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <p className="text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
              {item}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 h-px w-full bg-slate-200 dark:bg-slate-800" />

      <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
        {isUrgent ? "Hành động ngay khi cần" : "Nên chuẩn bị sớm"}
      </div>
    </div>
  );
};

const HealthTip: React.FC<HealthTipProps> = ({ icon, title, desc }) => {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 p-4 transition-all duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-bold">{title}</h4>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {desc}
        </p>
      </div>
    </div>
  );
};

export default About;