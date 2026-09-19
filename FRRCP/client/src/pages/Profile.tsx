import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Navbar from "../components/Navbar";
import axios from "axios";
import {
  User,
  Lock,
  Phone,
  MapPin,
  Camera,
  ShieldCheck,
  Save,
  Eye,
  EyeOff,
  FileText,
  RefreshCw,
  KeyRound,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Mail,
  Link2,
  Send,
  BadgeCheck,
  ClipboardList,
  HomeIcon,
  Waves,
} from "lucide-react";

type EmailSource = "facebook" | "manual" | "facebook_placeholder" | null;

type ProfileType = {
  id?: number;
  full_name: string;
  phone: string;
  address: string;
  email?: string;
  avatar?: string;
  provider?: string | null;
  role?: string | null;
  has_password?: number | boolean;
  lat?: number | null;
  lng?: number | null;
  facebook_email?: string | null;
  email_source?: EmailSource;
};

type ToastType = "success" | "error" | "warning" | "info";

interface ToastState {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

const VIETNAM_PROVINCES_34 = [
  "Thành phố Hà Nội",
  "Tỉnh Cao Bằng",
  "Tỉnh Tuyên Quang",
  "Tỉnh Điện Biên",
  "Tỉnh Lai Châu",
  "Tỉnh Sơn La",
  "Tỉnh Lào Cai",
  "Tỉnh Thái Nguyên",
  "Tỉnh Lạng Sơn",
  "Tỉnh Quảng Ninh",
  "Tỉnh Bắc Ninh",
  "Tỉnh Phú Thọ",
  "Thành phố Hải Phòng",
  "Tỉnh Hưng Yên",
  "Tỉnh Ninh Bình",
  "Tỉnh Thanh Hóa",
  "Tỉnh Nghệ An",
  "Tỉnh Hà Tĩnh",
  "Tỉnh Quảng Trị",
  "Thành phố Huế",
  "Thành phố Đà Nẵng",
  "Tỉnh Quảng Ngãi",
  "Tỉnh Gia Lai",
  "Tỉnh Khánh Hòa",
  "Tỉnh Đắk Lắk",
  "Tỉnh Lâm Đồng",
  "Tỉnh Đồng Nai",
  "Thành phố Hồ Chí Minh",
  "Tỉnh Tây Ninh",
  "Tỉnh Đồng Tháp",
  "Tỉnh Vĩnh Long",
  "Tỉnh An Giang",
  "Thành phố Cần Thơ",
  "Tỉnh Cà Mau",
];

const API_URL = "http://localhost:3000";
const EMAIL_CODE_COOLDOWN = 60;
const FORGOT_PASSWORD_CODE_COOLDOWN = 60;

const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

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

      <div className="fixed top-5 inset-x-0 flex justify-center z-[10000] pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border shadow-2xl overflow-hidden bg-white dark:bg-slate-900",
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
}

