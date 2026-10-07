// import { useEffect, useEffectEvent, useState } from "react";
// import { Link } from "react-router-dom";
// import axios from "axios";
// import MovieBookingsDialog from "../components/MovieBookingsDialog.jsx";
// import { useAuth } from "../context/AuthContext.jsx";
// import { useLocationSelection } from "../context/useLocationSelection.js";

// function formatCurrency(amount, currency = "INR") {
//   return new Intl.NumberFormat("en-IN", {
//     style: "currency",
//     currency,
//     maximumFractionDigits: 0,
//   }).format(amount || 0);
// }

// function formatShowDate(date) {
//   return new Date(date).toLocaleString("en-IN", {
//     weekday: "short",
//     day: "numeric",
//     month: "short",
//     hour: "numeric",
//     minute: "2-digit",
//   });
// }

// function formatPriceRange(pricing, currency) {
//   if (!pricing) return formatCurrency(0, currency);
//   if (pricing.min === pricing.max) return formatCurrency(pricing.min, currency);
//   return `${formatCurrency(pricing.min, currency)} - ${formatCurrency(pricing.max, currency)}`;
// }

// function formatDayParam(date) {
//   const nextDate = new Date(date);
//   const year = nextDate.getFullYear();
//   const month = String(nextDate.getMonth() + 1).padStart(2, "0");
//   const day = String(nextDate.getDate()).padStart(2, "0");
//   return `${year}-${month}-${day}`;
// }

// function buildDateStrip(centerDate) {
//   return Array.from({ length: 7 }, (_, index) => {
//     const date = new Date(centerDate);
//     date.setDate(centerDate.getDate() - 3 + index);
//     return date;
//   });
// }

// function isSameCalendarDay(leftDate, rightDate) {
//   return leftDate.toDateString() === rightDate.toDateString();
// }

// export default function MovieShows() {
//   const { user } = useAuth();
//   const { selectedCity } = useLocationSelection();
//   const [movies, setMovies] = useState([]);
//   const [query, setQuery] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [selectedDate, setSelectedDate] = useState(() => new Date());
//   const [currentTime, setCurrentTime] = useState(() => Date.now());
//   const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
//   const [bookingDialogLoading, setBookingDialogLoading] = useState(false);
//   const [bookingDialogError, setBookingDialogError] = useState("");
//   const [userBookings, setUserBookings] = useState([]);

//   useEffect(() => {
//     const timer = window.setInterval(() => setCurrentTime(Date.now()), 60000);
//     return () => window.clearInterval(timer);
//   }, []);

//   useEffect(() => {
//     if (!user) {
//       setBookingDialogOpen(false);
//       setBookingDialogLoading(false);
//       setBookingDialogError("");
//       setUserBookings([]);
//     }
//   }, [user]);

//   useEffect(() => {
//     if (!bookingDialogOpen || !user) return undefined;

//     let mounted = true;

//     async function loadUserBookings() {
//       setBookingDialogLoading(true);
//       setBookingDialogError("");

//       try {
//         const response = await axios.get("/api/tickets/my-bookings", {
//           params: {
//             status: "held,pending_payment,paid",
//           },
//         });

//         if (!mounted) return;

//         const bookings = (response.data.bookings || []).filter(
//           (booking) => booking.show?.type === "movie",
//         );
//         setUserBookings(bookings);
//       } catch (loadError) {
//         if (!mounted) return;

//         setBookingDialogError(
//           loadError.response?.data?.message ||
//             "Unable to load your movie bookings right now.",
//         );
//       } finally {
//         if (mounted) setBookingDialogLoading(false);
//       }
//     }

//     loadUserBookings();

//     return () => {
//       mounted = false;
//     };
//   }, [bookingDialogOpen, user]);

//   const loadMovies = useEffectEvent(async (
//     nextQuery = query,
//     nextDate = selectedDate,
//     nextCity = selectedCity,
//   ) => {
//     setLoading(true);
//     setError("");

