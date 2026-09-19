import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AuthModalContext } from "../contexts/AuthModalContext";
import {
  AUTH_CHANGED_EVENT,
  AUTH_EXPIRED_EVENT,
  forceLogout,
  getToken,
  getTokenExpiryDelayMs,
  isTokenExpired,
} from "../utils/auth";
import {
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

const cn = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

type ToastType = "error" | "warning" | "info";

type ToastState = {
  id: number;
  show: boolean;
  title: string;
  message: string;
  type: ToastType;
  duration: number;
};

const toastMeta = {
  error: {
    icon: XCircle,
    border: "border-red-200 dark:border-red-800",
    iconWrap:
      "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
    line: "bg-red-500",
    bg: "bg-white dark:bg-slate-900",
    title: "text-slate-900 dark:text-white",
    text: "text-slate-600 dark:text-slate-300",
    subText: "text-slate-400 dark:text-slate-500",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-200 dark:border-amber-800",
    iconWrap:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    line: "bg-amber-500",
    bg: "bg-white dark:bg-slate-900",
    title: "text-slate-900 dark:text-white",
    text: "text-slate-600 dark:text-slate-300",
    subText: "text-slate-400 dark:text-slate-500",
  },
  info: {
    icon: Info,
    border: "border-blue-200 dark:border-blue-800",
    iconWrap:
      "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    line: "bg-blue-500",
    bg: "bg-white dark:bg-slate-900",
    title: "text-slate-900 dark:text-white",
    text: "text-slate-600 dark:text-slate-300",
    subText: "text-slate-400 dark:text-slate-500",
  },
} as const;

function SessionToast({
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
            "pointer-events-auto w-[380px] max-w-[calc(100vw-24px)] rounded-2xl border shadow-2xl overflow-hidden",
            meta.border,
            meta.bg
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
              <div className={cn("font-bold text-sm", meta.title)}>
                {toast.title}
              </div>
              <div className={cn("text-sm mt-0.5", meta.text)}>
                {toast.message}
              </div>
              <div className={cn("text-xs mt-1", meta.subText)}>
                Vui lòng đăng nhập lại để tiếp tục.
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

const AuthSessionManager = () => {
  const authModal = useContext(AuthModalContext);
  const timeoutRef = useRef<number | null>(null);

  const [toast, setToast] = useState<ToastState>({
    id: 0,
    show: false,
    title: "",
    message: "",
    type: "info",
    duration: 3500,
  });

  useEffect(() => {
    const clearCurrentTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const scheduleAutoLogout = () => {
      clearCurrentTimer();

      const token = getToken();
      if (!token) return;

      if (isTokenExpired(token)) {
        forceLogout({
          message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
          openLogin: true,
        });
        return;
      }

      const delay = getTokenExpiryDelayMs(token);
      if (delay === null) return;

      timeoutRef.current = window.setTimeout(() => {
        forceLogout({
          message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
          openLogin: true,
        });
      }, delay);
    };

    const handleAuthChanged = () => {
      scheduleAutoLogout();
    };

    const handleAuthExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{
        message?: string;
        openLogin?: boolean;
      }>;

      const message =
        customEvent.detail?.message ||
        "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.";

      const openLogin = customEvent.detail?.openLogin ?? true;

      const lowered = message.toLowerCase();

      const type: ToastType =
        lowered.includes("khóa") || lowered.includes("quyền") || lowered.includes("hết hạn")
          ? "warning"
          : "info";

      const title = lowered.includes("khóa")
        ? "Tài khoản đã bị khóa"
        : lowered.includes("quyền")
          ? "Không còn quyền truy cập"
          : lowered.includes("hết hạn")
            ? "Phiên đăng nhập đã hết hạn"
            : "Thông báo";

      setToast({
        id: Date.now(),
        show: true,
        title,
        message,
        type,
        duration: 3500,
      });

      if (openLogin) {
        authModal?.setAuthMode("login");
        authModal?.setOpenLogin(true);
      }

      clearCurrentTimer();
    };

    scheduleAutoLogout();

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    window.addEventListener(
      AUTH_EXPIRED_EVENT,
      handleAuthExpired as EventListener
    );

    return () => {
      clearCurrentTimer();
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
      window.removeEventListener(
        AUTH_EXPIRED_EVENT,
        handleAuthExpired as EventListener
      );
    };
  }, [authModal]);

  const closeToast = () => {
    setToast((prev) => ({ ...prev, show: false }));
  };

  return <SessionToast toast={toast} onClose={closeToast} />;
};

export default AuthSessionManager;