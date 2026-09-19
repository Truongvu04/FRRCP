import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isTokenExpired } from "../utils/auth";

type PublicUserOnlyRouteProps = {
  children: React.ReactNode;
};

export default function PublicUserOnlyRoute({
  children,
}: PublicUserOnlyRouteProps) {
  const location = useLocation();

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (token && !isTokenExpired(token)) {
    if (role === "admin") {
      return <Navigate to="/map_admin" replace state={{ from: location }} />;
    }

    if (role === "rescuer") {
      return <Navigate to="/map_rescue" replace state={{ from: location }} />;
    }
  }

  return <>{children}</>;
}