//     try {
//       const response = await axios.get("/api/tickets/shows", {
//         params: {
//           type: "movie",
//           q: nextQuery || undefined,
//           day: formatDayParam(nextDate),
//           city: nextCity || undefined,
//         },
//       });

//       setMovies(response.data.shows || []);
//     } catch (loadError) {
//       setError(
//         loadError.response?.data?.message ||
//           "Unable to load movie shows right now.",
//       );
//     } finally {
//       setLoading(false);
//     }
//   });

//   useEffect(() => {
//     loadMovies(undefined, undefined, selectedCity);
//   }, [loadMovies, selectedCity]);

//   const dateStrip = buildDateStrip(selectedDate);
//   const today = new Date(currentTime);
//   const featuredMovie =
//     movies.find((movie) => movie.featured) || movies[0] || null;

//   function shiftDate(direction) {
//     const nextDate = new Date(selectedDate);
//     nextDate.setDate(nextDate.getDate() + direction);
//     setSelectedDate(nextDate);
//     loadMovies(query, nextDate, selectedCity);
//   }

//   return (
//     <div className="space-y-6">
//       <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_32%),linear-gradient(135deg,_#081120,_#11284a_55%,_#173463)] p-6 text-white shadow-xl dark:border-slate-800">
//         <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
//           <div className="space-y-4">
//             <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
//               Movie Hall Booking
//             </div>
//             <div>
//               <h1 className="text-3xl font-black tracking-tight md:text-4xl">
//                 Book seats like a real cinema website.
//               </h1>
//             </div>

//             <div className="space-y-3">
//               <div className="flex items-center justify-between gap-3">
//                 <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-100">
//                   Select the date
//                 </p>
//                 <div className="flex flex-wrap items-center justify-end gap-2">
//                   {selectedCity ? (
//                     <div className="rounded-full border border-emerald-200/20 bg-emerald-400/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
//                       {selectedCity}
//                     </div>
//                   ) : null}
//                   <div className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
//                     {selectedDate.toLocaleDateString("en-IN", {
//                       weekday: "long",
//                       day: "numeric",
//                       month: "long",
//                     })}
//                   </div>
//                 </div>
//               </div>

//               <div className="flex items-center justify-between gap-3">
//                 <button
//                   type="button"
//                   onClick={() => shiftDate(-1)}
//                   className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/15"
//                 >
//                   Prev
//                 </button>

//                 <button
//                   type="button"
//                   onClick={() => shiftDate(1)}
//                   className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/15"
//                 >
//                   Next
//                 </button>
//               </div>

//               <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
//                 {dateStrip.map((date) => {
//                   const isToday = isSameCalendarDay(date, today);
//                   const isSelected = isSameCalendarDay(date, selectedDate);

//                   return (
//                     <button
//                       key={date.toISOString()}
//                       type="button"
//                       onClick={() => {
//                         setSelectedDate(date);
//                         loadMovies(query, date, selectedCity);
//                       }}
//                       className={`min-w-[96px] rounded-[1.5rem] border px-4 py-4 text-center transition ${
//                         isSelected
//                           ? "border-emerald-300/40 bg-emerald-400/20 text-white shadow-[0_16px_34px_-18px_rgba(52,211,153,0.95)]"
//                           : "border-white/12 bg-white/6 text-slate-200 hover:-translate-y-0.5 hover:bg-white/10"
//                       }`}
//                     >
//                       <div className="text-[11px] font-semibold uppercase tracking-[0.22em]">
//                         {date.toLocaleDateString("en-IN", {
//                           weekday: "short",
//                         })}
//                       </div>
//                       <div className="mt-2 text-3xl font-black leading-none">
//                         {date.toLocaleDateString("en-IN", {
//                           day: "2-digit",
//                         })}
//                       </div>
//                       <div className="mt-2 text-sm uppercase tracking-[0.16em]">
//                         {date.toLocaleDateString("en-IN", {
//                           month: "short",
//                         })}
//                       </div>
//                       <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
//                         {isToday ? "Today" : "Schedule"}
//                       </div>
//                     </button>
//                   );
//                 })}
//               </div>
//             </div>

