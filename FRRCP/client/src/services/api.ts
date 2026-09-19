import axios from "axios";
import { forceLogout, isTokenExpired } from "../utils/auth";

const API = axios.create({
  baseURL: "http://localhost:3000/api",
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    if (isTokenExpired(token)) {
      forceLogout({
        message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
        openLogin: true,
      });

      return Promise.reject(new axios.Cancel("Token expired before request"));
    }

    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const serverCode = error?.response?.data?.code;
    const serverMessage = error?.response?.data?.message;

    if (serverCode === "ACCOUNT_INACTIVE") {
      forceLogout({
        message:
          serverMessage ||
          "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
        openLogin: true,
      });

      return Promise.reject(error);
    }

    // Khóa tạm thời: KHÔNG đăng xuất
    if (serverCode === "ACCOUNT_TEMPORARY_LOCKED") {
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default API;

export const getRescues = () => API.get("/rescues");

export const createRescue = (data: any) => API.post("/rescues", data);

export const getNotificationsStreamUrl = () => {
  const token = localStorage.getItem("token");
  const base = (API.defaults.baseURL || "http://localhost:3000/api").replace(/\/$/, "");
  return `${base}/notifications/stream?token=${encodeURIComponent(token || "")}`;
};