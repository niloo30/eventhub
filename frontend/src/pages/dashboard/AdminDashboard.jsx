import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext.jsx";
import DashboardHeader from "../../components/dashboard/DashboardHeader.jsx";
import DashboardStatCard from "../../components/dashboard/DashboardStatCard.jsx";
import DashboardToast from "../../components/dashboard/DashboardToast.jsx";
import DashboardUserModal from "../../components/dashboard/DashboardUserModal.jsx";
import AdminAnalytics from "./AdminAnalytics.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import INDIA_CITIES from "../../config/indiaCities.js";

const seatSectionFields = [
  {
    title: "Section 1",
    nameField: "section1Name",
    rowsField: "section1Rows",
    seatsField: "section1SeatsPerRow",
    priceField: "section1Price",
    defaultName: "Section 1",
  },
  {
    title: "Section 2",
    nameField: "section2Name",
    rowsField: "section2Rows",
    seatsField: "section2SeatsPerRow",
    priceField: "section2Price",
    defaultName: "Section 2",
  },
  {
    title: "Section 3",
    nameField: "section3Name",
    rowsField: "section3Rows",
    seatsField: "section3SeatsPerRow",
    priceField: "section3Price",
    defaultName: "Section 3",
  },
];

const defaultMovieForm = {
  title: "",
  genre: "General",
  subtitle: "",
  description: "",
  venue: "",
  city: "",
  screenName: "",
  date: "",
  durationMinutes: "150",
  rating: "0",
  currency: "INR",
  language: "Hindi",
  tags: "",
  featured: false,
  section1Name: "Section 1",
  section1Rows: "2",
  section1SeatsPerRow: "7",
  section1Price: "360",
  section2Name: "Section 2",
  section2Rows: "3",
  section2SeatsPerRow: "9",
  section2Price: "230",
  section3Name: "Section 3",
  section3Rows: "2",
  section3SeatsPerRow: "10",
  section3Price: "160",
  posterUrl: "",
};

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDateTimeInput(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatShowDate(value) {
  if (!value) return "Schedule pending";

  return new Date(value).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function summarizeSeatSections(seats = []) {
  const sections = new Map();

  for (const seat of seats) {
    const current = sections.get(seat.section) || {
      name: seat.section,
      price: seat.price,
      rows: new Map(),
    };

    const rowSeats = current.rows.get(seat.row) || [];
    rowSeats.push(seat);
    current.rows.set(seat.row, rowSeats);
    sections.set(seat.section, current);
  }

  return [...sections.values()].map((section) => ({
    name: section.name,
    price: section.price,
    rows: section.rows.size,
    seatsPerRow: Math.max(
      0,
      ...[...section.rows.values()].map((rowSeats) => rowSeats.length),
    ),
  }));
}

function buildMovieFormFromMovie(movie) {
  const sections =
    Array.isArray(movie?.seatLayout) && movie.seatLayout.length > 0
      ? movie.seatLayout
      : summarizeSeatSections(movie?.seats || []);
  const [first = {}, second = {}, third = {}] = sections;

  return {
    title: movie?.title || "",
    genre: movie?.genre || "General",
    subtitle: movie?.subtitle || "",
    description: movie?.description || "",
    venue: movie?.venue || "",
    city: movie?.city || "",
    screenName: movie?.screen?.name || `${movie?.title || "Movie"} Screen`,
    date: formatDateTimeInput(movie?.date),
    durationMinutes: String(movie?.durationMinutes || 150),
    rating: String(movie?.rating ?? 0),
    currency: movie?.currency || "INR",
    language: movie?.language || "",
    tags: Array.isArray(movie?.tags) ? movie.tags.join(", ") : "",
    featured: Boolean(movie?.featured),
    section1Name: first.name || defaultMovieForm.section1Name,
    section1Rows: String(first.rows || defaultMovieForm.section1Rows),
    section1SeatsPerRow: String(
      first.seatsPerRow || defaultMovieForm.section1SeatsPerRow,
    ),
    section1Price: String(first.price || defaultMovieForm.section1Price),
    section2Name: second.name || defaultMovieForm.section2Name,
    section2Rows: String(second.rows || defaultMovieForm.section2Rows),
    section2SeatsPerRow: String(
      second.seatsPerRow || defaultMovieForm.section2SeatsPerRow,
    ),
    section2Price: String(second.price || defaultMovieForm.section2Price),
    section3Name: third.name || defaultMovieForm.section3Name,
    section3Rows: String(third.rows || defaultMovieForm.section3Rows),
    section3SeatsPerRow: String(
      third.seatsPerRow || defaultMovieForm.section3SeatsPerRow,
    ),
    section3Price: String(third.price || defaultMovieForm.section3Price),
    posterUrl: movie?.posterUrl || "",
  };
}

export default function AdminDashboard() {
  const { user, logout, token } = useAuth();
  const [pendingEvents, setPendingEvents] = useState([]);
  const [movieShows, setMovieShows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [movieForm, setMovieForm] = useState(() => ({ ...defaultMovieForm }));
  const [editingMovieId, setEditingMovieId] = useState("");
  const [moviePosterFile, setMoviePosterFile] = useState(null);
  const [moviePosterUrl, setMoviePosterUrl] = useState("");
  const [moviePosterInputKey, setMoviePosterInputKey] = useState(0);
  const [savingMovie, setSavingMovie] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [pendingMovieFormData, setPendingMovieFormData] = useState(null);
  const [selectedPosterFiles, setSelectedPosterFiles] = useState({});
  const [uploadingPosterId, setUploadingPosterId] = useState("");
  const [userModal, setUserModal] = useState({
    open: false,
    title: "",
    description: "",
    users: [],
    loading: false,
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    type: "info",
    message: "",
  });

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    setTimeout(
      () => setToast({ open: false, type: "info", message: "" }),
      3000,
    );
  };

  function getAdminRequestConfig() {
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  function updateMovieForm(field, value) {
    setMovieForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetMovieForm() {
    setMovieForm({ ...defaultMovieForm });
    setEditingMovieId("");
    setMoviePosterFile(null);
    setMoviePosterUrl("");
    setMoviePosterInputKey((current) => current + 1);
  }

  function startEditingMovie(movie) {
    setEditingMovieId(movie._id);
    setMovieForm(buildMovieFormFromMovie(movie));
    setMoviePosterFile(null);
    setMoviePosterUrl(movie?.posterUrl || "");
    setMoviePosterInputKey((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (!user || !token) return;
    void loadDashboard();
  }, [token, user]);

  async function loadDashboard() {
    try {
      const response = await axios.get(
        "/api/admin/dashboard",
        getAdminRequestConfig(),
      );
      const warnings = response.data?.warnings || [];

      setPendingEvents(response.data?.pendingEvents || []);
      setSummary(response.data?.summary || null);
      setMovieShows(response.data?.movieShows || []);

      if (warnings.length > 0) {
        showToast(
          "warning",
          "Some dashboard sections could not be loaded completely.",
        );
      }
    } catch (error) {
      showToast(
        "error",
        error.response?.data?.message || "Unable to load the admin dashboard.",
      );
    }
  }

  async function approveEvent(eventId) {
    try {
      const response = await axios.post(
        `/api/admin/events/${eventId}/approve`,
        null,
        getAdminRequestConfig(),
      );
      await loadDashboard();
      showToast(
        "success",
        response.data?.message || "Event approved successfully.",
      );
    } catch (error) {
      showToast(
        "error",
        error.response?.data?.message || "Unable to approve this event.",
      );
    }
  }

  async function rejectEvent(eventId) {
    try {
      const response = await axios.post(
        `/api/admin/events/${eventId}/reject`,
        null,
        getAdminRequestConfig(),
      );
      await loadDashboard();
      showToast(
        "success",
        response.data?.message || "Event rejected successfully.",
      );
    } catch (error) {
      showToast(
        "error",
        error.response?.data?.message || "Unable to reject this event.",
      );
    }
  }

  async function uploadMoviePoster(showId) {
    const posterFile = selectedPosterFiles[showId];
    if (!posterFile) {
      showToast("info", "Choose an image before uploading.");
      return;
    }

    setUploadingPosterId(showId);

    try {
      const formData = new FormData();
      formData.append("poster", posterFile);

      const response = await axios.put(
        `/api/tickets/shows/${showId}/poster`,
        formData,
        getAdminRequestConfig(),
      );
      setSelectedPosterFiles((current) => {
        const next = { ...current };
        delete next[showId];
        return next;
      });
      await loadDashboard();
      showToast(
        "success",
        response.data?.message || "Movie poster updated successfully.",
      );
    } catch (error) {
      showToast(
        "error",
        error.response?.data?.message || "Unable to upload this movie poster.",
      );
    } finally {
      setUploadingPosterId("");
    }
  }

  async function uploadMoviePosterUrl(showId) {
    if (!moviePosterUrl) {
      showToast("info", "Provide a poster URL first.");
      return;
    }

    try {
      const response = await axios.put(
        `/api/admin/movies/${showId}`,
        { posterUrl: moviePosterUrl },
        getAdminRequestConfig(),
      );
      await loadDashboard();
      showToast("success", response.data?.message || "Movie poster updated.");
      setMoviePosterUrl("");
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message || "Unable to update poster URL.",
      );
    }
  }

  async function submitMovie(event) {
    event.preventDefault();

    // If admin selected All Cities, ask for confirmation first
    if (
      movieForm.city === "ALL_CITIES" &&
      !confirmAllOpen &&
      !pendingMovieFormData
    ) {
      const formData = new FormData();
      Object.entries(movieForm).forEach(([field, value]) => {
        formData.append(
          field,
          typeof value === "boolean" ? String(value) : value,
        );
      });
      if (moviePosterFile) formData.append("poster", moviePosterFile);
      else if (moviePosterUrl) formData.append("posterUrl", moviePosterUrl);

      setPendingMovieFormData(formData);
      setConfirmAllOpen(true);
      return;
    }

    setSavingMovie(true);

    try {
      const formData = pendingMovieFormData || new FormData();
      if (!pendingMovieFormData) {
        Object.entries(movieForm).forEach(([field, value]) => {
          formData.append(
            field,
            typeof value === "boolean" ? String(value) : value,
          );
        });
        if (moviePosterFile) formData.append("poster", moviePosterFile);
        else if (moviePosterUrl) formData.append("posterUrl", moviePosterUrl);
      }

      const response = editingMovieId
        ? await axios.put(
            `/api/admin/movies/${editingMovieId}`,
            formData,
            getAdminRequestConfig(),
          )
        : await axios.post(
            "/api/admin/movies",
            formData,
            getAdminRequestConfig(),
          );

      resetMovieForm();
      setPendingMovieFormData(null);
      setConfirmAllOpen(false);
      await loadDashboard();
      showToast(
        "success",
        response.data?.message ||
          (editingMovieId
            ? "Movie updated successfully."
            : "Movie show created successfully."),
      );
    } catch (error) {
      showToast(
        "error",
        error.response?.data?.message ||
          (editingMovieId
            ? "Unable to update this movie."
            : "Unable to create this movie show."),
      );
    } finally {
      setSavingMovie(false);
    }
  }

  async function openUserModal(scope) {
    const modalMeta =
      scope === "registrations"
        ? {
            title: "Registration Participants",
            description: "Participants and the events they are registered for.",
          }
        : {
            title: "Active Users",
            description: "Customers and organizers who currently have access.",
          };

    setUserModal({
      open: true,
      title: modalMeta.title,
      description: modalMeta.description,
      users: [],
      loading: true,
    });

    try {
      const response = await axios.get("/api/admin/users", {
        ...getAdminRequestConfig(),
        params: { scope },
      });

      setUserModal({
        open: true,
        title: response.data?.title || modalMeta.title,
        description: response.data?.description || modalMeta.description,
        users: response.data?.users || [],
        loading: false,
      });
    } catch (error) {
      setUserModal((current) => ({
        ...current,
        loading: false,
      }));
      showToast(
        "error",
        error.response?.data?.message || "Unable to load the user list.",
      );
    }
  }

  function closeUserModal() {
    setUserModal((current) => ({
      ...current,
      open: false,
      loading: false,
    }));
  }

  const stats = useMemo(() => {
    const totals = summary || {};
    return {
      totalEvents: totals.events || 0,
      approvedEvents: totals.approvedEvents || 0,
      registrations: totals.registrations || 0,
      activeUsers: (totals.customers || 0) + (totals.organizers || 0),
      pendingApprovals: pendingEvents.length,
    };
  }, [pendingEvents, summary]);

  const seatPlanSummary = useMemo(() => {
    const sections = seatSectionFields.map((section) => ({
      name: movieForm[section.nameField] || section.defaultName,
      rows: Number(movieForm[section.rowsField]) || 0,
      seatsPerRow: Number(movieForm[section.seatsField]) || 0,
      price: Number(movieForm[section.priceField]) || 0,
    }));

    const seatCount = sections.reduce(
      (total, section) => total + section.rows * section.seatsPerRow,
      0,
    );
    const prices = sections
      .map((section) => section.price)
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      seatCount,
      sectionNames: sections.map((section) => section.name).filter(Boolean),
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
    };
  }, [movieForm]);

  const isEditingMovie = Boolean(editingMovieId);

  // list of Indian cities for the city dropdown (imported above)

  return (
    <div className="space-y-6">
      <DashboardToast toast={toast} />
      <DashboardUserModal
        open={userModal.open}
        title={userModal.title}
        description={userModal.description}
        users={userModal.users}
        loading={userModal.loading}
        onClose={closeUserModal}
      />

      <ConfirmModal
        open={confirmAllOpen}
        title="Roll out to all cities?"
        description="You're about to create this show across all configured Indian cities. This action will create separate theater records per city. Do you want to continue?"
        onCancel={() => {
          setConfirmAllOpen(false);
          setPendingMovieFormData(null);
        }}
        onConfirm={async () => {
          setConfirmAllOpen(false);
          // call submitMovie with a dummy event (preventDefault no-op)
          await submitMovie({ preventDefault: () => {} });
        }}
      />

      <DashboardHeader
        title="Platform control center"
        subtitle="Review pending events and manage the movie catalog directly from one place, including movie, theater, screen, seat, and show details."
        user={user}
        onLogout={logout}
        actions={
          <div className="flex gap-2">
            <button className="btn-outline" onClick={loadDashboard}>
              Refresh Overview
            </button>
            <button className="btn" onClick={() => setShowAnalytics((s) => !s)}>
              {showAnalytics ? "Hide Analytics" : "View Analytics"}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardStatCard
          label="Total Events"
          value={stats.totalEvents}
          hint="All submitted events"
        />
        <DashboardStatCard
          label="Approved"
          value={stats.approvedEvents}
          hint="Visible to attendees"
        />
        <DashboardStatCard
          label="Registrations"
          value={stats.registrations}
          hint="Platform-wide bookings"
          actionLabel="View users"
          onClick={() => openUserModal("registrations")}
        />
        <DashboardStatCard
          label="Active Users"
          value={stats.activeUsers}
          hint="Customers and organizers"
          actionLabel="View users"
          onClick={() => openUserModal("active")}
        />
        <DashboardStatCard
          label="Pending Review"
          value={stats.pendingApprovals}
          hint="Awaiting approval"
        />
      </div>

      {showAnalytics ? (
        <div className="mt-6">
          <AdminAnalytics onClose={() => setShowAnalytics(false)} />
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              Movie Manager
            </div>
            <h2 className="mt-3 text-xl font-bold">
              {isEditingMovie ? "Edit Movie and Show" : "Add Movie Show"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Admin can add a movie directly, or open an existing card below to
              edit it in the same form.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                Catalog movies
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                {movieShows.length}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                Planned seats
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                {seatPlanSummary.seatCount}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Price range
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                INR {seatPlanSummary.minPrice} - INR {seatPlanSummary.maxPrice}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Form mode
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                {isEditingMovie ? "Editing" : "Creating"}
              </div>
            </div>
          </div>
        </div>

        <form className="space-y-6" onSubmit={submitMovie}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1 xl:col-span-2">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Movie title
              </label>
              <input
                className="input w-full"
                placeholder="Enter movie title"
                value={movieForm.title}
                onChange={(event) =>
                  updateMovieForm("title", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Genre
              </label>
              <input
                className="input w-full"
                placeholder="Action, Thriller, Drama..."
                value={movieForm.genre}
                onChange={(event) =>
                  updateMovieForm("genre", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Rating
              </label>
              <input
                className="input w-full"
                min="0"
                max="10"
                step="0.1"
                type="number"
                value={movieForm.rating}
                onChange={(event) =>
                  updateMovieForm("rating", event.target.value)
                }
              />
            </div>

            <div className="space-y-1 xl:col-span-2">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Subtitle
              </label>
              <input
                className="input w-full"
                placeholder="Premiere, family show, thriller night..."
                value={movieForm.subtitle}
                onChange={(event) =>
                  updateMovieForm("subtitle", event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Date and time
              </label>
              <input
                className="input w-full"
                type="datetime-local"
                value={movieForm.date}
                onChange={(event) =>
                  updateMovieForm("date", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Duration (minutes)
              </label>
              <input
                className="input w-full"
                min="1"
                step="1"
                type="number"
                value={movieForm.durationMinutes}
                onChange={(event) =>
                  updateMovieForm("durationMinutes", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Screen name
              </label>
              <input
                className="input w-full"
                placeholder="Screen 1, IMAX Hall..."
                value={movieForm.screenName}
                onChange={(event) =>
                  updateMovieForm("screenName", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Language
              </label>
              <input
                className="input w-full"
                placeholder="Hindi, English, Tamil..."
                value={movieForm.language}
                onChange={(event) =>
                  updateMovieForm("language", event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Currency
              </label>
              <input
                className="input w-full"
                value={movieForm.currency}
                onChange={(event) =>
                  updateMovieForm("currency", event.target.value.toUpperCase())
                }
                maxLength={3}
              />
            </div>

            <div className="space-y-1 xl:col-span-2">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Venue
              </label>
              <input
                className="input w-full"
                placeholder="Cinema hall or multiplex"
                value={movieForm.venue}
                onChange={(event) =>
                  updateMovieForm("venue", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Theater city
              </label>
              <select
                className="input w-full"
                value={movieForm.city}
                onChange={(event) =>
                  updateMovieForm("city", event.target.value)
                }
                required
              >
                <option value="">Select city</option>
                <option value="ALL_CITIES">
                  All Cities (rollout across India)
                </option>
                {INDIA_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 xl:col-span-4">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Description
              </label>
              <textarea
                className="input min-h-[140px] w-full"
                rows="6"
                placeholder="Describe the movie experience, audience appeal, and show atmosphere."
                value={movieForm.description}
                onChange={(event) =>
                  updateMovieForm("description", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-1 xl:col-span-2">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Tags
              </label>
              <input
                className="input w-full"
                placeholder="3D, IMAX, Weekend, Family"
                value={movieForm.tags}
                onChange={(event) =>
                  updateMovieForm("tags", event.target.value)
                }
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Separate tags with commas.
              </p>
            </div>

            <div className="space-y-1 xl:col-span-2">
              <label className="text-sm text-slate-600 dark:text-slate-300">
                {isEditingMovie ? "Replace poster" : "Poster"}
              </label>
              <input
                key={moviePosterInputKey}
                className="input w-full"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setMoviePosterFile(event.target.files?.[0] || null)
                }
              />
              <input
                className="input w-full mt-2"
                placeholder="Or paste poster image URL"
                value={moviePosterUrl}
                onChange={(event) => setMoviePosterUrl(event.target.value)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {moviePosterFile
                  ? `Selected: ${moviePosterFile.name}`
                  : isEditingMovie
                    ? "Optional. Leave empty to keep the current poster."
                    : "Optional poster image for the movie card."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold">Seat Layout</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure the screen section-by-section. Layout changes are
                blocked for screens that already have active or confirmed
                bookings.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {seatSectionFields.map((section) => (
                <div
                  key={section.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="mb-4 text-lg font-bold">{section.title}</div>

                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <label className="text-sm text-slate-600 dark:text-slate-300">
                        Section name
                      </label>
                      <input
                        className="input w-full"
                        value={movieForm[section.nameField]}
                        onChange={(event) =>
                          updateMovieForm(section.nameField, event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm text-slate-600 dark:text-slate-300">
                        Rows
                      </label>
                      <input
                        className="input w-full"
                        min="1"
                        step="1"
                        type="number"
                        value={movieForm[section.rowsField]}
                        onChange={(event) =>
                          updateMovieForm(section.rowsField, event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm text-slate-600 dark:text-slate-300">
                        Seats per row
                      </label>
                      <input
                        className="input w-full"
                        min="1"
                        step="1"
                        type="number"
                        value={movieForm[section.seatsField]}
                        onChange={(event) =>
                          updateMovieForm(
                            section.seatsField,
                            event.target.value,
                          )
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm text-slate-600 dark:text-slate-300">
                        Price
                      </label>
                      <input
                        className="input w-full"
                        min="1"
                        step="1"
                        type="number"
                        value={movieForm[section.priceField]}
                        onChange={(event) =>
                          updateMovieForm(
                            section.priceField,
                            event.target.value,
                          )
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={movieForm.featured}
                onChange={(event) =>
                  updateMovieForm("featured", event.target.checked)
                }
              />
              Make this the featured movie on the movies page
            </label>

            <div className="flex flex-wrap gap-3">
              {isEditingMovie ? (
                <button
                  className="btn-outline"
                  type="button"
                  onClick={resetMovieForm}
                  disabled={savingMovie}
                >
                  Cancel edit
                </button>
              ) : null}
              <button
                className="btn-outline"
                type="button"
                onClick={resetMovieForm}
                disabled={savingMovie}
              >
                Reset form
              </button>
              <button className="btn" type="submit" disabled={savingMovie}>
                {savingMovie
                  ? isEditingMovie
                    ? "Saving movie..."
                    : "Publishing movie..."
                  : isEditingMovie
                    ? "Save movie changes"
                    : "Publish movie show"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Movie Catalog</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Open any movie in edit mode, review its current show details, or
            upload a fresh poster directly from the catalog.
          </p>
        </div>

        {movieShows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No movie shows are available yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {movieShows.map((movie) => {
              const selectedFile = selectedPosterFiles[movie._id];
              const isUploading = uploadingPosterId === movie._id;
              const isActiveCard = editingMovieId === movie._id;

              return (
                <div
                  key={movie._id}
                  className={`overflow-hidden rounded-3xl border bg-slate-50 transition dark:bg-slate-950 ${
                    isActiveCard
                      ? "border-emerald-400 shadow-[0_18px_36px_-24px_rgba(16,185,129,0.9)]"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <img
                    src={movie.posterUrl || "/placeholder.svg"}
                    alt={movie.title}
                    className="h-56 w-full object-cover"
                  />

                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xl font-bold">{movie.title}</div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {movie.subtitle || "Movie details ready for update"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {movie.featured ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                            Featured
                          </span>
                        ) : null}
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                          {movie.genre || "General"}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Duration
                        </div>
                        <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                          {movie.durationMinutes} min
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Rating
                        </div>
                        <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                          {Number(movie.rating || 0).toFixed(1)} / 10
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="space-y-2 text-slate-600 dark:text-slate-300">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            Theater:
                          </span>{" "}
                          {movie.venue}, {movie.city}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            Screen:
                          </span>{" "}
                          {movie.screen?.name || "Default screen"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            Showtime:
                          </span>{" "}
                          {formatShowDate(movie.date)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            Base price:
                          </span>{" "}
                          {formatCurrency(
                            movie.pricing?.min || 0,
                            movie.currency,
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="font-semibold">Current poster path</div>
                      <div className="mt-1 break-all text-slate-500 dark:text-slate-400">
                        {movie.posterUrl || "No poster uploaded yet"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Upload movie picture
                      </label>
                      <input
                        className="input w-full"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setSelectedPosterFiles((current) => ({
                            ...current,
                            [movie._id]: event.target.files?.[0] || null,
                          }))
                        }
                      />
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedFile
                          ? `Selected: ${selectedFile.name}`
                          : "Choose a JPG, PNG, or WebP image."}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        className="btn flex-1"
                        type="button"
                        onClick={() => startEditingMovie(movie)}
                      >
                        {isActiveCard ? "Editing now" : "Edit movie"}
                      </button>
                      <button
                        className="btn-outline flex-1"
                        type="button"
                        onClick={() => uploadMoviePoster(movie._id)}
                        disabled={!selectedFile || isUploading}
                      >
                        {isUploading ? "Uploading..." : "Upload poster"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Pending Events</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Approve or reject new submissions from organizers.
          </p>
        </div>

        {pendingEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No events are waiting for approval right now.
          </div>
        ) : (
          <ul className="space-y-3">
            {pendingEvents.map((event) => (
              <li
                key={event._id}
                className="grid gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[160px_1fr_auto] lg:items-center"
              >
                <img
                  src={event.posterUrl || "/placeholder.svg"}
                  alt={event.title}
                  className="h-32 w-full rounded-2xl object-cover"
                />

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold">{event.title}</div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      Pending Review
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-500 dark:text-slate-400 md:grid-cols-2">
                    <div>Organizer: {event.organizer?.name || "Unknown"}</div>
                    <div>Email: {event.organizer?.email || "No email"}</div>
                    <div>Category: {event.category || "Uncategorized"}</div>
                    <div>
                      Submitted: {new Date(event.createdAt).toLocaleString()}
                    </div>
                    <div>{new Date(event.date).toLocaleString()}</div>
                    <div>{event.location}</div>
                    <div>
                      Permanent booking:{" "}
                      {Number(event.permanentBookingPrice || 0) > 0
                        ? formatCurrency(
                            event.permanentBookingPrice,
                            event.currency || "INR",
                          )
                        : "Disabled"}
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {event.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="btn"
                    onClick={() => approveEvent(event._id)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => rejectEvent(event._id)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