//             <div className="flex flex-wrap items-center gap-3">
//               <input
//                 className="min-w-[220px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
//                 placeholder="Search by movie, venue, or city"
//                 value={query}
//                 onChange={(event) => setQuery(event.target.value)}
//                 onKeyDown={(event) => {
//                   if (event.key === "Enter") {
//                     event.preventDefault();
//                     loadMovies(query, selectedDate, selectedCity);
//                   }
//                 }}
//               />
//               <button
//                 type="button"
//                 className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
//                 onClick={() => loadMovies(query, selectedDate, selectedCity)}
//               >
//                 Find shows
//               </button>
//               {user ? (
//                 <button
//                   type="button"
//                   className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
//                   onClick={() => setBookingDialogOpen(true)}
//                 >
//                   My movie bookings
//                 </button>
//               ) : (
//                 <Link
//                   to="/login"
//                   className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
//                 >
//                   Login to view bookings
//                 </Link>
//               )}
//             </div>
//           </div>
//         </div>
//       </section>

//       {featuredMovie ? (
//         <section className="grid gap-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[0.92fr_1.08fr]">
//           <img
//             src={featuredMovie.posterUrl || "/placeholder.svg"}
//             alt={featuredMovie.title}
//             className="h-full min-h-[280px] w-full rounded-[1.5rem] object-cover"
//           />
//           <div className="flex flex-col justify-between rounded-[1.5rem] bg-slate-50 p-6 dark:bg-slate-950">
//             <div>
//               <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
//                 Featured show
//               </div>
//               <h2 className="mt-4 text-3xl font-black tracking-tight">
//                 {featuredMovie.title}
//               </h2>
//               <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
//                 {featuredMovie.subtitle}
//               </p>
//               <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
//                 {featuredMovie.description}
//               </p>
//             </div>

//             <div className="mt-6 grid gap-3 sm:grid-cols-3">
//               <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
//                 <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
//                   Date
//                 </div>
//                 <div className="mt-2 text-sm font-semibold">
//                   {formatShowDate(featuredMovie.date)}
//                 </div>
//               </div>
//               <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
//                 <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
//                   Venue
//                 </div>
//                 <div className="mt-2 text-sm font-semibold">
//                   {featuredMovie.venue}, {featuredMovie.city}
//                 </div>
//               </div>
//               <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
//                 <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
//                   Price
//                 </div>
//                 <div className="mt-2 text-sm font-semibold">
//                   {formatPriceRange(
//                     featuredMovie.pricing,
//                     featuredMovie.currency,
//                   )}
//                 </div>
//               </div>
//             </div>

//             <div className="mt-6 flex flex-wrap items-center gap-3">
//               <Link to={`/tickets/${featuredMovie._id}`} className="btn">
//                 Select seats
//               </Link>
//               <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
//                 {featuredMovie.counters?.available || 0} seats currently
//                 available
//               </div>
//             </div>
//           </div>
//         </section>
//       ) : null}

//       {error ? (
//         <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
//           {error}
//         </div>
//       ) : null}

//       <section className="space-y-4">
//         <div className="flex items-center justify-between gap-3">
//           <div>
//             <h2 className="text-2xl font-black tracking-tight">Now showing</h2>
//             <p className="text-sm text-slate-500 dark:text-slate-400">
//               Movie shows with live seat inventory and section-based pricing for{" "}
//               {selectedDate.toLocaleDateString("en-IN", {
//                 weekday: "short",
//                 day: "numeric",
//                 month: "short",
//               })}
//               {selectedCity ? ` in ${selectedCity}` : " across all cities"}.
//             </p>
//           </div>
//           <div className="flex flex-wrap items-center gap-2">
//             {selectedCity ? (
//               <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
//                 City filter active
//               </span>
//             ) : (
//               <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
//                 All cities
//               </span>
//             )}
//             <button
//               className="btn-outline"
//               onClick={() => loadMovies(query, selectedDate, selectedCity)}
//             >
//               Refresh movies
//             </button>
//           </div>
//         </div>