function RequiredLabel({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}

export default function Profile() {
  const [tab, setTab] = useState<"info" | "password" | "email">("info");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const emptyProfile: ProfileType = {
    full_name: "",
    phone: "",
    address: "",
    email: "",
    avatar: "",
    provider: null,
    role: localStorage.getItem("role"),
    has_password: 1,
    lat: null,
    lng: null,
    facebook_email: null,
    email_source: null,
  };

  const emptyPassword = {
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  };

  const emptyForgotPassword = {
    verificationCode: "",
    newPassword: "",
    confirmPassword: "",
  };

  const emptyEmailForm = {
    newEmail: "",
    verificationCode: "",
  };

  const [profile, setProfile] = useState<ProfileType>(emptyProfile);
  const [initialProfile, setInitialProfile] =
    useState<ProfileType>(emptyProfile);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [password, setPassword] = useState(emptyPassword);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotPasswordForm, setForgotPasswordForm] =
    useState(emptyForgotPassword);
  const [forgotCodeSent, setForgotCodeSent] = useState(false);
  const [forgotPasswordCooldown, setForgotPasswordCooldown] = useState(0);
  const [sendingForgotPasswordCode, setSendingForgotPasswordCode] =
    useState(false);
  const [resettingForgotPassword, setResettingForgotPassword] = useState(false);

  const [showPassword, setShowPassword] = useState({
    old: false,
    next: false,
    confirm: false,
    forgotNew: false,
    forgotConfirm: false,
  });

  const [emailForm, setEmailForm] = useState(emptyEmailForm);

  const [codeSent, setCodeSent] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    message: "",
    type: "info",
    duration: 3000,
  });

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

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  const hasPassword = Boolean(
    Number(profile.has_password) || profile.has_password === true
  );

  const isFacebookUser = profile.provider === "facebook";

  const normalizeEmail = (value?: string | null) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const isPlaceholderSocialEmail = (value?: string | null) => {
    const email = normalizeEmail(value);
    return (
      email.endsWith("@facebook.local") || email.endsWith("@social.local")
    );
  };

  const hasRealEmail =
    Boolean(normalizeEmail(profile.email)) &&
    !isPlaceholderSocialEmail(profile.email);

  const displayEmail = hasRealEmail ? profile.email || "" : "";

  const isFacebookEmailLocked = profile.email_source === "facebook";

  const canEditEmail = !isFacebookEmailLocked;

  const accountLabel =
    profile.role === "admin"
      ? "Quản trị viên"
      : profile.role === "rescuer"
        ? "Đội cứu hộ"
        : isFacebookUser
          ? "Đăng nhập bằng Facebook"
          : "Người dùng thường";

  const avatarUrl = avatarPreview
    ? avatarPreview
    : profile.avatar
      ? profile.avatar.startsWith("http")
        ? profile.avatar
        : `${API_URL}${profile.avatar}`
      : "";

  const isProfileChanged =
    profile.full_name !== initialProfile.full_name ||
    profile.phone !== initialProfile.phone ||
    profile.address !== initialProfile.address ||
    profile.lat !== initialProfile.lat ||
    profile.lng !== initialProfile.lng ||
    avatarFile !== null;

  const isPasswordDirty =
    password.oldPassword.trim() ||
    password.newPassword.trim() ||
    password.confirmPassword.trim();

  const isEmailDirty =
    emailForm.newEmail.trim() || emailForm.verificationCode.trim();

  const inputStyle =
    "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-10 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40";

  const passwordInputStyle =
    "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pr-11 py-3 text-sm text-slate-800 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/40 placeholder:text-slate-400 dark:placeholder:text-slate-500";

  const emailInputStyle =
    "w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-10 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/40";

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const cooldownProgress =
    emailCooldown > 0 ? (emailCooldown / EMAIL_CODE_COOLDOWN) * 100 : 0;

  const forgotCooldownProgress =
    forgotPasswordCooldown > 0
      ? (forgotPasswordCooldown / FORGOT_PASSWORD_CODE_COOLDOWN) * 100
      : 0;

  const resetPasswordForm = () => {
    setPassword(emptyPassword);
    setShowPassword((prev) => ({
      ...prev,
      old: false,
      next: false,
      confirm: false,
    }));
  };

  const resetForgotPasswordForm = () => {
    setForgotPasswordForm(emptyForgotPassword);
    setForgotCodeSent(false);
    setForgotPasswordCooldown(0);
    setShowPassword((prev) => ({
      ...prev,
      forgotNew: false,
      forgotConfirm: false,
    }));
  };

  const resetEmailForm = () => {
    setEmailForm(emptyEmailForm);
    setCodeSent(false);
    setEmailCooldown(0);
  };

  const switchTab = (nextTab: "info" | "password" | "email") => {
    if (nextTab !== tab) {
      resetProfileForm();
      resetPasswordForm();
      resetForgotPasswordForm();
      resetEmailForm();
      setForgotMode(false);
    }
    setTab(nextTab);
  };

  const fetchProfile = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const token = localStorage.getItem("token");

      const res = await axios.get(`${API_URL}/api/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const fetchedProfile: ProfileType = {
        id: res.data.id,
        full_name: res.data.full_name ?? "",
        phone: res.data.phone ?? "",
        address: res.data.address ?? "",
        email: res.data.email ?? "",
        avatar: res.data.avatar ?? "",
        provider: res.data.provider ?? null,
        role: res.data.role || localStorage.getItem("role") || null,
        has_password: res.data.has_password ?? 1,
        lat: res.data.lat ?? null,
        lng: res.data.lng ?? null,
        facebook_email: res.data.facebook_email ?? null,
        email_source: res.data.email_source ?? null,
      };

      setProfile(fetchedProfile);
      setInitialProfile(fetchedProfile);

      if (hasRealEmail && fetchedProfile.email) {
        localStorage.setItem("email", fetchedProfile.email);
      } else {
        localStorage.removeItem("email");
      }

      const displayName =
        fetchedProfile.full_name || (hasRealEmail ? fetchedProfile.email : "") || "";
      if (displayName) {
        localStorage.setItem("displayName", displayName);
      }

      window.dispatchEvent(new Event("auth-changed"));
      resetEmailForm();
    } catch (err) {
      console.log("Profile error:", err);
      showToast("Không tải được thông tin hồ sơ", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile(false);
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    if (emailCooldown <= 0) return;

    const timer = setInterval(() => {
      setEmailCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    if (forgotPasswordCooldown <= 0) return;

    const timer = setInterval(() => {
      setForgotPasswordCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [forgotPasswordCooldown]);

  const handleFullNameChange = (value: string) => {
    setProfile((prev) => ({ ...prev, full_name: value }));
  };

  const handlePhoneChange = (value: string) => {
    const clean = value.replace(/[^0-9]/g, "");
    if (clean.length === 1 && clean !== "0") return;
    if (clean.length > 10) return;
    setProfile((prev) => ({ ...prev, phone: clean }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      showToast("Chỉ được chọn ảnh jpg, jpeg, png hoặc webp", "warning");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Ảnh tối đa 5MB", "warning");
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const cancelProfileChanges = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setProfile(initialProfile);
    setAvatarFile(null);
    setAvatarPreview("");
  };

  const resetProfileForm = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setProfile(initialProfile);
    setAvatarFile(null);
    setAvatarPreview("");
  };

  const updateProfile = async () => {
    try {
      if (!profile.full_name.trim()) {
        showToast("Vui lòng nhập họ và tên!", "warning");
        return;
      }

      if (!profile.phone.trim()) {
        showToast("Vui lòng nhập số điện thoại!", "warning");
        return;
      }

      const phoneRegex = /^0\d{9}$/;
      if (!phoneRegex.test(profile.phone.trim())) {
        showToast("Số điện thoại phải gồm 10 số và bắt đầu bằng 0", "warning");
        return;
      }

      if (!profile.address.trim()) {
        showToast("Vui lòng chọn tỉnh / thành phố", "warning");
        return;
      }

      setSavingProfile(true);

      const token = localStorage.getItem("token");

      const formData = new FormData();
      formData.append("full_name", profile.full_name || "");
      formData.append("phone", profile.phone || "");
      formData.append("address", profile.address || "");

      if (profile.lat !== null && profile.lat !== undefined) {
        formData.append("lat", String(profile.lat));
      }

      if (profile.lng !== null && profile.lng !== undefined) {
        formData.append("lng", String(profile.lng));
      }

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const res = await axios.put(`${API_URL}/api/profile`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.data?.profile) {
        const updatedProfile: ProfileType = {
          id: res.data.profile.id ?? profile.id,
          full_name: res.data.profile.full_name ?? "",
          phone: res.data.profile.phone ?? "",
          address: res.data.profile.address ?? "",
          email: res.data.profile.email ?? profile.email ?? "",
          avatar: res.data.profile.avatar ?? "",
          provider: res.data.profile.provider ?? null,
          has_password: res.data.profile.has_password ?? profile.has_password,
          role: res.data.profile.role ?? profile.role,
          lat: res.data.profile.lat ?? null,
          lng: res.data.profile.lng ?? null,
          facebook_email:
            res.data.profile.facebook_email ?? profile.facebook_email ?? null,
          email_source:
            res.data.profile.email_source ?? profile.email_source ?? null,
        };

        setProfile(updatedProfile);
        setInitialProfile(updatedProfile);

        if (
          updatedProfile.email &&
          !isPlaceholderSocialEmail(updatedProfile.email)
        ) {
          localStorage.setItem("email", updatedProfile.email);
        } else {
          localStorage.removeItem("email");
        }

        const displayName =
          updatedProfile.full_name ||
          (!isPlaceholderSocialEmail(updatedProfile.email)
            ? updatedProfile.email || ""
            : "");
        if (displayName) {
          localStorage.setItem("displayName", displayName);
        }
      }

      window.dispatchEvent(new Event("auth-changed"));

      showToast(res.data?.message || "Cập nhật thành công", "success");
      setAvatarFile(null);
      setAvatarPreview("");
      await fetchProfile(true);
    } catch (err: any) {
      console.log(err);

      const message = err?.response?.data?.message || "";

      if (
        message.includes("Số điện thoại đã được sử dụng") ||
        message.includes("số điện thoại đã được sử dụng")
      ) {
        showToast(
          "Số điện thoại đã được sử dụng. Vui lòng nhập số khác!",
          "warning"
        );
        return;
      }

      showToast(message || "Cập nhật thất bại", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (hasPassword && !password.oldPassword.trim()) {
      showToast("Vui lòng nhập mật khẩu hiện tại!", "warning");
      return;
    }

    if (!password.newPassword.trim()) {
      showToast("Vui lòng nhập mật khẩu mới!", "warning");
      return;
    }

    if (!password.confirmPassword.trim()) {
      showToast("Vui lòng nhập xác nhận mật khẩu!", "warning");
      return;
    }

    if (password.newPassword.length < 6) {
      showToast("Mật khẩu mới phải có ít nhất 6 ký tự!", "warning");
      return;
    }

    if (password.newPassword !== password.confirmPassword) {
      showToast("Mật khẩu mới không khớp. Vui lòng nhập lại!", "warning");
      return;
    }

    try {
      setSavingPassword(true);

      const token = localStorage.getItem("token");

      const res = await axios.put(
        `${API_URL}/api/change-password`,
        {
          oldPassword: password.oldPassword,
          newPassword: password.newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      showToast(res.data?.message || "Cập nhật mật khẩu thành công", "success");
      resetPasswordForm();

      setProfile((prev) => ({
        ...prev,
        has_password: 1,
      }));
    } catch (err: any) {
      const message = err?.response?.data?.message || "";

      if (
        message.includes("Mật khẩu hiện tại không đúng!") ||
        message.includes("mật khẩu hiện tại không đúng!")
      ) {
        showToast(message, "warning");
      } else {
        showToast(message || "Đổi mật khẩu thất bại", "error");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const sendForgotPasswordCode = async () => {
    const currentEmail = normalizeEmail(profile.email);

    if (!currentEmail || isPlaceholderSocialEmail(currentEmail)) {
      showToast(
        "Tài khoản này chưa có email. Vui lòng cập nhật email trước khi dùng chức năng này.",
        "warning"
      );
      return;
    }

    if (!isValidEmail(currentEmail)) {
      showToast("Email tài khoản hiện tại không hợp lệ", "warning");
      return;
    }

    if (forgotPasswordCooldown > 0) {
      showToast(
        `Vui lòng chờ ${forgotPasswordCooldown}s để gửi lại mã`,
        "warning"
      );
      return;
    }

    try {
      setSendingForgotPasswordCode(true);

      const res = await axios.post(`${API_URL}/api/send-forgot-password-code`, {
        email: currentEmail,
      });

      showToast(
        res.data?.message || "Đã gửi mã đặt lại mật khẩu về email",
        "success"
      );
      setForgotCodeSent(true);
      setForgotPasswordCooldown(FORGOT_PASSWORD_CODE_COOLDOWN);
    } catch (err: any) {
      const message = err?.response?.data?.message || "";

      if (
        message.includes("Email không tồn tại trong hệ thống") ||
        message.includes("email không tồn tại trong hệ thống") ||
        message.includes("Tài khoản này chưa có mật khẩu") ||
        message.includes("tài khoản này chưa có mật khẩu") ||
        message.includes("chưa có email")
      ) {
        showToast(message, "warning");
      } else {
        showToast(message || "Không gửi được mã đặt lại mật khẩu", "error");
      }
    } finally {
      setSendingForgotPasswordCode(false);
    }
  };

  const confirmForgotPasswordReset = async () => {
    const currentEmail = normalizeEmail(profile.email);

    if (!currentEmail || isPlaceholderSocialEmail(currentEmail)) {
      showToast(
        "Tài khoản này chưa có email. Vui lòng cập nhật email trước khi dùng chức năng này.",
        "warning"
      );
      return;
    }

    if (!forgotPasswordForm.verificationCode.trim()) {
      showToast("Vui lòng nhập mã xác minh!", "warning");
      return;
    }

    if (forgotPasswordForm.verificationCode.trim().length !== 6) {
      showToast("Mã xác minh phải gồm 6 số", "warning");
      return;
    }

    if (!forgotPasswordForm.newPassword.trim()) {
      showToast("Vui lòng nhập mật khẩu mới!", "warning");
      return;
    }

    if (forgotPasswordForm.newPassword.length < 6) {
      showToast("Mật khẩu mới phải có ít nhất 6 ký tự", "warning");
      return;
    }

    if (!forgotPasswordForm.confirmPassword.trim()) {
      showToast("Vui lòng nhập lại mật khẩu mới!", "warning");
      return;
    }

    if (
      forgotPasswordForm.newPassword !== forgotPasswordForm.confirmPassword
    ) {
      showToast("Mật khẩu mới không khớp. Vui lòng nhập lại!", "warning");
      return;
    }

    try {
      setResettingForgotPassword(true);

      const res = await axios.post(`${API_URL}/api/reset-password`, {
        email: currentEmail,
        verificationCode: forgotPasswordForm.verificationCode.trim(),
        newPassword: forgotPasswordForm.newPassword,
      });

      showToast(res.data?.message || "Đặt lại mật khẩu thành công", "success");

      setProfile((prev) => ({
        ...prev,
        has_password: 1,
      }));

      setForgotMode(false);
      resetForgotPasswordForm();
      resetPasswordForm();
    } catch (err: any) {
      const message = err?.response?.data?.message || "";

      if (
        message.includes("Mã xác minh không đúng") ||
        message.includes("mã xác minh không đúng") ||
        message.includes("Mã xác minh đã hết hạn") ||
        message.includes("mã xác minh đã hết hạn") ||
        message.includes("chưa có email")
      ) {
        showToast(message, "warning");
      } else {
        showToast(message || "Không thể đặt lại mật khẩu", "error");
      }
    } finally {
      setResettingForgotPassword(false);
    }
  };

  const cancelForgotPasswordFlow = () => {
    setForgotMode(false);
    resetForgotPasswordForm();
  };

  const sendChangeEmailCode = async () => {
    if (!canEditEmail) {
      showToast(
        "Tài khoản này đã lấy email từ Facebook nên không thể sửa tại đây",
        "warning"
      );
      return;
    }

    if (emailCooldown > 0) {
      showToast(`Vui lòng chờ ${emailCooldown}s để gửi lại mã`, "warning");
      return;
    }

    if (!emailForm.newEmail.trim()) {
      showToast("Vui lòng nhập email mới!", "warning");
      return;
    }

    if (!isValidEmail(emailForm.newEmail.trim())) {
      showToast("Email mới không hợp lệ!", "warning");
      return;
    }

    if (
      emailForm.newEmail.trim().toLowerCase() ===
      normalizeEmail(profile.email)
    ) {
      showToast("Email mới phải khác email hiện tại!", "warning");
      return;
    }

    try {
      setSendingEmailCode(true);

      const token = localStorage.getItem("token");

      const res = await axios.post(
        `${API_URL}/api/send-change-email-code`,
        {
          newEmail: emailForm.newEmail.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      showToast(
        res.data?.message || "Đã gửi mã xác minh đến email mới",
        "success"
      );
      setCodeSent(true);
      setEmailCooldown(EMAIL_CODE_COOLDOWN);
    } catch (err: any) {
      const message = err?.response?.data?.message || "";

      if (
        message.includes("Email đã được sử dụng") ||
        message.includes("email đã được sử dụng") ||
        message.includes("Email đã tồn tại") ||
        message.includes("email đã tồn tại")
      ) {
        showToast(message, "warning");
      } else {
        showToast(message || "Không gửi được mã xác minh email", "error");
      }
    } finally {
      setSendingEmailCode(false);
    }
  };

  const confirmChangeEmail = async () => {
    if (!canEditEmail) {
      showToast(
        "Tài khoản này đã lấy email từ Facebook nên không thể sửa tại đây",
        "warning"
      );
      return;
    }

    if (!emailForm.newEmail.trim()) {
      showToast("Vui lòng nhập email mới", "warning");
      return;
    }

    if (!isValidEmail(emailForm.newEmail.trim())) {
      showToast("Email mới không hợp lệ!", "warning");
      return;
    }

    if (!emailForm.verificationCode.trim()) {
      showToast("Vui lòng nhập mã xác minh email!", "warning");
      return;
    }

    if (emailForm.verificationCode.trim().length !== 6) {
      showToast("Mã xác minh email phải gồm 6 số", "warning");
      return;
    }

    try {
      setChangingEmail(true);

      const token = localStorage.getItem("token");

      const res = await axios.put(
        `${API_URL}/api/change-email`,
        {
          newEmail: emailForm.newEmail.trim(),
          verificationCode: emailForm.verificationCode.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const newEmailValue = emailForm.newEmail.trim().toLowerCase();

      showToast(res.data?.message || "Đổi email thành công", "success");
      resetEmailForm();

      setProfile((prev) => ({
        ...prev,
        email: newEmailValue,
        email_source: "manual",
      }));

      localStorage.setItem("email", newEmailValue);
      localStorage.setItem(
        "displayName",
        profile.full_name || newEmailValue || ""
      );
      window.dispatchEvent(new Event("auth-changed"));

      await fetchProfile(true);
    } catch (err: any) {
      const message = err?.response?.data?.message || "";

      if (
        message.includes("Email đã được sử dụng") ||
        message.includes("email đã được sử dụng") ||
        message.includes("Email đã tồn tại") ||
        message.includes("email đã tồn tại") ||
        message.includes("Email mới phải khác email hiện tại!") ||
        message.includes("email mới phải khác email hiện tại!")
      ) {
        showToast(message, "warning");
      } else {
        showToast(message || "Đổi email thất bại", "error");
      }
    } finally {
      setChangingEmail(false);
    }
  };

  const cancelEmailFlow = () => {
    resetEmailForm();
  };

  const cancelPasswordFlow = () => {
    resetPasswordForm();
  };

  const emailStatusText =
    profile.email_source === "facebook"
      ? "Email đã xác minh qua Facebook"
      : profile.email_source === "manual"
        ? "Email đã xác minh"
        : profile.email_source === "facebook_placeholder"
          ? "Chưa có email"
          : hasRealEmail
            ? "Email đã xác minh"
            : "Chưa có email xác minh";

  const emailStatusClass =
    profile.email_source === "facebook" || profile.email_source === "manual" || hasRealEmail
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50"
      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50";

  const emailHelperText = isFacebookEmailLocked
    ? "Email này được lấy từ Facebook và đã được khóa chỉnh sửa."
    : profile.email_source === "facebook_placeholder"
      ? "Facebook không trả về email cho tài khoản này. Bạn có thể thêm email tại đây để dùng quên mật khẩu và đăng nhập bằng email."
      : isFacebookUser && !hasRealEmail
        ? "Tài khoản Facebook của bạn chưa lấy được email. Bạn có thể thêm email tại đây và xác minh bằng mã."
        : !isFacebookUser && !hasRealEmail
          ? "Bạn chưa có email xác minh. Hãy thêm email để bảo mật tài khoản tốt hơn."
          : "Bạn có thể đổi sang email khác bằng cách xác minh email mới.";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <NotificationToast toast={toast} onClose={closeToast} />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10 space-y-8">
        <div className="max-w-6xl mx-auto">
          <section className="mb-6 relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_24%)]" />

            <div className="relative px-5 md:px-6 py-5 md:py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-slate-200 mb-3">
                  <ShieldCheck size={14} />
                  Trang cá nhân
                </div>

                <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                  HỒ SƠ & BẢO MẬT TÀI KHOẢN
                </h1>

                <p className="mt-2 text-sm md:text-base text-slate-300 leading-6">
                  Cập nhật thông tin cá nhân, ảnh đại diện, mật khẩu và trạng thái
                  xác minh email của tài khoản.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                    <FileText size={13} />
                    Hồ sơ cá nhân
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                    <KeyRound size={13} />
                    Bảo mật tài khoản
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 border border-white/10">
                    <Mail size={13} />
                    Liên kết & email
                  </span>
                </div>
              </div>

              <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => fetchProfile(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm transition"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Làm mới
                </button>

                <button
                  onClick={() =>
                    switchTab(
                      tab === "info"
                        ? "password"
                        : tab === "password"
                          ? "email"
                          : "info"
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:scale-[1.02] transition shadow-md"
                >
                  {tab === "info" ? (
                    <Lock size={16} />
                  ) : tab === "password" ? (
                    <Mail size={16} />
                  ) : (
                    <User size={16} />
                  )}
                  {tab === "info"
                    ? "Đổi mật khẩu"
                    : tab === "password"
                      ? "Liên kết & email"
                      : "Chỉnh hồ sơ"}
                </button>
              </div>
            </div>
          </section>

          <div className="grid lg:grid-cols-[320px_1fr] gap-5">
            <aside className="space-y-5">
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                <div className="relative w-fit mx-auto">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 via-cyan-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-slate-800 shadow-lg">
                      {(profile.full_name || displayEmail || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-md hover:scale-105 transition"
                    title="Đổi ảnh đại diện"
                  >
                    <Camera size={15} />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className="text-center mt-4">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {profile.full_name || displayEmail || "Người dùng"}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {displayEmail || "Chưa có email"}
                  </p>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 text-xs font-medium border border-blue-100 dark:border-blue-900/50">
                    <ShieldCheck size={14} />
                    {accountLabel}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-2.5">
                <button
                  onClick={() => switchTab("info")}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left transition text-sm",
                    tab === "info"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <User size={16} />
                  <span className="font-medium">Thông tin cá nhân</span>
                </button>

                <button
                  onClick={() => switchTab("password")}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left transition mt-2 text-sm",
                    tab === "password"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Lock size={16} />
                  <span className="font-medium">Đổi mật khẩu</span>
                </button>

                <button
                  onClick={() => switchTab("email")}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left transition mt-2 text-sm",
                    tab === "email"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Link2 size={16} />
                  <span className="font-medium">Liên kết & email</span>
                </button>
              </div>
            </aside>

            <section>
              {loading ? (
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-slate-700 dark:text-slate-200 text-sm flex items-center gap-3">
                  <Loader2 size={20} className="animate-spin" />
                  Đang tải hồ sơ...
                </div>
              ) : (
                <>
                  {tab === "info" && (
                    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                        <h3 className="text-base font-semibold">
                          Thông tin cá nhân
                        </h3>
                        <p className="text-xs text-blue-50 mt-1">
                          Chỉnh sửa dữ liệu hiển thị trên tài khoản của bạn
                        </p>
                      </div>

                      <div className="p-5 md:p-6 space-y-5">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="relative">
                            <RequiredLabel required>Họ và tên</RequiredLabel>
                            <User
                              size={16}
                              className="absolute left-3.5 top-[44px] text-slate-400 dark:text-slate-500"
                            />
                            <input
                              value={profile.full_name || ""}
                              onChange={(e) =>
                                handleFullNameChange(e.target.value)
                              }
                              className={inputStyle}
                              placeholder="Nhập họ và tên"
                              maxLength={50}
                            />
                          </div>

                          <div className="relative">
                            <RequiredLabel required>Số điện thoại</RequiredLabel>
                            <Phone
                              size={16}
                              className="absolute left-3.5 top-[44px] text-slate-400 dark:text-slate-500"
                            />
                            <input
                              value={profile.phone || ""}
                              onChange={(e) => handlePhoneChange(e.target.value)}
                              className={inputStyle}
                              placeholder="Nhập số điện thoại"
                              maxLength={10}
                            />
                          </div>

                          <div className="relative md:col-span-2">
                            <RequiredLabel required>Tỉnh / thành phố</RequiredLabel>

                            <MapPin
                              size={16}
                              className="absolute left-3.5 top-[44px] text-slate-400 dark:text-slate-500 pointer-events-none"
                            />

                            <select
                              value={profile.address || ""}
                              onChange={(e) =>
                                setProfile((prev) => ({
                                  ...prev,
                                  address: e.target.value,
                                }))
                              }
                              className={`${inputStyle} appearance-none pr-10`}
                            >
                              <option value="">Chọn tỉnh / thành phố</option>
                              {VIETNAM_PROVINCES_34.map((province) => (
                                <option key={province} value={province}>
                                  {province}
                                </option>
                              ))}
                            </select>

                            <div className="pointer-events-none absolute right-3.5 top-[44px] text-slate-400 dark:text-slate-500">
                              ▼
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                          {isProfileChanged && (
                            <button
                              type="button"
                              onClick={cancelProfileChanges}
                              disabled={savingProfile}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm text-slate-700 dark:text-slate-200 font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
                            >
                              <XCircle size={16} />
                              Hủy
                            </button>
                          )}

                          <button
                            onClick={updateProfile}
                            disabled={savingProfile}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm text-white font-semibold shadow-md hover:opacity-95 transition disabled:opacity-60"
                          >
                            {savingProfile ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}
                            {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === "password" && (
                    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                        <h3 className="text-base font-semibold">
                          {forgotMode
                            ? "Quên mật khẩu - xác minh qua email"
                            : hasPassword
                              ? "Đổi mật khẩu"
                              : "Tạo mật khẩu mới"}
                        </h3>
                        <p className="text-xs text-slate-200 mt-1">
                          {forgotMode
                            ? "Nhận mã qua email hiện tại để đặt lại mật khẩu"
                            : "Bảo vệ tài khoản của bạn bằng mật khẩu mạnh hơn"}
                        </p>
                      </div>

                      <div className="p-5 md:p-6 space-y-4">
                        {!forgotMode ? (
                          <>
                            {!hasPassword && (
                              <div className="rounded-2xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
                                {isFacebookUser
                                  ? "Tài khoản Facebook của bạn chưa có mật khẩu. Hãy tạo mật khẩu để lần sau có thể đăng nhập dễ hơn bằng email."
                                  : "Tài khoản của bạn chưa có mật khẩu. Hãy tạo mật khẩu mới."}
                              </div>
                            )}

                            {hasPassword && (
                              <div>
                                <RequiredLabel required={hasPassword}>
                                  Mật khẩu hiện tại
                                </RequiredLabel>

                                <div className="relative">
                                  <input
                                    type={showPassword.old ? "text" : "password"}
                                    value={password.oldPassword}
                                    onChange={(e) =>
                                      setPassword((prev) => ({
                                        ...prev,
                                        oldPassword: e.target.value,
                                      }))
                                    }
                                    className={passwordInputStyle}
                                    placeholder="Nhập mật khẩu hiện tại"
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowPassword((prev) => ({
                                        ...prev,
                                        old: !prev.old,
                                      }))
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                  >
                                    {showPassword.old ? (
                                      <EyeOff size={18} />
                                    ) : (
                                      <Eye size={18} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            <div>
                              <RequiredLabel required>Mật khẩu mới</RequiredLabel>

                              <div className="relative">
                                <input
                                  type={showPassword.next ? "text" : "password"}
                                  value={password.newPassword}
                                  onChange={(e) =>
                                    setPassword((prev) => ({
                                      ...prev,
                                      newPassword: e.target.value,
                                    }))
                                  }
                                  className={passwordInputStyle}
                                  placeholder="Nhập mật khẩu mới"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowPassword((prev) => ({
                                      ...prev,
                                      next: !prev.next,
                                    }))
                                  }
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                  {showPassword.next ? (
                                    <EyeOff size={18} />
                                  ) : (
                                    <Eye size={18} />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div>
                              <RequiredLabel required>
                                Nhập lại mật khẩu mới
                              </RequiredLabel>

                              <div className="relative">
                                <input
                                  type={
                                    showPassword.confirm ? "text" : "password"
                                  }
                                  value={password.confirmPassword}
                                  onChange={(e) =>
                                    setPassword((prev) => ({
                                      ...prev,
                                      confirmPassword: e.target.value,
                                    }))
                                  }
                                  className={passwordInputStyle}
                                  placeholder="Nhập lại mật khẩu mới"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowPassword((prev) => ({
                                      ...prev,
                                      confirm: !prev.confirm,
                                    }))
                                  }
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                  {showPassword.confirm ? (
                                    <EyeOff size={18} />
                                  ) : (
                                    <Eye size={18} />
                                  )}
                                </button>
                              </div>
                            </div>

                            {hasPassword && (
                              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <div className="text-sm text-blue-800 dark:text-blue-200">
                                    Nếu bạn không nhớ mật khẩu hiện tại, hãy dùng
                                    mã xác minh gửi về email.
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!hasRealEmail) {
                                        showToast(
                                          "Tài khoản chưa có email. Vui lòng cập nhật email trước.",
                                          "warning"
                                        );
                                        return;
                                      }
                                      setForgotMode(true);
                                      resetPasswordForm();
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300 dark:border-blue-800 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-blue-900/30 transition"
                                  >
                                    <Mail size={15} />
                                    Quên mật khẩu hiện tại?
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end gap-3 pt-1">
                              {Boolean(isPasswordDirty) && (
                                <button
                                  type="button"
                                  onClick={cancelPasswordFlow}
                                  disabled={savingPassword}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm text-slate-700 dark:text-slate-200 font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
                                >
                                  <XCircle size={16} />
                                  Hủy
                                </button>
                              )}

                              <button
                                onClick={changePassword}
                                disabled={savingPassword}
                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-3 text-sm text-white dark:text-slate-900 font-semibold shadow-md hover:opacity-95 transition disabled:opacity-60"
                              >
                                {savingPassword && (
                                  <Loader2 size={16} className="animate-spin" />
                                )}
                                {savingPassword
                                  ? "Đang xử lý..."
                                  : hasPassword
                                    ? "Cập nhật mật khẩu"
                                    : "Tạo mật khẩu"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <RequiredLabel>Email hiện tại</RequiredLabel>
                              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                                {displayEmail || "Chưa có email"}
                              </div>
                            </div>

                            <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
                              <div>
                                <RequiredLabel required>Mã xác minh</RequiredLabel>
                                <input
                                  type="text"
                                  value={forgotPasswordForm.verificationCode}
                                  onChange={(e) =>
                                    setForgotPasswordForm((prev) => ({
                                      ...prev,
                                      verificationCode: e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 6),
                                    }))
                                  }
                                  className={passwordInputStyle}
                                  placeholder="Nhập mã 6 số"
                                  maxLength={6}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={sendForgotPasswordCode}
                                disabled={
                                  sendingForgotPasswordCode ||
                                  forgotPasswordCooldown > 0
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-3 text-sm text-white dark:text-slate-900 font-semibold shadow-md hover:opacity-95 transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap min-w-[170px]"
                              >
                                {sendingForgotPasswordCode ? (
                                  <>
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                    Đang gửi...
                                  </>
                                ) : forgotPasswordCooldown > 0 ? (
                                  <>
                                    <span className="relative inline-flex items-center justify-center w-5 h-5">
                                      <svg
                                        className="w-5 h-5 -rotate-90"
                                        viewBox="0 0 36 36"
                                      >
                                        <circle
                                          cx="18"
                                          cy="18"
                                          r="15.5"
                                          fill="none"
                                          stroke="rgba(255,255,255,0.25)"
                                          strokeWidth="3"
                                        />
                                        <circle
                                          cx="18"
                                          cy="18"
                                          r="15.5"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="3"
                                          strokeLinecap="round"
                                          strokeDasharray={`${forgotCooldownProgress} 100`}
                                          pathLength="100"
                                        />
                                      </svg>
                                    </span>
                                    Gửi lại ({forgotPasswordCooldown}s)
                                  </>
                                ) : (
                                  <>
                                    <Send size={16} />
                                    {forgotCodeSent ? "Gửi lại mã" : "Gửi mã"}
                                  </>
                                )}
                              </button>
                            </div>

                            <div>
                              <RequiredLabel required>Mật khẩu mới</RequiredLabel>

                              <div className="relative">
                                <input
                                  type={
                                    showPassword.forgotNew
                                      ? "text"
                                      : "password"
                                  }
                                  value={forgotPasswordForm.newPassword}
                                  onChange={(e) =>
                                    setForgotPasswordForm((prev) => ({
                                      ...prev,
                                      newPassword: e.target.value,
                                    }))
                                  }
                                  className={passwordInputStyle}
                                  placeholder="Nhập mật khẩu mới"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowPassword((prev) => ({
                                      ...prev,
                                      forgotNew: !prev.forgotNew,
                                    }))
                                  }
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                  {showPassword.forgotNew ? (
                                    <EyeOff size={18} />
                                  ) : (
                                    <Eye size={18} />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div>
                              <RequiredLabel required>
                                Nhập lại mật khẩu mới
                              </RequiredLabel>

                              <div className="relative">
                                <input
                                  type={
                                    showPassword.forgotConfirm
                                      ? "text"
                                      : "password"
                                  }
                                  value={forgotPasswordForm.confirmPassword}
                                  onChange={(e) =>
                                    setForgotPasswordForm((prev) => ({
                                      ...prev,
                                      confirmPassword: e.target.value,
                                    }))
                                  }
                                  className={passwordInputStyle}
                                  placeholder="Nhập lại mật khẩu mới"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowPassword((prev) => ({
                                      ...prev,
                                      forgotConfirm: !prev.forgotConfirm,
                                    }))
                                  }
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                  {showPassword.forgotConfirm ? (
                                    <EyeOff size={18} />
                                  ) : (
                                    <Eye size={18} />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-1">
                              <button
                                type="button"
                                onClick={cancelForgotPasswordFlow}
                                disabled={
                                  resettingForgotPassword || sendingForgotPasswordCode
                                }
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm text-slate-700 dark:text-slate-200 font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
                              >
                                <XCircle size={16} />
                                Hủy
                              </button>

                              <button
                                type="button"
                                onClick={confirmForgotPasswordReset}
                                disabled={resettingForgotPassword}
                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-3 text-sm text-white dark:text-slate-900 font-semibold shadow-md hover:opacity-95 transition disabled:opacity-60"
                              >
                                {resettingForgotPassword ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <KeyRound size={16} />
                                )}
                                {resettingForgotPassword
                                  ? "Đang đặt lại..."
                                  : "Đặt lại mật khẩu"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {tab === "email" && (
                    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
                        <h3 className="text-base font-semibold">
                          Liên kết & email
                        </h3>
                        <p className="text-xs text-emerald-50 mt-1">
                          Quản lý email xác minh và thay đổi email tài khoản
                        </p>
                      </div>

                      <div className="p-5 md:p-6 space-y-5">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Email hiện tại
                              </div>
                              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 break-all">
                                {displayEmail || "Chưa có email"}
                              </div>
                              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {emailHelperText}
                              </div>
                            </div>

                            <div
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border w-fit whitespace-nowrap shrink-0",
                                emailStatusClass
                              )}
                            >
                              <BadgeCheck size={14} className="shrink-0" />
                              <span className="whitespace-nowrap">{emailStatusText}</span>
                            </div>
                          </div>
                        </div>

                        {!canEditEmail ? (
                          <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-4 py-4 flex items-start gap-3">
                            <Info
                              size={18}
                              className="mt-0.5 text-blue-500 dark:text-blue-400 shrink-0"
                            />
                            <div className="text-sm text-blue-800 dark:text-blue-200 leading-6">
                              Tài khoản này đã lấy email từ Facebook. Email đã
                              được liên kết và xác minh qua Facebook nên không cho
                              sửa đổi trong trang cá nhân.
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid md:grid-cols-[minmax(0,440px)_minmax(0,180px)_auto] gap-4 items-end">
                              <div className="relative min-w-0">
                                <RequiredLabel required>Email mới</RequiredLabel>
                                <Mail
                                  size={16}
                                  className="absolute left-3.5 top-[44px] text-slate-400 dark:text-slate-500"
                                />
                                <input
                                  type="email"
                                  value={emailForm.newEmail}
                                  onChange={(e) =>
                                    setEmailForm((prev) => ({
                                      ...prev,
                                      newEmail: e.target.value,
                                    }))
                                  }
                                  className={emailInputStyle}
                                  placeholder="Nhập email mới muốn thay đổi"
                                />
                              </div>

                              <div className="relative min-w-0">
                                <RequiredLabel required>
                                  Mã xác minh email
                                </RequiredLabel>
                                <ShieldCheck
                                  size={16}
                                  className="absolute left-3.5 top-[44px] text-slate-400 dark:text-slate-500"
                                />
                                <input
                                  type="text"
                                  value={emailForm.verificationCode}
                                  onChange={(e) =>
                                    setEmailForm((prev) => ({
                                      ...prev,
                                      verificationCode: e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 6),
                                    }))
                                  }
                                  className={emailInputStyle}
                                  placeholder="Nhập mã 6 số"
                                  maxLength={6}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={sendChangeEmailCode}
                                disabled={sendingEmailCode || emailCooldown > 0}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm text-white font-semibold shadow-md hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap min-w-[170px]"
                              >
                                {sendingEmailCode ? (
                                  <>
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                    Đang gửi...
                                  </>
                                ) : emailCooldown > 0 ? (
                                  <>
                                    <span className="relative inline-flex items-center justify-center w-5 h-5">
                                      <svg
                                        className="w-5 h-5 -rotate-90"
                                        viewBox="0 0 36 36"
                                      >
                                        <circle
                                          cx="18"
                                          cy="18"
                                          r="15.5"
                                          fill="none"
                                          stroke="rgba(255,255,255,0.25)"
                                          strokeWidth="3"
                                        />
                                        <circle
                                          cx="18"
                                          cy="18"
                                          r="15.5"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="3"
                                          strokeLinecap="round"
                                          strokeDasharray={`${cooldownProgress} 100`}
                                          pathLength="100"
                                        />
                                      </svg>
                                    </span>
                                    Gửi lại ({emailCooldown}s)
                                  </>
                                ) : (
                                  <>
                                    <Send size={16} />
                                    {codeSent ? "Gửi lại mã" : "Gửi mã"}
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="flex justify-end gap-3 pt-1">
                              {Boolean(isEmailDirty) && (
                                <button
                                  type="button"
                                  onClick={cancelEmailFlow}
                                  disabled={changingEmail || sendingEmailCode}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm text-slate-700 dark:text-slate-200 font-semibold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
                                >
                                  <XCircle size={16} />
                                  Hủy
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={confirmChangeEmail}
                                disabled={changingEmail}
                                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3 text-sm text-white font-semibold shadow-md hover:opacity-95 transition disabled:opacity-60"
                              >
                                {changingEmail ? (
                                  <Loader2
                                    size={16}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <BadgeCheck size={16} />
                                )}
                                {changingEmail
                                  ? "Đang xác minh..."
                                  : "Xác minh và đổi email"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
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
                <li>
                  <a
                    href="/home"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <HomeIcon className="h-4 w-4" />
                    Trang chủ
                  </a>
                </li>
                <li>
                  <a
                    href="/map"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <MapPin className="h-4 w-4" />
                    Bản đồ
                  </a>
                </li>
                <li>
                  <a
                    href="/rescueteam_user"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Yêu cầu của tôi
                  </a>
                </li>
                <li>
                  <a
                    href="/about"
                    className="flex items-center gap-2 transition hover:text-blue-600"
                  >
                    <Info className="h-4 w-4" />
                    Hướng dẫn an toàn
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
}