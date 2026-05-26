import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BirthDetailsForm from "../../components/BirthDetailsForm";
import { useAstro } from "../../context/AstroContext";
import { useUser } from "../../hooks/useUser";

export default function AstroChat() {
  const { birthDetails, chartData } = useAstro();
  const { isLoading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (birthDetails && chartData) {
      navigate("/chat", { replace: true });
    }
  }, [birthDetails, chartData, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center constellation-bg" style={{ background: "var(--cream)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
          <p className="font-serif" style={{ fontSize: "15px", color: "var(--purple)", fontStyle: "italic" }}>
            Preparing your chart...
          </p>
        </div>
      </div>
    );
  }

  if (!birthDetails) {
    return <BirthDetailsForm />;
  }

  return null;
}