//         {loading ? (
//           <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
//             {Array.from({ length: 3 }).map((_, index) => (
//               <div
//                 key={index}
//                 className="animate-pulse rounded-[1.75rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
//               >
//                 <div className="h-56 rounded-[1.25rem] bg-slate-200 dark:bg-slate-800" />
//                 <div className="mt-4 h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
//                 <div className="mt-2 h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
//                 <div className="mt-2 h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
//               </div>
//             ))}
//           </div>
//         ) : movies.length === 0 ? (
//           <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
//             No movie shows matched your search for this day
//             {selectedCity ? ` in ${selectedCity}` : ""} yet.
//           </div>
//         ) : (
//           <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
//             {movies.map((movie) => (
//               <Link
//                 key={movie._id}
//                 to={`/tickets/${movie._id}`}
//                 className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
//               >
//                 <div className="relative">
//                   <img
//                     src={movie.posterUrl || "/placeholder.svg"}
//                     alt={movie.title}
//                     className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
//                   />
//                   <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
//                     <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur">
//                       {movie.language || "Movie"}
//                     </span>
//                     <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">
//                       {movie.durationMinutes} min
//                     </span>
//                   </div>
//                 </div>

//                 <div className="space-y-4 p-5">
//                   <div>
//                     <h3 className="text-xl font-bold tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
//                       {movie.title}
//                     </h3>
//                     <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
//                       {movie.subtitle}
//                     </p>
//                   </div>

//                   <div className="grid gap-3 sm:grid-cols-2">
//                     <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
//                       <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
//                         Showtime
//                       </div>
//                       <div className="mt-2 text-sm font-semibold">
//                         {formatShowDate(movie.date)}
//                       </div>
//                     </div>
//                     <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
//                       <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
//                         Base price
//                       </div>
//                       <div className="mt-2 text-sm font-semibold">
//                         {formatPriceRange(movie.pricing, movie.currency)}
//                       </div>
//                     </div>
//                   </div>

//                   <div className="flex flex-wrap items-center gap-2 text-xs">
//                     <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
//                       {movie.counters?.available || 0} available
//                     </span>
//                     <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
//                       {movie.counters?.held || 0} on hold
//                     </span>
//                     <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
//                       {movie.counters?.booked || 0} sold
//                     </span>
//                   </div>

//                   <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
//                     <div className="text-slate-500 dark:text-slate-400">
//                       {movie.venue}, {movie.city}
//                     </div>
//                     <span className="font-semibold text-emerald-700 dark:text-emerald-300">
//                       Book now
//                     </span>
//                   </div>
//                 </div>
//               </Link>
//             ))}
//           </div>
//         )}
//       </section>

//       <MovieBookingsDialog
//         open={bookingDialogOpen}
//         bookings={userBookings}
//         loading={bookingDialogLoading}
//         error={bookingDialogError}
//         onClose={() => setBookingDialogOpen(false)}
//       />
//     </div>
//   );
// }

import { useEffect, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import MovieBookingsDialog from "../components/MovieBookingsDialog.jsx";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLocationSelection } from "../context/useLocationSelection.js";

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatShowDate(date) {
  return new Date(date).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPriceRange(pricing, currency) {
  if (!pricing) return formatCurrency(0, currency);
  if (pricing.min === pricing.max) return formatCurrency(pricing.min, currency);
  return `${formatCurrency(pricing.min, currency)} - ${formatCurrency(pricing.max, currency)}`;
}

function formatDayParam(date) {
  const nextDate = new Date(date);
  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, "0");
  const day = String(nextDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateStrip(centerDate) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(centerDate);
    date.setDate(centerDate.getDate() - 3 + index);
    return date;
  });
}

