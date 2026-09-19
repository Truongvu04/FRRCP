import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import HomeUser from "./pages/User/HomeUser";
import RescueTeam_User from "./pages/User/RescueTeam_User";
import About from "./pages/User/About";
import RescueTeam_Admin from "./pages/Admin/RescueTeam_Admin";
import RequestSOS_Admin from "./pages/Admin/RequestSOS_Admin";
import RescueTeam_Rescue from "./pages/Rescue/RescueTeam_Rescue";
import Analytics_Rescue from "./pages/Rescue/Analytics_Rescue";
import FRRPAnalytics from "./pages/Admin/FRRPAnalytics";
import Profile from "./pages/Profile";
import MapDashboard from "./pages/User/MapDashboard";
import Map_Rescue from "./pages/Rescue/Map_Rescue";
import Map_Admin from "./pages/Admin/Map_Admin";
import NewsWeather from "./pages/User/NewsWeather";
import LoginModal from "./components/LoginModal";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthModalContext, type AuthModalMode } from "./contexts/AuthModalContext";
import PublicUserOnlyRoute from "./components/PublicUserOnlyRoute";
import AuthSessionManager from "./components/AuthSessionManager";

function App() {
  const [openLogin, setOpenLogin] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("login");

  return (
    <BrowserRouter>
      <AuthModalContext.Provider
        value={{ openLogin, setOpenLogin, authMode, setAuthMode }}
      >
        <AuthSessionManager />

        <Routes>
          <Route path="/" element={<HomeUser />} />
          <Route path="/home" element={<HomeUser />} />
          <Route path="/about" element={<About />} />
          <Route path="/news" element={<NewsWeather />} />
          <Route
            path="/map"
            element={
              <PublicUserOnlyRoute>
                <MapDashboard />
              </PublicUserOnlyRoute>
            }
          />

          <Route
            path="/rescueteam_user"
            element={
              <ProtectedRoute allowRoles={["user"]}>
                <RescueTeam_User />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute allowRoles={["user", "admin", "rescuer"]}>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/rescueteamadmin"
            element={
              <ProtectedRoute allowRoles={["admin"]}>
                <RescueTeam_Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/requestsosadmin"
            element={
              <ProtectedRoute allowRoles={["admin"]}>
                <RequestSOS_Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowRoles={["admin"]}>
                <FRRPAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/map_admin"
            element={
              <ProtectedRoute allowRoles={["admin"]}>
                <Map_Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rescueteamrescue"
            element={
              <ProtectedRoute allowRoles={["rescuer"]}>
                <RescueTeam_Rescue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyticsrescue"
            element={
              <ProtectedRoute allowRoles={["rescuer"]}>
                <Analytics_Rescue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/map_rescue"
            element={
              <ProtectedRoute allowRoles={["rescuer"]}>
                <Map_Rescue />
              </ProtectedRoute>
            }
          />
        </Routes>

        <LoginModal open={openLogin} onClose={() => setOpenLogin(false)} />
      </AuthModalContext.Provider>
    </BrowserRouter>
  );
}

export default App;