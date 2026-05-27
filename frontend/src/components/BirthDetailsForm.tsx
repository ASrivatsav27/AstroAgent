import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveBirthDetails } from "../services/api";
import { useAstro } from "../context/AstroContext";

const ZODIAC_DECORATIONS = [
  { symbol: "♈", top: "12%", left: "8%", size: "20px" },
  { symbol: "♉", top: "35%", right: "6%", size: "18px" },
  { symbol: "♊", top: "60%", left: "5%", size: "22px" },
  { symbol: "♋", bottom: "20%", right: "10%", size: "19px" },
  { symbol: "♌", top: "18%", right: "15%", size: "24px" },
  { symbol: "♍", bottom: "35%", left: "12%", size: "17px" },
  { symbol: "♎", top: "75%", right: "8%", size: "21px" },
  { symbol: "♏", top: "8%", left: "25%", size: "16px" },
  { symbol: "♐", bottom: "12%", left: "20%", size: "20px" },
  { symbol: "♑", top: "45%", right: "4%", size: "18px" },
  { symbol: "♒", bottom: "8%", right: "22%", size: "22px" },
  { symbol: "♓", top: "25%", left: "3%", size: "19px" },
];

export default function BirthDetailsForm() {
  const { userId, setBirthDetails, setError, error } = useAstro();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [errors, setErrors] = useState<{ date?: string; time?: string; place?: string }>({});
  const [touched, setTouched] = useState<{ date?: boolean; time?: boolean; place?: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const buildErrors = (nextDate: string, nextTime: string, nextPlace: string) => {
    const nextErrors: typeof errors = {};
    if (!nextDate) nextErrors.date = "Date of birth is required";
    if (!nextTime) nextErrors.time = "Time of birth is required";
    if (!nextPlace.trim()) nextErrors.place = "Place of birth is required";
    return nextErrors;
  };

  const validate = () => {
    const nextErrors = buildErrors(date, time, place);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ date: true, time: true, place: true });
    if (!validate() || !userId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await saveBirthDetails(userId, { date, time, place: place.trim() });
      setBirthDetails({ date, time, place: place.trim() });
      navigate("/reveal");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to save details";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--cream-light)",
    border: "1.5px solid var(--border)",
    borderRadius: "10px",
    padding: "13px 16px",
    fontSize: "15px",
    color: "var(--text)",
    fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 200ms, box-shadow 200ms",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10 constellation-bg" style={{ background: "var(--cream)" }}>
      {/* Floating zodiac decorations */}
      {ZODIAC_DECORATIONS.map((z, i) => (
        <span
          key={i}
          className="zodiac-float"
          style={{
            top: z.top, left: z.left, right: z.right, bottom: z.bottom,
            fontSize: z.size,
          }}
        >
          {z.symbol}
        </span>
      ))}

      <div className="w-full fade-in-mount" style={{ maxWidth: "460px" }}>
        {/* Hero text above card */}
        <div className="text-center mb-8">
          <p style={{ fontSize: "13px", color: "var(--gold)", letterSpacing: "0.25em", marginBottom: "14px", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
            ✦ ASTRA ✦
          </p>
          <h1 className="font-serif" style={{ fontSize: "42px", fontWeight: 600, color: "var(--text)", lineHeight: 1.2, margin: 0 }}>
            Your Cosmic
            <br />
            <span style={{ color: "var(--purple)" }}>Blueprint</span>
          </h1>
        </div>

        {/* Form card */}
        <div style={{
          background: "var(--card)",
          borderRadius: "20px",
          padding: "36px 32px 28px",
          boxShadow: "var(--card-shadow)",
        }}>
          {/* Card header */}
          <div className="text-center mb-6">
            <h2 className="font-serif" style={{ fontSize: "26px", fontWeight: 500, color: "var(--text)", margin: 0 }}>
              ASTR<span style={{ color: "var(--purple)" }}>A</span><span style={{ color: "var(--gold)", fontSize: "14px", verticalAlign: "super" }}>✦</span>
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "6px", display: "block" }}>
                Date of Birth
              </label>
              <input
                type="date"
                value={date}
                onChange={e => {
                  const next = e.target.value;
                  setDate(next);
                  if (touched.date) setErrors(buildErrors(next, time, place));
                }}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, date: true }));
                  setErrors(buildErrors(date, time, place));
                }}
                aria-invalid={Boolean(touched.date && errors.date)}
                aria-describedby={errors.date ? "birth-date-error" : undefined}
                style={inputStyle}
              />
              {touched.date && errors.date && (
                <p id="birth-date-error" className="mt-1" style={{ fontSize: "12px", color: "var(--error)" }}>
                  {errors.date}
                </p>
              )}
            </div>

            <div>
              <label style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "6px", display: "block" }}>
                Birth Time
              </label>
              <input
                type="time"
                value={time}
                onChange={e => {
                  const next = e.target.value;
                  setTime(next);
                  if (touched.time) setErrors(buildErrors(date, next, place));
                }}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, time: true }));
                  setErrors(buildErrors(date, time, place));
                }}
                aria-invalid={Boolean(touched.time && errors.time)}
                aria-describedby={errors.time ? "birth-time-error" : undefined}
                style={inputStyle}
              />
              {touched.time && errors.time && (
                <p id="birth-time-error" className="mt-1" style={{ fontSize: "12px", color: "var(--error)" }}>
                  {errors.time}
                </p>
              )}
            </div>

            <div>
              <label style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "6px", display: "block" }}>
                Birth Location
              </label>
              <input
                type="text"
                value={place}
                onChange={e => {
                  const next = e.target.value;
                  setPlace(next);
                  if (touched.place) setErrors(buildErrors(date, time, next));
                }}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, place: true }));
                  setErrors(buildErrors(date, time, place));
                }}
                placeholder="City, Country"
                aria-invalid={Boolean(touched.place && errors.place)}
                aria-describedby={errors.place ? "birth-place-error" : undefined}
                style={inputStyle}
              />
              {touched.place && errors.place && (
                <p id="birth-place-error" className="mt-1" style={{ fontSize: "12px", color: "var(--error)" }}>
                  {errors.place}
                </p>
              )}
            </div>

            {error && (
              <div style={{
                background: "var(--cream-light)",
                border: "1px solid var(--error)",
                borderRadius: "12px",
                padding: "10px 12px",
                fontSize: "12px",
                color: "var(--error)",
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-gradient w-full" style={{ height: "50px", fontSize: "15px", marginTop: "4px" }}>
              {isSubmitting ? "Computing..." : "Generate Birth Chart"}
            </button>
          </form>

          <p className="text-center mt-5" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Your data is used only to compute your chart.
          </p>
        </div>
      </div>
    </div>
  );
}