function isSameCalendarDay(leftDate, rightDate) {
  return leftDate.toDateString() === rightDate.toDateString();
}

export default function MovieShows() {
  const { user } = useAuth();
  const { selectedCity } = useLocationSelection();
  const [movies, setMovies] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingDialogLoading, setBookingDialogLoading] = useState(false);
  const [bookingDialogError, setBookingDialogError] = useState("");
  const [userBookings, setUserBookings] = useState([]);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      setBookingDialogOpen(false);
      setBookingDialogLoading(false);
      setBookingDialogError("");
      setUserBookings([]);
    }
  }, [user]);

  useEffect(() => {
    if (!bookingDialogOpen || !user) return undefined;

    let mounted = true;

    async function loadUserBookings() {
      setBookingDialogLoading(true);
      setBookingDialogError("");

      try {
        const response = await axios.get("/api/tickets/my-bookings", {
          params: {
            status: "held,pending_payment,paid",
          },
        });

        if (!mounted) return;

        const bookings = (response.data.bookings || []).filter(
          (booking) => booking.show?.type === "movie",
        );
        setUserBookings(bookings);
      } catch (loadError) {
        if (!mounted) return;

        setBookingDialogError(
          loadError.response?.data?.message ||
            "Unable to load your movie bookings right now.",
        );
      } finally {
        if (mounted) setBookingDialogLoading(false);
      }
    }

    loadUserBookings();

    return () => {
      mounted = false;
    };
  }, [bookingDialogOpen, user]);

  const loadMovies = useCallback(
    async ({ nextQuery = "", nextDate, nextCity } = {}) => {
      setLoading(true);
      setError("");

      try {
        const response = await axios.get("/api/tickets/shows", {
          params: {
            type: "movie",
            q: nextQuery || undefined,
            day: formatDayParam(nextDate),
            city: nextCity || undefined,
          },
        });

        setMovies(response.data.shows || []);
      } catch (loadError) {
        setError(
          loadError.response?.data?.message ||
            "Unable to load movie shows right now.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadMovies({
      nextQuery: debouncedQuery,
      nextDate: selectedDate,
      nextCity: selectedCity,
    });
  }, [debouncedQuery, loadMovies, selectedCity, selectedDate]);

  const dateStrip = buildDateStrip(selectedDate);
  const today = new Date(currentTime);
  const featuredMovie =
    movies.find((movie) => movie.featured) || movies[0] || null;

  function shiftDate(direction) {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + direction);
    setSelectedDate(nextDate);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_32%),linear-gradient(135deg,_#081120,_#11284a_55%,_#173463)] p-6 text-white shadow-xl dark:border-slate-800">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
              Movie Hall Booking
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Book seats like a real cinema website.
              </h1>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-100">
                  Select the date
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectedCity ? (
                    <div className="rounded-full border border-emerald-200/20 bg-emerald-400/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                      {selectedCity}
                    </div>
                  ) : null}
                  <div className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                    {selectedDate.toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => shiftDate(-1)}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/15"
                >
                  Prev
                </button>

                <button
                  type="button"
                  onClick={() => shiftDate(1)}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/15"
                >
                  Next
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {dateStrip.map((date) => {
                  const isToday = isSameCalendarDay(date, today);
                  const isSelected = isSameCalendarDay(date, selectedDate);

                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => {
                        setSelectedDate(date);
                      }}
                      className={`min-w-[96px] rounded-[1.5rem] border px-4 py-4 text-center transition ${
                        isSelected
                          ? "border-emerald-300/40 bg-emerald-400/20 text-white shadow-[0_16px_34px_-18px_rgba(52,211,153,0.95)]"
                          : "border-white/12 bg-white/6 text-slate-200 hover:-translate-y-0.5 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em]">
                        {date.toLocaleDateString("en-IN", {
                          weekday: "short",
                        })}
                      </div>
                      <div className="mt-2 text-3xl font-black leading-none">
                        {date.toLocaleDateString("en-IN", {
                          day: "2-digit",
                        })}
                      </div>
                      <div className="mt-2 text-sm uppercase tracking-[0.16em]">
                        {date.toLocaleDateString("en-IN", {
                          month: "short",
                        })}
                      </div>
                      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                        {isToday ? "Today" : "Schedule"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                className="min-w-[220px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                placeholder="Search by movie, venue, or city"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void loadMovies({
                      nextQuery: query,
                      nextDate: selectedDate,
                      nextCity: selectedCity,
                    });
                  }
                }}
              />
              {user ? (
                <button
                  type="button"
                  className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                  onClick={() => setBookingDialogOpen(true)}
                >
                  My movie bookings
                </button>
              ) : (
                <Link
                  to="/login"
                  className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Login to view bookings
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {featuredMovie ? (
        <section className="grid gap-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[0.92fr_1.08fr]">
          <img
            src={featuredMovie.posterUrl || "/placeholder.svg"}
            alt={featuredMovie.title}
            className="h-full min-h-[280px] w-full rounded-[1.5rem] object-cover"
          />
          <div className="flex flex-col justify-between rounded-[1.5rem] bg-slate-50 p-6 dark:bg-slate-950">
            <div>
              <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                Featured show
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight">
                {featuredMovie.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {featuredMovie.subtitle}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {featuredMovie.description}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Date
                </div>
                <div className="mt-2 text-sm font-semibold">
                  {formatShowDate(featuredMovie.date)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Venue
                </div>
                <div className="mt-2 text-sm font-semibold">
                  {featuredMovie.venue}, {featuredMovie.city}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Price
                </div>
                <div className="mt-2 text-sm font-semibold">
                  {formatPriceRange(
                    featuredMovie.pricing,
                    featuredMovie.currency,
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to={`/tickets/${featuredMovie._id}`} className="btn">
                Select seats
              </Link>
              <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                {featuredMovie.counters?.available || 0} seats currently
                available
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Now showing</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Movie shows with live seat inventory and section-based pricing for{" "}
              {selectedDate.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              {selectedCity ? ` in ${selectedCity}` : " across all cities"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedCity ? (
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                City filter active
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                All cities
              </span>
            )}
            <button
              className="btn-outline"
              onClick={() =>
                void loadMovies({
                  nextQuery: query,
                  nextDate: selectedDate,
                  nextCity: selectedCity,
                })
              }
            >
              Refresh movies
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-[1.75rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="h-56 rounded-[1.25rem] bg-slate-200 dark:bg-slate-800" />
                <div className="mt-4 h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-2 h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-2 h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : movies.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No movie shows matched your search for this day
            {selectedCity ? ` in ${selectedCity}` : ""} yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {movies.map((movie) => (
              <Link
                key={movie._id}
                to={`/tickets/${movie._id}`}
                className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative">
                  <img
                    src={movie.posterUrl || "/placeholder.svg"}
                    alt={movie.title}
                    className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur">
                      {movie.language || "Movie"}
                    </span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">
                      {movie.durationMinutes} min
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                      {movie.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {movie.subtitle}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Showtime
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {formatShowDate(movie.date)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Base price
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {formatPriceRange(movie.pricing, movie.currency)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                      {movie.counters?.available || 0} available
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                      {movie.counters?.held || 0} on hold
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {movie.counters?.booked || 0} sold
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">
                      {movie.venue}, {movie.city}
                    </div>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Book now
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MovieBookingsDialog
        open={bookingDialogOpen}
        bookings={userBookings}
        loading={bookingDialogLoading}
        error={bookingDialogError}
        onClose={() => setBookingDialogOpen(false)}
      />
    </div>
  );
}
