import { useState, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clearAuthStorage, isTokenExpired } from "../utils/auth";
import {
  Eye,
  EyeOff,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import axios from "axios";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuthModal } from "../contexts/AuthModalContext";

const API_URL = "http://localhost:3000";
const REGISTER_CODE_COOLDOWN = 60;
const FORGOT_CODE_COOLDOWN = 60;

const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

type ToastType = "success" | "error" | "warning" | "info";

interface ToastState {
  id: number;
  show: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

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
            "pointer-events-auto w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border shadow-2xl overflow-hidden bg-white",
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
              <div className="font-bold text-sm text-slate-900">
                {meta.title}
              </div>
              <div className="text-sm text-slate-600">{toast.message}</div>
              <div className="text-xs text-slate-400 mt-1">
                Tự đóng sau {Math.ceil(toast.duration / 1000)}s
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="h-1 bg-slate-100">
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
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
};

function LoginModal({ open, onClose }: LoginModalProps) {
  const { authMode, setAuthMode, setOpenLogin } = useAuthModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"user" | "staff">("user");

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [registerCodeCooldown, setRegisterCodeCooldown] = useState(0);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [isSendingForgotCode, setIsSendingForgotCode] = useState(false);
  const [forgotCodeSent, setForgotCodeSent] = useState(false);
  const [forgotCodeCooldown, setForgotCodeCooldown] = useState(0);

  const [showPassword, setShowPassword] = useState({
    login: false,
    register: false,
    confirm: false,
    forgot: false,
    forgotConfirm: false,
  });

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

  const isBusinessWarningMessage = (message: string) => {
    const normalized = (message || "").toLowerCase();

    return (
      normalized.includes("email đã được sử dụng") ||
      normalized.includes("email đã được sử dụng.") ||
      normalized.includes("email đã tồn tại") ||
      normalized.includes("email đã được sử dụng. vui lòng sử dụng email khác") ||
      normalized.includes("sđt đã tồn tại") ||
      normalized.includes("số điện thoại đã tồn tại") ||
      normalized.includes("số điện thoại đã được sử dụng") ||
      normalized.includes("số điện thoại đã được sử dụng.") ||
      normalized.includes("số điện thoại đã được sử dụng. vui lòng sử dụng số khác") ||
      normalized.includes("sdt da ton tai") ||
      normalized.includes("email da duoc su dung") ||
      normalized.includes("email da ton tai") ||
      normalized.includes("vui lòng đăng nhập ở tab admin / đội cứu hộ") ||
      normalized.includes("tài khoản này không thuộc admin / đội cứu hộ") ||
      normalized.includes("vui lòng đăng nhập bằng tài khoản người dân") ||
      normalized.includes("email không tồn tại trong hệ thống") ||
      normalized.includes("mã xác minh không đúng") ||
      normalized.includes("mã xác minh đã hết hạn") ||
      normalized.includes("tài khoản này chưa có mật khẩu")
    );
  };

  const handleRegisterNameChange = (value: string) => {
    setRegName(value);
  };

  const handleRegisterPhoneChange = (value: string) => {
    const clean = value.replace(/[^0-9]/g, "");
    if (clean.length === 1 && clean !== "0") {
      return;
    }
    setRegPhone(clean);
  };

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const clearAuthQuery = useCallback(() => {
    const params = new URLSearchParams(location.search);
    params.delete("auth");
    params.delete("error");
    params.delete("token");
    params.delete("email");
    params.delete("role");
    params.delete("userId");

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate]);

  const resetLoginForm = () => {
    setEmail("");
    setPassword("");
    setLoginMode("user");
  };

  const resetRegisterForm = () => {
    setRegName("");
    setRegPhone("");
    setRegEmail("");
    setRegPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    setCodeSent(false);
    setRegisterCodeCooldown(0);
  };

  const resetForgotForm = () => {
    setForgotEmail("");
    setForgotCode("");
    setForgotPassword("");
    setForgotConfirmPassword("");
    setForgotCodeSent(false);
    setForgotCodeCooldown(0);
  };

  const handleCloseModal = useCallback(() => {
    resetLoginForm();
    resetRegisterForm();
    resetForgotForm();

    setShowPassword({
      login: false,
      register: false,
      confirm: false,
      forgot: false,
      forgotConfirm: false,
    });

    setAuthMode("login");
    setOpenLogin(false);

    if (new URLSearchParams(location.search).get("auth") === "login") {
      clearAuthQuery();
    }

    onClose();
  }, [
    clearAuthQuery,
    location.search,
    onClose,
    setAuthMode,
    setOpenLogin,
  ]);

  const handleBackToLogin = () => {
    resetRegisterForm();
    resetForgotForm();
    setShowPassword({
      login: false,
      register: false,
      confirm: false,
      forgot: false,
      forgotConfirm: false,
    });
    setAuthMode("login");
  };

  const saveLogin = useCallback(
    (data: {
      token: string;
      email: string;
      role: string;
      userId: string | number;
    }) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("userId", String(data.userId));

      if (data.email && data.email.trim()) {
        localStorage.setItem("email", data.email);
        localStorage.setItem("displayName", data.email);
      } else {
        localStorage.removeItem("email");
        localStorage.removeItem("displayName");
      }

      window.dispatchEvent(new Event("auth-changed"));

      const redirectAfterLogin = localStorage.getItem("login_redirect") || "/";

      localStorage.removeItem("login_redirect");

      resetLoginForm();
      resetRegisterForm();
      resetForgotForm();

      setShowPassword({
        login: false,
        register: false,
        confirm: false,
        forgot: false,
        forgotConfirm: false,
      });

      setAuthMode("login");
      setOpenLogin(false);

      clearAuthQuery();

      if (data.role === "admin") {
        navigate("/home", { replace: true });
        return;
      }

      if (data.role === "rescuer") {
        navigate("/home", { replace: true });
        return;
      }

      navigate(redirectAfterLogin, { replace: true });
    },
    [clearAuthQuery, navigate, setAuthMode, setOpenLogin]
  );

  useEffect(() => {
    const tokenFromQuery = searchParams.get("token");
    const emailFromQuery = searchParams.get("email");
    const roleFromQuery = searchParams.get("role");
    const userIdFromQuery = searchParams.get("userId");
    const error = searchParams.get("error");
    const auth = searchParams.get("auth");

    if (tokenFromQuery && roleFromQuery && userIdFromQuery) {
      saveLogin({
        token: tokenFromQuery,
        email: emailFromQuery || "",
        role: roleFromQuery,
        userId: userIdFromQuery,
      });
      return;
    }

    const currentToken = localStorage.getItem("token");

    if (auth === "login" && (!currentToken || isTokenExpired(currentToken))) {
      setAuthMode("login");
      setOpenLogin(true);
      return;
    }

    if (error === "facebook_cancelled") {
      clearAuthQuery();
      return;
    }

    if (error === "facebook_state_invalid") {
      showToast(
        "Phiên đăng nhập Facebook không hợp lệ, vui lòng thử lại",
        "error"
      );
      setAuthMode("login");
      setOpenLogin(true);
      clearAuthQuery();
      return;
    }

    if (error === "facebook_login_failed") {
      showToast("Đăng nhập Facebook thất bại", "error");
      setAuthMode("login");
      setOpenLogin(true);
      clearAuthQuery();
    }
  }, [
    clearAuthQuery,
    saveLogin,
    searchParams,
    setAuthMode,
    setOpenLogin,
  ]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    if (isTokenExpired(token)) {
      clearAuthStorage();
      window.dispatchEvent(new Event("auth-changed"));
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseModal();
    };

    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleCloseModal]);

  useEffect(() => {
    if (registerCodeCooldown <= 0) return;

    const timer = setInterval(() => {
      setRegisterCodeCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [registerCodeCooldown]);

  useEffect(() => {
    if (forgotCodeCooldown <= 0) return;

    const timer = setInterval(() => {
      setForgotCodeCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [forgotCodeCooldown]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      showToast("Vui lòng nhập email!", "warning");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast("Email không hợp lệ!", "warning");
      return;
    }

    if (!password.trim()) {
      showToast("Vui lòng nhập mật khẩu!", "warning");
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/api/login`, {
        email: email.trim().toLowerCase(),
        password,
        loginType: loginMode,
      });

      const role = res.data.role;

      if (loginMode === "staff" && role === "user") {
        showToast("Tài khoản này không thuộc Admin / Đội cứu hộ", "warning");
        return;
      }

      if (loginMode === "user" && role !== "user") {
        showToast("Vui lòng đăng nhập bằng tài khoản người dân", "warning");
        return;
      }

      saveLogin({
        token: res.data.token,
        email: res.data.email,
        role,
        userId: res.data.userId,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || "";

      if (isBusinessWarningMessage(message)) {
        showToast(message, "warning");
      } else if (error.response?.status === 401) {
        showToast(message || "Sai email hoặc mật khẩu", "warning");
      } else if (error.response?.status === 403) {
        showToast(message || "Tài khoản bị từ chối đăng nhập", "warning");
      } else {
        showToast("Lỗi máy chủ", "error");
      }
    }
  };

  const sendVerificationCode = async () => {
    if (registerCodeCooldown > 0) {
      showToast(`Vui lòng chờ ${registerCodeCooldown}s để gửi lại mã`, "warning");
      return;
    }

    if (!regEmail.trim()) {
      showToast("Email không được để trống!", "warning");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      showToast("Email không hợp lệ", "warning");
      return;
    }

    try {
      setIsSendingCode(true);

      const res = await axios.post(`${API_URL}/api/send-register-code`, {
        email: regEmail.trim().toLowerCase(),
      });

      showToast(res.data.message || "Đã gửi mã xác minh", "success");
      setCodeSent(true);
      setRegisterCodeCooldown(REGISTER_CODE_COOLDOWN);
    } catch (err: any) {
      const message = err.response?.data?.message || "";

      if (isBusinessWarningMessage(message)) {
        showToast(message, "warning");
      } else if (message) {
        showToast(message, "error");
      } else {
        showToast("Không gửi được mã xác minh", "error");
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const sendForgotPasswordCode = async () => {
    if (forgotCodeCooldown > 0) {
      showToast(`Vui lòng chờ ${forgotCodeCooldown}s để gửi lại mã`, "warning");
      return;
    }

    if (!forgotEmail.trim()) {
      showToast("Vui lòng nhập email!", "warning");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      showToast("Email không hợp lệ!", "warning");
      return;
    }

    try {
      setIsSendingForgotCode(true);

      const res = await axios.post(`${API_URL}/api/send-forgot-password-code`, {
        email: forgotEmail.trim().toLowerCase(),
      });

      showToast(
        res.data.message || "Đã gửi mã đặt lại mật khẩu về email",
        "success"
      );
      setForgotCodeSent(true);
      setForgotCodeCooldown(FORGOT_CODE_COOLDOWN);
    } catch (err: any) {
      const message = err.response?.data?.message || "";

      if (isBusinessWarningMessage(message)) {
        showToast(message, "warning");
      } else if (message) {
        showToast(message, "error");
      } else {
        showToast("Không gửi được mã đặt lại mật khẩu", "error");
      }
    } finally {
      setIsSendingForgotCode(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotEmail.trim()) {
      showToast("Vui lòng nhập email!", "warning");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      showToast("Email không hợp lệ!", "warning");
      return;
    }

    if (!forgotCode.trim()) {
      showToast("Vui lòng nhập mã xác minh!", "warning");
      return;
    }

    if (forgotCode.trim().length !== 6) {
      showToast("Mã xác minh phải gồm 6 số", "warning");
      return;
    }

    if (!forgotPassword.trim()) {
      showToast("Vui lòng nhập mật khẩu mới!", "warning");
      return;
    }

    if (forgotPassword.length < 6) {
      showToast("Mật khẩu mới phải có ít nhất 6 ký tự", "warning");
      return;
    }

    if (!forgotConfirmPassword.trim()) {
      showToast("Vui lòng nhập lại mật khẩu mới!", "warning");
      return;
    }

    if (forgotPassword !== forgotConfirmPassword) {
      showToast("Mật khẩu nhập lại không khớp!", "warning");
      return;
    }

    try {
      const normalizedEmail = forgotEmail.trim().toLowerCase();

      const res = await axios.post(`${API_URL}/api/reset-password`, {
        email: normalizedEmail,
        verificationCode: forgotCode.trim(),
        newPassword: forgotPassword,
      });

      showToast(res.data.message || "Đặt lại mật khẩu thành công", "success");

      resetForgotForm();
      setAuthMode("login");
      setEmail(normalizedEmail);
      setPassword("");
    } catch (err: any) {
      const message = err.response?.data?.message || "";

      if (isBusinessWarningMessage(message)) {
        showToast(message, "warning");
      } else if (message) {
        showToast(message, "error");
      } else {
        showToast("Không thể đặt lại mật khẩu", "error");
      }
    }
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regName.trim()) {
      showToast("Vui lòng nhập họ và tên!", "warning");
      return;
    }

    // Kiểm tra không có số hoặc ký tự đặc biệt nguy hiểm (cho phép tiếng Việt + khoảng trắng + dấu ngoặc đơn, gạch)
    if (/[0-9!@#$%^&*()_+=\[\]{};:'",.<>?\/\\|`~]/.test(regName)) {
      showToast("Họ và tên không được chứa số hoặc ký tự đặc biệt", "warning");
      return;
    }

    if (!regPhone.trim()) {
      showToast("Vui lòng nhập số điện thoại!", "warning");
      return;
    }

    if (!/^0[0-9]{9}$/.test(regPhone)) {
      showToast(
        "Số điện thoại phải gồm 10 số và bắt đầu bằng 0",
        "warning"
      );
      return;
    }

    if (!regEmail.trim()) {
      showToast("Vui lòng nhập email!", "warning");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      showToast("Email không hợp lệ!", "warning");
      return;
    }

    if (!verificationCode.trim()) {
      showToast("Vui lòng nhập mã xác minh email!", "warning");
      return;
    }

    if (verificationCode.trim().length !== 6) {
      showToast("Mã xác minh phải gồm 6 số", "warning");
      return;
    }

    if (!regPassword.trim()) {
      showToast("Vui lòng nhập mật khẩu!", "warning");
      return;
    }

    if (regPassword.length < 6) {
      showToast("Mật khẩu phải có ít nhất 6 ký tự", "warning");
      return;
    }

    if (!confirmPassword.trim()) {
      showToast("Vui lòng nhập lại mật khẩu!", "warning");
      return;
    }

    if (regPassword !== confirmPassword) {
      showToast("Mật khẩu không khớp. Vui lòng nhập lại!", "warning");
      return;
    }

    try {
      const normalizedEmail = regEmail.trim().toLowerCase();

      const res = await axios.post(`${API_URL}/api/register`, {
        name: regName,
        phone: regPhone,
        email: normalizedEmail,
        password: regPassword,
        verificationCode: verificationCode.trim(),
      });

      showToast(res.data.message || "Đăng ký thành công", "success");

      resetRegisterForm();
      setAuthMode("login");
      setEmail(normalizedEmail);
      setPassword("");
    } catch (err: any) {
      const message = err.response?.data?.message || "";

      if (isBusinessWarningMessage(message)) {
        showToast(message, "warning");
      } else if (message) {
        showToast(message, "error");
      } else {
        showToast("Không kết nối được server", "error");
      }
    }
  };

  const loginWithFacebook = () => {
    localStorage.setItem("login_redirect", location.pathname);
    window.location.href = `${API_URL}/api/auth/facebook?redirect=${encodeURIComponent(
      location.pathname
    )}`;
  };

  if (!open) return null;

  return (
    <>
      <NotificationToast toast={toast} onClose={closeToast} />

      <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          onClick={handleCloseModal}
        />

        <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <button
            onClick={handleCloseModal}
            className="absolute top-4 text-white right-4 hover:bg-slate-100 hover:text-slate-700 rounded-full p-1 transition"
          >
            <X />
          </button>

          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <svg className="w-6 h-6 text-white" viewBox="0 0 48 48">
                  <path
                    d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight">
                  {authMode === "login"
                    ? "Đăng nhập"
                    : authMode === "register"
                      ? "Đăng ký"
                      : "Quên mật khẩu"}
                </h2>
                <p className="text-sm text-slate-200 mt-1">
                  {authMode === "login"
                    ? "Truy cập nhanh vào hệ thống FRRP"
                    : authMode === "register"
                      ? "Tạo tài khoản người dân mới để tham gia"
                      : "Nhập email để nhận mã đặt lại mật khẩu"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {authMode === "login" ? (
              <>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 mb-5">
                  <button
                    type="button"
                    onClick={() => setLoginMode("user")}
                    className={`rounded-xl py-2.5 text-sm font-semibold transition ${loginMode === "user"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    Người dân
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoginMode("staff")}
                    className={`rounded-xl py-2.5 text-sm font-semibold transition ${loginMode === "staff"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    Nội bộ
                  </button>
                </div>

                <div className="mb-5">
                  <h3 className="text-lg font-bold text-slate-900">
                    {loginMode === "user"
                      ? "Đăng nhập tài khoản người dân"
                      : "Đăng nhập Admin / Đội cứu hộ"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {loginMode === "user"
                      ? "Dùng tài khoản thường hoặc Facebook."
                      : "Dùng tài khoản được hệ thống cấp."}
                  </p>
                </div>

                <form className="space-y-4" onSubmit={login} noValidate>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="Nhập email đăng nhập"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Mật khẩu
                    </label>

                    <div className="relative">
                      <input
                        type={showPassword.login ? "text" : "password"}
                        placeholder="Nhập mật khẩu"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            login: !prev.login,
                          }))
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                      >
                        {showPassword.login ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>

                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email.trim().toLowerCase());
                          setAuthMode("forgot");
                        }}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    {loginMode === "user" ? "Đăng nhập" : "Đăng nhập nội bộ"}
                  </button>
                </form>

                {loginMode === "user" && (
                  <>
                    <div className="relative my-5">
                      <div className="border-t border-slate-200" />
                      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-slate-400">
                        hoặc
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={loginWithFacebook}
                      className="flex items-center justify-center gap-3 w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg"
                        alt="facebook"
                        className="w-5 h-5 bg-white rounded-full p-[2px]"
                      />
                      Đăng nhập với Facebook
                    </button>

                    <div className="pt-4 text-center">
                      <p className="text-sm text-slate-600">
                        Chưa có tài khoản?{" "}
                        <button
                          type="button"
                          onClick={() => setAuthMode("register")}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          Đăng ký ngay
                        </button>
                      </p>
                    </div>
                  </>
                )}

                {loginMode === "staff" && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                      Chỉ dành cho Admin và Đội cứu hộ. Không hỗ trợ Facebook ở
                      khu vực này.
                    </p>
                  </div>
                )}
              </>
            ) : authMode === "register" ? (
              <>
                <form onSubmit={register} className="space-y-4" noValidate>
                  <div>
                    <RequiredLabel required>Họ và tên</RequiredLabel>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => handleRegisterNameChange(e.target.value)}
                      placeholder="Nhập họ và tên"
                      maxLength={50}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <RequiredLabel required>Số điện thoại</RequiredLabel>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => handleRegisterPhoneChange(e.target.value)}
                      placeholder="Nhập số điện thoại"
                      maxLength={10}
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <RequiredLabel required>Email</RequiredLabel>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="Nhập email đăng nhập"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <RequiredLabel required>Mã xác minh email</RequiredLabel>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) =>
                          setVerificationCode(
                            e.target.value.replace(/\D/g, "").slice(0, 6)
                          )
                        }
                        placeholder="Nhập mã 6 số"
                        maxLength={6}
                        className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                      />

                      <button
                        type="button"
                        onClick={sendVerificationCode}
                        disabled={isSendingCode || registerCodeCooldown > 0}
                        className="min-w-[120px] rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSendingCode
                          ? "Đang gửi..."
                          : registerCodeCooldown > 0
                            ? `Gửi lại (${registerCodeCooldown}s)`
                            : codeSent
                              ? "Gửi lại mã"
                              : "Gửi mã"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <RequiredLabel required>Mật khẩu</RequiredLabel>

                    <div className="relative">
                      <input
                        type={showPassword.register ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Nhập mật khẩu"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            register: !prev.register,
                          }))
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                      >
                        {showPassword.register ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <RequiredLabel required>Nhập lại mật khẩu</RequiredLabel>

                    <div className="relative">
                      <input
                        type={showPassword.confirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            confirm: !prev.confirm,
                          }))
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                      >
                        {showPassword.confirm ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    Đăng ký ngay
                  </button>
                </form>

                <div className="pt-4 text-center">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </div>
              </>
            ) : (
              <>
                <form onSubmit={resetPassword} className="space-y-4" noValidate>
                  <div>
                    <RequiredLabel required>Email</RequiredLabel>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Nhập email tài khoản"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <RequiredLabel required>Mã xác minh</RequiredLabel>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={forgotCode}
                        onChange={(e) =>
                          setForgotCode(
                            e.target.value.replace(/\D/g, "").slice(0, 6)
                          )
                        }
                        placeholder="Nhập mã 6 số"
                        maxLength={6}
                        className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                      />

                      <button
                        type="button"
                        onClick={sendForgotPasswordCode}
                        disabled={isSendingForgotCode || forgotCodeCooldown > 0}
                        className="min-w-[120px] rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:from-slate-900 hover:to-black hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSendingForgotCode
                          ? "Đang gửi..."
                          : forgotCodeCooldown > 0
                            ? `Gửi lại (${forgotCodeCooldown}s)`
                            : forgotCodeSent
                              ? "Gửi lại mã"
                              : "Gửi mã"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <RequiredLabel required>Mật khẩu mới</RequiredLabel>

                    <div className="relative">
                      <input
                        type={showPassword.forgot ? "text" : "password"}
                        value={forgotPassword}
                        onChange={(e) => setForgotPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            forgot: !prev.forgot,
                          }))
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                      >
                        {showPassword.forgot ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <RequiredLabel required>Nhập lại mật khẩu mới</RequiredLabel>

                    <div className="relative">
                      <input
                        type={showPassword.forgotConfirm ? "text" : "password"}
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-12 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            forgotConfirm: !prev.forgotConfirm,
                          }))
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                      >
                        {showPassword.forgotConfirm ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    Đặt lại mật khẩu
                  </button>
                </form>

                <div className="pt-4 text-center">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-sm font-semibold text-slate-700 hover:underline"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginModal;