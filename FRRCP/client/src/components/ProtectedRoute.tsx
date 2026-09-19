import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { logoutIfTokenExpired } from "../utils/auth";

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowRoles?: string[];
};

export default function ProtectedRoute({
  children,
  allowRoles = [],
}: ProtectedRouteProps) {
  const location = useLocation();

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    localStorage.setItem(
      "login_redirect",
      location.pathname + location.search
    );
    return <Navigate to="/?auth=login" replace />;
  }

  const expired = logoutIfTokenExpired({
    message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
    openLogin: true,
  });

  if (expired) {
    localStorage.setItem(
      "login_redirect",
      location.pathname + location.search
    );
    return <Navigate to="/?auth=login" replace />;
  }

  if (allowRoles.length > 0 && !allowRoles.includes(role || "")) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}