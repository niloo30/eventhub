import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import BrandLogo from "./components/BrandLogo.jsx";
import HeaderCitySelector from "./components/HeaderCitySelector.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { LocationProvider } from "./context/LocationContext.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import EventDetails from "./pages/EventDetails.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import MovieShows from "./pages/MovieShows.jsx";
import Pass from "./pages/Pass.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Signup from "./pages/Signup.jsx";
import TicketShowDetails from "./pages/TicketShowDetails.jsx";
import Profile from "./pages/Profile.jsx";
import VerifyOtp from "./pages/VerifyOtp.jsx";
import AdminDashboard from "./pages/dashboard/AdminDashboard.jsx";
import CustomerDashboard from "./pages/dashboard/CustomerDashboard.jsx";
import OrganizerDashboard from "./pages/dashboard/OrganizerDashboard.jsx";

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  // Admin users have access to all protected routes
  if (user.role === 'admin') return children;

  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    if (document.documentElement.classList.contains("dark")) return "dark";
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const isDark = theme === "dark";

    root.classList.toggle("dark", isDark);
    body?.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}

function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-3 lg:grid-cols-[auto_minmax(360px,1fr)_auto] lg:items-center">
        <Link to="/" className="shrink-0">
          <BrandLogo />
        </Link>

        <div className="order-3 lg:order-2 lg:justify-self-center lg:w-full lg:max-w-[720px]">
          <HeaderCitySelector />
        </div>

        <nav className="order-2 flex flex-wrap items-center justify-end gap-3 text-sm lg:order-3">
          <Link
            to="/"
            className={
              location.pathname === "/" ? "font-semibold underline" : ""
            }
          >
            Home
          </Link>

          <Link
            to="/movies"
            className={
              location.pathname === "/movies" ||
              location.pathname.startsWith("/tickets/")
                ? "font-semibold underline"
                : ""
            }
          >
            Movies
          </Link>

          {user && (
            <Link
              to="/dashboard"
              className={
                location.pathname.startsWith("/dashboard")
                  ? "font-semibold underline"
                  : ""
              }
            >
              Dashboard
            </Link>
          )}

          {user ? (
            <button onClick={logout} className="btn-outline" type="button">
              Logout
            </button>
          ) : (
            <>
              <Link to="/login" className="btn-outline">
                Login
              </Link>
              <Link to="/signup" className="btn">
                Sign up
              </Link>
            </>
          )}

          <button
            aria-label="Toggle theme"
            className="input px-3 py-1"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            type="button"
          >
            {theme === "dark" ? "Dark" : "Light"}
          </button>

          {user ? (
            <div className="relative group">
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-green-400 font-bold text-white hover:bg-green-500">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </button>
              <div className="invisible absolute right-0 z-20 mt-2 w-48 rounded-lg bg-white opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100 dark:bg-slate-800">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs capitalize text-slate-600 dark:text-slate-400">
                    {user?.role}
                  </p>
                </div>
                <Link
                  to="/dashboard"
                  className="block px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Settings
                </Link>
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Profile
                </Link>
                <button
                  onClick={logout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function Layout({ children }) {
  const location = useLocation();
  const showHeroBanner = location.pathname !== "/movies";

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <Navbar />

      {showHeroBanner ? (
        <section className="animated-hero-bg border-b border-slate-200 dark:border-slate-800">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <h1 className="text-2xl font-extrabold md:text-3xl">
              Discover and Manage Events
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              Register, organize, review, and track your event participation.
            </p>
          </div>
        </section>
      ) : null}

      <main className="max-w-10xl flex-1 p-6">{children}</main>

      <footer className="mt-10 border-t border-gray-200 bg-white/50 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 text-sm text-gray-600 dark:text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="text-left">
            <BrandLogo showTagline />
          </div>
          <div className="space-y-1 text-right">
            <p>Event discovery, booking, and live ticketing in one place.</p>
            <p>
              &copy; 2026 EventManager. Developed by{" "}
              <span className="font-semibold text-gray-800 dark:text-slate-200">
                Ansh Rastogi
              </span>
              .
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/movies" element={<MovieShows />} />
              <Route path="/events/:id" element={<EventDetails />} />
              <Route path="/tickets/:id" element={<TicketShowDetails />} />
              <Route
                path="/events/:id/booking"
                element={
                  <PrivateRoute roles={["customer", "organizer", "admin"]}>
                    <BookingPage />
                  </PrivateRoute>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/pass"
                element={
                  <PrivateRoute roles={["customer", "organizer", "admin"]}>
                    <Pass />
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute roles={["customer", "organizer", "admin"]}>
                    <Profile />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute roles={["customer", "organizer", "admin"]}>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/customer"
                element={
                  <PrivateRoute roles={["customer"]}>
                    <CustomerDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/organizer"
                element={
                  <PrivateRoute roles={["organizer"]}>
                    <OrganizerDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <PrivateRoute roles={["admin"]}>
                    <AdminDashboard />
                  </PrivateRoute>
                }
              />
            </Routes>
          </Layout>
        </BrowserRouter>
      </LocationProvider>
    </AuthProvider>
  );
}
